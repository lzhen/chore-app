import {test,expect,Page} from '@playwright/test';
// Keep mocked requests intercepted after reload; service workers can bypass page.route.
test.use({ serviceWorkers: 'block' });

const TODAY='2026-09-25';
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', B='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function fixture(page:Page,width=390,empty=false){
 await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date('2026-09-25T19:00:00Z'));
 const user={id:OWNER,email:'release-test@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:OWNER,exp:2000000000,role:'authenticated'})).toString('base64url')+'.test-only';
 await page.addInitScript(()=>{Object.defineProperty(window,'Notification',{configurable:true,value:class {static permission='default';static requestPermission=async()=> 'default';}})});
 await page.addInitScript(({user,token})=>{localStorage.setItem('sb-rosofbnimiothwxsabyr-auth-token',JSON.stringify({access_token:token,refresh_token:'mock-only',expires_at:2000000000,expires_in:999999,user,token_type:'bearer'}));},{user,token});
 const db:Record<string,any[]>={team_members:[{id:A,name:'Alex',color:'#075db8',points:0,badges:[],created_at:TODAY},{id:B,name:'Jamie',color:'#8759bb',points:0,badges:[],created_at:TODAY}],categories:[],chore_completions:[],member_availability:[],chores:empty?[]:[
  {id:'11111111-1111-4111-8111-111111111111',title:'Take out the recycling',date:TODAY,due_time:'18:00:00',end_time:'19:00:00',assignee_id:A,recurrence:'none',priority:'medium'},
  {id:'22222222-2222-4222-8222-222222222222',title:'Clean the kitchen counters',date:'2026-09-24',assignee_id:B,recurrence:'none',priority:'medium'},
  {id:'33333333-3333-4333-8333-333333333333',title:'Vacuum common areas',date:'2026-09-27',assignee_id:null,recurrence:'none',priority:'high'},
  {id:'44444444-4444-4444-8444-444444444444',title:'Water the plants',date:TODAY,assignee_id:null,recurrence:'daily',priority:'medium'},
 ]};
 const calls:{method:string;table:string;body:any}[]=[];let fail=false;let readsFail=false;
 await page.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());const table=url.pathname.split('/').pop()!;const method=req.method();
  if(url.pathname.includes('/auth/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
  if(!url.pathname.includes('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  const body=req.postDataJSON();calls.push({method,table,body});
  if((fail&&method!=='GET')||(readsFail&&method==='GET'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic network failure',code:'TEST_ONLY'})});
  const id=url.searchParams.get('id')?.replace(/^eq\./,'');let result:any;
  if(method==='GET')result=id?(db[table]||[]).filter(r=>r.id===id):(db[table]||[]);
  else if(method==='POST'){const item={id:crypto.randomUUID(),created_at:TODAY,...body};db[table]??=[];db[table].push(item);result=item;}
  else if(method==='PATCH'){const item=db[table]?.find(r=>r.id===id);if(item)Object.assign(item,body);result=item?[item]:[];}
  else if(method==='DELETE'){result=(db[table]||[]).filter(r=>r.id===id);db[table]=(db[table]||[]).filter(r=>r.id!==id);}
  else result=[];
  const single=req.headers().accept?.includes('vnd.pgrst.object');if(single&&Array.isArray(result))result=result[0]||null;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/chore-app/');await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true})).toHaveAttribute('aria-current','page');
 return {db,calls,failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},recover:()=>{fail=false;readsFail=false;}};
}


for(const width of [320,390,768,1440]) for(const theme of ['light','dark']) test(`account left alignment ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 const opposite=theme==='light'?'dark':'light';
 await expect(page.getByRole('button',{name:`Switch to ${opposite} mode`,exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:`Switch to ${opposite} mode`,exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',opposite);
 await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 await expect(page.getByRole('heading',{name:'Appearance',exact:true})).toHaveCount(0);
 await expect(page.getByText('Workload Balance',{exact:true})).toHaveCount(0);
 const appearance=await page.getByRole('heading',{name:'Notifications',exact:true}).boundingBox();
 for(const [heading,button] of [['Notifications','Enable Reminders'],['Google Calendar','Connect Google Calendar']]){
  const h=page.getByRole('heading',{name:heading,exact:true}),b=page.getByRole('button',{name:button,exact:true});
  await expect(b).toBeVisible();const hb=await h.boundingBox(),bb=await b.boundingBox();
  expect(Math.abs(bb!.x-hb!.x)).toBeLessThan(1);expect(Math.abs(hb!.x-appearance!.x)).toBeLessThan(1);expect(bb!.y).toBeGreaterThan(hb!.y+hb!.height);
 }
 await expect(page.getByRole('heading',{name:'Privacy',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'View Privacy Policy'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Delete account',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Delete my account',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`account-${width}-${theme}.png`),fullPage:true});
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

for(const width of [320,1440]) for(const theme of ['light','dark']) test(`neutral workload ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Insights',exact:true}).click();
 await page.getByRole('button',{name:'Workload',exact:true}).click();
 await expect(page.getByText('Under 70%',{exact:true})).toHaveCount(0);
 await expect(page.getByText('70-90%',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Over 90%',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Under Capacity',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`workload-${width}-${theme}.png`),fullPage:true});
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});
for(const outcome of ['denied','default','granted','error']) test(`reminder feedback ${outcome}`,async({page},info)=>{
 await fixture(page,390);
 await page.evaluate(outcome=>{Object.defineProperty(window,'Notification',{configurable:true,value:class {static permission='default';static requestPermission=()=>{document.body.dataset.permissionGesture=String(navigator.userActivation.isActive);if(outcome==='error')return Promise.reject(new Error('mock'));this.permission=outcome;return Promise.resolve(outcome);};close(){}}});},outcome);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 await page.getByRole('button',{name:'Enable Reminders',exact:true}).click();
 await expect(page.locator('body')).toHaveAttribute('data-permission-gesture','true');
 await expect(page.locator('#notification-feedback')).toContainText({denied:'blocked',default:'not allowed',granted:'Permission allowed',error:'Could not enable'}[outcome]!);
 await page.screenshot({path:info.outputPath(`reminder-${outcome}.png`),fullPage:true});
});

for(const state of ['denied','unsupported','insecure']) test(`initial reminder state ${state}`,async({page})=>{
 await fixture(page,320);
 await page.addInitScript(state=>{
  Object.defineProperty(window,'Notification',{configurable:true,value:class {static permission=state==='denied'?'denied':'default';static requestPermission=()=>{throw new Error('must not prompt');}}});
  if(state==='unsupported')delete (window as any).Notification;
  if(state==='insecure')Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});
 },state);
 await page.reload();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 const text={denied:'Notifications are blocked',unsupported:'Reminders are unavailable',insecure:'Reminders require HTTPS'}[state]!;
 await expect(page.locator('#notification-feedback')).toContainText(text);
 await page.getByRole('button',{name:'Check again',exact:true}).click();
 await expect(page.locator('#notification-feedback')).toContainText(text);
});

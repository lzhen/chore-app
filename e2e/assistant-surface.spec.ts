import {test,expect,Page} from '@playwright/test';
// Keep mocked requests intercepted after reload; service workers can bypass page.route.
test.use({ serviceWorkers: 'block' });

const TODAY='2026-09-25';
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', B='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function fixture(page:Page,width=390,empty=false){
 await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date('2026-09-25T19:00:00Z'));
 const user={id:OWNER,email:'release-test@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:OWNER,exp:2000000000,role:'authenticated'})).toString('base64url')+'.test-only';
 await page.addInitScript(({user,token})=>{localStorage.setItem('sb-rosofbnimiothwxsabyr-auth-token',JSON.stringify({access_token:token,refresh_token:'mock-only',expires_at:2000000000,expires_in:999999,user,token_type:'bearer'}));},{user,token});
 const db:Record<string,any[]>={team_members:[{id:A,name:'Alex',color:'#075db8',points:0,badges:[],created_at:TODAY},{id:B,name:'Eric',color:'#8759bb',points:0,badges:[],created_at:TODAY},{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Jen',color:'#ab9752',points:0,badges:[],created_at:TODAY}],categories:[],chore_completions:[],member_availability:[],chores:empty?[]:[
  {id:'11111111-1111-4111-8111-111111111111',title:'Take out the recycling',date:TODAY,due_time:'18:00:00',end_time:'19:00:00',assignee_id:A,recurrence:'none',priority:'medium'},
  {id:'22222222-2222-4222-8222-222222222222',title:'Clean the kitchen counters',date:'2026-09-24',assignee_id:B,recurrence:'none',priority:'medium'},
  {id:'33333333-3333-4333-8333-333333333333',title:'Vacuum common areas',date:'2026-09-27',assignee_id:null,recurrence:'none',priority:'high'},
  {id:'44444444-4444-4444-8444-444444444444',title:'Water the plants',date:TODAY,assignee_id:null,recurrence:'daily',priority:'medium'},
 ]};
 if(width===375) db.chores.push(...Array.from({length:100},(_,i)=>({id:`sample-stress-${i}`,title:`Sample chore ${i}`,date:TODAY,assignee_id:null,recurrence:'none',priority:'medium'})));
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
 await page.route('https://apis.google.com/**',route=>route.abort());
 await page.route('https://accounts.google.com/**',route=>route.abort());
 await page.goto('/chore-app/');await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true})).toHaveAttribute('aria-current','page');
 return {db,calls,failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},recover:()=>{fail=false;readsFail=false;}};
}




for(const width of [320,390,768,1440]) for(const theme of ['light','dark']) test(`assistant continuity ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);
 if(await page.locator('html').getAttribute('data-theme')!==theme) await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 const launcher=page.getByRole('button',{name:'Assistant',exact:true});
 await launcher.click();const panel=page.getByRole('dialog',{name:'Assistant',exact:true});await expect(panel).toBeVisible();
 const before=await panel.boundingBox();expect(before!.x).toBeGreaterThanOrEqual(0);expect(before!.x+before!.width).toBeLessThanOrEqual(width);expect(before!.y+before!.height).toBeLessThanOrEqual(844);
 await expect(panel).toHaveCSS('background-image','none');
 const input=panel.getByRole('textbox',{name:'Message'});await input.fill('Unsent household draft');
 await expect(panel.getByRole('tab')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Enable Reminders'})).toHaveCount(0);
 expect(await panel.boundingBox()).toEqual(before);await expect(page.locator('.chore-dialog-backdrop')).toHaveCount(0);
 await expect(input).toHaveValue('Unsent household draft');
 await page.screenshot({path:info.outputPath(`assistant-${width}-${theme}.png`)});
 await input.press('Escape');await expect(panel).toBeHidden();await expect(launcher).toBeFocused();
 for(let i=0;i<2;i++){await launcher.click();await expect(input).toHaveValue('Unsent household draft');await panel.getByRole('button',{name:'Close assistant'}).click();await expect(launcher).toBeFocused();}
 await launcher.click();
 if(width<1100){await expect(page.locator('#root')).toHaveJSProperty('inert',true);await panel.getByRole('button',{name:'Close assistant'}).focus();await page.keyboard.press('Shift+Tab');await expect(panel.getByRole('button',{name:'Send message'})).toBeFocused();await page.keyboard.press('Escape');}
 else {await expect(page.locator('#root')).toHaveJSProperty('inert',false);await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();await expect(panel).toBeVisible();await expect(input).toHaveValue('Unsent household draft');await panel.getByRole('button',{name:'Close assistant'}).click();}
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true}).click();
 if(width>=1100) await launcher.click();
 await page.getByRole('button',{name:'Add new chore',exact:true}).click();await expect(panel).toBeHidden();await expect(page.getByRole('dialog',{name:'Add a chore'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await launcher.click();await expect(input).toHaveValue('Unsent household draft');
 await input.fill('help');await panel.getByRole('button',{name:'Send message'}).click();await expect(panel.getByRole('log')).toContainText('help');await expect(input).toBeEnabled();
 await expect(panel.getByRole('log')).toContainText('help');
 await input.fill('Keep my draft through Account');
 if(width<1100)await panel.getByRole('button',{name:'Close assistant'}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Google Calendar',exact:true})).toBeVisible();
 await expect(page.locator('.nesmi-workload')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Appearance',exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath(`account-${width}-${theme}.png`),fullPage:true});
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true}).click();
 if(width<1100)await launcher.click();
 await expect(input).toHaveValue('Keep my draft through Account');
 await expect(panel.getByRole('log')).toContainText('help');
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

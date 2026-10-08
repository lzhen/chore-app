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
 const db:Record<string,any[]>={team_members:[{id:A,name:'Alex',color:'#075db8',points:0,badges:[],created_at:TODAY},{id:B,name:'Jamie',color:'#8759bb',points:0,badges:[],created_at:TODAY}],categories:[],chore_completions:[],member_availability:[],chores:empty?[]:[
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


for(const width of [375,768,1440]) for(const theme of ['light','dark']) test(`floating actions remain separate ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);
 await page.getByRole('button',{name:/Theme:/}).click();
 await page.getByRole('button',{name:theme==='dark'?/Dark A quieter/:/Light A brighter/}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();
 const add=page.getByRole('button',{name:'Add new chore',exact:true});
 const agent=page.getByRole('button',{name:'Calendar Agent',exact:true});
 await expect(add).toBeVisible();await expect(agent).toBeVisible();
 if(width===375){
  await expect(page.locator('.nesmi-agent-badge')).toHaveText('99+');
  await add.evaluate(el=>{if(el.lastChild)el.lastChild.textContent='Add a household chore';});
 }
 const a=await add.boundingBox(),b=await agent.boundingBox();
 expect(a!.x+a!.width+12).toBeLessThanOrEqual(b!.x);
 expect(b!.x+b!.width).toBeLessThanOrEqual(width-8);
 expect(a!.y+a!.height).toBeLessThanOrEqual(width<768?844-70:844);
 await page.screenshot({path:info.outputPath(`floating-${theme}-${width}.png`),fullPage:true});
 await agent.click();await expect(agent).toHaveAttribute('aria-expanded','true');
 const panel=page.locator('#nesmi-agent-panel');await expect(panel).toBeVisible();
 await expect(panel.locator('.nesmi-agent-heading')).toHaveCSS('color',theme==='dark'?'rgb(242, 242, 243)':'rgb(20, 20, 20)');
 const p=await panel.boundingBox();expect(p!.y).toBeGreaterThanOrEqual(0);expect(p!.y+p!.height+12).toBeLessThanOrEqual(a!.y);
 await page.screenshot({path:info.outputPath(`agent-open-${theme}-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Close Calendar Agent',exact:true}).click();await expect(panel).toHaveCount(0);
 await add.click();await expect(page.getByRole('dialog',{name:'Add a chore'})).toBeVisible();await expect(agent).toHaveCount(0);await expect(add).toHaveCount(0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(agent).toBeVisible();await expect(add).toBeVisible();
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

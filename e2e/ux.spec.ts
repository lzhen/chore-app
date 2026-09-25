import {test,expect,Page} from '@playwright/test';
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
  {id:'44444444-4444-4444-8444-444444444444',title:'Water the plants',date:TODAY,assignee_id:null,recurrence:'none',priority:'medium'},
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
 await page.goto('/chore-app/');await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
 return {db,calls,failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},recover:()=>{fail=false;readsFail=false;}};
}
for(const width of [375,390,430])test(`normal save reachable; time and date survive reload at ${width}px`,async({page},info)=>{
 const {db,calls}=await fixture(page,width);
 await page.screenshot({path:info.outputPath(`today-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Add new chore',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add a chore'});
 await dialog.getByLabel('What needs doing?').fill('A new shared chore');
 await dialog.getByLabel('When?').fill('2026-09-27');
 await dialog.locator('summary').click();
 await dialog.getByLabel('Start time').fill('18:00');await dialog.getByLabel('End time').fill('19:00');
 const save=dialog.getByRole('button',{name:'Add chore',exact:true});
 const box=await save.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThanOrEqual(844);
 await page.screenshot({path:info.outputPath(`new-chore-${width}.png`),fullPage:true});
 await save.click();await expect(dialog).toHaveCount(0);
 expect(db.chores.find(c=>c.title==='A new shared chore')?.end_time).toBe('19:00');
 expect(calls.filter(c=>c.table==='chores'&&c.method==='POST')).toHaveLength(1);
 await page.reload();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Chores',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit A new shared chore'})).toContainText('Sun, Sep 27');
 await page.getByRole('button',{name:'Edit A new shared chore'}).click();await expect(page.getByLabel('End time')).toHaveValue('19:00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed save retains draft, reports error and allows retry',async({page})=>{
 const f=await fixture(page);f.failWrites();await page.getByRole('button',{name:'Add new chore'}).click();await page.getByLabel('What needs doing?').fill('Keep this draft');await page.getByRole('dialog').getByRole('button',{name:'Add chore',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Your entries are still here');await expect(page.getByLabel('What needs doing?')).toHaveValue('Keep this draft');expect(f.db.chores.some(c=>c.title==='Keep this draft')).toBe(false);
 f.recover();await page.getByRole('dialog').getByRole('button',{name:'Add chore',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('search filters the Chores view and exposes an empty state',async({page})=>{
 await fixture(page);await page.getByRole('navigation').getByRole('button',{name:'Chores',exact:true}).click();await page.getByRole('button',{name:'Search chores',exact:true}).click();await page.getByLabel('Search chores',{exact:true}).fill('nothing-matches');await expect(page.getByText('No matching chores')).toBeVisible();await expect(page.locator('.chore-task')).toHaveCount(0);await page.getByLabel('Search chores',{exact:true}).fill('Vacuum');await expect(page.locator('.chore-task')).toHaveCount(1);
});
test('unassigned completion requires explicit member; selection determines credit',async({page})=>{
 const f=await fixture(page);await page.getByRole('button',{name:'Complete: Water the plants',exact:true}).click();await expect(page.getByLabel('Who completed it?')).toHaveValue('');await expect(page.getByRole('button',{name:'Mark done',exact:true})).toBeDisabled();expect(f.db.chore_completions).toHaveLength(0);await page.getByLabel('Who completed it?').selectOption(B);await page.getByRole('button',{name:'Mark done',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(f.db.chore_completions[0].completed_by).toBe(B);
});
test('Insights and Account are top-level pages, with the correct selected tab',async({page})=>{
 await fixture(page);const nav=page.getByRole('navigation',{name:'Primary navigation'});for(const name of ['Insights','Account','Calendar','Today']){await nav.getByRole('button',{name,exact:true}).click();await expect(nav.getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');await expect(page.getByRole('dialog')).toHaveCount(0);}
});
test('dialog isolates background controls, keeps focus and confirms draft discard',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Add new chore'}).click();expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(true);await page.getByLabel('What needs doing?').fill('Do not silently discard');await page.keyboard.press('Escape');await expect(page.getByText('Discard your unsaved changes?')).toBeVisible();await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByLabel('What needs doing?')).toHaveValue('Do not silently discard');
});
test('data load failure has retry, not a misleading empty family',async({page})=>{
 const f=await fixture(page);f.failReads();await page.reload();await expect(page.getByRole('alert')).toContainText('could not be loaded');f.recover();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('button',{name:'Edit Water the plants'})).toBeVisible();
});

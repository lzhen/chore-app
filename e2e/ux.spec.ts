import {test,expect,Page} from '@playwright/test';
// Keep mocked requests intercepted after reload; service workers can bypass page.route.
test.use({ serviceWorkers: 'block' });

const TODAY='2026-09-25';
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', B='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ROUTINE='55555555-5555-4555-8555-555555555555';
const dailyRoutine={id:ROUTINE,title:'Reset the kitchen',date:'2026-09-20',assignee_id:A,recurrence:'daily',priority:'medium'};
const previousCompletion={id:'66666666-6666-4666-8666-666666666666',chore_id:ROUTINE,instance_date:'2026-09-24',completed_by:A,completed_at:'2026-09-24T19:00:00Z'};
type FixtureSeed=Partial<Record<'team_members'|'categories'|'chore_completions'|'member_availability'|'chores',any[]>>;
async function fixture(page:Page,width=390,empty=false,seed:FixtureSeed={}){
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
 Object.assign(db,seed);
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
 await page.getByRole('button',{name:'Edit A new shared chore'}).click();
 await page.getByRole('dialog',{name:'Edit chore'}).locator('summary').click();
 await expect(page.getByLabel('End time')).toHaveValue('19:00');
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
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Chores',exact:true}).click();
 await page.getByRole('button',{name:'Completion history',exact:true}).click();
 await expect(page.locator('.chore-task').filter({hasText:'Water the plants'})).toContainText('Completed by Jamie');
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

test('daily routine completion and undo affect only the selected date',async({page})=>{
 const f=await fixture(page,390,false,{chores:[{...dailyRoutine}],chore_completions:[{...previousCompletion}]});
 await expect(page.getByLabel('Daily progress')).toHaveText('0 of 1 done');
 await page.getByRole('button',{name:'Complete: Reset the kitchen',exact:true}).click();
 await page.getByRole('dialog',{name:'Complete chore'}).getByRole('button',{name:'Mark done',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const saved=f.db.chore_completions.find(c=>c.chore_id===ROUTINE&&c.instance_date===TODAY);
 expect(saved).toBeDefined();expect(saved.completed_by).toBe(A);
 expect(f.db.chore_completions).toHaveLength(2);
 expect(f.db.chore_completions.find(c=>c.id===previousCompletion.id)).toEqual(previousCompletion);
 expect(f.calls.filter(c=>c.method==='POST'&&c.table==='chore_completions')).toHaveLength(1);
 await expect(page.getByLabel('Daily progress')).toHaveText('1 of 1 done');
 await page.getByRole('button',{name:'Saturday, September 26',exact:true}).click();
 await expect(page.getByRole('button',{name:'Complete: Reset the kitchen',exact:true})).toBeVisible();
 await expect(page.getByLabel('Daily progress')).toHaveText('0 of 1 done');
 expect(f.db.chore_completions.some(c=>c.instance_date==='2026-09-26')).toBe(false);
 await page.reload();
 await expect(page.getByLabel('Daily progress')).toHaveText('1 of 1 done');
 await page.locator('summary').filter({hasText:/^Done\b/}).click();
 await page.getByRole('button',{name:'Undo completion: Reset the kitchen',exact:true}).click();
 await page.getByRole('dialog',{name:'Undo completion'}).getByRole('button',{name:'Mark not done',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByLabel('Daily progress')).toHaveText('0 of 1 done');
 expect(f.db.chore_completions).toEqual([previousCompletion]);
 expect(f.db.chores).toEqual([dailyRoutine]);
 expect(f.calls.filter(c=>c.table==='chores'&&c.method!=='GET')).toHaveLength(0);
});

test('routine management stays compact and completion history remains intact',async({page})=>{
 const older={...previousCompletion,id:'77777777-7777-4777-8777-777777777777',instance_date:'2026-09-23',completed_at:'2026-09-23T19:00:00Z'};
 const f=await fixture(page,1440,false,{chores:[{...dailyRoutine}],chore_completions:[{...older},{...previousCompletion}]});
 const original=JSON.parse(JSON.stringify({chores:f.db.chores,completions:f.db.chore_completions}));
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Chores',exact:true}).click();
 await expect(page.getByRole('button',{name:'Active chores',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.chore-task').filter({hasText:'Reset the kitchen'})).toHaveCount(1);
 await page.getByRole('button',{name:'Completion history',exact:true}).click();
 await expect(page.getByRole('button',{name:'Completion history',exact:true})).toHaveAttribute('aria-pressed','true');
 const history=page.locator('.chore-task').filter({hasText:'Reset the kitchen'});
 await expect(history).toHaveCount(2);
 await expect(history.nth(0)).toContainText('Thu, Sep 24');
 await expect(history.nth(1)).toContainText('Wed, Sep 23');
 await page.getByRole('button',{name:'Active chores',exact:true}).click();
 await expect(page.locator('.chore-task').filter({hasText:'Reset the kitchen'})).toHaveCount(1);
 await page.reload();
 expect(f.db.chores).toEqual(original.chores);expect(f.db.chore_completions).toEqual(original.completions);
 expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

test('a household without members can add a member while completing its first chore',async({page})=>{
 const chore={...dailyRoutine,date:TODAY,recurrence:'none',assignee_id:null};
 const f=await fixture(page,390,false,{team_members:[],chores:[chore],chore_completions:[]});
 await page.getByRole('button',{name:'Complete: Reset the kitchen',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Complete chore'});
 await expect(dialog.getByRole('button',{name:'Mark done',exact:true})).toBeDisabled();
 expect(f.db.chore_completions).toHaveLength(0);
 await dialog.getByLabel('Name',{exact:true}).fill('Alex');
 await dialog.getByRole('button',{name:'Add member',exact:true}).click();
 await expect.poll(()=>f.db.team_members.length).toBe(1);
 const member=f.db.team_members[0];
 await dialog.getByLabel('Who completed it?',{exact:true}).selectOption(member.id);
 await dialog.getByRole('button',{name:'Mark done',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 expect(f.db.chore_completions).toHaveLength(1);
 expect(f.db.chore_completions[0]).toMatchObject({chore_id:chore.id,instance_date:TODAY,completed_by:member.id});
 expect(f.calls.filter(c=>c.method==='POST'&&c.table==='team_members')).toHaveLength(1);
 expect(f.calls.filter(c=>c.method==='POST'&&c.table==='chore_completions')).toHaveLength(1);
});

test('Today and Insights agree on recurring chores due today',async({page})=>{
 const single={...dailyRoutine,id:'88888888-8888-4888-8888-888888888888',title:'Put away the groceries',date:TODAY,recurrence:'none'};
 const done={...previousCompletion,id:'99999999-9999-4999-8999-999999999999',chore_id:single.id,instance_date:TODAY,completed_at:'2026-09-25T18:00:00Z'};
 await fixture(page,390,false,{chores:[{...dailyRoutine},single],chore_completions:[{...previousCompletion},done]});
 await expect(page.getByLabel('Daily progress')).toHaveText('1 of 2 done');
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Insights',exact:true}).click();
 await expect(page.getByText('Pending Today',{exact:true}).locator('..').getByText('1',{exact:true})).toBeVisible();
 await expect(page.getByText('Completed Today',{exact:true}).locator('..').getByText('1',{exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Complete: Reset the kitchen',exact:true}).click();
 await page.getByRole('dialog',{name:'Complete chore'}).getByRole('button',{name:'Mark done',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByLabel('Daily progress')).toHaveText('2 of 2 done');
 await nav.getByRole('button',{name:'Insights',exact:true}).click();
 await expect(page.getByText('Pending Today',{exact:true}).locator('..').getByText('0',{exact:true})).toBeVisible();
 await expect(page.getByText('Completed Today',{exact:true}).locator('..').getByText('2',{exact:true})).toBeVisible();
});

test('failed inline member save keeps the name and can be retried without false credit',async({page})=>{
 const chore={...dailyRoutine,date:TODAY,recurrence:'none',assignee_id:null};
 const f=await fixture(page,390,false,{team_members:[],chores:[chore],chore_completions:[]});
 await page.getByRole('button',{name:'Complete: Reset the kitchen',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Complete chore'});
 await dialog.getByLabel('Name',{exact:true}).fill('Alex');f.failWrites();
 await dialog.getByRole('button',{name:'Add member',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('Could not save');
 await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue('Alex');
 await expect(dialog.getByRole('button',{name:'Mark done',exact:true})).toBeDisabled();
 expect(f.db.team_members).toHaveLength(0);expect(f.db.chore_completions).toHaveLength(0);
 f.recover();await dialog.getByRole('button',{name:'Add member',exact:true}).click();
 await expect.poll(()=>f.db.team_members.length).toBe(1);
 await dialog.getByLabel('Who completed it?',{exact:true}).selectOption(f.db.team_members[0].id);
 await dialog.getByRole('button',{name:'Mark done',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 expect(f.db.team_members).toHaveLength(1);expect(f.db.chore_completions).toHaveLength(1);
 expect(f.db.chore_completions[0].completed_by).toBe(f.db.team_members[0].id);
});

test('small-screen appearance controls stay visible and preserve the selected theme',async({page})=>{
 await fixture(page,375);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Account',exact:true}).click();
 for(const name of ['System','Light','Dark']){
  const radio=page.getByRole('radio',{name,exact:true});
  await expect(radio).toBeVisible();
  const label=radio.locator('..');await expect(label).toBeInViewport();
  const box=await label.boundingBox();expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(375);
 }
 await page.getByRole('radio',{name:'Dark',exact:true}).locator('..').click();
 await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('radio',{name:'Light',exact:true}).locator('..').click();
 await expect(page.getByRole('radio',{name:'Light',exact:true})).toBeChecked();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.emulateMedia({colorScheme:'dark'});
 await page.getByRole('radio',{name:'System',exact:true}).locator('..').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await nav.getByRole('button',{name:'Account',exact:true}).click();
 await expect(page.getByRole('radio',{name:'System',exact:true})).toBeChecked();
});

test('desktop opens Today and month columns use weekdays without mismatched day numbers',async({page})=>{
 await fixture(page,1440);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('button',{name:'Today',exact:true})).toHaveAttribute('aria-current','page');
 await nav.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Calendar',exact:true})).toBeVisible();
 await expect(page.locator('.fc-toolbar-title')).toHaveText('Sep 2026');
 const columns=page.locator('.fc-col-header-cell-cushion');
 await expect(columns).toHaveCount(7);
 expect(await columns.allTextContents()).toEqual(['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);
});

test('phone account deletion confirmation is reachable and cancel preserves the account',async({page})=>{
 const f=await fixture(page,375);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 const remove=page.getByRole('button',{name:'Delete my account',exact:true});
 await remove.scrollIntoViewIfNeeded();await expect(remove).toBeInViewport();await remove.click();
 await expect(page.getByText('Are you sure you want to permanently delete your account?',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Delete permanently',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Delete permanently',exact:true})).toHaveCount(0);
 await expect(remove).toBeVisible();await expect(page.getByText('release-test@example.test',{exact:true})).toBeVisible();
 expect(f.calls.filter(c=>c.method==='DELETE')).toHaveLength(0);
});

test('a long phone Today list keeps the last chore completion control reachable',async({page})=>{
 const chores=Array.from({length:20},(_,index)=>({id:`10000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,title:`Household task ${String(index+1).padStart(2,'0')}`,date:TODAY,assignee_id:A,recurrence:'none',priority:'medium'}));
 const f=await fixture(page,375,false,{chores,chore_completions:[]});
 await expect(page.getByLabel('Daily progress')).toHaveText('0 of 20 done');
 const last=page.getByRole('button',{name:'Complete: Household task 20',exact:true});
 await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();await last.click();
 const dialog=page.getByRole('dialog',{name:'Complete chore'});
 await expect(dialog.getByRole('heading',{name:'Household task 20',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Mark done',exact:true})).toBeVisible();
 expect(f.db.chore_completions).toHaveLength(0);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

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
 const calls:{method:string;table:string;body:any;id?:string;choreId?:string;instanceDate?:string}[]=[];let fail=false;let readsFail=false;
 let loseCompletionInsertResponse = false;
 let loseCompletionDeleteResponse = false;
 await page.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());const table=url.pathname.split('/').pop()!;const method=req.method();
  if(url.pathname.includes('/auth/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
  if(!url.pathname.includes('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  const body=req.postDataJSON(),id=url.searchParams.get('id')?.replace(/^eq\./,'');
  const choreId=url.searchParams.get('chore_id')?.replace(/^eq\./,'');
  const instanceDate=url.searchParams.get('instance_date')?.replace(/^eq\./,'');
  calls.push({method,table,body,id,choreId,instanceDate});
  if((fail&&method!=='GET')||(readsFail&&method==='GET'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic network failure',code:'TEST_ONLY'})});
  let result:any;
  if(method==='GET')result=(db[table]||[]).filter(row =>
   (!id || row.id === id) && (!choreId || row.chore_id === choreId) && (!instanceDate || row.instance_date === instanceDate));
  else if(method==='POST'){
   if (table === 'chore_completions' && db[table].some(row =>
    row.chore_id === body.chore_id && row.instance_date === body.instance_date)) {
    return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({
     code:'23505',message:'duplicate key value violates unique constraint "chore_completions_chore_id_instance_date_key"',
    })});
   }
   const item={id:crypto.randomUUID(),created_at:TODAY,...body};db[table]??=[];db[table].push(item);result=item;
   if (table === 'chore_completions' && loseCompletionInsertResponse) {
    loseCompletionInsertResponse = false;
    return route.abort('failed');
   }
  }
  else if(method==='PATCH'){const item=db[table]?.find(r=>r.id===id);if(item)Object.assign(item,body);result=item?[item]:[];}
  else if(method==='DELETE'){
   result=(db[table]||[]).filter(r=>r.id===id);
   db[table]=(db[table]||[]).filter(r=>r.id!==id);
   if (table === 'chore_completions' && loseCompletionDeleteResponse) {
    loseCompletionDeleteResponse = false;
    return route.abort('failed');
   }
  }
  else result=[];
  const single=req.headers().accept?.includes('vnd.pgrst.object');if(single&&Array.isArray(result))result=result[0]||null;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/chore-app/');await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true})).toHaveAttribute('aria-current','page');
 return {
  db,calls,failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},recover:()=>{fail=false;readsFail=false;},
  loseNextCompletionInsertResponse: () => { loseCompletionInsertResponse = true; },
  loseNextCompletionDeleteResponse: () => { loseCompletionDeleteResponse = true; },
 };
}

test('completion retry restores the saved occurrence and its original attribution', async ({page}) => {
 const f = await fixture(page);
 const [otherChore,,,target] = f.db.chores;
 const [alex, jamie] = f.db.team_members;
 const start = page.getByRole('button', {name:`Complete: ${target.title}`, exact:true});
 await start.click();
 const dialog = page.getByRole('dialog', {name:'Complete chore', exact:true});
 const member = dialog.getByRole('combobox', {name:'Who completed it?'});
 const markDone = dialog.getByRole('button', {name:'Mark done', exact:true});
 const error = dialog.getByRole('alert');
 await member.click();
 await dialog.getByRole('option', {name:alex.name, exact:true}).click();

 const siblings = [
  {id:'other-chore', chore_id:otherChore.id, instance_date:TODAY},
  {id:'next-occurrence', chore_id:target.id, instance_date:'2026-09-26'},
 ].map(row => ({...row, completed_by:B, completed_at:`${TODAY}T18:00:00Z`}));
 f.db.chore_completions.push(...siblings);
 f.loseNextCompletionInsertResponse();
 await markDone.click();
 await expect(error).toHaveText('Could not save completion. Please try again.');
 await expect(member).toHaveText(alex.name);
 await expect(markDone).toBeEnabled();
 const original = f.db.chore_completions.find(row => row.chore_id === target.id && row.instance_date === TODAY);
 expect(original).toMatchObject({completed_by:A});

 await member.click();
 await dialog.getByRole('option', {name:jamie.name, exact:true}).click();
 f.failReads();
 await markDone.click();
 await expect(error).toHaveText('Could not save completion. Please try again.');
 await expect(member).toHaveText(jamie.name);
 await expect(markDone).toBeEnabled();
 f.recover();
 await markDone.click();

 await expect(dialog).toHaveCount(0);
 await expect(start).toHaveCount(0);
 const completionCalls = f.calls.filter(call => call.table === 'chore_completions');
 expect(completionCalls.filter(call => call.method === 'POST').map(call => call.body.completed_by)).toEqual([A, B, B]);
 expect(completionCalls.filter(call => call.method === 'GET').slice(1).map(({choreId, instanceDate}) =>
  [choreId, instanceDate])).toEqual([[target.id, TODAY], [target.id, TODAY]]);
 expect(f.db.chore_completions).toEqual([...siblings, original]);
 expect(f.calls.filter(call => call.table === 'team_members' && call.method === 'PATCH')).toHaveLength(0);

 const insights = page.getByRole('navigation', {name:'Primary navigation'}).getByRole('button', {name:'Insights', exact:true});
 await insights.click();
 const activity = page.locator('.nesmi-recent-row').filter({hasText:target.title}).filter({hasText:`by ${alex.name}`});
 await expect(activity).toHaveCount(1);
 await page.reload();
 await insights.click();
 await expect(activity).toHaveCount(1);
});

test('undo retries after a lost response without changing other completions', async ({page}) => {
 const f = await fixture(page);
 const [target,,,sibling] = f.db.chores;
 const completions = [target, sibling].map((chore, i) => ({
  id: `completion-${i}`,
  chore_id: chore.id,
  completed_by: A,
  completed_at: `${TODAY}T12:00:00Z`,
  instance_date: TODAY,
 }));
 const [targetCompletion, siblingCompletion] = completions;
 f.db.chore_completions = completions;
 const choresTab = page.getByRole('navigation', {name:'Primary navigation'}).getByRole('button', {name:'Chores', exact:true});
 const undoTarget = page.getByRole('button', {name:`Undo completion: ${target.title}`, exact:true});
 const todoTarget = page.getByRole('button', {name:`Complete: ${target.title}`, exact:true});
 const undoSibling = page.getByRole('button', {name:`Undo completion: ${sibling.title}`, exact:true});
 const deleteIds = () => f.calls.filter(call => call.method === 'DELETE' && call.table === 'chore_completions').map(call => call.id);

 await page.reload();
 await choresTab.click();
 await expect(undoSibling).toBeVisible();
 await undoTarget.click();
 const dialog = page.getByRole('dialog', {name:'Undo completion', exact:true});
 const confirmUndo = dialog.getByRole('button', {name:'Mark not done', exact:true});
 f.loseNextCompletionDeleteResponse();
 await confirmUndo.click();

 await expect(dialog.getByRole('alert')).toHaveText('Could not delete completion. Please try again.');
 await expect(confirmUndo).toBeEnabled();
 expect(deleteIds()).toEqual([targetCompletion.id]);
 expect(f.db.chore_completions).toEqual([siblingCompletion]);

 await confirmUndo.click();
 await expect(dialog).toHaveCount(0);
 await expect(todoTarget).toBeVisible();
 await expect(undoSibling).toBeVisible();
 expect(deleteIds()).toEqual([targetCompletion.id, targetCompletion.id]);
 expect(f.db.chore_completions).toEqual([siblingCompletion]);

 await page.reload();
 await choresTab.click();
 await expect(todoTarget).toBeVisible();
 await expect(undoSibling).toBeVisible();
 expect(deleteIds()).toEqual([targetCompletion.id, targetCompletion.id]);
});

test.describe('Calendar pointer moves', () => {
 test.use({timezoneId:'America/Los_Angeles'});

 test('moving a timed chore keeps its 90-minute duration after reload', async ({page, isMobile}) => {
  test.skip(isMobile, 'Requires a desktop mouse');
  const {db, calls} = await fixture(page, 1440);
  const [chore] = db.chores;
  Object.assign(chore, {due_time:'09:00:00', end_time:'10:30:00'});
  await page.reload();

  const calendar = page.getByRole('navigation', {name:'Primary navigation'})
   .getByRole('button', {name:'Calendar', exact:true});
  const day = page.locator('.fc-timeGridDay-button');
  const event = page.locator('.fc-timegrid-event').filter({hasText:chore.title});
  const details = page.locator('.event-popover');
  await calendar.click();
  await day.click();
  await event.click();
  await expect(details.getByText('09:00 - 10:30', {exact:true})).toBeVisible();
  await details.getByRole('button', {name:'Close task details'}).click();

  const slot = (time: string) => page.locator(`.fc-timegrid-slot-lane[data-time="${time}:00"]`);
  const original = slot('09:00');
  const destination = slot('11:00');
  await expect(event).toHaveClass(/fc-event-draggable/);
  await expect(original).toBeInViewport();
  await expect(destination).toBeInViewport();
  const eventBox = await event.boundingBox();
  const originalBox = await original.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (!eventBox || !originalBox || !destinationBox) throw new Error('Calendar drag bounds unavailable');

  // Start in the first slot of the event, clear of the resize handle.
  const x = eventBox.x + eventBox.width / 2;
  await page.mouse.move(x, originalBox.y + originalBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, destinationBox.y + destinationBox.height / 2, {steps:12});
  await page.mouse.up();

  const patches = () => calls.filter(call => call.method === 'PATCH' && call.table === 'chores');
  await expect.poll(patches).toEqual([expect.objectContaining({
   id:chore.id,
   body:expect.objectContaining({date:TODAY, due_time:'11:00', end_time:'12:30'}),
  })]);

  await page.reload();
  await calendar.click();
  await day.click();
  await event.click();
  await expect(details.getByText('11:00 - 12:30', {exact:true})).toBeVisible();
  expect(patches()).toHaveLength(1);
 });
});

test.describe('Calendar touch moves', () => {
 test.use({hasTouch:true, timezoneId:'America/Los_Angeles'});
 test.skip(({browserName, isMobile}) => browserName !== 'chromium' || isMobile, 'Requires the Chromium touch protocol');

 test('long-pressing and moving a timed chore keeps its 90-minute duration after reload', async ({page, context}) => {
  const {db, calls} = await fixture(page, 390);
  const [chore] = db.chores;
  Object.assign(chore, {due_time:'09:00:00', end_time:'10:30:00'});
  await page.reload();

  const calendar = page.getByRole('navigation', {name:'Primary navigation'})
   .getByRole('button', {name:'Calendar', exact:true});
  const day = page.locator('.fc-timeGridDay-button');
  const event = page.locator('.fc-timegrid-event:not(.fc-event-mirror):not(.fc-event-dragging)').filter({hasText:chore.title});
  const slot = (time: string) => page.locator(`.fc-timegrid-slot-lane[data-time="${time}:00"]`);
  await calendar.tap();
  await day.tap();
  await expect(event).toHaveClass(/fc-event-draggable/);
  await event.scrollIntoViewIfNeeded();
  const [eventBox, originalBox, destinationBox] = await Promise.all([
   event.boundingBox(), slot('09:00').boundingBox(), slot('11:00').boundingBox(),
  ]);
  if (!eventBox || !originalBox || !destinationBox) throw new Error('Calendar touch drag bounds unavailable');
  const x = eventBox.x + eventBox.width / 2;
  const startY = originalBox.y + originalBox.height / 2;
  const endY = destinationBox.y + destinationBox.height / 2;

  await test.step('Long-press and drag with Chromium touch input', async () => {
   const cdp = await context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y:startY}]});
   await expect(event).toHaveClass(/fc-event-selected/);
   for (let step = 1; step <= 12; step++) {
    const y = startY + (endY - startY) * step / 12;
    await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x, y}]});
   }
   await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  });

  const patches = () => calls.filter(call => call.method === 'PATCH' && call.table === 'chores');
  await expect.poll(patches).toEqual([expect.objectContaining({
   id:chore.id,
   body:expect.objectContaining({date:TODAY, due_time:'11:00', end_time:'12:30'}),
  })]);

  await page.reload();
  await calendar.tap();
  await day.tap();
  await event.tap();
  await expect(page.locator('.event-popover').getByText('11:00 - 12:30', {exact:true})).toBeVisible();
  expect(patches()).toHaveLength(1);
 });
});


for(const width of [320,390,1440])for(const theme of ['light','dark'])test(`inline validation ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await page.getByRole('button',{name:'Add new chore',exact:true}).click();const save=page.getByRole('button',{name:'Add chore',exact:true}),title=page.locator('#chore-title'),date=page.locator('#chore-date');
 await date.fill('');await save.click();await expect(title).toBeFocused();await expect(title).toHaveAttribute('aria-invalid','true');await expect(title).toHaveAttribute('aria-describedby','chore-title-error');await expect(page.locator('#chore-title-error')).toHaveText('Enter a task name.');await expect(page.locator('#chore-date-error')).toBeVisible();expect(await page.locator('#chore-edit-form').evaluate((el:HTMLFormElement)=>el.noValidate)).toBe(true);
 const a=await title.boundingBox(),b=await page.locator('#chore-title-error').boundingBox();expect(b!.y).toBeGreaterThanOrEqual(a!.y+a!.height);await page.screenshot({path:info.outputPath(`validation-${width}-${theme}.png`)});
 await title.fill('  ');await save.click();await expect(title).toBeFocused();await title.fill('Preserved task');await date.fill('2026-02-30');await save.click();await expect(date).toBeFocused();await expect(title).toHaveValue('Preserved task');await date.fill('2026-09-25');
 await page.getByText('More options',{exact:true}).click();const estimate=page.locator('#chore-estimate');await estimate.fill('-1');await save.click();await expect(estimate).toBeFocused();await expect(estimate).toHaveAttribute('aria-describedby','chore-estimate-error');await estimate.fill('1.5');await save.click();await expect(estimate).toBeFocused();await estimate.fill('');
 await page.getByRole('combobox',{name:'End time hour',exact:true}).click();await page.getByRole('option',{name:'09',exact:true}).click();await save.click();await expect(page.locator('#chore-end-hour')).toBeFocused();await expect(page.locator('#chore-end-hour')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#chore-end-error')).toBeVisible();await page.getByRole('button',{name:'Clear end time'}).click();
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);await save.click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(calls.filter(c=>c.method==='POST'&&c.table==='chores')).toHaveLength(1);
});

for(const width of [320,390,1440])for(const theme of ['light','dark'])test(`task action hierarchy ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();
 const event=page.locator('.fc-event').filter({hasText:'Take out the recycling'}).first();await event.click();const popover=page.locator('.event-popover');await expect(popover).toBeVisible();
 await expect(popover.getByText('Alex',{exact:true})).toBeVisible();await expect(popover.getByText('Medium',{exact:true})).toBeVisible();await expect(popover.locator('span[style*="background-color"]')).toHaveCSS('background-color','rgb(7, 93, 184)');expect(await popover.locator(':scope > div').count()).toBe(1);
 await expect(popover.getByRole('button',{name:'Mark Complete',exact:true})).toHaveClass(/secondary/);
 await expect(popover.getByRole('button',{name:'Edit',exact:true})).toHaveClass(/primary/);

 const box=await popover.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);await page.screenshot({animations:"disabled",path:info.outputPath(`details-${width}-${theme}.png`)});
 await popover.getByRole('button',{name:'Edit',exact:true}).click();await expect(page.locator('#chore-title')).toHaveValue('Take out the recycling');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await event.click();await popover.getByRole('button',{name:'Mark Complete',exact:true}).click();await expect(page.getByRole('dialog',{name:'Complete chore'})).toBeVisible();await page.getByRole('button',{name:'Mark done',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(calls.filter(c=>c.method==='POST'&&c.table==='chore_completions')).toHaveLength(1);
 await event.click();await expect(popover.getByText('Completed',{exact:true})).toBeVisible();await expect(popover.getByRole('button',{name:'Mark Incomplete',exact:true})).toHaveClass(/secondary/);
});

for(const width of [320,1440])for(const theme of ['light','dark'])test(`layout alignment ${width} ${theme}`,async({page},info)=>{
 const {db,calls}=await fixture(page,width);if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
 await page.getByRole('button',{name:'Search chores',exact:true}).click();
 const search=await page.locator('#chore-search-input').boundingBox(),content=await page.locator('.today-intro').boundingBox();expect(search!.x).toBeCloseTo(content!.x,0);expect(search!.width).toBeCloseTo(content!.width,0);
 await page.getByRole('button',{name:'Open family menu'}).click();const check=page.locator('.nesmi-member-visibility').first();await expect(check).toHaveAttribute('aria-pressed','true');const target=await check.boundingBox(),visual=await check.locator('span').boundingBox();expect(target!.width).toBeGreaterThanOrEqual(44);expect(visual!.width).toBe(22);await check.focus();await page.keyboard.press('Space');await expect(check).toHaveAttribute('aria-pressed','false');await page.keyboard.press('Space');await expect(check).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Close sidebar'}).click();
 db.chores[0].title='Long completed task '.repeat(12);db.chore_completions=Array.from({length:8},(_,i)=>({id:`completion-${i}`,chore_id:db.chores[0].id,completed_by:A,completed_at:`2026-09-25T${String(10+i).padStart(2,'0')}:00:00Z`,instance_date:TODAY}));await page.reload();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Insights',exact:true}).click();const list=page.locator('.nesmi-recent-completions');await expect(list.locator('.nesmi-recent-row')).toHaveCount(5);expect(await list.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await list.locator('.nesmi-recent-row').last().scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:info.outputPath(`recent-${width}-${theme}.png`)});
 await list.getByRole('button',{name:/^View all activity/}).click();
 await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('heading',{name:'Activity Feed (8 completions)',exact:true})).toBeVisible();
 await expect(page.locator('.nesmi-activity-row')).toHaveCount(8);
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

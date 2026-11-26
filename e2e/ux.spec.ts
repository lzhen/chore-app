import {test,expect,Page} from '@playwright/test';
// Keep mocked requests intercepted after reload; service workers can bypass page.route.
test.use({ serviceWorkers: 'block' });

async function selectAppearance(page: Page, theme: 'light' | 'dark') {
  const toggle = page.getByRole('button', {name: `Switch to ${theme} mode`, exact: true});
  if (await page.locator('html').getAttribute('data-theme') !== theme) await toggle.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('button', {name: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`, exact: true})).toBeVisible();
  await expect(page.getByRole('combobox', {name: /^Theme:/})).toHaveCount(0);
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

const TODAY='2026-09-25';
const OWNER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', B='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function fixture(page:Page,width=390,{emptyChores=false,emptyFamily=false,now=new Date('2026-09-25T19:00:00Z')}={}){
 await page.setViewportSize({width,height:844});await page.clock.setFixedTime(now);
 const user={id:OWNER,email:'release-test@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:OWNER,exp:2000000000,role:'authenticated'})).toString('base64url')+'.test-only';
 await page.addInitScript(({user,token})=>{localStorage.setItem('sb-rosofbnimiothwxsabyr-auth-token',JSON.stringify({access_token:token,refresh_token:'mock-only',expires_at:2000000000,expires_in:999999,user,token_type:'bearer'}));},{user,token});
 const db:Record<string,any[]>={team_members:[{id:A,name:'Alex',color:'#075db8',points:0,badges:[],created_at:TODAY},{id:B,name:'Jamie',color:'#8759bb',points:0,badges:[],created_at:TODAY}],categories:[],chore_completions:[],member_availability:[],chores:emptyChores?[]:[
  {id:'11111111-1111-4111-8111-111111111111',title:'Take out the recycling',date:TODAY,due_time:'18:00:00',end_time:'19:00:00',assignee_id:A,recurrence:'none',priority:'medium'},
  {id:'22222222-2222-4222-8222-222222222222',title:'Clean the kitchen counters',date:'2026-09-24',assignee_id:B,recurrence:'none',priority:'medium'},
  {id:'33333333-3333-4333-8333-333333333333',title:'Vacuum common areas',date:'2026-09-27',assignee_id:null,recurrence:'none',priority:'high'},
  {id:'44444444-4444-4444-8444-444444444444',title:'Water the plants',date:TODAY,assignee_id:null,recurrence:'none',priority:'medium'},
 ]};
 if(emptyFamily){
  db.team_members=[];
  for(const chore of db.chores)chore.assignee_id=null;
 }
 const calls:{method:string;table:string;body:any;id?:string}[]=[];
 let fail=false;let readsFail=false;let loseChoreResponse=false;let loseNextChoreUpdateResponse=false;
 await page.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());const table=url.pathname.split('/').pop()!;const method=req.method();
  if(url.pathname.includes('/auth/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
  if(!url.pathname.includes('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  const id=url.searchParams.get('id')?.replace(/^eq\./,'');
  const body=req.postDataJSON();calls.push({method,table,body,id});
  if((fail&&method!=='GET')||(readsFail&&method==='GET'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic network failure',code:'TEST_ONLY'})});
  let result:any;
  if(method==='GET'){
   if(table==='chores'&&id&&loseChoreResponse)return route.abort('failed');
   result=id?(db[table]||[]).filter(r=>r.id===id):(db[table]||[]);
  }
  else if(method==='POST'){
   if(table==='chores'&&body?.id&&db.chores.some(chore=>chore.id===body.id))return route.fulfill({
    status:409, json:{code:'23505',message:'Synthetic duplicate chore ID'},
   });
   const item={id:crypto.randomUUID(),created_at:TODAY,...body};
   db[table]??=[];db[table].push(item);result=item;
   if(table==='chores'&&loseChoreResponse)return route.abort('failed');
  }
  else if (method === 'PATCH') {
   const item = db[table]?.find(r => r.id === id);
   if (item) {
    Object.assign(item, body);
    if (table === 'chores' && loseNextChoreUpdateResponse) {
     loseNextChoreUpdateResponse = false;
     for (const key of ['due_time', 'end_time']) {
      if (/^\d{2}:\d{2}$/.test(item[key] ?? '')) item[key] += ':00';
     }
     return route.abort('failed');
    }
   }
   result = item ? [item] : [];
  }
  else if(method==='DELETE'){result=(db[table]||[]).filter(r=>r.id===id);db[table]=(db[table]||[]).filter(r=>r.id!==id);}
  else result=[];
  const single=req.headers().accept?.includes('vnd.pgrst.object');if(single&&Array.isArray(result))result=result[0]||null;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/chore-app/');await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true})).toHaveAttribute('aria-current','page');
 return {
  db,calls,failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},
  loseChoreResponse:()=>{loseChoreResponse=true;},
  loseChoreUpdateResponse:()=>{loseNextChoreUpdateResponse=true;},
  recover:()=>{fail=false;readsFail=false;loseChoreResponse=false;loseNextChoreUpdateResponse=false;},
 };
}
for(const width of [375,390,430])test(`normal save reachable; time and date survive reload at ${width}px`,async({page},info)=>{
 const {db,calls}=await fixture(page,width);
 await page.screenshot({path:info.outputPath(`today-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Add new chore',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add a chore'});
 await dialog.getByLabel('What needs doing?').fill('A new shared chore');
 await dialog.getByLabel('When?').fill('2026-09-27');
 await dialog.locator('summary').click();
 await dialog.getByRole('combobox',{name:'Start time hour',exact:true}).click();await page.getByRole('option',{name:'18',exact:true}).click();await dialog.getByRole('combobox',{name:'End time hour',exact:true}).click();await page.getByRole('option',{name:'19',exact:true}).click();
 const save=dialog.getByRole('button',{name:'Add chore',exact:true});
 const box=await save.boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThanOrEqual(844);
 await page.screenshot({path:info.outputPath(`new-chore-${width}.png`),fullPage:true});
 await save.click();await expect(dialog).toHaveCount(0);
 expect(db.chores.find(c=>c.title==='A new shared chore')?.end_time).toBe('19:00');
 expect(calls.filter(c=>c.table==='chores'&&c.method==='POST')).toHaveLength(1);
 await page.reload();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Chores',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit A new shared chore'})).toContainText('Sun, Sep 27');
 await page.getByRole('button',{name:'Edit A new shared chore'}).click();await expect(page.getByRole('combobox',{name:'End time hour',exact:true})).toHaveText('19');await expect(page.getByRole('combobox',{name:'End time minute',exact:true})).toHaveText('00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed save retains draft, reports error and allows retry',async({page})=>{
 const f=await fixture(page);f.failWrites();await page.getByRole('button',{name:'Add new chore'}).click();await page.getByLabel('What needs doing?').fill('Keep this draft');await page.getByRole('dialog').getByRole('button',{name:'Add chore',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Your entries are still here');await expect(page.getByLabel('What needs doing?')).toHaveValue('Keep this draft');expect(f.db.chores.some(c=>c.title==='Keep this draft')).toBe(false);
 f.recover();await page.getByRole('dialog').getByRole('button',{name:'Add chore',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('retrying a first chore after a lost save response shows one saved chore', async ({page}) => {
  const f = await fixture(page, 390, { emptyChores: true });
  const title = 'Put away the dishes';
  await page.getByRole('button', {name: 'Add your first chore', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add a chore'});
  const titleInput = dialog.getByLabel('What needs doing?');
  const save = dialog.getByRole('button', {name: 'Add chore', exact: true});
  await titleInput.fill(title);

  f.loseChoreResponse();
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Your entries are still here');
  await expect(titleInput).toHaveValue(title);
  expect(f.db.chores).toHaveLength(1);
  const id = f.db.chores[0].id;

  f.recover();
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', {name: `Edit ${title}`, exact: true})).toHaveCount(1);
  expect(f.db.chores).toHaveLength(1);
  const writes = f.calls.filter(call => call.table === 'chores' && call.method !== 'GET');
  expect(writes.map(call => [call.method, call.body.id])).toEqual([['POST', id], ['POST', id]]);
  expect(f.calls.filter(call => call.table === 'chores' && call.method === 'GET' && call.id)
    .map(call => call.id)).toEqual([id, id]);
});
test('a saved chore reassignment is confirmed after its response is lost', async ({page}) => {
  const f = await fixture(page);
  const [chore] = f.db.chores;
  const [alex, jamie] = f.db.team_members;
  const row = page.getByRole('button', {name: `Edit ${chore.title}`, exact: true});
  await expect(row).toContainText(alex.name);
  await row.click();

  const dialog = page.getByRole('dialog', {name: 'Edit chore', exact: true});
  await dialog.getByRole('combobox', {name: 'Who’s responsible?', exact: true}).click();
  await dialog.getByRole('option', {name: jamie.name, exact: true}).click();
  f.loseChoreUpdateResponse();
  await dialog.getByRole('button', {name: 'Save changes', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText(jamie.name);
  await page.reload();
  await expect(row).toContainText(jamie.name);

  expect(f.db.chores.filter(item => item.id === chore.id)).toEqual([
    expect.objectContaining({assignee_id: B, due_time: '18:00:00', end_time: '19:00:00'}),
  ]);
  expect(f.calls.filter(call => call.table === 'chores' && call.method !== 'GET')).toEqual([
    expect.objectContaining({method: 'PATCH', id: chore.id, body: expect.objectContaining({assignee_id: B})}),
  ]);
  expect(f.calls.filter(call => call.table === 'chores' && call.method === 'GET' && call.id)
    .map(call => call.id)).toEqual([chore.id]);
});
test('search filters the Chores view and exposes an empty state',async({page})=>{
 await fixture(page);await page.getByRole('navigation').getByRole('button',{name:'Chores',exact:true}).click();await page.getByRole('button',{name:'Search chores',exact:true}).click();await page.getByLabel('Search chores',{exact:true}).fill('nothing-matches');await expect(page.getByText('No matching chores')).toBeVisible();await expect(page.locator('.chore-task')).toHaveCount(0);await page.getByLabel('Search chores',{exact:true}).fill('Vacuum');await expect(page.locator('.chore-task')).toHaveCount(1);
});
test('unassigned completion requires explicit member; selection determines credit',async({page})=>{
 const f=await fixture(page);await page.getByRole('button',{name:'Complete: Water the plants',exact:true}).click();await expect(page.getByLabel('Who completed it?')).toContainText('Choose a family member');await expect(page.getByRole('button',{name:'Mark done',exact:true})).toBeDisabled();expect(f.db.chore_completions).toHaveLength(0);await page.getByLabel('Who completed it?').click();await page.getByRole('dialog').getByRole('option',{name:'Jamie',exact:true}).click();await page.getByRole('button',{name:'Mark done',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(f.db.chore_completions[0].completed_by).toBe(B);
});
test('first family member can be added and selected inside completion after a failed save', async ({page}) => {
  const f = await fixture(page, 390, { emptyFamily: true });
  await page.getByRole('button', {name: 'Complete: Water the plants', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Complete chore', exact: true});
  const name = dialog.getByRole('textbox', {name: 'Family member name'});
  const add = dialog.getByRole('button', {name: 'Add member', exact: true});
  const markDone = dialog.getByRole('button', {name: 'Mark done', exact: true});
  await expect(add).toBeDisabled();
  await expect(markDone).toBeDisabled();
  await name.fill('Alex');

  f.failWrites();
  await add.click();
  await expect(dialog.getByRole('alert')).toContainText('Please try again.');
  await expect(name).toHaveValue('Alex');
  await expect(name).toBeFocused();
  expect(f.db.team_members).toHaveLength(0);
  expect(f.db.chore_completions).toHaveLength(0);

  f.recover();
  await name.press('Enter');
  const picker = dialog.getByRole('combobox', {name: 'Who completed it?'});
  await expect(picker).toHaveText('Choose a family member');
  await expect(picker).toBeFocused();
  await expect(markDone).toBeDisabled();
  expect(f.db.team_members).toHaveLength(1);
  expect(f.db.chore_completions).toHaveLength(0);

  await picker.click();
  await dialog.getByRole('option', {name: 'Alex', exact: true}).click();
  await markDone.click();
  await expect(dialog).toHaveCount(0);
  expect(f.db.chore_completions[0].completed_by).toBe(f.db.team_members[0].id);
});
test('Insights and Account are top-level pages, with the correct selected tab',async({page})=>{
 await fixture(page);const nav=page.getByRole('navigation',{name:'Primary navigation'});for(const name of ['Insights','Account','Calendar','Today']){await nav.getByRole('button',{name,exact:true}).click();await expect(nav.getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');await expect(page.getByRole('dialog')).toHaveCount(0);}
});
test('calendar navigation reveals a chore months ahead and returns to the current month', async ({page}) => {
  const {db, calls} = await fixture(page, 1280);
  const title = 'Check the smoke alarm batteries';
  const date = '2027-02-05';
  db.chores.push({
    id: '55555555-5555-4555-8555-555555555555', title, date,
    assignee_id: A, recurrence: 'none', priority: 'medium',
  });
  await page.reload();
  await page.getByRole('navigation', {name: 'Primary navigation'})
    .getByRole('button', {name: 'Calendar', exact: true}).click();
  const calendar = page.locator('.calendar-container');
  await expect(calendar.getByRole('heading', {name: 'Sep 2026', exact: true})).toBeVisible();
  for (let month = 0; month < 5; month++) {
    await calendar.getByTitle('Next Month', {exact: true}).click();
  }
  await expect(calendar.getByRole('heading', {name: 'Feb 2027', exact: true})).toBeVisible();
  await calendar.locator(`[data-date="${date}"]`).getByText(title, {exact: true}).click();
  await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Close task details', exact: true}).click();
  await calendar.getByRole('button', {name: 'Today', exact: true}).click();
  await expect(calendar.getByRole('heading', {name: 'Sep 2026', exact: true})).toBeVisible();
  await expect(calendar.getByText('Water the plants', {exact: true})).toBeVisible();
  expect(calls.filter(call => call.method !== 'GET')).toHaveLength(0);
});
test('family menu opens the selected Calendar date from Today', async ({page}) => {
  const {db, calls} = await fixture(page, 1280);
  const title = 'Change the air filter';
  const date = '2026-10-12';
  db.chores.push({
    id: '66666666-6666-4666-8666-666666666666', title, date,
    assignee_id: A, recurrence: 'none', priority: 'medium',
  });
  await page.reload();
  const navigation = page.getByRole('navigation', {name: 'Primary navigation'});
  await expect(navigation.getByRole('button', {name: 'Today', exact: true})).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', {name: 'Open family menu'}).click();
  const family = page.getByRole('complementary', {name: 'Family'});
  await family.getByRole('button', {name: 'Next month'}).click();
  await family.getByRole('button', {name: '12', exact: true}).click();
  await expect(family).toHaveCount(0);
  await expect(navigation.getByRole('button', {name: 'Calendar', exact: true})).toHaveAttribute('aria-current', 'page');

  const calendar = page.locator('.calendar-container');
  await expect(calendar.getByRole('heading', {name: 'Oct 2026', exact: true})).toBeVisible();
  await calendar.getByRole('button', {name: 'Day', exact: true}).click();
  await expect(calendar.getByText(title, {exact: true})).toBeVisible();

  await navigation.getByRole('button', {name: 'Today', exact: true}).click();
  await navigation.getByRole('button', {name: 'Calendar', exact: true}).click();
  await expect(calendar.getByRole('heading', {name: 'Sep 2026', exact: true})).toBeVisible();
  expect(calls.filter(call => call.method !== 'GET')).toHaveLength(0);
});
test('Family calendar browses from month end and Today opens the current date', async ({page}) => {
  const {db, calls} = await fixture(page, 1280, {now: new Date('2026-01-31T20:00:00Z')});
  const title = 'Replace the furnace filter';
  db.chores.push({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', title, date: '2026-01-31',
    assignee_id: A, recurrence: 'none', priority: 'medium',
  });
  await page.reload();

  await page.getByRole('button', {name: 'Open family menu'}).click();
  const family = page.getByRole('complementary', {name: 'Family'});
  await expect(family.getByRole('button', {name: 'Jan 2026', exact: true})).toBeVisible();
  await family.getByRole('button', {name: 'Next month'}).click();
  await expect(family.getByRole('button', {name: 'Feb 2026', exact: true})).toBeVisible();
  await family.getByRole('button', {name: 'Today', exact: true}).click();
  await expect(family).toHaveCount(0);

  const calendar = page.locator('.calendar-container');
  await expect(calendar.getByRole('heading', {name: 'Jan 2026', exact: true})).toBeVisible();
  await calendar.getByRole('button', {name: 'Day', exact: true}).click();
  await expect(calendar.getByText(title, {exact: true})).toBeVisible();
  expect(calls.filter(call => call.method !== 'GET')).toHaveLength(0);
});
test.describe('Family calendar markers in a positive UTC offset', () => {
  test.use({ timezoneId: 'Pacific/Kiritimati' });

  test('family calendar marks the displayed local dates when browsing distant months', async ({page}) => {
    const {db, calls} = await fixture(page, 1280);
    db.chores.push(
      {id: '77777777-7777-4777-8777-777777777777', title: 'Sweep the porch', date: '2026-09-12', assignee_id: A, recurrence: 'none', priority: 'medium'},
      {id: '88888888-8888-4888-8888-888888888888', title: 'Change the air filter', date: '2027-02-12', assignee_id: A, recurrence: 'none', priority: 'medium'},
      {id: '99999999-9999-4999-8999-999999999999', title: 'Plan the week', date: '2026-09-27', assignee_id: B, recurrence: 'weekly', priority: 'medium'},
    );
    await page.reload();
    await page.getByRole('button', {name: 'Open family menu'}).click();
    const family = page.getByRole('complementary', {name: 'Family'});
    const marker = (day: string) => family.getByRole('button', {name: day, exact: true}).locator('span');

    await expect(marker('12')).toHaveCount(1);
    await expect(marker('13')).toHaveCount(0);
    for (let month = 0; month < 5; month++) {
      await family.getByRole('button', {name: 'Next month'}).click();
    }
    await expect(family.getByRole('button', {name: 'Feb 2027'})).toBeVisible();
    await expect(marker('12')).toHaveCount(1);
    await expect(marker('7')).toHaveCount(1);
    await expect(marker('31')).toHaveCount(1);
    await expect(marker('13')).toHaveCount(0);
    expect(calls.filter(call => call.method !== 'GET')).toHaveLength(0);
  });
});

test('dialog isolates background controls, keeps focus and confirms draft discard',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'Add new chore'}).click();expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(true);await page.getByLabel('What needs doing?').fill('Do not silently discard');await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByLabel('What needs doing?')).toHaveValue('Do not silently discard');
});
test('data load failure has retry, not a misleading empty family',async({page})=>{
 const f=await fixture(page);f.failReads();await page.reload();await expect(page.getByRole('alert')).toContainText('could not be loaded');f.recover();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('button',{name:'Edit Water the plants'})).toBeVisible();
});

for (const width of [375, 1440]) test(`sign-in fits ${width}px and appearance persists`, async ({page}, info) => {
  await page.setViewportSize({width, height: 900});
  await page.goto('/chore-app/');
  await expect(page.getByRole('heading', {name: 'Sign in to your account', exact: true})).toBeVisible();
  for (const theme of ['Light', 'Dark']) {
    await selectAppearance(page, theme.toLowerCase() as 'light' | 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase());
    const email = page.getByLabel('Email', {exact: true});
    expect(await email.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const submit = page.getByRole('button', {name: 'Sign In', exact: true});
    await expect(submit).toBeVisible();
    expect(await submit.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`sign-in-${theme.toLowerCase()}-${width}.png`), fullPage: true});
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('desktop Today progress and mobile starter drafts are usable', async ({page}, info) => {
  const f = await fixture(page, 1440);
  await expect(page.getByRole('progressbar')).toHaveAttribute('max', '2');
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  await expect(page.getByRole('heading', {name: /^Overdue\s+1$/})).toBeVisible();
  const firstTask = page.locator('.chore-task').first();
  const taskBox = await firstTask.boundingBox();
  expect(taskBox!.y + taskBox!.height).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await selectAppearance(page, 'light');
  await page.screenshot({path: info.outputPath('today-desktop-light.png'), fullPage: true});
  await selectAppearance(page, 'dark');
  await page.screenshot({path: info.outputPath('today-desktop-dark.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  const mobileTaskBox = await firstTask.boundingBox();
  expect(mobileTaskBox!.y + mobileTaskBox!.height).toBeLessThan(772);
  await page.screenshot({path: info.outputPath('today-mobile-dark.png'), fullPage: true});
  expect(f.db.chore_completions).toHaveLength(0);
});

test('direct dark appearance respects later choices and styles the browser chrome', async ({page}) => {
  await page.emulateMedia({colorScheme: 'light'});
  await page.goto('/chore-app/?theme=dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#080809');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme)).toBe('dark');
  await selectAppearance(page, 'light');
  expect(new URL(page.url()).searchParams.has('theme')).toBe(false);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff');
  // Explicit choices keep precedence when the device appearance changes.
  await page.emulateMedia({colorScheme: 'dark'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({colorScheme: 'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('starter suggestion waits for an edited explicit save', async ({page}, info) => {
  const f = await fixture(page, 390, { emptyChores: true });
  const nav = page.getByRole('navigation', {name: 'Primary navigation'});
  await nav.getByRole('button', {name: 'Insights', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Small wins will show up here.'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Add your first chore', exact: true})).toBeVisible();
  await nav.getByRole('button', {name: 'Today', exact: true}).click();
  await page.screenshot({path: info.outputPath('first-chore-mobile.png'), fullPage: true});
  await page.getByRole('button', {name: 'Start with Wash dishes'}).click();
  const dialog = page.getByRole('dialog', {name: 'Add a chore'});
  await expect(dialog.getByLabel('What needs doing?')).toHaveValue('Wash dishes');
  await expect(dialog.getByLabel('Repeat')).toHaveText('Every day');
  await expect(dialog.getByLabel('Estimated minutes · optional')).toHaveValue('15');
  expect(f.calls.filter(call => call.table === 'chores' && call.method === 'POST')).toHaveLength(0);
  await dialog.getByLabel('What needs doing?').fill('Put away our dishes');
  await dialog.getByLabel('Estimated minutes · optional').fill('10');
  await dialog.getByRole('button', {name: 'Add chore', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(f.db.chores[0].title).toBe('Put away our dishes');
  expect(f.db.chores[0].estimated_minutes).toBe(10);
  expect(f.calls.filter(call => call.table === 'chores' && call.method === 'POST')).toHaveLength(1);
});

 test('automatic device appearance applies until the direct button is used', async ({page}) => {
  await page.emulateMedia({colorScheme: 'light'});
  await page.goto('/chore-app/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({colorScheme: 'dark'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', {name: 'Switch to light mode', exact: true}).press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
 });

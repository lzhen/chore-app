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
 const calls:{method:string;table:string;body:any}[]=[];let fail=false;let readsFail=false;let pending:Promise<void>|null=null;let release=()=>{};
 await page.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());const table=url.pathname.split('/').pop()!;const method=req.method();
  if(url.pathname.includes('/auth/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
  if(!url.pathname.includes('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  const body=req.postDataJSON();calls.push({method,table,body});if(method!=='GET'&&pending)await pending;
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
 return {db,calls,holdWrites:()=>{pending=new Promise<void>(resolve=>{release=resolve;});},releaseWrites:()=>{pending=null;release();},failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},recover:()=>{fail=false;readsFail=false;}};
}





for(const [width,height] of [[320,480],[390,844],[1440,900]])for(const theme of ['light','dark'])test(`form followup ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);await page.setViewportSize({width,height});
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`}).click();
 const add=page.getByRole('button',{name:'Add new chore',exact:true});await add.click();
 const dialog=page.getByRole('dialog',{name:'Add a chore',exact:true}), close=dialog.getByRole('button',{name:'Close dialog',exact:true});
 await close.click();await expect(dialog).toBeHidden();await expect(add).toBeFocused();
 await add.click();const title=page.getByRole('textbox',{name:'What needs doing?'});await title.fill('Preserved draft');
 const gap=await page.locator('.nesmi-date-field').evaluate(el=>{const a=el.querySelector('label')!.getBoundingClientRect(),b=el.querySelector('.nesmi-date-entry')!.getBoundingClientRect();return b.top-a.bottom;});expect(gap).toBe(8);
 await dialog.locator('summary').click();await expect(dialog.locator('summary')).toHaveText('More options');await expect(dialog.locator('summary small')).toHaveCount(0);await expect(dialog.locator('input[type=time],select')).toHaveCount(0);
 const hour=page.getByRole('combobox',{name:'Start time hour',exact:true}),minute=page.getByRole('combobox',{name:'Start time minute',exact:true});
 for(const control of await dialog.locator('.nesmi-time-entry .nesmi-choice-trigger').all()){const label=control.locator('span').first();expect(await label.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(30);}
 await hour.click();await expect(page.getByRole('listbox')).toHaveClass(/nesmi-choice-menu/);await page.getByRole('option',{name:'09',exact:true}).click();await minute.click();await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(minute).toHaveText('59');await expect(minute).toBeFocused();
 await minute.click();await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(dialog).toBeVisible();
 await hour.click();await close.click();
 const confirm=page.getByRole('dialog',{name:'Discard changes?',exact:true}),keep=confirm.getByRole('button',{name:'Keep editing'});
 await expect(confirm).toBeVisible();await expect(keep).toBeFocused();expect(await dialog.evaluate(el=>(el as HTMLElement).inert)).toBe(true);
 const bounds=await confirm.boundingBox();expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height);
 await page.screenshot({path:info.outputPath('confirmation.png')});
 await page.keyboard.press('Shift+Tab');await expect(confirm.getByRole('button',{name:'Close dialog'})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(confirm.getByRole('button',{name:'Discard',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(confirm).toBeHidden();await expect(title).toHaveValue('Preserved draft');await expect(close).toBeFocused();
 await close.click();await confirm.getByRole('button',{name:'Close dialog'}).click();await expect(title).toHaveValue('Preserved draft');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await keep.click();await expect(hour).toHaveText('09');await expect(minute).toHaveText('59');
 await page.getByRole('button',{name:'Clear start time'}).click();await expect(hour).toHaveText('Hour');await expect(minute).toHaveText('Min');
 await page.getByRole('button',{name:'Choose date'}).click();await page.keyboard.press('Escape');await expect(confirm).toHaveCount(0);await expect(page.locator('#chore-calendar')).toHaveCount(0);
 await page.mouse.click(1,1);await expect(dialog).toBeVisible();await expect(title).toHaveValue('Preserved draft');
 await close.dblclick();await expect(confirm).toBeVisible();await keep.click();await expect(title).toHaveValue('Preserved draft');
 await dialog.locator('summary').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('form.png')});
 await close.click();await confirm.getByRole('button',{name:'Discard',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(false);await expect(add).toBeFocused();expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
 await add.click();await expect(title).toHaveValue('');await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
});

test('exact minutes, interrupted save and retry preserve the draft',async({page},info)=>{
 const state=await fixture(page,390);await page.getByRole('button',{name:'Add new chore',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add a chore'}),title=page.getByRole('textbox',{name:'What needs doing?'});
 await title.fill('Exact time');await dialog.locator('summary').click();
 async function choose(label:string,value:string){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();}
 await choose('Start time hour','23');await choose('Start time minute','58');await choose('End time hour','23');await choose('End time minute','59');
 await page.getByRole('combobox',{name:'Start time hour',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('combobox',{name:'Start time hour',exact:true}).click();await page.screenshot({path:info.outputPath('time-menu.png')});await page.keyboard.press('Escape');
 state.holdWrites();state.failWrites();await dialog.getByRole('button',{name:'Add chore',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Cancel'})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
 state.releaseWrites();await expect(page.getByRole('alert')).toBeVisible();await expect(title).toHaveValue('Exact time');
 await dialog.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByRole('combobox',{name:'Start time minute',exact:true})).toHaveText('58');
 state.recover();await dialog.getByRole('button',{name:'Add chore',exact:true}).click();await expect(dialog).toBeHidden();
 expect(state.calls.filter(c=>c.method==='POST').at(-1)?.body).toMatchObject({due_time:'23:58',end_time:'23:59'});
});

// Synthetic viewport regression only; does not emulate the Apple keyboard.
test('visible viewport bounds, nested confirmation and reopen stay stable',async({page})=>{
 await page.addInitScript(()=>{
  const viewport=Object.assign(new EventTarget(),{height:844,width:390,offsetTop:0,offsetLeft:0,scale:1});
  Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
 });
 await fixture(page,390);
 const add=page.getByRole('button',{name:'Add new chore',exact:true});await add.click();
 const dialog=page.getByRole('dialog',{name:'Add a chore',exact:true});
 const title=dialog.getByRole('textbox',{name:'What needs doing?'});
 await expect(dialog).toBeFocused();await title.fill('Viewport draft');
 const initial=await dialog.boundingBox();
 const resize=async(height:number,top:number)=>page.evaluate(({height,top})=>{
  Object.assign(window.visualViewport!,{height,offsetTop:top});window.visualViewport!.dispatchEvent(new Event('resize'));
 },{height,top});
 await resize(420,25);
 await expect.poll(async()=>{const b=await dialog.boundingBox();return !!b&&b.y>=25&&b.y+b.height<=446;}).toBe(true);
 await dialog.locator('summary').click();
 const notes=dialog.getByRole('textbox',{name:'Notes · optional'});await notes.fill('Keep this note');
 await expect.poll(async()=>notes.evaluate(el=>{const f=el.getBoundingClientRect(),b=el.closest('.chore-dialog-body')!.getBoundingClientRect();return f.top>=b.top&&f.bottom<=b.bottom;})).toBe(true);
 expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 await dialog.getByRole('button',{name:'Close dialog'}).click();
 const confirm=page.getByRole('dialog',{name:'Discard changes?',exact:true});
 await expect(confirm.getByRole('button',{name:'Keep editing'})).toBeFocused();
 await resize(844,0);
 await confirm.getByRole('button',{name:'Keep editing'}).click();
 await expect(title).toHaveValue('Viewport draft');await expect(notes).toHaveValue('Keep this note');
 await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
 await expect.poll(async()=>Math.round((await dialog.boundingBox())!.height)).toBe(Math.round(initial!.height));
 await dialog.getByRole('button',{name:'Close dialog'}).click();
 await confirm.getByRole('button',{name:'Discard',exact:true}).click();await expect(add).toBeFocused();
 await add.click();await expect(dialog).toBeFocused();await expect(title).toHaveValue('');
 expect(await dialog.locator('.chore-dialog-body').evaluate(el=>el.scrollTop)).toBe(0);
 await expect.poll(async()=>Math.round((await dialog.boundingBox())!.y)).toBe(Math.round(initial!.y));
});

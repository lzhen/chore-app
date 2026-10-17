import {selectAppearance, openInsights} from './navigation';
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


for(const width of [320,390,1440])for(const theme of ['light','dark'])test(`inline validation ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);await selectAppearance(page,theme);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Add chore',exact:true}).click();const save=page.getByRole('dialog',{name:'Add a chore'}).getByRole('button',{name:'Add chore',exact:true}),title=page.locator('#chore-title'),date=page.locator('#chore-date');
 await date.fill('');await save.click();await expect(title).toBeFocused();await expect(title).toHaveAttribute('aria-invalid','true');await expect(title).toHaveAttribute('aria-describedby','chore-title-error');await expect(page.locator('#chore-title-error')).toHaveText('Enter a task name.');await expect(page.locator('#chore-date-error')).toBeVisible();expect(await page.locator('#chore-edit-form').evaluate((el:HTMLFormElement)=>el.noValidate)).toBe(true);
 const a=await title.boundingBox(),b=await page.locator('#chore-title-error').boundingBox();expect(b!.y).toBeGreaterThanOrEqual(a!.y+a!.height);await page.screenshot({path:info.outputPath(`validation-${width}-${theme}.png`)});
 await title.fill('  ');await save.click();await expect(title).toBeFocused();await title.fill('Preserved task');await date.fill('2026-02-30');await save.click();await expect(date).toBeFocused();await expect(title).toHaveValue('Preserved task');await date.fill('2026-09-25');
 await page.getByText('More options',{exact:true}).click();const estimate=page.locator('#chore-estimate');await estimate.fill('-1');await save.click();await expect(estimate).toBeFocused();await expect(estimate).toHaveAttribute('aria-describedby','chore-estimate-error');await estimate.fill('1.5');await save.click();await expect(estimate).toBeFocused();await estimate.fill('');
 await page.getByRole('combobox',{name:'End time hour',exact:true}).click();await page.getByRole('option',{name:'09',exact:true}).click();await save.click();await expect(page.locator('#chore-end-hour')).toBeFocused();await expect(page.locator('#chore-end-hour')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#chore-end-error')).toBeVisible();await page.getByRole('button',{name:'Clear end time'}).click();
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);await save.click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(calls.filter(c=>c.method==='POST'&&c.table==='chores')).toHaveLength(1);
});

for(const width of [320,390,1440])for(const theme of ['light','dark'])test(`task action hierarchy ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);await selectAppearance(page,theme);
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
 const {db,calls}=await fixture(page,width);await selectAppearance(page,theme);
 await page.getByRole('button',{name:'Search chores',exact:true}).click();
 const search=await page.locator('#chore-search-input').boundingBox(),content=await page.locator('.today-intro').boundingBox();expect(search!.x).toBeCloseTo(content!.x,0);expect(search!.width).toBeCloseTo(content!.width,0);
 await page.getByRole('button',{name:'Open family menu'}).click();const check=page.locator('.nesmi-member-visibility').first();await expect(check).toHaveAttribute('aria-pressed','true');const target=await check.boundingBox(),visual=await check.locator('span').boundingBox();expect(target!.width).toBeGreaterThanOrEqual(44);expect(visual!.width).toBe(22);await check.focus();await page.keyboard.press('Space');await expect(check).toHaveAttribute('aria-pressed','false');await page.keyboard.press('Space');await expect(check).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');
 db.chores[0].title='Long completed task '.repeat(12);db.chore_completions=Array.from({length:8},(_,i)=>({id:`completion-${i}`,chore_id:db.chores[0].id,completed_by:A,completed_at:`2026-09-25T${String(10+i).padStart(2,'0')}:00:00Z`,instance_date:TODAY}));await page.reload();await openInsights(page);await page.getByRole('button',{name:'Overview',exact:true}).click();const list=page.locator('.nesmi-recent-completions');await expect(list.locator('.nesmi-recent-row')).toHaveCount(8);expect(await list.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await list.locator('.nesmi-recent-row').last().scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:info.outputPath(`recent-${width}-${theme}.png`)});expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

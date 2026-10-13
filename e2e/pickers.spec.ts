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


for (const width of [320, 375, 390, 430, 1440]) for (const theme of ['light','dark']) test(`pickers ${width} ${theme}`, async ({page}, info) => {
 await fixture(page,width);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 await page.getByRole('combobox',{name:/Theme:/}).click();
 await page.getByRole('option',{name:theme==='dark'?/Dark/:/Light/}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Today',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 const checkHeader=async()=>{
  const header=page.getByRole('banner',{name:'Nesmi'}), brand=header.locator('.chore-brand');
  const h=await header.boundingBox(), b=await brand.boundingBox(), left=await header.locator('.nesmi-header-leading').boundingBox(), right=await header.locator('.nesmi-header-actions').boundingBox();
  expect(Math.abs((b!.x+b!.width/2)-(h!.x+h!.width/2))).toBeLessThanOrEqual(1);
  expect(left!.x+left!.width).toBeLessThanOrEqual(b!.x); expect(b!.x+b!.width).toBeLessThanOrEqual(right!.x);
  await expect(header.getByRole('combobox')).toHaveCount(0);
  const menu=header.getByRole('button',{name:'Open family menu'}); const hit=await menu.boundingBox(); expect(hit!.width).toBeGreaterThanOrEqual(44); expect(hit!.height).toBeGreaterThanOrEqual(44);
 };
 await checkHeader();
 await page.getByRole('button',{name:'Open family menu'}).click();
 await expect(page.locator('#nesmi-family-panel')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Show Alex’s chores'})).toBeVisible();
 await expect(page.locator('#nesmi-family-panel').getByText('Alex',{exact:true})).toBeVisible();
 await expect(page.locator('#nesmi-family-panel').getByText('Today',{exact:true})).toHaveCount(0);
 await page.locator('.family-backdrop').click({position:{x:width-5,y:40}});

 await nav.getByRole('button',{name:'Account',exact:true}).click(); await checkHeader();
 const trigger=page.getByRole('combobox',{name:/Theme:/}).last();
 await trigger.click();
 const list=page.getByRole('listbox');
 const box=await list.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(12); expect(box!.x+box!.width).toBeLessThanOrEqual(width-12);
 await expect(list.getByRole('option')).toHaveCount(2);
 await page.screenshot({path:info.outputPath(`account-${theme}-${width}.png`)});
 await trigger.press('ArrowDown'); await trigger.press('Escape'); await expect(list).toHaveCount(0); await expect(trigger).toBeFocused();
 await nav.getByRole('button',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Complete: Water the plants',exact:true}).click();
 const dialog=page.getByRole('dialog'); const picker=dialog.getByRole('combobox',{name:'Who completed it?'});
 await expect(dialog.getByRole('button',{name:'Mark done',exact:true})).toBeDisabled();
 await picker.click(); await expect(dialog.getByRole('listbox')).toBeVisible();
 if(theme==='dark') await expect(dialog.getByRole('listbox')).toHaveCSS('background-color','rgb(8, 8, 9)');
 const familyBox=await dialog.getByRole('listbox').boundingBox(); expect(familyBox!.x).toBeGreaterThanOrEqual(12); expect(familyBox!.x+familyBox!.width).toBeLessThanOrEqual(width-12); expect(familyBox!.y+familyBox!.height).toBeLessThanOrEqual(844-12);
 await page.screenshot({path:info.outputPath(`family-${theme}-${width}.png`)});
 await picker.press('Escape'); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('listbox')).toHaveCount(0);
 await picker.press('ArrowDown'); await picker.press('End'); await picker.press('Enter'); await expect(picker).toContainText('Jamie');
 await expect(dialog.getByRole('button',{name:'Mark done',exact:true})).toBeEnabled();
 await picker.click(); await expect(dialog.getByRole('option',{name:'Jamie',exact:true})).toHaveAttribute('aria-selected','true');
 await picker.press('Tab'); await expect(dialog.getByRole('listbox')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click(); await expect(dialog).toHaveCount(0);
 await nav.getByRole('button',{name:'Insights',exact:true}).click();
 await page.screenshot({path:info.outputPath(`avatars-${theme}-${width}.png`)});
});

for (const width of [320,390,1440]) test(`centered task details and visible discard decision ${width}`, async({page})=>{
 await fixture(page,width);
 await page.getByRole('navigation').getByRole('button',{name:'Calendar',exact:true}).click();
 await page.locator('.fc-event').filter({hasText:'Water the plants'}).first().click();
 const details=page.getByRole('dialog',{name:'Water the plants',exact:true});
 await expect(details).toBeVisible(); const box=await details.boundingBox();
 expect(Math.abs(box!.x+box!.width/2-width/2)).toBeLessThanOrEqual(1);
 expect(box!.x).toBeGreaterThanOrEqual(16);expect(box!.y).toBeGreaterThanOrEqual(16);expect(box!.y+box!.height).toBeLessThanOrEqual(844-16);
 await expect(details.getByRole('button',{name:'Mark complete',exact:true})).toHaveClass(/secondary/);
 await details.getByRole('button',{name:'Close dialog'}).click();await expect(details).toHaveCount(0);
 await page.getByRole('navigation').getByRole('button',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Add new chore',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Add a chore'});await editor.getByLabel('Chore',{exact:true}).fill('Preview draft');
 await editor.locator('.chore-more > summary').click();await editor.getByLabel('Notes · optional').fill('Keep this text');
 await editor.getByRole('button',{name:'Close dialog'}).click();
 const decision=page.getByRole('dialog',{name:'Discard changes?'});await expect(decision).toBeVisible();await expect(decision.getByRole('button',{name:'Keep editing'})).toBeFocused();
 await page.keyboard.press('Escape');await expect(editor.getByLabel('Chore',{exact:true})).toHaveValue('Preview draft');await expect(editor.getByLabel('Notes · optional')).toHaveValue('Keep this text');
 await editor.getByRole('button',{name:'Close dialog'}).click();await decision.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});

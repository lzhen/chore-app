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
 await page.goto('/chore-app/');await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
 return {db,calls,failWrites:()=>{fail=true;},failReads:()=>{readsFail=true;},recover:()=>{fail=false;readsFail=false;}};
}

async function navigate(page:Page,name:string) {
 await page.getByRole('button',{name:'Open family menu',exact:true}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name,exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Primary navigation'})).toHaveCount(0);
}
async function openTaskEditor(page:Page,title:string,width:number) {
 if(width>=900) {
  const edit=page.getByRole('button',{name:`Edit ${title}`,exact:true}).first();await edit.locator('xpath=ancestor::article').hover();await edit.click();
  const editor=page.getByRole('region',{name:`Edit ${title}`,exact:true});await expect(editor).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');return editor;
 }
 await page.getByRole('button',{name:`Actions: ${title}`,exact:true}).first().click();
 await page.getByRole('dialog',{name:title,exact:true}).getByRole('button',{name:`Edit ${title}`,exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Edit chore',exact:true});await expect(editor.getByLabel('Chore',{exact:true})).toBeFocused();return editor;
}

for(const theme of ['light','dark']) for(const width of [390,1440]) test(`unified product surfaces ${theme} ${width}`,async({page},info)=>{
 const {calls}=await fixture(page,width);
 await navigate(page,'Account');
 await page.getByRole('combobox',{name:/Theme:/}).click();
 await page.getByRole('option',{name:theme==='dark'?/Dark/:/Light/}).click();
 await navigate(page,'Today');
 const brand=page.locator('.chore-brand .nesmi-logo');
 const mark=brand.locator('.nesmi-header-icon');
 await expect(mark).toBeVisible();
 await expect(mark).toHaveCSS('width','32px');
 await expect(mark).toHaveCSS('height','32px');
 await expect(mark).toHaveCSS('background-color','rgb(0, 0, 0)');
 const icon=mark.locator('img');
 await expect(icon).toHaveAttribute('src',/icons\/nesmi-1024-20261008\.png$/);
 await expect(icon).toHaveAttribute('alt','');
 expect(await icon.evaluate(el=>(el as HTMLImageElement).complete&&(el as HTMLImageElement).naturalWidth>0)).toBe(true);
 await expect(brand).toHaveCSS('gap','12px');
 await expect(brand.locator('.nesmi-wordmark')).toHaveText('Nesmi');
 await expect(brand.locator('.nesmi-wordmark')).toHaveCSS('font-size',width<=640?'18px':'20px');
 await expect(brand.locator('.nesmi-wordmark')).toHaveCSS('font-weight','600');
 for(const view of ['Calendar','Insights','Account']) {
  await navigate(page,view);
  await page.screenshot({path:info.outputPath(`${view}-${theme}-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(view==='Calendar') {
   for(const name of ['Week','Day','Agenda','Month']) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.fc-view')).toBeVisible();
   }
   await page.getByRole('button',{name:'Next month'}).click();
   await page.getByRole('button',{name:'Previous month'}).click();
  }
  if(view==='Insights') {
   for(const name of ['Activity','Workload','Achievements','Overview']) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
  }
  if(view==='Account') {
   await expect(page.getByText('release-test@example.test')).toBeVisible();
   await expect(page.getByRole('button',{name:'Sign Out',exact:true})).toBeVisible();
  }
 }
 await navigate(page,'Calendar');
 await page.getByRole('button',{name:'Add new chore',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add a chore'});
 const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.width).toBeLessThanOrEqual(width);if(width>=768){expect(box!.width).toBe(530);expect(box!.height).toBeLessThanOrEqual(844*.8+1);}
 await dialog.locator('.chore-more > summary').click();
 await dialog.getByRole('combobox',{name:'Repeat',exact:true}).click();
 await dialog.getByRole('option',{name:'Every week',exact:true}).click();
 await dialog.locator('.chore-advanced > summary').click();
 await dialog.getByRole('combobox',{name:'Priority',exact:true}).click();
 await dialog.getByRole('option',{name:'High',exact:true}).click();
 await dialog.getByLabel('Notes · optional').fill('Fictional preview only');
 await page.screenshot({path:info.outputPath(`form-${theme}-${width}.png`),fullPage:true});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('dialog',{name:'Discard changes?'}).getByRole('button',{name:'Discard changes',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await navigate(page,'Chores');
 const singleEditor=await openTaskEditor(page,'Clean the kitchen counters',width);
 await page.screenshot({path:info.outputPath(`edit-single-${theme}-${width}.png`),fullPage:true});
 await singleEditor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(singleEditor).toHaveCount(0);
 const editor=await openTaskEditor(page,'Water the plants',width);
 await expect(editor.getByText(/You are editing the repeating series/)).toBeVisible();
 await editor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(editor).toHaveCount(0);
 if(width<900)await page.getByRole('button',{name:'More actions for Water the plants',exact:true}).first().click();
 const deleteEntry=page.getByRole('button',{name:'Delete Water the plants',exact:true}).first();
 if(width>=900)await deleteEntry.locator('xpath=ancestor::article').hover();await deleteEntry.click();
 const confirmation=page.getByRole('alertdialog',{name:'Delete repeating series?',exact:true});
 await expect(confirmation).toContainText('every occurrence in this repeating series');await expect(confirmation).toContainText('completion history');
 await expect(confirmation.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
 const footer=await confirmation.locator('.chore-dialog-footer').boundingBox();const header=await confirmation.locator('.chore-dialog-header').boundingBox();
 expect(footer!.y+footer!.height).toBeLessThanOrEqual(844);expect(header!.y).toBeGreaterThanOrEqual(0);
 expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
 await page.screenshot({path:info.outputPath(`repeat-confirm-${theme}-${width}.png`),fullPage:true});
 await page.setViewportSize({width,height:560});const shortFooter=await confirmation.locator('.chore-dialog-footer').boundingBox();expect(shortFooter!.y+shortFooter!.height).toBeLessThanOrEqual(560);
 await page.screenshot({path:info.outputPath(`repeat-short-${theme}-${width}.png`),fullPage:true});
 await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await expect(confirmation).toHaveCount(0);
 if(width<900) {
  await expect(page.getByRole('dialog',{name:'Water the plants',exact:true})).toBeVisible();
  await page.getByRole('dialog',{name:'Water the plants',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'More actions for Water the plants',exact:true}).first()).toBeFocused();
 } else await expect(deleteEntry).toBeFocused();
 expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

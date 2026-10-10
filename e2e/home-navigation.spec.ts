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

for(const width of [320,390,1440]) test(`Home navigation and one create action ${width}`,async({page},info)=>{
 await fixture(page,width);
 await expect(page.locator('.chore-week')).toHaveCount(0);
 const summary=await page.locator('.chore-day-summary').boundingBox(), status=await page.getByRole('group',{name:'Chore status'}).boundingBox();
 expect(Math.abs(status!.x-summary!.x)).toBeLessThanOrEqual(1);
 expect(status!.x+status!.width).toBeLessThanOrEqual(summary!.x+summary!.width+1);
 await expect(page.getByRole('button',{name:'Add new chore'})).toHaveCount(1);
 await expect(page.getByRole('button',{name:/Chore assistant/})).toBeVisible();
 const plus=await page.getByRole('button',{name:'Add new chore'}).boundingBox();
 expect(Math.abs(plus!.x+plus!.width/2-width/2)).toBeLessThanOrEqual(1);
 const main=await page.locator('main').boundingBox();expect(main!.y+main!.height).toBeLessThanOrEqual(plus!.y);
 for(const name of ['Chores','Calendar','Insights','Account','Today']){
  await page.getByRole('button',{name:'Open family menu'}).click();
  await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add new chore'})).toBeVisible();
 }
 await page.getByRole('button',{name:'Search chores'}).click();
 await expect(page.getByRole('searchbox')).toBeFocused();
 await page.getByRole('button',{name:'Open family menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Today',exact:true}).click();
 await page.screenshot({path:info.outputPath(`home-${width}.png`)});
 await page.getByRole('button',{name:/Chore assistant/}).click();
 const assistant=page.getByRole(width>=1024?'complementary':'dialog',{name:'Chore assistant'});
 await expect(assistant).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Chore command'})).not.toBeFocused();
 const panelBox=await assistant.boundingBox();
 expect(panelBox!.x).toBeGreaterThanOrEqual(0);expect(panelBox!.x+panelBox!.width).toBeLessThanOrEqual(width);
 if(width>=1024){await expect(page.getByRole('button',{name:'Add new chore'})).toBeVisible();expect(panelBox!.y+panelBox!.height).toBeLessThanOrEqual(plus!.y);}
 await page.getByRole('textbox',{name:'Chore command'}).fill('Unsent command');
 await page.keyboard.press('Escape');await expect(assistant).toHaveCount(0);
 await page.getByRole('button',{name:/Chore assistant/}).click();
 await expect(page.getByRole('textbox',{name:'Chore command'})).toHaveValue('Unsent command');
 await page.getByRole('button',{name:'Close chore assistant'}).click();
 await expect(page.getByRole('button',{name:/Chore assistant/})).toBeFocused();
 await page.getByRole('button',{name:'Add new chore'}).click();
 await page.getByRole('textbox',{name:'Chore',exact:true}).fill('Review this draft');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();
 await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByRole('textbox',{name:'Chore',exact:true})).toHaveValue('Review this draft');
});

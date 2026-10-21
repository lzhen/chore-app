import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {selectAppearance} from './navigation';
const title='Clean the kitchen countertops and put away everything from the dining table';
for(const width of [320,390,430])for(const theme of ['light','dark'])for(const scale of [1,2])test(`mobile month ${width} ${theme} text ${scale}`,async({page},info)=>{
 const {db,calls}=await fixture(page,width);db.chores[0].title=title;await page.reload();await expect(page.getByRole('progressbar')).toBeVisible();await selectAppearance(page,theme);await page.evaluate(s=>document.documentElement.style.fontSize=`${s*16}px`,scale);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});await nav.getByRole('button',{name:'Calendar',exact:true}).click();
 await expect(page.locator('.nesmi-month-grid')).toBeVisible();
 const toolbarBoxes=await page.locator('.nesmi-month-toolbar > *').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(let i=0;i<toolbarBoxes.length;i++)for(let j=i+1;j<toolbarBoxes.length;j++){const a=toolbarBoxes[i],b=toolbarBoxes[j];expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y).toBe(true);}await expect(page.locator('.fc')).toHaveCount(0);
 await expect(page.getByRole('button',{name:`Edit ${title}`})).toBeVisible();
 const titleStyle=await page.locator('.nesmi-day-tasks .chore-task-title').first().evaluate(el=>({whiteSpace:getComputedStyle(el).whiteSpace,overflow:getComputedStyle(el).overflow}));expect(titleStyle.whiteSpace).toBe('normal');expect(titleStyle.overflow).toBe('visible');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 if(scale===1){const b=await page.locator('.nesmi-month-grid').boundingBox();expect(b!.height).toBeLessThanOrEqual(300);}
 await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('.nesmi-month-toolbar h2')).toHaveText('October 2026');
 await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('.nesmi-month-toolbar h2')).toHaveText('November 2026');
 await page.getByRole('button',{name:'Previous month',exact:true}).click();await page.getByRole('button',{name:'Today',exact:true}).last().click();
 await expect(page.getByRole('button',{name:'Friday, September 25, 2026'})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:info.outputPath('calendar.png')});
 const task=page.getByRole('button',{name:`Edit ${title}`});await task.click();await expect(page.getByRole('dialog',{name:'Edit chore'}).getByLabel('What needs doing?')).toHaveValue(title);await page.getByRole('button',{name:'Close dialog'}).click();
 const add=nav.getByRole('button',{name:'Add chore',exact:true});const ab=await add.boundingBox();expect(Math.abs(ab!.x+ab!.width/2-width/2)).toBeLessThan(2);
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

test('Today empty remains distinct from overdue and removed explanations/count stay absent',async({page},info)=>{
 const {db}=await fixture(page,390);db.chores=[db.chores[1]];await page.reload();await expect(page.getByText('No chores due today')).toBeVisible();await expect(page.getByRole('progressbar')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Overdue/})).toBeVisible();await expect(page.getByText(/Overdue is separate/)).toHaveCount(0);await expect(page.locator('.chore-list-filters')).not.toContainText('1 chore');await page.screenshot({path:info.outputPath('today-overdue.png')});
});

test('progressive loading retains old results and exposes future recurrence without top-window controls',async({page},info)=>{
 const {db}=await fixture(page,390);db.chores.push({id:'88888888-8888-4888-8888-888888888888',title:'Future repeating task',date:'2027-04-01',recurrence:'weekly',assignee_id:null,priority:'medium'});await page.reload();await expect(page.getByRole('progressbar')).toBeVisible();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Chores',exact:true}).click();
 await expect(page.getByText(/Repeating chores:/)).toHaveCount(0);await expect(page.getByRole('button',{name:'Earlier',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Load later chores'}).click();await page.getByRole('button',{name:'Load later chores'}).click();await expect(page.getByRole('button',{name:'Edit Future repeating task'}).first()).toBeVisible();await expect(page.getByRole('button',{name:'Edit Take out the recycling'})).toBeAttached();await page.getByRole('button',{name:'Load earlier chores'}).click();await expect(page.getByRole('button',{name:'Edit Future repeating task'}).first()).toBeAttached();await page.locator('.chore-main').evaluate(el=>el.scrollTop=0);await page.screenshot({path:info.outputPath('chores.png')});
});

test('six-row month keeps 44px date targets and completed titles have no extra tick',async({page})=>{
 const {db,calls}=await fixture(page,320);
 db.chore_completions=[{id:'test-completion',chore_id:db.chores[0].id,instance_date:'2026-09-25',completed_at:'2026-09-25T12:00:00Z'}];
 await page.reload();await expect(page.getByRole('progressbar')).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();
 const completed=page.locator('.nesmi-day-tasks .is-done');await expect(completed).toHaveCount(1);await expect(completed.locator('svg,.chore-check')).toHaveCount(0);
 expect(await completed.locator('.chore-task-title').evaluate(el=>getComputedStyle(el).textDecorationLine)).toContain('line-through');
 await page.getByRole('button',{name:'Previous month',exact:true}).click();await expect(page.locator('.nesmi-month-toolbar h2')).toHaveText('August 2026');
 await expect(page.locator('.nesmi-month-grid button')).toHaveCount(42);
 const sizes=await page.locator('.nesmi-month-grid button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

test('native calendar container lets users reach the final chore',async({page})=>{
 await fixture(page,375);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();
 const calendar=page.locator('.nesmi-mobile-calendar');
 const metrics=await calendar.evaluate(el=>({height:el.clientHeight,content:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
 expect(metrics.content).toBeGreaterThan(metrics.height);
 expect(metrics.overflow).toBe('auto');
 await calendar.hover();await page.mouse.wheel(0,20000);
 await expect.poll(()=>calendar.evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
 await expect(page.getByRole('button',{name:'Edit Sample chore 99',exact:true})).toBeInViewport();
});

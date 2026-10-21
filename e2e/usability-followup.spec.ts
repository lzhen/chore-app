import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';

test('month navigation loads future and past repeats, including spillover dates',async({page},info)=>{
 const {db,calls}=await fixture(page,1440);
 db.chores=[{id:'44444444-4444-4444-8444-444444444444',title:'Visible daily task',date:'2020-01-01',assignee_id:null,recurrence:'daily',priority:'medium'}];
 await page.reload();
 await expect(page.getByRole('progressbar')).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();
 const next=page.getByRole('button',{name:'Next Month',exact:true});
 for(let i=0;i<8;i++)await next.click();
 await expect(page.locator('.fc-toolbar-title')).toHaveText('May 2027');
 const cells=page.locator('.fc-daygrid-day');
 await expect(cells.first().getByText('Visible daily task')).toBeVisible();
 await expect(cells.last().getByText('Visible daily task')).toBeVisible();
 await page.screenshot({path:info.outputPath('future-recurring.png')});
 for(let i=0;i<18;i++)await page.getByRole('button',{name:'Previous Month',exact:true}).click();
 await expect(page.locator('.fc-toolbar-title')).toHaveText('Nov 2025');
 await expect(cells.first().getByText('Visible daily task')).toBeVisible();
 await expect(cells.last().getByText('Visible daily task')).toBeVisible();
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

test('search states its repeat window and can browse later results',async({page},info)=>{
 const {db,calls}=await fixture(page,390);db.chores=[{id:'44444444-4444-4444-8444-444444444444',title:'Future routine',date:'2027-02-01',assignee_id:null,recurrence:'weekly',priority:'medium'}];await page.reload();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Chores',exact:true}).click();
 await expect(page.getByText(/Repeating chores:/)).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Edit Future routine'})).toHaveCount(0);
 await page.getByRole('button',{name:'Load later chores'}).click();
 await expect(page.getByRole('button',{name:'Edit Future routine'}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Load earlier chores'})).toBeVisible();
 await page.screenshot({path:info.outputPath('search-range.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

test('create assign complete undo and dirty form cancellation keep data and input',async({page},info)=>{
 const {calls}=await fixture(page,390,true);
 await page.getByRole('button',{name:'Add chore',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Add a chore',exact:true});
 await form.getByLabel('What needs doing?').fill('Test local chore');
 await form.getByRole('combobox',{name:'Who’s responsible?'}).click();await page.getByRole('option',{name:'Alex',exact:true}).click();
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(form.getByLabel('What needs doing?')).toHaveValue('Test local chore');await expect(form.getByRole('combobox',{name:'Who’s responsible?'})).toContainText('Alex');
 await form.getByLabel('What needs doing?').press('Enter');await expect(form).toBeHidden();
 await expect(page.getByText('1 remaining today')).toBeVisible();
 await page.getByRole('button',{name:'Complete: Test local chore'}).click();
 await page.getByRole('dialog',{name:'Complete chore'}).getByRole('button',{name:'Mark done',exact:true}).click();
 await expect(page.getByText('0 remaining today')).toBeVisible();
 await page.locator('summary').filter({hasText:/^Done/}).click();
 await page.getByRole('button',{name:'Edit Test local chore'}).click();
 // The app opens details first; undo remains in those details.
 await page.getByRole('button',{name:/Undo completion|Mark not done|Undo/i}).click();
 await expect(page.getByText('1 remaining today')).toBeVisible();
 await page.screenshot({path:info.outputPath('completed-and-undone.png')});
 expect(calls.some(c=>c.method==='POST'&&c.table==='chores')).toBeTruthy();expect(calls.some(c=>c.method==='DELETE'&&c.table==='chore_completions')).toBeTruthy();
});

async function moveBetweenDays(page:any,title:string,from:string,to:string){
 const source=page.locator(`.fc-daygrid-day[data-date="${from}"] .fc-event`).filter({hasText:title}).first();
 await source.scrollIntoViewIfNeeded();
 const a=await source.boundingBox(),fromBox=await page.locator(`.fc-daygrid-day[data-date="${from}"]`).boundingBox(),toBox=await page.locator(`.fc-daygrid-day[data-date="${to}"]`).boundingBox();
 const x=a!.x+a!.width/2,y=a!.y+a!.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+8,y,{steps:3});
 await page.mouse.move(x+toBox!.x-fromBox!.x,y+toBox!.y-fromBox!.y,{steps:12});await page.mouse.up();
}

test('drag keeps 15 minutes, recurring cancel writes nothing, failed save rolls back',async({page},info)=>{
 const mock=await fixture(page,1440);mock.db.chores[0].end_time='18:15:00';await page.reload();await expect(page.getByRole('button',{name:'Edit Take out the recycling'})).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();await expect(page.locator('.fc')).toBeVisible();
 await moveBetweenDays(page,'Take out the recycling','2026-09-25','2026-09-26');
 await expect.poll(()=>mock.db.chores[0].date).toBe('2026-09-26');expect(mock.db.chores[0].due_time).toMatch(/^18:00/);expect(mock.db.chores[0].end_time).toMatch(/^18:15/);
 const before=mock.calls.filter(c=>c.method!=='GET').length;
 let confirmed=false;page.once('dialog',async dialog=>{confirmed=true;await dialog.dismiss();});await moveBetweenDays(page,'Water the plants','2026-09-25','2026-09-26');
 await expect.poll(()=>confirmed).toBe(true);await expect(page.locator('.fc-daygrid-day[data-date="2026-09-25"]').getByText('Water the plants')).toBeVisible();expect(mock.calls.filter(c=>c.method!=='GET')).toHaveLength(before);
 mock.failWrites();await moveBetweenDays(page,'Take out the recycling','2026-09-26','2026-09-25');
 await expect(page.getByRole('alert')).toContainText('Could not update chore. Please try again.');
 expect(mock.db.chores[0].date).toBe('2026-09-26');
 await expect(page.locator('.fc-daygrid-day[data-date="2026-09-26"]').getByText('Take out the recycling')).toBeVisible();
 await page.screenshot({path:info.outputPath('move-rollback.png')});
});

test('Enter retains validation and IME protections; a failed save retains draft',async({page})=>{
 const mock=await fixture(page,390,true);await page.getByRole('button',{name:'Add chore',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Add a chore',exact:true}),title=form.getByLabel('What needs doing?');
 await title.press('Enter');await expect(form.getByText('Enter a task name.')).toBeVisible();expect(mock.calls.filter(c=>c.method==='POST')).toHaveLength(0);
 await title.fill('测试任务');await title.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});expect(mock.calls.filter(c=>c.method==='POST')).toHaveLength(0);await expect(form).toBeVisible();
 mock.failWrites();await title.press('Enter');await expect(form.getByRole('alert')).toContainText('Your entries are still here');await expect(title).toHaveValue('测试任务');
 await form.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(title).toHaveValue('测试任务');
});

test('confirmed recurring move shifts the original series and preserves its 15-minute time',async({page})=>{
 const mock=await fixture(page,1440);const routine=mock.db.chores[3];Object.assign(routine,{date:'2020-01-01',due_time:'09:00:00',end_time:'09:15:00'});
 await page.reload();await expect(page.getByRole('progressbar')).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();await expect(page.locator('.fc')).toBeVisible();
 let message='';page.once('dialog',async dialog=>{message=dialog.message();await dialog.accept();});
 await moveBetweenDays(page,'Water the plants','2026-09-25','2026-09-26');
 await expect.poll(()=>routine.date).toBe('2020-01-02');expect(message).toContain('entire repeating series');expect(routine.end_time).toMatch(/^09:15/);
});

test('accepted month-end monthly drag explains and reverts an unrepresentable target',async({page},info)=>{
 const mock=await fixture(page,1440);mock.db.chores=[{id:'11111111-1111-4111-8111-111111111111',title:'Month-end chore',date:'2026-01-31',recurrence:'monthly',due_time:'09:00:00',end_time:'09:15:00',assignee_id:null,priority:'medium'}];
 await page.clock.setFixedTime(new Date('2026-02-20T19:00:00Z'));await page.reload();await expect(page.getByText('No chores due today')).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Calendar',exact:true}).click();await expect(page.locator('.fc-toolbar-title')).toHaveText('Feb 2026');
 let accepted=false;page.once('dialog',async dialog=>{accepted=true;await dialog.accept();});
 await moveBetweenDays(page,'Month-end chore','2026-02-28','2026-02-27');
 await expect(page.getByRole('alert')).toContainText('This move does not fit the monthly schedule. The series was not changed.');
 expect(accepted).toBe(true);expect(mock.calls.filter(c=>c.method!=='GET')).toHaveLength(0);expect(mock.db.chores[0].date).toBe('2026-01-31');expect(mock.db.chores[0].end_time).toBe('09:15:00');
 await expect(page.locator('.fc-daygrid-day[data-date="2026-02-28"]').getByText('Month-end chore')).toBeVisible();
 await expect(page.locator('.fc-daygrid-day[data-date="2026-02-27"]').getByText('Month-end chore')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('monthly-clamp-reverted.png')});
});

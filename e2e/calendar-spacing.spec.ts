import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {selectAppearance} from './navigation';
import {writeFile} from 'node:fs/promises';
for(const width of [320,390,430,1440])for(const theme of ['light','dark'])test(`spacing ${width} ${theme}`,async({page},info)=>{
 const f=await fixture(page,width);await selectAppearance(page,theme);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});const data:any={};
 await nav.getByRole('button',{name:'Today',exact:true}).click();
 data.today=await page.locator('.chore-main').evaluate(el=>({scrollTop:el.scrollTop,headingTop:el.querySelector('h1,h2')?.getBoundingClientRect().top,headerBottom:document.querySelector('.chore-header')!.getBoundingClientRect().bottom}));
 await nav.getByRole('button',{name:'Calendar',exact:true}).click();
 for(const view of ['Month','Week','Day','Agenda']){
  await page.getByRole('button',{name:view,exact:true}).click();
  const fc=page.locator('.fc');await expect(fc).toBeVisible();
  data[view]=await fc.evaluate(el=>{const b=(s:string)=>el.querySelector(s)?.getBoundingClientRect();const toolbar=b('.fc-toolbar')!,grid=b('.fc-view-harness')!;const launcher=document.querySelector('.nesmi-agent-trigger')!.getBoundingClientRect();const nav=document.querySelector('.chore-tabs')!.getBoundingClientRect();const sc=document.querySelector('.chore-calendar-page')!;return {toolbarGridGap:grid.top-toolbar.bottom,toolbarInset:toolbar.x-el.getBoundingClientRect().x,headerHeight:b('.fc-col-header')?.height,rowHeights:[...el.querySelectorAll('.fc-daygrid-body tbody>tr')].map(e=>e.getBoundingClientRect().height),sideGap:innerWidth-launcher.right,bottomGap:innerWidth<768?nav.top-launcher.bottom:innerHeight-launcher.bottom,launcherSize:launcher.width,pagePadding:getComputedStyle(sc).padding,scrollWidth:sc.scrollWidth,width:sc.clientWidth};});
  await page.screenshot({path:info.outputPath(view+'.png')});
  await page.locator('.chore-calendar-page').evaluate(el=>el.scrollTop=el.scrollHeight);await page.screenshot({path:info.outputPath(view+'-bottom.png')});await page.locator('.chore-calendar-page').evaluate(el=>el.scrollTop=0);
  if(!process.env.SPACING_BASELINE){expect(data[view].toolbarGridGap).toBe(16);expect(data[view].toolbarInset).toBe(0);expect(data[view].scrollWidth).toBeLessThanOrEqual(data[view].width+1);expect(data[view].bottomGap).toBeGreaterThanOrEqual(12);expect(data[view].sideGap).toBeGreaterThanOrEqual(20);expect(data[view].launcherSize).toBe(48);if(view==='Month')expect(Math.max(...data[view].rowHeights)-Math.min(...data[view].rowHeights)).toBeLessThanOrEqual(1);}
 }
 await page.getByRole('button',{name:'Month',exact:true}).click();
 const event=page.locator('.fc-event').filter({hasText:'Clean the kitchen counters'}).first();await event.scrollIntoViewIfNeeded();await event.focus();await page.keyboard.press('Enter');await expect(page.locator('.event-popover h3')).toHaveText('Clean the kitchen counters');await expect(page.locator('.event-popover')).toBeInViewport();await expect(page.locator('.event-popover')).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath('full-event-details.png')});await page.getByRole('button',{name:'Close task details'}).click();
 await writeFile(info.outputPath('metrics.json'),JSON.stringify(data,null,2));expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

test('dense month and simulated bottom safe area',async({page},info)=>{
 const f=await fixture(page,390);f.db.chores.push(...Array.from({length:5},(_,i)=>({id:'spacing-stress-'+i,title:'Long household task title '+i+' with complete instructions',date:'2026-09-25',recurrence:'none',priority:'medium',assignee_id:null})));
 await page.reload();const nav=page.getByRole('navigation',{name:'Primary navigation'});await nav.getByRole('button',{name:'Calendar',exact:true}).click();
 await page.locator('.fc-daygrid-day[data-date="2026-09-25"]').scrollIntoViewIfNeeded();
 const more=page.locator('.fc-daygrid-day[data-date="2026-09-25"] .fc-daygrid-more-link');await expect(more).toBeVisible();await more.click();
 const long=page.locator('.fc-popover .fc-event').filter({hasText:'Long household task title 4 with complete instructions'});await expect(long).toHaveAttribute('aria-label','Long household task title 4 with complete instructions');await long.click();await expect(page.locator('.event-popover h3')).toHaveText('Long household task title 4 with complete instructions');await page.getByRole('button',{name:'Close task details'}).click();await expect(page.locator('.event-popover')).toHaveCount(0);await expect(page.locator('.fc-popover')).toHaveCount(0);
 // Simulate a 34px home-indicator reservation; real device env() remains a device check.
 await page.addStyleTag({content:'.chore-tabs{height:104px!important;padding-bottom:40px!important;}'});
 for(const screen of ['Today','Calendar','Chores','Account']){await nav.getByRole('button',{name:screen,exact:true}).click();const a=await page.getByRole('button',{name:'Assistant',exact:true}).boundingBox(),n=await nav.boundingBox();expect(n!.y-a!.y-a!.height).toBe(12);expect(a!.width).toBe(48);}
 await nav.getByRole('button',{name:'Calendar',exact:true}).click();for(const view of ['Month','Week','Day','Agenda']){await page.getByRole('button',{name:view,exact:true}).click();await page.locator('.chore-calendar-page').evaluate(e=>e.scrollTop=e.scrollHeight);const last=await page.locator('.fc-view-harness').boundingBox(),tools=await page.locator('.nesmi-task-tools').boundingBox();expect(last!.y+last!.height).toBeLessThanOrEqual(tools!.y-23);}
 await page.screenshot({path:info.outputPath('safe-area-bottom.png')});expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

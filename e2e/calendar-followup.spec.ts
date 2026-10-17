import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {selectAppearance} from './navigation';
for(const width of [320,390,430,1440])for(const theme of ['light','dark'])test(`calendar ${width} ${theme}`,async({page},info)=>{
 const {calls}=await fixture(page,width);await selectAppearance(page,theme);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Calendar',exact:true}).click();
 const metrics:any={};
 for(const view of ['Month','Week','Day','Agenda']){
  await page.getByRole('button',{name:view,exact:true}).click();
  await expect(page.locator('.fc')).toBeVisible();
  const box=await page.locator('.fc').boundingBox();
  expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  if(view==='Agenda'){
   const layout=await page.locator('.fc-list').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
   expect(layout.scroll).toBeLessThanOrEqual(layout.width+1);
   await expect(page.locator('.fc-list-event-graphic').first()).toBeHidden();
  }
  await page.screenshot({path:info.outputPath(`${view}.png`)});
  const scroll=page.locator('.chore-calendar-page');await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.screenshot({path:info.outputPath(`${view}-bottom.png`)});await scroll.evaluate(el=>{el.scrollTop=0;});
  metrics[view]=await page.locator('.fc').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,events:[...el.querySelectorAll('.fc-event')].slice(0,10).map(e=>({text:e.textContent,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth})),list:el.querySelector('.fc-list-table')?.getBoundingClientRect().height}));
 }
 for(const screen of ['Today','Calendar','Chores','Account']){
  await nav.getByRole('button',{name:screen,exact:true}).click();
  const launcher=page.getByRole('button',{name:'Assistant',exact:true});
  await expect(launcher).toBeVisible();await expect(launcher).toHaveText('');
  const b=await launcher.boundingBox(),n=await nav.boundingBox();
  expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);if(width<768)expect(b!.y+b!.height).toBeLessThanOrEqual(n!.y);
 }
 await page.screenshot({path:info.outputPath('Account-assistant.png')});
 await page.getByRole('button',{name:'Assistant',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Assistant',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Assistant',exact:true})).toBeHidden();
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toBeFocused();
 await nav.getByRole('button',{name:'Calendar',exact:true}).click();
 await page.getByRole('button',{name:'Agenda',exact:true}).click();await page.getByText('Clean the kitchen counters',{exact:true}).click();await expect(page.locator('.event-popover')).toBeVisible();await expect(page.getByRole('button',{name:'Assistant',exact:true})).toBeHidden();await page.locator('.fc-toolbar-title').click();
 await page.getByRole('button',{name:'Open family menu'}).click();
 await page.screenshot({path:info.outputPath('Family.png')});
 metrics.family=await page.locator('.family-backdrop').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
 const family=page.getByRole('dialog',{name:'Family',exact:true});
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toHaveCount(0);
 await page.keyboard.press('Shift+Tab');await expect(family.locator(':focus')).toHaveCount(1);
 const grid=await family.locator('.mini-calendar').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,border:getComputedStyle(el).borderTopWidth}));
 expect(grid.border).toBe('0px');expect(grid.scroll).toBeLessThanOrEqual(grid.width+1);
 await page.keyboard.press('Escape');await expect(family).toBeHidden();
 await expect(page.getByRole('button',{name:'Open family menu'})).toBeFocused();
 await page.getByRole('button',{name:'Open family menu'}).click();
 await family.locator('.mini-calendar .grid button').filter({hasText:/^15$/}).click();await expect(family).toBeHidden();
 await expect(nav.getByRole('button',{name:'Calendar',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'Open family menu'}).click();
 await page.locator('.family-backdrop').click({position:{x:width-5,y:100}});await expect(family).toBeHidden();
 await nav.getByRole('button',{name:'Add chore',exact:true}).click();
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Close dialog'}).click();
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toBeVisible();
 await page.setViewportSize({width,height:480});await page.getByRole('button',{name:'Open family menu'}).click();await family.getByRole('textbox',{name:'Family member name'}).scrollIntoViewIfNeeded();await expect(family.getByRole('textbox',{name:'Family member name'})).toBeInViewport();await page.keyboard.press('Escape');
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
 await (await import('node:fs/promises')).writeFile(info.outputPath('metrics.json'),JSON.stringify(metrics,null,2));
});

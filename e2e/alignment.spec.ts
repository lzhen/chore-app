import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
for(const width of [390,1440])test(`content and action alignment ${width}`,async({page},info)=>{
 await fixture(page,width);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Chores',exact:true}).click();
 const left=await page.locator('.chore-list-filters').evaluate(el=>el.getBoundingClientRect().left);
 for(const name of ['Load earlier chores','Load later chores']){
  const button=page.getByRole('button',{name,exact:true});
  expect(Math.abs((await button.boundingBox())!.x-left)).toBeLessThan(1);
 }
 await page.screenshot({path:info.outputPath('chores-aligned.png')});
 await nav.getByRole('button',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Previous week',exact:true}).click();
 await expect(page.locator('.chore-list-empty-action')).toBeVisible();
 const empty=await page.locator('.chore-list-empty-action button').boundingBox();
 const filter=await page.locator('.chore-list-filters').boundingBox();
 expect(Math.abs(empty!.x-filter!.x)).toBeLessThan(1);
 if(width>=768){
  const add=await page.locator('.nesmi-desktop-add button').boundingBox();
  const assistant=await page.locator('.nesmi-task-tools button').boundingBox();
  expect(Math.abs(add!.y+add!.height/2-assistant!.y-assistant!.height/2)).toBeLessThan(1);
 }
 await page.screenshot({path:info.outputPath('empty-day-aligned.png')});
});

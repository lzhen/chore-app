import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {writeFile} from 'node:fs/promises';
test('login copy and controls',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/chore-app/');
 await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeVisible();
 if(!process.env.LAYOUT_BASELINE){
  for(const text of ['A LITTLE LESS TO REMEMBER','WELCOME HOME','Your household, all in one place.','Nesmi · A little more together.'])await expect(page.getByText(text,{exact:true})).toHaveCount(0);
  await expect(page.locator('.nesmi-auth-header .nesmi-theme')).toHaveCount(0);
  const b=await page.getByText('Made by Empathie',{exact:true}).boundingBox();expect(Math.abs(b!.x+b!.width/2-195)).toBeLessThan(1);
 }
 await page.screenshot({path:info.outputPath('login.png'),fullPage:true});
});
test('long Today list ends above reserved assistant footer',async({page},info)=>{
 await fixture(page,375);const list=page.locator('.chore-list-page');
 await list.evaluate(el=>el.scrollTop=el.scrollHeight);
 const metrics=await page.evaluate(()=>{const list=document.querySelector('.chore-list-page')!;const rows=list.querySelectorAll('.chore-task');const last=rows[rows.length-1];const r=last.getBoundingClientRect(),s=list.getBoundingClientRect(),a=document.querySelector('.nesmi-task-tools')!.getBoundingClientRect();return {padding:getComputedStyle(list).paddingBottom,lastBottom:r.bottom,listBottom:s.bottom,gap:s.bottom-r.bottom,assistantTop:a.top,scrollTop:list.scrollTop,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight};});
 await writeFile(info.outputPath('metrics.json'),JSON.stringify(metrics,null,2));
 if(!process.env.LAYOUT_BASELINE){expect(metrics.gap).toBeGreaterThanOrEqual(12);expect(metrics.gap).toBeLessThanOrEqual(25);expect(metrics.lastBottom).toBeLessThanOrEqual(metrics.assistantTop);}
 await page.screenshot({path:info.outputPath('today-bottom.png')});
});

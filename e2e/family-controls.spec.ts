import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {selectAppearance} from './navigation';
for(const theme of ['light','dark'])test(`Family controls and dismissal ${theme}`,async({page},info)=>{
 const f=await fixture(page,390);await selectAppearance(page,theme);const trigger=page.getByRole('button',{name:'Open family menu'});await trigger.click();const panel=page.getByRole('dialog',{name:'Family',exact:true});const close=panel.getByRole('button',{name:'Close sidebar'});expect(await close.locator('svg').count()).toBe(0);await expect(close).toHaveCSS('clip','rect(0px, 0px, 0px, 0px)');
 const input=panel.getByRole('textbox',{name:'Family member name'}),add=panel.getByRole('button',{name:'Add',exact:true});await expect(add).toBeDisabled();await input.fill('   ');await expect(add).toBeDisabled();await input.press('Enter');expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);await input.fill('');await page.screenshot({path:info.outputPath(`family-empty-${theme}.png`)});
 await input.fill('Alice');await expect(add).toBeEnabled();await page.screenshot({path:info.outputPath(`family-valid-${theme}.png`)});await input.press('Escape');await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await page.keyboard.press('Tab');await expect(close).toBeFocused();await expect(close).toHaveCSS('clip','auto');await page.keyboard.press('Enter');await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await page.getByRole('button',{name:'Close family menu',exact:true}).click({position:{x:380,y:400}});await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

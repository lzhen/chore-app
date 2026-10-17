import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {selectAppearance} from './navigation';
for(const width of [390,1440])for(const theme of ['light','dark'])test(`Account owns Insights ${width} ${theme}`,async({page},info)=>{
 const f=await fixture(page,width);await selectAppearance(page,theme);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Account',exact:true}).click();
 const entry=page.getByRole('button',{name:'View activity',exact:true});await expect(entry).toBeVisible();await expect(entry).toHaveClass(/secondary/);await expect(page.getByRole('button',{name:'Assistant',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Activity & insights',exact:true})).toBeVisible();await expect(page.getByText('Review household activity.',{exact:true})).toBeVisible();
 const heading=await page.getByRole('heading',{name:'Appearance',exact:true}).boundingBox();const button=await entry.boundingBox();expect(Math.abs(button!.x-heading!.x)).toBeLessThanOrEqual(1);expect(button!.height).toBeLessThanOrEqual(52);
 await page.screenshot({path:info.outputPath(`account-${width}-${theme}.png`)});
 await entry.click();await expect(page.getByRole('heading',{name:'Insights',exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const name of ['Overview','Workload','Activity']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await nav.getByRole('button',{name:'Account',exact:true}).click();await expect(entry).toBeVisible();await entry.click();await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveAttribute('aria-pressed','true');
 await nav.getByRole('button',{name:'Today',exact:true}).click();await expect(page.getByRole('button',{name:'Assistant',exact:true})).toBeVisible();await page.getByRole('button',{name:'Open family menu'}).click();
 const family=page.getByRole('dialog',{name:'Family',exact:true});await expect(family.getByRole('button',{name:'View activity'})).toHaveCount(0);await expect(family.getByRole('button',{name:'Add',exact:true})).toBeDisabled();await page.screenshot({path:info.outputPath(`family-${width}-${theme}.png`)});await page.keyboard.press('Escape');expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

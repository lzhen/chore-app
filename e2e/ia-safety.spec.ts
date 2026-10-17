import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {openInsights,selectAppearance} from './navigation';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US'});

for(const theme of ['light','dark'])test(`explicit choices and truthful insights ${theme}`,async({page},info)=>{
 const f=await fixture(page,390);await selectAppearance(page,theme);
 f.db.chores.push({...f.db.chores[0],id:'55555555-5555-4555-8555-555555555555',title:'Water the garden',assignee_id:null});
 await page.reload();
 await page.screenshot({path:info.outputPath(`today-${theme}.png`)});
 await page.getByRole('button',{name:'Assistant',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Assistant'}),input=panel.getByRole('textbox',{name:'Message'});
 const send=async(text:string)=>{await input.fill(text);await panel.getByRole('button',{name:'Send message'}).click();};
 await send('complete water');await expect(panel.getByRole('group',{name:'Choose a chore'})).toBeVisible();expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
 await page.screenshot({path:info.outputPath(`choice-${theme}.png`)});
 await panel.getByRole('button',{name:/Water the plants ·/}).click();await expect(panel.getByRole('group',{name:'Choose who completed it'})).toBeVisible();expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
 await panel.getByRole('button',{name:'Eric',exact:true}).click();await expect(panel.getByRole('log')).toContainText('Completed “Water the plants”');
 const write=f.calls.find(c=>c.table==='chore_completions'&&c.method==='POST')!;expect(write.body.completed_by).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');expect(write.body.instance_date).toBe('2026-09-25');
 await panel.getByRole('button',{name:'Close assistant'}).click();await openInsights(page);await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('Water the plants',{exact:true})).toBeVisible();await expect(page.getByText('9/25/2026',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`activity-${theme}.png`)});
 await page.getByRole('button',{name:'Workload',exact:true}).click();await expect(page.getByRole('heading',{name:'Next 7 days',exact:true})).toBeVisible();await expect(page.getByText('Not set',{exact:true}).first()).toBeVisible();await page.screenshot({path:info.outputPath(`workload-${theme}.png`)});
});

test('keyboard-sized viewport and safe-area reservation do not cover composer or navigation',async({page},info)=>{
 await fixture(page,320);
 const nav=page.getByRole('navigation',{name:'Primary navigation'}), launcher=page.getByRole('button',{name:'Assistant',exact:true});
 // Synthetic safe-area reservation: validates layout, not actual iOS hardware.
 await page.addStyleTag({content:'.chore-tabs{height:104px!important;padding-bottom:40px!important;}'});
 const l=await launcher.boundingBox(),n=await nav.boundingBox();expect(l!.y+l!.height).toBeLessThanOrEqual(n!.y);
 await launcher.click();const panel=page.getByRole('dialog',{name:'Assistant'});await page.setViewportSize({width:320,height:430});
 const input=panel.getByRole('textbox',{name:'Message'});await input.fill('Draft with keyboard');
 const i=await input.boundingBox();expect(i!.y+i!.height).toBeLessThanOrEqual(430);await page.screenshot({path:info.outputPath('keyboard-sized.png')});
 await input.press('Escape');await expect(launcher).toBeFocused();
 await page.setViewportSize({width:844,height:390});await launcher.click();const b=await panel.boundingBox();expect(b!.y+b!.height).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath('landscape.png')});
});

test('Family traps keyboard focus; Account opens Activity and preserves explicit zero estimates',async({page})=>{
 const f=await fixture(page,390);f.db.chores[0].estimated_minutes=0;f.db.team_members[0].weekly_capacity_minutes=0;await page.reload();
 const menu=page.getByRole('button',{name:'Open family menu'});await menu.click();const family=page.getByRole('dialog',{name:'Family',exact:true});await expect(family).toBeFocused();await page.keyboard.press('Tab');await expect(family.getByRole('button',{name:'Close sidebar'})).toBeFocused();await page.keyboard.press('Escape');await expect(menu).toBeFocused();
 await openInsights(page);await expect(page.getByRole('heading',{name:'Insights',exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Workload',exact:true}).click();
 const alex=page.getByRole('region',{name:'Alex workload'});await expect(alex).toContainText('0 min');await expect(alex.getByText('Not set',{exact:true})).toHaveCount(0);
});

for(const theme of ['light','dark'])test(`scrolled last task, menu and Account remain accessible ${theme}`,async({page},info)=>{
 await fixture(page,375);await selectAppearance(page,theme);
 const main=page.locator('main');await main.evaluate(e=>e.scrollTop=e.scrollHeight);
 const last=page.getByText('Clean the kitchen counters',{exact:true});await last.scrollIntoViewIfNeeded();
 const box=await last.boundingBox(),launcher=await page.getByRole('button',{name:'Assistant',exact:true}).boundingBox(),nav=await page.getByRole('navigation',{name:'Primary navigation'}).boundingBox();
 expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(launcher!.y);expect(launcher!.y+launcher!.height).toBeLessThanOrEqual(nav!.y);
 await page.screenshot({path:info.outputPath(`today-scrolled-${theme}.png`)});
 await page.getByRole('button',{name:'Open family menu'}).click();await expect(page.getByRole('dialog',{name:'Family',exact:true}).getByRole('button',{name:'Activity & insights'})).toHaveCount(0);await page.screenshot({path:info.outputPath(`menu-${theme}.png`)});
 await page.keyboard.press('Escape');await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();await expect(page.getByText('Appearance',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`account-${theme}.png`)});
});

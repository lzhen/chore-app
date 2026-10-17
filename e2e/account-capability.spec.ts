import {test,expect} from '@playwright/test';
import {fixture} from './ia-fixture';
import {selectAppearance} from './navigation';
for(const width of [320,390,430,1440])for(const theme of ['light','dark'])test(`unsupported Account ${width} ${theme}`,async({page},info)=>{
 await page.addInitScript(()=>{delete (window as any).Notification;});
 const f=await fixture(page,width);await selectAppearance(page,theme);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Account',exact:true}).click();
 await expect(page.getByRole('region',{name:'Notifications',exact:true})).toHaveCount(0);
 const section=page.getByRole('region',{name:'Activity & insights',exact:true});
 await expect(section.getByText('Review household activity.',{exact:true})).toBeVisible();
 const button=section.getByRole('button',{name:'View activity',exact:true});
 await expect(button).toHaveClass(/secondary/);
 const b=await button.boundingBox(),h=await section.getByRole('heading').boundingBox();
 expect(Math.abs(b!.x-h!.x)).toBeLessThanOrEqual(1);expect(b!.width).toBeLessThan(180);
 await expect(page.getByText('Choose light or dark.',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath(`account-unsupported-${width}-${theme}.png`),fullPage:true});
 if(width<768){
  const nav=page.getByRole('navigation',{name:'Primary navigation'});
  const geometry=await nav.locator('button').evaluateAll(buttons=>buttons.map(button=>{
   const rect=(el:Element)=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
   const svg=button.querySelector('svg')!;const path=svg.querySelector('path')!;const b=path.getBBox();const m=path.getScreenCTM()!;const center=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);
   return {name:button.getAttribute('aria-label')||button.textContent,button:rect(button),icon:rect(svg),glyphCenter:{x:center.x,y:center.y},label:rect(button.querySelector('span')!)};
  }));
  const add=geometry.find(g=>g.name==='Add chore')!;
  for(const peer of geometry){expect(Math.abs(add.icon.cy-peer.icon.cy)).toBeLessThanOrEqual(0.5);expect(Math.abs(add.glyphCenter.y-peer.glyphCenter.y)).toBeLessThanOrEqual(0.5);expect(peer.button.height).toBeGreaterThanOrEqual(48);}
  await info.attach('nav-geometry',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
  const fs=await import('node:fs/promises');await fs.writeFile(info.outputPath('nav-geometry.json'),JSON.stringify(geometry,null,2));
  await nav.screenshot({path:info.outputPath(`nav-${width}-${theme}.png`)});
 }
 await button.click();await expect(page.getByRole('button',{name:'Activity',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(f.calls.filter(c=>c.method!=='GET')).toHaveLength(0);
});

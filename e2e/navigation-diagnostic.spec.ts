import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {fixture} from './navigation-diagnostic-fixture';
for(let sample=0;sample<24;sample++)test(`Account initial navigation sample ${sample}`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const log:any[]=[];(window as any).__navProbe=log;
  for(const event of ['pointerdown','pointerup','click'])document.addEventListener(event,e=>{
   const target=e.target as HTMLElement;log.push({event,time:performance.now(),target:target.closest('button')?.textContent,view:document.querySelector('.chore-app')?.getAttribute('data-view'),x:(e as MouseEvent).clientX,y:(e as MouseEvent).clientY});
  },true);
  new MutationObserver(records=>{for(const record of records)if(record.attributeName==='data-view')log.push({event:'view',time:performance.now(),view:(record.target as Element).getAttribute('data-view')});}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-view']});
 });
 await fixture(page,[320,390,430][sample%3]);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 try {
  // Same reads and click as the failing existing selectAppearance helper.
  const current=await nav.getByRole('button',{name:/^(Today|Calendar|Chores|Account)$/}).all();
  for(const item of current)if(await item.getAttribute('aria-current')==='page')await item.innerText();
  const navCount=await nav.count();await page.evaluate(count=>(window as any).__navProbe.push({event:'nav-count-before-click',count}),navCount);
  if(navCount)await nav.getByRole('button',{name:'Account',exact:true}).click();
  await expect(nav.getByRole('button',{name:'Account',exact:true})).toHaveAttribute('aria-current','page',{timeout:2000});
  await expect(page.getByRole('heading',{name:'Appearance',exact:true})).toBeVisible();
 }finally{
  const probe=await page.evaluate(()=>({events:(window as any).__navProbe,view:document.querySelector('.chore-app')?.getAttribute('data-view'),active:document.activeElement?.outerHTML}));
  await writeFile(info.outputPath('navigation-probe.json'),JSON.stringify({errors,...probe},null,2));
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png')});
 }
});

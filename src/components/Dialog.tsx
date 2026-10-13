import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
interface Props { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean; variant?: 'dialog' | 'drawer' | 'centered'; role?: 'dialog' | 'alertdialog'; descriptionId?: string; initialFocusRef?: RefObject<HTMLElement>; }

// One keyboard/focus boundary and one page lock, even when a decision overlays a drawer.
const layers: HTMLDivElement[] = [];
let pageLock: { root: HTMLElement | null; inert: boolean; overflow: string } | null = null;
function updateLayers() {
 layers.forEach((layer,index)=>{
  const covered=index!==layers.length-1;
  layer.inert=covered;
  if(covered) layer.setAttribute('aria-hidden','true'); else layer.removeAttribute('aria-hidden');
  layer.querySelector('[data-dialog-box]')?.setAttribute('aria-modal',String(!covered));
 });
}
export function Dialog({title, onClose, children, footer, busy=false, variant='dialog', role='dialog', descriptionId, initialFocusRef}: Props) {
 const box=useRef<HTMLDivElement>(null), layer=useRef<HTMLDivElement>(null);
 const close=useRef(onClose); close.current=onClose;
 const working=useRef(busy); working.current=busy;
 const closeIfActive=()=>{if(!working.current&&layer.current===layers[layers.length-1])close.current();};
 useEffect(()=>{
  const currentLayer=layer.current!;
  const previous=document.activeElement as HTMLElement | null;
  if(!layers.length){
   const root=document.getElementById('root');
   pageLock={root,inert:root?.inert||false,overflow:document.body.style.overflow};
   if(root)root.inert=true;
   document.body.style.overflow='hidden';
  }
  layers.push(currentLayer);
  (initialFocusRef?.current||box.current)?.focus({preventScroll:true});
  updateLayers();
  const onKey=(event:KeyboardEvent)=>{
   if(currentLayer!==layers[layers.length-1])return;
   if(event.key==='Escape' && box.current?.querySelector('[data-open-picker]')) return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!working.current)close.current();}
   if(event.key!=='Tab'||!box.current)return;
   const items=[...box.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')].filter(el=>el.tabIndex>=0&&el.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];
   if(!first){event.preventDefault();box.current.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===box.current)){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===box.current)){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey,true);
  return ()=>{
   document.removeEventListener('keydown',onKey,true);
   layers.splice(layers.indexOf(currentLayer),1);
   updateLayers();
   if(!layers.length&&pageLock){
    document.body.style.overflow=pageLock.overflow;
    if(pageLock.root)pageLock.root.inert=pageLock.inert;
    pageLock=null;
   }
   const top=layers[layers.length-1];
   if(previous?.isConnected&&(!top||top.contains(previous)))previous.focus({preventScroll:true});
  };
 },[]);
 return createPortal(<div ref={layer} className={variant==='drawer'?'family-overlay':`chore-dialog-backdrop${variant==='centered'?' is-centered':''}`} onClick={event=>{if(event.target===event.currentTarget)closeIfActive();}}>{variant==='drawer'&&<button className="family-backdrop" aria-label="Close family menu" onClick={closeIfActive} disabled={busy} tabIndex={-1}/>}<div data-dialog-box id={variant==='drawer'?'nesmi-family-panel':undefined} className={variant==='drawer'?'family-panel':'chore-dialog'} role={role} aria-modal="true" aria-label={title} aria-describedby={descriptionId} aria-busy={busy||undefined} tabIndex={-1} ref={box}>
  <header className={variant==='drawer'?'family-drawer-header':'chore-dialog-header'}><h2>{title}</h2><button type="button" onClick={closeIfActive} disabled={busy} className={variant==='drawer'?'sr-only focus:not-sr-only':'touch-button'} aria-label={variant==='drawer'?'Close family menu':'Close dialog'}>{variant==='drawer'?'Close family menu':'✕'}</button></header>
  <div className={variant==='drawer'?'family-drawer-body':'chore-dialog-body'}>{children}</div>{footer&&<footer className="chore-dialog-footer">{footer}</footer>}
 </div></div>,document.body);
}

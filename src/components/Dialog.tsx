import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
let dialogCount=0;
let restorePage=()=>{};
interface Props { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean; suspended?: boolean; returnFocus?: HTMLElement | null; size?: 'content' | 'form' | 'confirm'; }
export function Dialog({title, onClose, children, footer, busy=false, suspended=false, returnFocus, size='content'}: Props) {
 const box=useRef<HTMLDivElement>(null); const close=useRef(onClose); close.current=onClose;
 useLayoutEffect(()=>{if(box.current)box.current.inert=suspended;},[suspended]);
 const host=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const viewport=window.visualViewport;
  let frame=0;
  const update=()=>{
   const element=host.current;if(!element)return;
   // WebKit can pan the document for a focused field even with a fixed body.
   if(dialogCount>0&&(window.scrollX!==0||window.scrollY!==0))window.scrollTo(0,0);
   const height=viewport?.height||window.innerHeight;
   element.style.setProperty('--dialog-viewport-height',`${height}px`);
   element.style.setProperty('--dialog-viewport-top',`${viewport?.offsetTop||0}px`);
   const body=box.current?.querySelector<HTMLElement>('.chore-dialog-body');
   const focused=document.activeElement as HTMLElement|null;
   if(!suspended&&body&&focused&&body.contains(focused)){
    const bounds=body.getBoundingClientRect(),field=focused.getBoundingClientRect();
    if(field.bottom>bounds.bottom-12)body.scrollTop+=field.bottom-bounds.bottom+12;
    else if(field.top<bounds.top+12)body.scrollTop-=bounds.top-field.top+12;
   }
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
  update();viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule);document.addEventListener('focusin',schedule);
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);document.removeEventListener('focusin',schedule);};
 },[suspended]);
 const working=useRef(busy); working.current=busy;
 useEffect(()=>{
  const previous=returnFocus ?? document.activeElement as HTMLElement | null;
  const root=document.getElementById('root'); const oldInert=root?.inert || false;
  const body=document.body;
  const oldStyle={overflow:body.style.overflow,position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width};
  const pageX=window.scrollX,pageY=window.scrollY;
  if(dialogCount++===0){
   if(root)root.inert=true;
   Object.assign(body.style,{overflow:'hidden',position:'fixed',top:`${-pageY}px`,left:`${-pageX}px`,width:'100%'});
   restorePage=()=>{Object.assign(body.style,oldStyle);if(root)root.inert=oldInert;window.scrollTo(pageX,pageY);previous?.focus({preventScroll:true});};
  }
  (box.current?.querySelector<HTMLElement>('[data-dialog-autofocus]')||box.current)?.focus({preventScroll:true});
  const onKey=(event:KeyboardEvent)=>{
   const dialogs=document.querySelectorAll('[aria-modal="true"]');
   if(box.current?.inert||dialogs[dialogs.length-1]!==box.current)return;
   if(event.key==='Escape' && box.current?.querySelector('[data-open-picker]')) return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!working.current)close.current();}
   if(event.key!=='Tab'||!box.current)return;
   const items=[...box.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')].filter(el=>el.tabIndex>=0&&el.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];
   if(!first){event.preventDefault();box.current.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===box.current)){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===box.current)){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey,true);
  return ()=>{document.removeEventListener('keydown',onKey,true);if(--dialogCount===0)restorePage();else queueMicrotask(()=>{if(previous?.isConnected)previous.focus({preventScroll:true});});};
 },[]);
 return createPortal(<div ref={host} className={`chore-dialog-backdrop${size==='confirm'?' chore-dialog-backdrop-confirm':''}`} style={{'--dialog-viewport-height':'100dvh'} as CSSProperties}><div className={`chore-dialog${size==='form'?' chore-dialog-form':size==='confirm'?' chore-dialog-confirm':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={box}>
  <header className="chore-dialog-header"><h2>{title}</h2><button type="button" onClick={onClose} disabled={busy} className="touch-button" aria-label="Close dialog">✕</button></header>
  {children != null && <div className="chore-dialog-body">{children}</div>}{footer&&<footer className="chore-dialog-footer">{footer}</footer>}
 </div></div>,document.body);
}

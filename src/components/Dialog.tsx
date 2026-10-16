import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
let dialogCount=0;
let restorePage=()=>{};
interface Props { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean; suspended?: boolean; returnFocus?: HTMLElement | null; }
export function Dialog({title, onClose, children, footer, busy=false, suspended=false, returnFocus}: Props) {
 const box=useRef<HTMLDivElement>(null); const close=useRef(onClose); close.current=onClose;
 useLayoutEffect(()=>{if(box.current)box.current.inert=suspended;},[suspended]);
 const working=useRef(busy); working.current=busy;
 useEffect(()=>{
  const previous=returnFocus ?? document.activeElement as HTMLElement | null;
  const root=document.getElementById('root'); const oldInert=root?.inert || false;
  const oldOverflow=document.body.style.overflow;
  if(dialogCount++===0){
   if(root)root.inert=true;
   document.body.style.overflow='hidden';
   restorePage=()=>{document.body.style.overflow=oldOverflow;if(root)root.inert=oldInert;previous?.focus();};
  }
  (box.current?.querySelector<HTMLElement>('[data-dialog-autofocus]')||box.current)?.focus();
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
  return ()=>{document.removeEventListener('keydown',onKey,true);if(--dialogCount===0)restorePage();else queueMicrotask(()=>{if(previous?.isConnected)previous.focus();});};
 },[]);
 return createPortal(<div className="chore-dialog-backdrop"><div className="chore-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={box}>
  <header className="chore-dialog-header"><h2>{title}</h2><button type="button" onClick={onClose} disabled={busy} className="touch-button" aria-label="Close dialog">✕</button></header>
  <div className="chore-dialog-body">{children}</div>{footer&&<footer className="chore-dialog-footer">{footer}</footer>}
 </div></div>,document.body);
}

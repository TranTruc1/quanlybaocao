import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {ActionButton,useOperations} from './Operations.jsx';
const stack=[];let originalOverflow='',originalPadding='';
export default function Modal({title,onClose,children,className='','aria-label':label}){
 const dialog=useRef(null),close=useRef(onClose),operations=useOperations(),pending=useRef(false);close.current=onClose;pending.current=operations.pending;
 useEffect(()=>{
  const node=dialog.current,previous=document.activeElement;if(!node)return;
  if(!stack.length){originalOverflow=document.body.style.overflow;originalPadding=document.body.style.paddingRight;const gap=window.innerWidth-document.documentElement.clientWidth;if(gap>0)document.body.style.paddingRight=gap+'px';document.body.style.overflow='hidden';}
  stack.push(node);const focusable=()=>[...node.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
  (focusable().find(el=>el.matches('input:not([type="checkbox"]),textarea'))||focusable()[0]||node).focus({preventScroll:true});
  function key(e){if(stack.at(-1)!==node||e.defaultPrevented||e.target.closest?.('.date-popover,.report-date-menu'))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!pending.current)close.current?.();}if(e.key==='Tab'){const items=focusable(),first=items[0],last=items.at(-1);if(!items.length){e.preventDefault();node.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);const i=stack.indexOf(node);if(i!==-1)stack.splice(i,1);if(!stack.length){document.body.style.overflow=originalOverflow;document.body.style.paddingRight=originalPadding;}if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 const body=<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pending.current)close.current?.();}}><section ref={dialog} tabIndex={-1} className={'modal '+className} role="dialog" aria-modal="true" aria-label={label||title}>{title&&<div className="modal-heading"><h2>{title}</h2><ActionButton type="button" className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={20}/></ActionButton></div>}{children}</section></div>;
 return typeof document==='undefined'?body:createPortal(body,document.body);
}

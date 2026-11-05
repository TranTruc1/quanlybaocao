import React,{useState,useRef,useEffect} from 'react';
import {parseNumberText,groupedNumberText} from './numbers.js';
export default function NumberField({value,onChange,onFocus,onBlur,type,step,min,max,required,inputMode,...props}){
 const decimals=String(step||'1').includes('.')?String(step).split('.')[1].length:0;
 const canonical=value===''||value==null?'':String(value);
 const [draft,setDraft]=useState(canonical),[focused,setFocused]=useState(false);
 const ref=useRef(null);
 useEffect(()=>{if(!focused)setDraft(canonical);},[canonical,focused]);
 const displayed=groupedNumberText(focused?draft:(canonical!==''&&decimals?Number(canonical).toFixed(decimals):canonical));
 useEffect(()=>{if(!ref.current)return;let error='';const n=Number(draft);if(draft!==''&&(!Number.isFinite(n)||(min!==undefined&&n<Number(min))||(max!==undefined&&n>Number(max))))error='Số nhập chưa nằm trong khoảng cho phép.';ref.current.setCustomValidity(error);},[draft,min,max]);
 function change(e){
  const normalized=parseNumberText(e.target.value,decimals);if(normalized===null)return;
  const before=e.target.value.slice(0,e.target.selectionStart||0),digits=(before.match(/\d/g)||[]).length;
  setDraft(normalized);onChange?.({target:{value:normalized}});
  requestAnimationFrame(()=>{const node=ref.current;if(!node||document.activeElement!==node)return;const formatted=node.value;let position=formatted.length,seen=0;for(let i=0;i<formatted.length;i++)if(/\d/.test(formatted[i])&&++seen===digits){position=i+1;break;}if(before.endsWith(',')&&formatted.includes(','))position=formatted.indexOf(',')+1;node.setSelectionRange(position,position);});
 }
 return <input {...props} ref={ref} type="text" inputMode={decimals?'decimal':'numeric'} required={required} value={displayed} onChange={change} onFocus={e=>{setDraft(canonical);setFocused(true);onFocus?.(e);}} onBlur={e=>{setFocused(false);onBlur?.(e);}}/>;
}

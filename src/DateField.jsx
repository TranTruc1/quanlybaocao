import React,{useState,useRef,useEffect,useId} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {dayString} from './domain.js';
const months=Array.from({length:12},(_,i)=>'Tháng '+(i+1));
export default function DateField({type='date',value='',onChange,min,max,markedDates=[],disabled,required,'aria-label':label,...rest}){
 const [open,setOpen]=useState(false),[cursor,setCursor]=useState((value||dayString()).slice(0,7));
 const ref=useRef(null),trigger=useRef(null),id=useId();
 const [position,setPosition]=useState({top:0,left:0});
 const marked=new Set(markedDates);
 const monthMode=type==='month';
 const y=Number(cursor.slice(0,4)),m=Number(cursor.slice(5,7));
 const format=monthMode?(value?'Tháng '+Number(value.slice(5))+' / '+value.slice(0,4):'Chọn tháng'):(value?value.split('-').reverse().join(' / '):'Chọn ngày');
 const accessible=label||(monthMode?'Chọn tháng':'Chọn ngày');
 function close(){setOpen(false);trigger.current?.focus();}
 function pick(v){if((min&&v<min)||(max&&v>max))return;onChange?.({target:{value:v}});close();}
 useEffect(()=>{if(!open)return;
  function outside(e){if(!ref.current?.contains(e.target))setOpen(false);}
  function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}
  function dismiss(){setOpen(false);}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',dismiss);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',dismiss);};
 },[open]);
 const changeMonth=delta=>{const date=new Date(Date.UTC(y,m-1+delta,1));setCursor(date.toISOString().slice(0,7));};
 function toggle(){if(!open){const b=trigger.current.getBoundingClientRect();const width=Math.min(320,window.innerWidth-24);const height=monthMode?285:390;setPosition({left:Math.max(12,Math.min(b.left,window.innerWidth-width-12)),top:Math.max(12,b.bottom+height>window.innerHeight?b.top-height-8:b.bottom+8)});setCursor((value||dayString()).slice(0,7));}setOpen(!open);}
 const first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;
 const count=new Date(Date.UTC(y,m,0)).getUTCDate();
 return <span className="date-control" ref={ref}>
  <button {...rest} ref={trigger} type="button" className="date-trigger" disabled={disabled} aria-label={accessible+': '+format} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={toggle}><CalendarDays size={18}/><span>{format}</span>{!monthMode&&marked.has(value)&&<i className="calendar-missing-dot" aria-label="Chưa gửi báo cáo"/>}</button>
  {open&&<section id={id} className="date-popover" role="dialog" aria-label={monthMode?'Lịch chọn tháng':'Lịch chọn ngày'} style={position}>
   <div className="calendar-heading"><span>{monthMode?'Chọn tháng':'Chọn ngày'}</span><button type="button" aria-label="Đóng lịch" onClick={close}><X size={17}/></button></div>
   <div className="calendar-navigation"><button type="button" aria-label={monthMode?'Năm trước':'Tháng trước'} onClick={()=>changeMonth(monthMode?-12:-1)}><ChevronLeft size={18}/></button>
    {!monthMode&&<select aria-label="Tháng trong lịch" value={m} onChange={e=>setCursor(y+'-'+String(e.target.value).padStart(2,'0'))}>{months.map((t,i)=><option key={i} value={i+1}>{t}</option>)}</select>}
    <select aria-label="Năm trong lịch" value={y} onChange={e=>setCursor(e.target.value+'-'+String(m).padStart(2,'0'))}>{Array.from({length:21},(_,i)=>Number(dayString().slice(0,4))-10+i).concat(y).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b).map(v=><option key={v} value={v}>{v}</option>)}</select>
    <button type="button" aria-label={monthMode?'Năm sau':'Tháng sau'} onClick={()=>changeMonth(monthMode?12:1)}><ChevronRight size={18}/></button>
   </div>
   {monthMode?<div className="month-grid">{months.map((text,i)=>{const v=y+'-'+String(i+1).padStart(2,'0');return <button key={v} type="button" disabled={(min&&v<min)||(max&&v>max)} className={v===value?'chosen':''} onClick={()=>pick(v)}>{text}</button>;})}</div>:<><div className="calendar-week">{['T2','T3','T4','T5','T6','T7','CN'].map(t=><span key={t}>{t}</span>)}</div><div className="calendar-days">{Array.from({length:first},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>{const v=cursor+'-'+String(i+1).padStart(2,'0');return <button type="button" key={v} aria-label={v.split('-').reverse().join('/')+(marked.has(v)?' — Chưa gửi báo cáo':'')} aria-pressed={v===value} disabled={(min&&v<min)||(max&&v>max)} className={(v===value?'chosen ':'')+(v===dayString()?'today':'')} onClick={()=>pick(v)}>{i+1}{marked.has(v)&&<i className="calendar-missing-dot" aria-hidden="true"/>}</button>;})}</div></>}
   <>{!monthMode&&marked.size>0&&<div className="calendar-legend"><i className="calendar-missing-dot"/> Chưa gửi báo cáo</div>}</><div className="calendar-footer"><button type="button" onClick={()=>pick(monthMode?dayString().slice(0,7):dayString())}>{monthMode?'Tháng hiện tại':'Hôm nay'}</button><span>{monthMode?'Tháng / Năm':'Ngày / Tháng / Năm'}</span></div>
  </section>}
 </span>;
}

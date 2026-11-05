import DragScroll from './DragScroll.jsx';
import React,{useEffect,useState} from 'react';
import {X,History} from 'lucide-react';
import {useDataWindow} from './DataWindow.jsx';
import {fields,money,countFormat} from './domain.js';
import {ActionButton} from './Operations.jsx';
const labels=[['received','Tiền mới nhận'],['carryover','Dư chuyển sang'],...fields];
const time=v=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'}).format(new Date(v));
export default function ReportHistory({db,report,onClose}){
 useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
 const data=useDataWindow(),[audit,setAudit]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[nextOffset,setNextOffset]=useState(null),[moreBusy,setMoreBusy]=useState(false);
 useEffect(()=>{let cancelled=false;setAudit(null);setError('');data.history(report.id).then(r=>{if(!cancelled){setAudit(r.audit);setNextOffset(r.nextOffset??null);}}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[report.id,attempt]);
 const logs=(audit||[]).filter(a=>a.details?.reportId===report.id).sort((a,b)=>b.time.localeCompare(a.time));
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal history-modal" role="dialog" aria-modal="true" aria-label="Lịch sử sửa bảng"><div className="modal-heading"><div><h2>Lịch sử sửa bảng</h2><p>{db.accounts.find(a=>a.id===report.accountId)?.ownerName} · {report.date.split('-').reverse().join('/')}</p></div><ActionButton className="icon-btn" aria-label="Đóng lịch sử" onClick={onClose}><X size={20}/></ActionButton></div>
 {error?<div className="empty"><p>{error}</p><button className="btn" onClick={()=>setAttempt(attempt+1)}>Thử lại</button></div>:audit===null?<div className="empty" role="status"><p>Đang tải lịch sử sửa…</p></div>:!logs.length?<div className="empty"><History/><p>Chưa có lịch sử chi tiết. Các lần lưu từ bản cập nhật này sẽ được ghi lại.</p></div>:logs.map(log=>{
  const before=log.details.before,after=log.details.after;
  const ids=[...new Set([...(before?.entries||[]),...(after?.entries||[])].map(e=>e.productId))];
  const changes=ids.flatMap(id=>labels.flatMap(([key,label])=>{const old=before?.entries?.find(e=>e.productId===id)?.[key],next=after?.entries?.find(e=>e.productId===id)?.[key];return old===next?[]:[{id,key,label,old,next}];}));
  return <article className="history-entry" key={log.id}><div className="history-meta"><b>{db.accounts.find(a=>a.id===log.actorId)?.ownerName||log.actorId}</b><time>{time(log.time)}</time></div><p>{!before?'Tạo bảng':log.action==='carryoverRecomputed'?'Tự cập nhật dư chuyển sang':'Chỉnh sửa bảng'} · Phiên bản {after?.revision||'—'}</p>
  {before?.date!==after?.date&&<p>Ngày: {before?.date||'—'} → {after?.date||'—'}</p>}{before?.status!==after?.status&&<p>Trạng thái: {before?.status||'—'} → {after?.status||'—'}</p>}
  {changes.length>0?<DragScroll aria-label="Bảng báo cáo, giữ chuột trái và kéo để xem ngang"><table><thead><tr><th>Sản phẩm / Trường</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{changes.map(c=><tr key={c.id+c.key}><td>{db.products.find(p=>p.id===c.id)?.name||c.id}<small>{c.label}</small></td><td>{c.old===undefined?'—':['success','upsale'].includes(c.key)?countFormat(c.old):money(c.old)}</td><td>{c.next===undefined?'—':['success','upsale'].includes(c.key)?countFormat(c.next):money(c.next)}</td></tr>)}</tbody></table></DragScroll>:<p className="muted">Không đổi các trường số liệu.</p>}
  </article>;
 })}{nextOffset!==null&&audit&&<button type="button" className="btn" disabled={moreBusy} onClick={async()=>{setMoreBusy(true);try{const r=await data.history(report.id,nextOffset);setAudit(old=>[...new Map([...old,...r.audit].map(x=>[x.id,x])).values()]);setNextOffset(r.nextOffset??null);}catch(e){setError(e.message);}finally{setMoreBusy(false);}}}>{moreBusy?'Đang tải…':'Tải thêm lịch sử'}</button>}</section></div>;
}

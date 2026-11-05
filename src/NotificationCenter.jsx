import React,{useEffect,useRef,useState} from 'react';
import {Bell,X} from 'lucide-react';
import {ActionButton} from './Operations.jsx';
import {useWorkspaceState} from './WorkspaceState.jsx';
import {postTime} from './order-display.js';
export default function NotificationCenter({feed,onAck,onMore,onOpen}){
 const [open,setOpen]=useState(false),[popup,setPopup]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [seen,setSeen]=useWorkspaceState('notifications.announced',[]),acknowledging=useRef(new Set());
 const items=feed?.items||[];
 useEffect(()=>{
  const fresh=items.filter(n=>!n.announcedAt&&!seen.includes(n.id));
  if(fresh.length){setPopup(old=>[...old,...fresh.filter(n=>!old.some(x=>x.id===n.id))]);setSeen(old=>[...new Set([...old,...fresh.map(n=>n.id)])].slice(-2000));}
  const pending=items.filter(n=>!n.announcedAt&&!acknowledging.current.has(n.id));
  if(pending.length){pending.forEach(n=>acknowledging.current.add(n.id));onAck(pending.map(n=>n.id),{announced:true}).catch(()=>{pending.forEach(n=>acknowledging.current.delete(n.id));});}
 },[feed]);
 async function visit(n){setOpen(false);setPopup([]);try{await onAck([n.id],{read:true,announced:true});}catch{}onOpen(n);}
 async function readAll(){setBusy(true);setError('');try{for(let offset=0;offset<items.length;offset+=100){const ids=items.slice(offset,offset+100).filter(n=>!n.readAt).map(n=>n.id);if(ids.length)await onAck(ids,{read:true,announced:true});}}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <><ActionButton className="icon-btn notification-bell" aria-label={'Thông báo'+(feed?.unreadCount?' · '+feed.unreadCount+' chưa đọc':'')} onClick={()=>{setOpen(true);setPopup([]);}}><Bell size={20}/>{feed?.unreadCount>0&&<span className="notification-count">{feed.unreadCount>99?'99+':feed.unreadCount}</span>}</ActionButton>
 {popup.length>0&&!open&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Có cập nhật mới"><div className="modal-heading"><h2>Có {popup.length} cập nhật mới</h2><button className="icon-btn" aria-label="Đóng thông báo mới" onClick={()=>setPopup([])}><X size={20}/></button></div><p>Những thay đổi liên quan đến tài khoản của bạn kể từ lần xem trước.</p><div className="notification-list">{popup.slice(0,5).map(n=><button className="notification-item unread" key={n.id} onClick={()=>visit(n)}><b>{n.title}</b><small>{postTime(n.createdAt)}</small></button>)}</div><div className="modal-actions"><button className="btn primary" onClick={()=>{setPopup([]);setOpen(true);}}>Xem lịch sử thông báo</button></div></section></div>}
 {open&&<div className="modal-backdrop"><section className="modal notification-modal" role="dialog" aria-modal="true" aria-label="Lịch sử thông báo"><div className="modal-heading"><div><h2>Thông báo</h2><p>{feed?.unreadCount||0} chưa đọc · Mới nhất trước</p></div><button className="icon-btn" aria-label="Đóng lịch sử thông báo" onClick={()=>setOpen(false)}><X size={20}/></button></div><button className="btn" disabled={busy} onClick={readAll}>Đánh dấu các thông báo đã tải là đã đọc</button>{error&&<p role="alert" className="error-text">{error}</p>}<div className="notification-list">{items.map(n=><button key={n.id} className={'notification-item '+(!n.readAt?'unread':'')} onClick={()=>visit(n)}><b>{n.title}</b><small>{postTime(n.createdAt)}{n.deleted?' · Đã xóa':''}</small><span>Mở vị trí thay đổi →</span></button>)}{!items.length&&<p className="muted">Chưa có thông báo.</p>}</div>{feed?.nextOffset!=null&&<button className="btn" disabled={busy} onClick={async()=>{setBusy(true);try{await onMore(feed.nextOffset);}catch(e){setError(e.message);}finally{setBusy(false);}}}>Tải thêm thông báo</button>}</section></div>}
 </>;
}

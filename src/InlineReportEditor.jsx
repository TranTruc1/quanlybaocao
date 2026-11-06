import StickyTableHead from './StickyTableHead.jsx';
import DragScroll from './DragScroll.jsx';
import BudgetTransfers from './BudgetTransfers.jsx';
import React,{useState,useEffect} from 'react';
import {Save,Undo2,Pencil,FileText,CalendarDays} from 'lucide-react';
import NumberField from './NumberField.jsx';
import {useWorkspaceState} from './WorkspaceState.jsx';
import {ActionButton,ActionForm} from './Operations.jsx';
import {money,pct,countFormat} from './domain.js';
import {productTone} from './palette.js';
import {containsRange} from './data-window.js';
import {reportPolicy} from './report-policy.js';
import {reportEditorModel,reportEditorPayload} from './report-editor.js';
const metrics=[['funding','Tiền mới nhận / ngân sách cũ','edit'],['carryover','Dư chuyển sang'],['transferIn','Nhận từ sản phẩm khác'],['transferOut','Chuyển sang sản phẩm khác'],['budget','Ngân sách khả dụng'],
 ['remaining','Thừa cuối ngày','edit'],['spend','Tổng ngân sách đã chi'],['data','Tổng data','edit'],['costPerData','Chi phí mess'],
 ['tt','Data tt','edit'],['ktt','Data ktt'],['success','Đơn bán hàng','count'],['revenue','Doanh số bán hàng'],['upsale','Đơn Upsale','count'],['upsaleRevenue','Doanh số Upsale'],['careOnlyCount','Đơn chăm sóc','count'],['careOnlyRevenue','Doanh số chăm sóc'],
 ['orderCount','Tổng đơn','count'],['totalRevenue','Tổng doanh số'],['appointments','Đơn hẹn','count'],['late','Rep chậm','edit'],['costRatio','Tỷ lệ chi phí/DS','percent'],['goal','Mục tiêu doanh thu'],['achieved','Đạt mục tiêu','percent']];
const field=(entry,key)=>key==='funding'?(entry.received!==undefined?'received':'budget'):key;
const amount=(entry,key)=>Number(entry[field(entry,key)]||0);
export default function InlineReportEditor({db,record,user,product='all',mutate,notify,onDirtyChange,onHistory,docked=true}){
 const [cached,setCached,cacheMeta]=useWorkspaceState('inline.'+record.id,null);
 const dirty=Array.isArray(cached?.entries),draft=dirty?cached.entries:record.entries,revision=dirty?cached.revision:record.revision;
 const conflict=dirty&&Number(revision)!==Number(record.revision);
 const [editing,setEditing]=useState(null),[saving,setSaving]=useState(false);
 const transfers=cached?.transfers??record.transfers??[];
 const setDraft=entries=>setCached({entries,transfers,revision});
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{const fn=e=>{if(dirty&&!cacheMeta.persisted){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn);},[dirty,cacheMeta.persisted]);
 const policy=reportPolicy(db.reports,record.accountId),blocked=user.role!=='admin'&&!(db.reportrequests||[]).some(r=>r.accountId===record.accountId&&r.date===record.date&&r.status==='pending')&&(record.date<policy.start||record.date>policy.to||(containsRange(db.scope,[policy.from,policy.to])&&record.date>policy.nextDate));
 let budgetError='',model;try{model=reportEditorModel(db,record,draft,transfers);}catch(e){budgetError=e.message;model={entries:draft};}
 const visible=model.entries.filter(e=>product==='all'||e.productId===product);
 const editable=(e,key)=>!blocked&&!saving&&(user.role==='admin'||(db.products.some(p=>p.id===e.productId&&p.active)&&db.assignments.some(a=>a.accountId===record.accountId&&a.productId===e.productId&&a.active)))&&(key!=='funding'||e.received!==undefined||e.budget!==undefined);
 function reset(){cacheMeta.clear();setEditing(null);}
 async function save(status='submitted'){if(budgetError){notify(budgetError,'error');return;}if(conflict||saving||(!dirty&&record.status==='submitted')||blocked)return;let payload;try{payload=reportEditorPayload(db,record,draft,revision,transfers);payload.status=status;}catch(e){notify(e.message,'error');return;}setSaving(true);try{if(await mutate('saveReport',payload)){cacheMeta.clear();setEditing(null);notify(status==='submitted'&&record.status!=='submitted'?'Đã gửi báo cáo.':'Đã lưu thay đổi báo cáo.');}}finally{setSaving(false);}}
 return <section className="panel product-summary inline-report-editor"><ActionForm onSubmit={e=>{e.preventDefault();void save();}}><div className="panel-heading"><div><h2>Chi tiết theo sản phẩm</h2><p>{record.date.split('-').reverse().join('/')} · {record.status==='submitted'?'Đã gửi':'Chưa gửi'}</p></div></div>
{budgetError&&<p role="alert" className="error-text">{budgetError}</p>}<DragScroll aria-label="Bảng báo cáo, giữ chuột trái và kéo để xem ngang"><table style={{minWidth:Math.max(600,(visible.length+2)*155)}}><StickyTableHead><tr><th><span className="report-edit-date"><CalendarDays size={16}/><span>Ngày báo cáo<br/>{record.date.split("-").reverse().join("/")}</span></span></th>{visible.map(e=><th key={e.productId} style={{background:productTone(e.productId).color,color:'#fff'}}>{db.products.find(p=>p.id===e.productId)?.name||e.productId}</th>)}<th className="summary-total">Tổng SP</th></tr></StickyTableHead><tbody>{metrics.map(([key,label,format])=><tr key={key}><th scope="row">{label}</th>{visible.map(e=>{
  const id=e.productId+'|'+key,canEdit=format==='edit'&&editable(e,key),value=amount(e,key);
  return <td key={e.productId} style={{background:productTone(e.productId).background,color:productTone(e.productId).text}}>{canEdit?(editing===id?<NumberField autoFocus aria-label={label+' — '+(db.products.find(p=>p.id===e.productId)?.name||'Sản phẩm')} min={0} step="1" value={value} onFocus={ev=>ev.target.select()} onBlur={()=>setEditing(null)} onChange={ev=>{setDraft(draft.map(x=>x.productId===e.productId?{...x,[field(x,key)]:Number(ev.target.value||0)}:x));}}/>:<ActionButton type="button" className="editable-report-cell" aria-label={'Sửa '+label+' — '+(db.products.find(p=>p.id===e.productId)?.name||'Sản phẩm')} onClick={()=>setEditing(id)}>{money(value)}<Pencil size={12}/></ActionButton>):format==='percent'?pct(value):format==='count'?countFormat(value):money(value)}{key==='carryover'&&user.role==='user'&&<BudgetTransfers db={db} accountId={record.accountId} date={record.date} entries={draft} value={transfers} sourceProductId={e.productId} disabled={blocked||saving} onChange={value=>setCached({entries:draft,transfers:value,revision})}/>}</td>;
 })}<td className="summary-total">{(()=>{const sums=visible.reduce((n,e)=>n+amount(e,key),0),spend=visible.reduce((n,e)=>n+e.spend,0),data=visible.reduce((n,e)=>n+Number(e.data||0),0),revenue=visible.reduce((n,e)=>n+e.revenue+(e.care||0),0),salesRevenue=visible.reduce((n,e)=>n+e.revenue,0);return format==='percent'?pct(key==='achieved'?(visible.reduce((n,e)=>n+e.goal,0)?salesRevenue/visible.reduce((n,e)=>n+e.goal,0):0):(revenue?spend/revenue:0)):key==='costPerData'?money(data?spend/data:0):format==='count'?countFormat(sums):money(sums);})()}</td></tr>)}</tbody></table></DragScroll>
 {(dirty&&!cacheMeta.persisted||conflict||blocked)&&<div className="table-note" role="status">{!cacheMeta.persisted?'Trình duyệt không giữ được bản nhập. Hãy lưu trước khi tải lại.':conflict?'Báo cáo đã có phiên bản mới. Hủy thay đổi để tải lại.':'Ngày này cần yêu cầu mở sửa hoặc hoàn tất báo cáo trước đó.'}</div>}<div className={"inline-save-dock"+(!docked?" report-local-actions":"")}><span>{dirty?'Có thay đổi chưa lưu':'Báo cáo đã đồng bộ'}</span><div>{user.role==='admin'&&docked&&<span id="report-management-actions"/>}{onHistory&&<ActionButton type="button" className="btn" onClick={onHistory}><FileText size={16}/> Lịch sử sửa</ActionButton>}<ActionButton type="button" className="btn" disabled={!dirty||saving} onClick={reset}><Undo2 size={16}/> Hủy thay đổi</ActionButton><ActionButton type="button" className="btn primary" disabled={(!dirty&&record.status==='submitted')||saving||blocked||conflict||!!budgetError} onClick={()=>save()}><Save size={16}/>{saving?'Đang lưu…':'Lưu thay đổi'}</ActionButton></div></div></ActionForm></section>;
}

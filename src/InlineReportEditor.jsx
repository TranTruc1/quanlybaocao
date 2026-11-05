import React,{useState,useEffect} from 'react';
import {Save,Undo2,Pencil} from 'lucide-react';
import NumberField from './NumberField.jsx';
import {ActionButton,ActionForm} from './Operations.jsx';
import {money,pct,countFormat} from './domain.js';
import {productTone} from './palette.js';
import {containsRange} from './data-window.js';
import {reportPolicy} from './report-policy.js';
import {reportEditorModel,reportEditorPayload} from './report-editor.js';
const metrics=[['funding','Tiền mới nhận / ngân sách cũ','edit'],['carryover','Dư chuyển sang'],['budget','Ngân sách khả dụng'],
 ['remaining','Thừa cuối ngày','edit'],['spend','Tổng ngân sách đã chi'],['data','Tổng data','edit'],['costPerData','Chi phí mess'],
 ['tt','Data tt','edit'],['ktt','Data ktt','edit'],['success','Đơn TC','count'],['upsale','Upsale','count'],['careOrderCount','Đơn chăm','count'],
 ['orderCount','Tổng đơn quy đổi','count'],['appointments','Đơn hẹn','edit'],['late','Rep chậm','edit'],['revenue','Doanh số bán hàng'],['care','Doanh thu chăm'],['costRatio','Tỷ lệ chi phí/DS','percent'],['goal','Mục tiêu doanh thu'],['achieved','Đạt mục tiêu','percent']];
const field=(entry,key)=>key==='funding'?(entry.received!==undefined?'received':'budget'):key;
const amount=(entry,key)=>Number(entry[field(entry,key)]||0);
export default function InlineReportEditor({db,record,user,product='all',mutate,notify,onDirtyChange}){
 const [draft,setDraft]=useState(()=>structuredClone(record.entries)),[revision,setRevision]=useState(record.revision),[dirty,setDirty]=useState(false),[editing,setEditing]=useState(null),[saving,setSaving]=useState(false);
 useEffect(()=>{if(!dirty){setDraft(structuredClone(record.entries));setRevision(record.revision);}},[record.revision,dirty]);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{const fn=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn);},[dirty]);
 const policy=reportPolicy(db.reports,record.accountId),blocked=user.role!=='admin'&&(record.date<policy.start||record.date>policy.to||(containsRange(db.scope,[policy.from,policy.to])&&record.date>policy.nextDate));
 const model=reportEditorModel(db,record,draft),visible=model.entries.filter(e=>product==='all'||e.productId===product);
 const editable=(e,key)=>!blocked&&!saving&&(user.role==='admin'||(db.products.some(p=>p.id===e.productId&&p.active)&&db.assignments.some(a=>a.accountId===record.accountId&&a.productId===e.productId&&a.active)))&&(key!=='funding'||e.received!==undefined||e.budget!==undefined);
 function reset(){setDraft(structuredClone(record.entries));setRevision(record.revision);setDirty(false);setEditing(null);}
 async function save(status='submitted'){if(saving||(!dirty&&record.status==='submitted')||blocked)return;let payload;try{payload=reportEditorPayload(db,record,draft,revision);payload.status=status;}catch(e){notify(e.message,'error');return;}setSaving(true);try{if(await mutate('saveReport',payload)){setDirty(false);setEditing(null);notify(status==='submitted'&&record.status!=='submitted'?'Đã gửi báo cáo.':'Đã lưu thay đổi báo cáo.');}}finally{setSaving(false);}}
 return <section className="panel product-summary inline-report-editor"><ActionForm onSubmit={e=>{e.preventDefault();void save();}}><div className="panel-heading"><div><h2>Chi tiết theo sản phẩm</h2><p>{record.date.split('-').reverse().join('/')} · {record.status==='submitted'?'Đã gửi':'Chưa gửi'} · Phiên bản {revision}</p></div><div className="inline-editor-actions"><ActionButton type="button" className="btn" disabled={!dirty||saving} onClick={reset}><Undo2 size={16}/> Hủy thay đổi</ActionButton><ActionButton className="btn primary" disabled={(!dirty&&record.status==='submitted')||saving||blocked}><Save size={16}/>{saving?'Đang lưu…':record.status==='submitted'?'Lưu thay đổi':'Gửi báo cáo'}</ActionButton></div></div>
 <div className="table-scroll"><table><thead><tr><th>Chỉ tiêu</th>{visible.map(e=><th key={e.productId} style={{background:productTone(e.productId).color,color:'#fff'}}>{db.products.find(p=>p.id===e.productId)?.name||e.productId}</th>)}<th className="summary-total">Tổng SP</th></tr></thead><tbody>{metrics.map(([key,label,format])=><tr key={key}><th scope="row">{label}</th>{visible.map(e=>{
  const id=e.productId+'|'+key,canEdit=format==='edit'&&editable(e,key),value=amount(e,key);
  return <td key={e.productId} style={{background:productTone(e.productId).background,color:productTone(e.productId).text}}>{canEdit?(editing===id?<NumberField autoFocus aria-label={label+' — '+(db.products.find(p=>p.id===e.productId)?.name||'Sản phẩm')} min={0} step="1" value={value} onFocus={ev=>ev.target.select()} onBlur={()=>setEditing(null)} onChange={ev=>{setDraft(draft.map(x=>x.productId===e.productId?{...x,[field(x,key)]:Number(ev.target.value||0)}:x));setDirty(true);}}/>:<ActionButton type="button" className="editable-report-cell" aria-label={'Sửa '+label+' — '+(db.products.find(p=>p.id===e.productId)?.name||'Sản phẩm')} onClick={()=>setEditing(id)}>{money(value)}<Pencil size={12}/></ActionButton>):format==='percent'?pct(value):format==='count'?countFormat(value):money(value)}</td>;
 })}<td className="summary-total">{(()=>{const sums=visible.reduce((n,e)=>n+amount(e,key),0),spend=visible.reduce((n,e)=>n+e.spend,0),data=visible.reduce((n,e)=>n+Number(e.data||0),0),revenue=visible.reduce((n,e)=>n+e.revenue,0);return format==='percent'?pct(key==='achieved'?(visible.reduce((n,e)=>n+e.goal,0)?revenue/visible.reduce((n,e)=>n+e.goal,0):0):(revenue?spend/revenue:0)):key==='costPerData'?money(data?spend/data:0):format==='count'?countFormat(sums):money(sums);})()}</td></tr>)}</tbody></table></div>
 <div className="table-note"><span>{blocked?'Báo cáo này chưa đủ điều kiện chỉnh sửa theo quy tắc nhập tuần tự 7 ngày.':dirty?'Có thay đổi chưa lưu. Bấm Lưu thay đổi để cập nhật.':'Bấm vào ô có biểu tượng bút để sửa, sau đó Lưu thay đổi.'}</span><span>Ngân sách khả dụng, chi phí mess và tỷ lệ tự tính. Số đơn và doanh thu lấy từ mục Đơn hàng. Bảng cũ không có “Tiền mới nhận” sẽ sửa ngân sách đầu ngày. Dữ liệu sản phẩm đang ẩn bởi bộ lọc được giữ nguyên.</span></div></ActionForm></section>;
}

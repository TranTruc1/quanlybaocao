import React,{useEffect,useState} from 'react';
import {ArrowLeft,Save,Undo2,FileText,ChevronLeft,ChevronRight} from 'lucide-react';
import {ActionButton,ActionForm} from './Operations.jsx';
import {useWorkspaceState} from './WorkspaceState.jsx';
import WindowGate from './DataWindow.jsx';
import DragScroll from './DragScroll.jsx';
import NumberField from './NumberField.jsx';
import DateField from './DateField.jsx';
import BudgetTransfers from './BudgetTransfers.jsx';
import ReportHistory from './ReportHistory.jsx';
import {DeleteReport} from './ReportManagement.jsx';
import {reportEditorModel,reportEditorPayload} from './report-editor.js';
import {reportPolicy} from './report-policy.js';
import {fields,previousDay,money,pct,countFormat,productSummary} from './domain.js';
import {accountLabel,saleSummary,isEmployee} from './roles.js';
import {productTone} from './palette.js';
import {monthWeeks,weekForDate} from './report-week.js';
const dateLabel=date=>date.split('-').reverse().join('/');
const mktMetrics=[['funding','Tiền mới nhận / ngân sách cũ','input'],['carryover','Dư chuyển sang'],['transferIn','Nhận từ sản phẩm khác'],['transferOut','Chuyển sang sản phẩm khác'],['budget','Ngân sách khả dụng'],['remaining','Thừa cuối ngày','input'],['spend','Tổng ngân sách đã chi'],['data','Tổng data','input'],['costPerData','Chi phí mess'],['tt','Data tt','input'],['ktt','Data ktt'],['success','Đơn bán hàng','count'],['revenue','Doanh số bán hàng'],['upsale','Đơn Upsale','count'],['upsaleRevenue','Doanh số Upsale'],['careOnlyCount','Đơn chăm sóc','count'],['careOnlyRevenue','Doanh số chăm sóc'],['orderCount','Tổng đơn','count'],['appointments','Đơn hẹn','input'],['late','Rep chậm','input'],['costRatio','Tỷ lệ chi phí/DS','percent'],['goal','Mục tiêu doanh thu'],['achieved','Đạt mục tiêu','percent']];
const saleMetrics=[['data','Tổng data','input'],['tt','Data tương tác','input'],['ktt','Data ktt'],['saleCount','Đơn bán hàng','count'],['upsaleCount','Đơn Upsale','count'],['careCount','Đơn chăm sóc','count'],['orders','Tổng đơn','count'],['revenue','Doanh số'],['conversion','Tỉ lệ chốt','percent']];
const valueOf=(row,key)=>key==='funding'?Number(row.received??row.budget??0):key==='goal'?Number(row.goal||0)+Number(row.careGoal||0):Number(row[key]||0);
const format=(value,type)=>type==='percent'?pct(value):type==='count'?countFormat(value):money(value);
function totalValue(rows,key){
 const sum=k=>rows.reduce((n,row)=>n+valueOf(row,k),0);
 if(key==='costPerData')return sum('data')?sum('spend')/sum('data'):0;
 if(key==='costRatio')return sum('revenue')+sum('care')?sum('spend')/(sum('revenue')+sum('care')):0;
 if(key==='achieved')return sum('goal')?(sum('revenue')+sum('care'))/sum('goal'):0;
 if(key==='conversion')return sum('data')?sum('orders')/sum('data'):0;
 return sum(key);
}
export default function WeeklyEntry({db,user,initial,mutate,notify,onBack,onRouteChange,dirtyRef}){
 const account=initial?.accountId||user.id,initialDate=initial?.date||previousDay(),sale=db.accounts.find(a=>a.id===account)?.role==='sale';
 const [selection,setSelection]=useWorkspaceState('weekly.selection.'+account+'.'+(initial?.date||'latest'),{month:initialDate.slice(0,7),start:weekForDate(initialDate)[0]});
 const weeks=monthWeeks(selection.month),days=weeks.find(w=>w[0]===selection.start)||weeks[0],weekIndex=weeks.indexOf(days);
 const [drafts,setDrafts,draftsMeta]=useWorkspaceState('weekly.drafts.'+account+'.'+days[0],{}),[history,setHistory]=useState(null);
 const dirty=Object.keys(drafts).length>0;
 useEffect(()=>{if(dirtyRef)dirtyRef.current=dirty;return()=>{if(dirtyRef)dirtyRef.current=false;};},[dirty,dirtyRef]);
 useEffect(()=>{const guard=e=>{if(dirty&&!draftsMeta.persisted){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,draftsMeta.persisted]);
 const policy=reportPolicy(db.reports,account),range=[days[0]<policy.from?days[0]:policy.from,days[6]>policy.to?days[6]:policy.to];
 const allowed=db.assignments.filter(a=>a.active&&a.accountId===account&&db.products.some(p=>p.id===a.productId&&p.active)).map(a=>a.productId);
 const records=days.map(date=>{
  const saved=db.reports.find(r=>!r._carryContext&&r.accountId===account&&r.date===date),draft=drafts[date];
  const ids=[...new Set([...allowed,...(saved?.entries||[]).map(e=>e.productId),...(draft?.entries||[]).map(e=>e.productId)])];
  const entries=ids.map(productId=>draft?.entries?.find(e=>e.productId===productId)||saved?.entries.find(e=>e.productId===productId)||{productId,...Object.fromEntries(fields.map(([key])=>[key,0])),...(sale?{}:{received:0})});
  const record=saved||{id:'new-'+account+'-'+date,accountId:account,date,status:'draft',entries,revision:0},transfers=draft?.transfers??saved?.transfers??[];
  let rows=entries,error='';try{
   if(sale){const preview={...db,reports:[...db.reports.filter(r=>r.accountId!==account||r.date!==date),{...record,status:'submitted',entries}]};rows=saleSummary(preview,[date,date],account).rows.map(r=>({...r,productId:r.id}));}
   else rows=reportEditorModel(db,record,entries,transfers).entries;
  }catch(e){error=e.message;}
  const requested=(db.reportrequests||[]).some(r=>r.accountId===account&&r.date===date&&r.status==='pending');
  const blocked=user.role!=='admin'&&!requested&&(date<policy.start||date>policy.to||(policy.hasHistory&&date>policy.nextDate));
  return {date,saved,record,draft,entries,transfers,rows,error,blocked,revision:draft?.revision??saved?.revision??0};
 });
 const update=(day,entries=day.entries,transfers=day.transfers)=>setDrafts(all=>({...all,[day.date]:{entries,transfers,revision:day.revision}}));
 const discard=date=>setDrafts(all=>{const next={...all};delete next[date];return next;});
 async function save(day){
  if(day.blocked||day.error)return;
  let payload;try{if(sale){if(day.entries.some(e=>Number(e.tt)>Number(e.data)))throw Error('Data tương tác không thể vượt Tổng data.');payload={accountId:account,date:day.date,status:'submitted',entries:day.entries,revision:day.revision};}else payload=reportEditorPayload(db,day.record,day.entries,day.revision,day.transfers);}catch(e){notify(e.message,'error');return;}
  if(await mutate('saveReport',payload)){discard(day.date);notify('Đã lưu báo cáo ngày '+dateLabel(day.date)+'.');}
 }
 const previewDb={...db,reports:[...db.reports.filter(r=>r.accountId!==account||!days.includes(r.date)),...records.filter(d=>!d.error&&(d.saved||d.draft)).map(d=>({...d.record,status:'submitted',_normalized:true,entries:sale?d.entries:d.rows}))]};
 let totalRows=[],totalError='';try{totalRows=sale?saleSummary(previewDb,[days[0],days[6]],account).rows.map(r=>({...r,productId:r.id})):productSummary(previewDb,[days[0],days[6]],account).columns.filter(r=>records.some(d=>d.entries.some(e=>e.productId===r.id))).map(r=>({...r,productId:r.id}));}catch(e){totalError=e.message;}
 const totalMetrics=sale?saleMetrics:mktMetrics.filter(([key])=>!['funding','carryover','transferIn','transferOut','budget','appointments','late'].includes(key));
 function table(rows,metrics,day){return <DragScroll className="weekly-table-scroll"><table className="weekly-report-table"><thead><tr><th scope="col">Chỉ tiêu</th>{rows.map(row=><th scope="col" key={row.productId} style={{background:productTone(row.productId).color,color:'#fff'}}>{db.products.find(p=>p.id===row.productId)?.name||row.productId}</th>)}<th scope="col" className="summary-total">Tổng SP</th></tr></thead><tbody>{metrics.map(([key,label,type])=><tr key={key}><th scope="row">{!day&&key==='remaining'?'Dư cuối tuần':label}</th>{rows.map(row=>{
  const raw=day?.entries.find(e=>e.productId===row.productId),field=key==='funding'?(raw?.received!==undefined?'received':'budget'):key,editable=day&&type==='input'&&!day.blocked&&(user.role==='admin'||allowed.includes(row.productId));
  return <td key={row.productId} style={{background:productTone(row.productId).background,color:productTone(row.productId).text}}>{editable?<NumberField aria-label={label+' — '+db.products.find(p=>p.id===row.productId)?.name+' — '+dateLabel(day.date)} min={0} max={key==='tt'?Number(raw?.data||0):undefined} value={valueOf(row,key)} onFocus={e=>e.target.select()} onChange={e=>update(day,day.entries.map(entry=>entry.productId===row.productId?{...entry,[field]:Number(e.target.value||0)}:entry))}/>:format(valueOf(row,key),type)}{day&&!sale&&key==='carryover'&&<BudgetTransfers db={db} accountId={account} date={day.date} entries={day.entries} value={day.transfers} sourceProductId={row.productId} disabled={day.blocked} onChange={transfers=>update(day,day.entries,transfers)}/>}</td>;
 })}<td className="summary-total">{format(totalValue(rows,key),type)}</td></tr>)}</tbody></table></DragScroll>;}
 return <div className="weekly-entry"><div className="weekly-entry-heading"><div>{onBack&&<ActionButton className="text-btn" onClick={onBack}><ArrowLeft size={16}/> Quay lại báo cáo</ActionButton>}<h1>Báo cáo tuần {sale?'SALE':'MKT'}</h1><span>{accountLabel(db.accounts.find(a=>a.id===account))}</span></div><div id="report-management-actions"/></div>
 <div className="panel weekly-entry-toolbar">{user.role==='admin'&&<label>Account<select value={account} onChange={e=>onRouteChange?.({accountId:e.target.value,date:days[0]})}>{db.accounts.filter(isEmployee).map(a=><option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</select></label>}<label>Tháng<DateField type="month" value={selection.month} onChange={e=>setSelection({month:e.target.value,start:monthWeeks(e.target.value)[0][0]})}/></label><label>Tuần<select aria-label="Chọn tuần báo cáo" value={days[0]} onChange={e=>setSelection({...selection,start:e.target.value})}>{weeks.map((week,i)=><option value={week[0]} key={week[0]}>Tuần {i+1} · {dateLabel(week[0])} – {dateLabel(week[6])}</option>)}</select></label><div className="weekly-step"><ActionButton type="button" className="icon-btn" aria-label="Tuần trước" disabled={weekIndex===0} onClick={()=>setSelection({...selection,start:weeks[weekIndex-1][0]})}><ChevronLeft size={19}/></ActionButton><ActionButton type="button" className="icon-btn" aria-label="Tuần sau" disabled={weekIndex===weeks.length-1} onClick={()=>setSelection({...selection,start:weeks[weekIndex+1][0]})}><ChevronRight size={19}/></ActionButton></div></div>
 <WindowGate range={range}><div className="weekly-entry-grid">{records.map((day,i)=><section className={'panel weekly-day'+(day.blocked?' weekly-day-locked':'')} key={day.date}><div className="weekly-day-heading"><div><span>{['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ nhật'][i]}</span><h2>{dateLabel(day.date)}</h2></div><span className={'status '+(day.draft?'draft':day.saved?.status==='submitted'?'done':'draft')}>{day.draft?'Chưa lưu':day.saved?.status==='submitted'?'Đã gửi':'Chưa gửi'}</span></div><ActionForm onSubmit={e=>{e.preventDefault();void save(day);}}>{day.rows.length?table(day.rows,sale?saleMetrics:mktMetrics,day):<p className="weekly-empty">Chưa được phân phối sản phẩm.</p>}{day.error&&<p className="error-text weekly-feedback" role="alert">{day.error}</p>}{day.draft&&day.revision!==(day.saved?.revision||0)&&<p className="info-note weekly-feedback">Bảng đã có phiên bản mới. Hủy thay đổi để tải số liệu mới trước khi nhập lại.</p>}{day.blocked&&<p className="weekly-feedback">{day.date>policy.to?'Ngày này chưa đến hạn nhập báo cáo.':day.date<policy.start?'Cần yêu cầu mở sửa cho ngày này.':'Cần gửi ngày '+dateLabel(policy.nextDate)+' trước.'}</p>}<div className="weekly-day-actions"><span>{day.draft?'Có thay đổi chưa lưu':day.saved?'Báo cáo đã đồng bộ':''}</span><div>{user.role==='admin'&&day.saved&&<><ActionButton type="button" className="icon-btn" aria-label={'Lịch sử sửa ngày '+dateLabel(day.date)} onClick={()=>setHistory(day.saved)}><FileText size={16}/></ActionButton><DeleteReport record={day.saved} mutate={mutate} notify={notify} onBack={()=>discard(day.date)}/></>}{day.draft&&<ActionButton type="button" className="btn" onClick={()=>discard(day.date)}><Undo2 size={14}/> Hủy thay đổi</ActionButton>}<ActionButton type="submit" className="btn primary" disabled={day.blocked||!!day.error||!day.entries.length||(!day.draft&&day.saved?.status==='submitted')||(!!day.draft&&day.revision!==(day.saved?.revision||0))}><Save size={15}/> {day.saved?'Lưu thay đổi':'Gửi báo cáo'}</ActionButton></div></div></ActionForm></section>)}<section className="panel weekly-day weekly-total"><div className="weekly-day-heading"><div><span>Tuần {weekIndex+1} · {dateLabel(days[0])} – {dateLabel(days[6])}</span><h2>Tổng tuần</h2></div><span className="tag">{records.filter(d=>d.saved?.status==='submitted').length}/7 ngày đã gửi</span></div>{totalError?<p className="error-text weekly-feedback">{totalError}</p>:table(totalRows,totalMetrics)}<p className="weekly-feedback">{dirty?'Tổng tuần đang gồm số liệu chưa lưu.':'Tổng hợp từ báo cáo đã lưu và đơn hàng trong tuần.'}</p></section></div></WindowGate>{history&&<ReportHistory db={db} report={history} onClose={()=>setHistory(null)}/>}</div>;
}

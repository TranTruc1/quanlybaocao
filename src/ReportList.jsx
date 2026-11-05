import {RequestReportButton} from './ReportManagement.jsx';
import WindowGate from './DataWindow.jsx';
import ReportHistory from './ReportHistory.jsx';
import DateField from './DateField.jsx';
import {ActionButton,ActionForm} from './Operations.jsx';
import React,{useState,useEffect,useCallback} from 'react';
import {FileText,Eye,CalendarDays,ArrowRight,ArrowLeft,Plus,X} from 'lucide-react';
import {dayString,previousDay,periodRange,inRange,money} from './domain.js';
import ReportCards from './ReportCards.jsx';
import InlineReportEditor from './InlineReportEditor.jsx';
import ProductSummary from './ProductSummary.jsx';
import {reportGroups,combinedReportDb} from './report-groups.js';
import {reportPolicy} from './report-policy.js';
import {useWorkspaceState} from './WorkspaceState.jsx';
const formatDate=d=>d.split('-').reverse().join('/');
const formatTime=d=>d?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(d)):'Chưa gửi';
export default function ReportList({db,user,mutate,notify,busy,onOpen,FilterComponent,initialView,onViewChange,dirtyRef,SummaryComponent,onCreate,onOrders,route,onRouteChange,employeeTabs}){
 const today=user.role==='admin'?previousDay():dayString();
 const [filter,setFilter]=useWorkspaceState('reports.filter',initialView?.filter||{mode:user.role==='admin'?'day':'month',date:today,from:today.slice(0,7)+'-01',to:today,month:today.slice(0,7),account:user.role==='admin'?'all':user.id,product:'all'}),[view,setView]=useWorkspaceState('reports.view',initialView?.view||'accounts'),[storedAccount,setStoredAccount]=useWorkspaceState('reports.selectedAccount',initialView?.selectedAccount||null),[editing,setEditing]=useWorkspaceState('reports.editing',null),[newDate,setNewDate]=useWorkspaceState('reports.newDate',''),[history,setHistory]=useState(null);
 const [storedDay,setStoredDay]=useWorkspaceState('reports.inlineDay',initialView?.inlineDay||''),[inlineDirty,setInlineDirty]=useState(false);
 const selectedAccount=route?route.employee:storedAccount,inlineDay=route?route.day:storedDay;
 useEffect(()=>{if(user.role==='admin'&&route)setFilter(f=>({...f,account:selectedAccount||'all'}));},[selectedAccount,user.role]);
 const setSelectedAccount=value=>{setStoredAccount(value);onRouteChange?.({...route,page:'overview',employee:value,day:null});};
 const setInlineDay=value=>{setStoredDay(value);onRouteChange?.({...route,page:'overview',day:value},{replace:true});};
 const updateDirty=useCallback(value=>{setInlineDirty(value);if(dirtyRef)dirtyRef.current=value;},[dirtyRef]);
 function leave(action){updateDirty(false);action();}
 const editPolicy=reportPolicy(db.reports,editing?.accountId);
 const range=periodRange(filter.mode,filter.date,filter.from,filter.to,filter.month);
 const reports=db.reports.filter(r=>!r._carryContext&&inRange(r.date,range)&&(user.role==='admin'||r.accountId===user.id)&&(filter.account==='all'||r.accountId===filter.account)&&(filter.product==='all'||r.entries.some(e=>e.productId===filter.product))).sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||'').localeCompare(a.updatedAt||''));
 const own=x=>(user.role==='admin'||x.accountId===user.id)&&(filter.account==='all'||x.accountId===filter.account);
 const scopedDb={...db,assignments:db.assignments.filter(own),targets:db.targets.filter(own),orders:db.orders.filter(o=>(user.role==='admin'||o.accountId===user.id)&&(filter.account==='all'||o.accountId===filter.account))};
 const groups=reportGroups(scopedDb,reports,range,filter.product,{includeOrderOnly:true,includeAccounts:true}),summaryDb=combinedReportDb(scopedDb,groups),selected=groups.find(g=>g.accountId===selectedAccount);
 const inlineRecord=selected?.reports.find(r=>r.id===inlineDay)||selected?.reports[0];
 useEffect(()=>{onViewChange?.({filter,view,selectedAccount,inlineDay});},[filter,view,selectedAccount,inlineDay,onViewChange]);
 function changeFilter(next){leave(()=>{setStoredDay('');setFilter(next);onRouteChange?.({...route,page:'overview',day:null},{replace:true});});}
 return <>{!selected&&<div className="page-heading"><div><div className="eyebrow">BÁO CÁO KINH DOANH</div><h1>{selected?"Báo cáo của "+selected.ownerName:"Báo cáo"}</h1></div><div className="report-heading-actions">{!selected&&user.role!=='admin'&&onCreate&&<ActionButton className="btn primary" onClick={onCreate}><Plus size={16}/> Điền báo cáo</ActionButton>}{selected&&<ActionButton className="btn" onClick={()=>leave(()=>setSelectedAccount(null))}><ArrowLeft size={16}/> Quay lại danh sách</ActionButton>}<span className="tag">{selected?selected.reports.length:reports.length} bảng · {selected?1:groups.length} nhân viên</span></div></div>}<div className="report-sticky-controls">{employeeTabs}<FilterComponent {...{db,user,filter,setFilter:changeFilter}} calendarAccount={selected?.accountId} hideAccount={user.role==='admin'&&!!route}/></div><WindowGate range={range}><div className="report-list-controls">{!selected&&SummaryComponent&&<div className="segmented" aria-label="Cách xem báo cáo">{[['accounts','Theo nhân viên'],['products','Theo sản phẩm']].map(([id,label])=><ActionButton className={view===id?'selected':''} key={id} onClick={()=>setView(id)}>{label}</ActionButton>)}</div>}</div>
 {!selected&&SummaryComponent&&<SummaryComponent db={summaryDb} user={user} filter={filter}/>}
 {selected?<>
  {inlineRecord?null:<div className="info-note">{selected.total.orderCount>0?'Nhân viên có đơn hàng nhưng chưa có báo cáo quảng cáo trong khoảng đã chọn. Doanh thu vẫn được tính đầy đủ.':'Chưa có báo cáo trong khoảng đã chọn. Mục tiêu và sản phẩm được giao vẫn hiển thị đầy đủ.'} {onOrders&&<ActionButton className="btn" onClick={onOrders}>Xem đơn hàng</ActionButton>}{user.role!=='admin'&&onCreate&&<ActionButton className="btn primary" onClick={onCreate}>Điền báo cáo</ActionButton>}</div>}
  {inlineRecord&&<InlineReportEditor key={inlineRecord.id} record={inlineRecord} db={db} user={user} product={filter.product} mutate={mutate} notify={notify} onDirtyChange={updateDirty} onHistory={()=>setHistory(inlineRecord)} onEditDate={()=>{setEditing({id:inlineRecord.id,date:inlineRecord.date,accountId:inlineRecord.accountId,revision:inlineRecord.revision});setNewDate(inlineRecord.date);}}/>}
  {!inlineRecord&&<ProductSummary db={selected.db} range={range} account={selected.accountId} product={filter.product}/>}

 </>:<>{view==='products'&&SummaryComponent?<ProductSummary db={summaryDb} range={range} account={filter.account} product={filter.product}/>:<ReportCards groups={groups} onSelect={setSelectedAccount}/>}{groups.length>0&&!SummaryComponent&&<div className="panel report-list-total"><b>Tổng {groups.length} nhân viên · {reports.length} bảng</b><span>Tổng data: <strong>{money(groups.reduce((n,g)=>n+g.total.data,0))}</strong></span><span>Chi thực tế: <strong>{money(groups.reduce((n,g)=>n+g.total.spend,0))} đ</strong></span></div>}</>}
 {editing&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Sửa ngày báo cáo"><div className="modal-heading"><h2>Sửa ngày báo cáo</h2><ActionButton className="icon-btn" aria-label="Đóng" onClick={()=>setEditing(null)}><X size={20}/></ActionButton></div><p>Bảng của <b>{db.accounts.find(a=>a.id===editing.accountId)?.ownerName}</b>, ngày hiện tại <b>{formatDate(editing.date)}</b>.</p><ActionForm onSubmit={async e=>{e.preventDefault();if(await mutate('changeReportDate',{id:editing.id,date:newDate,revision:editing.revision})){setEditing(null);notify('Đã đổi ngày báo cáo. Báo cáo tổng hợp đã cập nhật.');}}}><label>Ngày báo cáo mới<DateField type="date" min={user.role==='admin'?undefined:editPolicy.start} max={user.role==='admin'?undefined:editPolicy.nextDate} required value={newDate} onChange={e=>setNewDate(e.target.value)}/></label><div className="info-note" style={{marginTop:18}}>Số liệu quảng cáo chuyển sang ngày mới. Đơn hàng vẫn theo ngày đã nhập trong mục Đơn hàng. Thời điểm gửi thực tế được giữ nguyên.</div><div className="modal-actions"><ActionButton className="btn" type="button" onClick={()=>setEditing(null)}>Hủy</ActionButton><ActionButton className="btn primary" disabled={busy||newDate===editing.date}>Lưu ngày mới <ArrowRight size={15}/></ActionButton></div></ActionForm></section></div>}{history&&<ReportHistory db={db} report={history} onClose={()=>setHistory(null)}/>}</WindowGate></>
}

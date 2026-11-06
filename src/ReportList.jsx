import useReportPeriod from './useReportPeriod.js';
import WindowGate from './DataWindow.jsx';
import ReportHistory from './ReportHistory.jsx';
import {ActionButton} from './Operations.jsx';
import React,{useState,useEffect,useCallback} from 'react';
import {periodRange,inRange,money} from './domain.js';
import ReportCards from './ReportCards.jsx';
import InlineReportEditor from './InlineReportEditor.jsx';
import ProductSummary from './ProductSummary.jsx';
import {reportGroups,combinedReportDb} from './report-groups.js';
import {useWorkspaceState} from './WorkspaceState.jsx';

export default function ReportList({db,user,mutate,notify,busy,onOpen,FilterComponent,initialView,onViewChange,dirtyRef,SummaryComponent,onCreate,onOrders,route,onRouteChange,employeeTabs}){
 const [storedAccount,setStoredAccount]=useWorkspaceState('reports.selectedAccount',initialView?.selectedAccount||null);
 const selectedAccount=route?route.employee:storedAccount;
 const [filter,setFilter]=useReportPeriod(selectedAccount,user);
 const [view,setView]=useWorkspaceState('reports.view',initialView?.view||'accounts'),[history,setHistory]=useState(null);
 const [storedDay,setStoredDay]=useWorkspaceState('reports.inlineDay',initialView?.inlineDay||'');
 const inlineDay=route?route.day:storedDay;
 const setSelectedAccount=value=>{setStoredAccount(value);onRouteChange?.({...route,page:'overview',employee:value,day:null});};

 const updateDirty=useCallback(value=>{if(dirtyRef)dirtyRef.current=value;},[dirtyRef]);
 function leave(action){updateDirty(false);action();}
 const range=periodRange(filter.mode,filter.date,filter.from,filter.to,filter.month);
 const reports=db.reports.filter(r=>!r._carryContext&&inRange(r.date,range)&&(user.role==='admin'||r.accountId===user.id)&&(filter.account==='all'||r.accountId===filter.account)&&(filter.product==='all'||r.entries.some(e=>e.productId===filter.product))).sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||'').localeCompare(a.updatedAt||''));
 const own=x=>(user.role==='admin'||x.accountId===user.id)&&(filter.account==='all'||x.accountId===filter.account);
 const scopedDb={...db,appointments:(db.appointments||[]).filter(own),assignments:db.assignments.filter(own),targets:db.targets.filter(own),orders:db.orders.filter(o=>(user.role==='admin'||o.accountId===user.id)&&(filter.account==='all'||o.accountId===filter.account))};
 const groups=reportGroups(scopedDb,reports,range,filter.product,{includeOrderOnly:true,includeAccounts:true}),summaryDb=combinedReportDb(scopedDb,groups),selected=groups.find(g=>g.accountId===selectedAccount)||(selectedAccount?{accountId:selectedAccount,reports:[],db:scopedDb}:null);
 const inlineRecord=selected?.reports.find(r=>r.id===inlineDay)||selected?.reports[0];
 useEffect(()=>{onViewChange?.({filter,view,selectedAccount,inlineDay});},[filter,view,selectedAccount,inlineDay,onViewChange]);
 function changeFilter(next){leave(()=>{setStoredDay('');setFilter(next);onRouteChange?.({...route,page:'overview',day:null},{replace:true});});}
 return <><div className="report-sticky-controls">{employeeTabs}<FilterComponent {...{db,user,filter,setFilter:changeFilter}} calendarAccount={selectedAccount||undefined} hideAccount={user.role==='admin'&&!!route}/></div><WindowGate range={range}>{!selected&&SummaryComponent&&<div className="report-list-controls"><div className="segmented" aria-label="Cách xem báo cáo">{[['accounts','Theo nhân viên'],['products','Theo sản phẩm']].map(([id,label])=><ActionButton className={view===id?'selected':''} key={id} onClick={()=>setView(id)}>{label}</ActionButton>)}</div></div>}

 {!selected&&SummaryComponent&&<SummaryComponent db={summaryDb} user={user} filter={filter}/>}
 {selected?<> 
  {filter.mode!=='day'?<ProductSummary db={selected.db} range={range} account={selected.accountId} product={filter.product}/>:inlineRecord&&<InlineReportEditor key={inlineRecord.id} record={inlineRecord} db={db} user={user} product={filter.product} mutate={mutate} notify={notify} onDirtyChange={updateDirty} onHistory={()=>setHistory(inlineRecord)}/>}

  {!inlineRecord&&filter.mode==='day'&&<ProductSummary title="Chi tiết theo sản phẩm" status="Chưa gửi" db={selected.db} range={range} account={selected.accountId} product={filter.product}/>}

 </>:<>{view==='products'&&SummaryComponent?<ProductSummary db={summaryDb} range={range} account={filter.account} product={filter.product}/>:<ReportCards groups={groups} onSelect={setSelectedAccount}/>}{groups.length>0&&!SummaryComponent&&<div className="panel report-list-total"><b>Tổng {groups.length} nhân viên · {reports.length} bảng</b><span>Tổng data: <strong>{money(groups.reduce((n,g)=>n+g.total.data,0))}</strong></span><span>Chi thực tế: <strong>{money(groups.reduce((n,g)=>n+g.total.spend,0))} đ</strong></span></div>}</>}
 {history&&<ReportHistory db={db} report={history} onClose={()=>setHistory(null)}/>}</WindowGate></>
}

import React,{useEffect} from 'react';
import {Save,Undo2,CalendarDays,FileText} from 'lucide-react';
import {ActionButton,ActionForm} from './Operations.jsx';
import {useWorkspaceState} from './WorkspaceState.jsx';
import DragScroll from './DragScroll.jsx';
import StickyTableHead from './StickyTableHead.jsx';
import NumberField from './NumberField.jsx';
import {saleSummary,monthSaleFigures} from './roles.js';
import {reportPolicy} from './report-policy.js';
import {fields,money,pct,countFormat,divide,latestActiveReportDate} from './domain.js';
import {productTone} from './palette.js';
const metrics=[['data','Tổng data','input'],['tt','Data tương tác','input'],['ktt','Data ktt'],['saleCount','Đơn bán hàng','count'],['upsaleCount','Đơn Upsale','count'],['careCount','Đơn chăm sóc','count'],['appointments','Đơn hẹn','count'],['orders','Tổng đơn','count'],['revenue','Tổng doanh số'],['monthRevenue','Tổng doanh số tháng'],['conversion','Tỉ lệ chốt','percent'],['achieved','Đạt mục tiêu','percent']];
export default function SaleReportEditor({db,user,record,product='all',mutate,notify,onHistory,docked=true}){
 const [draft,setDraft,cache]=useWorkspaceState('sale.inline.'+record.id,null);
 const entries=draft?.entries||record.entries,revision=draft?.revision??record.revision;
 const preview={...db,reports:db.reports.map(r=>r.id===record.id?{...r,entries,status:'submitted'}:r)};
 const summary=saleSummary(preview,[record.date,record.date],record.accountId,product);
 // Cột sản phẩm xếp theo ngày báo cáo gần nhất; sản phẩm quá 3 ngày không có
 // báo cáo thật thì tự ẩn, tick để mở lại; nút Ẩn ở tiêu đề ẩn thủ công.
 // Tổng SP vẫn tính đủ mọi sản phẩm. "Đạt mục tiêu" tính theo doanh số cả
 // tháng đang chọn, không phải một ngày.
 const [manualShown,setManualShown]=useWorkspaceState('sale.inline.shown.'+record.id,{});
 const [manualHidden,setManualHidden]=useWorkspaceState('sale.inline.hidden.'+record.id,{});
 const latestByProduct=new Map(summary.rows.map(r=>[r.id,latestActiveReportDate(db,record.accountId,r.id,record.date)]));
 const daysStale=id=>{const latest=latestByProduct.get(id);return latest?Math.round((Date.parse(record.date)-Date.parse(latest))/86400000):Infinity;};
 const sorted=[...summary.rows].sort((a,b)=>{const la=latestByProduct.get(a.id),lb=latestByProduct.get(b.id);if(la===lb)return 0;if(!la)return 1;if(!lb)return -1;return lb.localeCompare(la);});
 const shownRows=sorted.filter(r=>(daysStale(r.id)<=3||manualShown[r.id])&&!manualHidden[r.id]);
 const hiddenRows=sorted.filter(r=>(daysStale(r.id)>3&&!manualShown[r.id])||manualHidden[r.id]);
 const {revenueByProduct:monthRev,goalByProduct:monthGoal}=monthSaleFigures(db,record.accountId,record.date.slice(0,7));
 const monthRevTotal=[...monthRev.values()].reduce((n,v)=>n+v,0),monthGoalTotal=[...monthGoal.values()].reduce((n,v)=>n+v,0);
 const policy=reportPolicy(db.reports,record.accountId),requested=(db.reportrequests||[]).some(r=>r.accountId===record.accountId&&r.date===record.date&&r.status==='pending');
 const blocked=user.role!=='admin'&&!requested&&(record.date<policy.start||record.date>policy.nextDate),conflict=!!draft&&revision!==record.revision;
 useEffect(()=>{const guard=e=>{if(draft&&!cache.persisted){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[!!draft,cache.persisted]);
 async function save(e){e.preventDefault();if(blocked||conflict)return;if(entries.some(e=>Number(e.tt)>Number(e.data))){notify('Data tương tác không thể vượt Tổng data.','error');return;}const clean=entries.map(e=>({...Object.fromEntries(fields.map(([key])=>[key,0])),productId:e.productId,data:Number(e.data||0),tt:Number(e.tt||0)}));if(await mutate('saveReport',{accountId:record.accountId,date:record.date,status:'submitted',revision,entries:clean})){cache.clear();notify('Đã lưu báo cáo SALE.');}}
 const dateTitle=<span className="report-edit-date"><CalendarDays size={16}/><span>{record.date.split('-').reverse().join('/')}</span></span>;
 return <section className="panel product-summary sale-report-editor"><ActionForm onSubmit={save}><div className="panel-heading"><div><h2>Chi tiết theo sản phẩm</h2><p>{record.date.split('-').reverse().join('/')} · {record.status==='submitted'?'Đã gửi':'Chưa gửi'}</p></div></div><DragScroll><table style={{minWidth:Math.max(600,(shownRows.length+2)*155)}}><StickyTableHead><tr><th>{dateTitle}</th>{shownRows.map(row=><th key={row.id} style={{background:productTone(row.id).color,color:'#fff'}}>{row.name}<button type="button" className="col-hide" onClick={()=>{setManualHidden({...manualHidden,[row.id]:true});setManualShown({...manualShown,[row.id]:false});}}>Ẩn</button></th>)}<th className="summary-total">Tổng SP</th></tr></StickyTableHead><tbody>{metrics.map(([key,label,format])=><tr key={key}><th scope="row">{label}</th>{[...shownRows,summary.total].map((row,i)=>{const isTotal=i===shownRows.length,value=key==='monthRevenue'?isTotal?monthRevTotal:monthRev.get(row.id)||0:key==='achieved'?isTotal?divide(monthRevTotal,monthGoalTotal):divide(monthRev.get(row.id)||0,monthGoal.get(row.id)||0):row[key];return <td key={row.id||'total'} className={isTotal?'summary-total':''} style={row.id?{background:productTone(row.id).background,color:productTone(row.id).text}:undefined}>{format==='input'&&row.id&&!blocked&&entries.some(e=>e.productId===row.id)&&(user.role==='admin'||db.assignments.some(a=>a.accountId===record.accountId&&a.productId===row.id&&a.active))?<NumberField aria-label={label+' — '+row.name} min={0} max={key==='tt'?row.data:undefined} value={row[key]} onFocus={e=>e.target.select()} onChange={e=>setDraft({revision,entries:entries.map(x=>x.productId===row.id?{...x,[key]:Number(e.target.value||0)}:x)})}/>:format==='percent'?pct(value):format==='count'?countFormat(value):money(value)}</td>;})}</tr>)}</tbody></table></DragScroll>{hiddenRows.length>0&&<div className="hidden-products"><span>Đã ẩn {hiddenRows.length} sản phẩm (tick để hiện lại):</span>{hiddenRows.map(r=><label key={r.id} className="care-check"><input type="checkbox" checked={!!manualShown[r.id]&&!manualHidden[r.id]} onChange={ev=>{const show=ev.target.checked;setManualShown({...manualShown,[r.id]:show});setManualHidden({...manualHidden,[r.id]:!show});}}/>{r.name}</label>)}</div>}{conflict&&<p role="alert" className="info-note">Bảng đã có phiên bản mới. Hủy thay đổi để tải số liệu mới trước khi nhập lại.</p>}{blocked&&<p className="info-note">Ngày này cần yêu cầu mở sửa hoặc hoàn tất báo cáo theo thứ tự.</p>}<div className={'inline-save-dock'+(!docked?' report-local-actions':'')}><span>{draft?'Có thay đổi chưa lưu':'Báo cáo đã đồng bộ'}</span><div>{user.role==='admin'&&docked&&<span id="report-management-actions"/>}<ActionButton type="button" className="btn" onClick={onHistory}><FileText size={16}/> Lịch sử sửa</ActionButton><ActionButton type="button" className="btn" disabled={!draft} onClick={()=>cache.clear()}><Undo2 size={16}/> Hủy thay đổi</ActionButton><ActionButton type="submit" className="btn primary" disabled={blocked||conflict||(!draft&&record.status==='submitted')}><Save size={16}/> Lưu thay đổi</ActionButton></div></div></ActionForm></section>;
}

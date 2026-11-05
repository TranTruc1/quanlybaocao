import React from 'react';
import {ArrowRight,FileText} from 'lucide-react';
import {ActionButton} from './Operations.jsx';
import {money,pct,countFormat} from './domain.js';
export function ReportMetrics({group}){
 const t=group.total;
 const metrics=[['Tổng ngân sách đã chi',money(t.spend)+' đ'],['Tổng data',money(t.data)],['Chi phí mess',money(group.costPerData)+' đ'],
  ['Data tt',money(t.tt)],['Data ktt',money(t.ktt)],['Đơn TC',countFormat(t.success)],['Upsale',countFormat(t.upsale)],
  ['Đơn chăm',countFormat(t.careOrderCount)],['Đơn quy đổi',countFormat(t.orderCount)],['Đơn hẹn',money(t.appointments)],['Rep chậm',money(t.late)],
  ['Doanh số bán hàng',money(t.revenue)+' đ'],['Doanh thu chăm',money(t.care)+' đ'],['Tỷ lệ chi phí/DS',pct(group.costRatio)],
  ['Mục tiêu doanh thu',money(group.goal)+' đ'],['Đạt mục tiêu',pct(group.achieved)],['Dư cuối kỳ đã chọn',money(group.remaining)+' đ'],
  ['Chi TB/ngày có bảng',money(group.averageSpend)+' đ'],['Data TB/ngày có bảng',money(group.averageData)]];
 return <dl className="report-card-metrics">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export default function ReportCards({groups,onSelect}){
 if(!groups.length)return <div className="panel empty"><FileText/><h2>Chưa có bảng trong thời gian này</h2><p>Chọn thời gian hoặc trạng thái khác để xem báo cáo.</p></div>;
 return <div className="employee-report-grid">{groups.map(group=><ActionButton className="panel employee-report-card" key={group.accountId} onClick={()=>onSelect(group.accountId)} aria-label={'Xem báo cáo chi tiết của '+group.ownerName}>
  <div className="employee-report-heading"><span className="avatar">{group.ownerName.charAt(0)}</span><div><h2>{group.ownerName}</h2><p>{group.reports.length} bảng · {group.days} ngày · {group.products} sản phẩm</p></div><ArrowRight size={20}/></div>
  <div className="report-card-status">{group.reports.length===0?<span className="status draft">{group.total.orderCount>0?'Có đơn hàng · Chưa gửi báo cáo':'Chưa gửi báo cáo'}</span>:<span className="status done">{group.reports.length-group.drafts} đã gửi</span>}{group.drafts>0&&<span className="status draft">{group.drafts} chưa gửi</span>}</div>
  <ReportMetrics group={group}/><div className="employee-report-link">Xem chi tiết từng sản phẩm <ArrowRight size={16}/></div>
 </ActionButton>)}</div>;
}

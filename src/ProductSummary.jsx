import StickyTableHead from './StickyTableHead.jsx';
import DragScroll from './DragScroll.jsx';
import React from 'react';
import {productTone} from './palette.js';
import {productSummary,money,pct,countFormat} from './domain.js';

const metrics=[
 ['spend','Tổng ngân sách'],['remaining','Ngân sách thừa cuối kỳ'],['data','Tổng data'],['costPerData','Chi phí mess'],
 ['tt','Data tt'],['ktt','Data ktt'],['success','Đơn bán hàng','count'],['revenue','Doanh số bán hàng'],['upsale','Đơn Upsale','count'],['upsaleRevenue','Doanh số Upsale'],['careOnlyCount','Đơn chăm sóc','count'],['careOnlyRevenue','Doanh số chăm sóc'],['orderCount','Tổng đơn','count'],['totalRevenue','Tổng doanh số'],['appointments','Đơn hẹn','count'],
 ['costRatio','Tỷ lệ chi phí/DS','percent'],
 ['goal','Mục tiêu'],['achieved','Đạt','percent']
];
export default function ProductSummary({db,range,account,product,title='Tổng kết theo sản phẩm',status}) {
 const {columns,total}=productSummary(db,range,account,product);
 const all=[...columns,total];
 return <section className="panel product-summary">
  <div className="panel-heading"><div><h2>{title}</h2><p>{(range[0]===range[1]?[range[0]]:range).map(d=>d.split('-').reverse().join('/')).join(' – ')}</p></div>{status&&<span className="status draft">{status}</span>}</div>
  <DragScroll aria-label="Bảng báo cáo, giữ chuột trái và kéo để xem ngang"><table style={{minWidth:Math.max(600,(all.length+1)*155)}}>
   <StickyTableHead><tr><th>Chỉ tiêu</th>{all.map(c=><th key={c.id} className={c.id==='total'?'summary-total':''} style={c.id==='total'?{}:{background:productTone(c.id).color,color:'#fff'}}>{c.label}</th>)}</tr></StickyTableHead>
   <tbody>{metrics.map(([key,label,format])=><tr key={key} className={key==='goal'||key==='achieved'?'summary-goal':''}><th scope="row">{label}</th>{all.map(c=><td key={c.id} className={c.id==='total'?'summary-total':''} style={c.id==='total'?{}:{background:productTone(c.id).background,color:productTone(c.id).text}}>{format==='percent'?pct(c[key]):format==='count'?countFormat(c[key]):money(c[key])}</td>)}</tr>)}</tbody>
  </table></DragScroll>

 </section>;
}

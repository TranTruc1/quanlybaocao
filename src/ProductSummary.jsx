import StickyTableHead from './StickyTableHead.jsx';
import DragScroll from './DragScroll.jsx';
import React from 'react';
import {productTone} from './palette.js';
import {productSummary,money,pct,countFormat} from './domain.js';

const metrics=[
 ['spend','Tổng ngân sách'],['remaining','Ngân sách thừa cuối kỳ'],['data','Tổng data'],['costPerData','Chi phí mess'],
 ['tt','Data tt'],['ktt','Data ktt'],['success','Đơn bán hàng','count'],['revenue','Doanh số bán hàng'],['upsale','Đơn Upsale','count'],['upsaleRevenue','Doanh số Upsale'],['careOnlyCount','Đơn chăm sóc','count'],['careOnlyRevenue','Doanh số chăm sóc'],['orderCount','Tổng đơn quy đổi','count'],
 ['costRatio','Tỷ lệ chi phí/DS','percent'],
 ['goal','Mục tiêu'],['achieved','Đạt','percent']
];
export default function ProductSummary({db,range,account,product}) {
 const {columns,total}=productSummary(db,range,account,product);
 const all=[...columns,total];
 return <section className="panel product-summary">
  <div className="panel-heading"><div><h2>Tổng kết theo sản phẩm</h2><p>{range.map(d=>d.split('-').reverse().join('/')).join(' – ')} · Theo account và sản phẩm đã chọn</p></div><span className="tag">{columns.length} sản phẩm</span></div>
  <DragScroll aria-label="Bảng báo cáo, giữ chuột trái và kéo để xem ngang"><table style={{minWidth:Math.max(600,(all.length+1)*155)}}>
   <StickyTableHead><tr><th>Chỉ tiêu</th>{all.map(c=><th key={c.id} className={c.id==='total'?'summary-total':''} style={c.id==='total'?{}:{background:productTone(c.id).color,color:'#fff'}}>{c.label}</th>)}</tr></StickyTableHead>
   <tbody>{metrics.map(([key,label,format])=><tr key={key} className={key==='goal'||key==='achieved'?'summary-goal':''}><th scope="row">{label}</th>{all.map(c=><td key={c.id} className={c.id==='total'?'summary-total':''} style={c.id==='total'?{}:{background:productTone(c.id).background,color:productTone(c.id).text}}>{format==='percent'?pct(c[key]):format==='count'?countFormat(c[key]):money(c[key])}</td>)}</tr>)}</tbody>
  </table></DragScroll>
  <div className="table-note"><span>Ngân sách thừa cuối kỳ lấy số dư gần nhất đến ngày kết thúc, theo từng account và sản phẩm; giữ nguyên qua ngày chưa có báo cáo, không cộng dồn số dư hằng ngày. Tổng ngân sách = ngân sách − thừa. Chi phí mess = tổng ngân sách ÷ tổng data. Đạt = doanh số ÷ mục tiêu.</span><span>Mục tiêu là tổng mục tiêu tháng thuộc khoảng đã chọn, không chia theo ngày. Các dòng bán hàng, Upsale và chăm sóc tách riêng, không tính trùng. Chia đơn = 0,5.</span></div>
 </section>;
}

import React,{useEffect} from 'react';
import {money,pct,decimal} from './domain.js';
export default function TargetsTable({summary,sale=false,focusProduct}){
 const {rows,total}=summary;
 useEffect(()=>{if(focusProduct)document.getElementById('target-product-'+focusProduct)?.scrollIntoView({block:'center',behavior:'smooth'});},[focusProduct,rows.length]);
 return <div className="table-scroll targets-scroll"><table className="targets-table"><thead><tr><th>Sản phẩm</th><th>Giá USD / VNĐ</th><th>Mục tiêu DT</th><th>Đơn / tháng</th><th>Đơn TB / ngày</th><th>{sale?'Doanh số thực tế':'Thực tế bán hàng'}</th><th>Hoàn thành</th>{!sale&&<><th>Mục tiêu chăm</th><th>Thực tế chăm</th></>}</tr></thead>
 <tbody>{rows.map(r=><tr id={'target-product-'+r.product.id} className={focusProduct===r.product.id?'notification-focus':''} key={r.product.id}><th scope="row">{r.product.name}</th><td>${decimal(r.target?.priceUsd??r.product.priceUsd)}<small>{money(r.price)} đ</small></td><td>{money(r.goal)}</td><td>{money(r.orders)}</td><td>{decimal(r.perDay)}</td><td className="strong">{money(r.revenue)}</td><td><span className="ratio">{pct(r.achieved)}</span></td>{!sale&&<><td>{money(r.careGoal)}</td><td>{money(r.care)}</td></>}</tr>)}</tbody>
 <tfoot><tr><th scope="row">Tổng tất cả</th><td aria-label="Không cộng giá đơn vị">—</td><td>{money(total.goal)}</td><td>{money(total.orders)}</td><td>{decimal(total.perDay)}</td><td>{money(total.revenue)}</td><td><span className="ratio">{pct(total.achieved)}</span></td>{!sale&&<><td>{money(total.careGoal)}</td><td>{money(total.care)}</td></>}</tr></tfoot></table>
 {!rows.length&&<div className="empty"><p>Chưa có sản phẩm hoặc mục tiêu trong tháng này.</p></div>}
 
 </div>;
}

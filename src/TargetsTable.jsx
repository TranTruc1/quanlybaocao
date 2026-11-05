import React from 'react';
import {money,pct,decimal} from './domain.js';
export default function TargetsTable({summary}){
 const {rows,total}=summary;
 return <div className="table-scroll targets-scroll"><table className="targets-table"><thead><tr><th>Sản phẩm</th><th>Giá USD / VNĐ</th><th>Mục tiêu DT</th><th>Đơn / tháng</th><th>Đơn TB / ngày</th><th>Thực tế bán hàng</th><th>Hoàn thành</th><th>Mục tiêu chăm</th><th>Thực tế chăm</th></tr></thead>
 <tbody>{rows.map(r=><tr key={r.product.id}><th scope="row">{r.product.name}</th><td>${decimal(r.target?.priceUsd??r.product.priceUsd)}<small>{money(r.price)} đ</small></td><td>{money(r.goal)}</td><td>{money(r.orders)}</td><td>{decimal(r.perDay)}</td><td className="strong">{money(r.revenue)}</td><td><span className="ratio">{pct(r.achieved)}</span></td><td>{money(r.careGoal)}</td><td>{money(r.care)}</td></tr>)}</tbody>
 <tfoot><tr><th scope="row">Tổng tất cả</th><td aria-label="Không cộng giá đơn vị">—</td><td>{money(total.goal)}</td><td>{money(total.orders)}</td><td>{decimal(total.perDay)}</td><td>{money(total.revenue)}</td><td><span className="ratio">{pct(total.achieved)}</span></td><td>{money(total.careGoal)}</td><td>{money(total.care)}</td></tr></tfoot></table>
 {!rows.length&&<div className="empty"><p>Chưa có sản phẩm hoặc mục tiêu trong tháng này.</p></div>}
 <div className="table-note">Hoàn thành tổng = tổng doanh số ÷ tổng mục tiêu. Đơn TB/ngày = tổng số đơn cần đạt ÷ số ngày trong tháng. Giá đơn vị không cộng tổng.</div>
 </div>;
}

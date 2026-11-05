import React from 'react';
export function compactPostTime(value){
 if(!value||!Number.isFinite(Date.parse(value)))return 'Chưa có giờ đăng';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hourCycle:'h23',day:'numeric',month:'numeric'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 return parts.hour+':'+parts.minute+' · '+Number(parts.day)+'/'+Number(parts.month);
}
export default function OrderCustomer({order}){
 return <div className="order-customer" title={'Ngày doanh số: '+(order.date?.split('-').reverse().join('/')||'Chưa có')}><b>{order.customerName}</b><time dateTime={order.createdAt||undefined} title={order.createdAt||'Chưa có giờ đăng'}>{compactPostTime(order.createdAt)}</time><small>{order.createdByName?'Bởi '+order.createdByName:'Chưa rõ người đăng (đơn cũ)'}</small>{order.isBounced&&<small>Bùng</small>}</div>;
}

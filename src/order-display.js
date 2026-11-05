export const postedTimestamp=o=>{const value=Date.parse(o.createdAt||'');return Number.isFinite(value)?value:Date.parse((o.date||'1970-01-01')+'T00:00:00Z')||0;};
export const sortOrdersNewest=orders=>[...orders].sort((a,b)=>postedTimestamp(b)-postedTimestamp(a)||String(b.id||'').localeCompare(String(a.id||'')));
export function postTime(value){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'}).format(new Date(value)):'Chưa có thời gian đăng';}
export const poster=o=>o.createdByName?((o.createdByRole==='admin'?'Admin':o.createdByRole==='sale'?'SALE':'MKT')+' - '+o.createdByName):'Chưa có thông tin (đơn cũ)';

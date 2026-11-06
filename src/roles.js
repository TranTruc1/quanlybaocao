import {appointmentTotal} from './appointments.js';
import {inRange,orderWeight,divide,isCareOrder} from './domain.js';
export const isEmployee=a=>a?.role==='user'||a?.role==='sale';
export const accountLabel=a=>a?(a.role==='admin'?'Admin':a.role==='sale'?'SALE':'MKT')+' - '+(a.ownerName||a.username):'Account đã xóa';
export const assignedMkts=(db,productId)=>db.accounts.filter(a=>a.role==='user'&&a.active&&!a.deletedAt&&db.assignments.some(x=>x.active&&x.accountId===a.id&&x.productId===productId));
export const assignedSales=(db,productId)=>db.accounts.filter(a=>a.role==='sale'&&a.active&&!a.deletedAt&&db.assignments.some(x=>x.active&&x.accountId===a.id&&x.productId===productId));
export function saleOrderDb(db){return {...db,orders:db.orders.filter(o=>o.saleAccountId).map(o=>({...o,accountId:o.saleAccountId,type:'sale',isCare:false}))};}
export function mktReportDb(db){const ids=new Set(db.accounts.filter(a=>a.role!=='sale').map(a=>a.id));return {...db,accounts:db.accounts.filter(a=>a.role!=='sale'),assignments:db.assignments.filter(a=>ids.has(a.accountId)),reports:db.reports.filter(a=>ids.has(a.accountId)),targets:db.targets.filter(a=>ids.has(a.accountId))};}
export function saleSummary(db,range,account='all',product='all'){
 const match=r=>(account==='all'||r.accountId===account)&&inRange(r.date,range);
 const saleIds=new Set(db.accounts.filter(a=>a.role==='sale').map(a=>a.id));
 const reports=db.reports.filter(r=>!r._carryContext&&saleIds.has(r.accountId)&&match(r));
 const orders=db.orders.filter(o=>!o.isBounced&&o.saleAccountId&&(account==='all'||o.saleAccountId===account)&&inRange(o.date,range));
 const ids=new Set([...db.assignments.filter(a=>a.active&&saleIds.has(a.accountId)&&(account==='all'||a.accountId===account)).map(a=>a.productId),...reports.flatMap(r=>r.entries.map(e=>e.productId)),...orders.map(o=>o.productId),...(db.appointments||[]).filter(a=>saleIds.has(a.saleAccountId)&&(account==='all'||a.saleAccountId===account)&&inRange(a.date,range)).map(a=>a.productId)]);
 const rows=db.products.filter(p=>ids.has(p.id)&&(product==='all'||product===p.id)).map(p=>{
  const counts={data:0,tt:0,ktt:0,orders:0,revenue:0,appointments:0,saleCount:0,upsaleCount:0,careCount:0};
  reports.forEach(r=>r.entries.filter(e=>e.productId===p.id).forEach(e=>{for(const k of ['data','tt','ktt'])counts[k]+=k==='ktt'?Number(e.data||0)-Number(e.tt||0):Number(e[k]||0);}));
  orders.filter(o=>o.productId===p.id).forEach(o=>{counts.orders+=orderWeight(o);counts.revenue+=Number(o.amountVnd||0);counts[o.type==='upsale'?'upsaleCount':isCareOrder(o)?'careCount':'saleCount']+=orderWeight(o);});
  counts.appointments=appointmentTotal(db.appointments,reports,account==='all'?[...saleIds]:[account],range,p.id,'sale');
  return {id:p.id,name:p.name,...counts,conversion:divide(counts.orders,counts.data)};
 });
 const total=rows.reduce((a,r)=>{for(const k of ['data','tt','ktt','orders','revenue','appointments','saleCount','upsaleCount','careCount'])a[k]+=r[k];return a;},{data:0,tt:0,ktt:0,orders:0,revenue:0,appointments:0,saleCount:0,upsaleCount:0,careCount:0});total.conversion=divide(total.orders,total.data);
 return {rows,total,reports,orders:orders.filter(o=>product==='all'||o.productId===product)};
}

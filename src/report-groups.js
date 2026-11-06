import {aggregate,divide,productSummary,inRange} from './domain.js';

// All unified views use the same report/status/product scope. Drafts are explicit.
export function reportGroups(db,reports,range,product='all',options={}){
 const byAccount=new Map();
 for(const r of reports){if(r._carryContext)continue;if(!byAccount.has(r.accountId))byAccount.set(r.accountId,[]);byAccount.get(r.accountId).push(r);}
 const eligibleAppointments=(db.appointments||[]).filter(a=>inRange(a.date,range)&&(product==='all'||a.productId===product));
 if(options.includeOrderOnly)for(const a of eligibleAppointments)if(!byAccount.has(a.accountId))byAccount.set(a.accountId,[]);
 const eligibleOrders=db.orders.filter(o=>!o.isBounced&&inRange(o.date,range)&&(product==='all'||o.productId===product));
 if(options.includeOrderOnly)for(const o of eligibleOrders)if(!byAccount.has(o.accountId))byAccount.set(o.accountId,[]);
 if(options.includeAccounts){
  for(const t of db.targets||[])if(t.month>=range[0].slice(0,7)&&t.month<=range[1].slice(0,7)&&(product==='all'||t.productId===product)&&!byAccount.has(t.accountId))byAccount.set(t.accountId,[]);
  for(const a of db.assignments||[])if(a.active&&(product==='all'||a.productId===product)&&db.accounts.some(u=>u.id===a.accountId&&u.active&&u.role==='user')&&!byAccount.has(a.accountId))byAccount.set(a.accountId,[]);
 }
 return [...byAccount].map(([accountId,items])=>{
  const dates=new Set(items.map(r=>r.date));
  const ids=new Set(items.flatMap(r=>r.entries.filter(e=>product==='all'||e.productId===product).map(e=>e.productId)));
  if(options.includeOrderOnly)eligibleAppointments.filter(a=>a.accountId===accountId).forEach(a=>ids.add(a.productId));
  if(options.includeOrderOnly)eligibleOrders.filter(o=>o.accountId===accountId).forEach(o=>ids.add(o.productId));
  for(const t of db.targets||[])if(t.accountId===accountId&&t.month>=range[0].slice(0,7)&&t.month<=range[1].slice(0,7)&&(product==='all'||t.productId===product))ids.add(t.productId);
  for(const a of db.assignments||[])if(a.active&&a.accountId===accountId&&(product==='all'||a.productId===product))ids.add(a.productId);
  const scoped={...db,appointments:eligibleAppointments.filter(a=>a.accountId===accountId),products:db.products.filter(p=>ids.has(p.id)),
   reports:items.map(r=>({...r,status:'submitted',_normalized:true,entries:r.entries.filter(e=>ids.has(e.productId))})),
   balanceReports:(db.balanceReports||db.reports).filter(r=>r.accountId===accountId).map(r=>({...r,entries:r.entries.filter(e=>ids.has(e.productId))})),
   orders:db.orders.filter(o=>o.accountId===accountId&&(options.includeOrderOnly?inRange(o.date,range):dates.has(o.date))&&ids.has(o.productId))};
  const stats=aggregate(scoped,range,accountId,product),summary=productSummary(scoped,range,accountId,product);
  return {accountId,ownerName:db.accounts.find(a=>a.id===accountId)?.ownerName||'Account đã xóa',reports:items,db:scoped,
   total:stats.total,costPerData:stats.costPerData,costRatio:stats.costRatio,goal:summary.total.goal,achieved:summary.total.achieved,
   days:dates.size,products:ids.size,drafts:items.filter(r=>r.status==='draft').length,
   remaining:summary.total.remaining,
   averageSpend:divide(stats.total.spend,dates.size),averageData:divide(stats.total.data,dates.size)};
 }).sort((a,b)=>a.ownerName.localeCompare(b.ownerName,'vi'));
}

export function combinedReportDb(db,groups){return {...db,balanceReports:groups.flatMap(g=>g.db.balanceReports),reports:groups.flatMap(g=>g.db.reports),orders:groups.flatMap(g=>g.db.orders),appointments:groups.flatMap(g=>g.db.appointments||[])};}

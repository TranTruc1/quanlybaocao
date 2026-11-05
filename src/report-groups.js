import {aggregate,divide,productSummary} from './domain.js';

// Report list includes drafts intentionally; it is distinct from posted dashboard totals.
export function reportGroups(db,reports,range,product='all'){
 const byAccount=new Map();
 for(const r of reports){if(r._carryContext)continue;if(!byAccount.has(r.accountId))byAccount.set(r.accountId,[]);byAccount.get(r.accountId).push(r);}
 return [...byAccount].map(([accountId,items])=>{
  const dates=new Set(items.map(r=>r.date));
  const ids=new Set(items.flatMap(r=>r.entries.filter(e=>product==='all'||e.productId===product).map(e=>e.productId)));
  const scoped={...db,products:db.products.filter(p=>ids.has(p.id)),
   reports:items.map(r=>({...r,status:'submitted',_normalized:true,entries:r.entries.filter(e=>ids.has(e.productId))})),
   orders:db.orders.filter(o=>o.accountId===accountId&&dates.has(o.date)&&ids.has(o.productId))};
  const stats=aggregate(scoped,range,accountId,product),summary=productSummary(scoped,range,accountId,product);
  const balances=new Map();
  [...items].sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>r.entries.filter(e=>ids.has(e.productId)).forEach(e=>balances.set(e.productId,Number(e.remaining||0))));
  return {accountId,ownerName:db.accounts.find(a=>a.id===accountId)?.ownerName||'Account đã xóa',reports:items,db:scoped,
   total:stats.total,costPerData:stats.costPerData,costRatio:stats.costRatio,goal:summary.total.goal,achieved:summary.total.achieved,
   days:dates.size,products:ids.size,drafts:items.filter(r=>r.status==='draft').length,
   remaining:[...balances.values()].reduce((n,v)=>n+v,0),
   averageSpend:divide(stats.total.spend,dates.size),averageData:divide(stats.total.data,dates.size)};
 }).sort((a,b)=>a.ownerName.localeCompare(b.ownerName,'vi'));
}

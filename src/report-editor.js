import {aggregate,carryoverBefore,divide,validateEntries} from './domain.js';
export function reportEditorModel(db,record,draft=record.entries){
 const entries=draft.map(e=>{
  const carry=carryoverBefore(db.reports,record.accountId,e.productId,record.date).amount;
  return e.received!==undefined?{...e,carryover:carry,budget:carry+Number(e.received||0)}:{...e};
 });
 const scope={...db,reports:[{...record,status:'submitted',_normalized:true,entries}]};
 const stats=aggregate(scope,[record.date,record.date],record.accountId);
 const rows=entries.map(e=>{
  const sums=stats.detail.find(r=>r.productId===e.productId)||{};
  const goal=(db.targets||[]).filter(t=>t.accountId===record.accountId&&t.productId===e.productId&&t.month===record.date.slice(0,7)).reduce((n,t)=>n+Number(t.revenue||0),0);
  return {...e,goal,achieved:divide(sums.revenue||0,goal),success:sums.success||0,upsale:sums.upsale||0,careOrderCount:sums.careOrderCount||0,
   orderCount:sums.orderCount||0,revenue:sums.revenue||0,care:sums.care||0,
   spend:Number(e.budget||0)-Number(e.remaining||0),
   costPerData:divide(Number(e.budget||0)-Number(e.remaining||0),Number(e.data||0)),
   costRatio:divide(Number(e.budget||0)-Number(e.remaining||0),sums.revenue||0)};
 });
 return {entries:rows,total:{...stats.total,costPerData:stats.costPerData,costRatio:stats.costRatio}};
}
export function reportEditorPayload(db,record,draft,revision){
 const model=reportEditorModel(db,record,draft);validateEntries(model.entries);
 // Derived values are recomputed again by the server. Preserve hidden product entries.
 const entries=model.entries.map(e=>{
  const original=draft.find(x=>x.productId===e.productId);
  return {...original,budget:e.budget,success:e.success,upsale:e.upsale};
 });
 return {accountId:record.accountId,date:record.date,status:'submitted',entries,revision};
}

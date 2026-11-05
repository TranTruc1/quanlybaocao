// Transfers redistribute the opening balance, never fresh funding or revenue.
export function transferAmounts(transfers, opening, productIds) {
 const incoming={},outgoing={};
 if(!Array.isArray(transfers)||transfers.length>100)throw Error('Tối đa 100 dòng chuyển ngân sách.');
 const allowed=new Set(productIds);
 for(const t of transfers){
  if(!t||!allowed.has(t.fromProductId)||!allowed.has(t.toProductId)||t.fromProductId===t.toProductId)throw Error('Chọn hai sản phẩm khác nhau có trong báo cáo.');
  if(!Number.isSafeInteger(t.amount)||t.amount<=0||t.amount>1e13)throw Error('Số tiền chuyển phải là số nguyên dương.');
  outgoing[t.fromProductId]=(outgoing[t.fromProductId]||0)+t.amount;
  incoming[t.toProductId]=(incoming[t.toProductId]||0)+t.amount;
 }
 for(const [id,amount] of Object.entries(outgoing))if(amount>Number(opening[id]||0))throw Error('Tổng tiền chuyển vượt số dư từ ngày trước. Không dùng tiền mới nhận hoặc tiền vừa chuyển đến để chuyển tiếp trong cùng ngày.');
 return {incoming,outgoing};
}
export function normalizeBudgets(reports){
 const balances={};
 return structuredClone(reports).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
  const opening=Object.fromEntries(r.entries.map(e=>[e.productId,balances[r.accountId+'|'+e.productId]||0]));
  const {incoming,outgoing}=r._normalized?{incoming:{},outgoing:{}}:transferAmounts(r.transfers||[],opening,r.entries.map(e=>e.productId));
  r.entries=r.entries.map(e=>{
   if(!r._normalized&&Object.hasOwn(e,'received')){
    const received=Number(e.received);
    if(!Number.isFinite(received)||received<0||received>1e13)throw Error('Tiền mới nhận phải là số không âm.');
    e.received=received;e.carryover=opening[e.productId];
    if(r.transfers?.length||Object.hasOwn(e,'transferIn')){e.transferIn=incoming[e.productId]||0;e.transferOut=outgoing[e.productId]||0;}
    e.budget=received+e.carryover+(incoming[e.productId]||0)-(outgoing[e.productId]||0);
    if(r.status==='submitted'&&Number(e.remaining)>e.budget)throw Error('Ngày '+r.date+': thừa cuối ngày vượt ngân sách sau khi chuyển dư. Kiểm tra báo cáo và các khoản chuyển sau ngày này.');
   }else if((incoming[e.productId]||outgoing[e.productId])&&!Object.hasOwn(e,'received'))throw Error('Báo cáo cũ cần đổi ngân sách sang Tiền mới nhận trước khi chuyển.');
   if(r.status==='submitted')balances[r.accountId+'|'+e.productId]=Number(e.remaining||0);
   else if(r.postedEntries){const posted=r.postedEntries.find(x=>x.productId===e.productId);if(posted)balances[r.accountId+'|'+e.productId]=Number(posted.remaining||0);}
   return e;
  });return r;
 });
}
export function previewTransferBudget(reports,accountId,date,entries,transfers=[]){
 const prior=normalizeBudgets(reports.filter(r=>r.accountId===accountId&&r.date<date));
 const opening={};
 for(const r of prior)for(const e of (r.status==='submitted'?r.entries:r.postedEntries)||[])opening[e.productId]=Number(e.remaining||0);
 const {incoming,outgoing}=transferAmounts(transfers,opening,entries.map(e=>e.productId));
 return entries.map(e=>e.received===undefined?{...e}:{...e,carryover:opening[e.productId]||0,transferIn:incoming[e.productId]||0,transferOut:outgoing[e.productId]||0,budget:Number(e.received||0)+(opening[e.productId]||0)+(incoming[e.productId]||0)-(outgoing[e.productId]||0)});
}

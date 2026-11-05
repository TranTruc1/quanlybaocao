import {normalizeBudgets} from './budget-transfers.js';
export const fields = [ ['budget','Ngân sách'],['remaining','Thừa cuối ngày'],['data','Tổng data'],['tt','Data tt'],['ktt','Data ktt'],['success','Đơn TC'],['upsale','Upsale'],['appointments','Đơn hẹn'],['late','Rep chậm'] ];
export const money = n => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(n)||0);
export const pct = n => new Intl.NumberFormat('vi-VN',{style:'percent',maximumFractionDigits:2}).format(Number(n)||0);
export const divide = (a,b) => b ? a/b : 0;
export function dayString(d = new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
export function previousDay(now=new Date()){const d=new Date(dayString(now)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
export function periodRange(mode, date, from, to, month) {if(mode==='day')return [date,date];if(mode==='range')return [from,to]; const [y,m]=month.split('-').map(Number);return [month+'-01',month+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0')];}
export function inRange(date,range){return date>=range[0]&&date<=range[1];}
export function netSpend(e){return Number(e.budget||0)-Number(e.remaining||0);}
export function validateEntries(entries){for(const e of entries){if(e.received!==undefined&&(!Number.isFinite(Number(e.received))||Number(e.received)<0))throw Error('Tiền mới nhận phải không âm.');for(const [k] of fields){if(!Number.isFinite(Number(e[k]))||Number(e[k])<0)throw Error('Số liệu phải là số không âm.');if(['success','upsale'].includes(k)&&!Number.isInteger(Number(e[k])*2))throw Error('Số đơn phải theo bước 0,5.');if(!['budget','remaining','success','upsale'].includes(k)&&!Number.isInteger(Number(e[k])))throw Error('Các số đếm phải là số nguyên.');}if(Number(e.remaining)>Number(e.budget))throw Error('Thừa cuối ngày không thể lớn hơn ngân sách.');}return true;}
export const orderWeight = o => o.isBounced===true?0:o.isSplit===true?0.5:1;
export const countFormat = n => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(Number(n)||0);
export const isCareOrder = o => o.type==='care'||o.type==='upsale'||o.isCare===true;
export function aggregate(db,range,account='all',product='all'){
 const match = x => (account==='all'||x.accountId===account)&&inRange(x.date,range);
 const reports=normalizeReportBudgets(db.reports).filter(r=>r.status==='submitted'&&match(r));
 const orders=db.orders.filter(o=>!o.isBounced&&match(o)&&(product==='all'||o.productId===product));
 const rows=new Map();
 const get=(a,d,p)=>{const key=[a,d,p].join('|');if(!rows.has(key)) rows.set(key,{accountId:a,date:d,productId:p,budget:0,remaining:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,spend:0,revenue:0,care:0,orderCount:0,careOnlyCount:0,upsaleRevenue:0,careOnlyRevenue:0,careOrderCount:0,submitted:false});return rows.get(key);};
 for(const r of reports)for(const e of r.entries){if(product!=='all'&&e.productId!==product)continue;const x=get(r.accountId,r.date,e.productId);for(const [k]of fields)if(!['success','upsale'].includes(k))x[k]+=Number(e[k]||0);x.spend+=netSpend(e);x.submitted=true;}
 for(const o of orders){const x=get(o.accountId,o.date,o.productId);x[isCareOrder(o)?'care':'revenue']+=Number(o.amountVnd||0);const weight=orderWeight(o);x.orderCount+=weight;if(isCareOrder(o))x.careOrderCount+=weight;else x.success+=weight;if(o.type==='upsale'){x.upsale+=weight;x.upsaleRevenue+=Number(o.amountVnd||0);}else if(isCareOrder(o)){x.careOnlyCount+=weight;x.careOnlyRevenue+=Number(o.amountVnd||0);}}
 const detail=[...rows.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.accountId.localeCompare(b.accountId));
 const total=detail.reduce((a,r)=>{for(const k of ['budget','remaining','data','tt','ktt','success','upsale','appointments','late','spend','revenue','care','orderCount','careOrderCount','careOnlyCount','upsaleRevenue','careOnlyRevenue'])a[k]=(a[k]||0)+r[k];return a;},{budget:0,remaining:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,spend:0,revenue:0,care:0,orderCount:0,careOnlyCount:0,upsaleRevenue:0,careOnlyRevenue:0,careOrderCount:0});
 const accountDays=new Set(detail.filter(r=>r.submitted).map(r=>r.accountId+'|'+r.date)).size;
 const days=new Set(detail.filter(r=>r.submitted).map(r=>r.date)).size;
 const averageTotal=detail.filter(r=>r.submitted).reduce((a,r)=>{for(const k of ['spend','data','success','revenue','care'])a[k]+=r[k];return a;},{spend:0,data:0,success:0,revenue:0,care:0});
 return {detail,total,averageTotal,accountDays,days,costPerData:divide(total.spend,total.data),costRatio:divide(total.spend,total.revenue)};
}
export function targetMath(t,p,month){const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();const price=Number(t?.priceUsd??p.priceUsd)*Number(t?.rate??p.rate);const orders=price>0?Math.ceil(Number(t?.revenue||0)/price):0;return {price,orders,perDay:orders/days,days};}

// Closing balances are snapshots per account/product, never a sum of daily carryovers.
export function closingBalances(reports,end,account='all',product='all'){
 const balances=new Map();
 for(const r of [...reports].filter(r=>r.date<=end&&(account==='all'||r.accountId===account)).sort((a,b)=>a.date.localeCompare(b.date))){
  for(const e of r.entries||[])if(product==='all'||e.productId===product)balances.set(JSON.stringify([r.accountId,e.productId]),{accountId:r.accountId,productId:e.productId,remaining:Number(e.remaining||0)});
 }
 return [...balances.values()];
}

// Monthly goals are full-month goals for every month touched by the selected range.
export function productSummary(db, range, account='all', product='all') {
 const stats=aggregate(db,range,account,product);
 const balances=closingBalances(db.balanceReports||db.reports,range[1],account,product);
 const keys=['spend','data','tt','ktt','success','upsale','revenue','care','orderCount','careOrderCount','careOnlyCount','upsaleRevenue','careOnlyRevenue'];
 const empty=()=>Object.fromEntries([...keys,'goal','remaining'].map(k=>[k,0]));
 const products=db.products.filter(p=>product==='all'||p.id===product);
 const columns=products.map(p=>{
  const sums=empty();
  for(const row of stats.detail.filter(r=>r.productId===p.id))for(const k of keys)sums[k]+=row[k];
  sums.remaining=balances.filter(b=>b.productId===p.id).reduce((n,b)=>n+b.remaining,0);
  sums.goal=(db.targets||[]).filter(t=>t.productId===p.id&&(account==='all'||t.accountId===account)&&t.month>=range[0].slice(0,7)&&t.month<=range[1].slice(0,7)).reduce((v,t)=>v+Number(t.revenue||0),0);
  return {id:p.id,label:p.name,...sums,costPerData:divide(sums.spend,sums.data),costRatio:divide(sums.spend,sums.revenue),achieved:divide(sums.revenue,sums.goal)};
 });
 const total=columns.reduce((s,c)=>{for(const k of [...keys,'goal','remaining'])s[k]+=c[k];return s;},empty());
 return {columns,total:{id:'total',label:'Tổng SP',...total,costPerData:divide(total.spend,total.data),costRatio:divide(total.spend,total.revenue),achieved:divide(total.revenue,total.goal)}};
}

export function summarizeTargets(db,account,month){
 const targets=db.targets.filter(t=>t.accountId===account&&t.month===month);
 const stats=aggregate(db,periodRange('month','','','',month),account);
 const rows=db.products.filter(p=>db.assignments.some(a=>a.active&&a.accountId===account&&a.productId===p.id)||targets.some(t=>t.productId===p.id)||stats.detail.some(r=>r.productId===p.id)).map(product=>{
  const target=targets.find(t=>t.productId===product.id);
  const math=targetMath(target,product,month);
  const detail=stats.detail.filter(r=>r.productId===product.id);
  const revenue=detail.reduce((n,r)=>n+r.revenue,0),care=detail.reduce((n,r)=>n+r.care,0);
  const goal=Number(target?.revenue||0),careGoal=Number(target?.care||0);
  return {product,target,...math,goal,careGoal,revenue,care,achieved:divide(revenue,goal),editable:!!target||db.assignments.some(a=>a.active&&a.accountId===account&&a.productId===product.id)};
 });
 const total=rows.reduce((s,r)=>{for(const k of ['goal','orders','revenue','careGoal','care'])s[k]+=r[k];return s;},{goal:0,orders:0,revenue:0,careGoal:0,care:0});
 return {rows,total:{...total,perDay:divide(total.orders,targetMath(null,{priceUsd:0,rate:0},month).days),achieved:divide(total.revenue,total.goal)}};
}
export const decimal = n => new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);

export function carryoverBefore(reports,account,product,date){
 const candidates=reports.filter(r=>r.accountId===account&&r.date<date&&(r.status==='submitted'||r.postedEntries)&&((r.status==='submitted'?r.entries:r.postedEntries)||[]).some(e=>e.productId===product)).sort((a,b)=>b.date.localeCompare(a.date));
 const previous=candidates[0];
 return {amount:Number((previous?.status==='submitted'?previous?.entries:previous?.postedEntries)?.find(e=>e.productId===product)?.remaining||0),date:previous?.date||null};
}
export function normalizeReportBudgets(reports){return normalizeBudgets(reports);}

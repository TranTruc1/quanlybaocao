import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregate,netSpend,divide,periodRange,targetMath,validateEntries,fields,productSummary,previousDay,summarizeTargets,carryoverBefore,normalizeReportBudgets} from '../src/domain.js';
const entry=(productId,extra={})=>({productId,...Object.fromEntries(fields.map(([k])=>[k,0])),...extra});
test('Carryover budget is spent once across days',()=>{const rows=[entry('p',{budget:5000000,remaining:3000000}),entry('p',{budget:3000000,remaining:1000000}),entry('p',{budget:5000000,remaining:0})];assert.equal(rows.reduce((s,e)=>s+netSpend(e),0),9000000);});
test('Reports use submitted rows, scoped account/product and weighted cost',()=>{const db={reports:[{accountId:'a',date:'2026-11-01',status:'submitted',entries:[entry('p',{budget:1100000,remaining:100000,data:100}),entry('q',{data:30})]},{accountId:'a',date:'2026-11-02',status:'submitted',entries:[entry('p',{budget:1000000,data:200})]},{accountId:'a',date:'2026-11-03',status:'draft',entries:[entry('p',{data:9999,budget:99999999})]},{accountId:'b',date:'2026-11-01',status:'submitted',entries:[entry('p',{data:40})]}],orders:[{accountId:'a',date:'2026-11-01',productId:'p',type:'sale',amountVnd:10000000},{accountId:'a',date:'2026-11-01',productId:'p',type:'care',amountVnd:3000000},{accountId:'b',date:'2026-11-01',productId:'p',type:'sale',amountVnd:999}]};const r=aggregate(db,['2026-11-01','2026-11-30'],'a','p');assert.equal(r.total.data,300);assert.equal(r.total.spend,2000000);assert.equal(r.costPerData,2000000/300);assert.equal(r.costRatio,.2);assert.equal(r.total.care,3000000);assert.equal(r.total.revenue,10000000);assert.equal(r.accountDays,2);assert.equal(aggregate(db,['2026-11-01','2026-11-30']).accountDays,3);});
test('Zero submissions count, missing days and drafts do not',()=>{const db={reports:[{accountId:'a',date:'2026-11-01',status:'submitted',entries:[entry('p')]},{accountId:'a',date:'2026-11-02',status:'draft',entries:[entry('p')]}],orders:[]};const r=aggregate(db,['2026-11-01','2026-11-30']);assert.equal(r.accountDays,1);assert.equal(r.costRatio,0);assert.equal(r.costPerData,0);});
test('Calendar ranges are inclusive and year-specific',()=>{assert.deepEqual(periodRange('month','','','','2026-02'),['2026-02-01','2026-02-28']);assert.deepEqual(periodRange('month','','','','2028-02'),['2028-02-01','2028-02-29']);const db={reports:[],orders:[{date:'2026-11-01',accountId:'a',productId:'p',amountVnd:1,type:'sale'},{date:'2026-11-30',accountId:'a',productId:'p',amountVnd:2,type:'sale'},{date:'2025-11-01',accountId:'a',productId:'p',amountVnd:999,type:'sale'}]};assert.equal(aggregate(db,periodRange('month','','','','2026-11')).total.revenue,3);});
test('Targets round up required orders and preserve price snapshot',()=>{const p={priceUsd:210,rate:22500};const a=targetMath({revenue:150000000},p,'2026-08');assert.equal(a.orders,32);assert.equal(a.days,31);assert.equal(a.perDay,32/31);assert.equal(targetMath({revenue:150000000,priceUsd:100,rate:20000},p,'2026-11').orders,75);assert.equal(divide(10,0),0);});
test('Invalid budgets and counts are rejected',()=>{assert.throws(()=>validateEntries([entry('p',{budget:1,remaining:2})]));assert.throws(()=>validateEntries([entry('p',{data:-1})]));assert.throws(()=>validateEntries([entry('p',{data:1.2})]));assert.equal(validateEntries([entry('p',{budget:100,remaining:50})]),true);});

test('Split order is half a unit; care and upsale are exclusive from sale revenue',()=>{
 const orders=[{type:'sale',isSplit:true,amountVnd:100},{type:'upsale',isSplit:true,amountVnd:200},{type:'sale',isCare:true,amountVnd:300},{type:'upsale',isCare:true,amountVnd:400},{type:'care',amountVnd:500}].map(o=>({accountId:'a',productId:'p',date:'2026-11-01',...o}));
 const r=aggregate({reports:[],orders},['2026-11-01','2026-11-30']);
 assert.equal(r.total.orderCount,4);assert.equal(r.total.success,.5);assert.equal(r.total.upsale,1.5);assert.equal(r.total.careOrderCount,3.5);assert.equal(r.total.revenue,100);assert.equal(r.total.care,1400);
});
test('Removing split flag restores one unit without changing revenue',()=>{
 const o={accountId:'a',productId:'p',date:'2026-11-01',type:'sale',amountVnd:100,isSplit:true};
 assert.equal(aggregate({reports:[],orders:[o]},[o.date,o.date]).total.success,.5);o.isSplit=false;
 const r=aggregate({reports:[],orders:[o]},[o.date,o.date]);assert.equal(r.total.success,1);assert.equal(r.total.revenue,100);
});
test('Order totals do not double count manual daily success/upsale fields',()=>{
 const r=aggregate({reports:[{accountId:'a',date:'2026-11-01',status:'submitted',entries:[entry('p',{success:99,upsale:99})]}],orders:[{accountId:'a',date:'2026-11-01',productId:'p',type:'sale',isSplit:true}]},['2026-11-01','2026-11-01']);assert.equal(r.total.success,.5);assert.equal(r.total.upsale,0);
});

test('Product matrix totals use net budget, weighted cost, scoped targets and achievement',()=>{
 const db={products:[{id:'p',name:'Toma Co'},{id:'q',name:'Toma'},{id:'z',name:'No data'}],reports:[{accountId:'a',date:'2026-11-01',status:'submitted',entries:[entry('p',{budget:2000000,remaining:100000,data:5,tt:1,ktt:4}),entry('q',{budget:5000000,remaining:800000,data:20,tt:10,ktt:10})]}],orders:[{accountId:'a',date:'2026-11-01',productId:'q',type:'sale',amountVnd:25650000}],targets:[{accountId:'a',productId:'p',month:'2026-11',revenue:290000000},{accountId:'a',productId:'q',month:'2026-11',revenue:290000000},{accountId:'b',productId:'q',month:'2026-11',revenue:999},{accountId:'a',productId:'q',month:'2026-12',revenue:999}]};
 const s=productSummary(db,['2026-11-01','2026-11-30'],'a');assert.equal(s.total.spend,6100000);assert.equal(s.total.data,25);assert.equal(s.total.costPerData,244000);assert.equal(s.total.goal,580000000);assert.equal(s.total.achieved,25650000/580000000);assert.equal(s.columns[2].costPerData,0);assert.equal(s.columns[2].achieved,0);
 const q=productSummary(db,['2026-11-01','2026-11-30'],'a','q');assert.equal(q.columns.length,1);assert.equal(q.total.goal,290000000);assert.equal(q.total.costRatio,4200000/25650000);
});

test('Default report date is yesterday in Vietnam across month/year/leap boundaries',()=>{
 assert.equal(previousDay(new Date('2026-11-04T02:00:00Z')),'2026-11-03');
 assert.equal(previousDay(new Date('2026-10-31T18:00:00Z')),'2026-10-31');
 assert.equal(previousDay(new Date('2026-01-01T02:00:00Z')),'2025-12-31');
 assert.equal(previousDay(new Date('2028-03-01T02:00:00Z')),'2028-02-29');
});

test('Carryover waits through empty days, stays scoped, and is not taken from drafts',()=>{
 const reports=[{id:'one',accountId:'a',date:'2026-11-01',status:'submitted',entries:[entry('p',{budget:5000000,remaining:3000000})]},{id:'draft',accountId:'a',date:'2026-11-02',status:'draft',entries:[entry('p',{received:500000,remaining:0})]},{id:'four',accountId:'a',date:'2026-11-04',status:'submitted',entries:[entry('p',{received:1000000,remaining:500000})]}];
 const normalized=normalizeReportBudgets(reports);const four=normalized.find(r=>r.id==='four').entries[0];assert.equal(four.budget,4000000);assert.equal(four.carryover,3000000);assert.equal(carryoverBefore(normalized,'a','p','2026-11-04').amount,3000000);assert.equal(carryoverBefore(normalized,'a','p','2026-12-01').amount,500000);assert.equal(carryoverBefore(normalized,'b','p','2026-11-04').amount,0);assert.equal(carryoverBefore(normalized,'a','q','2026-11-04').amount,0);
 assert.equal(normalized.find(r=>r.id==='one').entries[0].budget,5000000);assert.equal(reports[2].entries[0].budget,0);
});
test('Reopened cash balance stays posted until resubmission; invalid future balances are rejected',()=>{
 const reports=[{id:'one',accountId:'a',date:'2026-11-01',status:'draft',entries:[entry('p',{received:5000000,remaining:2000000})],postedEntries:[entry('p',{remaining:3000000})]},{id:'four',accountId:'a',date:'2026-11-04',status:'submitted',entries:[entry('p',{received:1000000,remaining:500000})]}];
 assert.equal(normalizeReportBudgets(reports)[1].entries[0].budget,4000000);assert.equal(carryoverBefore(reports,'a','p','2026-11-04').amount,3000000);
 reports[0].status='submitted';assert.equal(normalizeReportBudgets(reports)[1].entries[0].budget,3000000);
 reports[1].entries[0].remaining=3500000;assert.throws(()=>normalizeReportBudgets(reports),/2026-11-04/);
});
test('Targets footer sums required orders and divides total revenue by total goal',()=>{
 const db={products:[{id:'p',priceUsd:100,rate:1000},{id:'q',priceUsd:200,rate:1000}],assignments:[{accountId:'a',productId:'p',active:true},{accountId:'a',productId:'q',active:true}],targets:[{accountId:'a',productId:'p',month:'2026-11',revenue:250000,care:10000},{accountId:'a',productId:'q',month:'2026-11',revenue:800000,care:20000},{accountId:'b',productId:'q',month:'2026-11',revenue:999999}],reports:[],orders:[{accountId:'a',productId:'p',date:'2026-11-01',type:'sale',amountVnd:100000},{accountId:'a',productId:'q',date:'2026-11-01',type:'sale',amountVnd:200000},{accountId:'a',productId:'q',date:'2026-11-01',type:'care',amountVnd:50000}]};
 const {rows,total}=summarizeTargets(db,'a','2026-11');assert.equal(rows.length,2);assert.equal(total.goal,1050000);assert.equal(total.orders,7);assert.equal(total.perDay,7/30);assert.equal(total.revenue,300000);assert.equal(total.achieved,300000/1050000);assert.equal(total.careGoal,30000);assert.equal(total.care,50000);assert.equal(summarizeTargets(db,'b','2026-12').total.achieved,0);
});

test('Bounced sale and care orders subtract all counts/revenue; unmarking restores their original weights',()=>{
 const orders=[{date:'2026-11-04',accountId:'a',productId:'p',type:'sale',isSplit:true,amountVnd:100,isBounced:true},{date:'2026-11-04',accountId:'a',productId:'p',type:'upsale',amountVnd:200,isBounced:true}];
 let r=aggregate({reports:[],orders},['2026-11-01','2026-11-30']);assert.equal(r.total.orderCount,0);assert.equal(r.total.revenue,0);assert.equal(r.total.care,0);assert.equal(r.total.upsale,0);
 orders.forEach(o=>o.isBounced=false);r=aggregate({reports:[],orders},['2026-11-01','2026-11-30']);assert.equal(r.total.orderCount,1.5);assert.equal(r.total.success,.5);assert.equal(r.total.upsale,1);assert.equal(r.total.revenue,100);assert.equal(r.total.care,200);
});

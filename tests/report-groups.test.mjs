import test from 'node:test';
import assert from 'node:assert/strict';
import {reportGroups} from '../src/report-groups.js';
const range=['2026-11-01','2026-11-04'];
function data(){return {accounts:[{id:'a',ownerName:'Trúc'},{id:'b',ownerName:'Ninh'}],products:[{id:'p',name:'Toma'},{id:'q',name:'Mụn'}],targets:[],
 reports:[{id:'r1',accountId:'a',date:'2026-11-01',status:'submitted',entries:[{productId:'p',budget:1000,remaining:400,data:10}]},
 {id:'r2',accountId:'a',date:'2026-11-04',status:'draft',entries:[{productId:'p',budget:1000,remaining:100,data:30},{productId:'q',budget:100,remaining:50,data:10}]},
 {id:'r3',accountId:'b',date:'2026-11-04',status:'submitted',entries:[{productId:'q',budget:900,remaining:0,data:90}]}],
 orders:[{accountId:'a',productId:'p',date:'2026-11-01',type:'sale',isSplit:true,amountVnd:1000},
 {accountId:'a',productId:'p',date:'2026-11-04',type:'upsale',amountVnd:300},
 {accountId:'a',productId:'p',date:'2026-11-04',type:'sale',isBounced:true,amountVnd:99999},
 {accountId:'b',productId:'q',date:'2026-11-04',type:'sale',amountVnd:5000}]};}
test('Employee cards combine dates, include visible drafts, and recompute weighted cost',()=>{
 const db=data(),before=JSON.stringify(db),a=reportGroups(db,db.reports,range).find(g=>g.accountId==='a');
 assert.equal(a.reports.length,2);assert.equal(a.drafts,1);assert.equal(a.days,2);assert.equal(a.total.spend,1550);assert.equal(a.total.data,50);assert.equal(a.costPerData,31);assert.equal(a.averageSpend,775);assert.equal(a.remaining,150);
 assert.equal(a.total.success,0.5);assert.equal(a.total.upsale,1);assert.equal(a.total.revenue,1000);assert.equal(a.total.care,300);assert.equal(a.costRatio,1.55);assert.equal(JSON.stringify(db),before);
});
test('Product and status filters affect both report totals and matching order revenue',()=>{
 const db=data(),selected=db.reports.filter(r=>r.accountId==='a'&&r.status==='submitted');
 const a=reportGroups(db,selected,range,'p')[0];assert.equal(a.total.data,10);assert.equal(a.total.spend,600);assert.equal(a.total.care,0);assert.deepEqual(a.db.products.map(p=>p.id),['p']);assert.equal(a.db.orders.length,1);
});
test('Carry context rows do not create employee cards or inflate report totals',()=>{
 const db=data();assert.equal(reportGroups(db,[{...db.reports[0],_carryContext:true}],range).length,0);
});

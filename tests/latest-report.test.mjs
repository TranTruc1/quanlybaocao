import test from 'node:test';
import assert from 'node:assert/strict';
import {reportDueDate,defaultReportPeriod} from '../src/report-period.js';
import {aggregate,productSummary} from '../src/domain.js';
import {reportEditorModel} from '../src/report-editor.js';
import {saleSummary} from '../src/roles.js';
test('Due report defaults to yesterday even across month, year and leap-day boundaries',()=>{
 for(const [today,due] of [['2026-11-06','2026-11-05'],['2026-11-01','2026-10-31'],['2027-01-01','2026-12-31'],['2028-03-01','2028-02-29']]){
  assert.equal(reportDueDate(today),due);
  assert.deepEqual(defaultReportPeriod(true,today),{mode:'day',date:due,from:due,to:due,month:today.slice(0,7),product:'all',automaticDue:true});
  assert.equal(defaultReportPeriod(false,today).mode,'month');
 }
});
test('Total revenue combines new, upsale and care once, excludes bounced orders and never halves split revenue',()=>{
 const entry={productId:'p',budget:100,remaining:0,data:10,tt:4,ktt:6,success:0,upsale:0,appointments:0,late:0},report={id:'r',accountId:'a',date:'2026-11-04',status:'submitted',entries:[entry]};
 const orders=[{type:'sale',amountVnd:1000},{type:'upsale',amountVnd:2000},{type:'care',amountVnd:3000},{type:'sale',isCare:true,isSplit:true,amountVnd:4000},{type:'sale',isBounced:true,amountVnd:99999}].map((o,i)=>({...o,id:String(i),accountId:'a',saleAccountId:'s',productId:'p',date:report.date}));
 const db={accounts:[{id:'a',role:'user'},{id:'s',role:'sale'}],products:[{id:'p',name:'P'}],assignments:[],targets:[],reports:[report],orders};
 const result=aggregate(db,[report.date,report.date],'a');assert.equal(result.total.totalRevenue,10000);assert.equal(result.total.revenue,1000);assert.equal(result.total.care,9000);assert.equal(result.total.orderCount,3.5);assert.equal(result.costRatio,.01);
 assert.equal(productSummary(db,[report.date,report.date],'a').total.totalRevenue,10000);assert.equal(reportEditorModel(db,report).entries[0].totalRevenue,10000);
 assert.equal(saleSummary(db,[report.date,report.date],'s').total.revenue,10000);
});

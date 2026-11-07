import test from 'node:test';
import assert from 'node:assert/strict';
import {reportEditorModel,reportEditorPayload} from '../src/report-editor.js';
import {missingReportDates} from '../src/report-policy.js';
const entry={productId:'p',received:1000,budget:1200,remaining:100,data:10,tt:5,ktt:5,appointments:0,late:0,success:0,upsale:0};
const record={id:'r',accountId:'u',date:'2026-11-04',status:'draft',revision:4,entries:[entry,{...entry,productId:'q',received:0,budget:0,remaining:0}]};
const db={reports:[{id:'old',accountId:'u',date:'2026-11-03',status:'submitted',entries:[{productId:'p',remaining:200}]}],targets:[],orders:[{accountId:'u',productId:'p',date:'2026-11-04',type:'sale',isSplit:true,amountVnd:10000},{accountId:'u',productId:'p',date:'2026-11-04',type:'sale',isBounced:true,amountVnd:99999}]};
test('Editing funding previews budget, spend and cost without changing the saved report',()=>{
 const changed=record.entries.map(e=>e.productId==='p'?{...e,received:2000}:e),model=reportEditorModel(db,record,changed);
 assert.equal(model.entries[0].budget,2200);assert.equal(model.entries[0].spend,2100);assert.equal(model.entries[0].costPerData,210);assert.equal(model.entries[0].success,0.5);assert.equal(model.entries[0].revenue,10000);assert.equal(record.entries[0].received,1000);
});
test('Inline save preserves hidden products and original revision, and submits officially',()=>{
 const changed=record.entries.map(e=>e.productId==='p'?{...e,data:25}:e),payload=reportEditorPayload(db,record,changed,4);
 assert.equal(payload.entries.length,2);assert.equal(payload.entries[1].productId,'q');assert.equal(payload.status,'submitted');assert.equal(payload.revision,4);assert.equal(payload.entries[0].data,25);
 assert.throws(()=>reportEditorPayload(db,record,[{...entry,remaining:99999}],4),/Thừa cuối ngày/);
});
test('Calendar marks missing and draft days but removes the red mark once submitted',()=>{
 const now=new Date('2026-11-05T01:00:00Z');
 const rows=[{accountId:'u',date:'2026-11-02',status:'submitted'},{accountId:'u',date:'2026-11-03',status:'draft'}];
 assert.deepEqual(missingReportDates(rows,'u',now),['2026-11-03','2026-11-04']);
 rows[1].status='submitted';assert.deepEqual(missingReportDates(rows,'u',now),['2026-11-04']);assert.equal(missingReportDates([],'new',now).length,5);assert.deepEqual(missingReportDates([],'new',now,7).length,7);
});

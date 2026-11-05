import test from 'node:test';
import assert from 'node:assert/strict';
import {containsRange,validRange,mergeDelta} from '../src/data-window.js';
import {aggregate,normalizeReportBudgets,carryoverBefore} from '../src/domain.js';
test('Scoped snapshots preserve historical carryover without re-spending it',()=>{
 const reports=[{id:'old',accountId:'a',date:'2026-10-20',status:'submitted',_carryContext:true,_normalized:true,entries:[{productId:'p',remaining:3000000,budget:3000000}]},{id:'new',accountId:'a',date:'2026-11-02',status:'submitted',_normalized:true,entries:[{productId:'p',received:1000000,carryover:3000000,budget:4000000,remaining:1000000,data:100}]}];
 assert.equal(aggregate({reports,orders:[]},['2026-11-01','2026-11-30']).total.spend,3000000);assert.equal(normalizeReportBudgets(reports)[1].entries[0].budget,4000000);assert.equal(carryoverBefore(reports,'a','p','2026-11-03').amount,1000000);
});
test('Delta merging preserves unaffected data, deletes rows and ignores older revisions',()=>{
 const db={scope:{from:'2026-11-01',to:'2026-11-30'},orders:[{id:'a',revision:2},{id:'b',revision:1},{id:'c',revision:1}],reports:[],products:[],accounts:[],assignments:[],targets:[]};
 const r=mergeDelta(db,{kind:'delta',viewer:{id:'u'},upsert:{orders:[{id:'a',revision:1},{id:'b',revision:2},{id:'d',revision:1}]},removed:{orders:['c']}});
 assert.deepEqual(r.orders.map(x=>[x.id,x.revision]),[['a',2],['b',2],['d',1]]);assert.equal(r.scope,db.scope);assert.equal(db.orders.length,3);
});
test('Range validation and containment prevent invalid or excessive loads',()=>{assert.equal(validRange(['2026-11-02','2026-11-01']),false);assert.equal(validRange(['2020-01-01','2026-11-01']),true);assert.equal(validRange(['1900-01-01','2026-11-01']),false);assert.equal(containsRange({from:'2026-11-01',to:'2026-11-30'},['2026-11-04','2026-11-04']),true);assert.equal(containsRange({from:'2026-11-01',to:'2026-11-30'},['2026-10-31','2026-11-04']),false);});

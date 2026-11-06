import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createEngine,sha,TABLES} from '../server/engine.js';
import {aggregate,productSummary} from '../src/domain.js';
import {saleSummary} from '../src/roles.js';
import {reportEditorModel} from '../src/report-editor.js';
import {mergeDelta} from '../src/data-window.js';
import {appointmentCount} from '../src/appointments.js';
const date='2026-11-04',next='2026-11-05',entry={productId:'p',received:0,budget:0,remaining:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0};
function setup(){let state={Accounts:[['m1','user'],['m2','user'],['s1','sale'],['s2','sale'],['admin','admin']].map(([id,role])=>({id,role,ownerName:id,username:id,active:true})),Products:[{id:'p',name:'P',active:true}],Assignments:['m1','m2','s1','s2'].map(accountId=>({id:accountId+'p',accountId,productId:'p',active:true})),Sessions:['m1','m2','s1','s2','admin'].map(accountId=>({id:sha(accountId),accountId,expires:Date.now()+3600000})),Reports:['m1','s1'].map(accountId=>({id:'report-'+accountId,accountId,date,status:'submitted',revision:1,entries:[{...entry}]}))};return {rows:table=>state[table]||[],call(action,payload={},actor='m1',requestId=randomUUID().replaceAll('-','')){const engine=createEngine(state);const result=engine.execute({action,payload,token:actor,requestId});state=Object.fromEntries(TABLES.map(table=>[table,engine.rows(table)]));return result;}};}
const create={accountId:'m1',saleAccountId:'s1',productId:'p',date,customerName:'Anna',note:'',status:'pending'};
test('MKT and SALE can add appointments; report counts increment and decrement for both without creating revenue orders',()=>{
 const x=setup();x.call('saveAppointment',create);x.call('saveAppointment',{...create,customerName:'Tina'},'s1');assert.equal(x.rows('Appointments').length,2);assert.equal(x.rows('Orders').length,0);
 for(const r of x.rows('Reports'))assert.equal(r.entries[0].appointments,2);
 const first=x.rows('Appointments')[0];x.call('saveAppointment',{...first,status:'converted'});for(const r of x.rows('Reports'))assert.equal(r.entries[0].appointments,1);
 const second=x.rows('Appointments')[1];x.call('saveAppointment',{...second,status:'cancelled'},'s1');for(const r of x.rows('Reports'))assert.equal(r.entries[0].appointments,0);
 const current=x.rows('Appointments')[0];x.call('saveAppointment',{...current,status:'pending'},'admin');for(const r of x.rows('Reports'))assert.equal(r.entries[0].appointments,1);
 assert.equal(x.rows('Appointments').length,2);assert.ok(x.rows('Audit').some(a=>a.action==='appointmentsRecomputed'));
});
test('Appointment edits enforce assignment, ownership, revisions and idempotent saves',()=>{
 const x=setup(),id='appointment-idempotency';x.call('saveAppointment',create,'m1',id);x.call('saveAppointment',create,'m1',id);assert.equal(x.rows('Appointments').length,1);const row=x.rows('Appointments')[0];
 assert.throws(()=>x.call('saveAppointment',{...row,status:'cancelled'},'m2'),e=>e.code==='FORBIDDEN');assert.throws(()=>x.call('saveAppointment',{...row,status:'cancelled'},'s2'),e=>e.code==='FORBIDDEN');assert.throws(()=>x.call('saveAppointment',{...create,productId:'unknown'}),e=>e.code==='FORBIDDEN'||e.code==='VALIDATION_ERROR');assert.throws(()=>x.call('saveAppointment',{...create,status:'other'}));
 x.call('saveAppointment',{...row,status:'cancelled'});assert.throws(()=>x.call('saveAppointment',{...row,status:'pending'}),e=>e.code==='CONFLICT');assert.throws(()=>x.call('saveAppointment',create,'admin'),/Admin/);
 const own=x.call('bootstrap',{from:date,to:next},'s1');assert.equal(own.appointments.length,1);const other=x.call('bootstrap',{from:date,to:next},'m2');assert.equal(other.appointments.length,0);
});
test('Moving an appointment updates old/new dates and reassigned accounts, never leaving a negative count',()=>{
 const x=setup();x.call('saveAppointment',create);const row=x.rows('Appointments')[0];x.call('saveAppointment',{...row,date:next,accountId:'m2',saleAccountId:'s2'},'admin');for(const r of x.rows('Reports'))assert.equal(r.entries[0].appointments,0);
 assert.equal(appointmentCount(x.rows('Appointments'),'m2',next,'p'),1);assert.equal(appointmentCount(x.rows('Appointments'),'s2',next,'p','sale'),1);
});
test('Monthly, detailed and SALE summaries count pending appointments once, including days without a submitted report',()=>{
 const db={accounts:[{id:'m1',role:'user'},{id:'s1',role:'sale'}],products:[{id:'p',name:'P'}],assignments:[{accountId:'m1',productId:'p',active:true},{accountId:'s1',productId:'p',active:true}],targets:[],orders:[],reports:[{id:'r',accountId:'m1',date,status:'submitted',entries:[{...entry,appointments:99}]}],appointments:[{...create,id:'1'},{...create,id:'2',date:next},{...create,id:'3',status:'cancelled'}]};
 const range=[date,next];assert.equal(aggregate(db,range,'m1').total.appointments,2);assert.equal(productSummary(db,range,'m1').total.appointments,2);assert.equal(reportEditorModel(db,db.reports[0]).entries[0].appointments,1);assert.equal(saleSummary(db,range,'s1').total.appointments,2);
 const bootstrap={...db,appointments:[]},nextDb=mergeDelta(bootstrap,{kind:'delta',viewer:db.accounts[0],upsert:{appointments:db.appointments},removed:{}});assert.equal(nextDb.appointments.length,3);
});
test('Manually entered legacy counts remain readable until a matching appointment list manages that date and product',()=>{
 assert.equal(appointmentCount([], 'm1',date,'p','user',3),3);assert.equal(appointmentCount([{...create,status:'converted'}],'m1',date,'p','user',3),0);
});
test('A report save cannot replace managed appointment counts with manually supplied values',()=>{
 const x=setup();x.call('saveAppointment',create);const report=x.rows('Reports').find(r=>r.accountId==='m1');x.call('saveReport',{accountId:'m1',date,status:'submitted',revision:report.revision,entries:report.entries.map(e=>({...e,appointments:999}))},'admin');assert.equal(x.rows('Reports').find(r=>r.accountId==='m1').entries[0].appointments,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,pbkdf2Sync,randomUUID} from 'node:crypto';
import {createEngine,sha} from '../server/engine.js';
import {passwordDigest,passwordRecord} from '../server/passwords.js';
import {normalizeBudgets,previewTransferBudget} from '../src/budget-transfers.js';
import {aggregate,previousDay} from '../src/domain.js';
import {validateImport} from '../server/import-validation.js';
process.env.SL_AUTH_PEPPER='test-pepper-only';
const b64=x=>x.toString('base64').replaceAll('+','-').replaceAll('/','_');
const date=previousDay(),prior=new Date(Date.parse(date)-86400000).toISOString().slice(0,10);
const entry=(id,extra={})=>({productId:id,budget:0,remaining:0,received:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,...extra});
function setup(){
 const initial={Accounts:[{id:'u',role:'user',username:'truc',ownerName:'Trúc',active:true},{id:'v',role:'user',username:'other',ownerName:'Other',active:true},{id:'admin',role:'admin',username:'tam',ownerName:'Tâm',active:true},{id:'s',role:'sale',username:'sale',ownerName:'SALE',active:true}],Products:['p','q','r'].map(id=>({id,name:id,active:true,priceUsd:10,rate:22500})),Assignments:['p','q','r'].map(productId=>({id:productId+'u',accountId:'u',productId,active:true})),Sessions:['u','v','admin','s'].map(id=>({id:sha('token-'+id),accountId:id,expires:Date.now()+3600000}))};
 let current=initial;
 return {set(table,rows){current[table]=structuredClone(rows);},rows(table){return current[table]||[];},call(action,payload={},user='admin',requestId=randomUUID().replaceAll('-','')){
  const engine=createEngine(current),result=engine.execute({protocol:2,action,payload,token:'token-'+user,requestId});
  current=Object.fromEntries(['Accounts','Products','Assignments','Sessions','Reports','Orders','Targets','Audit','Notifications','ReportRequests','TargetRequests'].map(k=>[k,engine.rows(k)]));return result;
 }};
}
test('MKT data ktt and order/upsale counters are server-derived by account/product/day',()=>{
 const x=setup();x.set('Orders',[{id:'o1',accountId:'u',productId:'p',date,type:'sale'},{id:'o2',accountId:'u',productId:'p',date,type:'upsale',isSplit:true},{id:'o3',accountId:'u',productId:'p',date,type:'sale',isBounced:true},{id:'o4',accountId:'v',productId:'p',date,type:'sale'},{id:'o5',accountId:'u',productId:'q',date,type:'sale'}]);
 x.call('saveReport',{accountId:'u',date,status:'submitted',revision:0,entries:[entry('p',{data:10,tt:6,ktt:900,success:50,upsale:12})]});
 const e=x.rows('Reports')[0].entries[0];assert.equal(e.ktt,4);assert.equal(e.success,1);assert.equal(e.upsale,.5);
 assert.throws(()=>x.call('saveReport',{accountId:'u',date,status:'submitted',revision:1,entries:[entry('p',{data:3,tt:5})]}),/không thể vượt/);
});
test('One opening balance can be split across several products days later without new funding',()=>{
 const reports=[{id:'old',accountId:'u',date:prior,status:'submitted',entries:[entry('p',{received:1000,remaining:800}),entry('q'),entry('r')]},{id:'today',accountId:'u',date,status:'submitted',entries:[entry('p',{remaining:300}),entry('q',{remaining:200}),entry('r',{remaining:100})],transfers:[{fromProductId:'p',toProductId:'q',amount:300},{fromProductId:'p',toProductId:'r',amount:200}]}];
 const rows=normalizeBudgets(reports)[1].entries;assert.deepEqual(rows.map(e=>e.budget),[300,300,200]);assert.equal(rows.reduce((n,e)=>n+e.budget,0),800);
 const preview=previewTransferBudget(reports.slice(0,1),'u',date,reports[1].entries,reports[1].transfers);assert.deepEqual(preview.map(e=>e.budget),[300,300,200]);
});
test('Overdraw, same-product, negative, fractional and circular same-day funding transfers fail',()=>{
 const base=[{accountId:'u',date:prior,status:'submitted',entries:[entry('p',{received:100,remaining:100}),entry('q')]},{accountId:'u',date,status:'submitted',entries:[entry('p'),entry('q')]}];
 for(const transfers of [[{fromProductId:'p',toProductId:'q',amount:101}],[{fromProductId:'p',toProductId:'p',amount:1}],[{fromProductId:'p',toProductId:'q',amount:-1}],[{fromProductId:'p',toProductId:'q',amount:.5}],[{fromProductId:'p',toProductId:'q',amount:50},{fromProductId:'q',toProductId:'p',amount:50}]])assert.throws(()=>normalizeBudgets([base[0],{...base[1],transfers}]));
});
test('Editing old remaining cannot invalidate a later transfer; failed engine writes never reach storage',()=>{
 const x=setup();x.call('saveReport',{accountId:'u',date:prior,status:'submitted',entries:[entry('p',{received:1000,remaining:800}),entry('q')],revision:0});
 x.call('saveReport',{accountId:'u',date,status:'submitted',entries:[entry('p'),entry('q')],transfers:[{fromProductId:'p',toProductId:'q',amount:700}],revision:0});
 assert.throws(()=>x.call('saveReport',{accountId:'u',date:prior,status:'submitted',entries:[entry('p',{received:1000,remaining:600}),entry('q')],revision:1}),/vượt số dư/);
 assert.equal(x.rows('Reports').find(r=>r.date===prior).entries[0].remaining,800);
});
test('User cannot transfer another account or unassigned product; admin creates and deletes reports with notifications',()=>{
 const x=setup();assert.throws(()=>x.call('saveReport',{accountId:'v',date,status:'submitted',entries:[entry('p')],revision:0},'u'),/quyền/);
 x.call('saveReport',{accountId:'u',date,status:'submitted',entries:[entry('p')],revision:0});const report=x.rows('Reports')[0];
 assert.ok(x.rows('Notifications').some(n=>n.recipientId==='u'&&n.entityType==='Reports'));
 assert.throws(()=>x.call('deleteReport',{id:report.id,revision:1},'u'),/admin/);
 x.call('deleteReport',{id:report.id,revision:1});assert.equal(x.rows('Reports').length,0);assert.ok(x.rows('Audit').some(a=>a.action==='reportDeleted'));
 assert.ok(x.rows('Notifications').some(n=>n.entityId===report.id&&n.deleted));
});
test('Admin requests an old date, user can fill exactly that date and request completes',()=>{
 const x=setup(),old='2025-01-02';x.call('requestReport',{accountId:'u',date:old,kind:'fill',reason:'Bổ sung'});
 const req=x.rows('ReportRequests')[0];assert.equal(req.status,'pending');
 assert.ok(x.rows('Notifications').some(n=>n.recipientId==='u'&&n.target.report?.date===old));
 assert.throws(()=>x.call('saveReport',{accountId:'u',date:'2025-01-03',status:'submitted',revision:0,entries:['p','q','r'].map(id=>entry(id))},'u'),/7 ngày/);
 x.call('saveReport',{accountId:'u',date:old,status:'submitted',revision:0,entries:['p','q','r'].map(id=>entry(id))},'u');assert.equal(x.rows('ReportRequests')[0].status,'completed');
 assert.throws(()=>x.call('requestReport',{accountId:'v',date,kind:'correct',reason:''},'u'),/admin/);
});
test('New backend preserves duplicate order confirmation and deterministic retry receipts',()=>{
 const x=setup(),payload={accountId:'u',productId:'p',date,customerName:'Tina',type:'sale',amountUsd:10,rate:22500};
 const requestId=randomUUID().replaceAll('-','');x.call('saveOrder',payload,'u',requestId);x.call('saveOrder',payload,'u',requestId);assert.equal(x.rows('Orders').length,1);
 assert.throws(()=>x.call('saveOrder',payload,'u'),e=>e.code==='DUPLICATE_ORDER');
 x.call('saveOrder',{...payload,confirmDuplicate:true},'u');assert.equal(x.rows('Orders').length,2);
 assert.throws(()=>x.call('saveOrder',{...payload,amountUsd:99},'u',requestId),/dữ liệu khác/);
});
test('Admin report rows split sale, upsale and care with split/bounced semantics',()=>{
 const db={reports:[],orders:[{accountId:'u',date,productId:'p',type:'sale',amountVnd:100},{accountId:'u',date,productId:'p',type:'upsale',amountVnd:200,isSplit:true},{accountId:'u',date,productId:'p',type:'sale',isCare:true,amountVnd:300},{accountId:'u',date,productId:'p',type:'care',isBounced:true,amountVnd:999}]};
 const {total}=aggregate(db,[date,date]);assert.equal(total.success,1);assert.equal(total.upsale,.5);assert.equal(total.careOnlyCount,1);assert.equal(total.orderCount,2.5);assert.equal(total.upsaleRevenue,200);assert.equal(total.careOnlyRevenue,300);
});
test('Password migration matches old PBKDF2 + HMAC over web-safe base64 including padding',()=>{
 const a={salt:'old-salt',iterations:20000,pepperVersion:1},derived=b64(pbkdf2Sync('tam123',a.salt,20000,32,'sha256'));
 const expected=b64(createHmac('sha256',process.env.SL_AUTH_PEPPER).update(derived).digest());assert.equal(passwordDigest('tam123',a),expected);
 const fresh=passwordRecord('tam123');assert.equal(passwordDigest('tam123',fresh),fresh.passwordHash);assert.notEqual(passwordDigest('wrong123',fresh),fresh.passwordHash);
});
test('Import preserves IDs and orders, derives ktt and rejects broken references/duplicates',()=>{
 const input={format:'so-lieu-export',version:1,tables:{Accounts:[{id:'u',username:'tam',role:'admin',active:true,...passwordRecord('tam123')}],Products:[{id:'p'}],Reports:[{id:'r',accountId:'u',date,status:'submitted',entries:[entry('p',{data:10,tt:4,ktt:99})]}],Orders:[{id:'o',accountId:'u',productId:'p',date,amountVnd:5}]}};
 const imported=validateImport(input);assert.equal(imported.Reports[0].entries[0].ktt,6);assert.deepEqual(imported.Orders,input.tables.Orders);
 const bad=structuredClone(input);bad.tables.Reports[0].entries[0].productId='missing';assert.throws(()=>validateImport(bad),/Sản phẩm/);
 bad.tables.Reports=[];bad.tables.Orders.push({...bad.tables.Orders[0]});assert.throws(()=>validateImport(bad),/trùng/);
});
test('Engines never share mutable tables or session state between requests',()=>{
 const a=setup(),b=setup();a.call('requestReport',{accountId:'u',date,kind:'correct',reason:'only a'});assert.equal(b.rows('ReportRequests').length,0);assert.throws(()=>createEngine({}).execute({action:'bootstrap',payload:{},token:'token-u'}),e=>e.code==='UNAUTHENTICATED');
});

test('MKT saves transfers without approval and cannot split 900 into two transfers of 600',()=>{
 const x=setup();
 x.call('saveReport',{date:prior,status:'submitted',revision:0,entries:[entry('p',{received:1000,remaining:900}),entry('q'),entry('r')]},'u');
 const entries=[entry('p'),entry('q'),entry('r')];
 const tooMuch=[{fromProductId:'p',toProductId:'q',amount:600},{fromProductId:'p',toProductId:'r',amount:600}];
 assert.throws(()=>previewTransferBudget(x.rows('Reports'),'u',date,entries,tooMuch),/vượt số dư/);
 assert.throws(()=>x.call('saveReport',{date,status:'submitted',revision:0,entries,transfers:tooMuch},'u'),/vượt số dư/);
 assert.equal(x.rows('Reports').length,1);
 x.call('saveReport',{date,status:'submitted',revision:0,entries,transfers:[{fromProductId:'p',toProductId:'q',amount:600},{fromProductId:'p',toProductId:'r',amount:300}]},'u');
 const saved=x.rows('Reports').find(r=>r.date===date);assert.equal(saved.status,'submitted');assert.deepEqual(saved.entries.map(e=>e.budget),[0,600,300]);
});
test('Neither admin nor the owner can change report dates, including requested reports; history stays private',()=>{
 const x=setup();x.call('saveReport',{accountId:'u',date:prior,status:'submitted',revision:0,entries:[entry('p'),entry('q'),entry('r')]});const report=x.rows('Reports')[0];
 assert.throws(()=>x.call('changeReportDate',{id:report.id,date,revision:report.revision}),e=>e.code==='FORBIDDEN');
 x.call('requestReport',{accountId:'u',date,kind:'correct',reason:'Sửa ngày'});assert.throws(()=>x.call('changeReportDate',{id:report.id,date,revision:report.revision},'u'),e=>e.code==='FORBIDDEN');assert.equal(x.rows('Reports')[0].date,prior);
 assert.ok(Array.isArray(x.call('reportHistory',{id:report.id},'u').audit));assert.throws(()=>x.call('reportHistory',{id:report.id},'v'),e=>e.code==='FORBIDDEN');
});
test('Remembered login and cookie lifetime agree on 30 days while ordinary sessions stay 12 hours',async()=>{
 const {sessionMaxAge}=await import('../server/session-policy.js');const x=setup();x.set('Accounts',[{id:'u',role:'user',username:'truc',ownerName:'Trúc',active:true,...passwordRecord('truc123')}]);
 for(const rememberMe of [true,false]){const start=Date.now();x.call('login',{username:'truc',password:'truc123',rememberMe},'u');const sessions=x.rows('Sessions'),expected=sessionMaxAge(rememberMe)*1000;const newest=Math.max(...sessions.map(s=>s.expires));assert.ok(newest>=start+expected&&newest<=Date.now()+expected);if(rememberMe)x.set('Sessions',[]);}
 assert.equal(sessionMaxAge(true),2592000);assert.equal(sessionMaxAge(false),43200);
 const fs=await import('node:fs/promises');const route=await fs.readFile(new URL('../app/api/rpc/route.js',import.meta.url),'utf8');assert.ok(route.includes('maxAge:sessionMaxAge(req.payload?.rememberMe)'));assert.ok(route.includes('httpOnly:true'));
});

test('Setting a display priority that collides bumps the other user up',()=>{
 const x=setup();
 x.call('saveAccount',{id:'u',username:'truc',ownerName:'Trúc',role:'user',priority:1,revision:0});
 assert.equal(x.rows('Accounts').find(a=>a.id==='u').priority,1);
 x.call('saveAccount',{id:'v',username:'other',ownerName:'Other',role:'user',priority:1,revision:0});
 assert.equal(x.rows('Accounts').find(a=>a.id==='v').priority,1);
 assert.equal(x.rows('Accounts').find(a=>a.id==='u').priority,2);
 assert.throws(()=>x.call('saveAccount',{id:'v',username:'other',ownerName:'Other',role:'user',priority:0,revision:1}),/Thứ tự hiển thị/);
});
test('Admin can create orders for themselves and in bulk',()=>{
 const x=setup();
 x.call('saveOrder',{accountId:'admin',productId:'p',date,customerName:'Admin Khách',type:'sale',amountUsd:10,rate:22500});
 assert.equal(x.rows('Orders').length,1);assert.equal(x.rows('Orders')[0].accountId,'admin');
 x.call('saveOrdersBulk',{rows:[{accountId:'admin',productId:'q',date,customerName:'Lô admin',type:'sale',amountUsd:5,rate:22500}],batchId:'bulk-admin-1'});
 assert.equal(x.rows('Orders').length,2);
 assert.throws(()=>x.call('saveOrder',{accountId:'u',productId:'p',date,customerName:'X',type:'sale',amountUsd:1,rate:22500},'v'),/quyền/);
});
test('Admin requests a missing monthly target, the user is notified, and saving targets completes it',()=>{
 const x=setup(),month='2026-11';
 x.call('requestTarget',{accountId:'u',month,reason:'Gửi mục tiêu tháng 11'});
 const req=x.rows('TargetRequests')[0];assert.equal(req.status,'pending');
 assert.ok(x.rows('Notifications').some(n=>n.recipientId==='u'&&n.entityType==='TargetRequests'&&n.target.page==='targets'&&n.target.month===month));
 assert.throws(()=>x.call('requestTarget',{accountId:'u',month,reason:''},'u'),/admin/);
 x.call('saveTargets',{accountId:'u',month,targets:[{productId:'p',revision:0,revenue:1000000,care:0}],salary:0},'u');
 assert.equal(x.rows('TargetRequests')[0].status,'completed');
});
test('Any user can change their own password with the current one; other sessions are signed out',()=>{
 const x=setup();
 x.set('Accounts',[{id:'u',role:'user',username:'truc',ownerName:'Trúc',active:true,...passwordRecord('truc123')}]);
 x.set('Sessions',[{id:sha('token-u'),accountId:'u',expires:Date.now()+3600000},{id:sha('token-u2'),accountId:'u',expires:Date.now()+3600000}]);
 assert.throws(()=>x.call('changePassword',{currentPassword:'sai123',newPassword:'moi12345'},'u'),/không đúng/);
 x.call('changePassword',{currentPassword:'truc123',newPassword:'moi12345'},'u');
 assert.equal(x.rows('Sessions').length,1);
 assert.equal(x.rows('Sessions')[0].id,sha('token-u'));
 x.call('login',{username:'truc',password:'moi12345',rememberMe:false},'u');
 assert.throws(()=>x.call('login',{username:'truc',password:'truc123',rememberMe:false},'u'),/không đúng/);
});

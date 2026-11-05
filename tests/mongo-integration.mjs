// Isolated replica set; no production URI or credentials are used.
import assert from 'node:assert/strict';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {randomUUID} from 'node:crypto';
const repl=await MongoMemoryReplSet.create({replSet:{count:1},binary:{version:'7.0.24'}});
process.env.MONGODB_URI=repl.getUri();process.env.MONGODB_DB='sl_integration';process.env.SL_AUTH_PEPPER='isolated-test-pepper';
const {connection,createIndexes}=await import('../server/mongodb.js');
const {handleRequest}=await import('../server/service.js');
const {passwordRecord}=await import('../server/passwords.js');
const {previousDay}=await import('../src/domain.js');
const date=previousDay(),prior=new Date(Date.parse(date)-86400000).toISOString().slice(0,10);
const {client,db}=await connection();
const entry=(id,extra={})=>({productId:id,budget:0,remaining:0,received:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,...extra});
let count=0;const check=(a,b)=>{assert.deepEqual(a,b);count++;};
try{
 await createIndexes(db);
 await db.collection('Accounts').insertMany([{id:'admin',username:'tam',ownerName:'Tâm',role:'admin',active:true,...passwordRecord('tam123')},{id:'u',username:'truc',ownerName:'Trúc',role:'user',active:true,...passwordRecord('truc123')}]);
 await db.collection('Products').insertMany(['p','q','r'].map(id=>({id,name:id,priceUsd:10,rate:22500,active:true})));
 await db.collection('Assignments').insertMany(['p','q','r'].map(productId=>({id:productId+'u',accountId:'u',productId,active:true})));
 const call=(action,payload={},token,requestId=randomUUID().replaceAll('-',''))=>handleRequest({action,payload,token,requestId},{ip:'test-ip'});
 const admin=await call('login',{username:'tam',password:'tam123'}),user=await call('login',{username:'truc',password:'truc123'});
 check(admin.user.role,'admin');check(user.db.accounts.map(a=>a.id),['u']);
 await call('saveReport',{accountId:'u',date:prior,status:'submitted',entries:[entry('p',{received:1000,remaining:800}),entry('q'),entry('r')],revision:0},admin.token);
 await call('saveReport',{accountId:'u',date,status:'submitted',entries:[entry('p'),entry('q'),entry('r')],transfers:[{fromProductId:'p',toProductId:'q',amount:300},{fromProductId:'p',toProductId:'r',amount:200}],revision:0},admin.token);
 check((await db.collection('Reports').findOne({date})).entries.map(e=>e.budget),[300,300,200]);
 const old=await db.collection('Reports').findOne({date:prior});
 await assert.rejects(call('saveReport',{accountId:'u',date:prior,status:'submitted',entries:[entry('p',{received:1000,remaining:200}),entry('q'),entry('r')],revision:old.revision},admin.token),/vượt số dư/);count++;
 check((await db.collection('Reports').findOne({date:prior})).entries[0].remaining,800);
 const requestId=randomUUID().replaceAll('-',''),order={productId:'p',date,customerName:'Tina',type:'sale',amountUsd:10,rate:22500};
 await Promise.all([call('saveOrder',order,user.token,requestId),call('saveOrder',order,user.token,requestId)]);
 check(await db.collection('Orders').countDocuments({}),1);
 // Two editors have the same base revision; exactly one may commit.
 const current=await db.collection('Reports').findOne({date});
 const changes=[10,20].map(data=>call('saveReport',{accountId:'u',date,status:'submitted',entries:current.entries.map(e=>e.productId==='p'?{...e,data,tt:5}:e),transfers:current.transfers,revision:current.revision},admin.token));
 const results=await Promise.allSettled(changes);check(results.filter(r=>r.status==='fulfilled').length,1);check(results.filter(r=>r.status==='rejected').length,1);
 const saved=await db.collection('Reports').findOne({date});check(saved.entries[0].success,1);check(saved.entries[0].ktt,saved.entries[0].data-5);
 await call('requestReport',{accountId:'u',date:'2025-01-01',kind:'fill',reason:'Bổ sung'},admin.token);
 const feed=await call('notifications',{},user.token);assert.ok(feed.items.some(n=>n.entityType==='ReportRequests'));count++;
 await call('saveReport',{accountId:'u',date:'2025-01-01',status:'submitted',entries:['p','q','r'].map(id=>entry(id)),revision:0},user.token);
 check((await db.collection('ReportRequests').findOne({date:'2025-01-01'})).status,'completed');
 const report=await db.collection('Reports').findOne({date:'2025-01-01'});await call('deleteReport',{id:report.id,revision:report.revision},admin.token);check(await db.collection('Reports').countDocuments({id:report.id}),0);
 check(await db.collection('Orders').countDocuments({}),1);
 await call('logout',{},user.token);await assert.rejects(call('bootstrap',{},user.token),e=>e.code==='UNAUTHENTICATED');count++;
 console.log('MongoDB replica-set integration: '+count+' checks passed, including concurrent writes, retry receipts and rollback.');
}finally{await client.close();await repl.stop();}

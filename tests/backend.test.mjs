import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const code=fs.readFileSync(new URL('../backend/Code.gs',import.meta.url),'utf8');
test('New and edited account passwords accept 6–20 characters and reject outside bounds',()=>{
 const {c}=runtime(),base={ownerName:'Test',username:'test'};
 for(const length of [6,20])assert.doesNotThrow(()=>c.checkAccount_({...base,password:'x'.repeat(length)},true));
 for(const length of [5,21])assert.throws(()=>c.checkAccount_({...base,password:'x'.repeat(length)},true));
 assert.doesNotThrow(()=>c.checkAccount_({...base,password:''},false));
});
function runtime(options={}){
 const fault={table:null},reads=new Map(),sheets=new Map(),props=new Map([['SL_SPREADSHEET_ID','test']]),cache=new Map();
 function sheet(name){if(!sheets.has(name))sheets.set(name,[['id','json']]);const data=sheets.get(name);return {getLastRow:()=>data.length,getRange:(r,c,n=1,m=1)=>({getValues:()=>{reads.set(name,(reads.get(name)||0)+1);return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>data[r-1+i]?.[c-1+j]??''));},setValues:values=>{if(fault.table===name){fault.table=null;throw Error('simulated Google service failure');}values.forEach((row,i)=>{data[r-1+i]??=[];row.forEach((v,j)=>data[r-1+i][c-1+j]=v);});}}),deleteRow:r=>data.splice(r-1,1)};}
 const signed=b=>Array.from(b,x=>x>127?x-256:x);
 const context=vm.createContext({console,Date,JSON,Math,Number,String,Error,Array,Object,RegExp,Utilities:{getUuid:()=>crypto.randomUUID(),newBlob:s=>({getBytes:()=>signed(Buffer.from(s))}),computeHmacSha256Signature:(message,key)=>signed(crypto.createHmac('sha256',Buffer.from(key.map(x=>x&255))).update(Buffer.from(message.map(x=>x&255))).digest()),base64EncodeWebSafe:b=>Buffer.from(b.map(x=>x&255)).toString('base64url')+'=',computeDigest:(_,s)=>signed(crypto.createHash('sha256').update(s).digest()),DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'utf8'}},SpreadsheetApp:{openById:()=>({getSheetByName:sheet})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})}});
 vm.runInContext(code,context);context.PBKDF_ITERATIONS_=2;
 // Freeze the policy window; legacy fixture tests isolate old carryover/migration behavior.
 context.reportWindow_=()=>({from:'2026-10-29',to:'2026-11-04'});
 if(options.legacyTimeline)context.checkReportSequence_=()=>{};
 const put=(name,value)=>context.put_(name,value);
 const account={id:'a',username:'linh',ownerName:'Linh',role:'user',active:true};
 put('Accounts',account);put('Accounts',{id:'b',username:'other',ownerName:'Other',role:'user',active:true});put('Accounts',{id:'admin',username:'admin',ownerName:'Admin',role:'admin',active:true});put('Products',{id:'p',name:'Toma',active:true,priceUsd:99,rate:22500});put('Products',{id:'secret',name:'Hidden',active:true,priceUsd:199,rate:22500});put('Assignments',{id:'ap',accountId:'a',productId:'p',active:true});
 const post=(action,payload={},token='token-a')=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({action,payload,token})}}));
 for(const id of ['a','b','admin'])put('Sessions',{id:context.sha_('token-'+id),accountId:id,expires:Date.now()+1000000});
 const postV2=(action,payload={},token='token-a',requestId=crypto.randomUUID().replaceAll('-',''))=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({protocol:2,action,payload,token,requestId})}}));
 return {c:context,post,postV2,put,reads,fault};
}
const entries=[{productId:'p',budget:100,remaining:20,data:10,tt:7,ktt:3,success:2,upsale:0,appointments:1,late:0}];
test('API hides unassigned products and other accounts',()=>{const {post}=runtime();const r=post('bootstrap');assert.equal(r.ok,true);assert.deepEqual(r.data.products.map(p=>p.id),['p']);assert.deepEqual(r.data.accounts.map(p=>p.id),['a']);assert.equal(post('bootstrap',{},'wrong').ok,false);});
test('API denies user admin mutations and cross-account writes',()=>{const {post}=runtime();for(const a of ['saveProduct','saveAccount','assign','reopen','saveTargets'])assert.equal(post(a,{}).ok,false,a);assert.equal(post('saveReport',{accountId:'b',date:'2026-11-04',entries,status:'draft'}).ok,false);assert.equal(post('saveReport',{accountId:'a',date:'2026-11-04',entries:[{...entries[0],productId:'secret'}],status:'draft'}).ok,false);});
test('User edits submitted reports, stale revisions are rejected and admin can reopen',()=>{
 const {post}=runtime();let r=post('saveReport',{date:'2026-11-04',entries,status:'submitted',revision:0});assert.equal(r.ok,true);const record=r.data.reports[0];
 r=post('saveReport',{date:'2026-11-04',entries:[{...entries[0],data:88}],status:'submitted',revision:1});assert.equal(r.ok,true);assert.equal(r.data.reports[0].revision,2);assert.equal(r.data.reports[0].entries[0].data,88);
 assert.equal(post('saveReport',{date:'2026-11-04',entries,status:'submitted',revision:1}).ok,false);
 assert.equal(post('reopen',{id:record.id},'token-admin').ok,true);
 assert.equal(post('saveReport',{date:'2026-11-04',entries,status:'draft',revision:2}).ok,false);
 assert.equal(post('saveReport',{date:'2026-11-04',entries,status:'draft',revision:3}).ok,true);
});
test('API prevents duplicate entries, bad counts and negative budgets',()=>{const {post}=runtime();for(const ent of [[...entries,...entries],[{...entries[0],remaining:101}],[{...entries[0],data:1.5}],[{...entries[0],budget:-1}]])assert.equal(post('saveReport',{date:'2026-11-04',entries:ent,status:'draft'}).ok,false);});
test('Order revenue is calculated on server and ownership enforced',()=>{const {post}=runtime();const r=post('saveOrder',{productId:'p',date:'2026-11-04',customerName:'Test',type:'care',amountUsd:100,rate:22500,amountVnd:1});assert.equal(r.ok,true);assert.equal(r.data.orders[0].amountVnd,2250000);const id=r.data.orders[0].id;assert.equal(post('deleteOrder',{id},'token-b').ok,false);assert.equal(post('deleteOrder',{id}).ok,true);});
test('Target price snapshot survives product price changes',()=>{const {post}=runtime();const p={month:'2026-11',accountId:'a',salary:20000000,targets:[{productId:'p',revenue:10000000,care:2000000}]};let r=post('saveTargets',p,'token-admin');assert.equal(r.ok,true);assert.equal(r.data.targets[0].priceUsd,99);post('saveProduct',{id:'p',name:'Toma',priceUsd:199,rate:22500,active:true},'token-admin');r=post('saveTargets',{...p,targets:p.targets.map(t=>({...t,revision:1}))},'token-admin');assert.equal(r.data.targets[0].priceUsd,99);});
test('PBKDF2 matches Node standard and login does not expose password hashes',()=>{const {c,put,post}=runtime();const salt='salt-test',password='long-test-password';const actual=c.pbkdf_(password,salt,2);const expected=crypto.pbkdf2Sync(password,salt,2,32,'sha256').toString('base64url')+'=';assert.equal(actual,expected);put('Accounts',{id:'a',username:'linh',ownerName:'Linh',role:'user',active:true,salt,iterations:2,passwordHash:actual});const result=post('login',{username:'linh',password});assert.equal(result.ok,true);assert.equal(result.data.user.passwordHash,undefined);assert.ok(result.data.token);assert.equal(post('bootstrap',{},result.data.token).ok,true);});

 test('Report date can change within owner scope without duplicate dates or lost sent timestamp',()=>{const {post}=runtime({legacyTimeline:true});let r=post('saveReport',{date:'2026-11-01',entries,status:'submitted',revision:0});const report=r.data.reports[0];assert.equal(post('changeReportDate',{id:report.id,date:'2026-11-02',revision:1},'token-b').ok,false);r=post('changeReportDate',{id:report.id,date:'2026-11-02',revision:1});assert.equal(r.ok,true);assert.equal(r.data.reports[0].date,'2026-11-02');assert.equal(r.data.reports[0].submittedAt,report.submittedAt);assert.equal(r.data.reports[0].status,'submitted');post('saveReport',{date:'2026-11-03',entries,status:'draft',revision:0});assert.equal(post('changeReportDate',{id:report.id,date:'2026-11-03',revision:2}).ok,false);});

test('Order API persists care/split flags and accepts upsale, rejects nonboolean flags',()=>{
 const {post}=runtime();const base={productId:'p',date:'2026-11-04',customerName:'Shared upsale',type:'upsale',isCare:true,isSplit:true,amountUsd:100,rate:22500};
 let r=post('saveOrder',base);assert.equal(r.ok,true);let order=r.data.orders[0];assert.equal(order.isCare,true);assert.equal(order.isSplit,true);assert.equal(order.type,'upsale');assert.equal(order.amountVnd,2250000);
 r=post('saveOrder',{...base,id:order.id,revision:order.revision,isSplit:false});assert.equal(r.ok,true);assert.equal(r.data.orders[0].isSplit,false);assert.equal(r.data.orders[0].amountVnd,2250000);
 for(const bad of [{isSplit:'true'},{isCare:1},{type:'invalid'}])assert.equal(post('saveOrder',{...base,...bad}).ok,false);
});
test('Report API computes half sales and half upsales from orders instead of posted counters',()=>{
 const {post}=runtime();const base={productId:'p',date:'2026-11-04',customerName:'Shared order',isSplit:true,amountUsd:100,rate:22500};
 assert.equal(post('saveOrder',{...base,type:'sale'}).ok,true);assert.equal(post('saveOrder',{...base,type:'upsale',isCare:true}).ok,true);
 const r=post('saveReport',{date:base.date,entries:[{...entries[0],success:99,upsale:99}],status:'submitted'});assert.equal(r.ok,true);assert.equal(r.data.reports[0].entries[0].success,.5);assert.equal(r.data.reports[0].entries[0].upsale,.5);
});

test('Order amount must be manually supplied; product price never overrides actual amount',()=>{
 const {post}=runtime();const base={productId:'p',date:'2026-11-04',customerName:'Actual price',type:'sale',rate:22500};
 for(const amountUsd of ['',null,undefined])assert.equal(post('saveOrder',{...base,amountUsd}).ok,false);
 let r=post('saveOrder',{...base,amountUsd:123.45});assert.equal(r.ok,true);assert.equal(r.data.orders[0].amountUsd,123.45);assert.equal(r.data.orders[0].amountVnd,Math.round(123.45*22500));
});

test('API derives carryover on server across date gaps and preserves posted balance while reopened',()=>{
 const {post}=runtime({legacyTimeline:true});let r=post('saveReport',{date:'2026-11-01',status:'submitted',entries:[{...entries[0],budget:5000000,remaining:3000000}],revision:0});assert.equal(r.ok,true);const first=r.data.reports[0];
 r=post('saveReport',{date:'2026-11-04',status:'submitted',entries:[{...entries[0],received:1000000,budget:0,carryover:999999999,remaining:500000}],revision:0});assert.equal(r.ok,true);let fourth=r.data.reports.find(x=>x.date==='2026-11-04');assert.equal(fourth.entries[0].budget,4000000);assert.equal(fourth.entries[0].carryover,3000000);
 assert.equal(post('reopen',{id:first.id},'token-admin').ok,true);
 r=post('saveReport',{date:'2026-11-01',status:'draft',entries:[{...entries[0],budget:5000000,remaining:2000000}],revision:2});assert.equal(r.ok,true);assert.equal(r.data.reports.find(x=>x.date==='2026-11-04').entries[0].budget,4000000);
 r=post('saveReport',{date:'2026-11-01',status:'submitted',entries:[{...entries[0],budget:5000000,remaining:2000000}],revision:3});assert.equal(r.ok,true);fourth=r.data.reports.find(x=>x.date==='2026-11-04');assert.equal(fourth.entries[0].budget,3000000);assert.equal(fourth.revision,2);
});
test('Changing a report date recomputes carryover without duplicating money',()=>{
 const {post}=runtime({legacyTimeline:true});post('saveReport',{date:'2026-11-01',status:'submitted',entries:[{...entries[0],budget:5000000,remaining:3000000}],revision:0});let r=post('saveReport',{date:'2026-11-04',status:'submitted',entries:[{...entries[0],received:1000000,budget:0,remaining:500000}],revision:0});const fourth=r.data.reports.find(x=>x.date==='2026-11-04');
 r=post('changeReportDate',{id:fourth.id,date:'2026-11-07',revision:fourth.revision});assert.equal(r.ok,true);assert.equal(r.data.reports.find(x=>x.id===fourth.id).entries[0].budget,4000000);
});

test('Spoofing role/account fields cannot grant admin or expose audit data',()=>{
 const {post,c}=runtime();
 const spoof={role:'admin',user:{id:'admin',role:'admin'},accountId:'admin',name:'Injected',priceUsd:100,rate:22500};
 assert.equal(post('saveProduct',spoof).ok,false);assert.equal(post('saveAccount',{...spoof,username:'intruder',ownerName:'Intruder',password:'long-password'}).ok,false);
 const r=JSON.parse(c.doPost({postData:{contents:JSON.stringify({action:'bootstrap',token:'token-a',role:'admin',user:{id:'admin',role:'admin'},payload:spoof})}}));
 assert.equal(r.ok,true);assert.equal(r.data.viewer.id,'a');assert.equal(r.data.viewer.role,'user');assert.equal(r.data.audit.length,0);assert.equal(r.data.accounts.length,1);assert.equal(r.data.viewer.passwordHash,undefined);
});
test('Admin sees complete before/after history; user cannot read history or edit another owner',()=>{
 const {post}=runtime();let r=post('saveReport',{date:'2026-11-01',entries,status:'submitted',revision:0});const id=r.data.reports[0].id;
 r=post('saveReport',{date:'2026-11-01',entries:[{...entries[0],data:123}],status:'submitted',revision:1});assert.equal(r.ok,true);assert.equal(r.data.audit.length,0);
 assert.equal(post('saveReport',{accountId:'a',date:'2026-11-01',entries,status:'submitted',revision:2},'token-b').ok,false);
 const admin=post('bootstrap',{},'token-admin');const log=admin.data.audit.find(x=>x.action==='reportUpdated'&&x.details.reportId===id);
 assert.ok(log);assert.equal(log.actorId,'a');assert.equal(log.details.before.entries[0].data,entries[0].data);assert.equal(log.details.after.entries[0].data,123);assert.equal(log.details.after.revision,2);assert.ok(log.time);
});

test('Admin changes roles on server, revokes target sessions, and cannot demote the last admin',()=>{
 const {post}=runtime();
 assert.equal(post('saveAccount',{id:'admin',username:'admin',ownerName:'Admin',role:'user'},'token-admin').ok,false);
 assert.equal(post('saveAccount',{id:'a',username:'linh',ownerName:'Linh',role:'admin'}).ok,false);
 let r=post('saveAccount',{id:'a',username:'linh',ownerName:'Linh',role:'admin'},'token-admin');assert.equal(r.ok,true);assert.equal(r.data.accounts.find(a=>a.id==='a').role,'admin');assert.equal(post('bootstrap').ok,false);assert.ok(r.data.audit.some(a=>a.action==='roleChanged'));
 r=post('saveAccount',{id:'admin',username:'admin',ownerName:'Admin',role:'user'},'token-admin');assert.equal(r.ok,true);assert.equal(r.data.viewer.role,'user');assert.equal(post('bootstrap',{},'token-admin').ok,false);
});
test('Deleting a user revokes access but preserves orders/reports, and admin can restore',()=>{
 const {post,c}=runtime();post('saveReport',{date:'2026-11-04',entries,status:'submitted'});post('saveOrder',{productId:'p',date:'2026-11-04',customerName:'Old customer',type:'sale',amountUsd:99,rate:22500});
 assert.equal(post('deleteAccount',{id:'b'}).ok,false);assert.equal(post('deleteAccount',{id:'admin'},'token-admin').ok,false);
 const r=post('deleteAccount',{id:'a'},'token-admin');assert.equal(r.ok,true);assert.equal(c.get_('Accounts','a').active,false);assert.ok(c.get_('Accounts','a').deletedAt);assert.equal(post('bootstrap').ok,false);assert.equal(c.read_('Orders').length,1);assert.equal(c.read_('Reports').length,1);assert.equal(c.read_('Assignments').find(a=>a.accountId==='a').active,false);
 assert.equal(post('restoreAccount',{id:'a'},'token-admin').ok,true);assert.equal(c.get_('Accounts','a').active,true);
});
test('Admin can edit existing business records but cannot enter new reports or orders',()=>{
 const {post}=runtime();assert.equal(post('saveReport',{accountId:'a',date:'2026-11-04',entries,status:'submitted'},'token-admin').ok,false);
 const base={productId:'p',accountId:'a',date:'2026-11-04',customerName:'Original',type:'sale',amountUsd:99,rate:22500};assert.equal(post('saveOrder',base,'token-admin').ok,false);
 const created=post('saveOrder',base);const id=created.data.orders[0].id;assert.equal(post('saveOrder',{...base,id,revision:created.data.orders[0].revision,amountUsd:123},'token-admin').ok,true);
});
test('Optimized hashing preserves existing PBKDF2 credentials including Unicode and long passwords',()=>{
 const {c}=runtime();c.Utilities.computeHmacSha256Signature=()=>{throw Error('No per-iteration Apps Script calls');};
 for(const [password,salt,iterations] of [['password','salt',1],['Mật-khẩu-đúng-🔑','muối-2026',100],['x'.repeat(100),'long-salt',20000]]){
  assert.equal(c.pbkdf_(password,salt,iterations),crypto.pbkdf2Sync(password,salt,iterations,32,'sha256').toString('base64url')+'=');
 }
});
test('Login includes an authenticated bootstrap snapshot without a second request',()=>{
 const {post,put,c}=runtime();put('Accounts',{id:'a',username:'linh',ownerName:'Linh',role:'user',active:true,...c.passwordRecord_('test-long-password')});
 const r=post('login',{username:'linh',password:'test-long-password'});assert.equal(r.ok,true);assert.equal(r.data.db.viewer.id,'a');assert.equal(r.data.db.viewer.role,'user');assert.equal(r.data.db.accounts.length,1);assert.equal(r.data.db.accounts[0].passwordHash,undefined);
});
test('Bulk orders validate every row before writing and reuse batch IDs to avoid retry duplicates',()=>{
 const {post,c}=runtime();const row={productId:'p',date:'2026-11-04',customerName:'Batch',type:'sale',amountUsd:100,rate:22500,isSplit:true};
 assert.equal(post('saveOrdersBulk',{batchId:'batch-demo-1',rows:[row,{...row,customerName:''}]}).ok,false);assert.equal(c.read_('Orders').length,0);
 let r=post('saveOrdersBulk',{batchId:'batch-demo-1',rows:[row,{...row,type:'upsale'}]});assert.equal(r.ok,true);assert.equal(c.read_('Orders').length,2);
 assert.equal(post('saveOrdersBulk',{batchId:'batch-demo-1',rows:[row,{...row,type:'upsale'}]}).ok,true);assert.equal(c.read_('Orders').length,2);
 assert.equal(post('saveOrdersBulk',{batchId:'batch-demo-1',rows:[{...row,amountUsd:999}]}).ok,false);
});
test('Bulk products are admin-only and duplicates or bad rows do not partially save',()=>{
 const {post,c}=runtime();const row={name:'New product',priceUsd:100,rate:22500};
 assert.equal(post('saveProductsBulk',{batchId:'products-demo',rows:[row]}).ok,false);
 assert.equal(post('saveProductsBulk',{batchId:'products-demo',rows:[row,{...row,name:'new product'}]},'token-admin').ok,false);assert.equal(c.read_('Products').length,2);
 assert.equal(post('saveProductsBulk',{batchId:'products-demo',rows:[row,{...row,name:'Another'}]},'token-admin').ok,true);assert.equal(c.read_('Products').length,4);
});
test('Bounced flag is available only on edit and restores the existing order when unticked',()=>{
 const {post}=runtime();const base={productId:'p',date:'2026-11-04',customerName:'Bounce',type:'sale',amountUsd:100,rate:22500};assert.equal(post('saveOrder',{...base,isBounced:true}).ok,false);
 let r=post('saveOrder',base);const id=r.data.orders[0].id;r=post('saveOrder',{...base,id,revision:1,isBounced:true});assert.equal(r.ok,true);assert.equal(r.data.orders[0].isBounced,true);
 r=post('saveOrder',{...base,id,revision:2,isBounced:false});assert.equal(r.ok,true);assert.equal(r.data.orders[0].isBounced,false);assert.equal(r.data.orders[0].amountVnd,2250000);
});

test('User creates and edits own monthly targets, cannot change prices or another account targets',()=>{
 const {post}=runtime();const base={accountId:'a',month:'2026-11',salary:20000000,targets:[{productId:'p',revenue:100000000,care:20000000,priceUsd:1,rate:1}]};
 let r=post('saveTargets',base);assert.equal(r.ok,true);assert.equal(r.data.targets[0].priceUsd,99);assert.equal(r.data.targets[0].rate,22500);
 r=post('saveTargets',{...base,targets:[{...base.targets[0],revision:r.data.targets[0].revision,revenue:150000000}]});assert.equal(r.ok,true);assert.equal(r.data.targets[0].revenue,150000000);
 assert.equal(post('saveTargets',{...base,accountId:'b'}).ok,false);assert.equal(post('saveTargets',{...base,targets:[{productId:'secret',revenue:1,care:0}]}).ok,false);
});

test('Request role hint cannot grant admin access; denial is typed and writes are unchanged',()=>{
 const {c}=runtime();
 const send=(action,token,uiRole,payload={})=>JSON.parse(c.doPost({postData:{contents:JSON.stringify({action,token,uiRole,payload})}}));
 assert.equal(send('bootstrap','token-a','admin').code,'FORBIDDEN');
 assert.equal(send('saveProduct','token-a','admin',{name:'Injected',priceUsd:1,rate:22500}).code,'FORBIDDEN');
 assert.equal(c.read_('Products').length,2);
 assert.equal(send('bootstrap','token-admin','admin').ok,true);
 assert.equal(send('bootstrap','wrong','user').code,'UNAUTHENTICATED');
 assert.equal(send('saveProduct','token-a','user',{}).code,'FORBIDDEN');
 c.put_('Accounts',{id:'admin',username:'admin',ownerName:'Admin',role:'user',active:true});
 assert.equal(send('bootstrap','token-admin','admin').code,'FORBIDDEN');
});

test('V2 snapshots return only selected dates plus carryover context; no audit/session secrets',()=>{
 const {post,postV2,reads}=runtime({legacyTimeline:true});
 post('saveReport',{date:'2026-10-20',entries:[{...entries[0],budget:0,received:5000000,remaining:3000000}],status:'submitted'});
 post('saveReport',{date:'2026-11-02',entries:[{...entries[0],budget:0,received:1000000,remaining:1000000}],status:'submitted'});
 post('saveOrder',{productId:'p',date:'2026-10-20',customerName:'Old',type:'sale',amountUsd:100,rate:22500});
 reads.clear();const r=postV2('bootstrap',{from:'2026-11-01',to:'2026-11-30'});assert.equal(r.ok,true);
 assert.equal(r.data.reports.filter(x=>!x._carryContext).length,1);assert.equal(r.data.reports.find(x=>!x._carryContext).entries[0].budget,4000000);
 assert.equal(r.data.reports.find(x=>x._carryContext).entries[0].remaining,3000000);assert.equal(r.data.orders.length,0);assert.deepEqual(r.data.audit,[]);
 assert.equal(r.data.sessions,undefined);assert.equal(r.data.accounts[0].passwordHash,undefined);assert.equal(reads.has('SL_Audit'),false);
 for(const count of reads.values())assert.equal(count,1,'one network read per table');
 assert.equal(postV2('bootstrap',{from:'2020-01-01',to:'2026-11-30'}).ok,false);
});
test('V2 writes return deltas, deduplicate retry and reject stale order edits/deletes',()=>{
 const {postV2,c}=runtime();const p={productId:'p',date:'2026-11-04',customerName:'Retry',type:'sale',amountUsd:100,rate:22500},key='request_1234567890123456';
 const r=postV2('saveOrder',p,'token-a',key);assert.equal(r.ok,true);assert.equal(r.data.kind,'delta');assert.equal(r.data.upsert.orders.length,1);assert.equal(r.data.orders,undefined);
 assert.equal(postV2('saveOrder',p,'token-a',key).ok,true);assert.equal(c.read_('Orders').length,1);
 assert.equal(postV2('saveOrder',{...p,amountUsd:999},'token-a',key).ok,false);
 const o=r.data.upsert.orders[0];assert.equal(postV2('saveOrder',{...o,amountUsd:200}).ok,true);
 assert.equal(postV2('saveOrder',{...o,amountUsd:300}).code,'CONFLICT');assert.equal(postV2('deleteOrder',{id:o.id,revision:o.revision}).code,'CONFLICT');
 assert.equal(postV2('deleteOrder',{id:o.id,revision:o.revision+1}).ok,true);assert.equal(c.read_('Orders').length,0);
});
test('History is admin-only, filtered by report, and paged',()=>{
 const {postV2,put}=runtime();put('Reports',{id:'r',accountId:'a',date:'2026-11-04',status:'submitted',entries});
 for(let i=0;i<105;i++)put('Audit',{id:'audit-'+i,actorId:'a',action:'reportUpdated',details:{reportId:'r'},time:'2026-11-04T00:00:00Z'});
 put('Audit',{id:'unrelated',actorId:'admin',action:'roleChanged',details:{accountId:'a'},time:'2026-11-04T00:00:00Z'});
 assert.equal(postV2('reportHistory',{id:'r'}).code,'FORBIDDEN');const page=postV2('reportHistory',{id:'r'},'token-admin');assert.equal(page.data.audit.length,100);assert.equal(page.data.nextOffset,100);
 assert.equal(postV2('reportHistory',{id:'r',offset:100},'token-admin').data.audit.length,5);
});
test('A failed cash cascade leaves every previously saved report unchanged',()=>{
 const {post,c}=runtime();post('saveReport',{date:'2026-11-01',entries:[{...entries[0],received:1000,remaining:900}],status:'submitted'});post('saveReport',{date:'2026-11-02',entries:[{...entries[0],received:0,remaining:800}],status:'submitted'});
 const before=JSON.stringify(c.read_('Reports')),first=c.read_('Reports').find(r=>r.date==='2026-11-01');
 assert.equal(post('saveReport',{date:first.date,revision:first.revision,entries:[{...entries[0],received:1000,remaining:0}],status:'submitted'}).ok,false);assert.equal(JSON.stringify(c.read_('Reports')),before);
});
test('Financial overflow, excessively long password and forged ownership are rejected',()=>{
 const {postV2,c}=runtime();assert.equal(postV2('saveOrder',{productId:'p',date:'2026-11-04',customerName:'Overflow',type:'sale',amountUsd:1e13,rate:1e13}).ok,false);assert.equal(c.read_('Orders').length,0);
 assert.equal(postV2('saveAccount',{ownerName:'Test',username:'longpass',password:'a'.repeat(201)},'token-admin').ok,false);
 assert.equal(postV2('saveOrder',{accountId:'b',productId:'p',date:'2026-11-04',customerName:'Other',type:'sale',amountUsd:1,rate:22500}).code,'FORBIDDEN');
});

test('Legacy credentials migrate to a server-only pepper without changing the password',()=>{
 const {post,c,put}=runtime(),password='keep-old-password',salt='old-salt';const legacy=c.pbkdf_(password,salt,2);put('Accounts',{id:'a',username:'linh',ownerName:'Linh',role:'user',active:true,salt,iterations:2,passwordHash:legacy});
 assert.equal(post('login',{username:'linh',password}).ok,true);const stored=c.get_('Accounts','a');assert.equal(stored.pepperVersion,1);assert.notEqual(stored.passwordHash,legacy);
 assert.equal(post('login',{username:'linh',password}).ok,true);assert.equal(post('login',{username:'linh',password:'wrong'}).ok,false);assert.equal(post('bootstrap').data.accounts[0].pepperVersion,undefined);
});

test('Retry after an Audit service failure cannot duplicate an already-written order',()=>{
 const {postV2,c,fault}=runtime(),key='partial_failure_request_123456',p={productId:'p',date:'2026-11-04',customerName:'Partial',type:'sale',amountUsd:100,rate:22500};
 fault.table='SL_Audit';assert.equal(postV2('saveOrder',p,'token-a',key).ok,false);assert.equal(c.read_('Orders').length,1);const id=c.read_('Orders')[0].id;
 assert.equal(postV2('saveOrder',p,'token-a',key).ok,true);assert.equal(c.read_('Orders').length,1);assert.equal(c.read_('Orders')[0].id,id);
});

test('A revoked product can be preserved unchanged in a submitted report, but cannot be edited',()=>{
 const {post,put,c}=runtime();let r=post('saveReport',{date:'2026-11-04',entries,status:'submitted'});assert.equal(r.ok,true);put('Assignments',{id:'ap',accountId:'a',productId:'p',active:false});
 const before=c.read_('Reports')[0];r=post('saveReport',{date:before.date,revision:before.revision,entries:before.entries,status:'submitted'});assert.equal(r.ok,true);
 assert.equal(post('saveReport',{date:before.date,revision:r.data.reports[0].revision,entries:[{...before.entries[0],data:999}],status:'submitted'}).code,'FORBIDDEN');
});

test('First report starts immediately, then missing or draft days block the next date',()=>{
 const {post}=runtime();
 assert.equal(post('saveReport',{date:'2026-11-01',entries,status:'submitted'}).ok,true);
 let blocked=post('saveReport',{date:'2026-11-03',entries,status:'draft'});assert.equal(blocked.ok,false);assert.match(blocked.error,/2026-11-02/);
 const zero=entries.map(e=>Object.fromEntries(Object.entries(e).map(([k,v])=>[k,k==='productId'?v:0])));
 assert.equal(post('saveReport',{date:'2026-11-02',entries:zero,status:'draft'}).ok,true);
 assert.equal(post('saveReport',{date:'2026-11-03',entries,status:'submitted'}).ok,false);
 assert.equal(post('saveReport',{date:'2026-11-02',entries:zero,status:'submitted',revision:1}).ok,true);
 assert.equal(post('saveReport',{date:'2026-11-03',entries,status:'submitted'}).ok,true);
});
test('Report policy rejects today, future, older dates, and moving a report to bypass a missing day',()=>{
 const {post}=runtime();
 for(const date of ['2026-11-05','2026-11-06','2026-10-28'])assert.equal(post('saveReport',{date,entries,status:'submitted'}).ok,false);
 const first=post('saveReport',{date:'2026-11-01',entries,status:'submitted'});assert.equal(first.ok,true);
 assert.equal(post('saveReport',{date:'2026-10-31',entries,status:'submitted'}).ok,false);
 const r=first.data.reports[0];assert.equal(post('changeReportDate',{id:r.id,date:'2026-11-03',revision:1}).ok,false);
});
test('Admin corrects old balances with an audit trail and recomputes subsequent carryover',()=>{
 const {post,put}=runtime();
 const item=(received,remaining)=>({...entries[0],received,budget:received,remaining});
 put('Reports',{id:'old1',accountId:'a',date:'2026-10-01',status:'submitted',revision:1,entries:[item(100,20)]});
 put('Reports',{id:'old2',accountId:'a',date:'2026-10-02',status:'submitted',revision:1,entries:[{...item(100,10),budget:120,carryover:20}]});
 const result=post('saveReport',{accountId:'a',date:'2026-10-01',entries:[item(100,40)],status:'submitted',revision:1},'token-admin');assert.equal(result.ok,true);
 const future=result.data.reports.find(r=>r.id==='old2');assert.equal(future.entries[0].carryover,40);assert.equal(future.entries[0].budget,140);assert.equal(future.revision,2);
 assert.ok(result.data.audit.some(a=>a.action==='carryoverRecomputed'));
});

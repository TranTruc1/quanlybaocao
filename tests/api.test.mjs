import test from 'node:test';
import assert from 'node:assert/strict';
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null};globalThis.window={APP_CONFIG:{apiUrl:'https://script.google.com/macros/s/test_deployment/exec'}};
const {request,config,clearRequestState}=await import('../src/api.js');
test('Network retry reuses idempotency ID, a later successful save gets a new ID',async()=>{
 clearRequestState();const bodies=[];let fail=true;globalThis.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');if(fail){fail=false;throw Error('offline');}return {ok:true,json:async()=>({ok:true,data:{kind:'delta'}})};};
 const p={customerName:'Test',amountUsd:1},s={token:'opaque-test-token'};await assert.rejects(request('saveOrder',p,s),/offline/);await request('saveOrder',p,s);assert.equal(bodies[0].requestId,bodies[1].requestId);assert.equal(bodies[1].protocol,2);assert.equal(bodies[1].token,s.token);await request('saveOrder',p,s);assert.notEqual(bodies[1].requestId,bodies[2].requestId);
});
test('Authorization codes survive the transport and untrusted API hosts are rejected',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:false,error:'Không đủ quyền',code:'FORBIDDEN'})});await assert.rejects(request('reportHistory',{id:'report'},{token:'test'}),e=>e.code==='FORBIDDEN');
 const saved=config.apiUrl;config.apiUrl='https://attacker.invalid/collect';await assert.rejects(request('bootstrap',{},{}),/apiUrl/);config.apiUrl=saved;
});

test('A server service failure keeps the retry ID instead of creating a second order',async()=>{
 clearRequestState();const bodies=[];globalThis.fetch=async(_,o)=>{bodies.push(JSON.parse(o.body));return {ok:true,json:async()=>bodies.length===1?{ok:false,error:'Retry',code:'SERVER_ERROR'}:{ok:true,data:{kind:'delta'}}};};
 await assert.rejects(request('saveOrder',{customerName:'Partial'},{token:'token'}),e=>e.code==='SERVER_ERROR');await request('saveOrder',{customerName:'Partial'},{token:'token'});assert.equal(bodies[0].requestId,bodies[1].requestId);
});

test('An old local mode flag cannot bypass the server login',async()=>{config.demoMode=true;let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({ok:false,error:'Sai thông tin đăng nhập',code:'VALIDATION_ERROR'})};};await assert.rejects(request('login',{demoId:'admin'}),/Sai thông tin/);assert.equal(calls,1);delete config.demoMode;});

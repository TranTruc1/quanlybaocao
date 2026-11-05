import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedRequest} from '../server/request-origin.js';
function req(origin,host='localhost:3000',extra={},url='http://0.0.0.0:3000/api/rpc'){
 return new Request(url,{method:'POST',headers:{origin,host,'content-type':'application/json','x-sl-client':'1',...extra}});
}
test('Browser localhost and 127.0.0.1 work when Next binds 0.0.0.0',()=>{
 assert.equal(allowedRequest(req('http://localhost:3000'),{}),true);
 assert.equal(allowedRequest(req('http://127.0.0.1:3000','127.0.0.1:3000'),{}),true);
 assert.equal(allowedRequest(req('http://localhost:3001','localhost:3001'),{}),true);
});
test('Vercel HTTPS public host works behind an internal HTTP URL',()=>{
 assert.equal(allowedRequest(req('https://quanlybaocao.vercel.app','quanlybaocao.vercel.app',{},'http://localhost:3000/api/rpc'),{VERCEL:'1'}),true);
 assert.equal(allowedRequest(req('http://quanlybaocao.vercel.app','quanlybaocao.vercel.app'),{VERCEL:'1'}),false);
});
test('Foreign origins, different ports, null origins and forged forwarded headers stay blocked',()=>{
 for(const origin of ['https://attacker.invalid','http://localhost:3001','null','http://localhost:3000.evil.test','http://localhost:3000/path'])assert.equal(allowedRequest(req(origin),{}),false);
 assert.equal(allowedRequest(req('https://attacker.invalid','localhost:3000',{'x-forwarded-host':'attacker.invalid','x-forwarded-proto':'https'}),{}),false);
 assert.equal(allowedRequest(req('http://localhost:3000','localhost:3000',{'sec-fetch-site':'cross-site'}),{}),false);
 for(const extra of [{'x-sl-client':''},{'content-type':'text/plain'}])assert.equal(allowedRequest(req('http://localhost:3000','localhost:3000',extra),{}),false);
});

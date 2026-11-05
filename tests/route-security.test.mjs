import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server.js';
import {POST} from '../app/api/rpc/route.js';
const make=(body,headers={})=>new NextRequest('http://localhost:3000/api/rpc',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json','x-sl-client':'1',...headers},body});
test('RPC blocks cross-origin requests, missing client header and form posts before touching DB',async()=>{
 for(const headers of [{origin:'https://attacker.invalid'},{'x-sl-client':''},{'content-type':'text/plain'}]){
  const response=await POST(make('{}',headers));assert.equal(response.status,403);assert.equal((await response.json()).code,'FORBIDDEN');
 }
});
test('RPC rejects oversized, invalid JSON and non-object bodies',async()=>{
 assert.equal((await POST(make('x'.repeat(300001)))).status,413);
 for(const body of ['{','null','[]']){const response=await POST(make(body));assert.equal(response.status,400);assert.equal((await response.json()).code,'VALIDATION_ERROR');}
});
test('Missing Mongo config gives a safe actionable error without echoing secrets',async()=>{
 const uri=process.env.MONGODB_URI;delete process.env.MONGODB_URI;
 try{const response=await POST(make(JSON.stringify({action:'login',payload:{username:'tam',password:'private-password'}})));const text=await response.text();assert.equal(response.status,400);assert.ok(text.includes('NOT_CONFIGURED'));assert.equal(text.includes('private-password'),false);assert.equal(response.headers.get('Cache-Control'),'no-store');}
 finally{if(uri!==undefined)process.env.MONGODB_URI=uri;}
});

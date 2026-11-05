import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const script=new URL('../scripts/configure-dist.mjs',import.meta.url).pathname;
test('Vercel production fails closed without API and emits live config only with explicit URL',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'so-lieu-config-'));fs.mkdirSync(path.join(dir,'public'));fs.mkdirSync(path.join(dir,'dist'));fs.writeFileSync(path.join(dir,'public/config.js'),'window.APP_CONFIG={};');
 const env={...process.env,VERCEL:'1',SO_LIEU_API_URL:''};
 try{assert.throws(()=>execFileSync(process.execPath,[script],{cwd:dir,env,stdio:'pipe'}));execFileSync(process.execPath,[script],{cwd:dir,env:{...env,SO_LIEU_API_URL:'https://script.google.com/macros/s/test_public_id/exec'},stdio:'pipe'});const result=fs.readFileSync(path.join(dir,'dist/config.js'),'utf8');assert.equal(result.includes('demoMode'),false);assert.ok(!result.includes('password'));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Vercel headers restrict scripts, frames and API destinations; runtime config is not cached',()=>{const v=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url)));const headers=v.headers[0].headers,csp=headers.find(x=>x.key==='Content-Security-Policy').value;assert.ok(csp.includes("script-src 'self'"));assert.ok(csp.includes("frame-ancestors 'none'"));assert.ok(csp.includes('https://script.googleusercontent.com'));assert.equal(v.headers.find(x=>x.source==='/config.js').headers[0].value,'no-store');});

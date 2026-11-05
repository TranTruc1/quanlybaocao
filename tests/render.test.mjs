import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {fixtureDb} from './fixtures.js';
import {previousDay} from '../src/domain.js';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};globalThis.window={APP_CONFIG:{}};
const source=(await fs.readFile(new URL('../src/main.jsx',import.meta.url),'utf8')).replace(/createRoot\(document\.getElementById\('root'\)\)\.render\([^\n]+\);/, '')+'\nexport {Overview,Daily,Orders,Targets,Products,Accounts,Login};';
const path=new URL('../.review-render-main.mjs',import.meta.url);
await build({stdin:{contents:source,loader:'jsx',resolveDir:new URL('../src',import.meta.url).pathname},bundle:true,format:'esm',platform:'node',outfile:path.pathname,external:['react','react-dom/*','lucide-react'],loader:{'.css':'empty'}});
const ui=await import(path.href);await fs.unlink(path);
const db=fixtureDb(),admin=db.accounts[0],user=db.accounts[1],base={db,notify(){},mutate:async()=>true,setPage(){}};
for(const name of ['Overview','Daily','Orders','Targets','Products','Accounts'])test(name+' renders for admin without runtime errors',()=>{const html=renderToString(React.createElement(ui[name],{...base,user:admin}));assert.ok(html.length>100);});
test('Admin defaults to yesterday and order filters expose care/account controls',()=>{const html=renderToString(React.createElement(ui.Orders,{...base,user:admin}));assert.ok(html.includes('Đơn chăm sóc (gồm Upsale)'));assert.ok(html.includes('Chọn account'));assert.ok(html.includes(previousDay().split('-').reverse().join(' / ')));});
test('Charts stay hidden behind their open button',()=>{const overview=renderToString(React.createElement(ui.Overview,{...base,user:admin}));assert.ok(overview.includes('Xem biểu đồ'));assert.equal(overview.includes('Biểu đồ tổng quan'),false);});

test('Login has only username/password, reports missing API and never offers account selection',()=>{const html=renderToString(React.createElement(ui.Login,{onLogin(){}}));assert.ok(html.includes('Tên đăng nhập'));assert.ok(html.includes('Mật khẩu'));assert.ok(html.includes('Chưa cấu hình'));assert.equal(html.includes('Account trải nghiệm'),false);assert.equal(html.includes('<select'),false);});

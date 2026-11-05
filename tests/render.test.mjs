import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {fixtureDb} from './fixtures.js';
import {previousDay} from '../src/domain.js';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};globalThis.window={APP_CONFIG:{}};
const source=(await fs.readFile(new URL('../src/main.jsx',import.meta.url),'utf8')).replace(/createRoot\(document\.getElementById\('root'\)\)\.render\([^\n]+\);/, '')+'\nexport {App,Overview,Daily,Orders,Targets,Products,Accounts,Login,ReportList,DataWindow,Filters};';
const path=new URL('../.review-render-main.mjs',import.meta.url);
await build({stdin:{contents:source,loader:'jsx',resolveDir:new URL('../src',import.meta.url).pathname},bundle:true,format:'esm',platform:'node',outfile:path.pathname,external:['react','react-dom/*','lucide-react'],loader:{'.css':'empty'}});
const ui=await import(path.href);await fs.unlink(path);
const db=fixtureDb(),admin=db.accounts[0],user=db.accounts[1],base={db,notify(){},mutate:async()=>true,setPage(){}};
for(const name of ['Overview','Daily','Orders','Targets','Products','Accounts'])test(name+' renders for admin without runtime errors',()=>{const html=renderToString(React.createElement(ui[name],{...base,user:admin}));assert.ok(html.length>100);});
test('Admin defaults to yesterday and order filters expose care/account controls',()=>{const html=renderToString(React.createElement(ui.Orders,{...base,user:admin}));assert.ok(html.includes('Đơn chăm sóc (gồm Upsale)'));assert.ok(html.includes('Chọn account'));assert.ok(html.includes(previousDay().split('-').reverse().join(' / ')));});
test('Charts stay hidden behind their open button',()=>{const overview=renderToString(React.createElement(ui.Overview,{...base,user:admin}));assert.ok(overview.includes('Xem biểu đồ'));assert.equal(overview.includes('Biểu đồ tổng quan'),false);});

test('Login has only username/password, reports missing API and never offers account selection',()=>{const html=renderToString(React.createElement(ui.Login,{onLogin(){}}));assert.ok(html.includes('Tên đăng nhập'));assert.ok(html.includes('Mật khẩu'));assert.ok(html.includes('Chưa cấu hình'));assert.equal(html.includes('Account trải nghiệm'),false);assert.equal(html.includes('<select'),false);});

test('Reload shows the workspace shell with placeholders, not a verification wall or cached business data',()=>{
 const tab=new Map([['so-lieu.session',JSON.stringify({token:'reload-token',user:{id:'reload-user'}})]]);
 globalThis.sessionStorage={getItem:k=>tab.get(k)||null,removeItem:k=>tab.delete(k)};
 storage.set('so-lieu.ui-user',JSON.stringify({id:'reload-user',ownerName:'Trúc',role:'user'}));
 try{const html=renderToString(React.createElement(ui.App));assert.ok(html.includes('sidebar'));assert.ok(html.includes('Trúc'));assert.ok(html.includes('workspace-skeleton'));assert.equal(html.includes('Đang xác minh'),false);assert.equal(html.includes('Đăng nhập</h2>'),false);assert.equal(html.includes('Tổng ngân sách'),false);}
 finally{delete globalThis.sessionStorage;storage.clear();}
});

test('Report list displays one card per employee and employee detail retains back and date actions',()=>{
 const range=[previousDay().slice(0,7)+'-01',previousDay().slice(0,7)+'-30'];
 const filter={mode:'range',from:range[0],to:range[1],date:range[0],month:range[0].slice(0,7),account:'all',product:'all'};
 const render=selectedAccount=>renderToString(React.createElement(ui.DataWindow.Provider,{value:{scope:{from:range[0],to:range[1]},ensure(){}}},React.createElement(ui.ReportList,{...base,user:admin,FilterComponent:ui.Filters,onOpen(){},initialView:{filter,status:'all',selectedAccount}})));
 const cards=render(null);assert.ok(cards.includes('employee-report-grid'));assert.equal((cards.match(/aria-label="Xem báo cáo chi tiết của /g)||[]).length,3);assert.equal(cards.includes('table-scroll'),false);
 const detail=render('u1');assert.ok(detail.includes('Quay lại danh sách'));assert.ok(detail.includes('Chi tiết theo sản phẩm'));assert.equal(detail.includes('employee-report-detail'),false);assert.ok(detail.includes('Lưu thay đổi'));assert.ok(detail.includes('Sửa Tổng data'));assert.ok(detail.includes('Các bảng theo ngày'));assert.ok(detail.includes('Lịch sử sửa'));assert.ok(detail.includes('Sửa ngày'));
 const daily=renderToString(React.createElement(ui.Daily,{...base,user:admin,initial:db.reports[0],onBack(){}}));assert.ok(daily.includes('Quay lại'));assert.ok(daily.includes('báo cáo nhân viên'));
});

test('Unified report has one navigation entry, one filter and no draft workflow',()=>{
 const tab=new Map([['so-lieu.session',JSON.stringify({token:'reload-token',user:{id:'reload-user'}})]]);
 globalThis.sessionStorage={getItem:k=>tab.get(k)||null,removeItem:k=>tab.delete(k)};storage.set('so-lieu.ui-user',JSON.stringify({id:'reload-user',ownerName:'Trúc',role:'user'}));
 try{const html=renderToString(React.createElement(ui.App)),nav=html.match(/<nav>([\s\S]*?)<\/nav>/)[1];assert.equal((nav.match(/>Báo cáo</g)||[]).length,1);assert.equal(nav.includes('Tổng quan'),false);}
 finally{delete globalThis.sessionStorage;storage.clear();}
 const filter={mode:'month',month:previousDay().slice(0,7),account:'all',product:'all'};
 const html=renderToString(React.createElement(ui.ReportList,{...base,user:admin,SummaryComponent:ui.Overview,FilterComponent:ui.Filters,onOpen(){},initialView:{filter}}));
 assert.equal((html.match(/class="filterbar"/g)||[]).length,1);assert.ok(html.includes('Xem biểu đồ'));assert.ok(html.includes('Theo sản phẩm'));assert.ok(html.includes('employee-report-grid'));assert.equal(html.includes('Bản nháp'),false);assert.equal(html.includes('Lưu nháp'),false);assert.equal(html.includes('Hiệu suất chi tiết'),false);
});

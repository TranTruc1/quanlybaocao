import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {fixtureDb} from './fixtures.js';
import {previousDay} from '../src/domain.js';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};globalThis.window={APP_CONFIG:{}};
const source=(await fs.readFile(new URL('../src/main.jsx',import.meta.url),'utf8')).replace(/createRoot\(document\.getElementById\('root'\)\)\.render\([^\n]+\);/, '')+'\nexport {App,Overview,Daily,Orders,Targets,Products,Accounts,Login,ReportList,DataWindow,Filters}; export {selectCalendarDay,reportDatePreset} from "./ReportDateFilter.jsx";';
const path=new URL('../.review-render-main.mjs',import.meta.url);
await build({stdin:{contents:source,loader:'jsx',resolveDir:fileURLToPath(new URL('../src',import.meta.url))},bundle:true,format:'esm',platform:'node',outfile:fileURLToPath(path),external:['react','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'}});
const ui=await import(path.href);await fs.unlink(path);
const db=fixtureDb(),admin=db.accounts[0],user=db.accounts[1],base={db,notify(){},mutate:async()=>true,setPage(){}};
for(const name of ['Overview','Daily','Orders','Targets','Products','Accounts'])test(name+' renders for admin without runtime errors',()=>{const html=renderToString(React.createElement(ui[name],{...base,user:admin}));assert.ok(html.length>100);});
test('Admin defaults to yesterday and order filters expose care/account controls',()=>{const html=renderToString(React.createElement(ui.Orders,{...base,user:admin}));assert.ok(html.includes('Đơn chăm sóc (gồm Upsale)'));assert.ok(html.includes('Chọn account'));assert.ok(html.includes(previousDay().split('-').reverse().join(' / ')));});
test('Charts stay hidden behind their open button',()=>{const overview=renderToString(React.createElement(ui.Overview,{...base,user:admin}));assert.ok(overview.includes('Xem biểu đồ'));assert.equal(overview.includes('Biểu đồ tổng quan'),false);});

test('Login uses the same-origin API and never offers account selection',()=>{const html=renderToString(React.createElement(ui.Login,{onLogin(){}}));assert.ok(html.includes('Tên đăng nhập'));assert.ok(html.includes('Mật khẩu'));assert.equal(html.includes('Apps Script'),false);assert.equal(html.includes('Account trải nghiệm'),false);assert.equal(html.includes('<select'),false);});

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
 const detail=render('u1');assert.equal(detail.includes('Quay lại danh sách'),false);assert.ok(detail.includes('Chi tiết theo sản phẩm'));assert.equal(detail.includes('employee-report-detail'),false);assert.ok(detail.includes('Lưu thay đổi'));assert.ok(detail.includes('Sửa Tổng data'));assert.equal(detail.includes('Các bảng theo ngày'),false);assert.ok(detail.includes('Lịch sử sửa'));assert.ok(detail.includes('Ngày chỉnh sửa'));
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

test('Changing report date, month, range or product preserves the employee URL',()=>{
 for(const change of [{date:'2026-11-03'},{mode:'month',month:'2026-10'},{mode:'range',from:'2026-11-01',to:'2026-11-04'},{product:'p1'}]){
  let callback,nextRoute;
  const route={area:'admin',page:'overview',employee:'u1',day:'r1'};
  const filter={mode:'day',date:previousDay(),month:previousDay().slice(0,7),account:'all',product:'all'};
  const Capture=props=>{callback=props.setFilter;return null;};
  renderToString(React.createElement(ui.ReportList,{...base,user:admin,route,FilterComponent:Capture,onOpen(){},onRouteChange:r=>{nextRoute=r;},initialView:{filter}}));
  callback({...filter,...change});assert.equal(nextRoute.employee,'u1');assert.equal(nextRoute.area,'admin');assert.equal(nextRoute.day,null);
 }
});
test('Admin detail offers a correction request and a fixed save dock without transfer controls',()=>{
 const filter={mode:'day',date:db.reports[0].date,account:'all',product:'all'};
 const html=renderToString(React.createElement(ui.ReportList,{...base,user:admin,FilterComponent:ui.Filters,onOpen(){},initialView:{filter,selectedAccount:db.reports[0].accountId}}));
 assert.ok(html.includes('Yêu cầu sửa báo cáo'));assert.ok(html.includes('inline-save-dock'));assert.equal(html.includes('carry-transfer-button'),false);assert.equal(html.includes('Các bảng theo ngày'),false);
});

test('Calendar selects a single day or a sorted range and restarts after a complete range',()=>{
 const one=ui.selectCalendarDay({start:'2026-11-01',end:'2026-11-02'},'2026-11-03');
 assert.deepEqual(one,{start:'2026-11-03',end:null});
 assert.deepEqual(ui.selectCalendarDay(one,'2026-11-07'),{start:'2026-11-03',end:'2026-11-07'});
 assert.deepEqual(ui.selectCalendarDay(one,'2026-11-01'),{start:'2026-11-01',end:'2026-11-03'});
});
test('Date presets use actual report bounds and Monday to Saturday',()=>{
 const bounds=[{first:'2024-05-01',last:'2026-11-03'},{first:'2026-10-01',last:'2026-11-04'}];
 assert.deepEqual(ui.reportDatePreset('latest','2026-11-05',bounds),{start:'2026-11-04',end:'2026-11-04'});
 assert.deepEqual(ui.reportDatePreset('all','2026-11-05',bounds),{start:'2024-05-01',end:'2026-11-05'});
 assert.deepEqual(ui.reportDatePreset('week','2026-11-05'),{start:'2026-11-02',end:'2026-11-07'});
 assert.deepEqual(ui.reportDatePreset('week','2026-11-08'),{start:'2026-11-02',end:'2026-11-07'});
 assert.deepEqual(ui.reportDatePreset('month','2026-02-15'),{start:'2026-02-01',end:'2026-02-28'});
});

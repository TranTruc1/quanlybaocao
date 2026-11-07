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
const source=(await fs.readFile(new URL('../src/main.jsx',import.meta.url),'utf8')).replace(/createRoot\(document\.getElementById\('root'\)\)\.render\([^\n]+\);/, '')+'\nexport {App,Overview,Daily,Orders,Targets,Products,Accounts,Login,ReportList,DataWindow,Filters,SaleDaily,ChangePasswordModal}; export {WorkspaceProvider} from "./WorkspaceState.jsx"; export {default as InlineReportEditor} from "./InlineReportEditor.jsx"; export {default as SaleReportEditor} from "./SaleReportEditor.jsx"; export {default as SaleReports} from "./SaleReports.jsx"; export {selectCalendarDay,reportDatePreset} from "./ReportDateFilter.jsx";';
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

test('Overview shows the current month while detail opens the most recent due day with one calendar',()=>{
 const range=[previousDay().slice(0,7)+'-01',previousDay().slice(0,7)+'-30'];
 const render=selectedAccount=>renderToString(React.createElement(ui.DataWindow.Provider,{value:{scope:{from:range[0],to:range[1]},ensure(){}}},React.createElement(ui.ReportList,{...base,user:admin,FilterComponent:ui.Filters,onOpen(){},initialView:{selectedAccount}})));
 const cards=render(null);assert.ok(cards.includes('employee-report-grid'));assert.equal((cards.match(/aria-label="Xem báo cáo chi tiết của /g)||[]).length,3);
 const detail=render('u1');assert.ok(cards.includes('Tháng '));assert.ok(detail.includes('Chi tiết theo sản phẩm'));assert.ok(detail.includes('Sửa Tổng data'));assert.ok(detail.includes('Tổng doanh số'));assert.equal(detail.includes('Ngày / Dải ngày'),false);assert.equal(detail.includes('Ngày gần nhất'),false);assert.equal(detail.includes('Chưa có báo cáo trong khoảng'),false);assert.equal((detail.match(/class="filterbar"/g)||[]).length,1);
});

test('Admin viewing one employee still sees that employee sales summary',()=>{
 const range=[previousDay().slice(0,7)+'-01',previousDay().slice(0,7)+'-30'];
 const html=renderToString(React.createElement(ui.DataWindow.Provider,{value:{scope:{from:range[0],to:range[1]},ensure(){}}},React.createElement(ui.ReportList,{...base,user:admin,SummaryComponent:ui.Overview,FilterComponent:ui.Filters,onOpen(){},route:{area:'admin',page:'overview',employee:'u1'}})));
 assert.ok(html.includes('Xem biểu đồ'));assert.ok(html.includes('Tổng doanh số'));assert.ok(html.includes('Chi tiết theo sản phẩm'));
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
test('Detail report sorts products by latest report date and hides products idle over 3 days',()=>{
 const entry=(productId,extra={})=>({productId,budget:0,remaining:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,received:0,...extra});
 const customDb={accounts:[{id:'admin',ownerName:'Admin',username:'admin',role:'admin',active:true},{id:'u1',ownerName:'Linh',username:'linh',role:'user',active:true}],
  products:[{id:'p1',name:'Mới nhất',priceUsd:100,rate:22500,active:true,color:'#0e7861'},{id:'p2',name:'Ngủ quên',priceUsd:100,rate:22500,active:true,color:'#6579b9'},{id:'p3',name:'Vừa xong',priceUsd:100,rate:22500,active:true,color:'#ba9353'}],
  assignments:[{id:'a1',accountId:'u1',productId:'p1',active:true},{id:'a2',accountId:'u1',productId:'p2',active:true},{id:'a3',accountId:'u1',productId:'p3',active:true}],
  reports:[
   {id:'r1',accountId:'u1',date:'2026-11-01',status:'submitted',entries:[entry('p2',{received:1000000,budget:1000000,remaining:900000,data:10,tt:5})],revision:1},
   {id:'r2',accountId:'u1',date:'2026-11-05',status:'submitted',entries:[entry('p3',{received:1000000,budget:1000000,remaining:900000,data:8,tt:4})],revision:1},
   {id:'r3',accountId:'u1',date:'2026-11-06',status:'submitted',entries:[entry('p1',{received:1000000,budget:1000000,remaining:900000,data:20,tt:5}),entry('p2',{}),entry('p3',{})],revision:1},
  ],
  orders:[],targets:[],appointments:[],reportrequests:[]};
 const html=renderToString(React.createElement(ui.InlineReportEditor,{db:customDb,record:customDb.reports[2],user:admin,mutate:async()=>true,notify(){},onHistory(){}}));
 assert.ok(html.indexOf('Mới nhất')<html.indexOf('Vừa xong'));
 assert.ok(html.includes('Đã ẩn'));assert.ok(html.includes('tick để hiện lại'));
 assert.equal((html.match(/Ngủ quên/g)||[]).length,1);
});

test('Detailed report keeps its date static for both admin and employees',()=>{
 const props={...base,record:db.reports[0],onHistory(){},onEditDate(){}};
 const html=renderToString(React.createElement(ui.InlineReportEditor,{...props,user:admin}));
 assert.ok(html.includes('inline-save-dock'));assert.ok(html.includes('report-management-actions'));assert.ok(html.includes('Lịch sử sửa'));assert.equal(html.includes('<button type="button" class="report-edit-date"'),false);
 const employee=renderToString(React.createElement(ui.InlineReportEditor,{...props,user}));assert.equal(employee.includes('<button type="button" class="report-edit-date"'),false);assert.ok(employee.includes(db.reports[0].date.split('-').reverse().join('/')));assert.equal(employee.includes('Ngày báo cáo'),false);
});
test('Both MKT and SALE input routes use the former product cards and single-day picker',()=>{
 const sale={...user,id:'sale-1',role:'sale'};
 for(const account of [user,sale]){const data={...db,accounts:[...db.accounts,sale],assignments:[...db.assignments,...db.assignments.filter(a=>a.accountId===user.id).map(a=>({...a,id:a.id+'sale',accountId:sale.id}))]};
 const html=renderToString(React.createElement(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},React.createElement(account.role==='sale'?ui.SaleDaily:ui.Daily,{...base,db:data,user:account,initial:{accountId:account.id,date:previousDay()},onBack(){},onRouteChange(){}})));
 if(account.role==='sale'){assert.ok(html.includes('entry-card'));assert.ok(html.includes('entry-fields'));}else assert.ok(html.includes('Bảng điền hằng ngày'));assert.equal(html.includes('weekly-entry-grid'),false);assert.equal(html.includes('Tổng tuần'),false);assert.ok(html.includes('Ngày báo cáo'));if(account.role==='sale')assert.ok(html.includes('Gửi báo cáo')||html.includes('Lưu thay đổi'));
 }
 assert.ok(source.includes("page==='daily'&&saleDaily&&<SaleDaily"));assert.ok(source.includes("page==='daily'&&!saleDaily&&<Daily"));assert.equal(source.includes("page==='daily'&&<WeeklyEntry"),false);
});

test('Calendar selects a single day or a sorted range and restarts after a complete range',()=>{
 const one=ui.selectCalendarDay({start:'2026-11-01',end:'2026-11-02'},'2026-11-03');
 assert.deepEqual(one,{start:'2026-11-03',end:null});
 assert.deepEqual(ui.selectCalendarDay(one,'2026-11-07'),{start:'2026-11-03',end:'2026-11-07'});
 assert.deepEqual(ui.selectCalendarDay(one,'2026-11-01'),{start:'2026-11-01',end:'2026-11-03'});
});
test('Date presets use actual report bounds and Monday to Saturday',()=>{
 const bounds=[{first:'2024-05-01',last:'2026-11-03'},{first:'2026-10-01',last:'2026-11-04'}];
 assert.deepEqual(ui.reportDatePreset('latest','2026-11-06',bounds),{start:'2026-11-05',end:'2026-11-05'});
 assert.deepEqual(ui.reportDatePreset('all','2026-11-05',bounds),{start:'2024-05-01',end:'2026-11-05'});
 assert.deepEqual(ui.reportDatePreset('week','2026-11-05'),{start:'2026-11-02',end:'2026-11-07'});
 assert.deepEqual(ui.reportDatePreset('week','2026-11-08'),{start:'2026-11-02',end:'2026-11-07'});
 assert.deepEqual(ui.reportDatePreset('month','2026-02-15'),{start:'2026-02-01',end:'2026-02-28'});
});

test('Detail report shows the month revenue and month-based achievement',()=>{
 const entry=(productId,extra={})=>({productId,budget:0,remaining:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,received:0,...extra});
 const customDb={accounts:[{id:'admin',ownerName:'Admin',username:'admin',role:'admin',active:true},{id:'u1',ownerName:'Linh',username:'linh',role:'user',active:true}],
  products:[{id:'p1',name:'Mới nhất',priceUsd:100,rate:22500,active:true,color:'#0e7861'}],
  assignments:[{id:'a1',accountId:'u1',productId:'p1',active:true}],
  reports:[{id:'r3',accountId:'u1',date:'2026-11-06',status:'submitted',entries:[entry('p1',{received:1000000,budget:1000000,remaining:900000,data:20,tt:5})],revision:1}],
  orders:[{id:'o1',accountId:'u1',productId:'p1',date:'2026-11-02',type:'sale',amountVnd:1000000},{id:'o2',accountId:'u1',productId:'p1',date:'2026-11-04',type:'care',amountVnd:500000},{id:'o3',accountId:'u1',productId:'p1',date:'2026-10-31',type:'sale',amountVnd:9000000}],
  targets:[{id:'t1',accountId:'u1',productId:'p1',month:'2026-11',revenue:10000000,care:0}],appointments:[],reportrequests:[]};
 const html=renderToString(React.createElement(ui.InlineReportEditor,{db:customDb,record:customDb.reports[0],user:admin,mutate:async()=>true,notify(){},onHistory(){}}));
 assert.ok(html.includes('Tổng doanh số tháng'));assert.ok(html.includes('1.500.000'));assert.ok(html.includes('15%'));assert.equal(html.includes('Ngày báo cáo'),false);
});

function saleFixture(){
 const entry=(productId,extra={})=>({productId,budget:0,remaining:0,data:0,tt:0,ktt:0,success:0,upsale:0,appointments:0,late:0,received:0,...extra});
 return {accounts:[{id:'admin',ownerName:'Admin',username:'admin',role:'admin',active:true},{id:'u1',ownerName:'Linh',username:'linh',role:'user',active:true},{id:'s1',ownerName:'Quyên',username:'quyen',role:'sale',active:true}],
  products:[{id:'p1',name:'Mới nhất',priceUsd:100,rate:22500,active:true,color:'#0e7861'},{id:'p2',name:'Ngủ quên',priceUsd:100,rate:22500,active:true,color:'#6579b9'}],
  assignments:[{id:'a1',accountId:'u1',productId:'p1',active:true},{id:'a2',accountId:'u1',productId:'p2',active:true},{id:'a3',accountId:'s1',productId:'p1',active:true},{id:'a4',accountId:'s1',productId:'p2',active:true}],
  reports:[
   {id:'r1',accountId:'s1',date:'2026-11-01',status:'submitted',entries:[entry('p2',{data:10,tt:5})],revision:1},
   {id:'r2',accountId:'s1',date:'2026-11-05',status:'submitted',entries:[entry('p1',{data:8,tt:4})],revision:1},
   {id:'r3',accountId:'s1',date:'2026-11-06',status:'submitted',entries:[entry('p1',{data:20,tt:5}),entry('p2',{})],revision:1},
  ],
  orders:[{id:'o1',accountId:'u1',saleAccountId:'s1',productId:'p1',date:'2026-11-02',type:'sale',amountVnd:1000000},{id:'o2',accountId:'u1',saleAccountId:'s1',productId:'p1',date:'2026-11-04',type:'care',amountVnd:500000},{id:'o3',accountId:'u1',saleAccountId:'s1',productId:'p1',date:'2026-10-31',type:'sale',amountVnd:9000000}],
  targets:[{id:'t1',accountId:'s1',productId:'p1',month:'2026-11',revenue:10000000,care:0}],appointments:[],reportrequests:[]};
}

test('SALE detail shows the month revenue, month-based achievement, sort and hide',()=>{
 const customDb=saleFixture();
 const html=renderToString(React.createElement(ui.SaleReportEditor,{db:customDb,record:customDb.reports[2],user:admin,mutate:async()=>true,notify(){},onHistory(){}}));
 assert.ok(html.includes('Tổng doanh số tháng'));assert.ok(html.includes('1.500.000'));assert.ok(html.includes('15%'));
 assert.ok(html.includes('Ẩn'));assert.ok(html.includes('Đã ẩn'));assert.equal(html.includes('Ngày báo cáo'),false);
 assert.ok(html.includes('06/11/2026'));
});

test('SALE summary shows the month revenue row for a partial range',()=>{
 const customDb=saleFixture(),scope=JSON.stringify(['admin','']);
 const key='so-lieu.workspace.v1:'+encodeURIComponent(scope)+':reports.overview.period.v5';
 const tab=new Map();globalThis.sessionStorage={getItem:k=>tab.get(k)||null,setItem:(k,v)=>tab.set(k,v),removeItem:k=>tab.delete(k)};
 tab.set(key,JSON.stringify({version:1,value:{mode:'range',date:'2026-11-06',from:'2026-11-01',to:'2026-11-06',month:'2026-11',product:'all',automaticDue:false}}));
 try{
  const html=renderToString(React.createElement(ui.WorkspaceProvider,{scope},React.createElement(ui.DataWindow.Provider,{value:{scope:{from:'2026-11-01',to:'2026-11-06'},ensure(){}}},React.createElement(ui.SaleReports,{db:customDb,user:admin,Filters:ui.Filters,onOpen(){},onOrders(){},route:{},mutate:async()=>true,notify(){},onRouteChange(){}}))));
  assert.ok(html.includes('Tổng doanh số tháng'));assert.ok(html.includes('1.500.000'));assert.ok(html.includes('15%'));assert.ok(html.includes('Ẩn'));
 } finally {delete globalThis.sessionStorage;}
});

test('SALE summary shows the four stat cards',()=>{
 const customDb=saleFixture(),scope=JSON.stringify(['admin','']);
 const key='so-lieu.workspace.v1:'+encodeURIComponent(scope)+':reports.overview.period.v5';
 const tab=new Map();globalThis.sessionStorage={getItem:k=>tab.get(k)||null,setItem:(k,v)=>tab.set(k,v),removeItem:k=>tab.delete(k)};
 tab.set(key,JSON.stringify({version:1,value:{mode:'range',date:'2026-11-06',from:'2026-11-01',to:'2026-11-06',month:'2026-11',product:'all',automaticDue:false}}));
 try{
  const html=renderToString(React.createElement(ui.WorkspaceProvider,{scope},React.createElement(ui.DataWindow.Provider,{value:{scope:{from:'2026-11-01',to:'2026-11-06'},ensure(){}}},React.createElement(ui.SaleReports,{db:customDb,user:admin,Filters:ui.Filters,onOpen(){},onOrders(){},route:{},mutate:async()=>true,notify(){},onRouteChange(){}}))));
  // Tổng doanh số 1.500.000 (2 đơn), Data 38 (tương tác 14), Tỉ lệ chốt 2/38 = 5,26%, Đạt mục tiêu tháng 15%.
  assert.ok(html.includes('Tổng doanh số'));assert.ok(html.includes('Data tương tác: 14'));assert.ok(html.includes('Tỉ lệ chốt'));assert.ok(html.includes('5,26%'));assert.ok(html.includes('Đạt mục tiêu'));assert.ok(html.includes('Doanh số tháng: 1.500.000đ'));
 } finally {delete globalThis.sessionStorage;}
});

test('modal max-height fits its backdrop and leaves the charts modal at 92dvh',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.ok(css.includes('max-height:calc(100dvh - 40px);overflow:auto;box-shadow:0 30px 100px #0c281f40;padding:24px}'));
 assert.equal(css.includes('max-height:calc(100dvh - 32px)'),false);
 assert.ok(css.includes('.charts-modal{width:min(1280px,96vw);max-width:96vw;max-height:92dvh;overflow:auto}'));
 assert.ok(css.includes('thead th:has(.col-hide){text-align:center;white-space:nowrap}'));
});

test('Targets page shows a red missing-target badge for an account with no targets',()=>{
 storage.clear();
 const customDb=fixtureDb();customDb.targets=customDb.targets.filter(t=>t.accountId!=='u2');
 const html=renderToString(React.createElement(ui.Targets,{db:customDb,user:admin,mutate:async()=>true,notify(){},route:{accountId:'u2'}}));
 assert.ok(html.includes('Chưa gửi mục tiêu'));assert.ok(html.includes('target-missing'));
});

test('Change password modal asks for the current and new passwords',()=>{
 const html=renderToString(React.createElement(ui.ChangePasswordModal,{mutate:async()=>true,notify(){},onClose(){}}));
 assert.ok(html.includes('Đổi mật khẩu'));assert.ok(html.includes('Mật khẩu hiện tại'));assert.ok(html.includes('Mật khẩu mới'));assert.ok(html.includes('Nhập lại mật khẩu mới'));
});

test('Daily save is dimmed for a submitted report with no edits',()=>{
 // Daily fills its entries in an effect, so the save dock never renders in a
 // server render; pin the disabled rule in source instead (SaleDaily below
 // covers the same rule in a live render).
 assert.ok(source.includes('(submitted&&!dirty)'));
 assert.ok(source.includes("disabled={busy||blocked||!!budgetError||(submitted&&!dirty)}"));
});

test('SALE daily save is dimmed for a submitted report with no edits, live for a draft',()=>{
 const saveButton=html=>{const m=html.match(/<button[^>]*class="btn primary"[^>]*>(?:(?!<\/button>).)*?(Lưu thay đổi|Gửi báo cáo)<\/button>/);assert.ok(m,'save button not found');return m[0];};
 const customDb=saleFixture();
 const submitted=renderToString(React.createElement(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},React.createElement(ui.SaleDaily,{db:customDb,user:admin,initial:{accountId:'s1',date:'2026-11-06'},onBack(){},mutate:async()=>true,notify(){},onRouteChange(){}})));
 assert.ok(saveButton(submitted).includes('Lưu thay đổi'));assert.ok(saveButton(submitted).includes('disabled'));
 const draftDb=saleFixture();draftDb.reports[2]={...draftDb.reports[2],status:'draft'};
 const draft=renderToString(React.createElement(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},React.createElement(ui.SaleDaily,{db:draftDb,user:admin,initial:{accountId:'s1',date:'2026-11-06'},onBack(){},mutate:async()=>true,notify(){},onRouteChange(){}})));
 assert.ok(saveButton(draft).includes('Lưu thay đổi'));assert.equal(saveButton(draft).includes('disabled'),false);
});

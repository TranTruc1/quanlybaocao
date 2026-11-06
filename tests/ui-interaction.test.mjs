import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import React,{act,useState} from 'react';
import {fixtureDb} from './fixtures.js';
import {dayString,previousDay} from '../src/domain.js';
const dom=new JSDOM('<!doctype html><body><button id="launch">Launch</button><div id="root"></div></body>',{url:'http://localhost/',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','KeyboardEvent','MutationObserver','localStorage','sessionStorage'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true,writable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
HTMLElement.prototype.getClientRects=function(){return [{width:100,height:30}];};window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
const {createRoot}=await import('react-dom/client');
const mainSource=await fs.readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
const entry=mainSource+'\nexport {Daily,Appointments};\n'+`export {default as Modal} from './Modal.jsx';export {default as DateField} from './DateField.jsx';export {default as BatchEntry} from './BatchEntry.jsx';export {default as ReportList} from './ReportList.jsx';export {default as SaleReports} from './SaleReports.jsx';export {WorkspaceProvider} from './WorkspaceState.jsx';export {DataWindow} from './DataWindow.jsx';`;
const bundle=new URL('../.review-ui-dom.mjs',import.meta.url);
await build({stdin:{contents:entry,loader:'jsx',resolveDir:fileURLToPath(new URL('../src',import.meta.url))},bundle:true,format:'esm',platform:'node',outfile:fileURLToPath(bundle),external:['react','react-dom','react-dom/*','lucide-react']});
const ui=await import(bundle.href);await fs.unlink(bundle);const h=React.createElement;
let root;const mount=async element=>{root=createRoot(document.getElementById('root'));await act(async()=>root.render(element));};const unmount=async()=>{await act(async()=>root.unmount());sessionStorage.clear();document.body.style.overflow='';};
const click=async element=>act(async()=>element.dispatchEvent(new MouseEvent('click',{bubbles:true})));
const fill=async(element,value)=>act(async()=>{Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});
test('Nested dialogs lock background scrolling, focus textareas and Escape closes only the top dialog',async()=>{
 const launch=document.getElementById('launch');launch.focus();document.body.style.overflow='auto';
 function Demo(){const [outer,setOuter]=useState(true),[inner,setInner]=useState(false);return outer?h(ui.Modal,{title:'Outer',onClose:()=>setOuter(false)},h('textarea',{'aria-label':'Note'}),h('button',{onClick:()=>setInner(true)},'Nested'),inner&&h(ui.Modal,{title:'Inner',onClose:()=>setInner(false)},h('input',{'aria-label':'Inner input'}))):null;}
 await mount(h(Demo));assert.equal(document.body.style.overflow,'hidden');assert.equal(document.activeElement.tagName,'TEXTAREA');await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Nested'));assert.equal(document.querySelectorAll('[role=dialog]').length,2);
 await act(async()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(document.querySelectorAll('[role=dialog]').length,1);assert.equal(document.body.style.overflow,'hidden');
 await act(async()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(document.querySelectorAll('[role=dialog]').length,0);assert.equal(document.body.style.overflow,'auto');assert.equal(document.activeElement,launch);await unmount();
});
test('Date picker escapes modal clipping; choosing a day keeps the modal open and restores trigger focus',async()=>{
 function Demo(){const [date,setDate]=useState('2026-11-04');return h(ui.Modal,{title:'Date test',onClose(){}},h(ui.DateField,{value:date,onChange:e=>setDate(e.target.value)}));}
 await mount(h(Demo));const trigger=document.querySelector('.date-trigger');await click(trigger);const menu=document.querySelector('.date-popover');assert.equal(menu.parentElement,document.body);await click(menu.querySelector('[aria-label="05/11/2026"]'));assert.equal(document.querySelector('.date-popover'),null);assert.match(trigger.textContent,/05 \/ 11 \/ 2026/);assert.equal(document.activeElement,trigger);assert.equal(document.querySelectorAll('[role=dialog]').length,1);await unmount();
});
test('Closing a bulk entry retains the draft; successful saving clears it and does not duplicate the action',async()=>{
 let saves=0;function Demo(){const [open,setOpen]=useState(true);return h(ui.WorkspaceProvider,{scope:'test-bulk'},h('button',{onClick:()=>setOpen(true)},'Reopen'),open&&h(ui.BatchEntry,{kind:'products',mutate:async()=>{saves++;return true;},notify(){},onClose:()=>setOpen(false)}));}
 await mount(h(Demo));await fill(document.querySelector('[aria-label="Tên sản phẩm dòng 1"]'),'Toma');await fill(document.querySelector('[aria-label="Giá USD dòng 1"]'),'380');await click(document.querySelector('[aria-label="Đóng"]'));assert.equal(document.querySelector('[role=dialog]'),null);await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Reopen'));assert.equal(document.querySelector('[aria-label="Tên sản phẩm dòng 1"]').value,'Toma');assert.equal(saves,0);
 await act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(saves,1);await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Reopen'));assert.equal(document.querySelector('[aria-label="Tên sản phẩm dòng 1"]').value,'');await unmount();
});
test('MKT and SALE open yesterday, aggregate ranges without a view selector, and restore the month overview',async()=>{
 const base=fixtureDb(),sale={id:'s1',role:'sale',ownerName:'SALE',active:true};base.accounts.push(sale);base.assignments.push(...base.assignments.filter(a=>a.accountId==='u1').map(a=>({...a,id:a.id+'s',accountId:'s1'})));base.reports.push(...base.reports.filter(r=>r.accountId==='u1').map(r=>({...r,id:r.id+'s',accountId:'s1'})));
 for(const [Component,accountId] of [[ui.ReportList,'u1'],[ui.SaleReports,'s1']]){
 let current,setFilter;function Filters(props){current=props.filter;setFilter=props.setFilter;return h('span',{'data-mode':current.mode},current.mode);}
 const props={db:base,user:base.accounts[0],mutate:async()=>true,notify(){},FilterComponent:Filters,Filters,onOpen(){},onOrders(){}};
 const wrap=route=>h(ui.WorkspaceProvider,{scope:'review-'+accountId},h(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},h(Component,{...props,route})));
 await mount(wrap({employee:accountId}));assert.equal(current.mode,'day');assert.equal(current.date,previousDay());await act(async()=>setFilter(f=>({...f,mode:'range',from:dayString().slice(0,7)+'-01',to:previousDay()})));assert.equal(document.querySelector('[aria-label="Cách xem dải ngày"]'),null);assert.equal(document.querySelector('.inline-report-editor,.sale-report-editor'),null);assert.ok(document.querySelector('.product-summary'));
 await act(async()=>root.render(wrap({employee:null})));assert.equal(current.mode,'month');assert.equal(current.month,dayString().slice(0,7));await unmount();
 }
});
test('Account and team changes preserve manual dates and ranges; missing due reports never fall back to older reports',async()=>{
 const db=fixtureDb(),sale={id:'s1',role:'sale',ownerName:'SALE',active:true};db.accounts.push(sale);
 db.assignments.push({id:'sale-p1',accountId:'s1',productId:'p1',active:true});
 db.reports=db.reports.filter(r=>r.date<previousDay());
 let current,setFilter;
 function Filters(props){current=props.filter;setFilter=props.setFilter;return null;}
 const props={db,user:db.accounts[0],mutate:async()=>true,notify(){},FilterComponent:Filters,Filters,onOrders(){}};
 const wrap=(Component,employee)=>h(ui.WorkspaceProvider,{scope:'shared-report-period'},h(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},h(Component,{...props,route:{employee}})));
 await mount(wrap(ui.ReportList,'u1'));
 assert.equal(current.date,previousDay());assert.match(document.querySelector('.status').textContent,/Chưa gửi/);assert.equal(document.querySelector('.inline-report-editor'),null);
 await act(async()=>setFilter(f=>({...f,mode:'day',date:'2026-11-03',from:'2026-11-03',to:'2026-11-03',automaticDue:false})));
 await act(async()=>root.render(wrap(ui.ReportList,'u2')));assert.equal(current.date,'2026-11-03');assert.equal(current.account,'u2');
 await act(async()=>root.render(wrap(ui.SaleReports,'s1')));assert.equal(current.date,'2026-11-03');assert.equal(current.account,'s1');assert.match(document.querySelector('.status').textContent,/Chưa gửi/);
 await act(async()=>setFilter(f=>({...f,mode:'range',from:'2026-11-01',to:'2026-11-05',automaticDue:false})));
 await act(async()=>root.render(wrap(ui.ReportList,'u1')));assert.equal(current.mode,'range');assert.equal(current.from,'2026-11-01');assert.equal(current.to,'2026-11-05');assert.equal(current.account,'u1');
 await unmount();
});
test('Report period stays stable when the parent remembers report navigation',async()=>{
 const db=fixtureDb();let renders=0;
 function Parent(){const [view,setView]=useState(null);renders++;assert.ok(renders<10,'navigation state must not cause a render loop');return h(ui.WorkspaceProvider,{scope:'stable-period'},h(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},h(ui.ReportList,{db,user:db.accounts[0],route:{employee:'u1'},initialView:view,onViewChange:setView,FilterComponent:()=>null,mutate:async()=>true,notify(){}})));}
 await mount(h(Parent));assert.ok(renders<10);await unmount();
});
test('MKT sends a valid new report with one click and keeps the former product-card layout',async()=>{
 const db=fixtureDb(),user=db.accounts.find(a=>a.id==='u1'),date=previousDay();db.reports=db.reports.filter(r=>r.accountId!==user.id||r.date!==date);const calls=[];
 await mount(h(ui.WorkspaceProvider,{scope:'one-click-daily'},h(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},h(ui.Daily,{db,user,initial:{accountId:user.id,date},mutate:async(action,payload)=>{calls.push({action,payload});return true;},notify(){}}))));
 assert.ok(document.querySelectorAll('.entry-card').length);await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Gửi báo cáo'));assert.equal(calls.length,1);assert.equal(calls[0].action,'saveReport');assert.equal(calls[0].payload.date,date);assert.equal(calls[0].payload.status,'submitted');assert.equal(document.querySelector('[aria-label="Gửi báo cáo?"]'),null);await unmount();
});
test('MKT and SALE create appointments and change status from the list with one save per action',async()=>{
 for(const actor of ['u1','s1']){
  const fixture=fixtureDb(),sale={id:'s1',role:'sale',ownerName:'Quyên',active:true};fixture.accounts.push(sale);fixture.assignments.push({id:'s1-p1',accountId:'s1',productId:'p1',active:true});fixture.appointments=[];const user=fixture.accounts.find(a=>a.id===actor),calls=[];
  function Demo(){const [db,setDb]=useState(fixture);const mutate=async(action,payload)=>{calls.push({action,payload});const row={...payload,id:payload.id||'appointment-1',revision:(payload.revision||0)+1};setDb(prev=>({...prev,appointments:[...prev.appointments.filter(a=>a.id!==row.id),row]}));return true;};return h(ui.WorkspaceProvider,{scope:'appointments-ui-'+actor},h(ui.DataWindow.Provider,{value:{scope:{from:'2020-01-01',to:'2030-12-31'},ensure(){}}},h(ui.Appointments,{db,user,mutate,notify(){}})));}
  await mount(h(Demo));await click([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Thêm đơn hẹn'));
  const field=label=>[...document.querySelectorAll('.appointment-modal label')].find(el=>el.textContent.startsWith(label));
  await act(async()=>{const select=field('Sản phẩm').querySelector('select');select.value='p1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  if(actor==='s1')await act(async()=>{const select=field('MKT nhận đơn').querySelector('select');select.value='u1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await fill(field('Tên khách hàng').querySelector('input'),'Anna');await act(async()=>document.querySelector('.appointment-modal form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(calls.length,1);assert.equal(calls[0].action,'saveAppointment');assert.equal(calls[0].payload.status,'pending');assert.equal(document.querySelectorAll('tbody tr').length,1);
  await act(async()=>{const select=document.querySelector('.appointment-status');select.value='converted';select.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(calls.length,2);assert.equal(calls[1].payload.status,'converted');assert.equal(document.querySelectorAll('tbody tr').length,1);assert.match(document.querySelector('.tag').textContent,/0 đang hẹn/);await unmount();
 }
});

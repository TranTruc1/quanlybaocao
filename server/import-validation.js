import {normalizeBudgets} from '../src/budget-transfers.js';
export const IMPORT_TABLES=['Accounts','Products','Assignments','Reports','Orders','Targets','Audit','Notifications','ReportRequests'];
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function validateImport(input){
 if(input?.format!=='so-lieu-export'||input.version!==1||!input.tables)throw Error('Cần file JSON từ xuatDuLieuSangMongoDB.');
 const tables={};
 for(const table of IMPORT_TABLES){
  const rows=input.tables[table]||[];if(!Array.isArray(rows))throw Error('Bảng không hợp lệ: '+table);
  const ids=new Set();
  tables[table]=rows.map(row=>{
   if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||ids.has(row.id))throw Error('ID thiếu hoặc trùng trong '+table);
   ids.add(row.id);const clean=structuredClone(row);delete clean._id;delete clean._normalized;delete clean._carryContext;
   if(JSON.stringify(clean).length>1000000)throw Error('Bản ghi quá lớn: '+table+' '+row.id);
   return clean;
  });
  if(input.counts?.[table]!==undefined&&input.counts[table]!==rows.length)throw Error('Sai số bản ghi '+table);
 }
 const accounts=new Set(tables.Accounts.map(a=>a.id)),products=new Set(tables.Products.map(p=>p.id));
 if(!tables.Accounts.some(a=>a.active&&a.role==='admin'))throw Error('File cần có ít nhất một admin đang hoạt động.');
 const usernames=new Set();for(const a of tables.Accounts){
  const name=a.username?.toLowerCase();if(!name||usernames.has(name)||!['admin','user','sale'].includes(a.role))throw Error('Tên hoặc vai trò account lỗi: '+a.id);usernames.add(name);
  if(typeof a.passwordHash!=='string'||typeof a.salt!=='string'||!Number.isInteger(a.iterations)||a.iterations<10000||a.iterations>1000000)throw Error('Thiếu cấu trúc mật khẩu: '+a.username);
 }
 const keys=new Set();
 for(const table of ['Assignments','Reports','Orders','Targets','ReportRequests'])for(const r of tables[table]){
  if(!accounts.has(r.accountId))throw Error(table+': thiếu account '+r.accountId);
  if(table==='Reports'){
   if(!date(r.date)||!Array.isArray(r.entries)||!r.entries.length)throw Error('Báo cáo không hợp lệ '+r.id);
   const entryIds=new Set();for(const e of r.entries){
    if(!products.has(e.productId)||entryIds.has(e.productId))throw Error('Sản phẩm thiếu/trùng trong báo cáo '+r.id);entryIds.add(e.productId);
    for(const key of ['budget','remaining','data','tt','appointments','late'])if(!Number.isFinite(Number(e[key]||0))||Number(e[key]||0)<0)throw Error('Số liệu lỗi: '+r.id+' '+key);
    if(Number(e.tt||0)>Number(e.data||0))throw Error('Data tương tác vượt tổng data: '+r.date+' '+r.accountId);
    e.ktt=Number(e.data||0)-Number(e.tt||0);
   }
  }else if(r.productId&&!products.has(r.productId))throw Error(table+': thiếu sản phẩm '+r.productId);
  if(table==='Orders'&&(!date(r.date)||(r.saleAccountId&&!accounts.has(r.saleAccountId))))throw Error('Đơn hàng thiếu ngày hoặc SALE: '+r.id);
  const key=table==='Reports'?table+'|'+r.accountId+'|'+r.date:table==='Assignments'?table+'|'+r.accountId+'|'+r.productId:table==='Targets'?table+'|'+r.accountId+'|'+r.month+'|'+r.productId:null;
  if(key){if(keys.has(key))throw Error('Trùng dữ liệu: '+key);keys.add(key);}
 }
 tables.Reports=normalizeBudgets(tables.Reports);
 return tables;
}

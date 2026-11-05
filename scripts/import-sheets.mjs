import {readFile} from 'node:fs/promises';
import {connection,createIndexes} from '../server/mongodb.js';
import {validateImport,IMPORT_TABLES} from '../server/import-validation.js';
const args=process.argv.slice(2),path=args.find(a=>!a.startsWith('--'));
if(!path)throw Error('Cách dùng: npm run db:import -- migration/export.json [--apply]');
const tables=validateImport(JSON.parse(await readFile(path,'utf8')));
if(tables.Accounts.some(a=>a.pepperVersion===1)&&!process.env.SL_AUTH_PEPPER)throw Error('Điền SL_AUTH_PEPPER giống Apps Script cũ để giữ mật khẩu.');
console.table(Object.fromEntries(IMPORT_TABLES.map(name=>[name,{records:tables[name].length}])));
if(!args.includes('--apply')){console.log('Kiểm tra hợp lệ. Chưa ghi database. Thêm --apply để nhập vào database trống.');process.exit(0);}
const {client,db}=await connection();
try{
 await createIndexes(db);const session=client.startSession();
 try{await session.withTransaction(async()=>{
  await db.collection('_meta').updateOne({_id:'write-sequence'},{$inc:{version:1}},{session});
  for(const table of [...IMPORT_TABLES,'Sessions'])if(await db.collection(table).countDocuments({},{session,limit:1}))throw Error('Database chưa trống: '+table+'. Không ghi đè. Dùng database mới hoặc sao lưu trước.');
  for(const name of IMPORT_TABLES)if(tables[name].length)await db.collection(name).insertMany(tables[name],{session,ordered:true});
 });}finally{await session.endSession();}
 console.log('Đã nhập đủ dữ liệu, giữ nguyên ID và liên kết. Phiên cũ không được chuyển; đăng nhập lại.');
}finally{await client.close();}

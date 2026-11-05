import {connection} from '../server/mongodb.js';
import {readFile} from 'node:fs/promises';
const username=(process.argv[2]||'tam').trim().toLowerCase();
const {client,db}=await connection();
try{
 console.log('Database đang dùng:',db.databaseName);
 const count=await db.collection('Accounts').countDocuments({});console.log('Số tài khoản đã nhập:',count);
 const accounts=await db.collection('Accounts').find({},{projection:{username:1,active:1,role:1,_id:0}}).toArray();console.table(accounts);
 const account=await db.collection('Accounts').findOne({username:{$regex:'^'+username.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$',$options:'i'}});
 if(!account){console.log('KHÔNG TÌM THẤY tài khoản. Nếu số tài khoản bằng 0: cần nhập JSON với --apply. Nếu đã nhập, kiểm tra MONGODB_DB.');}
 else{
  console.log('Tài khoản đang hoạt động:',account.active===true&&!account.deletedAt);
  console.log('Có SL_AUTH_PEPPER trong môi trường:',Boolean(process.env.SL_AUTH_PEPPER));
  try{
   const original=JSON.parse(await readFile('migration/export.json','utf8')).tables?.Accounts?.find(a=>a.id===account.id);
   console.log('Có cùng ID trong file xuất:',Boolean(original));
   if(original)console.log('Hash/salt/vòng băm/pepperVersion khớp file xuất:',['passwordHash','salt','iterations','pepperVersion'].every(k=>account[k]===original[k]));
  }catch{console.log('Không đọc được migration/export.json để đối chiếu.');}
  console.log('Nếu tài khoản và hash đúng: đối chiếu SL_AUTH_PEPPER với Apps Script cũ, lưu .env.local rồi dừng và khởi động lại npm run dev. Không đổi pepper hoặc mật khẩu ngẫu nhiên.');
 }
}finally{await client.close();}

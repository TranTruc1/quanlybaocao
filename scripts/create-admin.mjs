import {randomUUID} from 'node:crypto';
import {connection,createIndexes} from '../server/mongodb.js';
import {passwordRecord} from '../server/passwords.js';
const username=process.env.INITIAL_ADMIN_USERNAME,ownerName=process.env.INITIAL_ADMIN_NAME,password=process.env.INITIAL_ADMIN_PASSWORD;
if(!/^[a-zA-Z0-9_.-]{2,60}$/.test(username||'')||!ownerName||!password||password.length<6||password.length>20)throw Error('Điền INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_NAME, INITIAL_ADMIN_PASSWORD (6–20 ký tự) trong .env.local.');
const record={id:randomUUID(),username,ownerName,role:'admin',active:true,revision:1,...passwordRecord(password)};
const {client,db}=await connection();
try{await createIndexes(db);const session=client.startSession();try{await session.withTransaction(async()=>{
 await db.collection('_meta').updateOne({_id:'write-sequence'},{$inc:{version:1}},{session});
 if(await db.collection('Accounts').countDocuments({},{session,limit:1}))throw Error('Đã có tài khoản. Không khởi tạo lại.');
 await db.collection('Accounts').insertOne(record,{session});
});}finally{await session.endSession();}console.log('Đã tạo admin. Xóa các biến INITIAL_ADMIN_* sau khi tạo.');}finally{await client.close();}

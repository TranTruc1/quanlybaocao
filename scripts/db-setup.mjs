import {connection,createIndexes} from '../server/mongodb.js';
const {client,db}=await connection();try{await createIndexes(db);console.log('Đã tạo index và khóa giao dịch cho database.');}finally{await client.close();}

import {pbkdf2Sync,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
const b64=buffer=>buffer.toString('base64').replaceAll('+','-').replaceAll('/','_');
export function pepperHash(derived){
 if(!process.env.SL_AUTH_PEPPER)throw Object.assign(Error('Chưa cấu hình SL_AUTH_PEPPER trên máy chủ.'),{code:'NOT_CONFIGURED'});
 return b64(createHmac('sha256',process.env.SL_AUTH_PEPPER).update(derived,'utf8').digest());
}
export function passwordDigest(password,account){
 if(!Number.isInteger(account.iterations)||account.iterations<10000||account.iterations>1000000||typeof account.salt!=='string')throw Error('Cấu trúc mật khẩu không hợp lệ.');
 const derived=b64(pbkdf2Sync(password,account.salt,account.iterations,32,'sha256'));
 return account.pepperVersion===1?pepperHash(derived):derived;
}
export function passwordRecord(password){
 const record={salt:randomUUID()+randomUUID(),iterations:210000,pepperVersion:1};
 return {...record,passwordHash:passwordDigest(password,record)};
}
export function equalSecret(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}

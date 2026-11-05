// SERVER ONLY. Put actual secrets in .env.local / Vercel Environment Variables.
export function mongoConfig(env=process.env){
 if(!env.MONGODB_URI)throw Object.assign(new Error('Chưa cấu hình MONGODB_URI trên máy chủ.'),{code:'NOT_CONFIGURED'});
 if(!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI))throw Error('MONGODB_URI không hợp lệ.');
 return {uri:env.MONGODB_URI,database:env.MONGODB_DB||'quanlybaocao',options:{maxPoolSize:5,minPoolSize:0,maxIdleTimeMS:60000,serverSelectionTimeoutMS:8000,connectTimeoutMS:8000}};
}

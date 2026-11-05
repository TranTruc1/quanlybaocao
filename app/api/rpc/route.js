import {NextResponse} from 'next/server.js';
import {handleRequest} from '../../../server/service.js';
import {allowedRequest} from '../../../server/request-origin.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const cookie='sl_session';
export async function POST(request){
 try{
  if(!allowedRequest(request))return NextResponse.json({ok:false,error:'Nguồn yêu cầu không hợp lệ. Tải lại trang và dùng cùng địa chỉ khi đăng nhập.',code:'FORBIDDEN'},{status:403,headers:{'Cache-Control':'no-store'}});
  const reader=request.body?.getReader();if(!reader)throw Error('Empty body');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>300000){await reader.cancel();return NextResponse.json({ok:false,error:'Yêu cầu quá lớn.',code:'VALIDATION_ERROR'},{status:413});}chunks.push(value);}
  const req=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!req||typeof req!=='object'||Array.isArray(req))return NextResponse.json({ok:false,error:'Yêu cầu không hợp lệ.',code:'VALIDATION_ERROR'},{status:400});
  // The browser supplies a sentinel only; the real token stays in HttpOnly cookies.
  req.token=request.cookies.get(cookie)?.value;
  const data=await handleRequest(req,{ip:request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown'});
  const token=req.action==='login'?data.token:null;if(token)data.token='cookie';
  const response=NextResponse.json({ok:true,data},{headers:{'Cache-Control':'no-store'}});
  if(token)response.cookies.set(cookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:43200});
  if(req.action==='logout')response.cookies.delete(cookie);
  return response;
 }catch(e){
  const code=e.code||(e instanceof SyntaxError?'VALIDATION_ERROR':'SERVER_ERROR');
  const safe=['VALIDATION_ERROR','FORBIDDEN','UNAUTHENTICATED','CONFLICT','DUPLICATE_ORDER','RATE_LIMITED','NOT_CONFIGURED'].includes(code);
  if(!safe)console.error('RPC failure',{name:e.name,code:e.code});
  const response=NextResponse.json({ok:false,error:safe?e.message:'Máy chủ chưa hoàn tất yêu cầu. Thử lại cùng dữ liệu.',code:safe?code:'SERVER_ERROR'},{status:code==='UNAUTHENTICATED'?401:code==='FORBIDDEN'?403:code==='RATE_LIMITED'?429:!safe?500:400,headers:{'Cache-Control':'no-store'}});
  if(code==='UNAUTHENTICATED')response.cookies.delete(cookie);return response;
 }
}

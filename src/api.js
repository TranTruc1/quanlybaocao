export const config=window.APP_CONFIG||{};
export const isConfigured=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.apiUrl||'');
export function responseError(data){const e=new Error(data.error||'Có lỗi khi xử lý dữ liệu.');e.code=data.code||(/không có quyền|không đủ quyền|chỉ admin|chưa được phân phối/i.test(e.message)?'FORBIDDEN':/phiên.*hết hạn|vui lòng đăng nhập|account không hoạt động/i.test(e.message)?'UNAUTHENTICATED':undefined);return e;}
const requestIds=new Map();
export function clearRequestState(){requestIds.clear();}
export async function request(action,payload={},session){try{return await requestImpl(action,payload,session);}catch(e){if(!e.code){const classified=responseError({error:e.message});e.code=classified.code;}throw e;}}
async function requestImpl(action,payload={},session){
 let uiRole;try{uiRole=JSON.parse(localStorage.getItem('so-lieu.ui-user'))?.role;}catch{}
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(config.apiUrl||''))throw Error('Cấu hình apiUrl phải là URL HTTPS Apps Script /exec hợp lệ.');
  const read=['login','bootstrap','reportHistory','logout'].includes(action),key=JSON.stringify([session?.token,action,payload]);
  if(!read&&!requestIds.has(key)){requestIds.set(key,crypto.randomUUID().replaceAll('-',''));}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const res=await fetch(config.apiUrl,{method:'POST',redirect:'follow',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({protocol:2,requestId:read?undefined:requestIds.get(key),action,payload,token:session?.token,uiRole})});
   if(!res.ok)throw Error('Không kết nối được máy chủ ('+res.status+').');
   let data;try{data=await res.json();}catch{throw Error('Máy chủ chưa trả JSON hợp lệ. Kiểm tra triển khai Apps Script.');}
   if(!data.ok){if(data.code!=='SERVER_ERROR')requestIds.delete(key);throw responseError(data);}
   requestIds.delete(key);return data.data;
  }catch(e){if(e.name==='AbortError')throw Error('Máy chủ phản hồi quá lâu. Kiểm tra mạng rồi thử lại; yêu cầu lưu được bảo vệ chống trùng.');throw e;}finally{clearTimeout(timer);}
 }

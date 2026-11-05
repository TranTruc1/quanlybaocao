export const config=Object.freeze({apiUrl:'/api/rpc',currency:'VND'});
export const isConfigured=true;
export function responseError(data){const e=new Error(data.error||'Có lỗi khi xử lý dữ liệu.');e.code=data.code||(/không có quyền|không đủ quyền|chỉ admin|chưa được phân phối/i.test(e.message)?'FORBIDDEN':/phiên.*hết hạn|vui lòng đăng nhập|account không hoạt động/i.test(e.message)?'UNAUTHENTICATED':undefined);return e;}
const requestIds=new Map();
export function clearRequestState(){requestIds.clear();}
export async function request(action,payload={},session){try{return await requestImpl(action,payload,session);}catch(e){if(!e.code){const classified=responseError({error:e.message});e.code=classified.code;}throw e;}}
async function requestImpl(action,payload={},session){
 let uiRole;try{uiRole=JSON.parse(localStorage.getItem('so-lieu.ui-user'))?.role;}catch{}

  const read=['login','bootstrap','reportHistory','notifications','ackNotifications','logout'].includes(action),key=JSON.stringify([session?.token,action,payload]);
  if(!read&&!requestIds.has(key)){requestIds.set(key,crypto.randomUUID().replaceAll('-',''));}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const res=await fetch(config.apiUrl,{method:'POST',redirect:'follow',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-SL-Client':'1'},body:JSON.stringify({protocol:2,requestId:read?undefined:requestIds.get(key),action,payload,token:session?.token,uiRole})});

   let data;try{data=await res.json();}catch{throw Error('Máy chủ chưa trả JSON hợp lệ. Kiểm tra API Next.js và kết nối MongoDB.');}
   if(!data.ok){if(data.code!=='SERVER_ERROR')requestIds.delete(key);throw responseError(data);}
   requestIds.delete(key);return data.data;
  }catch(e){if(e.name==='AbortError')throw Error('Máy chủ phản hồi quá lâu. Kiểm tra mạng rồi thử lại; yêu cầu lưu được bảo vệ chống trùng.');throw e;}finally{clearTimeout(timer);}
 }

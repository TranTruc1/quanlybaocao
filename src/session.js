// Only the token and account ID survive reload. Data and roles come from the server.
const key='so-lieu.session';
export function restoreSession(storage=globalThis.sessionStorage){
 try{const s=JSON.parse(storage?.getItem(key)||'null');
  if(typeof s?.token!=='string'||!s.token||s.token.length>512||typeof s?.user?.id!=='string'||!s.user.id){storage?.removeItem(key);return null;}
  return {token:s.token,user:{id:s.user.id}};
 }catch{try{storage?.removeItem(key);}catch{}return null;}
}
export function persistSession(s,storage=globalThis.sessionStorage){
 try{storage?.setItem(key,JSON.stringify({token:s.token,user:{id:s.user.id}}));return true;}catch{return false;}
}
export function forgetSession(storage=globalThis.sessionStorage){try{storage?.removeItem(key);}catch{}}

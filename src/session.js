// Persist only a server token and account ID; never passwords, roles or business data.
const key='so-lieu.session';
const browserStorage=name=>{try{return globalThis[name];}catch{return null;}};
function read(storage){try{const value=JSON.parse(storage?.getItem(key)||'null');if(typeof value?.token==='string'&&value.token&&value.token.length<=512&&typeof value?.user?.id==='string'&&value.user.id)return {token:value.token,user:{id:value.user.id}};storage?.removeItem(key);}catch{try{storage?.removeItem(key);}catch{}}return null;}
export function restoreSession(storage){
 if(storage)return read(storage);
 for(const [name,rememberMe] of [['localStorage',true],['sessionStorage',false]]){const session=read(browserStorage(name));if(session)return {...session,rememberMe};}
 return null;
}
export function persistSession(session,rememberMe=session?.rememberMe){
 const explicit=rememberMe&&typeof rememberMe==='object',target=explicit?rememberMe:browserStorage(rememberMe?'localStorage':'sessionStorage');
 try{if(!target)return false;target.setItem(key,JSON.stringify({token:session.token,user:{id:session.user.id}}));}catch{return false;}
 if(!explicit)try{browserStorage(rememberMe?'sessionStorage':'localStorage')?.removeItem(key);}catch{}
 return true;
}
export function forgetSession(storage){for(const target of storage?[storage]:[browserStorage('localStorage'),browserStorage('sessionStorage')])try{target?.removeItem(key);}catch{}}

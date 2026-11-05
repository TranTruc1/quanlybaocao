const prefix='so-lieu.workspace.v1:';
export const workspaceScope=(accountId,apiUrl='')=>accountId?JSON.stringify([accountId,apiUrl]):null;
export const workspaceKey=(scope,name)=>scope?prefix+encodeURIComponent(scope)+':'+name:null;
const fallback=value=>typeof value==='function'?value():value;
export function readWorkspace(key,initial,storage){
 if(!key)return fallback(initial);
 try{storage=storage||globalThis.sessionStorage;const item=JSON.parse(storage?.getItem(key)||'null');return item?.version===1&&Object.hasOwn(item,'value')?item.value:fallback(initial);}catch{return fallback(initial);}
}
export function writeWorkspace(key,value,storage){
 if(!key)return true;
 try{storage=storage||globalThis.sessionStorage;storage.setItem(key,JSON.stringify({version:1,value},(name,item)=>name==='password'?'':['token','passwordHash','salt'].includes(name)?undefined:item));return true;}catch{return false;}
}
export function removeWorkspace(key,storage){try{if(key)(storage||globalThis.sessionStorage)?.removeItem(key);}catch{}}
export function clearWorkspaceScope(scope,storage){
 if(!scope)return;const start=prefix+encodeURIComponent(scope)+':';
 try{storage=storage||globalThis.sessionStorage;const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(start))keys.push(key);}keys.forEach(key=>storage.removeItem(key));}catch{}
}

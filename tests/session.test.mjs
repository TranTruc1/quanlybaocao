import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSession,persistSession,forgetSession} from '../src/session.js';
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('Reload restores token and account ID without trusting stored roles or caching business data',()=>{
 const tab=storage();persistSession({token:'server-token',user:{id:'user-1',role:'admin'},db:{orders:['private']}},tab);
 assert.deepEqual(restoreSession(tab),{token:'server-token',user:{id:'user-1'}});
 tab.setItem('so-lieu.session',JSON.stringify({token:'server-token',user:{id:'user-1',role:'admin'}}));
 assert.equal(restoreSession(tab).user.role,undefined);
});
test('Explicit logout removes the persisted session',()=>{
 const tab=storage();persistSession({token:'server-token',user:{id:'user-1'}},tab);forgetSession(tab);assert.equal(restoreSession(tab),null);
});
test('Malformed or incomplete storage falls back to login',()=>{
 for(const value of ['broken','{}','null','{"token":"x","user":{}}']){const tab=storage();tab.setItem('so-lieu.session',value);assert.equal(restoreSession(tab),null);assert.equal(tab.getItem('so-lieu.session'),null);}
});
test('Blocked storage does not crash login or logout',()=>{
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.equal(restoreSession(blocked),null);assert.equal(persistSession({token:'x',user:{id:'a'}},blocked),false);assert.doesNotThrow(()=>forgetSession(blocked));
});
test('Remembered sessions survive closing a tab and logout clears both stores without storing passwords',()=>{
 const persistent=storage(),tab=storage();Object.defineProperty(globalThis,'localStorage',{value:persistent,configurable:true});Object.defineProperty(globalThis,'sessionStorage',{value:tab,configurable:true});
 try{const account={token:'token',user:{id:'u',role:'admin'},password:'never-save'};assert.equal(persistSession(account,true),true);assert.equal(tab.getItem('so-lieu.session'),null);assert.equal(persistent.getItem('so-lieu.session').includes('never-save'),false);assert.deepEqual(restoreSession(),{token:'token',user:{id:'u'},rememberMe:true});persistSession(account,false);assert.equal(persistent.getItem('so-lieu.session'),null);assert.equal(restoreSession().rememberMe,false);forgetSession();assert.equal(restoreSession(),null);}finally{delete globalThis.localStorage;delete globalThis.sessionStorage;}
});

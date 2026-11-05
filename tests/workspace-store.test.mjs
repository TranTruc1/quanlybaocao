import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceScope,workspaceKey,readWorkspace,writeWorkspace,removeWorkspace,clearWorkspaceScope} from '../src/workspace-store.js';
function storage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('Reload restores navigation, filters and unsaved values with their original server revision',()=>{
 const tab=storage(),scope=workspaceScope('truc','api-one'),key=workspaceKey(scope,'inline.report1');
 const draft={entries:[{productId:'p',data:123,received:1000000}],revision:4};
 writeWorkspace(workspaceKey(scope,'page'),'overview',tab);writeWorkspace(workspaceKey(scope,'reports.view'),'products',tab);writeWorkspace(key,draft,tab);
 assert.equal(readWorkspace(workspaceKey(scope,'reports.view'),null,tab),'products');assert.deepEqual(readWorkspace(key,null,tab),draft);
 // Fresh server revisions must not replace the original draft revision on restore.
 assert.equal(readWorkspace(key,{revision:5},tab).revision,4);
});
test('Work in progress is isolated by account and API; clearing one account does not erase another',()=>{
 const tab=storage(),a=workspaceScope('a','api'),b=workspaceScope('b','api');
 writeWorkspace(workspaceKey(a,'form'),{name:'A'},tab);writeWorkspace(workspaceKey(b,'form'),{name:'B'},tab);
 assert.equal(readWorkspace(workspaceKey(workspaceScope('a','other-api'),'form'),null,tab),null);
 clearWorkspaceScope(a,tab);assert.equal(readWorkspace(workspaceKey(a,'form'),null,tab),null);assert.equal(readWorkspace(workspaceKey(b,'form'),null,tab).name,'B');
});
test('Passwords and credential material are never written into workspace snapshots',()=>{
 const tab=storage(),key=workspaceKey(workspaceScope('a'),'account');
 assert.equal(writeWorkspace(key,{username:'new',password:'secret123',token:'auth',salt:'salt',nested:{passwordHash:'hash'}},tab),true);
 const raw=tab.getItem(key);assert.equal(raw.includes('secret123'),false);assert.equal(raw.includes('auth'),false);assert.equal(raw.includes('hash'),false);assert.equal(readWorkspace(key,null,tab).password,'');
});
test('Malformed or unavailable storage is safe and a discarded draft does not return',()=>{
 const tab=storage(),key=workspaceKey(workspaceScope('a'),'form');tab.setItem(key,'broken');assert.deepEqual(readWorkspace(key,()=>({value:0}),tab),{value:0});
 writeWorkspace(key,{value:5},tab);removeWorkspace(key,tab);assert.equal(readWorkspace(key,null,tab),null);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(readWorkspace(key,null,blocked),null);assert.equal(writeWorkspace(key,{},blocked),false);
});

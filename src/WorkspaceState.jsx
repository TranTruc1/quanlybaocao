import React,{createContext,useContext,useState,useRef,useCallback} from 'react';
import {workspaceKey,readWorkspace,writeWorkspace,removeWorkspace} from './workspace-store.js';
const Scope=createContext(null);
export function WorkspaceProvider({scope,children}){return <Scope.Provider value={scope}>{children}</Scope.Provider>;}
export function useWorkspaceState(name,initial,scopeOverride){
 const context=useContext(Scope),scope=scopeOverride===undefined?context:scopeOverride,key=workspaceKey(scope,name);
 const load=()=>{let restored=true;const value=readWorkspace(key,()=>{restored=false;return typeof initial==='function'?initial():initial;});return {key,value,persisted:true,restored};};
 const [snapshot,setSnapshot]=useState(load);
 const initialRef=useRef(initial);initialRef.current=initial;
 let current=snapshot;
 // A different account/date gets its own state, never the previous record's values.
 if(snapshot.key!==key){current=load();setSnapshot(current);}
 const live=useRef(current);live.current=current;
 const set=useCallback(update=>{
  const previous=live.current.key===key?live.current.value:readWorkspace(key,initialRef.current);
  const value=typeof update==='function'?update(previous):update;
  const next={key,value,persisted:writeWorkspace(key,value),restored:true};live.current=next;setSnapshot(next);
 },[key]);
 const clear=useCallback(()=>{removeWorkspace(key);const value=typeof initialRef.current==='function'?initialRef.current():initialRef.current;const next={key,value,persisted:true,restored:false};live.current=next;setSnapshot(next);},[key]);
 return [current.value,set,{persisted:current.persisted,restored:current.restored,clear}];
}

import React,{createContext,useContext,useRef,useState,useCallback} from 'react';
import {createSingleFlight} from './async.js';
import {LoaderCircle} from 'lucide-react';
const Operations=createContext({pending:false,source:null,run:async(_,task)=>task()});
export const useOperations=()=>useContext(Operations);
export function OperationsProvider({children}){
 const [state,setState]=useState({pending:false,source:null,label:''});
 const flight=useRef(createSingleFlight());
 const run=useCallback((label,task)=>flight.current(async()=>{
  const active=document.activeElement;
  const source=active?.closest('button')||active?.closest('form')?.querySelector('button[type="submit"],button:not([type])');
  setState({pending:true,source,label});
  try{
   // Give the browser a paint before starting a network request.
   await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
   return await task();
  }finally{setState({pending:false,source:null,label:''});}
 }),[]);
 return <Operations.Provider value={{...state,run}}>{children}{state.pending&&<div className="operation-status" role="status" aria-live="polite"><LoaderCircle size={18} className="spin"/><span>{state.label}</span></div>}</Operations.Provider>;
}
export function ActionButton({children,disabled,onClick,...props}){
 const op=useOperations(),ref=useRef(null);
 const current=op.pending&&op.source===ref.current;
 return <button {...props} ref={ref} disabled={disabled||op.pending} aria-busy={current||undefined} onClick={onClick}>{current&&<LoaderCircle size={16} className="spin"/>}{children}</button>;
}

export function ActionForm({children,onSubmit,...props}){const op=useOperations();return <form {...props} aria-busy={op.pending||undefined} onSubmit={e=>{if(op.pending){e.preventDefault();return;}return onSubmit?.(e);}}><fieldset className="async-fields" disabled={op.pending}>{children}</fieldset></form>;}

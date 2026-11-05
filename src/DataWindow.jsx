import React,{createContext,useContext,useEffect} from 'react';
import {LoaderCircle} from 'lucide-react';
import {containsRange,validRange} from './data-window.js';
export const DataWindow=createContext({scope:null,error:'',ensure:()=>{},history:async()=>({audit:[]})});
export const useDataWindow=()=>useContext(DataWindow);
export default function WindowGate({range,children}){
 const window=useDataWindow(),valid=validRange(range),ready=containsRange(window.scope,range);
 useEffect(()=>{if(valid)window.ensure(range);},[range[0],range[1],valid,ready,window.ensure]);
 if(!valid)return <div className="panel empty"><p>Chọn khoảng ngày hợp lệ, tối đa 367 ngày mỗi lần.</p></div>;
 if(!ready)return <div className="panel empty" role="status">{window.error?<><p>{window.error}</p><button className="btn" onClick={()=>window.ensure(range,true)}>Thử lại</button></>:<><LoaderCircle className="spin" size={24}/><p>Đang tải dữ liệu cho khoảng ngày đã chọn…</p></>}</div>;
 return children;
}

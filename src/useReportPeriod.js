import {useCallback,useEffect,useMemo,useRef} from 'react';
import {useWorkspaceState} from './WorkspaceState.jsx';
import {dayString} from './domain.js';
import {defaultReportPeriod,reportDueDate} from './report-period.js';
export default function useReportPeriod(accountId,user){
 const detail=!!accountId,today=dayString(),key=detail?'reports.detail.period.v5':'reports.overview.period.v5';
 const [period,setPeriod]=useWorkspaceState(key,()=>defaultReportPeriod(detail,today)),initialized=useRef(null);
 const account=user.role==='admin'?(accountId||'all'):user.id;
 useEffect(()=>{
  if(detail){if(period.automaticDue&&period.date!==reportDueDate(today))setPeriod(previous=>({...previous,mode:'day',date:reportDueDate(today),from:reportDueDate(today),to:reportDueDate(today)}));}
  else if(initialized.current!==key){setPeriod(previous=>({...previous,mode:'month',month:today.slice(0,7)}));}
  initialized.current=key;
 },[key,detail,today,period.automaticDue,period.date,setPeriod]);
 const setFilter=useCallback(update=>setPeriod(previous=>{const next=typeof update==='function'?update({...previous,account}):update;const {account:ignored,...value}=next;return value;}),[account,setPeriod]);
 const filter=useMemo(()=>({...period,account}),[period,account]);
 return [filter,setFilter];
}

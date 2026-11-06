import {useEffect,useRef} from 'react';
import {latestReportDate} from './latest-report.js';
import {dayString} from './domain.js';
export default function useLatestReportDate(db,accountId,setFilter){
 const initialized=useRef(null),latest=latestReportDate(db,accountId),month=dayString().slice(0,7);
 useEffect(()=>{
  const key=accountId||'overview-'+month;if(initialized.current===key)return;
  if(!accountId){initialized.current=key;setFilter(f=>({...f,mode:'month',month}));return;}
  if(!latest)return;initialized.current=key;setFilter(f=>({...f,account:accountId,mode:'day',date:latest,from:latest,to:latest}));
 },[accountId,latest,month,setFilter]);
}

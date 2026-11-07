import {previousDay} from './domain.js';
const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function reportPolicy(reports,accountId,now=new Date()){
 const to=previousDay(now),from=shift(to,-6);
 const own=reports.filter(r=>r.accountId===accountId).sort((a,b)=>a.date.localeCompare(b.date));
 const start=own.length?(own[0].date>from?own[0].date:from):from;
 const missing=[];
 if(own.length)for(let d=start;d<=to;d=shift(d,1))if(!own.some(r=>r.date===d&&r.status==='submitted'&&!r._carryContext))missing.push(d);
 return {from,to,start:own.length?start:from,hasHistory:own.length>0,missing,nextDate:missing[0]||to};
}
export function missingReportDates(reports,accountId,now=new Date(),days=5){
 // Red dots only: the most recent `days` days (default 5). The 7-day report
 // policy above is separate — it drives due dates and edit locks, not dots.
 const to=previousDay(now),from=shift(to,-(days-1));
 const own=(reports||[]).filter(r=>r.accountId===accountId&&!r._carryContext).sort((a,b)=>a.date.localeCompare(b.date));
 const start=own.length?(own[0].date>from?own[0].date:from):from;
 const missing=[];
 for(let d=start;d<=to;d=shift(d,1))if(!own.some(r=>r.date===d&&r.status==='submitted'))missing.push(d);
 return missing;
}

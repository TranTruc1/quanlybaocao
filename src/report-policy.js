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
export function missingReportDates(reports,accountId,now=new Date()){
 const p=reportPolicy(reports,accountId,now);
 if(p.hasHistory)return p.missing;
 const days=[];for(let day=p.from;day<=p.to;day=shift(day,1))days.push(day);
 return days;
}

export const appointmentStatuses=[['pending','Đang hẹn'],['converted','Đã chốt'],['cancelled','Đã hủy']];
export function appointmentCount(rows,accountId,date,productId,role='user',fallback=0){
 const related=(rows||[]).filter(row=>row.date===date&&row.productId===productId&&(role==='sale'?row.saleAccountId===accountId:row.accountId===accountId));
 return related.length?related.filter(row=>row.status==='pending').length:Number(fallback||0);
}
export function appointmentTotal(rows,reports,accounts,range,productId,role='user'){
 const counts=new Map(),managed=new Set(),ids=new Set(accounts),owner=row=>role==='sale'?row.saleAccountId:row.accountId;
 for(const report of reports||[])if(ids.has(report.accountId)&&report.date>=range[0]&&report.date<=range[1])for(const e of report.entries||[])if(e.productId===productId)counts.set(report.accountId+'|'+report.date,Number(e.appointments||0));
 for(const row of rows||[])if(ids.has(owner(row))&&row.productId===productId&&row.date>=range[0]&&row.date<=range[1]){const key=owner(row)+'|'+row.date;if(!managed.has(key)){managed.add(key);counts.set(key,0);}if(row.status==='pending')counts.set(key,counts.get(key)+1);}
 return [...counts.values()].reduce((a,b)=>a+b,0);
}

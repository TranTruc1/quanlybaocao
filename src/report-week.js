export const shiftDay=(date,offset)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
export function monthWeeks(month){
 const first=month+'-01',d=new Date(first+'T12:00:00Z'),start=shiftDay(first,-((d.getUTCDay()+6)%7));
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10),weeks=[];
 for(let day=start;day<=last;day=shiftDay(day,7))weeks.push(Array.from({length:7},(_,i)=>shiftDay(day,i)));
 return weeks;
}
export const weekForDate=date=>monthWeeks(date.slice(0,7)).find(w=>w.includes(date));

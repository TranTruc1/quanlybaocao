import test from 'node:test';
import assert from 'node:assert/strict';
import {monthWeeks,weekForDate,shiftDay} from '../src/report-week.js';
test('Calendar weeks cover a month once and run Monday through Sunday across month/year boundaries',()=>{
 for(const month of ['2026-11','2026-02','2026-03','2027-01','2028-02']){
 const weeks=monthWeeks(month),days=weeks.flat();assert.equal(days.length,new Set(days).size);assert.ok(days.includes(month+'-01'));
 for(const week of weeks){assert.equal(week.length,7);assert.equal(new Date(week[0]+'T12:00Z').getUTCDay(),1);assert.equal(new Date(week[6]+'T12:00Z').getUTCDay(),0);for(let i=1;i<7;i++)assert.equal(week[i],shiftDay(week[i-1],1));}
 const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);assert.ok(days.includes(last));}
 assert.deepEqual(weekForDate('2026-11-04'),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
});

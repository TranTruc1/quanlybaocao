import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPolicy} from '../src/report-policy.js';
const now=new Date('2026-11-05T01:00:00Z');
const r=(date,status='submitted')=>({accountId:'a',date,status});
test('No history permits an immediate first report; the window ends yesterday in Vietnam',()=>{
 const p=reportPolicy([],'a',now);assert.equal(p.from,'2026-10-29');assert.equal(p.to,'2026-11-04');assert.equal(p.hasHistory,false);assert.deepEqual(p.missing,[]);assert.equal(p.nextDate,'2026-11-04');
});
test('A draft anchors the first day but does not unlock the next day',()=>{
 const p=reportPolicy([r('2026-11-01','draft')],'a',now);assert.equal(p.start,'2026-11-01');assert.equal(p.nextDate,'2026-11-01');
});
test('A missing date is required even when a later report exists',()=>{
 const p=reportPolicy([r('2026-11-01'),r('2026-11-03'),{...r('2026-11-02'),accountId:'b'}],'a',now);assert.equal(p.nextDate,'2026-11-02');
});
test('Carry context marks an existing account but does not count as a submitted date inside the window',()=>{
 const p=reportPolicy([{...r('2026-10-01'),_carryContext:true},r('2026-10-29')],'a',now);assert.equal(p.start,'2026-10-29');assert.equal(p.nextDate,'2026-10-30');
});

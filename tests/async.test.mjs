import test from 'node:test';
import assert from 'node:assert/strict';
import {createSingleFlight} from '../src/async.js';
test('Repeated clicks do not start duplicate writes or release a running save',async()=>{
 const run=createSingleFlight();let release,calls=0;
 const first=run(async()=>{calls++;await new Promise(r=>release=r);return 'saved';});
 assert.equal(await run(async()=>{calls++;}),false);
 assert.equal(await run(async()=>{calls++;}),false);assert.equal(calls,1);
 release();assert.equal(await first,'saved');
 assert.equal(await run(async()=>{calls++;return 'next';}),'next');assert.equal(calls,2);
});
test('A failed network save releases the gate for a retry',async()=>{
 const run=createSingleFlight();await assert.rejects(run(async()=>{throw Error('Network failure');}),/Network failure/);
 assert.equal(await run(async()=>true),true);
});

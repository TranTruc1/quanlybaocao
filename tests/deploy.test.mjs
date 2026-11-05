import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import config from '../next.config.mjs';
import {mongoConfig} from '../config/mongodb.js';
test('Vercel uses Next.js with no static rewrite swallowing API routes',()=>{const v=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url)));assert.equal(v.framework,'nextjs');assert.equal(v.rewrites,undefined);assert.equal(v.outputDirectory,undefined);});
test('Mongo config fails closed without URI and never exposes credentials to frontend',()=>{assert.throws(()=>mongoConfig({}),/MONGODB_URI/);const c=mongoConfig({MONGODB_URI:'mongodb://localhost/test',MONGODB_DB:'test'});assert.equal(c.database,'test');assert.equal(c.options.maxPoolSize,5);const api=fs.readFileSync(new URL('../src/api.js',import.meta.url),'utf8');assert.equal(api.includes('MONGODB_URI'),false);});
test('Next responses disable framing and sniffing',async()=>{const headers=(await config.headers())[0].headers;assert.equal(headers.find(h=>h.key==='X-Frame-Options').value,'DENY');assert.equal(headers.find(h=>h.key==='X-Content-Type-Options').value,'nosniff');});

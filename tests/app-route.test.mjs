import test from 'node:test';
import assert from 'node:assert/strict';
import {appRouteHash,parseAppRoute} from '../src/app-route.js';
test('Every menu section has a stable reloadable URL',()=>{
 for(const page of ['overview','daily','orders','targets','products','accounts','settings'])assert.equal(parseAppRoute(appRouteHash({page})).page,page);
 assert.equal(appRouteHash({page:'orders'}),'#/don-hang');
 assert.equal(parseAppRoute('#/unknown').page,'overview');
});
test('Daily report links retain report ID, account and date without credentials',()=>{
 const route={page:'daily',report:{id:'sl_report-1',accountId:'account-2',date:'2026-11-04',token:'private'}};
 assert.deepEqual(parseAppRoute(appRouteHash(route)),{page:'daily',report:{id:'sl_report-1',accountId:'account-2',date:'2026-11-04'}});
 assert.equal(appRouteHash(route).includes('private'),false);
});
test('Employee and inline day links roundtrip; malformed URL values are ignored',()=>{
 const route={page:'overview',employee:'user-1',day:'report-2'};
 assert.deepEqual(parseAppRoute(appRouteHash(route)),route);
 assert.deepEqual(parseAppRoute('#/dien-bao-cao?date=invalid&account=%3Cscript%3E&report='),{page:'daily',report:null});
});

test('User and admin URLs preserve the section without granting permissions',()=>{
 for(const area of ['user','admin']){
  const route={page:'orders',area};assert.deepEqual(parseAppRoute(appRouteHash(route)),route);
 }
 assert.equal(appRouteHash({page:'daily',area:'user'}),'#/user/dien-bao-cao');
 assert.deepEqual(parseAppRoute('#/user/bao-cao?employee=user-1'),{page:'overview',area:'user',employee:'user-1',day:null});
});

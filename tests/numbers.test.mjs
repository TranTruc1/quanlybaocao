import test from 'node:test';import assert from 'node:assert/strict';import {parseNumberText,groupedNumberText} from '../src/numbers.js';
test('Vietnamese grouping is presentation only, preserving exact submitted digits',()=>{
 for(const [text,raw] of [['1.000.000','1000000'],['1000000','1000000'],['1.000.000 đ','1000000'],['000100','100'],['','']])assert.equal(parseNumberText(text),raw);
 assert.equal(groupedNumberText('1000000'),'1.000.000');assert.equal(parseNumberText('-100'),null);
});
test('USD fractions accept Vietnamese comma, preserve trailing decimals and cap precision',()=>{
 assert.equal(parseNumberText('1.000,50',2),'1000.50');assert.equal(parseNumberText('123.45',2),'123.45');assert.equal(parseNumberText('100,',2),'100.');assert.equal(parseNumberText('100,123',2),'100.12');assert.equal(groupedNumberText('1000.50'),'1.000,50');
});

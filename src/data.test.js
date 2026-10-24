import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCart,cartTotal,validCPF} from './data.js';

test('totals use integer cents, including multi-unit quantities',()=>{
 assert.equal(cartTotal([{product_id:'a',quantity:2},{product_id:'b',quantity:3}],[{id:'a',price_cents:31190},{id:'b',price_cents:1690}]),67450);
});
test('tampered local cart entries are dropped or bounded',()=>{
 assert.deepEqual(normalizeCart([{product_id:'a',quantity:1000},{product_id:'b',quantity:-3},{product_id:'c',quantity:1.5},null]),[{product_id:'a',quantity:99}]);
 assert.deepEqual(normalizeCart({product_id:'a',quantity:1}),[]);
});
test('CPF validation checks both verifier digits and repeated digits',()=>{
 assert.equal(validCPF('111.444.777-35'),true);
 for(const value of ['111.111.111-11','11144477734','123',''])assert.equal(validCPF(value),false);
});

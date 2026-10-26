import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProducts, packagingLabel, productImages, productUrl} from './catalog.js';
const products = [
 {id:'a',name:'Ração adulto',brand:'Petfix',category:'Rações',description:'Sabor salmão',price_cents:8000,stock:5},
 {id:'b',name:'Shampoo',brand:'Petfix',category:'Higiene',price_cents:4990,stock:0},
 {id:'c',name:'Oculto',category:'Rações',price_cents:1000,stock:3,active:false},
 {id:'d',name:'Em análise',category:'Rações',price_cents:1000,stock:3,approval_status:'pending'},
];
test('catalog combines accent-insensitive search, category, brand, price and availability',()=>{
 assert.deepEqual(selectProducts(products,{search:'racao',category:'Rações',brand:'Petfix',inStock:true,maxPrice:8000}).map(p=>p.id),['a']);
 assert.deepEqual(selectProducts(products,{search:'salmao'}).map(p=>p.id),['a']);
 assert.deepEqual(selectProducts(products,{maxPrice:5000,inStock:true}),[]);
});
test('catalog excludes unavailable listings, orders prices and respects favorites without mutating source',()=>{
 assert.deepEqual(selectProducts(products,{sort:'price-asc'}).map(p=>p.id),['b','a']);
 assert.deepEqual(selectProducts(products,{sort:'price-desc'}).map(p=>p.id),['a','b']);
 assert.deepEqual(selectProducts(products,{favorites:['b']}).map(p=>p.id),['b']);
 assert.deepEqual(selectProducts(products,{favorites:[]}),[]);
 assert.equal(products[0].id,'a');
});
test('product details retain packaging precision, deduplicate safe gallery images and encode links',()=>{
 assert.equal(packagingLabel({volume_ml:'400.00'}),'400 mL');
 assert.equal(packagingLabel({weight_kg:2.5}),'2,5 kg');
 assert.equal(packagingLabel({}), '');
 assert.deepEqual(productImages({image_url:'https://example.com/a.jpg',images:['https://example.com/a.jpg',{url:'https://example.com/b.jpg'},'javascript:alert(1)',null]}),['https://example.com/a.jpg','https://example.com/b.jpg']);
 assert.equal(productUrl('id&extra=1'),'/mundo_pet_produto/?id=id%26extra%3D1');
});

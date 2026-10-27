import test from 'node:test';
import assert from 'node:assert/strict';
import {cartNavigation} from './cart-navigation.js';
test('order history keeps an explicit checkout path for an unsubmitted cart',()=>{
 const {tabs,reminder}=cartNavigation(1,true);
 assert.match(reminder,/ainda não viraram um pedido/);
 assert.match(reminder,/<a[^>]+href="\/mundo_pet_carrinho_checkout_rastreio\/">Finalizar compra<\/a>/);
 assert.match(tabs,/Sacola \(1\)/);
 assert.match(tabs,/\?orders=1" aria-current="page"/);
});
test('empty history does not offer a payment for a nonexistent cart',()=>{
 assert.equal(cartNavigation(0,true).reminder,'');
 assert.equal(cartNavigation(0,false).reminder,'');
 assert.equal(cartNavigation(NaN,true).reminder,'');
});
test('checkout and history have distinct current-page links',()=>{
 const checkout=cartNavigation(3,false);
 assert.match(checkout.tabs,/href="\/mundo_pet_carrinho_checkout_rastreio\/" aria-current="page"/);
 assert.match(checkout.tabs,/Sacola \(3\)/);
 assert.equal(checkout.reminder,'');
});

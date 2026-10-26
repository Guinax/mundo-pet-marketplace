import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedPaymentUrl, paymentActions, cartAfterPayment, paymentIssueMessage } from './payments.js';

test('only official HTTPS InfinitePay checkout URLs can open', () => {
  for (const url of ['https://checkout.infinitepay.com.br/order', 'https://checkout.infinitepay.io/order', 'https://infinitepay.io/order']) assert.equal(approvedPaymentUrl(url), url);
  for (const url of ['http://infinitepay.io/order', 'https://infinitepay.io.attacker.test/', 'https://attacker.test/infinitepay.io', 'https://user:password@infinitepay.io/', 'https://infinitepay.io:444/', 'javascript:alert(1)', 'invalid']) assert.equal(approvedPaymentUrl(url), null);
});

test('a pending real order can resume without a new order; paid and canceled orders cannot', () => {
  const order = { status: 'pending', payment_status: 'unpaid', payment_method: 'infinitepay_pix', is_demo: false, payment_checkout_url: 'https://infinitepay.io/order' };
  assert.deepEqual(paymentActions(order), { pay: true, check: true, cancel: false });
  assert.equal(paymentActions({ ...order, payment_status: 'paid' }).pay, false);
  assert.equal(paymentActions({ ...order, payment_status: 'paid' }).cancel, false);
  assert.equal(paymentActions({ ...order, status: 'canceled' }).check, false);
  assert.equal(paymentActions({ ...order, is_demo: true }).pay, false);
  assert.equal(paymentActions({ ...order, payment_checkout_url: null }).cancel, true);
});

test('confirming an older payment preserves unrelated products and newly added quantities', () => {
  assert.deepEqual(cartAfterPayment([{ product_id: 'a', quantity: 3 }, { product_id: 'b', quantity: 2 }], [{ product_id: 'a', quantity: 1 }]), [{ product_id: 'a', quantity: 2 }, { product_id: 'b', quantity: 2 }]);
  assert.deepEqual(cartAfterPayment([{ product_id: 'a', quantity: 1 }], [{ product_id: 'a', quantity: 5 }]), []);
  assert.deepEqual(cartAfterPayment([{ product_id: 'b', quantity: 2 }], [{ product_id: 'a', quantity: 1 }]), [{ product_id: 'b', quantity: 2 }]);
});

test('only admin feedback contains infrastructure instructions', () => {
  assert.match(paymentIssueMessage('maps_credential_invalid', true), /SHA-256/);
  assert.doesNotMatch(paymentIssueMessage('maps_credential_invalid', false), /SHA-256|Supabase|GOOGLE_MAPS/);
  assert.match(paymentIssueMessage('payment_link_failed'), /Meus pedidos/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {adminSummary,adminDashboard,adminLayout} from './admin-design.js';
const now=new Date('2026-10-26T15:00:00Z');
const order=(id,extra={})=>({id,created_at:'2026-10-26T10:00:00Z',updated_at:'2026-10-26T12:00:00Z',subtotal_cents:10000,discount_cents:1000,total_cents:9500,status:'delivered',payment_status:'paid',...extra});
test('admin financial summary excludes demonstrations, unpaid and canceled orders',()=>{
 const s=adminSummary({now,orders:[order('real'),order('demo',{is_demo:true}),order('unpaid',{payment_status:'pending'}),order('canceled',{status:'canceled'}),order('prior',{created_at:'2026-09-15T00:00:00Z',updated_at:'2026-09-16T00:00:00Z'})],policy:{products_bps:1500}});
 assert.equal(s.gross,9500);
 assert.equal(s.commission,1350); // Net product base, excluding the delivery fee.
 assert.equal(s.active.length,0);
 assert.match(s.period,/2026/);
});
test('daily order totals use Sao Paulo date at midnight boundary',()=>{
 const s=adminSummary({now:new Date('2026-10-27T01:00:00Z'),orders:[order('same-day',{updated_at:'2026-10-27T01:00:00Z'}),order('yesterday',{updated_at:'2026-10-26T01:00:00Z'})]});
 assert.equal(s.completedToday,1);
 assert.equal(s.commission,null);
});
test('admin partner count deduplicates approved providers and excludes pending applications',()=>{
 const s=adminSummary({now,stores:[{owner_id:'a'}],services:[{provider_id:'a'},{provider_id:'b'}],applications:[{user_id:'c',status:'pending'},{user_id:'b',status:'approved',role:'vet'},{user_id:'d',status:'approved',role:'courier'}]});
 assert.equal(s.partners,3);assert.equal(s.pending.length,1);assert.equal(s.couriers.length,1);
});
test('live admin escapes records and keeps existing review actions and restricted finance',()=>{
 const applications=[{id:'a',name:'<script>unsafe</script>',role:'store',status:'pending'}];
 const html=adminDashboard({summary:adminSummary({now,applications}),applications});
 assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('data-action="review-application"'));
 assert.ok(html.includes('data-approved="false"'));
 assert.ok(html.includes('data-approved="true"'));
 assert.ok(html.includes('Saques Pix ainda não estão habilitados'));
 assert.ok(!html.includes('Sistema Operando 100%'));
 assert.ok(!html.includes('Ricardo Alencar'));
 assert.ok(!html.includes('84.920'));
 assert.ok(adminLayout('bloqueado').includes('Área restrita'));
 assert.ok(adminLayout('conteúdo',{authorized:true}).includes('Super Admin'));
});

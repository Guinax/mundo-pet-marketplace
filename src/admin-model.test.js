import test from 'node:test';import assert from 'node:assert/strict';
import {campaignLink,isPublishedCampaign,percentBps,moneyCents,filterOrders,financeTotals,buildNotifications,csvRows} from './admin-model.js';
import {adminConsoleView} from './admin-console-view.js';
const now=Date.parse('2026-10-26T15:00:00Z');
const base={applications:[],orders:[],appointments:[],products:[],services:[],campaigns:[],wallets:[],entries:[],settlements:[],payouts:[],reads:[],directory:[],audit:[],stores:[],policy:{products_bps:1000,services_bps:1000},now:new Date(now)};
test('campaign links reject executable, credential-bearing and protocol-relative URLs; scheduling respects both bounds',()=>{
 for(const bad of ['javascript:alert(1)','//evil.test','https://user:pw@example.org','data:text/html,x'])assert.throws(()=>campaignLink(bad));
 assert.equal(campaignLink('/mundo_pet_catalogo/?category=Rações'),'/mundo_pet_catalogo/?category=Rações');
 assert.equal(isPublishedCampaign({active:true,starts_at:'2026-10-26T14:00Z',ends_at:'2026-10-26T16:00Z'},now),true);
 assert.equal(isPublishedCampaign({active:true,starts_at:'2026-10-27T00:00Z'},now),false);
 assert.equal(isPublishedCampaign({active:true,ends_at:'2026-10-26T15:00Z'},now),false);
});
test('finance excludes immature funds and reserves requests without double subtracting paid partner entries',()=>{
 const data={entries:[{wallet_id:'w',amount_cents:9000,available_at:'2026-10-25'},{wallet_id:'w',amount_cents:-1000,available_at:'2026-10-25'},{wallet_id:'w',amount_cents:2000,available_at:'2026-10-27'}],settlements:[{commission_cents:1000,available_at:'2026-10-25'}],payouts:[{wallet_id:'w',amount_cents:1000,status:'paid'},{wallet_id:'w',amount_cents:2000,status:'requested'},{wallet_id:null,amount_cents:100,status:'paid'}]};
 assert.deepEqual(financeTotals(data,'w',now),{balance:10000,available:6000,reserved:2000,pending:2000});
 assert.equal(financeTotals(data,null,now).available,900);
});
test('amount and percentage validation rejects negative values, overprecision and invalid bounds',()=>{
 assert.equal(percentBps('10.25'),1025);assert.equal(moneyCents('15.99'),1599);
 for(const n of [-1,101,1.001,NaN])assert.throws(()=>percentBps(n));for(const n of [0,-1,1.001,Infinity])assert.throws(()=>moneyCents(n));
});
test('order filters use São Paulo dates and exclude demo and unrelated couriers',()=>{
 const orders=[{id:'a',status:'delivered',courier_id:'c',created_at:'2026-10-27T02:30:00Z'},{id:'b',status:'ready',created_at:'2026-10-26T14:00Z'},{id:'demo',is_demo:true,status:'delivered',created_at:'2026-10-26T14:00Z'}];
 assert.deepEqual(filterOrders(orders,{history:true,courier:'c',from:'2026-10-26',to:'2026-10-26'}).map(o=>o.id),['a']);
});
test('notifications retain reads by event key while a new order stage generates an unread event',()=>{
 const model={applications:[{id:'a',name:'Store',status:'pending'}],orders:[{id:'o',status:'ready'}],reads:[{notification_key:'application:a'},{notification_key:'order:o:preparing'}]};
 const n=buildNotifications(model);assert.equal(n.filter(x=>!x.read).length,1);assert.equal(n[0].key,'order:o:ready');
});
test('every live admin section renders with working action attributes and safe text, without disabled placeholder controls',()=>{
 const m={...base,campaigns:[{id:'b',title:'<script>bad</script>',description:'x',active:false}],applications:[{id:'a',name:'<img onerror=x>',role:'store',status:'pending'}]};
 for(const tab of ['', 'applications','orders','history','finance','settings','products','services','marketing','fleet','notifications','audit']){
  const html=adminConsoleView(m,tab);assert.ok(!html.includes('disabled'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img onerror'));
  for(const match of html.matchAll(/<button\b([^>]*)>/g))assert.ok(/data-action=|type="submit"/.test(match[1]),'dead button in '+tab);
 }
 assert.ok(adminConsoleView(m).includes('Cupons desativados'));
});
test('CSV export quotes formula-like user content and embedded separators',()=>{
 const csv=csvRows([['=HYPERLINK("bad")','a;b']]);assert.ok(csv.includes("'="));assert.ok(csv.includes('"a;b"'));
});

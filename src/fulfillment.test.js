import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {fulfillmentEligibility,orderFulfillmentLabel} from './fulfillment.js';
const product='11111111-1111-4111-8111-111111111111',store='22222222-2222-4222-8222-222222222222';
const items=[{product_id:product,quantity:1}],products=[{id:product,store_id:store}],stores=[{id:store,address:'Rua da loja, 123',is_open:false}];
test('pickup needs a deliberate choice, a real store and no buyer address',()=>{
 assert.match(fulfillmentEligibility(null,items,products,stores).error,/Escolha/);
 assert.equal(fulfillmentEligibility('pickup',items,products,stores).store.id,store);
 assert.match(fulfillmentEligibility('delivery',items,products,stores).error,/endereço/);
 assert.match(fulfillmentEligibility('pickup',items,[{...products[0],pickup_enabled:false}],stores).error,/modalidade/);
 assert.match(fulfillmentEligibility('pickup',items,products,[{...stores[0],is_demo:true}]).error,/reais/);
});
test('multiple stores require separate orders',()=>{
 assert.match(fulfillmentEligibility('pickup',[...items,{product_id:'other',quantity:1}],[...products,{id:'other',store_id:'other'}],stores).error,/uma loja/);
});
test('pickup statuses distinguish readiness and completion',()=>{
 assert.equal(orderFulfillmentLabel({status:'ready',fulfillment_method:'pickup'}),'Pronto para retirada');
 assert.equal(orderFulfillmentLabel({status:'delivered',fulfillment_method:'pickup'}),'Retirado na loja');
});
async function callCheckout(mode,{maps,allowed=true,address={}}={}){
 let handler,rpcArgs,routeCalls=0;
 const chain=table=>({select(){return this},eq(){return this},async in(){return {data:[{id:product,store_id:store,pickup_enabled:allowed}]}},async maybeSingle(){return {data:table==='mp_stores'?{id:store,name:'Loja teste',address:'Rua loja 123',is_open:false,is_demo:false}:{address}}}});
 const database={auth:{getUser:async()=>({data:{user:{id:'buyer'}}})},from:chain,rpc:async(name,args)=>{rpcArgs={name,args};return {data:'created-order'}}};
 const source=readFileSync(new URL('../supabase/functions/mp-secure-checkout/index.ts',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{Deno:{env:{get:name=>({SUPABASE_URL:'https://fixture.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',GOOGLE_MAPS_API_KEY:maps})[name]},serve:fn=>handler=fn},createClient:()=>database,console,Response,AbortSignal,URL,fetch:async url=>{if(String(url).includes('googleapis')){routeCalls++;return new Response(JSON.stringify({routes:[{distanceMeters:3000}]}))}return new Response(JSON.stringify({url:'https://checkout.infinitepay.com.br/test'}))}});
 const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify({cart:items,request_id:'33333333-3333-4333-8333-333333333333',payment_method:'infinitepay_pix',fulfillment_method:mode})}));
 return {response,body:await response.json(),rpcArgs,routeCalls};
}
test('server rejects missing or forged fulfillment selection',async()=>{
 for(const mode of [undefined,'free','PICKUP']){const r=await callCheckout(mode);assert.equal(r.response.status,400);assert.equal(r.body.error,'fulfillment_required');assert.equal(r.rpcArgs,undefined)}
});
test('closed-store pickup pays without Maps or delivery address and without shipping',async()=>{
 const r=await callCheckout('pickup');assert.equal(r.response.status,200);assert.equal(r.routeCalls,0);assert.equal(r.rpcArgs.args.p_shipping_cents,0);assert.equal(r.rpcArgs.args.p_fulfillment,'pickup');assert.equal(r.rpcArgs.args.p_address.street,'Rua loja 123');
});
test('pickup cannot override a product restriction',async()=>{
 const r=await callCheckout('pickup',{allowed:false});assert.equal(r.response.status,409);assert.equal(r.rpcArgs,undefined);
});
test('delivery still requires Maps, address, and a server-verified fee',async()=>{
 const missing=await callCheckout('delivery');assert.equal(missing.body.error,'maps_not_configured');
 const r=await callCheckout('delivery',{maps:'fixture-key',address:{street:'Rua cliente',number:'7',city:'Limeira',state:'SP'}});
 assert.equal(r.response.status,200);assert.equal(r.routeCalls,1);assert.equal(r.rpcArgs.args.p_shipping_cents,500);
});

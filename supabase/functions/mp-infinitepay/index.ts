import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const defaultKey=(kind:string)=>{try{const key=JSON.parse(Deno.env.get(kind)||"{}")?.default;return typeof key==="string"?key:"";}catch{return "";}};
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const handle="wgsolucoesfinaceira";
const approvedPaymentHost=(host:string)=>host==="checkout.infinitepay.com.br"||host==="infinitepay.io"||host.endsWith(".infinitepay.io");
const apiKey=Deno.env.get("INFINITEPAY_API_KEY");
const providerHeaders=()=>({"Content-Type":"application/json",...(apiKey?{"X-Api-Key":apiKey}:{})});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return out({error:"Método inválido"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=(Deno.env.get("SUPABASE_ANON_KEY")||defaultKey("SUPABASE_PUBLISHABLE_KEYS")),secret=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||defaultKey("SUPABASE_SECRET_KEYS"));
  if(!url||!anon||!secret)return out({error:"Servidor não configurado"},503);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!jwt)return out({error:"Autenticação necessária"},401);
  const client=createClient(url,anon,{auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser(jwt);
  if(authError||!user)return out({error:"Sessão inválida"},401);
  const body=await req.json();const id=body?.order_id;
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return out({error:"Pedido inválido"},400);
  const db=createClient(url,secret,{auth:{persistSession:false}});
  const {data:order,error}=await db.from("mp_orders").select("id,buyer_id,status,payment_status,payment_method,total_cents,subtotal_cents,delivery_cents,discount_cents,payment_checkout_url,payment_nsu,is_demo").eq("id",id).maybeSingle();
  if(error)return out({error:"Falha ao consultar pedido"},500);
  if(!order||order.buyer_id!==user.id)return out({error:"Pedido não encontrado"},404);
  if(order.is_demo||order.status==="canceled"||!["infinitepay_pix","infinitepay_card"].includes(order.payment_method))return out({error:"Pedido não elegível"},409);
  if(!Number.isSafeInteger(order.total_cents)||order.total_cents<1||order.total_cents!==order.subtotal_cents+order.delivery_cents-order.discount_cents)return out({error:"Valor inconsistente"},409);
  const order_nsu="mp-"+order.id;
  if(body.action==="check"){
   if(order.payment_status==="paid")return out({paid:true});
   const r=await fetch("https://api.checkout.infinitepay.io/payment_check",{method:"POST",headers:providerHeaders(),body:JSON.stringify({handle,order_nsu,...(typeof body.transaction_nsu==="string"&&body.transaction_nsu.length<200?{transaction_nsu:body.transaction_nsu}:(order.payment_nsu?{transaction_nsu:order.payment_nsu}:{})),...(typeof body.slug==="string"&&body.slug.length<200?{slug:body.slug}:{})}),signal:AbortSignal.timeout(12000)});
   if(!r.ok)return out({paid:false,provider_status:r.status},502);
   const p=await r.json();const paid=p.paid===true&&Number(p.amount)===order.total_cents;
   if(paid){const {error:up}=await db.from("mp_orders").update({payment_status:"paid",payment_provider:"infinitepay",payment_nsu:p.transaction_nsu||order.payment_nsu,payment_checked_at:new Date().toISOString(),payment_details:{paid:true,amount:p.amount,capture_method:p.capture_method,transaction_nsu:p.transaction_nsu}}).eq("id",id).eq("payment_status","unpaid");if(up)return out({error:"Falha ao registrar pagamento"},500);}
   return out({paid,payment_status:paid?"paid":"unpaid"});
  }
  if(body.action!=="create")return out({error:"Ação inválida"},400);
  if(order.payment_status==="paid")return out({error:"Pedido já pago"},409);
  if(order.payment_checkout_url){const old=new URL(order.payment_checkout_url);if(old.protocol==="https:"&&approvedPaymentHost(old.hostname))return out({url:order.payment_checkout_url,reused:true});}
  const {data:rows,error:itemsError}=await db.from("mp_order_items").select("name,quantity,unit_cents").eq("order_id",id);
  if(itemsError||!rows?.length)return out({error:"Pedido sem itens"},409);
  const items=rows.map(x=>({description:x.name,quantity:x.quantity,price:x.unit_cents}));
  if(items.some(x=>!x.description||!Number.isSafeInteger(x.quantity)||x.quantity<1||!Number.isSafeInteger(x.price)||x.price<1))return out({error:"Item inválido"},409);
  const sum=items.reduce((s,x)=>s+x.quantity*x.price,0);
  if(sum!==order.subtotal_cents)return out({error:"Subtotal inconsistente"},409);
  const adjustment=order.delivery_cents-order.discount_cents;
  if(adjustment>0)items.push({description:"Entrega e ajustes",quantity:1,price:adjustment});
  if(adjustment<0){return out({error:"Desconto exige configuração adicional para a cobrança segura"},409);}
  const redirect="https://mundo-pet-marketplace.vercel.app/mundo_pet_carrinho_checkout_rastreio/?orders=1";
  const payload={handle,order_nsu,redirect_url:redirect,items,single_payment:true,webhook_url:url+"/functions/v1/mp-infinitepay-webhook"};
  const response=await fetch("https://api.checkout.infinitepay.io/links",{method:"POST",headers:providerHeaders(),body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  const p=await response.json().catch(()=>({}));
  if(!response.ok)return out({error:"Provedor recusou checkout",status:response.status},502);
  const paymentUrl=p.url??p.data?.url;
  if(typeof paymentUrl!=="string")return out({error:"Provedor não retornou link"},502);
  const dest=new URL(paymentUrl);
  if(dest.protocol!=="https:"||!approvedPaymentHost(dest.hostname))return out({error:"URL do provedor inválida"},502);
  const {error:saveError}=await db.from("mp_orders").update({payment_checkout_url:paymentUrl,payment_provider:"infinitepay",payment_checked_at:new Date().toISOString()}).eq("id",id).eq("payment_status","unpaid");
  if(saveError)return out({error:"Cobrança criada mas não registrada; contate o suporte"},500);
  return out({url:paymentUrl});
 }catch(e){console.error("mp-infinitepay",e);return out({error:"Falha ao processar pagamento"},500);}
});

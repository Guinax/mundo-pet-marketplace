import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const defaultKey=(kind:string)=>{try{const key=JSON.parse(Deno.env.get(kind)||"{}")?.default;return typeof key==="string"?key:"";}catch{return "";}};
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return respond({error:"Método inválido"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),key=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||defaultKey("SUPABASE_SECRET_KEYS"));
  if(!url||!key)return respond({error:"Servidor indisponível"},503);
  const data=await req.json();const nsu=data?.order_nsu;
  if(typeof nsu!=="string"||!/^mp-[0-9a-f-]{36}$/i.test(nsu))return respond({error:"Pedido inválido"},400);
  const db=createClient(url,key,{auth:{persistSession:false}});
  const id=nsu.slice(3);
  const {data:order}=await db.from("mp_orders").select("id,total_cents,payment_status,payment_method,status,is_demo").eq("id",id).maybeSingle();
  if(!order)return respond({error:"Pedido não encontrado"},404);
  if(order.payment_status==="paid")return respond({success:true});
  const handle="wgsolucoesfinaceira";
  const apiKey=Deno.env.get("INFINITEPAY_API_KEY");
  const res=await fetch("https://api.checkout.infinitepay.io/payment_check",{method:"POST",headers:{"Content-Type":"application/json",...(apiKey?{"X-Api-Key":apiKey}:{})},body:JSON.stringify({handle,order_nsu:nsu,...(data.transaction_nsu?{transaction_nsu:data.transaction_nsu}:{}),...(data.invoice_slug||data.slug?{slug:data.invoice_slug||data.slug}:{})}),signal:AbortSignal.timeout(12000)});
  if(!res.ok)return respond({error:"Verificação indisponível"},502);
  const verified=await res.json();
  if(verified.paid!==true||Number(verified.amount)!==order.total_cents)return respond({error:"Pagamento não confirmado"},409);
  if(order.is_demo||order.status==="canceled"||!["infinitepay_pix","infinitepay_card"].includes(order.payment_method))return respond({error:"Pagamento exige reconciliação manual"},409);
  const {error}=await db.from("mp_orders").update({payment_status:"paid",payment_provider:"infinitepay",payment_nsu:verified.transaction_nsu||data.transaction_nsu||null,payment_checked_at:new Date().toISOString(),payment_details:{paid:true,amount:verified.amount,capture_method:verified.capture_method,transaction_nsu:verified.transaction_nsu}}).eq("id",id).eq("payment_status","unpaid");
  if(error)return respond({error:"Falha ao registrar"},500);
  return respond({success:true});
 }catch(e){console.error("mp-infinitepay-webhook",e);return respond({error:"Falha de processamento"},500);}
});

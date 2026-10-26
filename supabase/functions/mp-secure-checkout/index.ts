import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const defaultKey=(kind:string)=>{try{const key=JSON.parse(Deno.env.get(kind)||"{}")?.default;return typeof key==="string"?key:"";}catch{return "";}};
const h={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const send=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:h});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:h});
 if(req.method!=="POST")return send({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=(Deno.env.get("SUPABASE_ANON_KEY")||defaultKey("SUPABASE_PUBLISHABLE_KEYS")),service=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||defaultKey("SUPABASE_SECRET_KEYS")),maps=Deno.env.get("GOOGLE_MAPS_API_KEY");
 if(!url||!anon||!service){console.error("mp-secure-checkout missing Supabase configuration",{url:!!url,publicKey:!!anon,secretKey:!!service});return send({error:"server_not_configured"},503);}
 if(!maps){console.error("mp-secure-checkout GOOGLE_MAPS_API_KEY not available to runtime");return send({error:"maps_not_configured"},503);}
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+/i.test(bearer))return send({error:"authentication_required"},401);
 const token=bearer.replace(/^Bearer\s+/i,"");
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authErr}=await auth.auth.getUser(token);
 if(authErr||!user)return send({error:"invalid_session"},401);
 try{
 const body=await req.json();
 const items=body?.cart,request=body?.request_id,method=body?.payment_method;
 if(!Array.isArray(items)||items.length<1||items.length>30||typeof request!=="string"||!uuid.test(request)||!["infinitepay_pix","infinitepay_card"].includes(method))return send({error:"invalid_checkout"},400);
 if(items.some(x=>!x||typeof x.product_id!=="string"||!uuid.test(x.product_id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>99))return send({error:"invalid_cart"},400);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const {data:products,error:pErr}=await admin.from("mp_products").select("id,store_id").in("id",items.map(x=>x.product_id));
 if(pErr||!products||products.length!==new Set(items.map(x=>x.product_id)).size)return send({error:"product_unavailable"},409);
 const stores=[...new Set(products.map(x=>x.store_id))];
 if(stores.length!==1)return send({error:"multiple_stores"},409);
 const [{data:store},{data:profile}]=await Promise.all([
  admin.from("mp_stores").select("id,address,is_open,is_demo").eq("id",stores[0]).maybeSingle(),
  admin.from("mp_profiles").select("address").eq("user_id",user.id).maybeSingle()
 ]);
 if(!store||!store.is_open||store.is_demo||!store.address)return send({error:"store_unavailable"},409);
 const a=profile?.address||{};
 if(!a.street||!a.number||!a.city||!a.state)return send({error:"delivery_address_incomplete"},422);
 const destination=[a.street,a.number,a.district,a.city,a.state,"Brasil"].filter(Boolean).join(", ");
 const result=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{
  method:"POST",headers:{"content-type":"application/json","X-Goog-Api-Key":maps,"X-Goog-FieldMask":"routes.distanceMeters"},
  body:JSON.stringify({origin:{address:store.address},destination:{address:destination},travelMode:"DRIVE",routingPreference:"TRAFFIC_UNAWARE",languageCode:"pt-BR"}),
  signal:AbortSignal.timeout(12000)
 });
 if(!result.ok)return send({error:"shipping_provider_failed",provider_status:result.status},502);
 const route=await result.json(),meters=route?.routes?.[0]?.distanceMeters;
 if(!Number.isSafeInteger(meters)||meters<0)return send({error:"route_not_found"},422);
 const shipping=meters<=1500?500:meters<=3000?750:750+Math.ceil((meters-3000)*150/1000);
 const {data:orderId,error:orderErr}=await admin.rpc("mp_create_verified_payment_order",{
  p_buyer:user.id,p_cart:items,p_address:a,p_request:request,p_shipping_cents:shipping,p_method:method
 });
 if(orderErr){console.error("create verified order",orderErr.message);return send({error:"order_creation_failed"},409);}
 const paid=await fetch(url+"/functions/v1/mp-infinitepay",{
  method:"POST",headers:{"content-type":"application/json",apikey:anon,authorization:bearer},
  body:JSON.stringify({order_id:orderId,action:"create"}),signal:AbortSignal.timeout(17000)
 });
 const p=await paid.json().catch(()=>({}));
 if(!paid.ok||typeof p.url!=="string"){console.error("Payment link error",paid.status,String(p?.error||"unknown"));return send({error:"payment_link_failed",detail:typeof p?.error==="string"?p.error.slice(0,100):undefined,provider_status:paid.status},502);}
 const u=new URL(p.url);if(u.protocol!=="https:"||!(u.hostname==="checkout.infinitepay.com.br"||u.hostname==="infinitepay.io"||u.hostname.endsWith(".infinitepay.io")))return send({error:"payment_url_invalid"},502);
 return send({order_id:orderId,url:p.url,delivery_cents:shipping,distance_m:meters});
 }catch(err){console.error("mp-secure-checkout",err);return send({error:"checkout_failed"},500);}
});

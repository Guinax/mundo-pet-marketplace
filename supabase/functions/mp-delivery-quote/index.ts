import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const defaultKey=(kind:string)=>{try{const key=JSON.parse(Deno.env.get(kind)||"{}")?.default;return typeof key==="string"?key:"";}catch{return "";}};
const h={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:h});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:h});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=(Deno.env.get("SUPABASE_ANON_KEY")||defaultKey("SUPABASE_PUBLISHABLE_KEYS")),service=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||defaultKey("SUPABASE_SECRET_KEYS")),maps=Deno.env.get("GOOGLE_MAPS_API_KEY");
 if(!url||!anon||!service){console.error("mp-delivery-quote missing Supabase configuration",{url:!!url,publicKey:!!anon,secretKey:!!service});return reply({error:"server_not_configured"},503);}
 const authorization=req.headers.get("authorization")||"";
 const jwt=authorization.startsWith("Bearer ")?authorization.slice(7).trim():null;
 if(!jwt)return reply({error:"authentication_required"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(jwt);
 if(authError||!user)return reply({error:"invalid_session"},401);
 if(!maps){console.error("mp-delivery-quote GOOGLE_MAPS_API_KEY not available to runtime");return reply({available:false,error:"maps_not_configured"},503);}
 const input=await req.json().catch(()=>null);
 const storeId=input?.store_id;
 if(typeof storeId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId))return reply({error:"invalid_store"},400);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const [{data:store,error:storeError},{data:profile,error:profileError}]=await Promise.all([
  admin.from("mp_stores").select("id,address,is_open,is_demo").eq("id",storeId).maybeSingle(),
  admin.from("mp_profiles").select("address").eq("user_id",user.id).maybeSingle()
 ]);
 if(storeError||profileError)return reply({error:"lookup_failed"},500);
 if(!store||store.is_demo||!store.is_open||!store.address?.trim())return reply({available:false,error:"store_unavailable"},409);
 const a=profile?.address||{};
 if(!a.street||!a.number||!a.city||!a.state)return reply({error:"delivery_address_incomplete"},422);
 const destination=[a.street,a.number,a.district,a.city,a.state,"Brasil"].filter(Boolean).join(", ");
 try{
  const resp=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{
   method:"POST",signal:AbortSignal.timeout(12000),
   headers:{"Content-Type":"application/json","X-Goog-Api-Key":maps,"X-Goog-FieldMask":"routes.distanceMeters,routes.duration"},
   body:JSON.stringify({origin:{address:store.address},destination:{address:destination},travelMode:"DRIVE",routingPreference:"TRAFFIC_UNAWARE",languageCode:"pt-BR"})
  });
  if(!resp.ok)return reply({available:false,error:"route_provider_failed",provider_status:resp.status},502);
  const raw=await resp.json();
  const meters=Number(raw?.routes?.[0]?.distanceMeters);
  if(!Number.isSafeInteger(meters)||meters<0)return reply({available:false,error:"route_unavailable"},422);
  const cents=meters<=1500?500:meters<=3000?750:750+Math.ceil((meters-3000)*150/1000);
  return reply({available:true,source:"google_routes",distance_m:meters,delivery_cents:cents,delivery_brl:cents/100,duration_seconds:parseInt(raw.routes[0].duration)||null});
 }catch{ return reply({available:false,error:"route_service_unreachable"},502); }
});

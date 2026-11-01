/* Mundo Pet PWA: cache only static shell and assets, never checkout or API responses. */
const CACHE_NAME = "mundo-pet-pwa-v8";
const SHELL = ["/", "/stitch-home.html", "/mp-app.css", "/icons/mundo-pet-192.png", "/icons/mundo-pet-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("mundo-pet-pwa-") && k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/auth/") || url.pathname.startsWith("/functions/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(request, { ignoreSearch: true }) || await cache.match("/");
    }));
    return;
  }
  const staticAsset = url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/media/brand/") || url.pathname.startsWith("/icons/") ||
    url.pathname === "/mp-app.css";
  if (staticAsset) {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
  }
});


/* Push events are processed by Android/Chrome even when no Mundo Pet tab is open. */
self.addEventListener("push",event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  await self.registration.showNotification(data.title||"Mundo Pet • nova venda",{
   body:String(data.body||"Um pagamento foi confirmado.").slice(0,200),
   icon:"/icons/mundo-pet-192.png",badge:"/icons/mundo-pet-192.png",
   silent:false,vibrate:[250,120,250,120,400],requireInteraction:true,
   tag:"mp-paid-order-"+String(data.orderId||"new").slice(0,40),renotify:true,
   data:{url:typeof data.url==="string"&&data.url.startsWith("/")?data.url:"/mundo_pet_painel_administrativo_geral/?tab=orders"}
  });
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL(event.notification.data?.url||"/",self.location.origin);
  if(url.origin!==self.location.origin)return;
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const existing=windows.find(client=>new URL(client.url).origin===url.origin);
  if(existing){await existing.focus();if("navigate" in existing)await existing.navigate(url.href);return;}
  await self.clients.openWindow(url.href);
 })());
});

// Worker do Mundo Pet: mostra alertas mesmo com a janela fechada quando o push chega.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = {body: event.data?.text() || ''}; }
  const title = typeof payload.title === 'string' ? payload.title.slice(0,100) : 'Mundo Pet';
  const safeUrl = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//')
    ? payload.url : '/mundo_pet_painel_administrativo_geral/';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof payload.body === 'string' ? payload.body.slice(0,250) : 'Nova atualização',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.orderId ? 'mp-sale-' + String(payload.orderId) : 'mp-message',
    renotify: true,
    data: {url:safeUrl},
    vibrate: [180,100,180]
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows => {
    const target = new URL(path, self.location.origin).href;
    const existing = windows.find(c => c.url.startsWith(self.location.origin));
    if(existing){await existing.focus(); if('navigate' in existing) await existing.navigate(target); return;}
    return clients.openWindow(target);
  }));
});
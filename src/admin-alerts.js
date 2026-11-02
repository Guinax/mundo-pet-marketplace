import { db } from './data.js';
const key = userId => 'mundopet.admin.saleAlerts.' + userId;
export function adminAlertsEnabled(userId) {
 try { return !!userId && localStorage.getItem(key(userId)) === 'on'; } catch { return false; }
}
export function adminAlertsPermission() {
 return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}
function decodeKey(base64) {
 const base = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(base), c => c.charCodeAt(0));
}
async function callPush(payload) {
 const {data,error} = await db.functions.invoke('mp-sale-push',{body:payload});
 if(error)throw error;
 if(data?.error)throw new Error(data.error);
 return data;
}
export async function enableAdminAlerts(userId) {
 if(!userId)throw new Error('Entre na conta administrativa.');
 if(!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification==='undefined')
  throw new Error('Este navegador não suporta notificações push. Instale o app ou utilize o Chrome atualizado.');
 const permission = Notification.permission==='default' ? await Notification.requestPermission() : Notification.permission;
 if(permission!=='granted')throw new Error('Autorize as notificações nas configurações do Android.');
 const {publicKey}=await callPush({action:'key'});
 if(!publicKey)throw new Error('Servidor de notificações não configurado.');
 const registration=await navigator.serviceWorker.register('/mp-push-sw.js',{scope:'/'});
 await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)});
 try {
  await callPush({action:'subscribe',subscription:subscription.toJSON()});
 }catch(error) {
  await subscription.unsubscribe().catch(()=>{});
  throw error;
 }
 localStorage.setItem(key(userId),'on');
}
export async function disableAdminAlerts(userId) {
 if(!userId)return;
 const registration=await navigator.serviceWorker?.getRegistration('/');
 const subscription=await registration?.pushManager?.getSubscription();
 if(subscription) {
  await callPush({action:'unsubscribe',endpoint:subscription.endpoint});
  await subscription.unsubscribe();
 }
 localStorage.removeItem(key(userId));
}

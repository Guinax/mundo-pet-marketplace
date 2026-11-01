/* Web Push: only paid real orders trigger remote notifications. Permission is opt-in. */
import { db } from "./data.js";
const FUNCTION="mp-sale-push";
const supported=()=>window.isSecureContext&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
function decodeKey(base64url){
 const padded=base64url+"=".repeat((4-base64url.length%4)%4);
 return Uint8Array.from(atob(padded.replace(/-/g,"+").replace(/_/g,"/")),char=>char.charCodeAt(0));
}
async function invoke(body){
 const {data,error}=await db.functions.invoke(FUNCTION,{body});
 if(error)throw new Error("Não foi possível conectar os avisos. Tente novamente.");
 if(data?.error)throw new Error("Falha na configuração: "+data.error);
 return data;
}
async function registration(){
 if(!supported())throw new Error("Este navegador não suporta notificações em segundo plano.");
 await navigator.serviceWorker.register("/sw.js",{scope:"/"});
 return navigator.serviceWorker.ready;
}
export async function enableSalePush(){
 if(!supported())throw new Error("Use o Chrome no Android para ativar avisos do Mundo Pet.");
 const permission=await Notification.requestPermission();
 if(permission!=="granted")throw new Error("Autorize as notificações do Mundo Pet nas configurações do Android.");
 const reg=await registration();
 const {publicKey}=await invoke({action:"key"});
 if(!publicKey)throw new Error("Chave de notificações indisponível.");
 let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)});
 await invoke({action:"subscribe",subscription:sub.toJSON()});
 return true;
}
export async function syncExistingSalePush(){
 if(!supported()||Notification.permission!=="granted")return false;
 const reg=await navigator.serviceWorker.getRegistration("/");
 const sub=await reg?.pushManager.getSubscription();
 if(!sub)return false;
 await invoke({action:"subscribe",subscription:sub.toJSON()});
 return true;
}
export async function disableSalePush(){
 if(!supported())return false;
 const reg=await navigator.serviceWorker.getRegistration("/");
 const sub=await reg?.pushManager.getSubscription();
 if(!sub)return false;
 await invoke({action:"unsubscribe",endpoint:sub.endpoint});
 await sub.unsubscribe();
 return true;
}
export async function testSalePush(){
 if(!supported()||Notification.permission!=="granted")throw new Error("Ative primeiro os avisos de venda.");
 const reg=await registration();
 await reg.showNotification("🔔 Mundo Pet • teste de aviso",{
   body:"Os avisos podem aparecer mesmo com o app fechado. O som depende do volume do Android.",
   icon:"/icons/mundo-pet-192.png",badge:"/icons/mundo-pet-192.png",
   silent:false,vibrate:[200,100,200],tag:"mp-test",renotify:true,
   data:{url:"/mundo_pet_painel_administrativo_geral/?tab=orders"}
 });
}

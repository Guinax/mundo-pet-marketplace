export const APP_URL = 'https://mundo-pet-marketplace.vercel.app/';
export const LOGO_URL = '/media/brand/mundo-pet-logo.png';
export const APP_SHARE = Object.freeze({title:'Mundo Pet',text:'Conheça o Mundo Pet! Produtos, serviços e cuidados para o seu melhor amigo, em um só lugar.',url:APP_URL});
export const brandImage = (className='mp-brand-logo') => `<img class="${className}" src="${LOGO_URL}" alt="Mundo Pet" width="2172" height="724" decoding="async">`;
export function shareTargets(){
 const text=encodeURIComponent(APP_SHARE.text+'\n'+APP_URL),url=encodeURIComponent(APP_URL);
 return {whatsapp:'https://wa.me/?text='+text,facebook:'https://www.facebook.com/sharer/sharer.php?u='+url,x:'https://twitter.com/intent/tweet?text='+encodeURIComponent(APP_SHARE.text)+'&url='+url};
}
export async function nativeAppShare(nav=globalThis.navigator,secure=globalThis.isSecureContext){
 if(secure===false||typeof nav?.share!=='function')return 'fallback';
 try{
  const payload={...APP_SHARE};
  if(typeof nav.canShare==='function'&&!nav.canShare(payload))return 'fallback';
  await nav.share(payload);return 'shared';
 }catch(error){return error?.name==='AbortError'?'canceled':'fallback';}
}
export async function copyAppLink(nav=globalThis.navigator){
 try{if(typeof nav?.clipboard?.writeText!=='function')return false;await nav.clipboard.writeText(APP_URL);return true;}catch{return false;}
}

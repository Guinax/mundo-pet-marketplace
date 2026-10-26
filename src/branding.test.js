import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_URL,APP_SHARE,shareTargets,nativeAppShare,copyAppLink} from './branding.js';
test('all social targets share the public app URL without account, admin or recovery information',()=>{
 const targets=shareTargets();
 assert.equal(APP_URL,'https://mundo-pet-marketplace.vercel.app/');
 assert.equal(new URL(targets.facebook).searchParams.get('u'),APP_URL);
 assert.equal(new URL(targets.x).searchParams.get('url'),APP_URL);
 assert.equal(new URL(targets.whatsapp).searchParams.get('text'),APP_SHARE.text+'\n'+APP_URL);
 for(const target of Object.values(targets))assert.doesNotMatch(decodeURIComponent(target),/access_token|recovery=|administrativo/);
});
test('native sharing receives the public brand payload and handles unsupported devices',async()=>{
 let calls=0;
 assert.equal(await nativeAppShare({canShare:p=>p.url===APP_URL,share:async payload=>{calls++;assert.deepEqual(payload,APP_SHARE);}},true),'shared');
 assert.equal(calls,1);
 assert.equal(await nativeAppShare({},true),'fallback');
 assert.equal(await nativeAppShare({canShare:()=>false,share:()=>{throw Error('Must not call');}},true),'fallback');
 assert.equal(await nativeAppShare({share:()=>{throw Error('Must not call');}},false),'fallback');
});
test('canceling the native share sheet is quiet, while denied sharing offers the fallback',async()=>{
 assert.equal(await nativeAppShare({share:async()=>{throw {name:'AbortError'};}},true),'canceled');
 assert.equal(await nativeAppShare({share:async()=>{throw {name:'NotAllowedError'};}},true),'fallback');
});
test('copying uses only the public app link and supports a manual copy fallback',async()=>{
 let copied='';
 assert.equal(await copyAppLink({clipboard:{writeText:async value=>{copied=value;}}}),true);
 assert.equal(copied,APP_URL);
 assert.equal(await copyAppLink({}),false);
 assert.equal(await copyAppLink({clipboard:{writeText:async()=>{throw Error('Denied');}}}),false);
});

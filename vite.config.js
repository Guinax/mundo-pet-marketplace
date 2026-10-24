import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
 server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
 plugins:[{
  name:'mundopet-runtime-dev',
  configureServer(server){server.middlewares.use((req,res,next)=>{
   const [path,query]=req.url?.split('?')||[];
   if(path==='/assets/runtime.js')req.url='/src/runtime.js';
   else if(path?.startsWith('/mundo_pet_')&&!path.split('/').at(-1)?.includes('.'))req.url=path.replace(/\/$/,'')+'/index.html'+(query?'?'+query:'');
   next();
  });},
 }],
 build:{rollupOptions:{input:{main:resolve('index.html'),runtime:resolve('src/runtime.js')},output:{entryFileNames:'assets/[name].js',chunkFileNames:'assets/[name]-[hash].js'}}},
});

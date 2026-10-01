import {defineConfig} from 'vite';
import {transformAsync} from '@babel/core';
export default defineConfig({
 base:'./', esbuild:false, resolve:{preserveSymlinks:true},
 plugins:[{name:'portable-jsx', async transform(code,id){
  if(!id.endsWith('.jsx'))return;
  return await transformAsync(code,{filename:id,plugins:['@babel/plugin-transform-react-jsx'],sourceMaps:true});
 }}],
 build:{minify:false,chunkSizeWarningLimit:900,rollupOptions:{output:{manualChunks:{three:['three'],motion:['gsap']}}}}
});


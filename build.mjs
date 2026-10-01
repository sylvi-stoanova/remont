import {rollup} from 'rollup';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import {transformAsync} from '@babel/core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const siteRoot=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve('dist');
if(path.dirname(output)!==path.resolve(siteRoot))throw new Error('Run build from the site directory.');
// Only the verified generated output directory is removed; source and assets stay intact.
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(path.join(output,'assets'),{recursive:true});
const bundle=await rollup({input:'src/main.jsx',plugins:[{name:'jsx-and-css',async transform(code,id){if(id.endsWith('.css'))return 'export default {};';if(id.endsWith('.jsx'))return transformAsync(code,{filename:id,plugins:['@babel/plugin-transform-react-jsx'],sourceMaps:true});},async renderChunk(code){return transformAsync(code,{babelrc:false,configFile:false,compact:true,minified:true,comments:false});}},replace({preventAssignment:true,'process.env.NODE_ENV':JSON.stringify('production')}),nodeResolve({browser:true,extensions:['.js','.jsx']}),commonjs()]});
await bundle.write({dir:'dist/assets',format:'es',entryFileNames:'app.js',chunkFileNames:'[name]-[hash].js'});await bundle.close();
await fs.copyFile('src/style.css','dist/style.css');await fs.copyFile('public/favicon.svg','dist/favicon.svg');await fs.mkdir('dist/images',{recursive:true});
for(const name of await fs.readdir('public/images'))if(name.endsWith('-v3.jpg'))await fs.copyFile('public/images/'+name,'dist/images/'+name);
const html=(await fs.readFile('index.html','utf8')).replace('<script type="module" src="/src/main.jsx"></script>','<script type="module" src="./assets/app.js"></script>').replace('</head>','<link rel="stylesheet" href="./style.css"/></head>');await fs.writeFile('dist/index.html',html);console.log('Static production build complete.');


import { build } from 'vite';
await build({base:'./',build:{outDir:'dist'}});
for (const name of ['background','content','siteBridge']) {
  await build({publicDir:false,build:{outDir:'dist',emptyOutDir:false,lib:{entry:`src/${name}.ts`,formats:[name === 'background' ? 'es':'iife'],name:'TrelloFocus',fileName:()=>`${name}.js`},rollupOptions:{output:{inlineDynamicImports:true}}}});
}

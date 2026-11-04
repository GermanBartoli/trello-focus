import { build } from 'vite';
await build({base:'./',build:{outDir:'dist'}});
for (const name of ['background','content']) {
  await build({publicDir:false,build:{outDir:'dist',emptyOutDir:false,lib:{entry:`src/${name}.ts`,formats:[name === 'content' ? 'iife':'es'],name:'TrelloFocus',fileName:()=>`${name}.js`},rollupOptions:{output:{inlineDynamicImports:true}}}});
}

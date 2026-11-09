import {build} from 'vite';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await build({base:'/',publicDir:false,build:{outDir:'dist-web'}});
await copyFile('public/icon.png','dist-web/icon.png');
await copyFile('public/german-bartoli.webp','dist-web/german-bartoli.webp');
await writeFile('dist-web/_headers',"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https://api.trello.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'\n");

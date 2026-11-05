import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
test('Web independiente: credenciales aisladas, persistencia y cargas serializadas sin Chrome',async()=>{
 const memory=new Map<string,string>(),events=new EventTarget();let lock=Promise.resolve();const timers:Function[]=[];
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_name:string,fn:()=>unknown)=>{const pending=lock.then(fn);lock=pending.catch(()=>{});return pending;}}}});
 Object.assign(globalThis,{window:events,location:{href:'https://prueba.example/'}});
 const originalInterval=globalThis.setInterval;
 (globalThis as any).setInterval=(fn:Function)=>{timers.push(fn);return 1;};
 const member='a'.repeat(24),cardId='b'.repeat(24);let remote:any;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url:any,options:any)=>{
  assert.ok(options.headers.Authorization.startsWith('OAuth '));
  assert.ok(String(url).startsWith('https://api.trello.com/1/'));
  if(String(url).includes('members/me?'))return Response.json({id:member,fullName:'Cuenta simulada'});
  if(String(url).includes('filter=commentCard'))return Response.json(remote?[remote]:[]);
  if(String(url).includes('/actions/comments')){remote={id:'comentario',idMemberCreator:member,data:{text:JSON.parse(options.body).text}};return Response.json(remote);}
  if(options.method==='PUT'){remote.data.text=JSON.parse(options.body).text;return Response.json(remote);}
  if(String(url).includes('/actions/'))return Response.json(remote);
  if(String(url).includes('/cards/'))return Response.json({id:cardId,name:'Prueba',url:'https://trello.com/c/AbCd1234',idMembers:[member]});
  throw Error('Petición no simulada');
 };
 try{
  const result:any=await build({configFile:false,publicDir:false,logLevel:'silent',build:{write:false,lib:{entry:'src/webRuntime.ts',formats:['es'],fileName:'web-test'},rollupOptions:{output:{inlineDynamicImports:true}}}});
  const url='data:text/javascript;base64,'+Buffer.from(result[0].output[0].code).toString('base64');
  const runtime=await import(url);
  assert.equal((globalThis as any).chrome,undefined);
  await runtime.webRequest('SETTINGS',{minutes:35,manualMinutes:45,notifications:false});
  await runtime.webRequest('CONNECT',{credentials:{key:'a'.repeat(32),token:'solo-prueba'}});
  await Promise.all([runtime.webRequest('ADD',{cardId,seconds:600,id:'uno'}),runtime.webRequest('ADD',{cardId,seconds:1800,id:'dos'})]);
  const state=await runtime.webRequest('STATE');
  assert.equal(state.entries.length,2);assert.equal(state.minutes,35);assert.equal(state.manualMinutes,45);
  assert.match(remote.data.text,/40 min/);assert.equal(state.credentialsStored,true);assert.equal(state.credentials,undefined);
  assert.ok([...memory.keys()].every(key=>key.startsWith('trello-focus-web:')));
  const reloaded=await import(url+'#recarga');
  assert.equal((await reloaded.webRequest('STATE')).entries.length,2);
  await reloaded.webRequest('START',{cardId});
  const stored=JSON.parse(memory.get('trello-focus-web:state')!);stored.session.end=Date.now()-120000;memory.set('trello-focus-web:state',JSON.stringify(stored));
  await timers[0]();await lock;
  assert.equal((await reloaded.webRequest('STATE')).session.review,true);
  await reloaded.webRequest('CANCEL');await reloaded.webRequest('DISCONNECT');
  assert.equal(memory.has('trello-focus-web:credentials'),false);assert.equal((await reloaded.webRequest('STATE')).entries.length,2);
 }finally{globalThis.setInterval=originalInterval;globalThis.fetch=originalFetch;}
});

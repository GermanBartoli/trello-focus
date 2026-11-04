import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from '../src/model.ts';
test('Flujo real del worker compilado: comentario único, reintentos, sesión y permisos',async()=>{
 const db:any={};let listener:any;const alarmListeners:any[]=[];let requests:any[]=[];let comments:any[]=[];let failPut=false;let failPost=false;
 const member='a'.repeat(24),cardId='b'.repeat(24),card={id:cardId,name:'Tarjeta de prueba',url:'https://trello.com/c/AbCd1234/prueba',idMembers:[member]};
 (globalThis as any).chrome={storage:{local:{get:async(key:string)=>structuredClone({[key]:db[key]}),set:async(data:object)=>Object.assign(db,structuredClone(data)),remove:async(key:string)=>{delete db[key];},setAccessLevel:async()=>{}}},runtime:{id:'extension',getURL:(p:string)=>`chrome-extension://extension/${p}`,onMessage:{addListener:(fn:any)=>listener=fn},onStartup:{addListener:()=>{}}},alarms:{clear:async()=>{},create:async()=>{},onAlarm:{addListener:(fn:any)=>alarmListeners.push(fn)}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},notifications:{create:()=>{}},tabs:{create:async()=>{}}};
 (globalThis as any).fetch=async(url:string,options:any)=>{
  const path=url.split('/1/')[1];requests.push({path,method:options.method});const payload=options.body?JSON.parse(options.body):null;
  if(path.startsWith('members/me/boards?')){assert.match(path,/filter=all/);return Response.json([{id:'d'.repeat(24),name:'Tablero',closed:false}]);}
  if(path.startsWith('members/me/cards?')){assert.match(path,/filter=all/);assert.match(path,/closed/);return Response.json([card,{...card,id:'archivada',idBoard:'d'.repeat(24),closed:true}]);}
  if(path.includes('/lists?')){assert.match(path,/filter=all/);return Response.json([{id:'lista',name:'Lista archivada',closed:true}]);}
  if(path.startsWith('boards/')&&path.includes('/cards?')){assert.match(path,/filter=all/);assert.match(path,/closed/);return Response.json([{...card,id:'archivada',idBoard:'d'.repeat(24),closed:true}]);}
  if(path.startsWith('members/me?'))return Response.json({id:member,fullName:'Persona de prueba'});
  if(path.startsWith(`cards/${cardId}?`)||path.startsWith('cards/AbCd1234?'))return Response.json(card);
  if(path.includes('filter=commentCard'))return Response.json(comments);
  if(path.startsWith('actions/'))return Response.json(comments.find(c=>c.id===path.split('/')[1]));
  if(options.method==='POST'){const c={id:'comentario',idMemberCreator:member,data:{text:payload.text}};comments.push(c);if(failPost)throw Error('Respuesta perdida');return Response.json(c);}
  if(options.method==='PUT'){if(failPut)throw Error('Sin conexión');comments[0].data.text=payload.text;return Response.json(comments[0]);}
  throw Error(`Petición no simulada: ${path}`);
 };
 await import('../dist/background.js' as string);
 const send=(type:string,data:object={},url='chrome-extension://extension/index.html'):Promise<any>=>new Promise(resolve=>listener({type,...data},{id:'extension',url},resolve));
 await send('STATE');
 assert.match((await send('CONNECT',{credentials:{key:'x',token:'pomello'}})).error,/válidos/);
 assert.ok(!(await send('CONNECT',{credentials:{key:'a'.repeat(32),token:'token-prueba'}})).error);
 await send('ADD',{cardId,seconds:600,id:'uno'});await send('ADD',{cardId,seconds:900,id:'dos'});await send('ADD',{cardId,seconds:900,id:'dos'});
 assert.equal(comments.length,1);assert.match(comments[0].data.text,/25 min/);assert.equal(db.state.entries.length,2);
 failPut=true;await send('ADD',{cardId,seconds:60,id:'tres'});assert.equal(db.state.entries.length,3);assert.ok(db.state.ledgers[cardId].error);
 failPut=false;await send('SYNC');assert.match(comments[0].data.text,/26 min/);assert.equal(db.state.ledgers[cardId].error,undefined);
 comments[0].data.text='Cambio manual';const puts=requests.filter(r=>r.method==='PUT').length;await send('ADD',{cardId,seconds:60,id:'cuatro'});assert.equal(requests.filter(r=>r.method==='PUT').length,puts);assert.match(db.state.ledgers[cardId].error,/cambió/);
 await send('START',{cardId});assert.match((await send('START',{cardId})).error,/activa/);await send('PAUSE');assert.equal(db.state.session.end,null);await send('RESUME');assert.ok(db.state.session.end);await send('CANCEL');assert.equal(db.state.session,undefined);
 await send('START',{cardId});db.state.session.end=Date.now()-120000;await send('STATE');assert.equal(db.state.session.review,true);await send('CANCEL');
 await send('START',{cardId});db.state.session.end=Date.now()-100;const count=db.state.entries.length;await send('STATE');await send('STATE');assert.equal(db.state.entries.length,count+1);assert.equal(db.state.session,undefined);
 assert.match((await send('CONNECT',{},'https://trello.com/c/AbCd1234/test')).error,/permitida/);
 assert.match((await send('ADD',{cardId:'otra',seconds:60,id:'no'},'https://trello.com/c/AbCd1234/test')).error,/Abrí/);
 db.state={...initial(),connected:true,member:{id:member,name:'Persona'}};comments=[];failPost=true;
 await send('ADD',{cardId,seconds:60,id:'incierta'});assert.equal(comments.length,1);failPost=false;await send('SYNC');assert.equal(comments.length,1);assert.equal(db.state.ledgers[cardId].commentId,'comentario');
 const previousEntries=structuredClone(db.state.entries);
 await send('REFRESH');assert.equal(db.state.cards.length,2);assert.equal(db.state.cards[1].closed,true);assert.equal(db.state.lists[0].closed,true);
 await send('BOARD',{id:'d'.repeat(24)});assert.equal(db.state.cards.find((c:any)=>c.id==='archivada').closed,true);
 await send('FILTER',{status:'archived'});assert.equal((await send('STATE')).data.cardStatus,'archived');
 await send('REFRESH');assert.equal(db.state.cardStatus,'archived');assert.deepEqual(db.state.entries,previousEntries);
 assert.match((await send('FILTER',{status:'invalid'})).error,/inválido/);assert.equal(db.state.cardStatus,'archived');
 await send('FILTER',{status:'all'});assert.equal((await send('STATE')).data.cardStatus,'all');
 for(const order of ['time-desc','time-asc','recent','oldest','default']){await send('SORT',{order});assert.equal((await send('STATE')).data.cardSort,order);}
 await send('SORT',{order:'recent'});await send('REFRESH');assert.equal(db.state.cardSort,'recent');assert.deepEqual(db.state.entries,previousEntries);
 assert.match((await send('SORT',{order:'invalid'})).error,/inválido/);assert.equal(db.state.cardSort,'recent');
 await send('DISCONNECT');assert.equal(db.credentials,undefined);assert.equal(db.state.connected,false);
});

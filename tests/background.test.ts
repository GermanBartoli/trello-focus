import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from '../src/model.ts';
test('Flujo real del worker compilado: comentario único, reintentos, sesión y permisos',async()=>{
 const opened:string[]=[];let tabUrl='https://trello.com/';const db:any={};let listener:any;const alarmListeners:any[]=[];let requests:any[]=[];let comments:any[]=[];let failPut=false;let failPost=false;let rejectPost=false;
 const member='a'.repeat(24),cardId='b'.repeat(24),card={id:cardId,name:'Tarjeta de prueba',url:'https://trello.com/c/AbCd1234/prueba',idMembers:[member]};
 (globalThis as any).chrome={storage:{local:{get:async(key:string)=>structuredClone({[key]:db[key]}),set:async(data:object)=>Object.assign(db,structuredClone(data)),remove:async(key:string)=>{delete db[key];},setAccessLevel:async()=>{}}},runtime:{id:'extension',getURL:(p:string)=>`chrome-extension://extension/${p}`,onMessage:{addListener:(fn:any)=>listener=fn},onStartup:{addListener:()=>{}}},alarms:{clear:async()=>{},create:async()=>{},onAlarm:{addListener:(fn:any)=>alarmListeners.push(fn)}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},notifications:{create:()=>{}},tabs:{create:async({url}:{url:string})=>{opened.push(url);},get:async()=>({url:tabUrl})}};
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
  if(options.method==='POST'&&rejectPost)return new Response('',{status:404});
  if(options.method==='POST'){const c={id:'comentario',idMemberCreator:member,data:{text:payload.text}};comments.push(c);if(failPost)throw Error('Respuesta perdida');return Response.json(c);}
  if(options.method==='PUT'){if(failPut)throw Error('Sin conexión');comments[0].data.text=payload.text;return Response.json(comments[0]);}
  throw Error(`Petición no simulada: ${path}`);
 };
 await import('../dist/background.js' as string);
 const send=(type:string,data:object={},url='chrome-extension://extension/index.html',currentUrl=url):Promise<any>=>new Promise(resolve=>{tabUrl=currentUrl;listener({type,...data},{id:'extension',url,tab:{id:7}},resolve);});
 await send('STATE');
 assert.match((await send('CONNECT',{credentials:{key:'x',token:'pomello'}})).error,/válidos/);
 assert.ok(!(await send('CONNECT',{credentials:{key:'a'.repeat(32),token:'token-prueba'}})).error);
 await send('ADD',{cardId,seconds:600,id:'uno'});await send('ADD',{cardId,seconds:900,id:'dos'});await send('ADD',{cardId,seconds:900,id:'dos'});
 assert.equal(comments.length,1);assert.match(comments[0].data.text,/25 min/);assert.equal(db.state.entries.length,2);

 const originalDate=db.state.entries[0].date;
 await send('EDIT_ENTRY',{id:'uno',seconds:125,note:'Tiempo corregido'});assert.equal(db.state.entries[0].seconds,125);assert.equal(db.state.entries[0].date,originalDate);assert.match(comments[0].data.text,/Tiempo corregido/);assert.equal(comments.length,1);
 assert.match((await send('EDIT_ENTRY',{id:'uno',seconds:0,note:''})).error,/tiempo/);assert.equal(db.state.entries[0].seconds,125);
 assert.match((await send('DELETE_ENTRY',{id:'inexistente'})).error,/no existe/);
 assert.match((await send('DELETE_ENTRY',{id:'uno'},'https://trello.com/c/AbCd1234/test')).error,/permitida/);
 await send('DELETE_ENTRY',{id:'uno'});assert.equal(db.state.entries.length,1);assert.doesNotMatch(comments[0].data.text,/Tiempo corregido/);assert.match(comments[0].data.text,/15 min/);
 await send('ADD',{cardId,seconds:600,id:'uno'});
 failPut=true;await send('ADD',{cardId,seconds:60,id:'tres'});assert.equal(db.state.entries.length,3);assert.ok(db.state.ledgers[cardId].error);
 failPut=false;await send('SYNC');assert.match(comments[0].data.text,/26 min/);assert.equal(db.state.ledgers[cardId].error,undefined);
 comments[0].data.text='Cambio manual';const puts=requests.filter(r=>r.method==='PUT').length;await send('ADD',{cardId,seconds:60,id:'cuatro'});assert.equal(requests.filter(r=>r.method==='PUT').length,puts);assert.match(db.state.ledgers[cardId].error,/cambió/);
 await send('START',{cardId});assert.match((await send('START',{cardId})).error,/activa/);await send('PAUSE');assert.equal(db.state.session.end,null);await send('RESUME');assert.ok(db.state.session.end);await send('CANCEL');assert.equal(db.state.session,undefined);
 await send('START',{cardId});db.state.session.end=Date.now()-120000;await send('STATE');assert.equal(db.state.session.review,true);await send('CANCEL');
 await send('START',{cardId});db.state.session.end=Date.now()-100;const count=db.state.entries.length;await send('STATE');await send('STATE');assert.equal(db.state.entries.length,count+1);assert.equal(db.state.session,undefined);
 assert.match((await send('CONNECT',{},'https://trello.com/c/AbCd1234/test')).error,/permitida/);
 assert.match((await send('ADD',{cardId:'otra',seconds:60,id:'no'},'https://trello.com/c/AbCd1234/test')).error,/cambió/);
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
 db.state={...initial(),connected:true,member:{id:member,name:'Persona'}};comments=[];rejectPost=true;
 await send('START',{cardId});assert.ok(db.state.session);assert.equal(db.state.entries.length,0);assert.match(db.state.ledgers[cardId].error,/crear el comentario.*404/);assert.equal(db.state.ledgers[cardId].creating,false);
 rejectPost=false;await send('SYNC');assert.equal(comments.length,1);assert.match(comments[0].data.text,/Sesión en curso/);assert.equal(db.state.ledgers[cardId].error,undefined);
 const source='https://trello.com/c/AbCd1234/prueba';
 await send('OPEN_CARD',{cardId:'AbCd1234'},source);assert.equal(opened.at(-1),'chrome-extension://extension/index.html?view=card&card='+cardId);
 await send('OPEN');assert.equal(opened.at(-1),'chrome-extension://extension/index.html');
 const openedBefore=opened.length;assert.match((await send('OPEN_CARD',{cardId:'Other123'},source)).error,/cambió/);assert.equal(opened.length,openedBefore);
 const savedCards=db.state.cards;db.state.cards=[];await send('OPEN_CARD',{cardId:'AbCd1234'},source);assert.equal(db.state.cards[0].id,cardId);assert.equal(opened.at(-1),'chrome-extension://extension/index.html?view=card&card='+cardId);db.state.cards=savedCards;
 const panel=await send('CARD_STATE',{cardId:'AbCd1234'},source);assert.equal(panel.data.sameCard,true);assert.ok(panel.data.session);assert.equal(panel.data.entries,undefined);
 await send('PAUSE',{cardId:'AbCd1234'},source);assert.equal(db.state.session.end,null);assert.match(comments[0].data.text,/Sesión en pausa/);
 await send('RESUME',{cardId:'AbCd1234'},source);assert.ok(db.state.session.end);assert.match(comments[0].data.text,/Sesión en curso/);
 assert.match((await send('CANCEL',{cardId:'OtRa1234'},'https://trello.com/c/OtRa1234/prueba')).error,/otra tarjeta/);
 await send('CANCEL',{cardId:'AbCd1234'},source);assert.equal(comments.length,1);assert.doesNotMatch(comments[0].data.text,/Sesión en/);
 const moved=await send('CARD_STATE',{cardId:'AbCd1234'},'https://trello.com/b/tablero','https://trello.com/c/AbCd1234/prueba');assert.equal(moved.data.minutes,25);assert.equal(moved.error,undefined);
 assert.match((await send('START',{cardId:'AbCd1234'},source,'https://trello.com/c/Other123/prueba')).error,/cambió/);
 const stateResponse=await send('STATE');assert.equal(stateResponse.data.credentialsStored,true);assert.equal(JSON.stringify(stateResponse).includes('token-prueba'),false);
 db.state.ledgers[cardId]={commentId:'eliminado',error:'HTTP 404'};
 const beforeDiscard=structuredClone(db.state.entries),callsBefore=requests.length;
 await send('DISCARD_SYNC');assert.equal(db.state.ledgers[cardId].discarded,true);assert.equal(db.state.ledgers[cardId].error,undefined);assert.deepEqual(db.state.entries,beforeDiscard);assert.equal(requests.length,callsBefore);
 await send('SYNC');assert.equal(requests.length,callsBefore);
 assert.equal((await send('CARD_STATE',{cardId:'AbCd1234'},source)).data.syncDiscarded,true);
 comments=[];await send('ADD',{cardId,seconds:60,id:'despues-descartar'});assert.equal(comments.length,1);assert.equal(db.state.ledgers[cardId].discarded,undefined);assert.equal(db.state.entries.length,beforeDiscard.length+1);
 assert.match((await send('DISCARD_SYNC',{},source)).error,/permitida/);
 const entriesBeforeNotes=db.state.entries.length;
 await send('FOCUS_NOTE_SAVE',{cardId,id:'nota-prueba',text:'Una nota sin minutos'});assert.equal(db.state.entries.length,entriesBeforeNotes);assert.match(comments[0].data.text,/Una nota sin minutos/);
 await send('FOCUS_NOTE_SAVE',{cardId,id:'nota-prueba',text:'Nota editada'});assert.equal(db.state.focusNotes.length,1);assert.match(comments[0].data.text,/Nota editada/);
 assert.match((await send('FOCUS_NOTE_SAVE',{cardId,id:'otro',text:'No'},source)).error,/permitida/);
 await send('START',{cardId,note:'Revisión de código'});assert.match(comments[0].data.text,/Revisión de código/);db.state.session.end=Date.now()-100;await send('STATE');assert.equal(db.state.entries.at(-1).note,'Revisión de código');
 const countComments=comments.length;const normal={cardId,requestId:'comentario-prueba',text:'Comentario normal'};
 await send('CARD_COMMENT',normal);await send('CARD_COMMENT',normal);assert.equal(comments.length,countComments+1);
 failPost=true;await send('CARD_COMMENT',{...normal,requestId:'comentario-incierto'});const uncertainCount=comments.length;failPost=false;assert.match((await send('CARD_COMMENT',{...normal,requestId:'comentario-incierto'})).error,/no pudo confirmarse/);assert.equal(comments.length,uncertainCount);
 assert.match((await send('CARD_COMMENT',normal,source)).error,/permitida/);
 await send('DISCONNECT');assert.equal(db.credentials,undefined);assert.equal(db.state.connected,false);assert.equal((await send('STATE')).data.credentialsStored,false);
});

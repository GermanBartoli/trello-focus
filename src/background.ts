import {cardTools,CARD_TOOLS,textValue} from './cardTools';
import {initial,remaining,elapsed,validateSeconds,addEntry,comment,cardPanelState,type State,type Card} from './model';
class TrelloError extends Error { constructor(public status:number){super(`Trello respondió HTTP ${status}.`);} }
type Credentials={key:string;token:string};
let queue:Promise<unknown>=Promise.resolve();
const serial=<T>(fn:()=>Promise<T>)=>{const task=queue.then(fn,fn);queue=task.catch(()=>{});return task;};
const load=async():Promise<State> => {const state:State=(await chrome.storage.local.get('state')).state??initial();const credentials=(await chrome.storage.local.get('credentials')).credentials;state.credentialsStored=!!(credentials?.key&&credentials?.token);if(!state.credentialsStored)state.connected=false;return state;};
const save=async(state:State)=>chrome.storage.local.set({state});
async function api(path:string,method='GET',body?:object,credentials?:Credentials){
 const c=credentials ?? (await chrome.storage.local.get('credentials')).credentials;
 if(!c)throw Error('Conectá tu cuenta de Trello desde Configuración.');
 const response=await fetch(`https://api.trello.com/1/${path}`,{method,headers:{Authorization:`OAuth oauth_consumer_key="${c.key}", oauth_token="${c.token}"`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new TrelloError(response.status);
 return response.status===204?{}:response.json();
}
async function sync(state:State,cardId:string){
 const ledger=state.ledgers[cardId]??={};if(ledger.discarded)return;let operation='leer el comentario guardado';
 try {
  const text=comment(state,cardId);
  if(ledger.commentId){
   const current=await api(`actions/${ledger.commentId}`);
   if(current.idMemberCreator!==state.member?.id)throw Error('El comentario pertenece a otra cuenta.');
   if(current.data.text!==ledger.text&&current.data.text!==ledger.pendingText&&current.data.text!==text)throw Error('El comentario cambió fuera de la extensión. Conservamos tu registro local; revisá el comentario antes de continuar.');
   if(current.data.text!==text){operation='actualizar el comentario';ledger.pendingText=text;await save(state);await api(`cards/${cardId}/actions/${ledger.commentId}/comments`,'PUT',{text});}
  } else {
   // Una creación de resultado incierto nunca se repite automáticamente.
   const marker=`TF:v1:${state.member?.id}:${cardId}`;
   operation='buscar comentarios de la tarjeta';
   const actions=await api(`cards/${cardId}/actions?filter=commentCard&limit=1000`);
   const matches=actions.filter((a:any)=>a.idMemberCreator===state.member?.id&&a.data.text.includes(marker));
   if(matches.length===1&&(matches[0].data.text===text||matches[0].data.text===ledger.pendingText)){ledger.commentId=matches[0].id;ledger.text=matches[0].data.text;ledger.creating=false;await save(state);if(ledger.text!==text){await sync(state,cardId);return;}}
   else if(matches.length||ledger.creating)throw Error('Hay un registro previo o una creación pendiente de confirmar. No se creó otro comentario. Conservá este perfil y exportá el historial.');
   else {operation='crear el comentario';ledger.creating=true;ledger.pendingText=text;await save(state);try{const created=await api(`cards/${cardId}/actions/comments`,'POST',{text});ledger.commentId=created.id;}catch(error){if(error instanceof TrelloError&&error.status>=400&&error.status<500&&error.status!==408)ledger.creating=false;throw error;}}
  }
  ledger.text=text;ledger.creating=false;delete ledger.pendingText;delete ledger.error;
 }catch(error){ledger.error=`No se pudo ${operation}: ${error instanceof Error?error.message:'error de conexión.'}${error instanceof TrelloError&&error.status===404?' La tarjeta o el comentario no está disponible para esta autorización.':''}`;}
 await save(state);
}
async function alarm(state:State){
 await chrome.alarms.clear('focus');
 if(state.session?.end)await chrome.alarms.create('focus',{when:state.session.end});
 await chrome.action.setBadgeText({text:state.session?(state.session.review?'!':state.session.end?'▶':'Ⅱ'):''});
 await chrome.action.setBadgeBackgroundColor({color:'#5be0b5'});
}
async function settle(state:State){
 const s=state.session;if(!s?.end||s.end>Date.now())return;
 // Un vencimiento tardío requiere confirmar el tiempo después de suspensión/cierre.
 if(Date.now()-s.end>90000){s.review=true;s.remaining=0;s.end=null;await save(state);await alarm(state);return;}
 addEntry(state,{id:s.id,cardId:s.card.id,seconds:s.duration,date:new Date(s.end).toISOString(),note:s.note??'',kind:'session'});
 delete state.session;await save(state);await alarm(state);await sync(state,s.card.id);
 if(state.notifications)chrome.notifications.create({type:'basic',iconUrl:'icon.png',title:'Sesión completada',message:`Registraste ${formatMinutes(s.duration)} en ${s.card.name}`},()=>{void chrome.runtime.lastError;});
}
const formatMinutes=(seconds:number)=>`${Math.round(seconds/60)} minutos`;
async function handle(message:any,content:boolean){
 if(message.type==='OPEN_CARD'){
  if(typeof message.cardId!=='string'||!/^[a-zA-Z0-9]{8,24}$/.test(message.cardId))throw Error('Tarjeta inválida.');
  const state=await load();
  let card=state.cards.find(c=>c.id===message.cardId||c.url.split('/')[4]===message.cardId);
  if(!card){card=await api(`cards/${message.cardId}?fields=id,name,url,idBoard,idList,idMembers,idLabels,labels,due,dueComplete,closed,cover`) as Card;state.cards.push(card);await save(state);}
  await chrome.tabs.create({url:chrome.runtime.getURL('index.html')+'?view=card&card='+encodeURIComponent(card.id)});return;
 }
 if(message.type==='OPEN'){await chrome.tabs.create({url:chrome.runtime.getURL('index.html')});return;}
 if(content&&!['START','ADD','CARD_STATE','PAUSE','RESUME','FINISH','CANCEL'].includes(message.type))throw Error('Operación no permitida.');
 const state=await load();if(message.type!=='DISCARD_SYNC')await settle(state);
 if(CARD_TOOLS.includes(message.type)){
  if(!['CARD_CREATE','CARD_COMMENT','CARD_ATTACHMENT','CARD_STICKER'].includes(message.type))return cardTools(message,state,api,save);
  if(typeof message.requestId!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(message.requestId))throw Error('Identificador de operación inválido.');
  const key=message.type+':'+(message.cardId??message.boardId)+':'+message.requestId;
  const receipts=(await chrome.storage.local.get('receipts')).receipts??{};
  if(receipts[key]?.done)return receipts[key].result;
  if(receipts[key])throw Error('El envío anterior no pudo confirmarse. Revisá la tarjeta en Trello antes de volver a publicarlo.');
  receipts[key]={pending:true};await chrome.storage.local.set({receipts});
  let attempted=false;
  try{const result=await cardTools(message,state,async(path,method,body)=>{if(method==='POST')attempted=true;return api(path,method,body);},save);receipts[key]={done:true,result};await chrome.storage.local.set({receipts});return result;}
  catch(error){if(!attempted||(error instanceof TrelloError&&error.status>=400&&error.status<500&&error.status!==408)){delete receipts[key];await chrome.storage.local.set({receipts});}throw error;}
 }
 if(content&&['PAUSE','RESUME','FINISH','CANCEL'].includes(message.type)&&!cardPanelState(state,message.cardId).sameCard)throw Error('La sesión activa pertenece a otra tarjeta.');
 switch(message.type){
 case 'STATE':return state;
 case 'FOCUS_NOTE_SAVE':{
  if(typeof message.cardId!=='string'||!/^[a-zA-Z0-9]{8,24}$/.test(message.cardId)||typeof message.id!=='string'||message.id.length>100)throw Error('Nota inválida.');
  const text=textValue(message.text,2000);const notes=state.focusNotes??=[];const existing=notes.find(n=>n.id===message.id);
  if(existing&&existing.cardId!==message.cardId)throw Error('La nota pertenece a otra tarjeta.');
  if(existing)existing.text=text;else notes.push({id:message.id,cardId:message.cardId,text,date:new Date().toISOString()});
  await save(state);await sync(state,message.cardId);return state;
 }
 case 'SESSION_NOTE':if(state.session){state.session.note=String(message.note??'').slice(0,200);await save(state);await sync(state,state.session.card.id);}return state;
 case 'EDIT_ENTRY':case 'DELETE_ENTRY':{
  const entry=state.entries.find(e=>e.id===message.id);
  if(!entry)throw Error('El registro ya no existe. Actualizá el panel.');
  if(message.type==='EDIT_ENTRY'){
   const seconds=validateSeconds(message.seconds);
   if(typeof message.note!=='string'||message.note.length>200)throw Error('La nota admite hasta 200 caracteres.');
   entry.seconds=seconds;entry.note=message.note.trim();
  }else state.entries=state.entries.filter(e=>e.id!==entry.id);
  await save(state);await sync(state,entry.cardId);return state;
 }
 case 'DISCARD_SYNC':for(const ledger of Object.values(state.ledgers)){if(ledger.error){ledger.discarded=true;delete ledger.error;}}await save(state);return state;
 case 'SORT':if(!['default','time-desc','time-asc','recent','oldest','cover-priority'].includes(message.order))throw Error('Orden de tarjetas inválido.');state.cardSort=message.order;await save(state);return state;
 case 'FILTER':if(!['active','archived','all'].includes(message.status))throw Error('Filtro de tarjetas inválido.');state.cardStatus=message.status;await save(state);return state;
 case 'CARD_STATE':return cardPanelState(state,message.cardId);
 case 'CONNECT':{
  if(content)throw Error('Operación no permitida.');
  const c=message.credentials as Credentials;
  if(!/^[a-f0-9]{32}$/i.test(c?.key)||!c?.token||c.token.length>512||/[\s"\\]/.test(c.token))throw Error('Ingresá una API key y un token de Trello válidos. El token de Pomello no sirve aquí.');
  const member=await api('members/me?fields=id,fullName','GET',undefined,c);
  if(state.member&&state.member.id!==member.id)throw Error('Este perfil ya tiene registros de otra cuenta. Usá un perfil de Chrome separado.');
  await chrome.storage.local.set({credentials:c});state.connected=true;state.credentialsStored=true;state.member={id:member.id,name:member.fullName};await save(state);return state;
 }
 case 'DISCONNECT':if(state.session)throw Error('Terminá o descartá la sesión primero.');await chrome.storage.local.remove('credentials');state.connected=false;state.credentialsStored=false;await save(state);return state;
 case 'REFRESH':{
  state.boards=await api('members/me/boards?filter=all&fields=id,name,closed');
  state.cards=[];for(const board of state.boards){const cards=await api(`boards/${board.id}/cards?filter=all&fields=id,name,url,idBoard,idList,idMembers,idLabels,labels,due,dueComplete,closed,cover`);state.cards.push(...cards.map((card:Card)=>({...card,cover:card.cover??{}})));}state.cards=[...new Map(state.cards.map(c=>[c.id,c])).values()];
  state.lists=[];
  for(const id of new Set(state.cards.map(c=>c.idBoard).filter(Boolean))){
   const lists=await api(`boards/${id}/lists?filter=all&fields=id,name,idBoard,closed`);
   state.lists.push(...lists);
  }
  await save(state);return state;
 }
 case 'BOARD':{
  if(!/^[a-f0-9]{24}$/.test(message.id))throw Error('Tablero inválido.');
  const cards=await api(`boards/${message.id}/cards?filter=all&fields=id,name,url,idBoard,idList,idMembers,idLabels,labels,due,dueComplete,closed,cover`);
  state.cards=[...state.cards.filter(c=>c.idBoard!==message.id),...cards];
  const lists=await api(`boards/${message.id}/lists?filter=all&fields=id,name,idBoard,closed`);state.lists=[...state.lists.filter(l=>!lists.some((n:any)=>n.id===l.id)),...lists];await save(state);return state;
 }
 case 'SETTINGS':state.minutes=Math.min(180,Math.max(1,Math.round(Number(message.minutes)||25)));state.notifications=!!message.notifications;await save(state);return state;
 case 'FAVORITE':state.favorites=state.favorites.includes(message.id)?state.favorites.filter(id=>id!==message.id):[...state.favorites,message.id];await save(state);return state;
 case 'ADD':case 'START':{
  if(!state.connected)throw Error('Conectá Trello desde el panel de la extensión.');
  if(!/^[a-zA-Z0-9]{8,24}$/.test(message.cardId))throw Error('Tarjeta inválida.');
  if(message.type==='START'&&state.session)throw Error('Ya hay una sesión activa. Abrí el panel para gestionarla.');
  const card:Card=state.cards.find(c=>c.id===message.cardId||c.url.split("/")[4]===message.cardId) ?? await api(`cards/${message.cardId}?fields=id,name,url,idBoard,idList,idMembers`);
  if(!state.cards.some(c=>c.id===card.id))state.cards.push(card);
  if(state.ledgers[card.id]?.discarded)state.ledgers[card.id]={};
  if(message.type==='START'){state.session={id:crypto.randomUUID(),card,note:String(message.note??'').slice(0,200),duration:state.minutes*60,remaining:state.minutes*60,end:Date.now()+state.minutes*60000,startedAt:new Date().toISOString()};await save(state);await alarm(state);await sync(state,card.id);}
  else {const seconds=validateSeconds(message.seconds);if(typeof message.id!=='string'||message.id.length>100)throw Error('Registro inválido.');addEntry(state,{id:message.id,cardId:card.id,seconds,date:new Date().toISOString(),note:String(message.note??'').slice(0,200),kind:'manual'});await save(state);await sync(state,card.id);}
  return state;
 }
 case 'PAUSE':if(state.session){state.session.remaining=remaining(state.session);state.session.end=null;await save(state);await alarm(state);await sync(state,state.session.card.id);}return state;
 case 'RESUME':if(state.session&&!state.session.review){state.session.end=Date.now()+state.session.remaining*1000;await save(state);await alarm(state);await sync(state,state.session.card.id);}return state;
 case 'FINISH':{
  const s=state.session;if(s){const seconds=elapsed(s);if(seconds>0)addEntry(state,{id:s.id,cardId:s.card.id,seconds,date:new Date().toISOString(),note:s.note||(s.review?'Sesión recuperada y confirmada':''),kind:'session'});delete state.session;await save(state);await alarm(state);await sync(state,s.card.id);}return state;
 }
 case 'CANCEL':{const cardId=state.session?.card.id;delete state.session;await save(state);await alarm(state);if(cardId)await sync(state,cardId);return state;}
 case 'SYNC':for(const id of Object.keys(state.ledgers))await sync(state,id);return state;
 default:throw Error('Operación desconocida.');
 }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 const content=!!sender.url?.startsWith('https://trello.com/');
 if(!content&&!sender.url?.startsWith(chrome.runtime.getURL('')))return;
 serial(async()=>{
  if(content&&['OPEN_CARD','ADD','START','CARD_STATE','PAUSE','RESUME','FINISH','CANCEL'].includes(message.type)){
   // Trello cambia la ruta con navegación interna; sender.url puede conservar la ruta inicial.
   if(sender.tab?.id===undefined)throw Error('No se pudo identificar la pestaña de Trello.');
   const currentTab=await chrome.tabs.get(sender.tab.id);
   const currentUrl=new URL(currentTab.url??'https://trello.com/');
   if(currentUrl.origin!=='https://trello.com'||message.cardId!==currentUrl.pathname.match(/^\/c\/([^/]+)/)?.[1])throw Error('La tarjeta cambió. Esperá un momento o volvé a abrirla.');
  }
  const data=await handle(message,content);return content?cardPanelState(await load(),message.cardId):data;}).then(data=>respond({data}),error=>respond({error:error.message??'No se pudo completar la acción.'}));return true;
});
chrome.alarms.onAlarm.addListener(()=>{void serial(async()=>{const state=await load();await settle(state);});});
chrome.runtime.onStartup.addListener(()=>{void serial(async()=>{const state=await load();if(state.session?.end&&state.session.end<Date.now()){state.session.review=true;state.session.remaining=0;state.session.end=null;await save(state);}await alarm(state);});});
void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
void serial(async()=>{const state=await load();await settle(state);await alarm(state);});

import {initial,remaining,elapsed,validateSeconds,addEntry,comment,type State,type Card} from './model';
type Credentials={key:string;token:string};
let queue:Promise<unknown>=Promise.resolve();
const serial=<T>(fn:()=>Promise<T>)=>{const task=queue.then(fn,fn);queue=task.catch(()=>{});return task;};
const load=async():Promise<State> => (await chrome.storage.local.get('state')).state ?? initial();
const save=async(state:State)=>chrome.storage.local.set({state});
async function api(path:string,method='GET',body?:object,credentials?:Credentials){
 const c=credentials ?? (await chrome.storage.local.get('credentials')).credentials;
 if(!c)throw Error('Conectá tu cuenta de Trello desde Configuración.');
 const response=await fetch(`https://api.trello.com/1/${path}`,{method,headers:{Authorization:`OAuth oauth_consumer_key="${c.key}", oauth_token="${c.token}"`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(response.status===401?'La autorización venció. Volvé a conectar Trello.':response.status===429?'Trello pidió esperar. Reintentá en unos minutos.':`Trello respondió ${response.status}. Revisá tus permisos o la conexión.`);
 return response.json();
}
async function sync(state:State,cardId:string){
 const ledger=state.ledgers[cardId]??={};
 try {
  const text=comment(state,cardId);
  if(ledger.commentId){
   const current=await api(`actions/${ledger.commentId}`);
   if(current.idMemberCreator!==state.member?.id)throw Error('El comentario pertenece a otra cuenta.');
   if(current.data.text!==ledger.text&&current.data.text!==text)throw Error('El comentario cambió fuera de la extensión. Conservamos tu registro local; revisá el comentario antes de continuar.');
   if(current.data.text!==text)await api(`cards/${cardId}/actions/${ledger.commentId}/comments`,'PUT',{text});
  } else {
   // Una creación de resultado incierto nunca se repite automáticamente.
   const marker=`TF:v1:${state.member?.id}:${cardId}`;
   const actions=await api(`cards/${cardId}/actions?filter=commentCard&limit=1000`);
   const matches=actions.filter((a:any)=>a.idMemberCreator===state.member?.id&&a.data.text.includes(marker));
   if(matches.length===1&&matches[0].data.text===text){ledger.commentId=matches[0].id;}
   else if(matches.length||ledger.creating)throw Error('Hay un registro previo o una creación pendiente de confirmar. No se creó otro comentario. Conservá este perfil y exportá el historial.');
   else {ledger.creating=true;await save(state);const created=await api(`cards/${cardId}/actions/comments`,'POST',{text});ledger.commentId=created.id;}
  }
  ledger.text=text;ledger.creating=false;delete ledger.error;
 }catch(error){ledger.error=error instanceof Error?error.message:'No se pudo sincronizar.';}
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
 addEntry(state,{id:s.id,cardId:s.card.id,seconds:s.duration,date:new Date(s.end).toISOString(),note:'',kind:'session'});
 delete state.session;await save(state);await alarm(state);await sync(state,s.card.id);
 if(state.notifications)chrome.notifications.create({type:'basic',iconUrl:'icon.png',title:'Sesión completada',message:`Registraste ${formatMinutes(s.duration)} en ${s.card.name}`},()=>{void chrome.runtime.lastError;});
}
const formatMinutes=(seconds:number)=>`${Math.round(seconds/60)} minutos`;
async function handle(message:any,content:boolean){
 if(message.type==='OPEN'){await chrome.tabs.create({url:chrome.runtime.getURL('index.html')});return;}
 if(content&&!['START','ADD','CARD_STATE'].includes(message.type))throw Error('Operación no permitida.');
 const state=await load();await settle(state);
 switch(message.type){
 case 'STATE':return state;
 case 'SORT':if(!['default','time-desc','time-asc','recent','oldest'].includes(message.order))throw Error('Orden de tarjetas inválido.');state.cardSort=message.order;await save(state);return state;
 case 'FILTER':if(!['active','archived','all'].includes(message.status))throw Error('Filtro de tarjetas inválido.');state.cardStatus=message.status;await save(state);return state;
 case 'CARD_STATE':return {minutes:state.minutes,active:!!state.session,connected:!!state.connected};
 case 'CONNECT':{
  if(content)throw Error('Operación no permitida.');
  const c=message.credentials as Credentials;
  if(!/^[a-f0-9]{32}$/i.test(c?.key)||!c?.token||c.token.length>512||/[\s"\\]/.test(c.token))throw Error('Ingresá una API key y un token de Trello válidos. El token de Pomello no sirve aquí.');
  const member=await api('members/me?fields=id,fullName','GET',undefined,c);
  if(state.member&&state.member.id!==member.id)throw Error('Este perfil ya tiene registros de otra cuenta. Usá un perfil de Chrome separado.');
  await chrome.storage.local.set({credentials:c});state.connected=true;state.member={id:member.id,name:member.fullName};await save(state);return state;
 }
 case 'DISCONNECT':if(state.session)throw Error('Terminá o descartá la sesión primero.');await chrome.storage.local.remove('credentials');state.connected=false;await save(state);return state;
 case 'REFRESH':{
  state.boards=await api('members/me/boards?filter=all&fields=id,name,closed');
  state.cards=await api('members/me/cards?filter=all&fields=id,name,url,idBoard,idList,idMembers,closed');
  state.lists=[];
  for(const id of new Set(state.cards.map(c=>c.idBoard).filter(Boolean))){
   const lists=await api(`boards/${id}/lists?filter=all&fields=id,name,idBoard,closed`);
   state.lists.push(...lists);
  }
  await save(state);return state;
 }
 case 'BOARD':{
  if(!/^[a-f0-9]{24}$/.test(message.id))throw Error('Tablero inválido.');
  const cards=await api(`boards/${message.id}/cards?filter=all&fields=id,name,url,idBoard,idList,idMembers,closed`);
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
  if(message.type==='START'){state.session={id:crypto.randomUUID(),card,duration:state.minutes*60,remaining:state.minutes*60,end:Date.now()+state.minutes*60000};await save(state);await alarm(state);}
  else {const seconds=validateSeconds(message.seconds);if(typeof message.id!=='string'||message.id.length>100)throw Error('Registro inválido.');addEntry(state,{id:message.id,cardId:card.id,seconds,date:new Date().toISOString(),note:String(message.note??'').slice(0,200),kind:'manual'});await save(state);await sync(state,card.id);}
  return state;
 }
 case 'PAUSE':if(state.session){state.session.remaining=remaining(state.session);state.session.end=null;await save(state);await alarm(state);}return state;
 case 'RESUME':if(state.session&&!state.session.review){state.session.end=Date.now()+state.session.remaining*1000;await save(state);await alarm(state);}return state;
 case 'FINISH':{
  const s=state.session;if(s){const seconds=elapsed(s);if(seconds>0)addEntry(state,{id:s.id,cardId:s.card.id,seconds,date:new Date().toISOString(),note:s.review?'Sesión recuperada y confirmada':'',kind:'session'});delete state.session;await save(state);await alarm(state);if(seconds>0)await sync(state,s.card.id);}return state;
 }
 case 'CANCEL':delete state.session;await save(state);await alarm(state);return state;
 case 'SYNC':for(const id of Object.keys(state.ledgers))await sync(state,id);return state;
 default:throw Error('Operación desconocida.');
 }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 const content=!!sender.url?.startsWith('https://trello.com/');
 if(!content&&!sender.url?.startsWith(chrome.runtime.getURL('')))return;
 if(content&&['ADD','START','CARD_STATE'].includes(message.type)&&message.cardId!==new URL(sender.url!).pathname.match(/^\/c\/([^/]+)/)?.[1]){respond({error:'Abrí la tarjeta antes de registrar tiempo.'});return;}
 serial(()=>handle(message,content)).then(data=>respond({data}),error=>respond({error:error.message??'No se pudo completar la acción.'}));return true;
});
chrome.alarms.onAlarm.addListener(()=>{void serial(async()=>{const state=await load();await settle(state);});});
chrome.runtime.onStartup.addListener(()=>{void serial(async()=>{const state=await load();if(state.session?.end&&state.session.end<Date.now()){state.session.review=true;state.session.remaining=0;state.session.end=null;await save(state);}await alarm(state);});});
void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
void serial(async()=>{const state=await load();await settle(state);await alarm(state);});

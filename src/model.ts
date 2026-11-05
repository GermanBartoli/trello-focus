export type Card = {id:string;name:string;url:string;idBoard?:string;idList?:string;idMembers?:string[];closed?:boolean};
export type Entry = {id:string;cardId:string;seconds:number;date:string;note:string;kind:'manual'|'session'};
export type Session = {note?:string;id:string;card:Card;duration:number;remaining:number;end:number|null;startedAt?:string;review?:boolean};
export type Ledger = {discarded?:boolean;commentId?:string;text?:string;creating?:boolean;pendingText?:string;error?:string};
export type State = {focusNotes?:{id:string;cardId:string;text:string;date:string}[];credentialsStored?:boolean;cardStatus?:CardStatus;cardSort?:CardSort;connected?:boolean;member?:{id:string;name:string};cards:Card[];boards:{id:string;name:string;closed?:boolean}[];lists:{id:string;name:string;idBoard?:string;closed?:boolean}[];entries:Entry[];session?:Session;ledgers:Record<string,Ledger>;favorites:string[];minutes:number;notifications:boolean};
export const initial = ():State => ({cardStatus:'active',cardSort:'default',cards:[],boards:[],lists:[],entries:[],ledgers:{},favorites:[],minutes:25,notifications:true});
export const remaining = (s:Session,now=Date.now()) => s.end === null ? s.remaining : Math.max(0,Math.ceil((s.end-now)/1000));
export const elapsed = (s:Session,now=Date.now()) => Math.max(0,s.duration-remaining(s,now));
export function format(seconds:number){ const m=Math.floor(seconds/60);return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min${seconds%60 ? ` ${Math.floor(seconds%60)} s`:''}`; }
export function validateSeconds(value:unknown):number {if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>86400)throw Error('Ingresá un tiempo entre 1 segundo y 24 horas.');return value;}
export function addEntry(state:State,entry:Entry){validateSeconds(entry.seconds);if(!state.entries.some(e=>e.id===entry.id))state.entries.push(entry);}
export function comment(state:State,cardId:string){
 const entries=state.entries.filter(e=>e.cardId===cardId);const total=entries.reduce((s,e)=>s+e.seconds,0);
 const lines=entries.slice(-60).reverse().map(e=>`• ${new Date(e.date).toLocaleString('es-AR')} · ${format(e.seconds)} · ${e.kind==='session'?'Sesión':'Carga manual'}${e.note ? ` · ${e.note.replace(/[\r\n]/g,' ').replace(/[*_`<>]/g,'')}`:''}`);
 const session=state.session?.card.id===cardId?state.session:undefined;
 const sessionText=session?`\n\n**Sesión ${session.review?'pendiente de confirmar':session.end?'en curso':'en pausa'}** · ${format(session.duration)} previstos. El tiempo se suma al terminar.${session.startedAt?` Inicio: ${new Date(session.startedAt).toLocaleString('es-AR')}`:''}${session.note?'\n'+session.note.replace(/[\r\n]/g,' '):''}`:' ';
 return `**Trello Focus**\n\n## Total acumulado: ${format(total)}${sessionText}\n\n${lines.join('\n')}${(state.focusNotes??[]).filter(n=>n.cardId===cardId).map(n=>'\n\n'+n.text).join('')}\n\nRegistro administrado por Trello Focus. Historial completo disponible en la extensión.\n\nTF:v1:${state.member?.id}:${cardId}`;
}

export type CardStatus = 'active'|'archived'|'all';
export function isArchived(card:Card,state:State){
 return !!(card.closed||state.lists.find(l=>l.id===card.idList)?.closed||state.boards.find(b=>b.id===card.idBoard)?.closed);
}
export function matchesStatus(card:Card,state:State,status:CardStatus='active'){
 return status==='all'||isArchived(card,state)===(status==='archived');
}

export type CardSort = 'default'|'time-desc'|'time-asc'|'recent'|'oldest';
export function sortCards(cards:Card[],entries:Entry[],order:CardSort='default'):Card[]{
 const result=[...cards];
 if(order==='default')return result;
 const totals=new Map<string,number>();const latest=new Map<string,number>();
 for(const entry of entries){
  totals.set(entry.cardId,(totals.get(entry.cardId)??0)+entry.seconds);
  const date=Date.parse(entry.date);
  if(Number.isFinite(date))latest.set(entry.cardId,Math.max(latest.get(entry.cardId)??-Infinity,date));
 }
 return result.sort((a,b)=>{
  if(order==='time-desc'||order==='time-asc')return ((totals.get(a.id)??0)-(totals.get(b.id)??0))*(order==='time-desc'?-1:1);
  const dateA=latest.get(a.id),dateB=latest.get(b.id);
  // Las tarjetas sin trabajo registrado quedan al final en ambos órdenes de fecha.
  if(dateA===undefined)return dateB===undefined?0:1;
  if(dateB===undefined)return -1;
  return (dateA-dateB)*(order==='recent'?-1:1);
 });
}

export function cardPanelState(state:State,cardId:string){
 const card=state.cards.find(c=>c.id===cardId||c.url.split('/')[4]===cardId);
 const session=state.session;
 const same=!!session&&(session.card.id===cardId||session.card.url.split('/')[4]===cardId);
 return {minutes:state.minutes,connected:!!state.connected,active:!!session,sameCard:same,
  session:same?session:undefined,otherCard:session&&!same?session.card.name:undefined,
  error:card?state.ledgers[card.id]?.error:undefined,
  syncDiscarded:card?!!state.ledgers[card.id]?.discarded:false,
  total:card?state.entries.filter(e=>e.cardId===card.id).reduce((n,e)=>n+e.seconds,0):0};
}

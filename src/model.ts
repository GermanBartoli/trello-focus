export type Card = {id:string;name:string;url:string;idBoard?:string;idList?:string;idMembers?:string[]};
export type Entry = {id:string;cardId:string;seconds:number;date:string;note:string;kind:'manual'|'session'};
export type Session = {id:string;card:Card;duration:number;remaining:number;end:number|null;review?:boolean};
export type Ledger = {commentId?:string;text?:string;creating?:boolean;error?:string};
export type State = {connected?:boolean;member?:{id:string;name:string};cards:Card[];boards:{id:string;name:string}[];lists:{id:string;name:string}[];entries:Entry[];session?:Session;ledgers:Record<string,Ledger>;favorites:string[];minutes:number;notifications:boolean};
export const initial = ():State => ({cards:[],boards:[],lists:[],entries:[],ledgers:{},favorites:[],minutes:25,notifications:true});
export const remaining = (s:Session,now=Date.now()) => s.end === null ? s.remaining : Math.max(0,Math.ceil((s.end-now)/1000));
export const elapsed = (s:Session,now=Date.now()) => Math.max(0,s.duration-remaining(s,now));
export function format(seconds:number){ const m=Math.floor(seconds/60);return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min${seconds%60 ? ` ${Math.floor(seconds%60)} s`:''}`; }
export function validateSeconds(value:unknown):number {if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>86400)throw Error('Ingresá un tiempo entre 1 segundo y 24 horas.');return value;}
export function addEntry(state:State,entry:Entry){validateSeconds(entry.seconds);if(!state.entries.some(e=>e.id===entry.id))state.entries.push(entry);}
export function comment(state:State,cardId:string){
 const entries=state.entries.filter(e=>e.cardId===cardId);const total=entries.reduce((s,e)=>s+e.seconds,0);
 const lines=entries.slice(-60).reverse().map(e=>`• ${new Date(e.date).toLocaleString('es-AR')} · ${format(e.seconds)} · ${e.kind==='session'?'Sesión':'Carga manual'}${e.note ? ` · ${e.note.replace(/[\r\n]/g,' ').replace(/[*_`<>]/g,'')}`:''}`);
 return `**Trello Focus**\n\n## Total acumulado: ${format(total)}\n\n${lines.join('\n')}\n\nRegistro administrado por Trello Focus. Historial completo disponible en la extensión.\n\nTF:v1:${state.member?.id}:${cardId}`;
}

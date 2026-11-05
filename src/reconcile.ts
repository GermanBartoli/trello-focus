import {initial,comment,type State,type Entry} from './model.ts';
// Recuperar únicamente comentarios completos cuyo formato se puede verificar.
export function reconcileLegacy(state:State,cardId:string,action:{id:string;idMemberCreator:string;data:{text:string}}){
 if(action.idMemberCreator!==state.member?.id)throw Error('El registro pertenece a otra cuenta.');
 const text=action.data.text.replace(/\r\n/g,'\n');const marker='TF:v1:'+state.member?.id+':'+cardId;
 if(!text.trim().endsWith(marker))throw Error('El registro no pertenece a esta tarjeta.');
 const parsed:Entry[]=[];
 for(const line of text.split('\n').filter(l=>l.startsWith('• '))){
  const m=line.match(/^• (\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) · (?:(\d+) h )?(\d+) min(?: (\d+) s)? · (Carga manual|Sesión)(?: · (.*))?$/);
  if(!m)throw Error('El comentario contiene fechas o registros que requieren revisión.');
  const date=new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+m[6]);const seconds=Number(m[7]??0)*3600+Number(m[8])*60+Number(m[9]??0);
  if(!Number.isFinite(date.getTime())||seconds<=0||seconds>86400)throw Error('El registro previo contiene valores inválidos.');
  parsed.push({id:'recuperado:'+action.id+':'+parsed.length,cardId,date:date.toISOString(),seconds,kind:m[10]==='Sesión'?'session':'manual',note:m[11]??''});
 }
 const probe={...initial(),member:state.member,entries:[...parsed].reverse()};
 const normalize=(value:string)=>value.split('\n').map(line=>line.trimEnd()).join('\n').trim();
 if(normalize(comment(probe,cardId))!==normalize(text))throw Error('El comentario no contiene un historial completo verificable. Se conservaron ambos registros sin sobrescribirlos.');
 const local=state.entries.filter(e=>e.cardId===cardId);const used=new Set<string>();const additions:Entry[]=[];
 for(const remote of parsed){
  const sameTime=local.filter(e=>Math.floor(Date.parse(e.date)/1000)===Math.floor(Date.parse(remote.date)/1000));
  const match=sameTime.find(e=>!used.has(e.id)&&e.seconds===remote.seconds&&e.kind===remote.kind&&e.note.replace(/[\r\n]/g,' ').replace(/[*_`<>]/g,'')===remote.note);
  if(match){used.add(match.id);continue;}
  if(sameTime.length)throw Error('Hay registros con la misma fecha y valores distintos. Se requiere revisión para evitar duplicados.');
  additions.push(remote);
 }
 state.entries.push(...additions.reverse());return additions.length;
}

import type {State} from './model';
export function weeklyStats(state:State,offset=0,now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7+offset*7);
 const end=new Date(start);end.setDate(end.getDate()+7);const previous=new Date(start);previous.setDate(previous.getDate()-7);
 const valid=state.entries.filter(e=>Number.isFinite(e.seconds)&&e.seconds>0&&Number.isFinite(new Date(e.date).getTime())&&new Date(e.date)<=now);
 const entries=valid.filter(e=>new Date(e.date)>=start&&new Date(e.date)<end);
 const days=Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);const next=new Date(date);next.setDate(next.getDate()+1);return {date,seconds:entries.filter(e=>new Date(e.date)>=date&&new Date(e.date)<next).reduce((s,e)=>s+e.seconds,0)};});
 const total=entries.reduce((s,e)=>s+e.seconds,0),previousTotal=valid.filter(e=>new Date(e.date)>=previous&&new Date(e.date)<start).reduce((s,e)=>s+e.seconds,0);
 const cards=[...new Set(entries.map(e=>e.cardId))].map(id=>({id,name:state.cards.find(c=>c.id===id)?.name??'Tarjeta fuera de la lista cargada',seconds:entries.filter(e=>e.cardId===id).reduce((s,e)=>s+e.seconds,0)})).sort((a,b)=>b.seconds-a.seconds);
 const boards=new Map<string,number>();for(const e of entries){const id=state.cards.find(c=>c.id===e.cardId)?.idBoard??'';boards.set(id,(boards.get(id)??0)+e.seconds);}
 return {start,end,days,total,previousTotal,cards,boards:[...boards].map(([id,seconds])=>({id,name:state.boards.find(b=>b.id===id)?.name??'Sin tablero disponible',seconds})).sort((a,b)=>b.seconds-a.seconds),sessions:entries.filter(e=>e.kind==='session').length,sessionSeconds:entries.filter(e=>e.kind==='session').reduce((s,e)=>s+e.seconds,0),activeDays:days.filter(d=>d.seconds>0).length,average:Math.round(total/(offset===0?(now.getDay()+6)%7+1:7))};
}

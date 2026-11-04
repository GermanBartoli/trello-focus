import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,remaining,elapsed,addEntry,comment,validateSeconds,matchesStatus,sortCards} from '../src/model.ts';
test('El temporizador conserva el tiempo al pausar y limita el vencimiento',()=>{
 const s={id:'s',card:{id:'c',name:'Tarjeta',url:''},duration:1500,remaining:1500,end:100000};
 assert.equal(remaining(s,90000),10);assert.equal(elapsed(s,90000),1490);assert.equal(remaining(s,110000),0);
 assert.equal(remaining({...s,end:null,remaining:42},999999),42);
});
test('Una operación repetida suma tiempo una sola vez y genera un único total',()=>{
 const state=initial();state.member={id:'persona',name:'Persona'};
 const e={id:'op',cardId:'tarjeta',seconds:600,date:'2026-11-04T12:00:00Z',note:'',kind:'manual' as const};
 addEntry(state,e);addEntry(state,e);addEntry(state,{...e,id:'op2',seconds:900});
 assert.equal(state.entries.length,2);assert.match(comment(state,'tarjeta'),/25 min/);assert.match(comment(state,'tarjeta'),/TF:v1:persona:tarjeta/);
});
test('Rechaza valores inválidos, negativos y excesivos',()=>{
 for(const value of [0,-1,NaN,Infinity,86401,'60',1.5])assert.throws(()=>validateSeconds(value));assert.equal(validateSeconds(3600),3600);
});

test('El filtro comienza en activas y reconoce tarjetas, listas y tableros archivados',()=>{
 const state=initial();assert.equal(state.cardStatus,'active');
 state.boards=[{id:'b',name:'Tablero',closed:true}];state.lists=[{id:'l',name:'Lista',closed:true}];
 const base={id:'c',name:'Tarjeta',url:''};
 const cards=[base,{...base,id:'cerrada',closed:true},{...base,id:'lista',idList:'l'},{...base,id:'tablero',idBoard:'b'}];
 assert.deepEqual(cards.filter(c=>matchesStatus(c,state)).map(c=>c.id),['c']);
 assert.deepEqual(cards.filter(c=>matchesStatus(c,state,'archived')).map(c=>c.id),['cerrada','lista','tablero']);
 assert.equal(cards.filter(c=>matchesStatus(c,state,'all')).length,4);
});

test('Ordena por tiempo acumulado y último registro sin modificar tarjetas ni historial',()=>{
 const cards=['a','b','c','d'].map(id=>({id,name:id,url:''}));
 const entry=(cardId:string,seconds:number,date:string)=>({id:cardId+date,cardId,seconds,date,note:'',kind:'manual' as const});
 const entries=[entry('a',300,'2026-11-01'),entry('a',300,'2026-11-04'),entry('b',900,'2026-11-02'),entry('d',600,'2026-11-03')];
 const ids=(order:Parameters<typeof sortCards>[2])=>sortCards(cards,entries,order).map(c=>c.id);
 assert.deepEqual(ids('default'),['a','b','c','d']);
 assert.deepEqual(ids('time-desc'),['b','a','d','c']);
 assert.deepEqual(ids('time-asc'),['c','a','d','b']);
 assert.deepEqual(ids('recent'),['a','d','b','c']);
 assert.deepEqual(ids('oldest'),['b','d','a','c']);
 assert.deepEqual(cards.map(c=>c.id),['a','b','c','d']);assert.equal(entries.length,4);
 assert.deepEqual(sortCards(cards.filter(c=>c.id!=='a'),entries,'recent').map(c=>c.id),['d','b','c']);
});

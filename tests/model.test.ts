import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,remaining,elapsed,addEntry,comment,validateSeconds} from '../src/model.ts';
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

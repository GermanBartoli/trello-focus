import type {State} from './model';
import {validStoredState} from './storageRecovery';
export const extension=typeof chrome!=='undefined'&&!!chrome.runtime?.id;
async function dispatch(type:string,fields:object={}){
 if(!extension)return (await import('./webRuntime')).webRequest(type,fields);
 const response=await chrome.runtime.sendMessage({type,...fields});if(response?.error)throw Error(response.error);return response?.data;
}
export async function send(type:string,fields:object={}):Promise<State>{return dispatch(type,fields);}
export async function request<T>(type:string,fields:object={}):Promise<T>{return dispatch(type,fields);}
export function subscribeState(listener:(state:State)=>void){
 if(extension){const fn=(changes:{[key:string]:chrome.storage.StorageChange})=>{if(validStoredState(changes.state?.newValue))listener(changes.state.newValue);};chrome.storage.onChanged.addListener(fn);return()=>chrome.storage.onChanged.removeListener(fn);}
 const fn=()=>{try{const state=JSON.parse(localStorage.getItem('trello-focus-web:state')??'null');if(state)listener(state);}catch{/* No sustituir el historial ante datos incompletos. */}};window.addEventListener('trello-focus-state',fn);return()=>window.removeEventListener('trello-focus-state',fn);
}

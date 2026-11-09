import {createEngine} from './engine';
const prefix='trello-focus-web:';
const emit=()=>window.dispatchEvent(new Event('trello-focus-state'));
const storage={get:async(key:string)=>{
 const raw=localStorage.getItem(prefix+key);
 try{return {[key]:JSON.parse(raw??'null')};}
 catch(error){if(key==='state')return {state:{__trelloFocusInvalidJson:raw}};throw error;}
},set:async(values:Record<string,unknown>)=>{for(const [key,value] of Object.entries(values))localStorage.setItem(prefix+key,JSON.stringify(value));emit();},remove:async(key:string)=>{localStorage.removeItem(prefix+key);emit();}};
// Adaptador web: el motor no modifica ni depende del almacenamiento de la extensión.
const platform={storage:{local:storage},alarms:{clear:async()=>{},create:async()=>{}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},runtime:{getURL:(path:string)=>new URL(path,location.href).href},tabs:{create:async({url}:{url:string})=>{window.open(url,'_blank','noopener,noreferrer');}},notifications:{create:(_options:unknown,done?:()=>void)=>{if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('Trello Focus',{body:'Tu sesión terminó. Revisá el registro de tiempo.'});done?.();}}} as unknown as typeof chrome;
const engine=createEngine(platform);
export async function webRequest(type:string,fields:object={}){
 if(!navigator.locks)throw Error('Usá una versión actual de Chrome, Edge o Firefox para proteger tus registros entre pestañas.');
 return navigator.locks.request('trello-focus-web-state',()=>engine.dispatch({type,...fields}));
}
// Las fechas absolutas permiten recuperar la sesión tras suspender o cerrar la pestaña.
setInterval(()=>{void navigator.locks?.request('trello-focus-web-state',()=>engine.tick()).catch(()=>{});},1000);
window.addEventListener('storage',e=>{if(e.key?.startsWith(prefix))emit();});

export {};
// Canal mínimo para la web oficial: presencia y apertura, sin datos de Trello.
const origin='https://trello-focus.pages.dev';
const channel='trello-focus-extension-v1';
if(location.origin===origin&&window===window.top){
 let opening=false;
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==origin||event.data?.channel!==channel||event.data?.type!=='PING'||typeof event.data.requestId!=='string'||event.data.requestId.length>80)return;
  const requestId=event.data.requestId;
  try{
   const response=await chrome.runtime.sendMessage({type:'SITE_PING'});
   if(typeof response?.version==='string')window.postMessage({channel,type:'PONG',requestId,version:response.version},origin);
  }catch{/* Una extensión recargada requiere actualizar también esta pestaña. */}
 });
 document.addEventListener('click',async event=>{
  if(!event.isTrusted||opening||!(event.target instanceof Element)||!event.target.closest('button[data-trello-focus-open]'))return;
  opening=true;
  try{
   const result=await chrome.runtime.sendMessage({type:'SITE_OPEN'});
   window.postMessage({channel,type:'OPEN_RESULT',ok:result?.opened===true},origin);
  }catch{window.postMessage({channel,type:'OPEN_RESULT',ok:false},origin);}
  finally{opening=false;}
 });
}

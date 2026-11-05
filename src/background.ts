import {createEngine} from './engine';
import {cardPanelState} from './model';
const engine=createEngine(chrome);
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 const content=!!sender.url?.startsWith('https://trello.com/');
 if(!content&&!sender.url?.startsWith(chrome.runtime.getURL('')))return;
 (async()=>{
  if(content&&['OPEN_CARD','ADD','START','CARD_STATE','PAUSE','RESUME','FINISH','CANCEL'].includes(message.type)){
   // Trello cambia la ruta con navegación interna; sender.url puede conservar la ruta inicial.
   if(sender.tab?.id===undefined)throw Error('No se pudo identificar la pestaña de Trello.');
   const currentTab=await chrome.tabs.get(sender.tab.id);
   const currentUrl=new URL(currentTab.url??'https://trello.com/');
   if(currentUrl.origin!=='https://trello.com'||message.cardId!==currentUrl.pathname.match(/^\/c\/([^/]+)/)?.[1])throw Error('La tarjeta cambió. Esperá un momento o volvé a abrirla.');
  }
  const data=await engine.dispatch(message,content);return content?cardPanelState(await engine.dispatch({type:'STATE'}),message.cardId):data;})().then(data=>respond({data}),error=>respond({error:error.message??'No se pudo completar la acción.'}));return true;
});
chrome.alarms.onAlarm.addListener(()=>{void engine.tick();});
chrome.runtime.onStartup.addListener(()=>{void engine.startup();});
void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
void engine.tick();

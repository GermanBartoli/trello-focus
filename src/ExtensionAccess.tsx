import {useEffect,useRef,useState,type ReactNode} from 'react';
const channel='trello-focus-extension-v1';
export function useExtensionPresence(enabled:boolean){
 const [version,setVersion]=useState('');
 const [checking,setChecking]=useState(enabled);
 const [opening,setOpening]=useState(false);
 const [message,setMessage]=useState('');
 const pending=useRef('');
 const detectionTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const openingTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 function check(){
  clearTimeout(detectionTimer.current);setChecking(true);setVersion('');setMessage('');
  pending.current=crypto.randomUUID();
  window.postMessage({channel,type:'PING',requestId:pending.current},location.origin);
  detectionTimer.current=setTimeout(()=>setChecking(false),2000);
 }
 useEffect(()=>{
  if(!enabled)return;
  const receive=(event:MessageEvent)=>{
   if(event.source!==window||event.origin!==location.origin||event.data?.channel!==channel)return;
   if(event.data.type==='PONG'&&event.data.requestId===pending.current&&typeof event.data.version==='string'&&/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(event.data.version)){
    clearTimeout(detectionTimer.current);setVersion(event.data.version);setChecking(false);
   }
   if(event.data.type==='OPEN_RESULT'){
    clearTimeout(openingTimer.current);setOpening(false);
    setMessage(event.data.ok===true?'Panel de la extensión abierto en otra pestaña.':'No se pudo abrir la extensión. Recargá esta página y volvé a comprobar.');
   }
  };
  window.addEventListener('message',receive);check();
  return()=>{window.removeEventListener('message',receive);clearTimeout(detectionTimer.current);clearTimeout(openingTimer.current);};
 },[enabled]);
 function startOpening(){
  setOpening(true);setMessage('');clearTimeout(openingTimer.current);
  openingTimer.current=setTimeout(()=>{setOpening(false);setVersion('');setMessage('La extensión no respondió. Recargá esta página después de actualizarla.');},4000);
 }
 return {version,checking,opening,message,check,startOpening};
}
export type ExtensionPresence=ReturnType<typeof useExtensionPresence>;
export function ExtensionAccess({presence}:{presence:ExtensionPresence}){
 return <section className="notice" aria-label="Acceso a la extensión">
  <strong role="status">{presence.checking?'Comprobando la extensión…':presence.version?`✓ Extensión detectada · v${presence.version}`:'No se pudo detectar una extensión compatible'}</strong>
  <p>{presence.version?'Podés usar tu cuenta y tu historial desde la extensión. No necesitás ingresar credenciales en esta web.':'Si ya la tenés, podés seguir usándola desde su icono. Para detectarla acá, actualizala a la versión 1.1.0 o posterior, pulsá Recargar en Chrome y recargá esta página en el mismo perfil.'}</p>
  <div className="actions">{presence.version&&<button type="button" className="primary" data-trello-focus-open disabled={presence.opening} onClick={presence.startOpening}>{presence.opening?'Abriendo…':'Abrir mi extensión ↗'}</button>}<button type="button" disabled={presence.checking||presence.opening} onClick={presence.check}>Volver a comprobar</button></div>
  <p>La conexión que muestra la barra lateral corresponde únicamente a la web. Credenciales e historial siguen separados.</p>
  {presence.message&&<p role="status">{presence.message}</p>}
 </section>;
}

export function ConnectionSettings({extension,detected,children}:{extension:boolean;detected:boolean;children:ReactNode}){
 return extension?<>{children}</>:<details open={!detected}><summary>Conectar la web por separado (opcional)</summary>{children}</details>;
}

import {remaining,format,type Session} from './model';
type PanelState={minutes:number;connected:boolean;active:boolean;sameCard:boolean;session?:Session;otherCard?:string;error?:string;syncDiscarded?:boolean;total:number};
let current='';let host:HTMLIFrameElement|undefined;let cleanup=()=>{};
function mount(){
 const id=location.pathname.match(/^\/c\/([a-zA-Z0-9]+)/)?.[1]??'';
 const dialog=document.querySelector<HTMLElement>('#overlay-contents[role=dialog]');
 if(!dialog||!id){cleanup();host?.remove();current='';return;}
 if(id===current&&host?.isConnected&&dialog.contains(host))return;
 cleanup();current=id;host?.remove();
 // El documento separado evita que los atajos globales de Trello reciban las teclas del formulario.
 const frame=document.createElement('iframe');host=frame;frame.id='trello-focus-panel';frame.title='Trello Focus';
 frame.style.cssText='position:fixed;right:24px;bottom:24px;width:310px;height:500px;border:0;z-index:2147483646;background:transparent;color-scheme:normal';
 dialog.append(frame);
 const doc=frame.contentDocument!;doc.body.style.cssText='margin:0;background:transparent';
 const panel=doc.createElement('div');doc.body.append(panel);const root=panel.attachShadow({mode:'closed'});
 root.innerHTML=`<style>:host{display:block;font-family:system-ui;color:#edf4f2}section{width:270px;background:#14251f;border:1px solid #436358;border-radius:18px;box-shadow:0 12px 40px #0006;padding:18px}header{display:flex;justify-content:space-between;align-items:center}h3{margin:0;font-size:17px}p{font-size:12px;color:#b9c9c2}button,input,textarea{font:inherit;border-radius:8px;border:1px solid #547569;padding:9px;background:#233c32;color:#fff}button{cursor:pointer}button:disabled{opacity:.5}button.primary{background:#9de6ba;color:#14251f;font-weight:700;width:100%;margin:10px 0}input{width:58px}textarea{box-sizing:border-box;width:100%;resize:vertical;margin-top:6px;font-size:12px}label{font-size:12px}form{display:flex;gap:8px;align-items:end}small{display:block;margin-top:9px;line-height:1.4}#close{border:0;padding:3px 7px}#clock{font-size:32px;font-variant-numeric:tabular-nums;margin:12px 0}#controls{display:flex;gap:6px;flex-wrap:wrap}[hidden]{display:none!important}#warning{color:#ffd49c}</style><section><header><h3>◷ Trello Focus</h3><button id="close" title="Ocultar panel">×</button></header><p id="summary">Consultando sesión…</p><div id="clock" hidden></div><button class="primary" id="start">Iniciar sesión</button><div id="controls" hidden><button id="pause">Pausar</button><button id="finish">Terminar y guardar</button><button id="cancel">Descartar</button></div><p id="total"></p><label>Mensaje opcional de sesión o carga<textarea id="note" maxlength="200" rows="2" placeholder="¿En qué trabajaste?"></textarea></label><form><label>Horas<br><input name="hours" type="number" min="0" max="24" value="0"></label><label>Minutos<br><input name="minutes" type="number" min="0" max="59" value="15"></label><button>Sumar</button></form><p><button id="history">Ver historial de esta tarjeta ↗</button></p><p><button id="open">Abrir panel y configuración ↗</button></p><small id="status" role="status"></small><small id="warning"></small></section>`;
 const size=new ResizeObserver(()=>{frame.style.height=root.querySelector('section')!.getBoundingClientRect().height+'px';});size.observe(root.querySelector('section')!);
 for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','touchstart','touchend','keydown','keyup','submit'])root.addEventListener(event,e=>e.stopPropagation());
 const get=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
 let data:PanelState|undefined;let busy=false;let polling=false;let alive=true;
 function render(){
  if(!data){root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=!['open','history','close'].includes(b.id));return;}
  const s=data.session;const own=data.sameCard&&!!s;
  get('#summary').textContent=own?(s.review?'Sesión pendiente de confirmar':s.end?'Sesión en curso':'Sesión en pausa'):data.otherCard?`Sesión activa en otra tarjeta: ${data.otherCard}`:'Un momento de foco para esta tarjeta.';
  const clock=get('#clock');clock.hidden=!own;
  if(s){const seconds=remaining(s);clock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  const start=get<HTMLButtonElement>('#start');start.hidden=own;start.textContent=`Iniciar sesión de ${data.minutes} min`;
  get('#controls').hidden=!own;
  get('#pause').hidden=!!s?.review;get('#pause').textContent=s?.end?'Pausar':'Continuar';
  get('#finish').textContent=s?.review?'Confirmar tiempo':'Terminar y guardar';
  get('#total').textContent=`Tiempo registrado: ${format(data.total)}`;
  get('#warning').textContent=data.syncDiscarded?'Sincronización descartada. El tiempo permanece guardado localmente.':data.error?`Sincronización pendiente en esta tarjeta: ${data.error}`:'';
  root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=busy);
  start.disabled=busy||data.active||!data.connected;
  if(!data.connected)get('#status').textContent='Abrí el panel para conectar tu cuenta de Trello.';
 }
 async function send(message:object){const result=await Promise.race([chrome.runtime.sendMessage(message),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('La extensión no respondió a tiempo. Esperá antes de repetir la acción.')),25000))]);if(result.error)throw Error(result.error);return result.data as PanelState;}
 async function poll(){if(polling||busy||!alive)return;polling=true;try{const next=await send({type:'CARD_STATE',cardId:id});if(alive){data=next;if(get('#summary').textContent==='No se pudo consultar la sesión')get('#status').textContent='';render();}}catch(e){if(alive){get('#summary').textContent='No se pudo consultar la sesión';get('#status').textContent=e instanceof Error?e.message:'Recargá Trello para reconectar la extensión.';}}finally{polling=false;}}
 async function act(type:string,fields:object={}){
  if(busy)return;busy=true;get('#status').textContent='Procesando…';render();
  try{data=await send({type,cardId:id,...fields});get('#status').textContent=type==='START'?'Sesión iniciada. El tiempo se suma al terminar.':type==='PAUSE'?'Sesión pausada.':type==='RESUME'?'Sesión reanudada.':type==='CANCEL'?'Sesión descartada.':data.error||data.syncDiscarded?'Tiempo guardado localmente.':'Registro sincronizado con Trello.';}
  catch(e){get('#status').textContent=e instanceof Error?e.message:'No se pudo completar.';}
  finally{busy=false;render();}
 }
 get('#start').addEventListener('click',()=>void act('START',{note:get<HTMLTextAreaElement>('#note').value}));
 get('#pause').addEventListener('click',()=>void act(data?.session?.end?'PAUSE':'RESUME'));
 get('#finish').addEventListener('click',()=>void act('FINISH'));
 get('#cancel').addEventListener('click',()=>{if(confirm('¿Descartar esta sesión sin sumar tiempo?'))void act('CANCEL');});
 get<HTMLFormElement>('form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;const seconds=(Number((form.elements.namedItem('hours') as HTMLInputElement).value)*60+Number((form.elements.namedItem('minutes') as HTMLInputElement).value))*60;void act('ADD',{seconds,id:crypto.randomUUID(),note:get<HTMLTextAreaElement>('#note').value});});
 get('#history').addEventListener('click',()=>void send({type:'OPEN_CARD',cardId:id}).catch(e=>{get('#status').textContent=e.message;}));
 get('#open').addEventListener('click',()=>void send({type:'OPEN'}).catch(e=>{get('#status').textContent=e.message;}));
 get('#close').addEventListener('click',()=>{frame.style.display='none';});
 const ticker=setInterval(render,1000);const refresh=setInterval(()=>void poll(),3000);
 cleanup=()=>{size.disconnect();alive=false;clearInterval(ticker);clearInterval(refresh);};render();void poll();
}
setInterval(mount,1000);mount();

let current='';let host:HTMLDivElement|undefined;
function mount(){
 const id=location.pathname.match(/^\/c\/([a-zA-Z0-9]+)/)?.[1]??'';
 const dialog=document.querySelector<HTMLElement>('#overlay-contents[role=dialog]');
 if(!dialog){host?.remove();current='';return;}
 if(id===current&&(!id||(host?.isConnected&&dialog.contains(host))))return;
 current=id;host?.remove();if(!id)return;
 host=document.createElement('div');host.id='trello-focus-panel';const root=host.attachShadow({mode:'closed'});
 root.innerHTML=`<style>:host{position:fixed;right:24px;bottom:24px;z-index:2147483646;font-family:system-ui;color:#edf4f2}section{width:270px;background:#14251f;border:1px solid #436358;border-radius:18px;box-shadow:0 12px 40px #0006;padding:18px}header{display:flex;justify-content:space-between;align-items:center}h3{margin:0;font-size:17px}p{font-size:12px;color:#b9c9c2}button,input{font:inherit;border-radius:8px;border:1px solid #547569;padding:9px;background:#233c32;color:#fff}button{cursor:pointer}button:disabled{opacity:.5}button.primary{background:#9de6ba;color:#14251f;font-weight:700;width:100%;margin:10px 0}input{width:58px}label{font-size:12px}form{display:flex;gap:8px;align-items:end}small{display:block;margin-top:9px;line-height:1.4}a{color:#b7f8ce}#close{border:0;padding:3px 7px}</style><section><header><h3>◷ Trello Focus</h3><button id="close" title="Ocultar panel">×</button></header><p>Un momento de foco para esta tarjeta.</p><button class="primary" id="start">Iniciar sesión de 25 min</button><form><label>Horas<br><input name="hours" type="number" min="0" max="24" value="0"></label><label>Minutos<br><input name="minutes" type="number" min="0" max="59" value="15"></label><button>Sumar</button></form><p><button id="open">Abrir panel y configuración ↗</button></p><small role="status"></small></section>`;
 // El panel pertenece al diálogo: los detectores de clic exterior en captura lo reconocen.
 dialog.append(host);
 // Aislamos la propagación sin cancelar la edición, el foco ni el envío del formulario.
 for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','touchstart','touchend','keydown','keyup','submit']){
  root.addEventListener(event,e=>e.stopPropagation());
 }
 const status=root.querySelector('small')!;
 async function send(message:object){return chrome.runtime.sendMessage(message);}
 async function act(message:object){const buttons=root.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{const result=await send(message);if(result.error)throw Error(result.error);const errors=Object.values(result.data?.ledgers??{}).some((l:any)=>l.error);status.textContent=errors?'Guardado local. Sincronización pendiente: revisá el panel.':'Listo. Podés ver el registro en el panel.';}catch(e){status.textContent=e instanceof Error?e.message:'No se pudo completar.';}finally{buttons.forEach(b=>b.disabled=false);}}
 root.querySelector('#start')!.addEventListener('click',()=>void act({type:'START',cardId:id}));
 root.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;const seconds=(Number((form.elements.namedItem('hours') as HTMLInputElement).value)*60+Number((form.elements.namedItem('minutes') as HTMLInputElement).value))*60;void act({type:'ADD',cardId:id,seconds,id:crypto.randomUUID()});});
 root.querySelector('#open')!.addEventListener('click',()=>void send({type:'OPEN'}));root.querySelector('#close')!.addEventListener('click',()=>{host!.style.display='none';});
 void send({type:'CARD_STATE',cardId:id}).then(r=>{if(r.data){root.querySelector('#start')!.textContent=`Iniciar sesión de ${r.data.minutes} min`;if(!r.data.connected)status.textContent='Abrí el panel para conectar tu cuenta de Trello.';}}).catch(()=>{});
}
setInterval(mount,1000);mount();

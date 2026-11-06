import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync('dist/siteBridge.js','utf8');
const origin='https://trello-focus.pages.dev',channel='trello-focus-extension-v1';
function harness(url=origin,frame=false){
 const listeners:Record<string,Function>={},posted:any[]=[],sent:any[]=[];
 class Element{closest(selector:string){return selector==='button[data-trello-focus-open]'?this:null;}}
 const page:any={addEventListener:(type:string,fn:Function)=>listeners[type]=fn,postMessage:(data:any,target:string)=>posted.push({data,target})};page.top=frame?{}:page;
 const context={window:page,document:{addEventListener:(type:string,fn:Function)=>listeners[type]=fn},location:{origin:url},Element,chrome:{runtime:{sendMessage:async(message:any)=>{sent.push(message);return message.type==='SITE_PING'?{version:'1.1.0',credentials:'NO COMPARTIR'}:{opened:true};}}}};
 runInNewContext(code,context);return {listeners,posted,sent,page,Element};
}
test('El puente solo anuncia la versión, valida origen y requiere un clic real para abrir',async()=>{
 const h=harness();const request={source:h.page,origin,data:{channel,type:'PING',requestId:'prueba'}};
 for(const invalid of [{...request,origin:'https://otro.example'},{...request,source:{}},{...request,data:{...request.data,type:'STATE'}}])await h.listeners.message(invalid);
 assert.equal(h.sent.length,0);
 await h.listeners.message(request);
 assert.deepEqual(JSON.parse(JSON.stringify(h.posted)),[{data:{channel,type:'PONG',requestId:'prueba',version:'1.1.0'},target:origin}]);
 await h.listeners.click({isTrusted:false,target:new h.Element()});assert.equal(h.sent.length,1);
 await h.listeners.click({isTrusted:true,target:new h.Element()});assert.equal(h.sent[1].type,'SITE_OPEN');assert.equal(h.posted.at(-1).data.ok,true);
 assert.equal(JSON.stringify(h.posted).includes('NO COMPARTIR'),false);
});
test('El puente permanece inactivo en otros sitios y marcos',()=>{
 assert.equal(Object.keys(harness('https://otro.example').listeners).length,0);
 assert.equal(Object.keys(harness(origin,true).listeners).length,0);
});

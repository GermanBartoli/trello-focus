import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';
import {execFileSync} from 'node:child_process';
// Publicación estática mediante la API oficial; las credenciales llegan por el entorno.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Faltan los secretos de publicación de Cloudflare.');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/trello-focus`;
async function api(url,options={}){
 const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
 const data=await response.json();if(!response.ok||!data.success)throw Error(`Cloudflare ${response.status}: ${JSON.stringify(data.errors)}`);return data.result;
}
const {jwt}=await api(base+'/upload-token');const manifest={},assets=[];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
for(const entry of await readdir('dist-web',{recursive:true,withFileTypes:true})){
 if(!entry.isFile()||entry.name==='_headers')continue;
 const path=entry.parentPath+'/'+entry.name;const relative=path.replaceAll('\\','/').replace(/^dist-web\//,'');
 const bytes=await readFile(path),key=createHash('sha256').update(bytes).update(extname(path)).digest('hex').slice(0,32);
 manifest['/'+relative]=key;assets.push({key,value:bytes.toString('base64'),base64:true,metadata:{contentType:types[extname(path)]??'application/octet-stream'}});
}
for(let offset=0;offset<assets.length;offset+=10)await api('https://api.cloudflare.com/client/v4/pages/assets/upload',{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:JSON.stringify(assets.slice(offset,offset+10))});
const form=new FormData();form.set('manifest',JSON.stringify(manifest));form.set('branch','main');form.set('commit_hash',process.env.GITHUB_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());form.set('commit_dirty','false');form.set('_headers',new Blob([await readFile('dist-web/_headers')],{type:'text/plain'}),'_headers');
const deployment=await api(base+'/deployments',{method:'POST',body:form});console.log(`Publicación creada: ${deployment.id} ${deployment.url}`);
for(let attempt=0;attempt<30;attempt++){
 const current=await api(base+'/deployments/'+deployment.id),stage=current.latest_stage;
 if(stage.name==='deploy'&&stage.status==='success'){console.log('Publicación confirmada: https://trello-focus.pages.dev');process.exit(0);}
 if(stage.status==='failure')throw Error('Falló la publicación: '+JSON.stringify(stage));
 await new Promise(resolve=>setTimeout(resolve,2000));
}
throw Error('No se confirmó el despliegue en el tiempo esperado.');

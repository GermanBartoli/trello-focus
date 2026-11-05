import type {Card,State} from './model';
export type BoardOptions={lists:{id:string;name:string;closed?:boolean}[];members:{id:string;fullName:string}[];labels:{id:string;name:string;color?:string}[]};
export type Attachment={id:string;name:string;url:string;mimeType?:string;isUpload?:boolean};
export type CardComment={id:string;idMemberCreator:string;date:string;data:{text:string};memberCreator?:{fullName:string}};
export type CardDetails={card:Card&{desc?:string;cover?:{color?:string;idAttachment?:string}};members:{id:string;fullName:string}[];comments:CardComment[];attachments:Attachment[];stickers:{id:string;image:string}[];customStickers:{id:string;url:string}[];lists:{id:string;name:string}[]};
type Api=(path:string,method?:string,body?:object)=>Promise<any>;
export const CARD_TOOLS=['BOARD_OPTIONS','CARD_CREATE','CARD_DETAILS','CARD_UPDATE','CARD_COMMENT','CARD_COMMENT_EDIT','CARD_ATTACHMENT','CARD_STICKER','CARD_STICKER_REMOVE'];
export const COVER_COLORS=['green','pink','red','purple','yellow','lime','blue','black','orange','sky'];
const id=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9]{8,24}$/.test(value))throw Error('Identificador de Trello inválido.');return value;};
export function textValue(value:unknown,max=16000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Escribí entre 1 y ${max} caracteres.`);return value.trim();}
export function httpUrl(value:unknown){const u=new URL(String(value));if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Usá un enlace HTTP o HTTPS válido.');return u.href;}
export async function cardTools(message:any,state:State,api:Api,save:(s:State)=>Promise<unknown>){
 if(message.type==='BOARD_OPTIONS'){
  const board=id(message.boardId);const [lists,members,labels]=await Promise.all([api(`boards/${board}/lists?filter=open&fields=id,name,closed`),api(`boards/${board}/members?fields=id,fullName`),api(`boards/${board}/labels?limit=1000&fields=id,name,color`)]);return {lists,members,labels};
 }
 if(message.type==='CARD_CREATE'){
  const board=id(message.boardId),list=id(message.listId);const name=textValue(message.name,16384);const desc=String(message.desc??'');if(desc.length>16384)throw Error('Descripción demasiado larga.');
  const actual=await api(`lists/${list}?fields=idBoard,closed`);if(actual.idBoard!==board||actual.closed)throw Error('La lista no pertenece al tablero elegido o está archivada.');
  const ids=(values:unknown)=>{if(!Array.isArray(values)||values.length>100)throw Error('Selección inválida.');return values.map(id);};
  const members=ids(message.members??[]),labels=ids(message.labels??[]);
  const [allowedMembers,allowedLabels]=await Promise.all([api(`boards/${board}/members?fields=id`),api(`boards/${board}/labels?limit=1000&fields=id`)]);
  if(members.some(m=>!allowedMembers.some((a:any)=>a.id===m))||labels.some(l=>!allowedLabels.some((a:any)=>a.id===l)))throw Error('Hay miembros o etiquetas que no pertenecen al tablero.');
  const due=message.due?new Date(message.due):null;if(due&&!Number.isFinite(due.getTime()))throw Error('Vencimiento inválido.');
  const card=await api('cards','POST',{name,desc,idList:list,idMembers:members,idLabels:labels,due:due?.toISOString()??null,pos:'bottom'});
  state.cards=state.cards.filter(c=>c.id!==card.id).concat(card);await save(state);return card;
 }
 const cardId=id(message.cardId),path=`cards/${cardId}`;
 if(message.type==='CARD_DETAILS'){
  const card=await api(`${path}?fields=id,name,url,desc,idBoard,idList,idMembers,idLabels,labels,due,dueComplete,closed,cover`);
  const [members,comments,attachments,stickers,customStickers,lists]=await Promise.all([api(`boards/${id(card.idBoard)}/members?fields=id,fullName`),api(`${path}/actions?filter=commentCard&limit=1000`),api(`${path}/attachments`),api(`${path}/stickers`),api('members/me/customStickers').catch(()=>[]),api(`boards/${id(card.idBoard)}/lists?filter=open&fields=id,name`)]);
  state.cards=state.cards.filter(c=>c.id!==card.id).concat(card);await save(state);
  return {card,members,comments,attachments,stickers,customStickers,lists};
 }
 if(message.type==='CARD_UPDATE'){
  const patch:Record<string,unknown>={};
  if(message.name!==undefined)patch.name=textValue(message.name,16384);
  if(message.desc!==undefined){if(typeof message.desc!=='string'||message.desc.length>16384)throw Error('Descripción demasiado larga.');patch.desc=message.desc;}
  if(message.idList!==undefined)patch.idList=id(message.idList);
  if(message.memberId!==undefined){const member=id(message.memberId);await api(`${path}/idMembers${message.add?'':'/'+member}`,message.add?'POST':'DELETE',message.add?{value:member}:undefined);return {};}
  if(message.color!==undefined){if(!COVER_COLORS.includes(message.color))throw Error('Color no admitido por Trello.');patch.cover={color:message.color,size:'normal',brightness:'light'};}
  if(message.coverAttachment!==undefined)patch.cover={idAttachment:id(message.coverAttachment),size:'normal',brightness:'light'};
  if(!Object.keys(patch).length)throw Error('No hay cambios para guardar.');
  const card=await api(path,'PUT',patch);state.cards=state.cards.map(c=>c.id===card.id?{...c,...card}:c);await save(state);return card;
 }
 if(message.type==='CARD_COMMENT')return api(`${path}/actions/comments`,'POST',{text:textValue(message.text)});
 if(message.type==='CARD_COMMENT_EDIT'){
  const commentId=id(message.commentId);const current=await api(`actions/${commentId}`);
  if(current.idMemberCreator!==state.member?.id||current.data.card?.id!==cardId)throw Error('Solo podés editar tus comentarios de esta tarjeta.');
  if(current.data.text.includes(`TF:v1:`))throw Error('Este comentario se edita desde el registro de Trello Focus.');
  return api(`${path}/actions/${commentId}/comments`,'PUT',{text:textValue(message.text)});
 }
 if(message.type==='CARD_ATTACHMENT'){
  if(message.url)return api(`${path}/attachments`,'POST',{url:httpUrl(message.url),name:textValue(message.name||message.url,256),setCover:false});
  if(typeof message.base64!=='string'||message.base64.length>14000000)throw Error('El archivo admite hasta 10 MB en esta versión.');
  const bytes=Uint8Array.from(atob(message.base64),c=>c.charCodeAt(0));if(bytes.length>10*1024*1024)throw Error('El archivo supera 10 MB.');
  const form=new FormData();form.append('file',new Blob([bytes],{type:String(message.mimeType||'application/octet-stream')}),textValue(message.name,256));form.append('setCover','false');return api(`${path}/attachments`,'POST',form);
 }
 if(message.type==='CARD_STICKER'){
  const image=textValue(message.image,100);if(!/^[a-zA-Z0-9-]+$/.test(image))throw Error('Sticker inválido.');
  return api(`${path}/stickers`,'POST',{image,top:10,left:10,zIndex:1,rotate:0});
 }
 if(message.type==='CARD_STICKER_REMOVE')return api(`${path}/stickers/${id(message.stickerId)}`,'DELETE');
 throw Error('Operación no permitida.');
}

import {initial,type State} from './model';
export const extension=typeof chrome!=='undefined'&&!!chrome.runtime?.id;
export async function send(type:string,fields:object={}):Promise<State>{
 if(!extension){if(type==='STATE')return initial();throw Error('Esta es la vista previa. Instalá la extensión en Chrome para conectar Trello.');}
 const response=await chrome.runtime.sendMessage({type,...fields});if(response?.error)throw Error(response.error);return response?.data;
}

export async function request<T>(type:string,fields:object={}):Promise<T>{if(!extension)throw Error('Instalá la extensión para usar Trello.');const result=await chrome.runtime.sendMessage({type,...fields});if(result?.error)throw Error(result.error);return result?.data as T;}

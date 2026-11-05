import type {CardCover as Cover} from './model';
const colors:Record<string,{color:string;name:string}>={red:{color:'#f87168',name:'Rojo · prioridad alta'},pink:{color:'#e774bb',name:'Rosa · prioridad media'},green:{color:'#4bce97',name:'Verde · prioridad normal'},purple:{color:'#9f8fef',name:'Violeta'},yellow:{color:'#f5cd47',name:'Amarillo'},lime:{color:'#94c748',name:'Lima'},blue:{color:'#579dff',name:'Azul'},black:{color:'#596773',name:'Negro'},orange:{color:'#fea362',name:'Naranja'},sky:{color:'#6cc3e0',name:'Celeste'}};
export function CardCover({cover}:{cover?:Cover}){
 if(!cover)return null;const color=cover.color?colors[cover.color]:undefined;
 if(color)return <div className="card-mini-cover" style={{backgroundColor:color.color}} role="img" aria-label={'Portada '+color.name} title={color.name}/>;
 const image=cover.scaled?.find(i=>i.width>=400)??cover.scaled?.at(-1);if(!image||!/^https:\/\//i.test(image.url))return null;
 return <div className="card-mini-cover"><img src={image.url} alt="Portada de la tarjeta" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.visibility='hidden';}}/></div>;
}

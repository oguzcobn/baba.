import { drawEffects } from "./effects.js";
const instances = new WeakMap();
const coast="M10 135 Q80 62 175 108 T310 106 Q441 66 561 87 T781 108 Q916 105 1065 138 L1073 403 Q1036 505 950 573 L839 607 741 564 666 541 555 611 432 592 315 551 209 511 95 481 11 409Z";
const point=p=>[p.x*10.5,p.y*5.7+25];

function element(parent,tag,attrs={}){
  const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
  parent.append(node);
  return node;
}
function set(node,key,value){
  if(node.getAttribute(key)!==value)node.setAttribute(key,value);
}

function mount(svg,{state,shapeData,polygon,links,seaRoutes}){
  const shapes=new Map(),icons=new Map(),routes=[];
  const nodes=new Map(state.p.map(p=>[p.id,p]));
  element(svg,"rect",{width:1080,height:650,fill:"#29475a"});
  const ground=element(svg,"g");
  if(!shapeData){
    const clip=element(element(svg,"defs"),"clipPath",{id:"anatolia-clip"});
    element(clip,"path",{d:coast});
    ground.setAttribute("clip-path","url(#anatolia-clip)");
  }
  for(const p of state.p){
    const shape=shapeData?element(ground,"path",{d:shapeData.get(p.id).paths,"fill-rule":"evenodd"}):element(ground,"polygon",{points:polygon(p)});
    shape.dataset.p=p.id;
    shape.setAttribute("role","button");
    shapes.set(p.id,{shape,title:element(shape,"title")});
  }
  const network=element(ground,"g",{"pointer-events":"none"});
  for(const [from,to] of links){
    if(shapeData&&!seaRoutes.has([from,to].sort().join("|")))continue;
    const [x1,y1]=point(nodes.get(from)),[x2,y2]=point(nodes.get(to));
    if(shapeData&&Math.hypot(x2-x1,y2-y1)>230)continue;
    const line=element(network,"line",{x1,y1,x2,y2,stroke:"#d8d3b0","stroke-opacity":shapeData?".8":".3","stroke-dasharray":"4 5"});
    if(shapeData)routes.push({line,from,to});
  }
  if(!shapeData)element(svg,"path",{d:coast,fill:"none",stroke:"#d5c393","pointer-events":"none"});
  return {shapes,icons,routes,overlay:element(svg,"g",{"pointer-events":"none"})};
}
export function updateAtlas(options){
  const svg=document.getElementById("world");
  const {state,selected,shapeData,moving,adj,color,modelSvg,markerSvg,marching,actionFx,capturedProvince}=options;
  let atlas=instances.get(svg);
  if(!atlas){atlas=mount(svg,options);instances.set(svg,atlas);}
  const contested=new Set((state.theatre?.fronts||[]).map(b=>b.to));
  const targets=new Set(moving?adj(moving):[]);
  for(const p of state.p){
    const {shape,title}=atlas.shapes.get(p.id);
    const label=p.label+" · "+p.army+" asker";
    if(title.textContent!==label)title.textContent=label;
    set(shape,"aria-label",label);
    set(shape,"tabindex",p.id===selected?"0":"-1");
    set(shape,"fill",color(p));
    set(shape,"class",["province",contested.has(p.id)?"contested":"",p.occupation?"occupied":"",p.id===selected?"active":"",targets.has(p.id)?"target":"",p.id===capturedProvince?"captured":""].filter(Boolean).join(" "));
    let icon=atlas.icons.get(p.id);
    if(shapeData&&p.owner!==state.me&&p.id!==selected){
      if(icon){icon.remove();atlas.icons.delete(p.id);}
      continue;
    }
    if(!icon){icon=element(atlas.overlay,"g");atlas.icons.set(p.id,icon);}
    const signature=[options.era,p.formations?.length,p.army,p.unitType,p.barracks,p.investment,p.market,p.farm,p.fort,p.festivals,actionFx?.id===p.id?actionFx.token:0].join("|");
    if(icon.dataset.signature!==signature){icon.innerHTML=markerSvg(p)+modelSvg(p);icon.dataset.signature=signature;}
  }
  for(const {line,from,to} of atlas.routes)set(line,"display",selected===from||selected===to?"inline":"none");
  if(marching){
    const from=state.p.find(p=>p.id===marching.from),to=state.p.find(p=>p.id===marching.to);
    if(from&&to)drawEffects(svg,point(from),point(to),marching);
  }
}

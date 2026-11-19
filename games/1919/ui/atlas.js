"use strict";
const AtlasView=(()=>{
 let regions=new Map(),session=null,frame=0,currentMarch=null,collapsed=false;
 function update(root,html,state,dynamic){
   const shell=document.createElement("template");
   const fresh=session!==state||!root.querySelector("#world");
   shell.innerHTML=html;
   if(fresh){
     root.replaceChildren(shell.content);session=state;collapsed=false;
     root.querySelector("#viewport").insertAdjacentHTML("afterbegin",mapSVG());
     regions=new Map([...root.querySelectorAll("#world [data-p]")].map(el=>[el.dataset.p,el]));
     for(const el of regions.values()){el.setAttribute("tabindex","0");el.setAttribute("role","button");}
   }else{
     for(const selector of [".resources",".bottom",".tabs",".sidebody",".maptip"]){
       const old=root.querySelector(selector),next=shell.content.querySelector(selector);
       if(old.innerHTML!==next.innerHTML)old.replaceChildren(...next.childNodes);
     }
     for(const el of root.querySelectorAll("[data-layer]"))el.classList.toggle("selected",el.dataset.layer===layer);
     const targets=new Set(moving?adj(moving):[]);
     for(const p of state.p){
       const el=regions.get(p.id);if(!el)continue;
       el.classList.toggle("active",p.id===sel);el.classList.toggle("target",targets.has(p.id));el.classList.toggle("captured",capturedProvince===p.id);
       const fill=color(p);if(el.getAttribute("fill")!==fill)el.setAttribute("fill",fill);
       const title=p.label+" · "+name(p.owner)+" · "+p.army+" asker";
       if(el.firstElementChild?.textContent!==title)el.firstElementChild.textContent=title;
     }
     const layers=dynamic();for(const [id,markup] of Object.entries(layers)){
       const group=root.querySelector("#"+id);if(group&&group._markup!==markup){group.innerHTML=markup;group._markup=markup;}
     }
   }
   const layout=root.querySelector(".layout"),toggle=root.querySelector("[data-drawer]");
   const apply=()=>{layout.classList.toggle("atlas-folded",collapsed);toggle.setAttribute("aria-expanded",String(!collapsed));toggle.textContent=collapsed?"Paneli aç":"Paneli kapat";};
   toggle.onclick=()=>{collapsed=!collapsed;apply();};apply();
   const canvas=root.querySelector(".atlas-effects");if(currentMarch!==marching||fresh){
     cancelAnimationFrame(frame);currentMarch=marching;
     const ctx=canvas.getContext("2d");if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);
     if(!marching)return;
     const a=prov(marching.from),b=prov(marching.to),start=performance.now();
     const paint=now=>{
       if(!canvas.isConnected||currentMarch!==marching)return;
       const svg=root.querySelector("#world"),matrix=svg.getScreenCTM();if(!matrix)return;
       const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1);
       canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
       ctx.scale(ratio,ratio);const point=p=>new DOMPoint(p.x*10.5,p.y*5.7+25).matrixTransform(matrix);
       const from=point(a),to=point(b),t=matchMedia("(prefers-reduced-motion: reduce)").matches?1:Math.min(1,(now-start)/1150);
       ctx.translate(-rect.left,-rect.top);ctx.strokeStyle="#ebc97b";ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
       ctx.fillStyle="#f3d18b";ctx.beginPath();ctx.arc(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,6,0,Math.PI*2);ctx.fill();
       if(t<1)frame=requestAnimationFrame(paint);
     };frame=requestAnimationFrame(paint);
   }
 }
 return {update};
})();

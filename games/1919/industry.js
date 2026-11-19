"use strict";
const Industry1919=(()=>{
 const types={civil:["Sivil fabrika",90,6],arms:["Askerî fabrika",120,9],refinery:["Rafineri",100,6],depot:["İkmal merkezi",75,4]};
 function stock(s){return s.materials??={steel:15,fuel:12};}
 function panel(s,p){
   if(!p||p.owner!==s.me)return "";
   const active=p.construction;
   return '<details class="panel"><summary>Sanayi ve inşaat</summary><p>Üç tesis alanı · '+(p.plants?.length||0)+' tamamlandı</p>'+
   (active?'<p>'+types[active.type][0]+' · '+active.left+' ay kaldı</p>':Object.entries(types).map(([key,[name,cost,months]])=>'<button data-a="build-'+key+'">'+name+' · '+cost+' altın · '+months+' ay</button>').join(""))+'</details>';
 }
 function build(s,p,type){
   if(!types[type]||p?.owner!==s.me)return "Kendi eyaletini seç.";
   if(p.construction||(p.plants?.length||0)>=3)return "Bu eyalette boş inşaat alanı yok.";
   const [,cost,left]=types[type];if(s.gold<cost)return "Altın yetersiz.";
   s.gold-=cost;p.construction={type,left,owner:s.me};return "";
 }
 function step(s,months){
   const materials=stock(s);
   for(const p of s.p){
     if(p.construction&&p.construction.owner!==p.owner)delete p.construction;
     if(p.owner!==s.me)continue;
     for(let m=0;m<months;m++){
       for(const k of p.plants||[]){
         if(k==="civil")s.gold+=2;
         if(k==="arms")materials.steel+=2;
         if(k==="refinery")materials.fuel+=2;
         if(k==="depot")p.happy=Math.min(100,p.happy+1);
       }
       if(p.construction&&--p.construction.left<=0){(p.plants??=[]).push(p.construction.type);delete p.construction;}
     }
   }
 }
 return {panel,build,step,stock};
})();

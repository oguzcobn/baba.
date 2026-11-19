"use strict";
const StrategyTime=(()=>{
 const titles=["Kurtuluş ve Sanayileşme","Topyekûn Savaş","Soğuk Savaş ve Jet","Dijital Harp","İnsansız ve Otonom Çağ"];
 const orders={infantry:["20 asker",4],tank:["Tank",6],plane:["Uçak",6],ship:["Gemi",12]};
 function month(state,turn){
   const segment=state?.calendarSegments?.findLast(item=>item.turn<=turn);
   return segment?segment.month+(turn-segment.turn)*segment.tempo:turn-1;
 }
 function tempo(state){return state.calendarSegments?.at(-1)?.tempo||6;}
 function setTempo(state,value){
   const entry={turn:state.turn,month:month(state,state.turn),tempo:value};
   state.calendarSegments=(state.calendarSegments||[]).filter(item=>item.turn<state.turn);
   state.calendarSegments.push(entry);
 }
 function stamp(state,turn){return new Date(Date.UTC(1919,4+month(state,turn),19));}
 function caption(state){const d=stamp(state,state.turn);return titles[[1936,1950,1990,2015].filter(y=>d.getUTCFullYear()>=y).length];}
 function enqueue(p,type){(p.productionQueue??=[]).push({owner:p.owner,type,left:orders[type][1]});}
 function progress(p,months,report){
   const jobs=p.productionQueue;if(!jobs?.length)return;
   while(jobs.length&&months>0){
     const job=jobs[0];
     if(job.owner!==p.owner){jobs.shift();continue;}
     const used=Math.min(months,job.left);months-=used;job.left-=used;
     if(job.left)break;
     jobs.shift();
     if(job.type==="infantry"){p.army+=20;p.barracks=(p.barracks||0)+1;}
     else{p.equipment??={tank:0,plane:0,ship:0};p.equipment[job.type]++;p.unitType=job.type;}
     report(p.label+" · "+orders[job.type][0]+" hazır.");
   }
 }
 return {month,tempo,setTempo,stamp,caption,enqueue,progress,orders};
})();

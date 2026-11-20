import {createRequire} from "node:module";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {loadWorld} from "../world.js";
import {simulate} from "../engine/world-ai.js";
import {initialize} from "../engine/industry.js";
import {playable} from "../data/playable.js";
globalThis.topojson=createRequire(import.meta.url)("../../../js/vendor/topojson-client.min.js");
globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL("../../../data/countries-50m.json",import.meta.url),"utf8"))});
const map=await loadWorld(),me="tr";
const p=map.RAW.map(([id,label,x,y,owner],i)=>({id,label,x,y,owner,army:30+i*7%30,pop:20+i*11%60,dev:1+i%3,fort:0,happy:75}));
const s={me,p,gold:430,men:380,turn:1,stability:85,tech:1,wars:[],treaties:{trade:[]},alliances:[],capitals:Object.fromEntries(Object.entries(map.N).map(([k,v])=>[k,v[3]]))};
initialize(s,map.N.tr[3]);let peak=0,occupations=0,maxTime=0;const began=performance.now();
const cfg={links:map.LINKS,ports:[...map.coastal],sea:[...map.seaRoutes],months:6,majors:Object.keys(map.N).filter(k=>playable.has(map.N[k][3]?.slice(1)))};
const msgs={wars:0,peace:0,alliances:0};
for(let turn=0;turn<232;turn++){
 const t=performance.now();const {messages}=simulate(s,{...cfg,start:turn*6});
 for(const e of messages){if(e.includes("Savaş ilanı"))msgs.wars++;if(e.includes("Barış anlaşması"))msgs.peace++;if(e.includes("Savunma ittifakı"))msgs.alliances++;}
 maxTime=Math.max(maxTime,performance.now()-t);peak=Math.max(peak,s.theatre.fronts.length);occupations=Math.max(occupations,s.p.filter(q=>q.occupation).length);
 for(const q of s.p){assert(q.army>=0&&Number.isFinite(q.army));q.moved=false}
 s.turn++;for(const [id,w] of Object.entries(s.aiEconomy)){assert(Number.isFinite(w.gold)&&w.gold>=0,id);assert(w.men>=0,id);}
}
const ns=Object.values(s.aiStates);
console.log(JSON.stringify({turns:s.turn-1,activeAtStart:ns.length,peakFronts:peak,peakOccupied:occupations,...msgs,maxLandResearch:Math.max(...ns.map(n=>n.industry.levels.land)),trained:s.p.reduce((n,p)=>n+(p.formations?.length||0),0),yards:s.p.filter(p=>p.plants?.includes("yard")).length,saveKB:Math.round(JSON.stringify(s).length/1024),maxTurnMs:Math.round(maxTime),seconds:(performance.now()-began)/1000}));
assert(s.p.some(p=>p.plants?.includes("yard"))&&peak>0&&msgs.wars&&msgs.peace&&occupations&&ns.some(n=>n.industry.levels.land===5));

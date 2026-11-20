import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs/promises";
import {simulate} from "../engine/world-ai.js";
import {initialize} from "../engine/industry.js";
import {history,historicalCard,officer} from "../data/history.js";
import {playable} from "../data/playable.js";
const config={links:[["a","b"],["b","c"]],ports:["b"],sea:[],majors:["gb","gr"],start:0,months:6};
function start(){
 const s={me:"tr",turn:1,gold:430,men:380,tech:1,stability:85,wars:[],alliances:[],truce:{},treaties:{trade:[]},
 p:["tr","gb","gr"].map((owner,i)=>({id:"abc"[i],label:owner,x:10,y:10,owner,army:40,pop:50,dev:3,happy:75}))};
 initialize(s,"a");return s;
}
test("Every mapped polity has five labelled periods and all playable rosters include specialists",async()=>{
 const map=JSON.parse(await fs.readFile(new URL("../../../data/countries-50m.json",import.meta.url)));
 const ids=[...new Set(map.objects.countries.geometries.map(g=>g.id).filter(x=>/^\d{3}$/.test(x)&&x!=="010"))].sort();
 assert.deepEqual(Object.keys(history).sort(),ids);assert.equal(playable.size,30);
 for(const id of ids){assert.equal(history[id].length,5);for(const c of history[id]){
 assert(c.leaders.trim());if(playable.has(id)){assert(c.officers.length>=3);assert(new Set(c.officers.map(x=>x[0])).size===c.officers.length);}
 }}
});
test("Roster and command change with era; stale appointments do not move into a new era",()=>{
 const s=start();s.commands={tr:{era:1,index:2}};
 assert.equal(officer(s,"tr",1)[0],"Kâzım Karabekir");
 assert.equal(officer(s,"tr",2)[0],"Fevzi Çakmak");assert.notDeepEqual(historicalCard("tr",1),historicalCard("tr",5));
});
test("Planning consumes starting inventory and finishes training only after calendar progress",()=>{
 const s=start();simulate(s,config);assert.equal(s.p[1].army,40);assert(s.aiStates.gb.industry.training.length>0);
 assert(s.aiEconomy.gb.men<380);assert(s.aiStates.gb.industry.study||s.aiStates.gb.industry.levels.air);
 const restored=JSON.parse(JSON.stringify(s));simulate(s,{...config,start:6,months:6});simulate(restored,{...config,start:6,months:6});
 assert.deepEqual(s,restored);assert(s.p[1].army>40);
});
test("Worker message boundary returns the same result as the local rules and isolates mutations",async()=>{
 const {Worker}=await import("node:worker_threads");
 const entry=new URL("../engine/world-worker.js",import.meta.url).href;
 const code=`import {parentPort} from "node:worker_threads";
 globalThis.self={postMessage:r=>parentPort.postMessage(r)};
 await import(${JSON.stringify(entry)});
 parentPort.on("message",data=>self.onmessage({data}));`;
 const worker=new Worker(new URL("data:text/javascript,"+encodeURIComponent(code)));
 try{
  const state=start(),result=new Promise((resolve,reject)=>{worker.once("message",resolve);worker.once("error",reject);});
  worker.postMessage({state,config});
  const actual=await result;assert(!state.aiStates);
  assert.deepEqual(actual,simulate(state,config));
 }finally{await worker.terminate();}
});

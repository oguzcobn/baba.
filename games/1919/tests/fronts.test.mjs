import {test} from "node:test";
import assert from "node:assert/strict";
import {order,step,recall,settlePeace,assignGarrison,climate} from "../engine/fronts.js";
import {initialize,advance,setLine,train} from "../engine/industry.js";
import {models} from "../data/models.js";
import {recipe} from "../data/industry.js";
const links=[["Ankara","Eskisehir"]];
function campaign(){
 const s={me:"tr",wars:[["tr","gr"]],gold:100,men:100,stability:90,tech:1,turn:1,
  p:[["Ankara","tr",100],["Eskisehir","gr",8]].map(([id,owner,army])=>({id,label:id,owner,army,pop:60,dev:2}))};
 initialize(s,"Ankara");return s;
}
function months(s,start,n){for(let m=start;m<start+n;m++)step(s,m,links);}
function attack(s,n=80){return order(s,...s.p,n,{adjacent:true});}
test("Campaign resumes the same front after six months and cannot capture in one default turn",()=>{
 const s=campaign();assert.equal(attack(s),undefined);assert.equal(s.p[0].army,20);
 assert.ok(attack(s,3));months(s,0,6);assert.equal(s.p[1].owner,"gr");
 const copy=JSON.parse(JSON.stringify(s));months(copy,6,6);months(s,6,6);
 assert.deepEqual(s,copy);assert.equal(s.p[1].owner,"tr");
 assert.equal(s.p[1].occupation.sovereign,"gr");
 const o=s.p[1].occupation,old=o.resistance;assignGarrison(s,s.p[1]);months(s,12,3);
 assert(o.garrison>0&&o.resistance<old);
 settlePeace(s,"tr","gr");assert.equal(s.p[1].occupation,null);assert.equal(s.wars.length,0);
});
test("Lost assault, rejection and recall preserve ownership and account for soldiers",()=>{
 const s=campaign();assert.ok(order(s,...s.p,101,{adjacent:true}));assert.equal(s.p[0].army,100);
 attack(s);recall(s,1);assert.equal(s.p[0].army,100);
 s.p[0].moved=false;s.p[1].army=200;attack(s,5);months(s,0,16);
 assert.equal(s.p[1].owner,"gr");assert.equal(s.theatre.fronts.length,0);assert(s.p[0].army<100);
});
test("AI orders use the same sea payment and home guard rules",()=>{
 const s=campaign();const [target,from]=s.p;
 from.army=40;s.aiEconomy={gr:{gold:20}};from.equipment={ship:1};
 assert.ok(order(s,from,target,40,{adjacent:true,sea:true}));
 assert.equal(order(s,from,target,20,{adjacent:true,sea:true}),undefined);
 assert.equal(s.aiEconomy.gr.gold,10);assert.equal(from.army,20);
 assert.equal(s.theatre.fronts[0].group.equipment.ship,1);
});
test("Cold months follow hemisphere and under-equipped old formations receive a penalty",()=>{
 assert.equal(climate({id:"c001",y:20},7),"Kış");assert.notEqual(climate({id:"c002",y:90},7),"Kış");
 const s=campaign();s.p[0].formations=[{equipment:{"tank.1":2}}];
 s.p[1].formations=[{equipment:{"tank.5":3}}];attack(s);months(s,0,1);
 assert(s.theatre.fronts[0].last.obsolete<.3);assert(s.materials.fuel<12);
});
test("Sabotage suspends local production and construction; alternative models can train",()=>{
 const s=campaign(),p=s.p[0];setLine(s,0,"rifle",1,0);p.occupation={sovereign:"gr",disruption:2};
 p.construction={type:"arms",owner:"tr",work:0};advance(s,0);
 assert.equal(p.construction.work,0);assert.equal(s.industry.lines[0].work,0);
 s.industry.inventory={"cavalry.1":4};assert.equal(train(s,p,"infantry",false),undefined);
 assert.deepEqual(s.industry.training[0].reserved,{"cavalry.1":4});
});
test("Each model has a finite recipe for every named generation and gates enforce the final generation",()=>{
 const s=campaign();s.industry.levels.land=5;
 assert.ok(setLine(s,0,"cavalry",5,1400));
 for(const [id,m] of Object.entries(models))for(let lv=m.first;lv<m.first+m.labels.length;lv++){
   const r=recipe(id,lv,"tr");assert(r.name&&r.work>0);assert(Object.values(r.inputs).every(Number.isFinite));
 }
});

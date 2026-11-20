import assert from "node:assert/strict";
import { test } from "node:test";
import * as sim from "../engine/industry.js";
import { branches, eraAt, families, recipe, units } from "../data/industry.js";

function campaign(){
  const s={me:"tr",p:[{id:"Ankara",owner:"tr",dev:4,pop:70,army:40},{id:"Izmir",owner:"gr",dev:2,pop:40,army:30}],
    gold:430,men:100,stability:85,tech:1,wars:[],treaties:{trade:[]}};
  sim.initialize(s,"Ankara");
  return s;
}
function advance(s,start,months){
  for(let i=0;i<months;i++)sim.advance(s,start+i);
}
test("Migration preserves stock, completed plants and partially built facilities exactly once",()=>{
  const s=campaign();delete s.industry;s.materials.steel=9;
  s.p[0].construction={type:"civil",owner:"tr",left:3};
  sim.initialize(s,"Ankara");assert.equal(s.p[0].construction.work,24);assert.equal(s.materials.steel,9);
  const before=JSON.stringify(s);sim.initialize(s,"Ankara");assert.equal(JSON.stringify(s),before);
});
test("Yard and slot checks spend nothing on failure; shared civil work finishes over time",()=>{
  const s=campaign(),p=s.p[0],before=JSON.stringify(s);
  assert.ok(sim.build(s,p,"yard",false,0));assert.equal(JSON.stringify(s),before);
  p.plants.push("civil");s.materials.steel=30;
  assert.equal(sim.build(s,p,"arms",false,0),undefined);
  advance(s,0,7);assert.equal(p.construction.work,58.8);
  advance(s,7,1);assert.equal(p.construction,undefined);assert.equal(sim.count(p,"arms"),2);
  p.plants.push("civil","civil","civil");
  assert.ok(sim.build(s,p,"yard",true,8));
});
test("Factories are exclusive and line switching lowers efficiency",()=>{
  const s=campaign();
  assert.equal(sim.setLine(s,0,"rifle",1,0),undefined);assert.ok(sim.setLine(s,0,"tank",1,0));
  const l=s.industry.lines[0];advance(s,0,4);
  assert.ok(s.industry.inventory["rifle.1"]>4);
  const efficiency=l.efficiency;
  assert.equal(sim.setLine(s,l.id,"tank",1,4),undefined);assert.equal(l.work,0);assert.ok(l.efficiency<efficiency);
  assert.ok(sim.allocate(s,l.id,1));s.p[0].plants.push("arms");assert.equal(sim.allocate(s,l.id,1),undefined);
  s.p[0].plants=[];advance(s,4,1);assert.equal(l.status,"Tesis bekliyor");assert.equal(l.work,0);
});
test("A missing mandatory input stops a staffed advanced line without consuming other inputs",()=>{
  const s=campaign();s.industry.levels.air=5;s.materials.chips=0;
  assert.equal(sim.setLine(s,0,"plane",5,1400),undefined);
  const before=s.materials.steel;
  advance(s,1400,1);
  assert.equal(s.industry.lines[0].work,0);assert.equal(s.industry.lines[0].efficiency,.45);
  assert.ok(s.materials.steel>before);
});
test("Training reserves equipment and personnel once, persists through saves and deploys after eight months",()=>{
  const s=campaign();assert.equal(sim.train(s,s.p[0],"infantry",false),undefined);
  assert.equal(s.industry.inventory["rifle.1"],0);assert.equal(s.men,90);
  const before=JSON.stringify(s);assert.ok(sim.train(s,s.p[0],"infantry",false));assert.equal(JSON.stringify(s),before);
  advance(s,0,3);const loaded=JSON.parse(JSON.stringify(s));assert.equal(loaded.industry.training[0].left,5);
  advance(loaded,3,5);assert.equal(loaded.industry.training.length,0);assert.equal(loaded.p[0].army,60);
});
test("Thirty technology nodes respect time and prerequisites; all families can be produced at their valid era",()=>{
  const s=campaign();assert.equal(Object.keys(branches).length*5,30);
  assert.ok(sim.research(s,"land",0));
  for(const m of [0,200,380,860,1160]){
    for(const key of Object.keys(branches)){
      while(s.industry.levels[key]<eraAt(m)){
        assert.equal(sim.research(s,key,m),undefined);
        while(s.industry.study)sim.advance(s,m);
      }
    }
  }
  for(const [key,f] of Object.entries(families))for(let i=f.first;i<=5;i++)assert.ok(recipe(key,i).work>0);
  for(const key of Object.keys(branches))assert.equal(s.industry.levels[key],5);
});
test("Policy cooldown, exclusive focus branches and research bonus persist",()=>{
  const s=campaign();s.industry.political=200;
  assert.equal(sim.changeLaw(s,"service",2,0),undefined);assert.ok(sim.changeLaw(s,"service",1,3));
  assert.equal(sim.changeLaw(s,"service",1,6),undefined);
  assert.ok(sim.focus(s,1,2,0));assert.equal(sim.focus(s,1,1,0),undefined);
  advance(s,0,12);assert.ok(sim.focus(s,1,0,12));assert.equal(sim.focus(s,1,2,12),undefined);
  advance(s,12,18);assert.deepEqual(s.industry.completed,["1.1","1.2"]);
});
test("Trade reserves both sides, refunds blocked shipments and enforces throughput",()=>{
  const s=campaign(),partners=["gr"];const stock=sim.marketStock(s,"gr");
  const before=s.materials.steel,cash=s.gold,foreign=stock.steel;
  assert.equal(sim.trade(s,"gr","steel",5,partners,0),undefined);assert.equal(s.materials.steel,before);
  assert.equal(stock.steel,foreign-5);assert.ok(s.gold<cash);
  assert.equal(sim.trade(s,"gr","steel",5,partners,0),undefined);assert.ok(sim.trade(s,"gr","steel",5,partners,0));
  s.wars=[["tr","gr"]];advance(s,0,1);assert.equal(s.industry.cargo.length,0);
  assert.ok(stock.steel>=foreign);assert.ok(s.gold>=cash);
  s.wars=[];const bystander=JSON.parse(JSON.stringify(s));
  assert.equal(sim.trade(s,"gr","steel",5,partners,1),undefined);advance(s,1,1);advance(bystander,1,1);
  assert.equal(s.materials.steel,bystander.materials.steel+5);
});
test("Quarterly and half-year batching advances identical economic state",()=>{
  const s=campaign();sim.train(s,s.p[0],"infantry",false);sim.setLine(s,0,"rifle",1,0);sim.research(s,"air",0);
  const copy=structuredClone(s);advance(s,0,6);advance(copy,0,3);advance(copy,3,3);assert.deepEqual(s,copy);
});
test("Each training type has a viable depot-to-deployment path, and fuel shortages pause training",()=>{
  for(const [key,unit] of Object.entries(units)){
    const s=campaign(),p=s.p[0];p.plants.push("yard","airbase");
    for(const [family,n] of Object.entries(unit[3]))s.industry.inventory[family+".5"]=n;
    assert.equal(sim.train(s,p,key,true),undefined);s.materials.fuel=0;
    advance(s,0,1);
    if(key!=="infantry")assert.equal(s.industry.training[0].left,unit[2]);
    s.materials.fuel=200;advance(s,1,unit[2]);assert.equal(s.industry.training.length,0);
    assert.equal(p.formations[0].key,key);
  }
});

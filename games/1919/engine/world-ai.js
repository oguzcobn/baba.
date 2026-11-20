import * as I from "./industry.js";
import * as F from "./fronts.js";
import { branches, eraAt } from "../data/industry.js";
import { models } from "../data/models.js";
import StrategyTime from "./calendar.js";

const seed=id=>[...id].reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,19);
const pair=(a,b)=>[a,b].sort().join("-");
const paired=(list,a,b)=>list.some(p=>p.includes(a)&&p.includes(b));
function index(s,links){
 const byOwner=new Map(),byId=new Map(),edges=new Map();
 for(const p of s.p){
   byId.set(p.id,p);edges.set(p.id,[]);
   if(!byOwner.has(p.owner))byOwner.set(p.owner,[]);
   byOwner.get(p.owner).push(p);
 }
 for(const [a,b] of links){if(byId.has(a)&&byId.has(b)){edges.get(a).push(byId.get(b));edges.get(b).push(byId.get(a));}}
 return {byOwner,edges};
}
function nationalState(s,id,regions){
 s.aiEconomy??={};s.aiStates??={};
 const wallet=s.aiEconomy[id]??={gold:s.turn===1?430:110,men:s.turn===1?380:90};
 const view={...wallet,...s.aiStates[id],me:id,p:regions,wars:s.wars,treaties:s.treaties,theatre:s.theatre,
  stability:s.aiStates[id]?.stability??85,tech:s.aiStates[id]?.tech??1};
 if(!view.industry){
   I.initialize(view,s.capitals?.[id]);
   if(s.industry.market[id])view.materials=s.industry.market[id];
 }
 view.materials=s.industry.market[id]??=view.materials;
 return view;
}
function persist(s,v){
 s.aiStates[v.me]={industry:v.industry,stability:v.stability,tech:v.tech};
 Object.assign(s.aiEconomy[v.me],{gold:v.gold,men:v.men});
}
function choose(options){return options.filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1])[0]?.[0];}
function economy(s,v,month,ports,contacts){
 const e=v.industry,era=eraAt(month),p=v.p.find(p=>p.industryCapital)||v.p[0];
 const coast=v.p.find(q=>ports.has(q.id)),naval=!!coast;
 const total=k=>v.p.reduce((n,q)=>n+I.count(q,k),0);
 const enemyArmour=contacts.some(q=>q.equipment?.tank>0),enemyShips=contacts.some(q=>q.equipment?.ship>0);
 const navalGoal=naval&&(enemyShips||seed(v.me)%3===0);
 const savingForYard=navalGoal&&!total("yard")&&!v.p.some(q=>q.construction?.type==="yard");
 if(!e.study){
   const topic=choose(Object.keys(branches).filter(k=>e.levels[k]<era).map(k=>[k,
    40-e.levels[k]*6+({land:12,industry:9,navy:navalGoal?11:1,air:5,uav:era>=3?7:0,usv:era>=4&&navalGoal?9:0}[k])]));
   if(topic)I.research(v,topic,month);
 }
 const projects=[
  ["yard",navalGoal&&!total("yard")?92:0],["electronics",era>=4&&!total("electronics")?90:0],
  ["refinery",v.materials.fuel<12&&!total("refinery")?85:0],["arms",total("arms")<2?65:0],
  ["airbase",!total("airbase")&&e.levels.air?62:0],["civil",total("civil")<2?55:0],["depot",!total("depot")?40:0]
 ].sort((a,b)=>b[1]-a[1]);
 if(!p.construction&&I.usedSlots(p)+(savingForYard?2:1)>I.slotLimit(p)&&I.slotLimit(p)<8&&v.gold>=120){
   v.gold-=75;p.dev++;p.pop+=2;p.investment=(p.investment||0)+1;
 }
 for(const q of v.p.filter(q=>!q.construction)){
   for(const [k,score] of projects)if(score&&(!savingForYard||k==="yard")&&(!total(k)||["civil","arms"].includes(k))&&!I.build(v,q,k,ports.has(q.id),month))break;
 }
 const stock=k=>Object.entries(e.inventory).reduce((n,[id,count])=>n+(models[id.split(".")[0]]?.family===k?count:0),0);
 const wanted=choose([["rifle",stock("rifle")<4?110:28],["antitank",enemyArmour&&e.levels.land>=2&&stock("gun")<2?95:0],
  ["gun",stock("gun")<2?70:0],["tank",stock("tank")<3?65:0],["plane",total("airbase")&&stock("plane")<3?58:0],
  ["male",total("airbase")&&e.levels.uav>=4&&stock("drone")<2?80:0]]);
 const navalModel=enemyShips&&e.levels.usv===5?"seaswarm":enemyShips&&e.levels.navy>=2?"sub":"ship";
 for(const key of (savingForYard?[]:[wanted,navalModel]).filter(Boolean)){
   const m=models[key],lv=Math.min(era,e.levels[m.branch],m.first+m.labels.length-1);
   if(lv<m.first)continue;
   const yard=["ship","usv"].includes(m.family),lines=e.lines.filter(l=>l.yard===yard);
   if(lines.some(l=>l.key===key&&l.level===lv))continue;
   const id=I.assigned(e,yard)<I.capacity(v,yard)?0:lines.filter(l=>!l.work||stock(models[l.key].family)>=2).at(-1)?.id;
   if(id!==undefined)I.setLine(v,id,key,lv,month);
 }
 if(e.training.length<2&&p.army<150){
   for(const k of ["tank","drone","plane","usv","ship","motor","infantry"]){
     const base=["ship","usv"].includes(k)?coast:["plane","drone"].includes(k)?v.p.find(q=>I.count(q,"airbase")):p;
     if(base&&!I.train(v,base,k,ports.has(base.id)))break;
   }
 }
 if(!e.focus)I.focus(v,era,0,month);
}
function buy(s,id,neighbors,month){
 const stock=s.industry.market[id],wallet=s.aiEconomy[id];
 const key=["steel","fuel","aluminium","chips"].find(k=>stock[k]<4&&(k!=="chips"||eraAt(month)>=4));
 if(!key||wallet.gold<20)return;
 for(const other of neighbors){
   if(other===s.me||!s.aiEconomy[other]||paired(s.wars,id,other)||!(s.industry.market[other]?.[key]>=10))continue;
   // All exchanges reserve payment and stock using the player's trade engine and shared settlement queue.
   const e=s.aiStates[id].industry;
   const view={me:id,p:s.p,industry:{...e,market:s.industry.market,cargo:s.industry.cargo},
    aiEconomy:s.aiEconomy,gold:wallet.gold,materials:stock};
   if(!I.trade(view,other,key,5,[other],month)){wallet.gold=view.gold;break;}
 }
}
function foreign(s,id,regions,contacts,edges,sea,month,report){
 const treaties=s.alliances,truce=s.truce??={},who=s.aiEconomy[id],front=F.theatre(s);
 const rounds=s.warSince??={},peace=(a,b)=>!paired(s.wars,a,b);
 const addWar=(a,b)=>{
   s.wars.push([a,b]);rounds[pair(a,b)]=month;front.tension=Math.min(100,front.tension+5);
   report(a+" → "+b+" · Savaş ilanı");
 };
 for(const [a,b] of [...s.wars].filter(w=>w.includes(id))){
   const opponent=a===id?b:a,k=pair(a,b);rounds[k]??=month;
   const active=front.fronts.some(f=>pair(f.attacker,f.defender)===k);
   if(opponent!==s.me&&month-rounds[k]>=24&&(!active||who.gold<10||month-rounds[k]>=60)){
     F.settlePeace(s,id,opponent,report);delete rounds[k];report(id+" / "+opponent+" · Barış anlaşması");return;
   }
 }
 for(const alliance of treaties.filter(p=>p.includes(id)&&!s.wars.some(w=>w.includes(id)))){
   const ally=alliance.find(a=>a!==id),war=s.wars.find(([a,b])=>b===ally&&a!==id);
   if(war&&peace(id,war[0])&&!paired(treaties,id,war[0])&&!(truce[pair(id,war[0])]>s.turn)){addWar(id,war[0]);break;}
 }
 const candidates=[];
 for(const home of regions){
   for(const q of edges.get(home.id)||[]){
     const other=q.owner;if(other===id||other==="ne")continue;
     const seaLane=sea.has([q.id,home.id].sort().join("|"));
     if(paired(s.wars,id,other)){
       const n=Math.floor((home.army-(home.occupation?.garrison||0))*.66);
       if(n>q.army*1.12&&(!seaLane||home.equipment?.ship))candidates.push([{home,q,n,seaLane},70+n/Math.max(1,q.army)]);
     }else if(!paired(treaties,id,other)&&!(truce[pair(id,other)]>s.turn)&&month>=30){
       const bias=seed(pair(id,other))%17;
       if((Math.floor(month/12)+seed(pair(id,other)))%11===0&&!s.wars.some(w=>w.includes(id))&&home.army>q.army*(other===s.me?({easy:2.4,normal:1.9,hard:1.55}[s.difficulty]||1.9):1.55)&&bias<5)candidates.push([{declare:other},42+bias]);
       if(other!==s.me&&bias>13&&!treaties.some(p=>p.includes(other)&&p.includes(id))&&treaties.filter(p=>p.includes(id)).length<2)candidates.push([{ally:other},32]);
     }
   }
 }
 if(s.wars.some(w=>w.includes(id)))for(const home of regions){
   if((edges.get(home.id)||[]).some(q=>q.owner!==id)||home.army<24)continue;
   const to=(edges.get(home.id)||[]).find(q=>q.owner===id&&edges.get(q.id).some(border=>paired(s.wars,id,border.owner)));
   if(to)candidates.push([{home,q:to,n:Math.floor(home.army*.4),seaLane:sea.has([home.id,to.id].sort().join("|"))},20]);
 }
 const pick=choose(candidates);
 if(pick?.declare)addWar(id,pick.declare);
 if(pick?.ally){treaties.push([id,pick.ally]);report(id+" / "+pick.ally+" · Savunma ittifakı");}
 if(pick?.home)F.order(s,pick.home,pick.q,pick.n,{adjacent:true,sea:pick.seaLane},report);
}
export function simulate(s,{links,ports,sea,start,months,majors}){
 const portSet=new Set(ports),seaSet=new Set(sea),major=new Set(majors),messages=[];
 const report=t=>{messages.push(t);if(messages.length>80)messages.shift();};
 F.theatre(s);s.aiStates??={};s.aiEconomy??={};
 for(let i=0;i<months;i++){
   const month=start+i,{byOwner,edges}=index(s,links);
   I.advance(s,month,report);
   for(const [id,regions] of byOwner){
     if(id===s.me||id==="ne")continue;
     const v=nationalState(s,id,regions);
     const contacts=regions.flatMap(p=>edges.get(p.id)).filter(p=>p.owner!==id);
     const near=major.has(id)||contacts.some(p=>p.owner===s.me)||s.wars.some(w=>w.includes(id));
     const decide=(month+seed(id))%(near?3:9)===0;
     if(decide)economy(s,v,month,portSet,contacts);
     I.advance(v,month);
     persist(s,v);
     if(decide){
       buy(s,id,new Set(contacts.map(c=>c.owner)),month);
       foreign(s,id,regions,contacts,edges,seaSet,month,report);
     }
     for(const p of regions)if(p.occupation)p.occupation.garrison=Math.min(p.army,Math.ceil(p.pop/20));
   }
   F.step(s,month,links,report);
   for(const p of s.p)if(p.productionQueue?.length)StrategyTime.progress(p,1,report);
 }
 return {state:s,messages};
}

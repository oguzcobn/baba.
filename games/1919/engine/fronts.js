import { models } from "../data/models.js";

const limit=(v,min,max)=>Math.min(max,Math.max(min,v));
const hash=s=>Array.from(s).reduce((v,c)=>(31*v+c.charCodeAt(0))>>>0,19);
const count=(p,type)=>(p.plants||[]).filter(v=>v===type).length;
const atWar=(s,a,b)=>a!==b&&(a==="ne"||b==="ne"||s.wars.some(pair=>pair.includes(a)&&pair.includes(b)));
export function theatre(s){
 return s.theatre??={fronts:[],tension:0,serial:0,records:[]};
}
// One representative terrain per map region, used only for game balance.
const mountains=new Set("Trabzon Erzurum Kars Bolu Giresun Van c524 c756 c004 c064 c762 c417 c051 c068".split(" "));
const hills=new Set("Kutahya Afyon Ankara Sivas Antalya Antep Inebolu Kayseri Denizli Malatya Amasya Tokat Corum Karaman c792 c300 c364 c724 c380 c392 c410 c031 c710 c578 c484 c360 c620 c152".split(" "));
export function terrain(p){
 return mountains.has(p.id)?"Dağ":hills.has(p.id)?"Tepe":"Ova";
}
export function climate(p,month){
 const lat=p.id.match(/^c\d/) ? 90-(p.y*5.7+25)/3.6 : 40;
 const m=(4+month+(lat<0?6:0))%12;
 if(Math.abs(lat)<23)return m>=4&&m<=8?"Yağış":"Ilıman";
 return [10,11,0,1].includes(m)?"Kış":[2,3].includes(m)?"Geçiş":"Ilıman";
}
function nationalFuel(s,id){return id===s.me?s.materials:s.industry?.market?.[id];}
function detach(p,n){
 const share=n/p.army,formations=p.formations||[],take=Math.round(formations.length*share);
 const kit={};
 for(const k of Object.keys(p.equipment||{})){
   kit[k]=Math.round(p.equipment[k]*share);p.equipment[k]-=kit[k];
 }
 p.army-=n;
 return {army:n,equipment:kit,formations:formations.splice(0,take)};
}
function join(p,group){
 p.army+=Math.max(0,group.army);
 p.equipment??={};for(const [key,value] of Object.entries(group.equipment))p.equipment[key]=(p.equipment[key]||0)+value;
 (p.formations??=[]).push(...group.formations);
}
function write(s,text,report){
 const w=theatre(s);w.records.unshift(text);w.records.length=Math.min(w.records.length,40);report(text);
}
export function order(s,from,to,n,{adjacent,sea=false},report=()=>{}){
 const w=theatre(s);
 if(!from||!to||!adjacent||from===to||from.moved||!Number.isInteger(n)||n<1||n>from.army-1-(from.occupation?.garrison||0))return "Kullanılabilir asker veya geçerli bir komşu rota gerekli.";
 if(w.fronts.some(b=>[b.from,b.to].some(id=>id===from.id||id===to.id)))return "Bu eyalet zaten etkin bir cepheye bağlı.";
 if(from.owner!==to.owner&&!atWar(s,from.owner,to.owner))return "Önce savaş ilan et.";
 const wallet=from.owner===s.me?s:s.aiEconomy?.[from.owner];
 if(sea&&(!(from.equipment?.ship>0)||!wallet||wallet.gold<10))return "Deniz geçişi için gemi ve 10 bütçe gerekli.";
 if(sea)wallet.gold-=10;
 const group=detach(from,n);
 if(sea&&!group.equipment.ship){from.equipment.ship--;group.equipment.ship=1;}
 from.moved=true;
 if(from.owner===to.owner){join(to,group);report(from.label+" → "+to.label+" · "+n+" asker ulaştı.");return;}
 w.fronts.push({id:++w.serial,from:from.id,to:to.id,attacker:from.owner,defender:to.owner,group,
   start:n,elapsed:0,approach:0,hp:100,org:100,defHp:100,defOrg:100,dug:Math.min(.32,.04*(to.fort||0)+.08),
   sea,phase:"İntikal",last:null});
 write(s,to.label+" cephesi açıldı.",report);
}
function profile(group){
 const roles=new Set();let weight=0,level=0,fuel=0;
 for(const formation of group.formations||[])for(const [id,n] of Object.entries(formation.equipment||{})){
   const [key,generation]=id.split("."),model=models[key];
   if(!model||n<=0)continue;
   weight+=n;level+=n*Number(generation);roles.add(model.role);fuel+=n*model.fuel*.08;
 }
 if(!weight){
   const eq=group.equipment||{};
   for(const [k,role] of [["tank","armour"],["plane","air"],["ship","escort"]])if(eq[k]>0){roles.add(role);fuel+=eq[k]*.4;}
 }
 return {roles,level:weight?level/weight:1,fuel};
}
function matchup(a,b,radar){
 const has=r=>a.roles.has(r),target=r=>b.roles.has(r);
 let mult=1;
 if(has("antiarmour")&&target("armour"))mult*=1.3;
 if(has("air")&&target("armour")&&!target("shield"))mult*=1.28;
 if((has("air")||has("swarm"))&&(radar||target("electronic")||target("shield")))mult*=.7;
 if(has("swarm")&&target("capital"))mult*=target("escort")?.75:1.4;
 if(has("sub")&&target("screen"))mult*=.75;
 return limit(mult,.65,1.45);
}
function network(s,links){
 const nodes=new Map(s.p.map(p=>[p.id,p])),neighbors=new Map(),capacity=new Map();
 for(const [a,b] of links){
   if(!neighbors.has(a))neighbors.set(a,[]);if(!neighbors.has(b))neighbors.set(b,[]);
   neighbors.get(a).push(b);neighbors.get(b).push(a);
 }
 const hubs=new Set(),owners=new Set();
 for(const p of s.p)if(p.industryCapital||count(p,"depot")||p.id===s.capitals?.[p.owner]){hubs.add(p.id);owners.add(p.owner);}
 for(const p of s.p)if(!owners.has(p.owner)){hubs.add(p.id);owners.add(p.owner);}
 return function supply(origin,amount,weather){
   const demand=Math.max(1,amount/16),queue=[[origin,[]]],visited=new Set([origin.id]);
   let delivered=0;
   for(let i=0;i<queue.length;i++){
     const [p,route]=queue[i];
     if(hubs.has(p.id)){
       const ids=[...route,"hub:"+p.id];
       if(!capacity.has(ids.at(-1)))capacity.set(ids.at(-1),4+count(p,"depot")*4+count(p,"infra")*2);
       delivered=Math.min(demand,...ids.map(k=>capacity.get(k)));
       if(delivered>0){for(const k of ids)capacity.set(k,capacity.get(k)-delivered);break;}
     }
     for(const id of neighbors.get(p.id)||[]){
       const q=nodes.get(id);
       if(!q||q.owner!==origin.owner||visited.has(id))continue;
       const k=[p.id,id].sort().join("|");
       if(!capacity.has(k))capacity.set(k,4+2*Math.min(count(p,"infra"),count(q,"infra")));
       if(capacity.get(k)<=0)continue;
       visited.add(id);queue.push([q,[...route,k]]);
     }
   }
   return limit((.5+delivered)/demand*(weather==="Kış"?.82:weather==="Yağış"?.9:1),0,1);
 };
}
function drawFuel(s,owner,cost){
 if(!cost)return 1;
 const stock=nationalFuel(s,owner);if(!stock)return 0;
 const used=Math.min(cost,stock.fuel);stock.fuel-=used;return used/cost;
}
function withdraw(s,b,report,reason){
 const p=s.p.find(p=>p.id===b.from&&p.owner===b.attacker)||s.p.find(p=>p.owner===b.attacker);
 if(p&&b.group.army>0)join(p,b.group);
 write(s,(s.p.find(p=>p.id===b.to)?.label||b.to)+" · "+reason,report);
}
export function recall(s,id,report=()=>{}){
 const w=theatre(s),b=w.fronts.find(b=>b.id===id&&b.attacker===s.me);
 if(!b)return;
 withdraw(s,b,report,"Emirle geri çekildi.");w.fronts=w.fronts.filter(f=>f!==b);
}
function recordResult(s,b,won){
 if(![b.attacker,b.defender].includes(s.me))return;
 const st=s.stats??={won:0,lost:0,captured:0,defended:0,eventsChosen:0};
 const victory=(s.me===b.attacker)===won;
 st[victory?"won":"lost"]++;if(won&&s.me===b.attacker)st.captured++;
 if(!won&&s.me===b.defender)st.defended++;
}
function tickFront(s,b,month,supply,links,report){
 const from=s.p.find(p=>p.id===b.from),to=s.p.find(p=>p.id===b.to);
 if(from?.owner!==b.attacker||to?.owner!==b.defender||!atWar(s,b.attacker,b.defender)){
   withdraw(s,b,report,"Cephe kapandı.");return false;
 }
 const weather=climate(to,month),ground=terrain(to),att=profile(b.group),def=profile(to);
 const sa=supply(from,b.group.army,weather),sd=supply(to,to.army,weather);
 const fuel=drawFuel(s,b.attacker,att.fuel+(b.sea?.4:0)),df=drawFuel(s,b.defender,def.fuel);
 const cold=weather==="Kış",width=ground==="Dağ"?48:ground==="Tepe"?72:96;
 const old=Math.max(.24,.68**Math.max(0,def.level-att.level));
 const mod=matchup(att,def,count(to,"radar")>0);
 b.last={weather,ground,supply:sa,defSupply:sd,fuel,obsolete:old,match:mod,width};
 b.elapsed++;
 if(b.approach<1){
   b.approach+=.55*(ground==="Dağ"?.6:ground==="Tepe"?.8:1)*(cold?.7:weather==="Yağış"?.85:1)*(.4+.6*sa)*(.4+.6*fuel);
   b.dug=Math.min(.32,b.dug+.04);
   if(b.approach<1)return true;
 }
 b.phase="Muharebe";
 const power=(army,profile,hp,org,sp,fp)=>Math.min(width,army)*(1+.12*profile.roles.size)*hp/100*(.35+.65*org/100)*(.35+.65*sp)*(.4+.6*fp);
 const a=power(b.group.army,att,b.hp,b.org,sa,fuel)*old*mod*(cold?.85:weather==="Yağış"?.93:1);
 const d=power(to.army,def,b.defHp,b.defOrg,sd,df)*Math.max(.24,.68**Math.max(0,att.level-def.level))*matchup(def,att,count(from,"radar")>0)*(1+b.dug+(ground==="Dağ"?.28:ground==="Tepe"?.12:0));
 for(const group of [b.group,to])for(const f of group.formations||[])for(const id of Object.keys(f.equipment||{})){
   if(models[id.split(".")[0]]?.role==="swarm")delete f.equipment[id];
 }
 const ratio=a/Math.max(.001,a+d);
 if(b.defOrg>=20&&b.defHp>=25&&to.army>0){
   b.hp=Math.max(0,b.hp-1-5*(1-ratio));b.defHp=Math.max(0,b.defHp-1-5*ratio);
   b.org=Math.max(0,b.org-5-14*(1-ratio));b.defOrg=Math.max(0,b.defOrg-5-14*ratio);
   b.group.army=Math.max(0,b.group.army-Math.ceil(b.group.army*(1+5*(1-ratio))/100));
   to.army=Math.max(0,to.army-Math.ceil(to.army*(1+5*ratio)/100));
 }
 if(b.org<20||b.hp<25||b.group.army<=0){recordResult(s,b,false);withdraw(s,b,report,"Taarruz sona erdi.");return false;}
 if(b.defOrg>=20&&b.defHp>=25&&to.army>0)return true;
 b.phase="Denetim kuruluyor";
 if(b.elapsed<7||sa<.25)return true;
 const fallback=s.p.find(p=>p.owner===b.defender&&p!==to);
 if(fallback&&to.army>0)join(fallback,detach(to,to.army));
 const sovereign=to.occupation?.sovereign||to.owner;
 to.army=0;to.formations=[];to.equipment={};to.owner=b.attacker;join(to,b.group);
 to.occupation=sovereign===to.owner?null:{sovereign,resistance:35,garrison:0,disruption:0};
 to.fort=Math.max(0,(to.fort||0)-1);
 recordResult(s,b,true);theatre(s).tension=Math.min(100,theatre(s).tension+8);
 coalition(s,b.attacker,links,report);
 write(s,to.label+" · "+(to.occupation?"İşgal yönetimi başladı.":"Önceki yönetim geri döndü."),report);
 return false;
}
export function step(s,month,links,report=()=>{}){
 const w=theatre(s);
 for(const p of s.p){
   const o=p.occupation;if(!o)continue;
   o.garrison=Math.min(o.garrison,p.army);o.disruption=Math.max(0,o.disruption-1);
   const need=Math.max(1,Math.ceil(p.pop/20));
   o.resistance=limit(o.resistance+1.2-2.4*Math.min(1,o.garrison/need),0,100);
   if(o.resistance>50&&!o.disruption&&hash(p.id+"/"+month)%1000<Math.min(250,(o.resistance-50)*5)){
     o.disruption=2;write(s,p.label+" · Tesis çalışmaları iki ay kesintiye uğradı.",report);
   }
 }
 const supply=network(s,links);
 w.fronts=w.fronts.filter(b=>tickFront(s,b,month,supply,links,report));
 if(!s.wars.length)w.tension=Math.max(0,w.tension-.25);
}
export function assignGarrison(s,p){
 if(p?.owner!==s.me||!p.occupation)return;
 const o=p.occupation;o.garrison=o.garrison?0:Math.min(p.army,Math.max(1,Math.ceil(p.pop/20)));
}

export function settlePeace(s,a,b,report=()=>{}){
 const w=theatre(s),pair=(x,y)=>(a===x&&b===y)||(a===y&&b===x);
 w.fronts=w.fronts.filter(f=>{
   if(!pair(f.attacker,f.defender))return true;
   withdraw(s,f,report,"Ateşkes ile geri döndü.");return false;
 });
 for(const p of s.p)if(p.occupation&&pair(p.owner,p.occupation.sovereign))p.occupation=null;
 s.wars=s.wars.filter(([x,y])=>!pair(x,y));(s.truce??={})[[a,b].sort().join("-")]=s.turn+5;
 w.tension=Math.max(0,w.tension-4);
}
function coalition(s,aggressor,links,report){
 if(theatre(s).tension<60)return;
 const owners=new Map(s.p.map(p=>[p.id,p.owner])),border=new Set();
 for(const [a,b] of links){
   if(owners.get(a)===aggressor)border.add(owners.get(b));
   if(owners.get(b)===aggressor)border.add(owners.get(a));
 }
 const partners=[...border].filter(id=>id&&id!==aggressor&&id!=="ne"&&id!==s.me);
 const alliances=s.alliances??=[];
 for(const a of partners)for(const b of partners){
   if(a>=b||atWar(s,a,b)||alliances.some(pair=>pair.includes(a)&&pair.includes(b)))continue;
   alliances.push([a,b]);write(s,"Dünya gerilimi nedeniyle sınır devletleri savunma ittifakı kurdu.",report);return;
 }
}

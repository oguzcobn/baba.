import { officer, isoOf, spirits } from "../data/history.js";
import { models } from "../data/models.js";
import { resources, buildings, branches, researchCost, focusNames, laws, families, units, eraAt, recipe } from "../data/industry.js";

const round=n=>Math.round(n*1000000)/1000000;
const sum=(list,value)=>list.reduce((n,p)=>n+value(p),0);
export const count=(p,type)=>(p.plants||[]).filter(k=>k===type).length;
export const slotLimit=p=>Math.min(8,2+p.dev+(p.industryCapital?1:0));
export const usedSlots=p=>sum(p.plants||[],key=>buildings[key]?.[4]||0)+(buildings[p.construction?.type]?.[4]||0);
const owned=s=>s.p.filter(p=>p.owner===s.me);
const hasFocus=(e,era,index)=>e.completed.includes(era+"."+index);
const clamp100=n=>Math.min(100,Math.max(0,n));

export function initialize(s,capital){
  if(s.industry?.version===3)return s.industry;
  const e=s.industry={version:3,political:30,support:55,inventory:{'rifle.1':4},lines:[],training:[],
    levels:{land:1,air:0,navy:0,uav:0,usv:0,industry:1},teams:1,study:null,focus:null,completed:[],
    laws:{economy:1,service:0,trade:1},changed:{},market:{},cargo:[],routeUse:{},arrears:0,deficitMonths:0,sequence:0,crisis:null,lastCrisis:-12};
  s.materials={steel:15,aluminium:8,oil:6,fuel:12,chips:0,...s.materials};
  const home=owned(s).find(p=>p.id===capital)||owned(s)[0];
  if(home){
    home.industryCapital=true;
    home.plants??=[];
    for(const type of ["civil","arms"])if(!home.plants.includes(type))home.plants.push(type);
  }
  for(const p of s.p){
    if(p.owner!==s.me && p.owner!=="ne")marketStock(s,p.owner);
    p.recruitPool??=p.pop*1000;
    if(p.construction?.left!=null){
      const old=p.construction;
      const duration={civil:6,arms:9,refinery:6,depot:4}[old.type];
      if(duration) p.construction={type:old.type,owner:old.owner,work:buildings[old.type][1]*Math.max(0,1-old.left/duration),legacy:true};
    }
  }
  return e;
}
export function deposits(p){
  const code=Array.from(p.id).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
  const mix=1+0.15*count(p,"infra");
  return {steel:(0.4+code%3*0.35)*mix,aluminium:((code>>>4)%4)*0.25*mix,oil:((code>>>8)%3)*0.5*mix};
}
export function capacity(s,yard){
  return sum(owned(s),p=>count(p,yard?"yard":"arms"));
}
export function budget(s){
  const regions=owned(s),army=sum(regions,p=>p.army)+sum((s.theatre?.fronts||[]).filter(b=>b.attacker===s.me),b=>b.group.army);
  const income=2+sum(regions,p=>.35*p.dev+.6*count(p,"civil")+.6*(p.market||0)+.25*(p.farm||0))+2*(s.treaties?.trade||[]).filter(pair=>pair.includes(s.me)&&!s.wars.some(w=>pair.every(id=>w.includes(id)))).length;
  const upkeep=.4*army/20+sum(regions,p=>.8*(p.equipment?.ship||0)+.15*(p.plants||[]).length);
  return {income,upkeep,net:income-upkeep};
}
export function assigned(e,yard){return sum(e.lines.filter(l=>l.yard===yard),l=>l.factories||1);}
export function allocate(s,id,delta){
  const l=s.industry.lines.find(line=>line.id===id);
  if(!l||![1,-1].includes(delta))return "Geçersiz hat.";
  if(delta>0&&assigned(s.industry,l.yard)>=capacity(s,l.yard))return "Boş tesis yok.";
  if(l.factories+delta<1)return "Hatta en az bir tesis kalmalı.";
  l.factories+=delta;
}
export function build(s,p,key,coastal,month){
  const b=buildings[key];
  if(!b||p?.owner!==s.me)return "Kendi eyaletini seç.";
  if(p.construction)return "Bu eyalette inşaat sürüyor.";
  if(key==="yard"&&!coastal)return "Tersane için denize kıyısı olan bir eyalet seç.";
  if(key==="electronics"&&(eraAt(month)<4||s.industry.levels.industry<4))return "Sanayi IV araştırması gerekli.";
  if(key==="infra"&&count(p,key)>=3)return "Altyapı azami seviyede.";
  if(usedSlots(p)+b[4]>slotLimit(p))return "Boş tesis alanı yetersiz. Eyalete yatırım yap.";
  if(s.gold<b[2]||s.materials.steel<b[3])return "İnşaat için bütçe veya çelik yetersiz.";
  s.gold-=b[2];s.materials.steel-=b[3];
  p.construction={type:key,owner:s.me,work:0};
}
export function setLine(s,id,key,level,month){
  const e=s.industry,f=models[key];
  if(!f||!Number.isInteger(level)||level<f.first||level>=f.first+f.labels.length||level>e.levels[f.branch]||level>eraAt(month))return "Bu modeli önce araştır.";
  const model=recipe(key,level);
  let line=e.lines.find(l=>l.id===id);
  if(!line){
    if(id!==0)return "Hat bulunamadı.";
    if(assigned(e,model.yard)>=capacity(s,model.yard))return "Boş üretim tesisi yok.";
    e.lines.push({id:++e.sequence,key,level,factories:1,yard:model.yard,efficiency:.45,work:0,status:"Hazır"});
    return;
  }
  if(line.yard!==model.yard)return "Bu model farklı tesis gerektirir.";
  if(line.key===key&&line.level===level)return "Model zaten hatta.";
  line.efficiency=line.key===key?Math.max(.3,line.efficiency*.65):Math.max(.2,line.efficiency*.4);
  Object.assign(line,{key,level,work:0,status:"Yeni model"});
}
export function train(s,p,key,coastal){
  const u=units[key],e=s.industry;
  if(!u||p?.owner!==s.me)return "Kendi eyaletini seç.";
  if(["ship","usv"].includes(key)&&(!coastal||!count(p,"yard")))return "Kıyıda bir tersane gerekli.";
  if(["drone","plane"].includes(key)&&!count(p,"airbase"))return "Bu eyalette hava / İHA üssü gerekli.";
  if(s.men<u[1])return "İnsan gücü yetersiz.";
  const reserved={};
  for(const [family,need] of Object.entries(u[3])){
    let left=need;
    for(const id of Object.keys(e.inventory).filter(id=>models[id.split(".")[0]]?.family===family).sort((a,b)=>Number(b.split(".")[1])-Number(a.split(".")[1]))){
      if(!left)break;
      const n=Math.min(left,e.inventory[id]||0);
      if(n)reserved[id]=n;
      left-=n;
    }
    if(left)return "Depoda yeterli "+families[family].name.toLocaleLowerCase("tr")+" yok.";
  }
  for(const [id,n] of Object.entries(reserved))e.inventory[id]-=n;
  s.men-=u[1];e.training.push({id:++e.sequence,node:p.id,key,left:u[2],reserved});
}
export function research(s,key,month){
  const e=s.industry,lv=(e.levels[key]??5)+1;
  if(!branches[key]||lv>5||lv>eraAt(month))return "Sonraki aşama için takvim çağı bekleniyor.";
  if(e.study)return "Etkin araştırma tamamlanmalı.";
  e.study={key,level:lv,work:0};
}
export function changeLaw(s,key,value,month){
  const e=s.industry;
  if(!laws[key]||!Number.isInteger(value)||value<0||value>2)return "Geçersiz yasa.";
  if(e.laws[key]===value)return "Bu yasa zaten yürürlükte.";
  if(month-(e.changed[key]??-6)<6)return "Bu yasa için altı ay beklemelisin.";
  if(e.political<25)return "25 politik güç gerekli.";
  e.political-=25;e.laws[key]=value;e.changed[key]=month;
}
export function focus(s,era,index,month){
  const e=s.industry;
  if(!focusNames[era-1]?.[index]||era>eraAt(month)||era<1)return "Bu odak henüz açılmadı.";
  if(e.focus||hasFocus(e,era,index))return "Odak etkin veya tamamlanmış.";
  if(index<2&&hasFocus(e,era,1-index))return "Bu çağda diğer dal seçildi.";
  if(index===2&&!hasFocus(e,era,0)&&!hasFocus(e,era,1))return "Önce bir dalı tamamla.";
  const price=index===2?25:15;
  if(e.political<price)return price+" politik güç gerekli.";
  e.political-=price;e.focus={era,index,left:index===2?18:12};
}
export function marketStock(s,id){
  const e=s.industry;
  return e.market[id]??={steel:12,aluminium:8,oil:8,fuel:6,chips:0};
}
function treasury(s,id){
  if(id===s.me)return s;
  const n=s.p.filter(p=>p.owner===id).length;
  s.aiEconomy??={};
  return s.aiEconomy[id]??={gold:80+30*n,men:60+30*n};
}
export function quote(s,id,key,quantity){
  const supplier=quantity>0?marketStock(s,id):s.materials;
  const pressure=Math.min(2,Math.max(.65,1+.4*(10-supplier[key])/Math.max(1,supplier[key])));
  const tariff=quantity>0?[.95,1,1.12][s.industry.laws.trade]:.75;
  return Math.ceil(Math.abs(quantity)*resources[key][1]*pressure*tariff);
}
export function trade(s,id,key,quantity,partners,month){
  if(!partners.includes(id)||!resources[key]||![5,-5].includes(quantity))return "Geçerli bir ticaret rotası seç.";
  if(key==="chips"&&eraAt(month)<4)return "Yarı iletken pazarı IV. çağda açılır.";
  const e=s.industry,amount=Math.abs(quantity),buyer=quantity>0?s.me:id,seller=quantity>0?id:s.me;
  const used=e.routeUse[id]?.month===month?e.routeUse[id].amount:0;
  if(used+amount>10)return "Bu rotanın aylık kapasitesi dolu.";
  const supply=seller===s.me?s.materials:marketStock(s,id),wallet=treasury(s,buyer),price=quote(s,id,key,quantity);
  if(supply[key]<amount||wallet.gold<price)return "Satıcı stoku veya alıcı bütçesi yetersiz.";
  supply[key]-=amount;wallet.gold-=price;
  e.routeUse[id]={month,amount:used+amount};
  e.cargo.push({buyer,seller,key,amount,price,arrive:month+1});
}
function settle(s,month,owners,report){
  const e=s.industry;
  e.cargo=e.cargo.filter(c=>{
    if(c.arrive>month+1)return true;
    const blocked=!owners.has(c.seller)||!owners.has(c.buyer)||s.wars.some(pair=>pair.includes(c.buyer)&&pair.includes(c.seller));
    const destination=blocked?c.seller:c.buyer,payee=blocked?c.buyer:c.seller;
    const supplies=destination===s.me?s.materials:marketStock(s,destination);
    supplies[c.key]+=c.amount;treasury(s,payee).gold+=c.price;
    report(resources[c.key][0]+" · "+(blocked?"Sevkiyat iptal edildi; ödeme ve mal iade edildi.":c.amount+" birim teslim edildi."));
    return false;
  });
}
function produce(s,plants,month){
  const e=s.industry;
  const remaining={arms:plants.arms,yard:plants.yard};
  for(const line of e.lines){
    const type=line.yard?"yard":"arms";
    if(remaining[type]<=0){line.status="Tesis bekliyor";continue;}
    const factories=Math.min(line.factories||1,remaining[type]);
    remaining[type]-=factories;
    const model=recipe(line.key,line.level);
    let work=factories*(line.yard?5:6)*line.efficiency*[.9,1,1.2][e.laws.economy]*(1+.04*(e.levels.industry-1))*(hasFocus(e,2,0)?1.08:1)*(hasFocus(e,5,0)?1.08:1);
    const branch=officer(s,s.me,eraAt(month))?.[1],family=models[line.key].family;
    if(({K:["rifle"],T:["gun"],Z:["tank"],S:["tank","rifle"],H:["plane","drone"],D:["ship","usv"],M:["gun"]}[branch]||[]).includes(family))work*=1.04;
    if(spirits[isoOf(s.me)]?.[1]===type)work*=1.05;
    const full=work;
    for(const [key,n] of Object.entries(model.inputs))if(n>0)work=Math.min(work,s.materials[key]*model.work/n);
    if(work<=0){line.status="Hammadde bekliyor";continue;}
    for(const [key,n] of Object.entries(model.inputs))s.materials[key]=Math.max(0,round(s.materials[key]-work*n/model.work));
    line.status=work<full-.00001?"Kısıtlı üretim":"Üretimde";
    line.efficiency+=.06*(.95-line.efficiency)*(work/full);
    line.work=round(line.work+work);
    const finished=Math.floor(line.work/model.work);
    if(finished){const id=line.key+"."+line.level;e.inventory[id]=(e.inventory[id]||0)+finished;line.work-=finished*model.work;}
  }
}
function develop(s,regions,plants,report){
  const e=s.industry;
  const jobs=regions.filter(p=>p.construction&&!p.occupation?.disruption);
  // All construction sites share civilian capacity. A field works crew can rebuild a lost factory.
  const civilWork=(plants.civil?4*plants.civil:1)*[1.15,1,.8][e.laws.economy]*[1,1,.85][e.laws.service]*[.96,1,1.05][e.laws.trade];
  for(const p of jobs){
    const job=p.construction,bonus=job.type==="infra"&&hasFocus(e,1,0)?1.08:1;
    job.work+=civilWork*(spirits[isoOf(s.me)]?.[1]==="civil"?1.05:1)*bonus*(hasFocus(e,4,1)?1.08:1)/jobs.length;
    if(job.work>=buildings[job.type][1]){
      (p.plants??=[]).push(job.type);delete p.construction;report(p.label+" · "+buildings[job.type][0]+" tamamlandı.");
    }
  }
  const active=new Map();
  e.training=e.training.filter(j=>{
    const p=regions.find(v=>v.id===j.node);
    if(!p){report("Eğitim bölgesi kaybedildi: "+units[j.key][0]+".");return false;}
    if(p.occupation?.disruption)return true;
    const n=active.get(p.id)||0;
    if(n>=1+count(p,"depot"))return true;
    active.set(p.id,n+1);
    const fuelUse={motor:1,tank:2,plane:3,ship:2,drone:1,usv:1}[j.key]||0;
    if(s.materials.fuel<fuelUse){j.waitingFuel=true;return true;}
    j.waitingFuel=false;s.materials.fuel-=fuelUse;
    j.left-=hasFocus(e,1,1)?1.08:1;
    if(j.left>0)return true;
    p.army+=j.key==="infantry"?20:units[j.key][1];
    if(j.key==="infantry")p.barracks=(p.barracks||0)+1;
    else{
      const kind={motor:"tank",drone:"plane",usv:"ship"}[j.key]||j.key;
      p.equipment??={tank:0,plane:0,ship:0};p.equipment[kind]=(p.equipment[kind]||0)+1;p.unitType=kind;
    }
    (p.formations??=[]).push({key:j.key,equipment:j.reserved});
    report(p.label+" · "+units[j.key][0]+" eğitimi tamamlandı.");return false;
  });
}
export function advance(s,month,report=()=>{}){
  const e=s.industry,regions=owned(s),plants={};
  for(const type of Object.keys(buildings))plants[type]=sum(regions.filter(p=>!p.occupation?.disruption),p=>count(p,type));
  for(const p of s.p)if(p.construction?.owner!==p.owner)delete p.construction;
  for(const p of regions){
    for(const [key,n] of Object.entries(deposits(p)))s.materials[key]=round(s.materials[key]+n*(hasFocus(e,5,1)?1.08:1));
  }
  for(let i=0;i<plants.refinery;i++){
    if(s.materials.oil>=3){s.materials.oil-=3;s.materials.fuel+=(hasFocus(e,3,1)?4.32:4)*(spirits[isoOf(s.me)]?.[1]==="fuel"?1.05:1);}
    else if(s.gold>=2){s.gold-=2;s.materials.fuel+=2;}
  }
  for(let i=0;i<plants.electronics;i++){
    if(s.gold>=2&&s.materials.aluminium>=2){s.gold-=2;s.materials.aluminium-=2;s.materials.chips+=hasFocus(e,4,0)?2.16:2;}
  }
  const territoryByOwner=new Map(s.p.map(p=>[p.owner,p]));
  settle(s,month,territoryByOwner,report);
  for(const [id,stock] of Object.entries(s.aiStates?{}:e.market)){
    const territory=territoryByOwner.get(id);
    if(!territory)continue;
    const output=deposits(territory);
    for(const [key,n] of Object.entries(output))stock[key]=Math.min(100,round(stock[key]+n));
    stock.fuel=Math.min(100,stock.fuel+.25);
    if(eraAt(month)>=4)stock.chips=Math.min(100,stock.chips+.5);
  }
  produce(s,plants,month);
  develop(s,regions,plants,report);
  e.political=round(Math.min(300,e.political+1+s.stability/100));
  const flow=budget(s);
  e.budgetCarry=(e.budgetCarry||0)+flow.net;
  const delta=Math.trunc(e.budgetCarry);e.budgetCarry-=delta;
  const funds=s.gold+delta-e.arrears;
  s.gold=Math.max(0,funds);e.arrears=Math.max(0,-funds);
  e.deficitMonths=e.arrears>0?e.deficitMonths+1:0;
  if(e.deficitMonths>=3)s.stability=clamp100(s.stability-1);
  for(const p of regions){
    const eligible=p.recruitPool??(p.pop*1000);
    const recruited=eligible*[.0002,.00045,.0008][e.laws.service]*(hasFocus(e,2,1)?1.08:1);
    p.recruitPool=eligible-recruited;
    e.recruits=(e.recruits||0)+recruited/100;
  }
  e.recruits??=0;const recruited=Math.floor(e.recruits);s.men+=recruited;e.recruits-=recruited;
  const war=s.wars.some(pair=>pair.includes(s.me));
  e.support=round(clamp100(e.support+(war?-.25:.15)));
  if(!e.crisis&&s.stability<45&&month-e.lastCrisis>=12){e.crisis=true;e.lastCrisis=month;report("Meclis bütçe görüşmesi talep ediyor.");}
  if(e.study){
    const r=e.study;
    const specialization=["industry","usv","uav"].includes(r.key)&&plants.radar?1.1:1;
    const bonus=e.completed.filter(id=>id.endsWith(".2")).length*.05;
    r.work+=(e.teams===2&&plants.civil>=2?3.2:2)*(1+bonus)*(spirits[isoOf(s.me)]?.[1]==="study"?1.05:1)*specialization*(s.commander?1.05:1)*(r.key==="air"&&hasFocus(e,3,0)?1.08:1);
    if(r.work>=researchCost[r.level]){e.levels[r.key]=r.level;if(r.key==="land")s.tech=Math.max(s.tech||1,r.level);e.study=null;report(branches[r.key][r.level]+" araştırıldı.");}
  }
  if(e.focus&&--e.focus.left<=0){
    const f=e.focus;e.completed.push(f.era+"."+f.index);e.focus=null;report(focusNames[f.era-1][f.index]+" tamamlandı.");
  }
}

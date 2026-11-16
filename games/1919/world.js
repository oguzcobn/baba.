"use strict";
(async()=>{
if(new URLSearchParams(location.search).get("scenario")==="1919"){home();return;}
const root=document.getElementById("app");root.innerHTML='<main class="home"><h1>Dünya haritası yükleniyor…</h1></main>';
try{
const response=await fetch("../../data/countries-50m.json");if(!response.ok)throw Error("Harita indirilemedi");
const topology=await response.json(),geometries=topology.objects.countries.geometries;
const ids={"792":"tr","826":"gb","250":"fr","300":"gr","643":"ru"};
const shapeData=new Map(),previousOwners=new Map();
const trNames=new Intl.DisplayNames(["tr-TR"],{type:"region"});
const specialNames={"792":"Türkiye","826":"Birleşik Krallık","643":"Rusya"};
const geomValid=g=>Geo1919.validCountryId(g.id);
const validIds=new Set();
const features=topojson.feature(topology,topology.objects.countries).features.filter(f=>{
 if(!geomValid(f)||validIds.has(f.id))return false;
 validIds.add(f.id);return true;
});
for(const k of Object.keys(N))delete N[k];
RAW.length=0;LINKS.length=0;
for(const [i,f] of features.entries()){
 const id="c"+f.id,owner=ids[f.id]||id;
 const info=COUNTRY_META_1919[f.id]||["",""];
 const code=info[0],label=specialNames[f.id]||(code?trNames.of(code):null)||f.properties.name;
 const capital=info[1]||label;
 const paths=Geo1919.featurePath(f.geometry);
 const [x,y]=Geo1919.labelPoint(f.geometry);
 const paint="hsl("+((i*137.508)%360)+",26%,43%)";
 N[owner]=[label,"",paint,id,capital,code];RAW.push([id,label,x/10.5,(y-25)/5.7,owner]);shapeData.set(id,{paths,x,y});
}
N.ne=["Tarafsız","","#737b70","","",""];
const neighbours=topojson.neighbors(geometries),routesSeen=new Set();
geometries.forEach((g,i)=>{
 if(!geomValid(g))return;
 neighbours[i].forEach(j=>{
  const other=geometries[j];
  if(!geomValid(other)||other.id===g.id||!validIds.has(other.id))return;
  const a="c"+g.id,b="c"+other.id,key=Geo1919.routeKey(a,b);
  if(!routesSeen.has(key)){routesSeen.add(key);LINKS.push([a,b])}
 });
});
const landRoutes=new Set(LINKS.map(l=>l.slice().sort().join("|")));
const seaRoutes=new Set();
const arcUse=new Map();
const arcIds=g=>g.arcs.flat(Infinity).map(a=>a<0?~a:a);
for(const g of geometries)for(const a of new Set(arcIds(g)))arcUse.set(a,(arcUse.get(a)||0)+1);
const coastal=new Set(geometries.filter(g=>geomValid(g)&&arcIds(g).some(a=>arcUse.get(a)===1)).map(g=>"c"+g.id));
const routeKey=(a,b)=>[a,b].sort().join("|");
// Explicit maritime corridors: never connect countries merely because their centroids are close.
const maritimeCorridors=[
 ["826","250"],["504","724"],["380","300"],["818","682"],
 ["392","410"],["392","156"],["360","036"],["036","554"],
 ["840","192"],["192","332"],["792","196"],["620","076"],
 ["076","024"],["792","422"],["364","682"],["156","158"],
 ["304","352"],["352","826"],["124","304"],["608","704"],
 ["608","360"],["250","012"],["724","012"],["208","578"],
 ["356","144"],["458","360"]
];
const availableCountries=new Set(RAW.map(p=>p[0]));
for(const [a,b] of maritimeCorridors){
 const from="c"+a,to="c"+b,key=routeKey(from,to);
 if(!availableCountries.has(from)||!availableCountries.has(to)||!coastal.has(from)||!coastal.has(to)||landRoutes.has(key)||seaRoutes.has(key))continue;
 seaRoutes.add(key);LINKS.push([from,to]);
}
const equipment=p=>p.equipment||(p.equipment={tank:0,plane:0,ship:0});
// Save migration belongs to age.js; world saves are never copied over historical backups.
const troopArt='<ellipse cy="19" rx="10" ry="3" fill="#0007"/><path d="M-5 5-6 16-2 18 0 8 3 17 7 16 5 4" fill="#4c5140" stroke="#20291e"/><path d="M-6-6Q0-10 6-6L8 5 3 9-5 7Z" fill="#7b8057" stroke="#282f25"/><path d="M-6-4-10 5-6 7-2-2M5-4 11 3 8 6 3 0" fill="#899166" stroke="#323a2c"/><circle cy="-12" r="4" fill="#d5ad81"/><path d="M-5-12Q-5-20 2-18L6-13Z" fill="#4c5840" stroke="#1c281e"/><path d="M-8 10 9-13" stroke="#302a20" stroke-width="3"/><path d="M8-12 12-18" stroke="#c6c9b6" stroke-width="1.5"/><path d="M-5-1 5 2" stroke="#c4b28b" stroke-width="2"/>';
const tankArt='<ellipse cy="10" rx="19" ry="6" fill="#202827"/><rect x="-18" y="3" width="36" height="10" rx="5" fill="#555d50" stroke="#1c2420"/><path d="M-14 2-9-6 11-6 17 3Z" fill="#899379" stroke="#323a30"/><rect x="-5" y="-10" width="13" height="7" rx="3" fill="#6d795d"/><path d="M4-7 25-10" stroke="#bbc3a4" stroke-width="3"/><path d="M-12 8h25" stroke="#1d2822" stroke-dasharray="3 2" stroke-width="4"/>';
const planeArt='<path d="M0-18 3-3 22 3 22 7 3 4 3 16 10 19 10 22 0 19-10 22-10 19-3 16-3 4-22 7-22 3-3-3Z" fill="#b8bd9d" stroke="#303d36" stroke-width="1.4"/><path d="M-8-16h16" stroke="#d6d4b2" stroke-width="2"/><ellipse cy="-5" rx="2" ry="4" fill="#33484c"/>';
const shipArt='<path d="M-23 6 23 6 14 16-16 16Z" fill="#646e6b" stroke="#253b42"/><path d="M-15 6-11-3 12-3 17 6Z" fill="#a0a79a"/><path d="M-5-3V-12h6v9M7-3v-7h5v7" fill="#55605c"/><path d="M0-16v-10M-8-20h15" stroke="#bac2ae"/><path d="M-27 19Q-15 15 0 19T28 19" fill="none" stroke="#b7d9d4"/>';

marchingSvg=function(){
 if(!marching)return "";
 const from=shapeData.get(marching.from),to=shapeData.get(marching.to),origin=prov(marching.from);
 if(!from||!to||!origin)return "";
 const sea=seaRoutes.has(routeKey(marching.from,marching.to));
 const art=sea?shipArt:equipment(origin).tank?tankArt:troopArt;
 const path="M"+from.x+" "+from.y+" Q"+((from.x+to.x)/2)+" "+((from.y+to.y)/2-25)+" "+to.x+" "+to.y;
 return '<g pointer-events="none"><path d="'+path+'" fill="none" stroke="#f0d08a" stroke-width="2" stroke-dasharray="5 4"/><g><animateMotion dur="1.15s" path="'+path+'" fill="freeze"/><g transform="scale(.7)">'+art+'</g><text y="-24" text-anchor="middle" class="label" style="font-size:10px">'+marching.count+'</text></g></g>';
};
mapSVG=function(){
 const routes=LINKS.filter(l=>l.includes(sel)&&seaRoutes.has(routeKey(...l))).map(([a,b])=>{
 const x=shapeData.get(a),y=shapeData.get(b);
 // Never paint misleading cross-continental lines for long sea passages.
 if(!x||!y||Math.abs(x.x-y.x)>230||!Geo1919.nearForVisual(x,y,230))return "";
 return '<path class="sea-lane" d="M'+x.x+' '+x.y+' L'+y.x+' '+y.y+'" fill="none" stroke="#b7d5e2" stroke-dasharray="5 4" stroke-width="1.1" pointer-events="none"/>';
 }).join("");
 const countries=S.p.map(p=>{const a=shapeData.get(p.id),old=previousOwners.get(p.id),fill=color(p);previousOwners.set(p.id,fill);
 return '<path data-p="'+p.id+'" class="province '+(p.id===sel?'active':'')+'" fill="'+fill+'" d="'+a.paths+'" fill-rule="evenodd"><title>'+safe(p.label)+' · '+p.army+' asker</title>'+(old&&old!==fill?'<animate attributeName="fill" from="'+old+'" to="'+fill+'" dur="2s" fill="freeze"/>':'')+'</path>';
 }).join("");
 const markers=S.p.filter(p=>p.id===sel||p.owner===S.me).map(p=>{const a=shapeData.get(p.id);return '<g pointer-events="none" transform="translate('+a.x+' '+a.y+')"><g class="world-troop" transform="scale(.55)">'+({tank:tankArt,plane:planeArt,ship:shipArt}[p.unitType]||troopArt)+'</g><rect x="10" y="-7" width="28" height="13" rx="2" fill="#172322" stroke="#bea876"/><text x="24" y="3" text-anchor="middle" fill="#f3e1b8" font-size="8">'+p.army+'</text><text y="-16" text-anchor="middle" class="label" style="font-size:9px">'+safe(p.label)+'</text>'+(p.fort?'<path d="M-17 19v-8h4v-3h5v3h4v-3h5v11Z" fill="#b1ad99" stroke="#45514a"/>':'')+'</g>'}).join("");
 return '<svg id="world" viewBox="0 0 1080 650" aria-label="Oynanabilir dünya haritası"><defs><radialGradient id="world-sea"><stop stop-color="#385667"/><stop offset="1" stop-color="#152b3b"/></radialGradient></defs><rect width="1080" height="650" fill="url(#world-sea)"/>'+countries+routes+S.p.filter(p=>p.owner===S.me||p.id===sel).map(modelSvg).join("")+markers+marchingSvg()+'</svg>';
};
outcome=function(){if(S.win||S.loss)return;const territories=own();if(!territories.length||S.stability<=0){S.loss=true;dialog=null;log("Sefer sona erdi: devletin kontrolü çöktü.")}else if(territories.length>=Math.ceil(RAW.length*.6)){S.win=true;dialog=null;log("Zafer: dünya bölgelerinin yüzde 60’ı kontrol ediliyor.")}};
start=function(me,difficulty="normal"){archiveBeforeNew();S=initial(me);S.difficulty=difficulty;sel=N[me][3];tab="province";layer="political";dialog=null;moving=null;marching=null;++marchSeq;previousOwners.clear();save();render()};
home=function(){S=null;dialog=null;moving=null;marching=null;++marchSeq;document.querySelectorAll(".modalbg").forEach(x=>x.remove());app.innerHTML=gameHeader()+'<main class="home"><section class="hero"><div class="eyebrow">DÜNYA MODU · MODERN COĞRAFYA</div><h1>Dünyanın kaderini belirle.</h1><p>'+RAW.length+' ülke bölgesi. Her ülkeyle başla, diplomasi yap, ordunu büyüt ve sınırlarını genişlet.</p><div class="actions"><button class="gold" data-a="nations">Ülke Seç</button><button data-a="continue">Kayıtlı Sefere Dön</button><button data-a="saves">▤ Kayıtlar ve Yedekler</button><button data-a="historical">📜 1919 Anadolu Senaryosu</button></div></section><p class="muted">Alternatif tarih senaryosu. Coğrafya modern Natural Earth ülke sınırlarını kullanır; 1919’un tarihsel sınırları değildir. Deniz rotaları tanımlanmış deniz koridorlarına dayanır; deniz sevkiyatı gemi gerektirir.</p><div class="cards"><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+troopArt+'</svg><b>Kara Kuvvetleri</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+tankArt+'</svg><b>Zırhlı Birlik</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+planeArt+'</svg><b>Hava Kuvvetleri</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+shipArt+'</svg><b>Donanma</b></div></div></main>';wire()};

const commanderPortrait='<svg viewBox="0 0 80 90" width="70"><rect width="80" height="90" rx="4" fill="#17232b" stroke="#b69d69"/><path d="M9 88 15 60 33 53H47L65 60 72 88" fill="#6e7958"/><path d="M31 52 40 69 49 52" fill="#d7c6a4"/><path d="M37 66h6l4 22H34Z" fill="#263326"/><ellipse cx="40" cy="34" rx="15" ry="20" fill="#bfa07d"/><path d="M24 28 25 15Q40 5 56 15L57 29Z" fill="#4c5b47"/><path d="M20 26h40l-8 6H27Z" fill="#243325"/><path d="M35 41q5 5 10 0M30 34h5m10 0h5" fill="none" stroke="#625743"/><path d="m40 13 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Z" fill="#d8bf78"/><path d="M15 65h12m26 0h12" stroke="#e1c47b" stroke-width="4"/></svg>';
const oldNationPanel=nationPanel;nationPanel=function(){return '<div class="panel"><h3>Başkomutanlık</h3>'+commanderPortrait+'<p>'+(S.commander?'Kurmay heyeti göreve atandı.':'Kurmay heyeti ata: 120 altın, +1 teknoloji.')+'</p><button data-a="commander" '+(S.commander?'disabled':'')+'>Kurmay Heyetini Ata</button></div>'+oldNationPanel().replace("İzmir, Afyon, Eskişehir ve İstanbul'u ele geçir.","Dünya bölgelerinin yüzde 60’ını kontrol et.").replace("18 eyalete ulaş.","Dünya bölgelerinin yüzde 60’ını kontrol et.")};

const oldProvincePanel=provincePanel;
provincePanel=function(){
 const p=prov(sel);let html=oldProvincePanel();if(!p||p.owner!==S.me)return html;
 const e=equipment(p);
 return html+'<div class="panel"><h3>Birlik Üretimi</h3><p class="muted">Tank: kara saldırısında güç desteği. Uçak: havadan destek. Gemi: deniz rotasında taşıma.</p><div class="gridbtn">'+[
 ["tank","Tank",180,tankArt],["plane","Uçak",220,planeArt],["ship","Gemi",260,shipArt]
 ].map(([type,label,cost,art])=>'<button data-a="unit-'+type+'" '+(type==="ship"&&!coastal.has(p.id)?'disabled':'')+'><svg viewBox="-30 -30 60 60" width="55" height="55">'+art+'</svg><br>'+label+' · '+cost+' altın<br>Mevcut: '+e[type]+'</button>').join("")+'</div><p class="muted">Deniz sevkiyatı: kaynak bölgede gemi ve 10 altın gerekir. Tankların bir kısmı sevk edilen orduyla taşınır. Uçaklar üslerinde kalır.</p></div>';
};
const oldAct=act;
act=function(action){
 if(!S)return oldAct(action);
 if(marching&&(action.startsWith("unit-")||action==="commander"))return toast("Sevkiyatın tamamlanmasını bekle.");
 if(action==="commander"){if(S.commander||!pay(120))return;S.commander=true;S.tech++;save();render();return}
 if(action.startsWith("unit-")){
  const p=prov(sel);if(!p||p.owner!==S.me)return;
  const type=action.slice(5),cost={tank:180,plane:220,ship:260}[type];
  if(!cost)return;if(type==="ship"&&!coastal.has(p.id))return toast("Gemi üretimi kıyı bölgesi gerektirir.");
  if(!pay(cost))return;equipment(p)[type]++;p.unitType=type;
  log(p.label+": "+{tank:"tank",plane:"uçak",ship:"gemi"}[type]+" hazırlandı.");save();render();return;
 }
 return oldAct(action);
};
const oldOpenMove=openMove;
openMove=function(to){
 const f=prov(moving);if(!f)return;
 if(seaRoutes.has(routeKey(f.id,to))&&!equipment(f).ship)return toast("Bu deniz rotası için kaynak bölgede gemi üret.");
 return oldOpenMove(to);
};
const oldMarch=march;
march=function(){
 if(dialog?.kind!=="move")return;
 const f=prov(dialog.from),p=prov(dialog.to);if(!f||!p)return;
 if(seaRoutes.has(routeKey(f.id,p.id))){
  if(!equipment(f).ship)return toast("Deniz sevkiyatı için gemi gerekiyor.");
  if(S.gold<10)return toast("Deniz sevkiyatı için 10 altın gerekiyor.");
 }
 return oldMarch();
};
resolveMarch=function(d,n){
 if(!S)return;
 const f=prov(d.from),p=prov(d.to);if(!f||!p||f.moved||f.owner!==S.me)return;
 const sea=seaRoutes.has(routeKey(f.id,p.id)),eq=equipment(f);
 if(sea&&(!eq.ship||S.gold<10)){toast("Deniz sevkiyatı için gemi veya altın yetersiz.");render();return}
 if(f.owner!==p.owner&&!war(f.owner,p.owner)){toast("Hedefle savaşta değilsin.");render();return}
 n=clamp(n,1,f.army-1);if(f.army<2)return;
 const tanks=Math.min(eq.tank,Math.round(eq.tank*n/f.army));
 if(sea)S.gold-=10;
 f.army-=n;f.moved=true;
 if(f.owner===p.owner){p.army+=n;eq.tank-=tanks;equipment(p).tank+=tanks;log(f.label+" → "+p.label+": "+n+" asker sevk edildi.");}
 else{
  const atk=n*(.9+.07*S.tech)*(S.stability/85)*(1+Math.min(tanks,3)*.15+Math.min(eq.plane,3)*.10);
  const def=p.army*(1.1+p.fort*.18)*(1+Math.min(equipment(p).tank,3)*.08);
  const chance=atk/(atk+def),roll=((Math.sin(S.turn*11+n*3+toHash(p.id))+1)*.5-.5)*.22;
  if(chance+roll>.5){p.owner=f.owner;p.army=Math.max(1,Math.round(n*(.52+chance*.22)));p.happy=Math.max(30,p.happy-14);p.fort=Math.max(0,p.fort-1);p.equipment={tank:tanks,plane:0,ship:0};eq.tank-=tanks;p.unitType=tanks?"tank":"infantry";S.gold+=25;log(p.label+" ele geçirildi. Tank ve hava desteği saldırı hesabına katıldı.");}
  else{f.army+=Math.floor(n*.2);p.army=Math.max(1,Math.round(p.army*.77));eq.tank=Math.max(0,eq.tank-Math.ceil(tanks*.5));log(p.label+" saldırısı başarısız. Sevk edilen tankların yarısı kaybedildi.");}
 }
 dialog=null;moving=null;outcome();save();render();
};

ai=function(){
 const economy=S.aiEconomy ||= {};
 const allied=(a,b)=>S.alliances?.some(x=>x.includes(a)&&x.includes(b))||false;
 const truceActive=(a,b)=>(S.truce?.[[a,b].sort().join("-")]||0)>S.turn;
 for(const id of Object.keys(N).filter(k=>k!==S.me&&k!=="ne")){
  const regions=S.p.filter(p=>p.owner===id);if(!regions.length)continue;
  const state=economy[id] ||= {gold:80+regions.length*30,men:60+regions.length*30};
  const income=incomeOf(id);
  const army=regions.reduce((n,p)=>n+p.army,0),upkeep=Math.ceil(army*.23);
  state.gold=Math.min(1800,Math.max(0,state.gold+income-upkeep));
  state.men=Math.min(1800,state.men+Math.ceil(regions.reduce((n,p)=>n+p.pop,0)/75));
  if(state.gold===0&&income<upkeep)for(const p of regions)p.army=Math.max(1,Math.floor(p.army*.97));
  const border=regions.filter(p=>adj(p.id).some(n=>prov(n)&&prov(n).owner!==id));
  if(!border.length)continue;
  const base=border[(S.turn+toHash(id))%border.length];
  if(state.gold>=60&&state.men>=20&&(S.turn+toHash(id))%3===0&&base.army<200+regions.length*40){
    state.gold-=60;state.men-=20;base.army+=20;
  }
  // War declarations respect truce and alliances, with one active front per country.
  // A defensive alliance joins a war declared against its partner.
  for(const alliance of (S.alliances||[]).filter(pair=>pair.includes(id))){
    const partner=alliance.find(k=>k!==id),attack=S.wars.find(pair=>pair[1]===partner&&!pair.includes(id));
    if(!attack||S.wars.some(pair=>pair.includes(id)))continue;
    const aggressor=attack[0];
    if(!aggressor||aggressor===id||allied(id,aggressor)||truceActive(id,aggressor))continue;
    S.wars.push([id,aggressor]);log("🛡 "+name(id)+" müttefiki "+name(partner)+" savunmak için savaşa katıldı.");
  }
  const alreadyFighting=S.wars.some(pair=>pair.includes(id));
  if(!alreadyFighting&&S.turn>=10&&(S.turn+toHash(id))%17===0){
    const opponents=[...new Set(border.flatMap(p=>adj(p.id).map(n=>prov(n)?.owner).filter(Boolean)))].filter(other=>other!==id&&other!=="ne"&&!allied(id,other)&&!truceActive(id,other));
    const candidate=opponents.find(other=>{
      const enemy=S.p.filter(p=>p.owner===other).reduce((n,p)=>n+p.army,0);
      const power=regions.reduce((n,p)=>n+p.army,0);
      const threshold=other===S.me?({easy:2.2,normal:1.55,hard:1.2}[S.difficulty]||1.55):1.35;
      if(other===S.me&&S.turn-(S.aiLastWarAgainstPlayer||0)<9)return false;
      return power>enemy*threshold&&relation(id,other)<30;
    });
    if(candidate){S.wars.push([id,candidate]);if(candidate===S.me)S.aiLastWarAgainstPlayer=S.turn;log(name(id)+" "+name(candidate)+" devletine savaş ilan etti.")}
  }
  // Each country moves at most one army per turn, at an actual resource cost.
  for(const f of border){
    if(f.moved)continue;
    const threshold={easy:2.05,normal:1.65,hard:1.4}[S.difficulty]||1.65;
    const target=adj(f.id).map(prov).find(p=>p&&p.owner!==id&&war(id,p.owner)&&!allied(id,p.owner)&&!truceActive(id,p.owner)&&f.army>p.army*threshold+15&&(!seaRoutes.has(routeKey(f.id,p.id))||equipment(f).ship));
    if(!target)continue;
    const n=Math.floor(f.army*.6);if(n<2)continue;
    f.army-=n;f.moved=true;
    const attack=n*(1+Math.min(equipment(f).tank,3)*.15);
    const defense=target.army*(1.1+target.fort*.18);
    const chance=attack/(attack+defense);
    if(chance>.55){target.owner=id;target.army=Math.max(1,Math.round(n*.5));target.equipment={tank:0,plane:0,ship:0};target.unitType="infantry";log(name(id)+" "+target.label+" bölgesini ele geçirdi.")}
    else target.army=Math.max(1,Math.round(target.army*.82));
    break;
  }
 }
};

const oldRender=render;render=function(){
 document.querySelectorAll(".modalbg").forEach(x=>x.remove());
 if(S&&(S.win||S.loss)){
  const territory=own().length,army=own().reduce((sum,p)=>sum+p.army,0);
  app.innerHTML=gameHeader()+'<main class="home endgame-summary"><div class="hero"><div class="eyebrow">SEFER RAPORU · TUR '+S.turn+'</div><h1>'+(S.win?"🏆 Zafer":"⚑ Sefer Kaybedildi")+'</h1><p>'+(S.win?"Dünya bölgelerinin yüzde 60’ını ele geçirdin.":"Devletin tüm bölgelerini veya istikrarını kaybetti.")+'</p><div class="stats"><div class="stat">Bölgeler <b>'+territory+'</b></div><div class="stat">Kalan Ordu <b>'+army+'</b></div><div class="stat">Hazine <b>'+S.gold+'</b></div><div class="stat">Tur <b>'+S.turn+'</b></div></div><div class="actions"><button class="gold" data-a="menu">Yeni Sefer</button><button data-a="saves">Kayıtlar</button></div></div></main>';wire();return;
 }
 oldRender();
};
home();
}catch(error){root.innerHTML='<main class="home"><h1>Harita açılamadı</h1><p>'+safe(error.message)+'</p><button onclick="location.reload()">Tekrar dene</button></main>'}
})();

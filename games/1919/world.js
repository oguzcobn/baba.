"use strict";
(async()=>{
const root=document.getElementById("app");root.innerHTML='<main class="home"><h1>Dünya haritası yükleniyor…</h1></main>';
try{
const response=await fetch("../../data/countries-50m.json");if(!response.ok)throw Error("Harita indirilemedi");
const topology=await response.json(),geometries=topology.objects.countries.geometries;
const features=topojson.feature(topology,topology.objects.countries).features.filter(f=>f.id!=="010");
const project=([lon,lat])=>[(lon+180)*3,(90-lat)*3.6];
const ids={"792":"tr","826":"gb","250":"fr","300":"gr","643":"ru"};
const shapeData=new Map(),previousOwners=new Map();
for(const k of Object.keys(N))delete N[k];
RAW.length=0;LINKS.length=0;
for(const [i,f] of features.entries()){
 const id="c"+f.id,owner=ids[f.id]||id;
 const polygons=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;
 const largest=polygons.slice().sort((a,b)=>b[0].length-a[0].length)[0][0];
 const points=largest.map(project);const x=points.reduce((a,p)=>a+p[0],0)/points.length,y=points.reduce((a,p)=>a+p[1],0)/points.length;
 const paths=polygons.map(poly=>poly.map(ring=>ring.map((c,j)=>(j?"L":"M")+project(c).map(v=>v.toFixed(1)).join(" ")).join("")+"Z").join("")).join("");
 const label=f.properties.name,paint="hsl("+((i*137.508)%360)+",26%,43%)";
 N[owner]=[label,"",paint,id];RAW.push([id,label,x/10.5,(y-25)/5.7,owner]);shapeData.set(id,{paths,x,y});
}
N.ne=["Tarafsız","","#737b70",""];
const neighbours=topojson.neighbors(geometries);
geometries.forEach((g,i)=>{neighbours[i].forEach(j=>{if(j>i&&g.id!=="010"&&geometries[j].id!=="010")LINKS.push(["c"+g.id,"c"+geometries[j].id])})});
const landRoutes=new Set(LINKS.map(l=>l.slice().sort().join("|")));
const seaRoutes=new Set();
const arcUse=new Map();
const arcIds=g=>g.arcs.flat(Infinity).map(a=>a<0?~a:a);
for(const g of geometries)for(const a of new Set(arcIds(g)))arcUse.set(a,(arcUse.get(a)||0)+1);
const coastal=new Set(geometries.filter(g=>arcIds(g).some(a=>arcUse.get(a)===1)).map(g=>"c"+g.id));
const routeKey=(a,b)=>[a,b].sort().join("|");
for(const p of RAW.filter(p=>coastal.has(p[0]))){
 const near=RAW.filter(q=>q!==p&&coastal.has(q[0])&&!landRoutes.has(routeKey(p[0],q[0]))).sort((a,b)=>distanceTo(p,a)-distanceTo(p,b)).slice(0,2);
 for(const q of near){const k=routeKey(p[0],q[0]);if(!seaRoutes.has(k)){seaRoutes.add(k);LINKS.push([p[0],q[0]])}}
}
function distanceTo(a,b){const dx=Math.abs(a[2]-b[2]);return Math.hypot(Math.min(dx,1080/10.5-dx),a[3]-b[3])}
const equipment=p=>p.equipment||(p.equipment={tank:0,plane:0,ship:0});
const oldSave=localStorage.getItem(SAVE);if(oldSave&&!localStorage.getItem(SAVE+"_anadolu_backup"))localStorage.setItem(SAVE+"_anadolu_backup",oldSave);
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
 const routes=LINKS.filter(l=>l.includes(sel)&&seaRoutes.has(routeKey(...l))).map(([a,b])=>{const x=shapeData.get(a),y=shapeData.get(b);return '<path d="M'+x.x+' '+x.y+' L'+y.x+' '+y.y+'" fill="none" stroke="#b7d5e2" stroke-dasharray="5 4" stroke-width="1.3" pointer-events="none"/>'}).join("");
 const countries=S.p.map(p=>{const a=shapeData.get(p.id),old=previousOwners.get(p.id),fill=color(p);previousOwners.set(p.id,fill);
 return '<path data-p="'+p.id+'" class="province '+(p.id===sel?'active':'')+'" fill="'+fill+'" d="'+a.paths+'" fill-rule="evenodd"><title>'+safe(p.label)+' · '+p.army+' asker</title>'+(old&&old!==fill?'<animate attributeName="fill" from="'+old+'" to="'+fill+'" dur="2s" fill="freeze"/>':'')+'</path>';
 }).join("");
 const markers=S.p.filter(p=>p.id===sel||p.owner===S.me).map(p=>{const a=shapeData.get(p.id);return '<g pointer-events="none" transform="translate('+a.x+' '+a.y+')"><g class="world-troop" transform="scale(.55)">'+({tank:tankArt,plane:planeArt,ship:shipArt}[p.unitType]||troopArt)+'</g><rect x="10" y="-7" width="28" height="13" rx="2" fill="#172322" stroke="#bea876"/><text x="24" y="3" text-anchor="middle" fill="#f3e1b8" font-size="8">'+p.army+'</text><text y="-16" text-anchor="middle" class="label" style="font-size:9px">'+safe(p.label)+'</text>'+(p.fort?'<path d="M-17 19v-8h4v-3h5v3h4v-3h5v11Z" fill="#b1ad99" stroke="#45514a"/>':'')+'</g>'}).join("");
 return '<svg id="world" viewBox="0 0 1080 650" aria-label="Oynanabilir dünya haritası"><defs><radialGradient id="world-sea"><stop stop-color="#385667"/><stop offset="1" stop-color="#152b3b"/></radialGradient></defs><rect width="1080" height="650" fill="url(#world-sea)"/>'+countries+routes+S.p.filter(p=>p.owner===S.me||p.id===sel).map(modelSvg).join("")+markers+marchingSvg()+'</svg>';
};
outcome=function(){const territories=own();if(!territories.length){S.loss=true;event("Sefer sona erdi","Tüm bölgelerinin kontrolünü kaybettin.")}else if(territories.length>=Math.ceil(RAW.length*.6)){S.win=true;event("Dünya gücü","Dünya bölgelerinin yüzde 60’ını kontrol ediyorsun.")}};
start=function(me){S=initial(me);sel=N[me][3];tab="province";layer="political";dialog=null;moving=null;previousOwners.clear();save();render()};
home=function(){S=null;dialog=null;moving=null;document.querySelectorAll(".modalbg").forEach(x=>x.remove());app.innerHTML=gameHeader()+'<main class="home"><section class="hero"><div class="eyebrow">DÜNYA SEFERİ</div><h1>Dünyanın kaderini belirle.</h1><p>'+RAW.length+' ülke bölgesi. Her ülkeyle başla, diplomasi yap, ordunu büyüt ve sınırlarını genişlet.</p><div class="actions"><button class="gold" data-a="nations">Ülke Seç</button><button data-a="continue">Kayıtlı Sefere Dön</button></div></section><p class="muted">Alternatif tarih senaryosu. Coğrafya modern Natural Earth ülke sınırlarını kullanır; 1919’un tarihsel sınırları değildir. Kıyı bölgeleri yakın kıyılara deniz rotalarıyla bağlanır; deniz sevkiyatı gemi gerektirir.</p><div class="cards"><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+troopArt+'</svg><b>Kara Kuvvetleri</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+tankArt+'</svg><b>Zırhlı Birlik</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+planeArt+'</svg><b>Hava Kuvvetleri</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+shipArt+'</svg><b>Donanma</b></div></div></main>';wire()};

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
 for(const id of Object.keys(N).filter(k=>k!==S.me&&k!=="ne")){
  const regions=S.p.filter(p=>p.owner===id);if(!regions.length)continue;
  const border=regions.filter(p=>adj(p.id).some(n=>prov(n)?.owner!==id));
  if(!border.length)continue;const base=border[S.turn%border.length];base.army+=6;
  if(S.turn%4===0&&coastal.has(base.id))equipment(base).ship=Math.max(1,equipment(base).ship);
  if(S.turn%5===0)equipment(base).tank++;
  if(S.turn>=7&&S.turn%9===7&&border.some(p=>adj(p.id).some(n=>prov(n)?.owner===S.me))&&!war(id,S.me)){S.wars.push([id,S.me]);log(name(id)+" savaş ilan etti.")}
  for(const f of border){
   const p=adj(f.id).map(prov).find(p=>p&&war(id,p.owner)&&f.army>p.army*1.6+16&&(!seaRoutes.has(routeKey(f.id,p.id))||equipment(f).ship));
   if(!p)continue;
   const n=Math.floor(f.army*.67);f.army-=n;f.moved=true;
   if(n*(1+Math.min(equipment(f).tank,3)*.15)>p.army*(1+p.fort*.12)){
    p.owner=id;p.army=Math.max(1,Math.round(n*.48));p.equipment={tank:0,plane:0,ship:0};p.unitType="infantry";log(name(id)+" "+p.label+" bölgesini ele geçirdi.");
   }else p.army=Math.max(1,Math.round(p.army*.79));break;
  }
 }
};
const oldRender=render;render=function(){document.querySelectorAll(".modalbg").forEach(x=>x.remove());oldRender()};
home();
}catch(error){root.innerHTML='<main class="home"><h1>Harita açılamadı</h1><p>'+safe(error.message)+'</p><button onclick="location.reload()">Tekrar dene</button></main>'}
})();

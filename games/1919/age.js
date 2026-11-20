import { CHOICES } from "./data/choices.js";
import { ART,MODEL_NAMES } from "./ui/building-art.js";
import { troopArt,tankArt,planeArt,shipArt } from "./ui/unit-art.js";
import { ico } from "./ui/icons.js";
import * as anatolia from "./data/anatolia.js";
import { playable } from "./data/playable.js";
import { loadWorld } from "./world.js";
import StrategyTime from "./engine/calendar.js";
import * as Industry from "./engine/industry.js";
import { buildings, units } from "./data/industry.js";
import { industryPanel, researchPanel, politicsPanel, resourceBar, wireMarket } from "./ui/industry.js";
import { updateAtlas } from "./ui/atlas.js";
import { bindDrawer, openDrawer } from "./ui/drawer.js";
const W = new URLSearchParams(location.search).get("scenario")!=="1919";
let scenario;
try { scenario=W?await loadWorld():anatolia; }
catch(error){document.getElementById("app").textContent="Harita yüklenemedi. Sayfayı yenileyin. "+error.message; throw error;}
const {N,RAW,LINKS,shapeData,seaRoutes,coastal}=scenario;
const {EVENTS}=anatolia;
const routeKey=(a,b)=>[a,b].sort().join("|");
const app=document.getElementById("app"),SAVE="baba_1919_age_v1",SAVEKEY=new URLSearchParams(location.search).get("scenario")==="1919"?SAVE+"_historical":SAVE;let S=null,sel="Ankara",tab="province",layer="political",moving=null,dialog=null,zoom=1,px=0,py=0,drag=null,ignoreClick=false,marching=null,actionFx=null,fxSeq=0,marchSeq=0,capturedProvince=null,ZMAX=10;
const safe=x=>String(x??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),name=id=>N[id]?.[0]||id,prov=id=>S?.p.find(p=>p.id===id),adj=id=>[...new Set(LINKS.filter(x=>x.includes(id)).map(x=>x[0]===id?x[1]:x[0]))].filter(x=>prov(x)),own=()=>S.p.filter(p=>p.owner===S.me),date=t=>StrategyTime.stamp(S,t).toLocaleDateString("tr-TR",{month:"long",year:"numeric",timeZone:"UTC"});
const BASE_INCOME=20;
function incomeOf(id){return S.p.filter(p=>p.owner===id).reduce((n,p)=>n+Math.round(p.pop*.12+p.dev*4+(p.market||0)*8+(p.farm||0)*4),0)+tradeBonus(id)+BASE_INCOME}
function flag(id){
 const code=(N[id]?.[5]||{tr:"TR",gr:"GR",gb:"GB",fr:"FR",ru:"RU",ne:"--"}[id]||id.slice(-2)).toUpperCase().slice(0,2);
 return '<svg class="country-mark" role="img" aria-label="'+safe(name(id))+'" viewBox="0 0 36 24"><rect x="1" y="1" width="34" height="22" rx="4" fill="#253c4b" stroke="#bda36d"/><text x="18" y="16" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="800" fill="#f6deb1">'+safe(code)+'</text></svg>';
}
const ACTION_LABELS={recruit:"20 askerin eğitimi başladı",invest:"altyapı yatırımı",market:"pazar inşaatı",farm:"çiftlik inşaatı",fort:"tahkimat inşaatı",festival:"halk şenliği",tax:"Vergi politikası",research:"Teknoloji araştırması",mobilize:"Seferberlik",stabilize:"İdari reform"};

function initial(me){const p=RAW.map(([id,label,x,y,owner],i)=>({id,label,x,y,owner,army:30+(i*7)%30,pop:20+(i*11)%60,dev:1+i%3,fort:0,market:0,farm:0,barracks:0,investment:0,festivals:0,happy:68+i%24,moved:false}));const capital=p.find(x=>x.id===N[me][3]);capital.owner=me;capital.army=100;return{me,p,turn:1,gold:430,men:380,tech:1,stability:85,relations:{},wars:[],truce:{},alliances:[],log:[{t:1,msg:"Sefer başladı. Bir eyalet seç, asker yetiştir ve turu bitir."}],seen:[],decisions:{},aiEconomy:{},treaties:{trade:[]},difficulty:"normal",win:false,loss:false}}
function save(){if(S)localStorage.setItem(SAVEKEY,JSON.stringify(S))}
function archiveBeforeNew(){const old=localStorage.getItem(SAVEKEY);if(!old)return;try{const state=JSON.parse(old);if(!state?.p?.length)return;const key=SAVEKEY+"_archives",archives=JSON.parse(localStorage.getItem(key)||"[]");if(!archives.some(a=>a.game===old)){archives.unshift({savedAt:Date.now(),game:old});localStorage.setItem(key,JSON.stringify(archives.slice(0,3)))}}catch(e){console.warn("Sefer yedeklenemedi",e)}}
function saveSlots(){const slots=[1,2,3].map(n=>{let item=null;try{item=JSON.parse(localStorage.getItem(SAVEKEY+"_slot_"+n))}catch{}return '<div class="panel"><h3>Kayıt '+n+'</h3><p class="muted">'+(item?.me&&N[item.me]?safe(name(item.me))+" · Tur "+item.turn:"Boş kayıt yuvası")+'</p><div class="actions"><button data-a="slot-save-'+n+'" '+(!S?'disabled':'')+'>💾 Kaydet</button><button data-a="slot-load-'+n+'" '+(!item?'disabled':'')+'>↪ Yükle</button></div></div>'}).join("");let archive=[];try{archive=JSON.parse(localStorage.getItem(SAVEKEY+"_archives")||"[]")}catch{}const backups=archive.map((a,i)=>{try{const st=JSON.parse(a.game);return '<button data-a="archive-load-'+i+'">'+safe(name(st.me))+' · Tur '+st.turn+' · Önceki sefer '+(i+1)+'</button>'}catch{return ""}}).join("");app.innerHTML=gameHeader()+'<main class="home"><h1>Sefer Kayıtları</h1><p class="muted">Üç manuel kayıt, otomatik kayıt ve yeni sefere başlamadan önce saklanan son üç sefer.</p><div class="actions"><button data-a="continue">↪ Otomatik kayda dön</button><button data-a="menu">⌂ Menü</button></div><div class="cards">'+slots+'</div>'+(backups?'<div class="panel"><h3>Önceki sefer yedekleri</h3><div class="actions">'+backups+'</div></div>':"")+'</main>';wire()}
function loadStored(raw){try{const st=JSON.parse(raw);if(!st?.p||st.p.length!==RAW.length||!N[st.me])throw Error("Bu kayıt farklı harita sürümünden.");archiveBeforeNew();localStorage.setItem(SAVEKEY,raw);if(!load())throw Error("Kayıt açılamadı.");sel=N[S.me][3];tab="province";dialog=null;moving=null;marching=null;++marchSeq;render();return}catch(e){toast("Kayıt yüklenemedi: "+e.message)}}

function load(){try{const s=JSON.parse(localStorage.getItem(SAVEKEY));if(s&&s.p?.length===RAW.length&&N[s.me]){S=s;return true}}catch{}return false}
function migrateHistoricalSave(){if(SAVEKEY===SAVE||localStorage.getItem(SAVEKEY))return;for(const key of [SAVE+"_anadolu_backup",SAVE]){const raw=localStorage.getItem(key);if(!raw)continue;try{const candidate=JSON.parse(raw);if(candidate?.p?.length===RAW.length&&N[candidate.me]){localStorage.setItem(SAVEKEY,raw);return}}catch{}}}
migrateHistoricalSave();
function log(msg){S.log.unshift({t:S.turn,msg});S.log=S.log.slice(0,80)}
function war(a,b){return b==="ne"||a==="ne"||S.wars.some(x=>x.includes(a)&&x.includes(b))}
function relation(a,b){return S.relations[[a,b].sort().join("-")]??0}
function tradeBonus(id){return (S?.treaties?.trade||[]).filter(pair=>pair.includes(id)&&!war(pair[0],pair[1])&&pair.every(country=>S.p.some(p=>p.owner===country))).length*12}
function rel(a,b,delta){const k=[a,b].sort().join("-");S.relations[k]=clamp(relation(a,b)+delta,-100,100)}
function toast(t){const n=document.createElement("div");n.className="warn";n.style.cssText="position:fixed;right:12px;bottom:74px;z-index:60;max-width:350px;background:#31556a;box-shadow:0 10px 30px #000a";n.textContent=t;document.body.appendChild(n);setTimeout(()=>n.remove(),2500)}
function pay(n){if(S.gold<n){toast(n+" altın gerekiyor.");return false}S.gold-=n;return true}
function gameHeader(){return '<header class="top"><div><strong>1919 <span class="brand-separator">·</span> MEDENİYETLERİN ÇAĞI</strong><small>'+(SAVEKEY===SAVE?'DÜNYA MODU · MODERN SINIRLAR':'1919–1923 · ANADOLU SENARYOSU')+'</small></div><nav><button data-a="menu">'+ico("menu")+' Menü</button><button data-a="save">'+ico("save")+' Kaydet</button><button data-a="saves">'+ico("files")+' Kayıtlar</button><button data-a="help">'+ico("help")+' Yardım</button></nav></header>'}
function baseHome(){S=null;moving=null;dialog=null;app.innerHTML=gameHeader()+'<main class="home"><section class="hero"><div class="eyebrow">1919–1923 · ALTERNATİF TARİH</div><h1>Bir devlet seç.<br><span style="color:#f2d497">Tarihi sen yaz.</span></h1><p>Age of Civilizations tarzı tur bazlı strateji. Eyaletlerini yönet, ordu yetiştir, komşu bölgelere ilerle, diplomasi yap ve medeniyetini genişlet.</p><div class="actions"><button class="gold" data-a="nations">Yeni Sefer Başlat</button>'+(localStorage.getItem(SAVEKEY)?'<button data-a="continue">↪ Seferine Devam Et</button>':"")+'<button data-a="help">Nasıl Oynanır?</button><button data-a="world">🌍 Dünya Hakimiyeti</button></div></section><div class="cards"><div class="card"><b>🗺️ 32 eyalet</b><small>Anadolu haritasında siyasi sınırlar ve kontrol alanları</small></div><div class="card"><b>⚔ Tur bazlı savaş</b><small>Komşu eyalete birlik gönder, savunma kur ve fethet</small></div><div class="card"><b>🏛 Diplomasi</b><small>İlişkiler, savaş, ateşkes ve ittifak</small></div></div><p class="muted" style="margin-top:18px">Eyalet şekilleri ve ekonomi değerleri oyun tasarımı için sadeleştirilmiştir; tarihsel sınırların birebir haritası değildir.</p></main>';wire()}
function nations(){
 const featured=["tr","gb","fr","gr","ru"],collator=new Intl.Collator("tr-TR",{sensitivity:"base"});
 const items=Object.entries(N).filter(([id])=>id!=="ne" && (!W || playable.has(N[id][3].slice(1))))
 .sort(([a,va],[b,vb])=>{const ia=featured.indexOf(a),ib=featured.indexOf(b);if(ia!==-1||ib!==-1)return (ia===-1?999:ia)-(ib===-1?999:ib);return collator.compare(va[0],vb[0])});
 app.innerHTML=gameHeader()+'<main class="home nation-picker"><h1>Devletini seç</h1><p class="muted">'+(SAVEKEY===SAVE?'Dünya modu: modern coğrafya üzerinde alternatif tarih. 1919–1923 tarihsel Anadolu senaryosu ayrı bir moddur.':'1919–1923: 32 temsili Anadolu bölgesiyle Millî Mücadele seferi.')+'</p><div class="panel nation-controls"><label for="campaign-tempo">Tur süresi</label><select id="campaign-tempo"><option value="6">6 ay · Yaz / Kış</option><option value="3">3 ay · Dört mevsim</option></select><label for="difficulty">Zorluk</label><select id="difficulty"><option value="easy">Kolay</option><option value="normal" selected>Normal</option><option value="hard">Zor</option></select><label for="nation-filter">Ülke ara</label><input id="nation-filter" type="search" placeholder="Ülke veya başkent ara" autocomplete="off"></div><p class="small">'+(SAVEKEY===SAVE?'Öne çıkan devletler başta; diğerleri Türkçe alfabetik sırada.':'Millî Mücadele ve alternatif tarih devletleri.')+'</p><div class="cards country-grid">'+items.map(([id,v])=>'<button class="card" data-n="'+safe(id)+'">'+flag(id)+'<b>'+safe(v[0])+'</b><small>Başkent: '+safe(v[4]||v[3])+'</small></button>').join("")+'</div><p id="nation-empty" class="muted" hidden>Aramanla eşleşen devlet yok.</p></main>';
 wire();
}
function start(me,difficulty="normal"){archiveBeforeNew();if(W&&!playable.has(N[me]?.[3]?.slice(1)))return;S=initial(me);StrategyTime.setTempo(S,Number(document.querySelector("#campaign-tempo")?.value)||6);S.difficulty=difficulty;sel=N[me][3];tab="province";layer="political";save();render();if(!W&&me==="tr")event("19 Mayıs 1919 — Samsun'a Çıkış","Millî Mücadele başladı. Ankara'da asker yetiştir, ekonomini geliştir ve batı bölgelerini hedefle.")}
function clip(poly,a,b,c){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=a*p[0]+b*p[1]-c,v=a*q[0]+b*q[1]-c;if(u<=0)out.push(p);if((u<0&&v>0)||(u>0&&v<0)){const t=u/(u-v);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}return out}
function polygon(p){let poly=[[0,0],[1080,0],[1080,650],[0,650]],x=p.x*10.5,y=p.y*5.7+25;for(const q of S.p){if(q===p)continue;const xx=q.x*10.5,yy=q.y*5.7+25;poly=clip(poly,xx-x,yy-y,(xx*xx+yy*yy-x*x-y*y)/2)}return poly.map(a=>a.join(",")).join(" ")}
function color(p){if(layer==="army")return "hsl("+(125-Math.min(1,p.army/150)*95)+",44%,43%)";if(layer==="economy")return "hsl("+(30+Math.min(1,p.dev/9)*100)+",39%,42%)";if(layer==="happiness")return "hsl("+(p.happy*1.2)+",40%,43%)";return N[p.owner][2]}
function pulseAction(type,id){const token=++fxSeq;actionFx={type,id,token};setTimeout(()=>{if(actionFx&&actionFx.token===token){actionFx=null;if(S)render()}},1500);}
function baseRender(){if(!S)return home();if(S.win||S.loss){const regions=own();app.innerHTML=gameHeader()+'<main class="home endgame-summary"><div class="hero"><div class="eyebrow">1919–1923 · TUR '+S.turn+'</div><h1>'+(S.win?"🏆 Millî Mücadele Zaferi":"⚑ Sefer Kaybedildi")+'</h1><p>'+(S.win?"Hedef bölgeleri ele geçirdin.":"Devletin topraklarını veya istikrarını kaybetti.")+'</p><div class="stats"><div class="stat">Bölge <b>'+regions.length+'</b></div><div class="stat">Ordu <b>'+regions.reduce((n,p)=>n+p.army,0)+'</b></div><div class="stat">Hazine <b>'+S.gold+'</b></div><div class="stat">Tur <b>'+S.turn+'</b></div></div><div class="actions"><button class="gold" data-a="menu">Yeni Sefer</button><button data-a="saves">Kayıtlar</button><button data-a="world">🌍 Dünya Modu</button></div></div></main>';wire();return}
 Industry.initialize(S,N[S.me][3]);
 const a=own(),army=a.reduce((n,p)=>n+p.army,0),previousTab=app.querySelector(".tabs .on")?.dataset.tab,previousScroll=app.querySelector(".sidebody")?.scrollTop||0;
 if(!app.querySelector(".game")){
   app.innerHTML=gameHeader()+'<div class="game"><div class="resources"></div><div class="campaign-clock" aria-live="polite"></div><div class="layout" data-drawer="half"><section class="maparea"><div class="toolbar">'+[["political","Siyasi"],["army","Ordu"],["economy","Ekonomi"],["happiness","Memnuniyet"]].map(([id,n])=>'<button data-layer="'+id+'" class="'+(layer===id?"selected":"")+'">'+ico(({political:"globe",army:"swords",economy:"coins",happiness:"people"})[id])+' '+n+'</button>').join("")+'<button data-a="center">'+ico("pin")+' Ortala</button><input id="map-search" type="search" list="map-search-options" placeholder="Ülke veya bölge ara" aria-label="Ülke veya bölge ara"><datalist id="map-search-options">'+S.p.map(p=>'<option value="'+safe(p.label)+'">').join("")+'</datalist></div><div id="viewport" class="viewport"><svg id="world" viewBox="0 0 1080 650" aria-label="Strateji haritası"></svg><canvas class="map-fx" aria-hidden="true"></canvas><div class="maptip"></div><div class="zoom"><button data-a="plus" title="Haritayı yakınlaştır" aria-label="Yakınlaştır">'+ico("plus")+'</button><button data-a="minus" title="Haritayı uzaklaştır" aria-label="Uzaklaştır">'+ico("minus")+'</button></div></div><div class="bottom"></div></section><aside class="side"><div class="drawer-controls"><button id="drawer-resize" aria-label="Karargâh boyutunu değiştir">Karargâh ▴</button><button id="drawer-close" aria-label="Karargâhı küçült">Küçült</button></div><div class="tabs">'+[["province","Eyalet"],["industry","Sanayi"],["researchLab","Araştırma"],["policies","Meclis"],["nation","Devlet"],["diplomacy","Diplomasi"],["events","Olaylar"]].map(([id,n])=>'<button data-tab="'+id+'" class="'+(tab===id?"on":"")+'">'+n+'</button>').join("")+'</div><div class="sidebody"></div></aside></div></div>';
   bindDrawer(app);
 }
 function region(selector,markup){
   const node=app.querySelector(selector);
   if(node._markup!==markup){node.innerHTML=markup;node._markup=markup;}
 }
 region(".resources",'<span>'+flag(S.me)+' <b>'+safe(name(S.me))+'</b></span><span>'+ico("calendar")+' <b>'+date(S.turn)+'</b></span><span>'+ico("coins")+' Altın <b>'+S.gold+'</b></span><span>'+ico("chart")+' Net/tur <b>'+Math.round(Industry.budget(S).net*StrategyTime.tempo(S))+'</b></span><span>'+ico("swords")+' Ordu <b>'+army+'</b></span><span>'+ico("people")+' İnsan Gücü <b>'+S.men+'</b></span><span>'+ico("book")+' Doktrin <b>'+S.tech+'</b></span><span>'+ico("shield")+' İstikrar <b>'+S.stability+'%</b></span>'+resourceBar(S));
 region(".bottom",'<span class="small">'+safe(prov(sel)?.label||"Eyalet")+'</span><button data-a="recruit" '+(prov(sel)?.owner!==S.me?"disabled":"")+'>'+ico("plus")+' Asker</button>'+(moving?'<button data-a="cancelmove">✕ İptal</button>':'')+'<button data-a="move" '+(prov(sel)?.owner!==S.me?"disabled":"")+'>'+ico("swords")+' Ordu Gönder</button><span class="spacer"></span><button class="gold" data-a="end">Turu Bitir '+ico("arrow")+'</button>');
 region(".sidebody",sidebar());
 if(tab==="industry")wireMarket(S);
 app.querySelector(".maptip").textContent=(moving?"Ordu: "+prov(moving).label+": komşu hedefi seç":"Bölge seç · asker yetiştir · tur bitir");
 app.querySelector(".campaign-clock").textContent=date(S.turn)+" · "+StrategyTime.season(S)+" · "+StrategyTime.tempo(S)+" ay/tur · "+StrategyTime.caption(S);
 app.querySelectorAll("[data-layer]").forEach(b=>b.classList.toggle("selected",b.dataset.layer===layer));
 app.querySelectorAll(".tabs [data-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));
 updateAtlas({state:S,selected:sel,shapeData,polygon,color,links:LINKS,seaRoutes,moving,adj,modelSvg,markerSvg,marching,actionFx,capturedProvince});
 wire();transform();
 app.querySelector(".sidebody").scrollTop=previousTab===tab?previousScroll:0;
 if(dialog)modal();
}
const historicalPorts=new Set(["Istanbul","Canakkale","Izmir","Antalya","Samsun","Trabzon","Inebolu","Mersin","Giresun","Izmit"]);
function isCoastal(p){return !!p && (W?coastal:historicalPorts).has(p.id);}
function tradePartners(){
 const owners=new Map(S.p.map(p=>[p.id,p.owner])),ids=new Set();
 for(const [a,b] of LINKS){
   const left=owners.get(a),right=owners.get(b);
   if(left===S.me)ids.add(right);
   if(right===S.me)ids.add(left);
 }
 for(const pair of S.treaties?.trade||[])if(pair.includes(S.me))ids.add(pair.find(id=>id!==S.me));
 const active=new Set(owners.values());
 return [...ids].filter(id=>id&&id!==S.me&&id!=="ne"&&active.has(id)&&!war(S.me,id)).sort((a,b)=>name(a).localeCompare(name(b),"tr"));
}
function sidebar(){
 const p=prov(sel),month=StrategyTime.month(S,S.turn);
 if(tab==="industry")return industryPanel(S,p,isCoastal(p),month,tradePartners(),name);
 if(tab==="researchLab")return researchPanel(S,month);
 if(tab==="policies")return politicsPanel(S,month);
 if(tab==="province")return baseProvincePanel()+(p?.owner===S.me?'<button data-tab="industry">Tesisler, üretim ve eğitim</button>':"");
 return tab==="nation"?nationPanel():tab==="diplomacy"?diplomacyPanel():eventsPanel();
}
function baseProvincePanel(){const p=prov(sel);if(!p)return "";const mine=p.owner===S.me;return (mine&&p.productionQueue?.length?'<div class="panel"><h3>Üretim sırası</h3>'+p.productionQueue.map(j=>StrategyTime.orders[j.type][0]+' · '+j.left+' ay').join('<br>')+'</div>':'')+'<div class="eyebrow">EYALET YÖNETİMİ</div><h2>'+safe(p.label)+'</h2><p>'+flag(p.owner)+' '+name(p.owner)+'</p><div class="stats"><div class="stat">⚔ Asker <b>'+p.army+'</b></div><div class="stat">👥 Nüfus <b>'+p.pop+'k</b></div><div class="stat">🏛 Gelişim <b>'+p.dev+'</b></div><div class="stat">☺ Memnuniyet <b>'+p.happy+'%</b></div></div><div class="panel"><h3>'+(mine?"Eyalet Kararları":"Yabancı Eyalet")+'</h3>'+(mine?'<p class="muted">Altın harcayarak asker ve üretim kapasitesini artır.</p><div class="gridbtn"><button class="gold" data-a="recruit">Piyade eğit<br>4 parti teçhizat · 8 ay</button><button data-a="move">↗ Ordu Gönder</button><button data-a="invest">📈 Yatırım<br>75 altın</button><button data-a="market">🏦 Pazar<br>95 altın</button><button data-a="farm">🌾 Çiftlik<br>85 altın</button><button data-a="fort">🛡 Tahkimat<br>65 altın</button><button data-a="festival" class="full">🎊 Halk Şenliği · 40 altın</button></div>':'<p class="muted">Düşman ülkeye saldırmak için Diplomasi sekmesinden savaş ilan et, ardından kendi komşu eyaletinden asker gönder.</p><button data-tab="diplomacy">Diplomasi</button>')+'</div><div class="panel"><h3>Komşu Bölgeler</h3>'+adj(p.id).map(id=>'<button data-j="'+id+'" class="chip">'+flag(prov(id).owner)+' '+prov(id).label+'</button>').join("")+'</div>'}
function baseNationPanel(){const p=own(),army=p.reduce((a,q)=>a+q.army,0),income=Math.round(Industry.budget(S).income*StrategyTime.tempo(S)),net=Math.round(Industry.budget(S).net*StrategyTime.tempo(S));return '<div class="panel"><h3>'+StrategyTime.caption(S)+'</h3><p>Çelik '+Math.floor(S.materials.steel)+' · Yakıt '+Math.floor(S.materials.fuel)+'</p><button data-a="tempo">Tur süresi · '+StrategyTime.tempo(S)+' ay ⇄</button></div><div class="eyebrow">ULUSAL YÖNETİM</div><h2>'+flag(S.me)+' '+name(S.me)+'</h2><div class="stats"><div class="stat">Eyalet <b>'+p.length+'</b></div><div class="stat">Ordu <b>'+army+'</b></div><div class="stat">Gelir <b>'+income+'</b></div><div class="stat">Net <b>'+net+'</b></div></div><div class="panel"><h3>Zafer Hedefi</h3><p class="muted">'+(S.me==="tr"?"İzmir, Afyon, Eskişehir ve İstanbul'u ele geçir.":"18 eyalete ulaş.")+'</p></div><div class="panel"><h3>Devlet Kararları</h3><p class="muted">Bütçeye her ay tesis gelirleri ve birlik bakım giderleri işlenir. Giderler hazineden karşılanabiliyorsa istikrar düşmez.</p><div class="gridbtn"><button data-a="tax">Vergi Artır<br>+60 altın, −6 istikrar</button><button data-tab="researchLab">Araştırma programı</button><button data-tab="policies">Askere alma yasaları</button><button data-a="stabilize">İdari Reform<br>70 altın, +10 istikrar</button></div></div><div class="panel"><h3>En Güçlü Eyaletler</h3>'+p.slice().sort((a,b)=>b.army-a.army).slice(0,7).map(q=>'<div class="item"><strong>'+q.label+' · '+q.army+' asker</strong><button style="float:right" data-j="'+q.id+'">Göster</button></div>').join("")+'</div>'}
function diplomacyPanel(){
 const p=prov(sel),id=p?.owner;
 if(!id||id===S.me||id==="ne"||!N[id])return '<div class="eyebrow">DİPLOMASİ</div><h2>Ülke seç</h2><div class="panel"><p>Haritadan görüşmek istediğin yabancı ülkeyi seç. İşlemler yalnızca seçtiğin ülkeye uygulanır.</p><p class="muted">Seçili bölge: '+safe(p?.label||"Yok")+'</p></div>';
 const x=war(id,S.me),r=relation(id,S.me),key=[S.me,id].sort().join("-"),truce=(S.truce?.[key]||0)>S.turn;
 const trading=(S.treaties?.trade||[]).some(pair=>pair.includes(id)&&pair.includes(S.me));
 const ally=S.alliances?.some(pair=>pair.includes(id)&&pair.includes(S.me));
 return '<div class="eyebrow">SEÇİLİ ÜLKE · DİPLOMASİ</div><h2>'+flag(id)+' '+safe(name(id))+'</h2><p class="muted">Seçili bölge: '+safe(p.label)+'</p><div class="panel dip-target" data-country="'+safe(id)+'"><p class="muted">İlişki '+r+' · '+(x?"⚔ Savaş":"🕊 Barış")+(truce?" · Ateşkes "+S.truce[key]+". tura kadar":"")+(ally?" · 🛡 Müttefik":"")+(trading?" · 💰 Ticaret anlaşması":"")+'</p><div class="gridbtn"><button data-d="improve:'+id+'">İlişki Artır<br>35 altın · +13 ilişki</button><button data-d="'+(x?"peace":"war")+':'+id+'">'+(x?"Barış Teklifi<br>Ücretsiz · Ordu dengesi":"Savaş İlanı<br>Ücretsiz · Ateşkes yoksa")+'</button><button data-d="gift:'+id+'">Hediye Gönder<br>55 altın · +22 ilişki</button><button data-d="alliance:'+id+'" '+(ally?'disabled':'')+'>İttifak Kur<br>Ücretsiz · +30 ilişki</button><button data-d="pact:'+id+'" '+(x||truce?'disabled':'')+'>🕊 Saldırmazlık Paktı<br>40 altın · 12 tur</button><button data-d="trade:'+id+'" '+(x||trading?'disabled':'')+'>💰 Ticaret Anlaşması<br>35 altın · +12/tur</button></div></div><p class="muted">Anlaşmalar gerçekten ekonomiyi ve yapay zekâ kararlarını etkiler. Başka bir ülke için haritadan o ülkeye dokun.</p><button data-tab="province">← Eyalete Dön</button>';
}
function eventsPanel(){return '<div class="eyebrow">TELGRAF</div><h2>Olaylar ve Tarihçe</h2><div class="notices">'+S.log.map(e=>'<div class="item"><small>Tur '+e.t+' · '+date(e.t)+'</small>'+safe(e.msg)+'</div>').join("")+'</div>'}
function economicOrder(action){
 const [kind,key,value]=action.split(":"),p=prov(sel),month=StrategyTime.month(S,S.turn),e=S.industry;
 const selected=id=>{const field=document.getElementById(id);return field?.value||field?.querySelector("option")?.value;};
 const finish=error=>{
   if(error)return toast(error);
   save();render();
 };
 const id=Number(key),line=e.lines.find(l=>l.id===id);
 if(kind==="build")return finish(Industry.build(S,p,key,isCoastal(p),month));
 if(kind==="cancelbuild"&&p?.owner===S.me&&p.construction){
   const job=p.construction,b=buildings[job.type];
   return gameConfirm("İnşaat iptali",b[0]+" inşaatı durdurulsun mu?",()=>{
     if(p.construction!==job||p.owner!==S.me)return;
     const refund=job.legacy?0:.8*Math.max(0,1-job.work/b[1]);
     S.gold+=Math.floor(b[2]*refund);S.materials.steel+=Math.floor(b[3]*refund);
     delete p.construction;finish();
   });
 }
 if(kind==="line"){
   const choice=selected("econ-model-"+key);
   if(!choice)return toast("Bir model seç.");
   const [model,level]=choice.split(".");
   const apply=()=>finish(Industry.setLine(S,line?id:0,model,Number(level),month));
   if(line)return gameConfirm("Üretim modelini değiştir","Kısmi iş kaybedilir ve hat verimi düşer. Model değiştirilsin mi?",apply);
   return apply();
 }
 if(kind==="assign"&&line)return finish(Industry.allocate(S,id,Number(value)));
 if(kind==="priority"&&line){e.lines=[line,...e.lines.filter(l=>l!==line)];return finish();}
 if(kind==="close"&&line)return gameConfirm("Üretim hattını kapat","Bu hattın kısmi üretim işi kaybedilir.",()=>{e.lines=e.lines.filter(l=>l!==line);finish();});
 if(kind==="train"||kind==="infantry"){
   const type=kind==="infantry"?"infantry":selected("econ-unit");
   const error=Industry.train(S,p,type,isCoastal(p));
   if(!error)log(p.label+" · "+units[type][0]+" eğitime alındı.");
   return finish(error);
 }
 if(kind==="research")return finish(Industry.research(S,key,month));
 if(kind==="law")return finish(Industry.changeLaw(S,key,Number(value),month));
 if(kind==="focus")return finish(Industry.focus(S,id,Number(value),month));
 if(kind==="team"){
   if(e.teams!==1||e.political<20||own().reduce((n,p)=>n+Industry.count(p,"civil"),0)<2)return toast("İki sivil fabrika ve 20 politik güç gerekli.");
   e.political-=20;e.teams=2;return finish();
 }
 if(kind==="crisis"&&e.crisis){
   if(key==="deal"&&e.political>=15){e.political-=15;S.stability=Math.min(100,S.stability+6);}
   else if(key==="budget"&&S.gold>=12){S.gold-=12;S.stability=Math.min(100,S.stability+4);}
   else return toast("Karar için kaynak yetersiz.");
   e.crisis=null;return finish();
 }
 if(kind==="buy"||kind==="sell")return finish(Industry.trade(S,selected("econ-partner"),selected("econ-resource"),kind==="buy"?5:-5,tradePartners(),month));
}
function baseAct(a){
if(S&&a.startsWith("econ:"))return economicOrder(a.slice(5));
if(S&&a==="recruit")return economicOrder("infantry");
if(a==="tempo"&&S){StrategyTime.setTempo(S,StrategyTime.tempo(S)===6?3:6);save();render();return;}
if(a==="menu")return home();
if(a==="nations")return nations();
if(a==="continue"){if(load()){sel=N[S.me][3];render()}else toast("Kayıt bulunamadı.");return}
if(a==="help")return help();
if(a==="historical"){location.search="?scenario=1919";return}
if(a==="world"){location.search="";return}
if(a==="saves")return saveSlots();
if(a.startsWith("slot-save-")){const n=+a.slice(-1),key=SAVEKEY+"_slot_"+n;
if(!S)return toast("Önce bir sefer başlat.");
if(localStorage.getItem(key))return gameConfirm("Kayıt üzerine yazılsın mı?","Kayıt "+n+" içindeki eski seferin yerine mevcut sefer kaydedilecek.",()=>{
 if(!S)return;localStorage.setItem(key,JSON.stringify(S));saveSlots();
});
localStorage.setItem(key,JSON.stringify(S));saveSlots();return}
if(a.startsWith("slot-load-")){const n=+a.slice(-1),raw=localStorage.getItem(SAVEKEY+"_slot_"+n);if(raw)loadStored(raw);return}
if(a.startsWith("archive-load-")){const index=+a.split("-").pop();try{const list=JSON.parse(localStorage.getItem(SAVEKEY+"_archives")||"[]");if(list[index]?.game)loadStored(list[index].game)}catch{}return}
if(a==="save"){save();toast("Kaydedildi.");return}
if(a==="center"){zoom=1;px=py=0;transform();return}
if(a==="plus"||a==="minus"){zoomAt(0,0,a==="plus"?1.65:1/1.65);return}
if(!S)return;
if(marching&&(a==="move"||a==="end"||a==="recruit"))return toast("Ordu hareketi sürerken yeni bir asker emri veremezsin.");
if(a==="cancelmove"){moving=null;dialog=null;render();return}if(a==="end")return next();
if(a==="move"){
const p=prov(sel);if(!p||p.owner!==S.me)return;
if(p.army<2)return toast("Bu eyalette hareket edecek asker yok.");
if(p.moved)return toast("Bu eyalette bu tur zaten ordu sevkiyatı yaptın.");
moving=sel;render();toast("Haritada seçili eyalete komşu bir bölgeye dokun.");return;
}
if(["invest","market","farm","fort","festival"].includes(a)){
const p=prov(sel);if(p?.owner!==S.me)return;
const cost={invest:75,market:95,farm:85,fort:65,festival:40}[a];
if(!pay(cost))return;
if(a==="invest"){p.dev++;p.pop+=2;p.investment=(p.investment||0)+1}
if(a==="market")p.market++;
if(a==="farm"){p.farm++;p.pop+=4}
if(a==="fort")p.fort++;
if(a==="festival")p.festivals=(p.festivals||0)+1;
const models={recruit:"barracks",invest:"investment",market:"market",farm:"farm",fort:"fort",festival:"festival"};
pulseAction(models[a],p.id);
log(p.label+": "+ACTION_LABELS[a]+(a==="recruit"?".":" tamamlandı."));save();render();return;
}
if(["tax","stabilize"].includes(a)){
S.decisions ||= {};
if(S.decisions[a]===S.turn)return toast("Bu devlet kararını aynı turda yalnızca bir kez uygulayabilirsin.");
if(a==="tax"&&S.stability<6)return toast("Vergi artışı için istikrar yetersiz.");
const cost={tax:0,research:100,mobilize:50,stabilize:70}[a];if(!pay(cost))return;
S.decisions[a]=S.turn;
if(a==="tax"){S.gold+=60;S.stability=clamp(S.stability-6,0,100)}
if(a==="stabilize")S.stability=clamp(S.stability+10,0,100);
log("Devlet kararı: "+ACTION_LABELS[a]+" uygulandı.");save();render();
}
}
function dip(a,id){
 if(!S||!N[id]||id===S.me||id==="ne"||prov(sel)?.owner!==id)return toast("Haritadan ülke seç.");
 const r=relation(S.me,id),key=[S.me,id].sort().join("-"),fighting=war(S.me,id);
 if(a==="improve"||a==="gift"){if(!pay(a==="gift"?55:35))return;S.relations[key]=clamp(r+(a==="gift"?22:13),-100,100);log(name(id)+" ile ilişkiler iyileşti.")}
 if(a==="war"&&!fighting){
  if((S.truce[key]||0)>S.turn)return toast("Ateşkes veya saldırmazlık paktı yürürlükte.");
  if(S.alliances.some(x=>x.includes(S.me)&&x.includes(id)))return toast("Önce ittifakı sona erdirmen gerekiyor.");
  return gameConfirm("Savaş ilanı",name(id)+" devletine savaş ilan edilsin mi? Diplomatik ilişkiler değişecek ve askerî saldırı emirleri açılacak.",()=>{
   if(!S||prov(sel)?.owner!==id||war(S.me,id)||(S.truce?.[key]||0)>S.turn)return toast("Savaş hedefi veya anlaşma değişti. Yeniden seçin.");
   S.wars.push([S.me,id]);log(name(id)+" ile savaş başladı.");save();render();
  });
 }
 if(a==="peace"&&fighting){
  const ours=own().reduce((x,p)=>x+p.army,0),theirs=S.p.filter(p=>p.owner===id).reduce((x,p)=>x+p.army,0);
  if(ours<theirs*.65)return toast("Barış teklifi reddedildi.");
  S.wars=S.wars.filter(x=>!(x.includes(S.me)&&x.includes(id)));S.truce[key]=S.turn+5;log("🕊 "+name(id)+" ile ateşkes.");
 }
 if(a==="alliance"){
  if(r<30||fighting)return toast("İttifak için barış ve +30 ilişki gerekir.");
  if(!S.alliances.some(x=>x.includes(S.me)&&x.includes(id)))S.alliances.push([S.me,id]);
  log(name(id)+" ile ittifak.");
 }
 if(a==="pact"){
  if(fighting||r<0)return toast("Saldırmazlık paktı için barış ve en az 0 ilişki gerekir.");
  if((S.truce[key]||0)>S.turn)return toast("Bu ülkeyle halen geçerli bir ateşkes bulunuyor.");
  if(!pay(40))return;
  S.truce[key]=S.turn+12;log("🕊 "+name(id)+" ile "+S.truce[key]+". tura kadar saldırmazlık paktı.");
 }
 if(a==="trade"){
  if(fighting||r<10)return toast("Ticaret için barış ve en az +10 ilişki gerekir.");
  S.treaties ||= {trade:[]};S.treaties.trade ||= [];
  if(S.treaties.trade.some(pair=>pair.includes(S.me)&&pair.includes(id)))return toast("Ticaret anlaşması zaten yürürlükte.");
  if(!pay(35))return;
  S.treaties.trade.push([S.me,id]);log("💰 "+name(id)+" ile ticaret başladı. Her tur +12 altın gelir.");
 }
 save();render();
}
function baseOpenMove(to){const f=prov(moving),p=prov(to);if(!f||!p||!adj(f.id).includes(to))return toast("Yalnızca komşu eyalete asker gönder.");if(f.army<2||f.moved)return toast("Bu eyalette hareket edebilecek ordu yok.");dialog={kind:"move",from:f.id,to:p.id,amount:Math.max(1,Math.floor(f.army*.7))};modal()}
function baseMarch(){
const d=dialog;if(!d)return;
const f=prov(d.from),p=prov(d.to);if(!f||!p)return;
const input=document.getElementById("amount"),n=clamp(+(input?.value||d.amount),1,f.army-1);
if(f.owner!==p.owner&&!war(f.owner,p.owner)){moving=null;dialog=null;sel=p.id;tab="diplomacy";render();toast("Önce hedef ülkeye savaş ilan et.");return}
moving=null;dialog=null;document.querySelector(".modalbg")?.remove();
const id=++marchSeq; marching={from:d.from,to:d.to,count:n,id};
resolveMarch(d,n);
setTimeout(()=>{if(!marching||marching.id!==id)return;marching=null;},1180);
}
function baseResolveMarch(d,n){
if(!S)return;
const f=prov(d.from),p=prov(d.to);if(!f||!p)return;
f.army-=n;f.moved=true;
if(f.owner===p.owner){p.army+=n;log(f.label+" → "+p.label+": "+n+" asker komşu eyalete yürüyerek ulaştı.")}
else{
const atk=n*(.9+.07*S.tech)*(S.stability/85),def=p.army*(1.1+p.fort*.18);
const chance=atk/(atk+def),roll=((Math.sin(S.turn*11+n*3+toHash(p.id))+1)*.5-.5)*.22;
if(chance+roll>.5){const rem=Math.max(1,Math.round(n*(.52+chance*.22)));p.owner=f.owner;p.army=rem;capturedProvince=p.id;setTimeout(()=>{if(capturedProvince===p.id){capturedProvince=null;if(S)render()}},1900);p.happy=Math.max(30,p.happy-14);p.fort=Math.max(0,p.fort-1);log("🏆 "+p.label+" ele geçirildi! "+rem+" asker kaldı.");if(f.owner===S.me)S.gold+=25}
else{f.army+=Math.floor(n*.20);p.army=Math.max(1,Math.round(p.army*.77));log("⚔ "+p.label+" saldırısı başarısız oldu.")}
}
dialog=null;outcome();save();render();
}
function toHash(s){return [...s].reduce((n,c)=>n+c.charCodeAt(0),0)}
function baseAi(){
 const economy=S.aiEconomy ||= {};
 const allies=(a,b)=>S.alliances?.some(pair=>pair.includes(a)&&pair.includes(b))||false;
 const truce=(a,b)=>(S.truce?.[[a,b].sort().join("-")]||0)>S.turn;
 for(const id of Object.keys(N).filter(x=>x!==S.me&&x!=="ne")){
  const regions=S.p.filter(p=>p.owner===id);if(!regions.length)continue;
  const state=economy[id] ||= {gold:80+regions.length*30,men:70+regions.length*25};
  const income=incomeOf(id);
  const upkeep=Math.ceil(regions.reduce((n,p)=>n+p.army,0)*.23);
  state.gold=Math.min(1800,Math.max(0,state.gold+income-upkeep));
  state.men=Math.min(1800,state.men+Math.ceil(regions.reduce((n,p)=>n+p.pop,0)/75));
  if(!state.gold&&income<upkeep)for(const p of regions)p.army=Math.max(1,Math.floor(p.army*.97));
  const border=regions.filter(p=>adj(p.id).some(n=>prov(n)?.owner!==id));
  if(!border.length)continue;
  const base=border[(S.turn+toHash(id))%border.length];
  if(state.gold>=60&&state.men>=20&&(S.turn+toHash(id))%3===0){state.gold-=60;state.men-=20;base.army+=20}
  if(S.turn>=10&&(S.turn+toHash(id))%17===0&&!war(id,S.me)&&!truce(id,S.me)&&!allies(id,S.me)&&border.some(p=>adj(p.id).some(n=>prov(n)?.owner===S.me))){
   const power=regions.reduce((n,p)=>n+p.army,0),defense=own().reduce((n,p)=>n+p.army,0);
   if(power>defense*1.3){S.wars.push([id,S.me]);log("⚠ "+name(id)+" savaş ilan etti.")}
  }
  for(const f of border){
   if(f.moved)continue;
   const target=adj(f.id).map(prov).find(p=>p&&p.owner!==id&&war(id,p.owner)&&!allies(id,p.owner)&&!truce(id,p.owner)&&f.army>p.army*1.55+15);
   if(!target)continue;
   const n=Math.floor(f.army*.6);if(n<2)continue;f.army-=n;f.moved=true;
   const ratio=n/(n+target.army*(1.1+target.fort*.15));
   if(ratio>.55){target.owner=id;target.army=Math.max(1,Math.round(n*.5));log(name(id)+" "+target.label+" eyaletini ele geçirdi.")}
   else target.army=Math.max(1,Math.round(target.army*.82));
   break;
  }
 }
}
function baseNext(){
 if(S.win||S.loss)return toast("Sefer sona erdi.");
 const ps=own();
 if(!S.calendarSegments?.length)StrategyTime.setTempo(S,6);
 const before=StrategyTime.month(S,S.turn),months=StrategyTime.tempo(S),opening=S.gold;
 for(let offset=0;offset<months;offset++){
   Industry.advance(S,before+offset,log);
   for(const p of ps)if(p.productionQueue?.length)StrategyTime.progress(p,1,log);
 }
 for(const p of S.p){p.moved=false;p.pop=Math.min(230,p.pop+(p.farm?2:1));if(p.happy<65)p.happy++}
 S.turn++;ai();
const crossed=!W&&S.me==="tr"?EVENTS.filter(e=>e.t-1>before&&e.t-1<=StrategyTime.month(S,S.turn)):[];
for(const e of crossed){log("📜 "+e.date+" — "+e.title);S.seen.push(e.t);}
const ev=crossed.at(-1);log("Tur "+S.turn+" · Bütçe değişimi "+(S.gold-opening)+".");outcome();save();render();if(ev&&S.me==="tr"&&!dialog)event(ev.date+" — "+ev.title,ev.text)}
function baseOutcome(){if(S.win||S.loss)return;const a=own();if(S.me==="tr"?["Izmir","Afyon","Eskisehir","Istanbul"].every(id=>prov(id).owner==="tr"):a.length>=18){S.win=true;dialog=null;log("🏆 Sefer zaferle tamamlandı.")}else if(!a.length||S.stability<=0){S.loss=true;dialog=null;log("Sefer kaybedildi: devletin kontrolü çöktü.")}}
function event(title,text){dialog={kind:"event",title,text};modal()}
function help(){dialog={kind:"help"};modal()}
function gameConfirm(title,text,onConfirm){dialog={kind:"confirm",title,text,onConfirm};modal()}
function modal(){document.querySelector(".modalbg")?.remove();if(!dialog)return;let h="";
if(dialog.kind==="confirm")h='<div class="eyebrow">ONAY GEREKİYOR</div><h2>'+ico("shield")+' '+safe(dialog.title)+'</h2><p>'+safe(dialog.text)+'</p><div class="actions"><button class="gold" data-modal="confirm">'+ico("swords")+' Onayla</button><button data-modal="cancel">Vazgeç</button></div>';if(dialog.kind==="help")h='<h2>5 Adımda Oyna</h2><p>1. Haritada kendi eyaletini seç.</p><p>2. Sağ panelden asker yetiştir veya ekonomi geliştir.</p><p>3. Ordu Gönder düğmesine bas ve komşu eyalete dokun.</p><p>4. Düşman bölgeye saldırmak için önce Diplomasi menüsünden savaş ilan et.</p><p>5. Turu Bitir ile gelir topla, rakiplerin hamlesini gör ve zafer hedeflerine ilerle.</p><p class="muted">Haritayı sürükle, ＋/− düğmeleriyle yakınlaştır. Her turda otomatik kayıt yapılır.</p><button class="gold" data-modal="close">Anladım, Oyna</button>';
if(dialog.kind==="event")h='<div class="eyebrow">TELGRAF VE HİKÂYE</div><h2>'+safe(dialog.title)+'</h2><p>'+safe(dialog.text)+'</p><button class="gold" data-modal="close">Devam Et</button>';
if(dialog.kind==="move"){const a=prov(dialog.from),b=prov(dialog.to),needsWar=a.owner!==b.owner&&!war(a.owner,b.owner);h='<h2>'+a.label+' → '+b.label+'</h2><p>Asker sevki ve saldırı emri</p><div class="stats"><div class="stat">Asker <b>'+a.army+'</b></div><div class="stat">Savunma <b>'+b.army+'</b></div></div>'+(needsWar?'<div class="warn">Bu ülkeyle savaşta değilsin. Önce savaş ilan et.</div>':'<p>Gönderilecek asker: <b id="count">'+dialog.amount+'</b></p><input type="range" id="amount" min="1" max="'+(a.army-1)+'" value="'+dialog.amount+'">')+'<div class="actions">'+(needsWar?'<button data-modal="dip" class="gold">Diplomasiye Git</button>':'<button data-modal="go" class="gold">Emri Uygula</button>')+'<button data-modal="cancel">Vazgeç</button></div>'}
const ov=document.createElement("div");ov.className="modalbg";ov.innerHTML='<div class="modal" role="dialog" aria-modal="true">'+h+'</div>';document.body.appendChild(ov);ov.querySelectorAll("[data-modal]").forEach(b=>b.onclick=()=>{if(b.dataset.modal==="confirm"){const action=dialog?.kind==="confirm"?dialog.onConfirm:null;dialog=null;moving=null;ov.remove();if(action)action();return}
if(b.dataset.modal==="go")return march();if(b.dataset.modal==="dip"){ov.remove();sel=dialog.to;tab="diplomacy";moving=null;dialog=null;render();return}dialog=null;moving=null;ov.remove();if(S)render()});ov.addEventListener("click",e=>{if(e.target!==ov||dialog?.kind==="event")return;dialog=null;moving=null;ov.remove();if(S)render()});const previousFocus=document.activeElement;
ov.addEventListener("keydown",e=>{
  if(e.key!=="Tab")return;
  const controls=[...ov.querySelectorAll("button:not([disabled]),input:not([disabled])")];
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});
ov.addEventListener("click",()=>queueMicrotask(()=>{if(!ov.isConnected&&previousFocus?.isConnected)previousFocus.focus();}));
ov.querySelector("button:not([disabled]),input")?.focus();const range=ov.querySelector("#amount");if(range)range.oninput=()=>{dialog.amount=+range.value;ov.querySelector("#count").textContent=range.value}}
function jump(id){if(!prov(id))return;openDrawer(app);sel=id;moving=null;tab=["diplomacy","industry"].includes(tab)?tab:"province";render()}
function markerScale(){return Math.max(.12,Math.min(1,Math.pow(zoom,-.72)))}
function transform(){const el=document.getElementById("world");if(el){el.style.transform="translate("+px+"px,"+py+"px) scale("+zoom+")";el.style.transformOrigin="50% 50%";const k=markerScale().toFixed(3);const scale="scale("+k+")";el.querySelectorAll(".mk").forEach(g=>{if(g.getAttribute("transform")!==scale)g.setAttribute("transform",scale)})}}
function zoomAt(cx,cy,factor){
 const old=zoom;zoom=clamp(zoom*factor,1,ZMAX);
 const rate=zoom/old;
 px=cx-(cx-px)*rate;py=cy-(cy-py)*rate;
 transform();
}
const activePointers=new Map();let pinch=null;

function wire(){
app.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>act(b.dataset.a));
app.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>start(b.dataset.n,document.getElementById("difficulty")?.value||"normal"));
const filter=app.querySelector("#nation-filter");if(filter)filter.oninput=()=>{let count=0;app.querySelectorAll("[data-n]").forEach(b=>{b.hidden=!b.textContent.toLocaleLowerCase("tr").includes(filter.value.toLocaleLowerCase("tr"));if(!b.hidden)count++});const empty=app.querySelector("#nation-empty");if(empty)empty.hidden=count>0};
app.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{openDrawer(app);moving=null;tab=b.dataset.tab;render()});
app.querySelectorAll("[data-layer]").forEach(b=>b.onclick=()=>{layer=b.dataset.layer;render()});
app.querySelectorAll("[data-j]").forEach(b=>b.onclick=()=>jump(b.dataset.j));
app.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{const [a,id]=b.dataset.d.split(":");dip(a,id)});
const search=app.querySelector("#map-search");if(search){const locate=()=>{const q=search.value.trim().toLocaleLowerCase("tr");if(!q)return;const region=S.p.find(p=>p.label.toLocaleLowerCase("tr")===q)||S.p.find(p=>p.label.toLocaleLowerCase("tr").includes(q))||S.p.find(p=>name(p.owner).toLocaleLowerCase("tr")===q);if(!region)return toast("Aranan ülke veya bölge bulunamadı.");jump(region.id);const vp=document.getElementById("viewport");if(!vp)return;const w=vp.clientWidth,h=vp.clientHeight,scale=Math.min(w/1080,h/650),ox=(w-1080*scale)/2,oy=(h-650*scale)/2;zoom=6;px=zoom*(w/2-(ox+region.x*10.5*scale));py=zoom*(h/2-(oy+(region.y*5.7+25)*scale));transform();};search.onchange=locate;search.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();locate()}}}
const vp=document.getElementById("viewport");if(!vp||vp.dataset.bound)return;vp.dataset.bound="1";activePointers.clear();pinch=null;
vp.querySelectorAll("[data-p]").forEach(b=>{b.onclick=e=>{if(ignoreClick)return;const id=b.dataset.p;moving?openMove(id):jump(id)};b.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();moving?openMove(b.dataset.p):jump(b.dataset.p)}}});
vp.onwheel=e=>{e.preventDefault();const rect=vp.getBoundingClientRect();zoomAt(e.clientX-rect.left-rect.width/2,e.clientY-rect.top-rect.height/2,Math.exp(-e.deltaY*.0035))};
vp.onpointerdown=e=>{
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size===2){
  const [p,q]=[...activePointers.values()];
  pinch={distance:Math.hypot(p.x-q.x,p.y-q.y),zoom};drag=null;ignoreClick=true;return;
 }
 drag={x:e.clientX,y:e.clientY,ox:px,oy:py,moved:false,captured:false};
};
vp.onpointermove=e=>{
 if(activePointers.has(e.pointerId))activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size>=2){
  const [p,q]=[...activePointers.values()],distance=Math.hypot(p.x-q.x,p.y-q.y);
  if(!pinch){pinch={distance,zoom};return}
  const rect=vp.getBoundingClientRect();
  const x=(p.x+q.x)/2-rect.left-rect.width/2,y=(p.y+q.y)/2-rect.top-rect.height/2;
  const wanted=clamp(pinch.zoom*distance/Math.max(1,pinch.distance),1,ZMAX);
  zoomAt(x,y,wanted/zoom);ignoreClick=true;return;
 }
 if(!drag)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.abs(dx)+Math.abs(dy)>9)drag.moved=true;
 if(drag.moved){
  if(!drag.captured){try{vp.setPointerCapture(e.pointerId);drag.captured=true}catch(_){}}
  px=clamp(drag.ox+dx,-400*zoom,400*zoom);py=clamp(drag.oy+dy,-250*zoom,250*zoom);transform();
 }
};
vp.onpointerup=e=>{
 activePointers.delete(e.pointerId);
 if(pinch){pinch=null;drag=null;ignoreClick=true;setTimeout(()=>ignoreClick=false,60);return}
 if(!drag)return;
 ignoreClick=drag.moved;drag=null;
 setTimeout(()=>ignoreClick=false,60);
};
vp.onpointercancel=e=>{activePointers.delete(e.pointerId);if(activePointers.size<2)pinch=null;drag=null;ignoreClick=false};
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog?.kind!=="event"){dialog=null;document.querySelector(".modalbg")?.remove();moving=null;if(S)render()}});



const equipment=p=>p.equipment||(p.equipment={tank:0,plane:0,ship:0});
// Save migration belongs to age.js; world saves are never copied over historical backups.
function worldOutcome(){if(S.win||S.loss)return;const territories=own();if(!territories.length||S.stability<=0){S.loss=true;dialog=null;log("Sefer sona erdi: devletin kontrolü çöktü.")}else if(territories.length>=Math.ceil(RAW.length*.6)){S.win=true;dialog=null;log("Zafer: dünya bölgelerinin yüzde 60’ı kontrol ediliyor.")}};
function worldHome(){S=null;dialog=null;moving=null;marching=null;++marchSeq;document.querySelectorAll(".modalbg").forEach(x=>x.remove());app.innerHTML=gameHeader()+'<main class="home"><section class="hero"><div class="eyebrow">DÜNYA MODU · MODERN COĞRAFYA</div><h1>Dünyanın kaderini belirle.</h1><p>'+RAW.length+' ülke bölgesi. 30 oynanabilir ülkeden birini seç, diplomasi yap, ordunu büyüt ve sınırlarını genişlet.</p><div class="actions"><button class="gold" data-a="nations">Ülke Seç</button><button data-a="continue">Kayıtlı Sefere Dön</button><button data-a="saves">▤ Kayıtlar ve Yedekler</button><button data-a="historical">📜 1919 Anadolu Senaryosu</button></div></section><p class="muted">Alternatif tarih senaryosu. Coğrafya modern Natural Earth ülke sınırlarını kullanır; 1919’un tarihsel sınırları değildir. Deniz rotaları tanımlanmış deniz koridorlarına dayanır; deniz sevkiyatı gemi gerektirir.</p><div class="cards"><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+troopArt+'</svg><b>Kara Kuvvetleri</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+tankArt+'</svg><b>Zırhlı Birlik</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+planeArt+'</svg><b>Hava Kuvvetleri</b></div><div class="card"><svg viewBox="-30 -30 60 60" width="70">'+shipArt+'</svg><b>Donanma</b></div></div></main>';wire()};

const commanderPortrait='<svg viewBox="0 0 80 90" width="70"><rect width="80" height="90" rx="4" fill="#17232b" stroke="#b69d69"/><path d="M9 88 15 60 33 53H47L65 60 72 88" fill="#6e7958"/><path d="M31 52 40 69 49 52" fill="#d7c6a4"/><path d="M37 66h6l4 22H34Z" fill="#263326"/><ellipse cx="40" cy="34" rx="15" ry="20" fill="#bfa07d"/><path d="M24 28 25 15Q40 5 56 15L57 29Z" fill="#4c5b47"/><path d="M20 26h40l-8 6H27Z" fill="#243325"/><path d="M35 41q5 5 10 0M30 34h5m10 0h5" fill="none" stroke="#625743"/><path d="m40 13 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Z" fill="#d8bf78"/><path d="M15 65h12m26 0h12" stroke="#e1c47b" stroke-width="4"/></svg>';
function worldNationPanel(){return '<div class="panel"><h3>Başkomutanlık</h3>'+commanderPortrait+'<p>'+(S.commander?'Kurmay heyeti göreve atandı.':'Kurmay heyeti ata: 120 altın, araştırma hızı +%5.')+'</p><button data-a="commander" '+(S.commander?'disabled':'')+'>Kurmay Heyetini Ata</button></div>'+baseNationPanel().replace("İzmir, Afyon, Eskişehir ve İstanbul'u ele geçir.","Dünya bölgelerinin yüzde 60’ını kontrol et.").replace("18 eyalete ulaş.","Dünya bölgelerinin yüzde 60’ını kontrol et.")};


function worldAct(action){
 if(action==="commander"&&S){
   if(S.commander||!pay(120))return;
   S.commander=true;save();render();return;
 }
 return baseAct(action);
}
function worldOpenMove(to){
 const f=prov(moving);if(!f)return;
 if(seaRoutes.has(routeKey(f.id,to))&&!equipment(f).ship)return toast("Bu deniz rotası için kaynak bölgede gemi üret.");
 return baseOpenMove(to);
};

function worldMarch(){
 if(dialog?.kind!=="move")return;
 const f=prov(dialog.from),p=prov(dialog.to);if(!f||!p)return;
 if(seaRoutes.has(routeKey(f.id,p.id))){
  if(!equipment(f).ship)return toast("Deniz sevkiyatı için gemi gerekiyor.");
  if(S.gold<10)return toast("Deniz sevkiyatı için 10 altın gerekiyor.");
 }
 return baseMarch();
};
function worldResolveMarch(d,n){
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

function worldAi(){
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

function worldRender(){
 document.querySelectorAll(".modalbg").forEach(x=>x.remove());
 if(S&&(S.win||S.loss)){
  const territory=own().length,army=own().reduce((sum,p)=>sum+p.army,0);
  app.innerHTML=gameHeader()+'<main class="home endgame-summary"><div class="hero"><div class="eyebrow">SEFER RAPORU · TUR '+S.turn+'</div><h1>'+(S.win?"🏆 Zafer":"⚑ Sefer Kaybedildi")+'</h1><p>'+(S.win?"Dünya bölgelerinin yüzde 60’ını ele geçirdin.":"Devletin tüm bölgelerini veya istikrarını kaybetti.")+'</p><div class="stats"><div class="stat">Bölgeler <b>'+territory+'</b></div><div class="stat">Kalan Ordu <b>'+army+'</b></div><div class="stat">Hazine <b>'+S.gold+'</b></div><div class="stat">Tur <b>'+S.turn+'</b></div></div><div class="actions"><button class="gold" data-a="menu">Yeni Sefer</button><button data-a="saves">Kayıtlar</button></div></div></main>';wire();return;
 }
 baseRender();
}

const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
const motionOK=!matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Kompakt, zum ile büyümeyen harita simgeleri ---------- */
function modelSvg(p){
 const types=[["barracks",p.barracks||0],["investment",p.investment||0],["market",p.market||0],["farm",p.farm||0],["fort",p.fort||0],["festival",p.festivals||0]].filter(t=>t[1]>0);
 if(!types.length)return "";
 const cx=p.x*10.5,cy=p.y*5.7+25,n=types.length,step=12.5,dy=W?14:21;
 return '<g pointer-events="none" transform="translate('+cx+' '+cy+')"><g class="mk"><g transform="translate(0 '+dy+')">'+types.map(([type,count],i)=>{
  const x=(i-(n-1)/2)*step,active=actionFx&&actionFx.id===p.id&&actionFx.type===type;
  return '<g transform="translate('+(x-5.5).toFixed(1)+' -5.5) scale(.55)"><g class="province-model model-'+type+(active?' build-active':'')+'"><title>'+MODEL_NAMES[type]+' · '+count+'</title><circle class="mdl-bg" cx="10" cy="10" r="12"/>'+ART[type]+(count>1?'<circle class="model-count-bg" cx="19" cy="19" r="5.5"/><text class="model-count" x="19" y="21.5">'+Math.min(count,9)+'</text>':'')+'</g></g>';
 }).join("")+'</g></g></g>';
};
function garrisonSvg(p){
 const x=p.x*10.5,y=p.y*5.7+25;
 return '<g transform="translate('+x+' '+y+')" pointer-events="none"><g class="mk"><g class="garrison" transform="translate(16 6) scale(.8)" aria-hidden="true"><g class="soldier-figure soldier-a"><circle cx="0" cy="-5" r="2.1" fill="#f2d59a"/><path d="M0-3v6m0-4-3 3m3-3 3 3m-3 1-2 4m2-4 2 4" stroke="#f2d59a" stroke-width="1.5" stroke-linecap="round"/></g><g class="soldier-figure soldier-b"><circle cx="8" cy="-5" r="2.1" fill="#d9e4d2"/><path d="M8-3v6m0-4-3 3m3-3 3 3m-3 1-2 4m2-4 2 4" stroke="#d9e4d2" stroke-width="1.5" stroke-linecap="round"/></g></g></g></g>';
};

/* ---------- 2. Yardımcılar ---------- */
const armyOf=()=>own().reduce((n,p)=>n+p.army,0);
const snap=()=>S?{turn:S.turn,gold:S.gold,men:S.men,stab:S.stability,tech:S.tech,army:armyOf(),regions:own().map(p=>p.id)}:null;
const stats=()=>S.stats||(S.stats={won:0,lost:0,captured:0,defended:0,eventsChosen:0});
const capitalOrFirst=()=>{const c=prov(N[S.me]?.[3]);return c&&c.owner===S.me?c:own().sort((a,b)=>b.army-a.army)[0]};
function overlay(cls,html,ms){
 const el=document.createElement("div");el.className="fx-layer "+cls;el.innerHTML=html;document.body.appendChild(el);
 if(ms)setTimeout(()=>{el.classList.add("out");setTimeout(()=>el.remove(),450)},ms);
 return el;
}
const sign=v=>(v>0?"+":"")+v;
const chip=(label,v,suffix="")=>v?'<span class="tb-chip '+(v>0?"up":"down")+'">'+label+' <b>'+sign(v)+suffix+'</b></span>':"";

/* ---------- 3. Ulusal hedefler ---------- */
const MISSIONS=[
 {id:"m_reg2",t:"İlk Genişleme",d:"2 bölgeye ulaş",p:()=>[own().length,2],r:{gold:80},rt:"+80 altın"},
 {id:"m_build3",t:"Kalkınma Hamlesi",d:"Toplam 3 pazar/çiftlik/yatırım kur",p:()=>[own().reduce((n,p)=>n+(p.market||0)+(p.farm||0)+(p.investment||0),0),3],r:{gold:70,stab:2},rt:"+70 altın, +2 istikrar"},
 {id:"m_army",t:"Düzenli Ordu",d:"Toplam ordu 250 askere ulaşsın",p:()=>[armyOf(),250],r:{men:80},rt:"+80 insan gücü"},
 {id:"m_tech3",t:"Bilim ve Sanayi",d:"Teknoloji seviyesi 3",p:()=>[S.tech,3],r:{gold:60,stab:3},rt:"+60 altın, +3 istikrar"},
 {id:"m_dip",t:"Diplomat Devlet",d:"Bir ittifak veya ticaret anlaşması yap",p:()=>[(S.alliances||[]).some(a=>a.includes(S.me))||(S.treaties?.trade||[]).some(a=>a.includes(S.me))?1:0,1],r:{stab:5},rt:"+5 istikrar"},
 {id:"m_fort",t:"Sarsılmaz Sınır",d:"Bir bölgede 2 tahkimat",p:()=>[Math.max(0,...own().map(p=>p.fort||0)),2],r:{gold:50},rt:"+50 altın"},
 {id:"m_win3",t:"Muzaffer Komutan",d:"3 muharebe kazan",p:()=>[stats().won,3],r:{gold:120,tech:1},rt:"+120 altın, +1 teknoloji"},
 {id:"m_reg6",t:"Büyük Devlet",d:"6 bölgeye ulaş",p:()=>[own().length,6],r:{gold:200,stab:5},rt:"+200 altın, +5 istikrar"},
 {id:"m_gold",t:"Dolu Hazine",d:"Hazinede 900 altın biriktir",p:()=>[S.gold,900],r:{stab:4,men:60},rt:"+4 istikrar, +60 insan gücü"}
];
function grant(r){
 if(r.gold)S.gold=Math.max(0,S.gold+r.gold);
 if(r.men)S.men=Math.max(0,S.men+r.men);
 if(r.stab)S.stability=clamp(S.stability+r.stab,0,100);
 if(r.tech)S.tech=Math.max(1,S.tech+r.tech);
 if(r.army){const c=capitalOrFirst();if(c)c.army=Math.max(1,c.army+r.army)}
 if(r.happy)for(const p of own())p.happy=clamp(p.happy+r.happy,0,100);
 if(r.debt)S.debt={left:r.debt,pay:35};
}
function checkMissions(){
 if(!S||S.win||S.loss)return;
 S.missions ||= {};
 for(const m of MISSIONS){
  if(S.missions[m.id])continue;
  const [v,goal]=m.p();if(v<goal)continue;
  S.missions[m.id]=S.turn;grant(m.r);log("🎖 Ulusal hedef tamamlandı: "+m.t+" ("+m.rt+").");
  overlay("mission-pop",'<div class="mp-medal"><svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="22" r="13" fill="#e9c588" stroke="#7a5a26" stroke-width="2"/><path d="m20 13 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z" fill="#7a5a26"/><path d="M12 3h6l2 8-6 0Zm16 0h-6l-2 8 6 0Z" fill="#b43b34"/></svg></div><div><small>ULUSAL HEDEF</small><b>'+safe(m.t)+'</b><span>'+safe(m.rt)+'</span></div>',2900);
 }
}
function missionsPanel(){
 if(!S)return "";S.missions ||= {};
 const done=MISSIONS.filter(m=>S.missions[m.id]).length;
 return '<div class="panel missions"><h3>Ulusal Hedefler <small class="muted">'+done+'/'+MISSIONS.length+'</small></h3>'+MISSIONS.map(m=>{
  const ok=!!S.missions[m.id],[v,goal]=m.p(),pct=ok?100:Math.round(clamp(v/goal,0,1)*100);
  return '<div class="mission'+(ok?' done':'')+'"><div class="m-row"><b>'+(ok?'✓ ':'')+safe(m.t)+'</b><small>'+safe(m.rt)+'</small></div><small class="muted">'+safe(m.d)+(ok?'':' · '+Math.min(v,goal)+'/'+goal)+'</small><i class="m-bar"><i style="width:'+pct+'%"></i></i></div>';
 }).join("")+'</div>';
}

function nationPanel(){
 let html=(W?worldNationPanel:baseNationPanel)();
 if(S?.debt?.left)html+='<div class="panel debt"><h3>Dış Borç</h3><p class="muted">Kalan '+S.debt.left+' taksit · tur başına '+S.debt.pay+' altın</p></div>';
 return html+missionsPanel();
};

/* ---------- 4. Seçimli olaylar ---------- */
function showChoice(){
 const ev=CHOICES.find(c=>c.id===S?.pendingChoice);if(!ev||document.querySelector(".choice-modal"))return;
 const el=overlay("choice-modal",'<div class="cm-card" role="dialog" aria-modal="true"><div class="eyebrow">DEVLET MECLİSİ · '+safe(date(S.turn)).toLocaleUpperCase("tr")+'</div><h2>'+safe(ev.t)+'</h2><p>'+safe(ev.x)+'</p><div class="cm-opts">'+ev.a.map(([label,info,r],i)=>{
  const cant=r.gold<0&&S.gold<-r.gold;
  return '<button data-c="'+i+'" '+(cant?'disabled':'')+'><b>'+safe(label)+'</b><small>'+safe(info)+(cant?' · altın yetersiz':'')+'</small></button>';
 }).join("")+'</div></div>');
 el.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{
  const [label,,r]=ev.a[+b.dataset.c];if(!S)return el.remove();
  if(r.gold<0&&S.gold<-r.gold)return toast("Altın yetersiz.");
  grant(r);stats().eventsChosen++;S.pendingChoice=null;log("🏛 "+ev.t+": "+label+".");
  el.classList.add("out");setTimeout(()=>el.remove(),300);checkMissions();save();render();
 });
 el.querySelector("[data-c]:not([disabled])")?.focus();
}
function maybeChoice(){
 if(!S||S.win||S.loss||S.pendingChoice||S.turn<3||S.turn%4!==3)return;
 S.evSeen ||= [];
 const pool=CHOICES.filter(c=>!S.evSeen.includes(c.id));const list=pool.length?pool:CHOICES;
 const ev=list[hash(S.me+S.turn)%list.length];
 S.evSeen=pool.length?[...S.evSeen,ev.id]:[ev.id];S.pendingChoice=ev.id;save();
}

/* ---------- 5. Tur geçişi, borç ve kayıp uyarısı ---------- */

function next(){
 if(S?.pendingChoice){showChoice();return toast("Önce meclisin kararını ver.")}
 const b=snap();baseNext();
 if(!S||!b||S.turn===b.turn)return;
 if(S.debt?.left){S.gold=Math.max(0,S.gold-S.debt.pay);S.debt.left--;log("Dış borç taksiti ödendi: "+S.debt.pay+" altın.");if(!S.debt.left){S.debt=null;log("Dış borç kapandı.")}}
 const lost=b.regions.filter(id=>prov(id)?.owner!==S.me);
 if(lost.length){log("⚠ Kaybedilen bölge: "+lost.map(id=>prov(id).label).join(", ")+".")}
 checkMissions();maybeChoice();save();if(!document.querySelector(".modalbg"))render();
 const a=snap();
 overlay("turn-banner",'<div class="tb-inner"><small>TUR '+a.turn+'</small><b>'+safe(date(a.turn))+'</b><div class="tb-chips">'+chip("Altın",a.gold-b.gold)+chip("İnsan Gücü",a.men-b.men)+chip("İstikrar",a.stab-b.stab,"%")+chip("Ordu",a.army-b.army)+(lost.length?'<span class="tb-chip down">Kayıp <b>'+safe(lost.map(id=>prov(id).label).join(", "))+'</b></span>':'')+'</div></div>',lost.length?3400:2100);
 if(lost.length)document.getElementById("viewport")?.classList.add("alarm");
};

/* ---------- 6. Muharebe raporu ---------- */

function resolveMarch(d,n){
 const f=prov(d?.from),p=prov(d?.to);
 const b=f&&p?{fo:f.owner,po:p.owner,fa:f.army,pa:p.army,fl:f.label,pl:p.label,fort:p.fort||0}:null;
 (W?worldResolveMarch:baseResolveMarch)(d,n);
 if(!S||!b||b.fo===b.po)return;
 const f2=prov(d.from),p2=prov(d.to);if(!f2||!p2||f2.army===b.fa)return;
 const sent=clamp(n,1,b.fa-1),won=p2.owner===b.fo;
 const atkLoss=won?Math.max(0,sent-p2.army):sent-Math.floor(sent*.2),defLoss=won?b.pa:b.pa-p2.army;
 const st=stats();if(won){st.won++;st.captured++}else st.lost++;
 checkMissions();save();
 const bar=(v,max,cls)=>'<i class="br-bar '+cls+'"><i style="--w:'+Math.round(clamp(v/Math.max(1,max),0,1)*100)+'%"></i></i>';
 const max=Math.max(sent,b.pa);
 const el=overlay("battle-report "+(won?"win":"loss"),'<div class="br-card" role="dialog" aria-modal="true"><div class="br-swords"><svg viewBox="0 0 64 64" width="64" height="64"><g class="sw sw-l"><path d="M10 54 44 14l6-2-2 6-34 40Z" fill="#d9dccf" stroke="#3c4741" stroke-width="1.5"/><path d="m8 48 8 8M6 58l6-6" stroke="#b58a45" stroke-width="4" stroke-linecap="round"/></g><g class="sw sw-r"><path d="M54 54 20 14l-6-2 2 6 34 40Z" fill="#d9dccf" stroke="#3c4741" stroke-width="1.5"/><path d="m56 48-8 8m10 2-6-6" stroke="#b58a45" stroke-width="4" stroke-linecap="round"/></g><circle class="spark" cx="32" cy="30" r="5" fill="#ffe7a0"/></svg></div><div class="eyebrow">MUHAREBE RAPORU · '+safe(date(S.turn)).toLocaleUpperCase("tr")+'</div><h2>'+(won?safe(b.pl)+' ele geçirildi':'Saldırı püskürtüldü')+'</h2><p class="muted">'+safe(b.fl)+' → '+safe(b.pl)+(b.fort?' · '+b.fort+' tahkimat':'')+'</p><div class="br-cols"><div><small>'+safe(name(b.fo))+'</small><b>'+sent+'</b>'+bar(sent,max,"own")+'<span>Kayıp −'+atkLoss+'</span></div><div class="vs">VS</div><div><small>'+safe(name(b.po))+'</small><b>'+b.pa+'</b>'+bar(b.pa,max,"foe")+'<span>Kayıp −'+defLoss+'</span></div></div>'+(won?'<p class="br-note">Ganimet: +25 altın. Bölge memnuniyeti savaş nedeniyle düştü.</p>':'<p class="br-note">Ordunun bir kısmı geri çekildi. Tahkimatı yüksek bölgelere tank ve teknolojiyle saldır.</p>')+'<button class="gold" data-br="ok">Devam</button></div>');
 const close=()=>{el.classList.add("out");setTimeout(()=>el.remove(),300)};
 el.querySelector("[data-br]").onclick=close;el.onclick=e=>{if(e.target===el)close()};
 el.querySelector("[data-br]").focus();
};

/* ---------- 7. Render: kaynak animasyonu, bekleyen olay, sefer istatistiği ---------- */
let prevRes=null;

function render(){
 (W?worldRender:baseRender)();
 if(!S){prevRes=null;return}
 const bar=document.querySelector("#app .resources");
 if(bar){
  const now={};
  bar.querySelectorAll("span").forEach((sp,i)=>{const m=sp.textContent.match(/(-?\d+)%?\s*$/);if(m)now[i]=+m[1]});
  if(prevRes&&prevRes.me===S.me)bar.querySelectorAll("span").forEach((sp,i)=>{
   const a=prevRes.v[i],c=now[i];if(a===undefined||c===undefined||a===c||!motionOK)return;
   sp.classList.add(c>a?"res-up":"res-down");const d=document.createElement("i");d.className="res-delta "+(c>a?"up":"down");d.textContent=sign(c-a);sp.appendChild(d);
  });
  prevRes={me:S.me,v:now};
 }
 if(S.win||S.loss){
  const box=document.querySelector(".endgame-summary .stats");
  if(box&&!box.dataset.enh){box.dataset.enh=1;const st=stats();S.missions ||= {};
   box.insertAdjacentHTML("beforeend",'<div class="stat">Kazanılan Muharebe <b>'+st.won+'</b></div><div class="stat">Kaybedilen Muharebe <b>'+st.lost+'</b></div><div class="stat">Ulusal Hedef <b>'+Object.keys(S.missions).length+'/'+MISSIONS.length+'</b></div><div class="stat">Meclis Kararı <b>'+st.eventsChosen+'</b></div>');}
  document.querySelector(".endgame-summary")?.classList.add(S.win?"is-win":"is-loss");
 }else if(S.pendingChoice&&!document.querySelector(".modalbg"))setTimeout(showChoice,40);
 transform();
};

function act(a){const r=(W?worldAct:baseAct)(a);if(S&&!["menu","nations","saves","help","continue"].includes(a)){const before=JSON.stringify(S.missions||{});checkMissions();if(JSON.stringify(S.missions||{})!==before){save();render()}}return r};

/* ---------- 8. Atlas ana menüsü ---------- */

function home(){
 document.querySelectorAll(".fx-layer").forEach(x=>x.remove());
 (W?worldHome:baseHome)();
 const hero=document.querySelector("#app .home .hero");if(!hero||hero.querySelector(".compass"))return;
 hero.classList.add("atlas-hero");
 hero.insertAdjacentHTML("afterbegin",'<svg class="compass" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="none" stroke="#e9c58855" stroke-width="1.5"/><circle cx="60" cy="60" r="44" fill="none" stroke="#e9c58833" stroke-dasharray="2 4"/><g class="rose"><path d="M60 8 67 60 60 112 53 60Z" fill="#e9c588"/><path d="M8 60 60 53 112 60 60 67Z" fill="#a7895a"/><path d="M60 8 67 60H53Z" fill="#b43b34"/></g><text x="60" y="6" text-anchor="middle" fill="#e9c588" font-size="9" font-family="Georgia">K</text></svg>');
 hero.insertAdjacentHTML("beforeend",'<div class="howto"><div><i>1</i><b>Devletini seç</b><small>Zorluk ve ülke</small></div><div><i>2</i><b>Ekonomini kur</b><small>Pazar, çiftlik, teknoloji</small></div><div><i>3</i><b>Diplomasi yürüt</b><small>İttifak, ticaret, savaş</small></div><div><i>4</i><b>Cepheye sevk et</b><small>Komşu bölgeleri al</small></div></div>');
 document.querySelector("#app .home")?.classList.add("atlas-menu");
};

const ai=W?worldAi:baseAi;
const march=W?worldMarch:baseMarch;
const openMove=W?worldOpenMove:baseOpenMove;

const outcome=W?worldOutcome:baseOutcome;
function markerSvg(p){if(W){const a=shapeData.get(p.id);return '<g pointer-events="none" transform="translate('+a.x+' '+a.y+')"><g class="mk"><g class="world-troop" transform="scale(.42)">'+({tank:tankArt,plane:planeArt,ship:shipArt}[p.unitType]||troopArt)+'</g><rect class="army-chip" x="7" y="-6" width="'+(8+String(p.army).length*5)+'" height="11" rx="5.5"/><text x="'+(11+String(p.army).length*2.5)+'" y="2.5" text-anchor="middle" class="army-chip-t">'+p.army+'</text><text y="-12" text-anchor="middle" class="label" style="font-size:8px">'+safe(p.label)+'</text>'+(p.fort?'<path d="M-14 14v-6h3v-2h4v2h3v-2h4v8Z" fill="#b1ad99" stroke="#45514a"/>':'')+'</g></g>'}const x=p.x*10.5,y=p.y*5.7+25;return '<g pointer-events="none" transform="translate('+x+' '+y+')"><g class="mk"><circle class="army-count-bg" r="13" fill="#162e3c" stroke="#e1c88d" stroke-width="1.5"/><text y="4" text-anchor="middle" class="number">'+p.army+'</text><text y="-19" text-anchor="middle" class="label">'+safe(p.label)+'</text></g></g>'+garrisonSvg(p);}
if(W)ZMAX=18;
home();

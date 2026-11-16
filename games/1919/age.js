"use strict";
const N={tr:["Türkiye","🇹🇷","#4c957c","Ankara"],gr:["Yunanistan","🇬🇷","#b37568","Izmir"],gb:["Britanya","🇬🇧","#c29d70","Istanbul"],fr:["Fransa","🇫🇷","#777cb2","Adana"],ru:["Rusya","🇷🇺","#a66d70","Kars"],ne:["Tarafsız","⚑","#969987","Van"]};
const RAW=[["Istanbul","İstanbul",17,19,"gb"],["Canakkale","Çanakkale",8,42,"gb"],["Izmir","İzmir",18,68,"gr"],["Bursa","Bursa",30,37,"gr"],["Eskisehir","Eskişehir",42,51,"gr"],["Afyon","Afyon",38,67,"gr"],["Ankara","Ankara",55,48,"tr"],["Konya","Konya",54,74,"tr"],["Antalya","Antalya",41,91,"tr"],["Samsun","Samsun",68,25,"tr"],["Sivas","Sivas",74,48,"tr"],["Trabzon","Trabzon",86,25,"tr"],["Erzurum","Erzurum",89,51,"tr"],["Kars","Kars",96,41,"ru"],["Adana","Adana",75,86,"fr"],["Antep","Antep",89,84,"fr"],["Musul","Musul",98,98,"gb"],["Inebolu","İnebolu",49,19,"tr"],["Kutahya","Kütahya",31,56,"gr"],["Mersin","Mersin",65,94,"fr"],["Kayseri","Kayseri",68,63,"tr"],["Bolu","Bolu",39,30,"tr"],["Balikesir","Balıkesir",19,48,"gr"],["Denizli","Denizli",27,84,"tr"],["Malatya","Malatya",82,67,"tr"],["Van","Van",99,65,"ne"],["Amasya","Amasya",62,36,"tr"],["Tokat","Tokat",71,38,"tr"],["Urfa","Urfa",91,94,"fr"],["Corum","Çorum",54,36,"tr"],["Giresun","Giresun",79,23,"tr"],["Karaman","Karaman",60,85,"tr"]];
const LINKS="Istanbul-Bursa Istanbul-Bolu Canakkale-Balikesir Canakkale-Bursa Izmir-Balikesir Izmir-Denizli Balikesir-Bursa Balikesir-Kutahya Bursa-Bolu Bursa-Kutahya Bursa-Eskisehir Kutahya-Eskisehir Kutahya-Afyon Eskisehir-Ankara Eskisehir-Bolu Afyon-Ankara Afyon-Konya Afyon-Denizli Denizli-Antalya Denizli-Konya Bolu-Inebolu Bolu-Ankara Inebolu-Corum Inebolu-Samsun Ankara-Corum Ankara-Konya Ankara-Kayseri Corum-Amasya Corum-Samsun Samsun-Amasya Samsun-Giresun Amasya-Tokat Tokat-Sivas Tokat-Giresun Sivas-Kayseri Sivas-Malatya Sivas-Erzurum Kayseri-Konya Kayseri-Malatya Konya-Karaman Konya-Antalya Karaman-Mersin Karaman-Adana Mersin-Adana Adana-Antep Antep-Urfa Antep-Malatya Urfa-Musul Urfa-Malatya Erzurum-Kars Erzurum-Van Erzurum-Giresun Malatya-Van Van-Kars".split(" ").map(x=>x.split("-"));
const EVENTS=[{t:1,title:"Samsun'a Çıkış",date:"19 Mayıs 1919",text:"Mustafa Kemal Paşa Samsun'a ulaştı; Millî Mücadele'nin örgütlenme süreci başladı."},{t:2,title:"Amasya Genelgesi",date:"22 Haziran 1919",text:"Milletin bağımsızlığını yine milletin azim ve kararı kurtaracaktır."},{t:3,title:"Erzurum Kongresi",date:"23 Temmuz 1919",text:"Millî irade ve vatan bütünlüğüne ilişkin kararlar alındı."},{t:5,title:"Sivas Kongresi",date:"4 Eylül 1919",text:"Müdafaa-i Hukuk cemiyetleri ortak mücadeleyi örgütledi."},{t:9,title:"Ankara'da Yeni Karargâh",date:"27 Aralık 1919",text:"Heyet-i Temsiliye Ankara'ya geldi."},{t:12,title:"TBMM",date:"23 Nisan 1920",text:"Büyük Millet Meclisi Ankara'da açıldı."},{t:21,title:"I. İnönü",date:"Ocak 1921",text:"Düzenli ordu ve Batı Cephesi önem kazandı."},{t:24,title:"II. İnönü",date:"Mart 1921",text:"Batı Cephesi'nde kritik bir savunma dönemi."},{t:28,title:"Sakarya",date:"Ağustos 1921",text:"Sakarya Meydan Muharebesi dönemi."},{t:40,title:"Büyük Taarruz",date:"26 Ağustos 1922",text:"Tarihsel Büyük Taarruz dönemi. Oyun sonucu senin kararlarına bağlıdır."},{t:42,title:"Mudanya",date:"11 Ekim 1922",text:"Tarihsel ateşkes görüşmeleri."},{t:51,title:"Lozan",date:"24 Temmuz 1923",text:"Barışın ve uluslararası tanınmanın dönüm noktası."}];
const app=document.getElementById("app"),SAVE="baba_1919_age_v1",SAVEKEY=new URLSearchParams(location.search).get("scenario")==="1919"?SAVE+"_historical":SAVE;let S=null,sel="Ankara",tab="province",layer="political",moving=null,dialog=null,zoom=1,px=0,py=0,drag=null,ignoreClick=false,marching=null,actionFx=null,fxSeq=0,marchSeq=0,capturedProvince=null;
const safe=x=>String(x??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),name=id=>N[id]?.[0]||id,prov=id=>S?.p.find(p=>p.id===id),adj=id=>[...new Set(LINKS.filter(x=>x.includes(id)).map(x=>x[0]===id?x[1]:x[0]))].filter(x=>prov(x)),own=()=>S.p.filter(p=>p.owner===S.me),date=t=>new Date(Date.UTC(1919,4+t-1,19)).toLocaleDateString("tr-TR",{month:"long",year:"numeric",timeZone:"UTC"});
const BASE_INCOME=20;
function incomeOf(id){return S.p.filter(p=>p.owner===id).reduce((n,p)=>n+Math.round(p.pop*.12+p.dev*4+(p.market||0)*8+(p.farm||0)*4),0)+tradeBonus(id)+BASE_INCOME}
const ICON_PATHS={
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 save:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 3v7h10V3M7 21v-8h10v8"/>',
 files:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1.1-1 2.2M12 17.5h.01"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 coins:'<circle cx="9" cy="9" r="6"/><path d="M13 14a6 6 0 1 0 7-7M9 6v6M7 8h4"/>',
 chart:'<path d="M3 20h18M6 15l5-5 4 3 5-7"/>',
 swords:'<path d="m4 4 16 16M20 4 4 20M3 3l4 1-3 4M21 3l-4 1 3 4M3 21l1-4 4 3M21 21l-1-4-4 3"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
 book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/>',
 shield:'<path d="M12 2 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6Z"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-4 4-4 14 0 18M12 3c4 4 4 14 0 18"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 pin:'<path d="M12 22s7-8 7-13A7 7 0 0 0 5 9c0 5 7 13 7 13Z"/><circle cx="12" cy="9" r="2"/>',
 arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
 handshake:'<path d="M2 9 7 4l4 2 2-1 4 2 5 5-5 5-4-2-3 3-4-3-4-2Z"/>',
 close:'<path d="M5 5 19 19M19 5 5 19"/>'
};
function ico(id){return '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICON_PATHS[id]||ICON_PATHS.shield)+'</svg>'}
function flag(id){
 const code=(N[id]?.[5]||{tr:"TR",gr:"GR",gb:"GB",fr:"FR",ru:"RU",ne:"--"}[id]||id.slice(-2)).toUpperCase().slice(0,2);
 return '<svg class="country-mark" role="img" aria-label="'+safe(name(id))+'" viewBox="0 0 36 24"><rect x="1" y="1" width="34" height="22" rx="4" fill="#253c4b" stroke="#bda36d"/><text x="18" y="16" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="800" fill="#f6deb1">'+safe(code)+'</text></svg>';
}
const ACTION_LABELS={recruit:"20 asker yetiştirildi",invest:"altyapı yatırımı",market:"pazar inşaatı",farm:"çiftlik inşaatı",fort:"tahkimat inşaatı",festival:"halk şenliği",tax:"Vergi politikası",research:"Teknoloji araştırması",mobilize:"Seferberlik",stabilize:"İdari reform"};

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
function home(){S=null;moving=null;dialog=null;app.innerHTML=gameHeader()+'<main class="home"><section class="hero"><div class="eyebrow">1919–1923 · ALTERNATİF TARİH</div><h1>Bir devlet seç.<br><span style="color:#f2d497">Tarihi sen yaz.</span></h1><p>Age of Civilizations tarzı tur bazlı strateji. Eyaletlerini yönet, ordu yetiştir, komşu bölgelere ilerle, diplomasi yap ve medeniyetini genişlet.</p><div class="actions"><button class="gold" data-a="nations">Yeni Sefer Başlat</button>'+(localStorage.getItem(SAVEKEY)?'<button data-a="continue">↪ Seferine Devam Et</button>':"")+'<button data-a="help">Nasıl Oynanır?</button><button data-a="world">🌍 Dünya Hakimiyeti</button></div></section><div class="cards"><div class="card"><b>🗺️ 32 eyalet</b><small>Anadolu haritasında siyasi sınırlar ve kontrol alanları</small></div><div class="card"><b>⚔ Tur bazlı savaş</b><small>Komşu eyalete birlik gönder, savunma kur ve fethet</small></div><div class="card"><b>🏛 Diplomasi</b><small>İlişkiler, savaş, ateşkes ve ittifak</small></div></div><p class="muted" style="margin-top:18px">Eyalet şekilleri ve ekonomi değerleri oyun tasarımı için sadeleştirilmiştir; tarihsel sınırların birebir haritası değildir.</p></main>';wire()}
function nations(){
 const featured=["tr","gb","fr","gr","ru"],collator=new Intl.Collator("tr-TR",{sensitivity:"base"});
 const items=Object.entries(N).filter(([id])=>id!=="ne")
 .sort(([a,va],[b,vb])=>{const ia=featured.indexOf(a),ib=featured.indexOf(b);if(ia!==-1||ib!==-1)return (ia===-1?999:ia)-(ib===-1?999:ib);return collator.compare(va[0],vb[0])});
 app.innerHTML=gameHeader()+'<main class="home nation-picker"><h1>Devletini seç</h1><p class="muted">'+(SAVEKEY===SAVE?'Dünya modu: modern coğrafya üzerinde alternatif tarih. 1919–1923 tarihsel Anadolu senaryosu ayrı bir moddur.':'1919–1923: 32 temsili Anadolu bölgesiyle Millî Mücadele seferi.')+'</p><div class="panel nation-controls"><label for="difficulty">Zorluk</label><select id="difficulty"><option value="easy">Kolay</option><option value="normal" selected>Normal</option><option value="hard">Zor</option></select><label for="nation-filter">Ülke ara</label><input id="nation-filter" type="search" placeholder="Ülke veya başkent ara" autocomplete="off"></div><p class="small">'+(SAVEKEY===SAVE?'Öne çıkan devletler başta; diğerleri Türkçe alfabetik sırada.':'Millî Mücadele ve alternatif tarih devletleri.')+'</p><div class="cards country-grid">'+items.map(([id,v])=>'<button class="card" data-n="'+safe(id)+'">'+flag(id)+'<b>'+safe(v[0])+'</b><small>Başkent: '+safe(v[4]||v[3])+'</small></button>').join("")+'</div><p id="nation-empty" class="muted" hidden>Aramanla eşleşen devlet yok.</p></main>';
 wire();
}
function start(me,difficulty="normal"){archiveBeforeNew();S=initial(me);S.difficulty=difficulty;sel=N[me][3];tab="province";layer="political";save();render();if(me==="tr")event("19 Mayıs 1919 — Samsun'a Çıkış","Millî Mücadele başladı. Ankara'da asker yetiştir, ekonomini geliştir ve batı bölgelerini hedefle.")}
function clip(poly,a,b,c){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=a*p[0]+b*p[1]-c,v=a*q[0]+b*q[1]-c;if(u<=0)out.push(p);if((u<0&&v>0)||(u>0&&v<0)){const t=u/(u-v);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}return out}
function polygon(p){let poly=[[0,0],[1080,0],[1080,650],[0,650]],x=p.x*10.5,y=p.y*5.7+25;for(const q of S.p){if(q===p)continue;const xx=q.x*10.5,yy=q.y*5.7+25;poly=clip(poly,xx-x,yy-y,(xx*xx+yy*yy-x*x-y*y)/2)}return poly.map(a=>a.join(",")).join(" ")}
function color(p){if(layer==="army")return "hsl("+(125-Math.min(1,p.army/150)*95)+",44%,43%)";if(layer==="economy")return "hsl("+(30+Math.min(1,p.dev/9)*100)+",39%,42%)";if(layer==="happiness")return "hsl("+(p.happy*1.2)+",40%,43%)";return N[p.owner][2]}
function modelSvg(p){
const slots={barracks:[-22,13],investment:[1,18],market:[20,-14],farm:[-21,-16],fort:[1,28],festival:[20,15]};
const labels={barracks:"Kışla",investment:"İnşaat",market:"Pazar",farm:"Çiftlik",fort:"Tahkimat",festival:"Halk Şenliği"};
const types=[["barracks",p.barracks||0],["investment",p.investment||0],["market",p.market||0],["farm",p.farm||0],["fort",p.fort||0],["festival",p.festivals||0]];
return types.filter(x=>x[1]>0).map(([type,count])=>{
const xy=slots[type],x=p.x*10.5+xy[0],y=p.y*5.7+25+xy[1],active=actionFx&&actionFx.id===p.id&&actionFx.type===type;
let art="";
if(type==="barracks")art='<path d="M1 8 10 2l9 6v10H1Z" fill="#9b704a" stroke="#f0d29a"/><path d="M8 18v-6h4v6M14 2v6m0-6h5v3h-5" fill="none" stroke="#ffe0a2"/>';
if(type==="investment")art='<path d="M4 18V7h12v11M1 7h18M2 4h16M14 1v5m0-4h5l-5 2M7 18v-6h5v6" fill="none" stroke="#f0c777" stroke-width="1.7"/><path d="M5 9h10" stroke="#8bd4ca"/>';
if(type==="market")art='<path d="M2 8h16v10H2Z" fill="#8b7351" stroke="#f0d29a"/><path d="m1 8 2-5h14l2 5Z" fill="#b95542" stroke="#ffdaa0"/><path d="M6 8v10m7-5h3v5" stroke="#f8e3bd" stroke-width="1.5"/>';
if(type==="farm")art='<path d="M2 9 10 3l8 6v9H2Z" fill="#9b704a" stroke="#f0d29a"/><path d="M7 18v-6h6v6M1 20h18m-15 0v-4m5 4v-5m5 5v-4" stroke="#a8d887" stroke-width="1.6"/>';
if(type==="fort")art='<path d="M1 18V8h4V5h4v3h4V5h4v3h3v10Z" fill="#8a9087" stroke="#e4d6b4"/><path d="M5 13h2m4 0h2m4 0h1" stroke="#384a43" stroke-width="1.5"/>';
if(type==="festival")art='<path d="M2 2v16m8-16v16m8-16v16" stroke="#e6d9bb"/><path d="M2 3h7L6 8Zm8 1h7l-3 5Z" fill="#d66b56"/><circle cx="18" cy="3" r="2" fill="#f0cd6d"/><path d="M4 20h12" stroke="#a5d7a4"/>';
return '<g class="province-model model-'+type+(active?' build-active':'')+'" transform="translate('+x+' '+y+')"><title>'+type+' · '+count+'</title>'+art+(count>1?'<circle class="model-count-bg" cx="18" cy="18" r="5"/><text class="model-count" x="18" y="20">'+Math.min(count,9)+'</text>':'')+'</g>';
}).join("");
}
function garrisonSvg(p){
const x=p.x*10.5+15,y=p.y*5.7+36;
return '<g class="garrison" transform="translate('+x+' '+y+')" aria-hidden="true"><g class="soldier-figure soldier-a"><circle cx="0" cy="-5" r="2.1" fill="#f2d59a"/><path d="M0-3v6m0-4-3 3m3-3 3 3m-3 1-2 4m2-4 2 4" stroke="#f2d59a" stroke-width="1.5" stroke-linecap="round"/></g><g class="soldier-figure soldier-b"><circle cx="8" cy="-5" r="2.1" fill="#d9e4d2"/><path d="M8-3v6m0-4-3 3m3-3 3 3m-3 1-2 4m2-4 2 4" stroke="#d9e4d2" stroke-width="1.5" stroke-linecap="round"/></g></g>';
}
function marchingSvg(){
if(!marching)return "";
const from=prov(marching.from),to=prov(marching.to);if(!from||!to)return "";
const x1=from.x*10.5,y1=from.y*5.7+25,x2=to.x*10.5,y2=to.y*5.7+25,cx=(x1+x2)/2,cy=(y1+y2)/2-22,path="M"+x1+" "+y1+" Q "+cx+" "+cy+" "+x2+" "+y2;
return '<g class="marching-army" pointer-events="none"><path class="march-trail" d="'+path+'"/><g><animateMotion dur="1.15s" fill="freeze" path="'+path+'"/><circle r="15" fill="#172b25" stroke="#f3d18b" stroke-width="2"/><text class="march-icon" text-anchor="middle" y="5">⚔</text><rect x="7" y="-19" width="25" height="14" rx="6" fill="#e9c588"/><text x="19" y="-9" text-anchor="middle" class="march-count">'+marching.count+'</text></g></g>';
}
function pulseAction(type,id){const token=++fxSeq;actionFx={type,id,token};setTimeout(()=>{if(actionFx&&actionFx.token===token){actionFx=null;if(S)render()}},1500);}
function mapSVG(){
const land="M10 135 Q80 62 175 108 T310 106 Q441 66 561 87 T781 108 Q916 105 1065 138 L1073 403 Q1036 505 950 573 L839 607 741 564 666 541 555 611 432 592 315 551 209 511 95 481 11 409Z";
const base='<svg id="world" viewBox="0 0 1080 650" aria-label="Eyalet haritası"><defs><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#28677a"/><stop offset="1" stop-color="#0d364b"/></linearGradient><clipPath id="clip"><path d="'+land+'"/></clipPath></defs><rect width="1080" height="650" fill="url(#sea)"/><path d="'+land+'" fill="#60765f" stroke="#d7c8a6" stroke-width="3"/><g clip-path="url(#clip)">'+S.p.map(p=>'<polygon data-p="'+p.id+'" class="province '+(p.id===sel?"active ":"")+(moving&&adj(moving).includes(p.id)?"target":"")+(capturedProvince===p.id?" captured":"")+'" fill="'+color(p)+'" points="'+polygon(p)+'"><title>'+safe(p.label)+" · "+name(p.owner)+" · "+p.army+' asker</title></polygon>').join("")+LINKS.map(([a,b])=>{const p=prov(a),q=prov(b);return '<line x1="'+p.x*10.5+'" y1="'+(p.y*5.7+25)+'" x2="'+q.x*10.5+'" y2="'+(q.y*5.7+25)+'" stroke="#f5dba4" stroke-opacity=".25" stroke-dasharray="5 7"/>'}).join("")+S.p.map(modelSvg).join("")+'</g><path d="'+land+'" fill="none" stroke="#e1d0ae" stroke-width="3"/><text x="55" y="68" font="bold 29px Georgia" fill="#ffe0a9" letter-spacing="3">ANADOLU · 1919</text>'+S.p.map(p=>{const x=p.x*10.5,y=p.y*5.7+25;return '<g pointer-events="none"><circle class="army-count-bg" cx="'+x+'" cy="'+y+'" r="15" fill="#162e3c" stroke="#e1c88d" stroke-width="1.5"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" class="number">'+p.army+'</text><text x="'+x+'" y="'+(y-22)+'" text-anchor="middle" class="label">'+safe(p.label)+'</text></g>'+garrisonSvg(p)}).join("")+marchingSvg()+'</svg>';
return base;
}
function render(){if(!S)return home();if(S.win||S.loss){const regions=own();app.innerHTML=gameHeader()+'<main class="home endgame-summary"><div class="hero"><div class="eyebrow">1919–1923 · TUR '+S.turn+'</div><h1>'+(S.win?"🏆 Millî Mücadele Zaferi":"⚑ Sefer Kaybedildi")+'</h1><p>'+(S.win?"Hedef bölgeleri ele geçirdin.":"Devletin topraklarını veya istikrarını kaybetti.")+'</p><div class="stats"><div class="stat">Bölge <b>'+regions.length+'</b></div><div class="stat">Ordu <b>'+regions.reduce((n,p)=>n+p.army,0)+'</b></div><div class="stat">Hazine <b>'+S.gold+'</b></div><div class="stat">Tur <b>'+S.turn+'</b></div></div><div class="actions"><button class="gold" data-a="menu">Yeni Sefer</button><button data-a="saves">Kayıtlar</button><button data-a="world">🌍 Dünya Modu</button></div></div></main>';wire();return}const a=own(),army=a.reduce((n,p)=>n+p.army,0),income=incomeOf(S.me),cost=Math.ceil(army*.23),previousTab=app.querySelector(".tabs .on")?.dataset.tab,previousScroll=app.querySelector(".sidebody")?.scrollTop||0;app.innerHTML=gameHeader()+'<div class="game"><div class="resources"><span>'+flag(S.me)+' <b>'+safe(name(S.me))+'</b></span><span>'+ico("calendar")+' <b>'+date(S.turn)+'</b></span><span>'+ico("coins")+' Altın <b>'+S.gold+'</b></span><span>'+ico("chart")+' Net <b>'+(income-cost)+'</b></span><span>'+ico("swords")+' Ordu <b>'+army+'</b></span><span>'+ico("people")+' İnsan Gücü <b>'+S.men+'</b></span><span>'+ico("book")+' Teknoloji <b>'+S.tech+'</b></span><span>'+ico("shield")+' İstikrar <b>'+S.stability+'%</b></span></div><div class="layout"><section class="maparea"><div class="toolbar">'+[["political","Siyasi"],["army","Ordu"],["economy","Ekonomi"],["happiness","Memnuniyet"]].map(([id,n])=>'<button data-layer="'+id+'" class="'+(layer===id?"selected":"")+'">'+ico(({political:"globe",army:"swords",economy:"coins",happiness:"people"})[id])+' '+n+'</button>').join("")+'<button data-a="center">'+ico("pin")+' Ortala</button><input id="map-search" type="search" list="map-search-options" placeholder="Ülke veya bölge ara" aria-label="Ülke veya bölge ara"><datalist id="map-search-options">'+S.p.map(p=>'<option value="'+safe(p.label)+'">').join("")+'</datalist></div><div id="viewport" class="viewport">'+mapSVG()+'<div class="maptip">'+(moving?"Ordu: "+prov(moving).label+": komşu hedefi seç":"Bölge seç · asker yetiştir · tur bitir")+'</div><div class="zoom"><button data-a="plus" title="Haritayı yakınlaştır" aria-label="Yakınlaştır">'+ico("plus")+'</button><button data-a="minus" title="Haritayı uzaklaştır" aria-label="Uzaklaştır">'+ico("minus")+'</button></div></div><div class="bottom"><span class="small">'+safe(prov(sel)?.label||"Eyalet")+'</span><button data-a="recruit" '+(prov(sel)?.owner!==S.me?"disabled":"")+'>'+ico("plus")+' Asker</button>'+(moving?'<button data-a="cancelmove">✕ İptal</button>':'')+'<button data-a="move" '+(prov(sel)?.owner!==S.me?"disabled":"")+'>'+ico("swords")+' Ordu Gönder</button><span class="spacer"></span><button class="gold" data-a="end">Turu Bitir '+ico("arrow")+'</button></div></section><aside class="side"><div class="tabs">'+[["province","Eyalet"],["nation","Devlet"],["diplomacy","Diplomasi"],["events","Olaylar"]].map(([id,n])=>'<button data-tab="'+id+'" class="'+(tab===id?"on":"")+'">'+n+'</button>').join("")+'</div><div class="sidebody">'+sidebar()+'</div></aside></div></div>';wire();transform();if(previousTab===tab){const panel=app.querySelector(".sidebody");if(panel)panel.scrollTop=previousScroll}if(dialog)modal()}
function sidebar(){return tab==="province"?provincePanel():tab==="nation"?nationPanel():tab==="diplomacy"?diplomacyPanel():eventsPanel()}
function provincePanel(){const p=prov(sel);if(!p)return "";const mine=p.owner===S.me;return '<div class="eyebrow">EYALET YÖNETİMİ</div><h2>'+safe(p.label)+'</h2><p>'+flag(p.owner)+' '+name(p.owner)+'</p><div class="stats"><div class="stat">⚔ Asker <b>'+p.army+'</b></div><div class="stat">👥 Nüfus <b>'+p.pop+'k</b></div><div class="stat">🏛 Gelişim <b>'+p.dev+'</b></div><div class="stat">☺ Memnuniyet <b>'+p.happy+'%</b></div></div><div class="panel"><h3>'+(mine?"Eyalet Kararları":"Yabancı Eyalet")+'</h3>'+(mine?'<p class="muted">Altın harcayarak asker ve üretim kapasitesini artır.</p><div class="gridbtn"><button class="gold" data-a="recruit">＋ 20 Asker<br>60 altın</button><button data-a="move">↗ Ordu Gönder</button><button data-a="invest">📈 Yatırım<br>75 altın</button><button data-a="market">🏦 Pazar<br>95 altın</button><button data-a="farm">🌾 Çiftlik<br>85 altın</button><button data-a="fort">🛡 Tahkimat<br>65 altın</button><button data-a="festival" class="full">🎊 Halk Şenliği · 40 altın</button></div>':'<p class="muted">Düşman ülkeye saldırmak için Diplomasi sekmesinden savaş ilan et, ardından kendi komşu eyaletinden asker gönder.</p><button data-tab="diplomacy">Diplomasi</button>')+'</div><div class="panel"><h3>Komşu Bölgeler</h3>'+adj(p.id).map(id=>'<button data-j="'+id+'" class="chip">'+flag(prov(id).owner)+' '+prov(id).label+'</button>').join("")+'</div>'}
function nationPanel(){const p=own(),army=p.reduce((a,q)=>a+q.army,0),income=incomeOf(S.me),net=income-Math.ceil(army*.23);return '<div class="eyebrow">ULUSAL YÖNETİM</div><h2>'+flag(S.me)+' '+name(S.me)+'</h2><div class="stats"><div class="stat">Eyalet <b>'+p.length+'</b></div><div class="stat">Ordu <b>'+army+'</b></div><div class="stat">Gelir <b>'+income+'</b></div><div class="stat">Net <b>'+net+'</b></div></div><div class="panel"><h3>Zafer Hedefi</h3><p class="muted">'+(S.me==="tr"?"İzmir, Afyon, Eskişehir ve İstanbul'u ele geçir.":"18 eyalete ulaş.")+'</p></div><div class="panel"><h3>Devlet Kararları</h3><p class="muted">Temel devlet geliri: +20 altın/tur. Giderler hazineden karşılanabiliyorsa istikrar düşmez.</p><div class="gridbtn"><button data-a="tax">Vergi Artır<br>+60 altın, −6 istikrar</button><button data-a="research">Teknoloji<br>100 altın</button><button data-a="mobilize">Seferberlik<br>50 altın, +90 insan</button><button data-a="stabilize">İdari Reform<br>70 altın, +10 istikrar</button></div></div><div class="panel"><h3>En Güçlü Eyaletler</h3>'+p.slice().sort((a,b)=>b.army-a.army).slice(0,7).map(q=>'<div class="item"><strong>'+q.label+' · '+q.army+' asker</strong><button style="float:right" data-j="'+q.id+'">Göster</button></div>').join("")+'</div>'}
function diplomacyPanel(){
 const p=prov(sel),id=p?.owner;
 if(!id||id===S.me||id==="ne"||!N[id])return '<div class="eyebrow">DİPLOMASİ</div><h2>Ülke seç</h2><div class="panel"><p>Haritadan görüşmek istediğin yabancı ülkeyi seç. İşlemler yalnızca seçtiğin ülkeye uygulanır.</p><p class="muted">Seçili bölge: '+safe(p?.label||"Yok")+'</p></div>';
 const x=war(id,S.me),r=relation(id,S.me),key=[S.me,id].sort().join("-"),truce=(S.truce?.[key]||0)>S.turn;
 const trading=(S.treaties?.trade||[]).some(pair=>pair.includes(id)&&pair.includes(S.me));
 const ally=S.alliances?.some(pair=>pair.includes(id)&&pair.includes(S.me));
 return '<div class="eyebrow">SEÇİLİ ÜLKE · DİPLOMASİ</div><h2>'+flag(id)+' '+safe(name(id))+'</h2><p class="muted">Seçili bölge: '+safe(p.label)+'</p><div class="panel dip-target" data-country="'+safe(id)+'"><p class="muted">İlişki '+r+' · '+(x?"⚔ Savaş":"🕊 Barış")+(truce?" · Ateşkes "+S.truce[key]+". tura kadar":"")+(ally?" · 🛡 Müttefik":"")+(trading?" · 💰 Ticaret anlaşması":"")+'</p><div class="gridbtn"><button data-d="improve:'+id+'">İlişki Artır<br>35 altın · +13 ilişki</button><button data-d="'+(x?"peace":"war")+':'+id+'">'+(x?"Barış Teklifi<br>Ücretsiz · Ordu dengesi":"Savaş İlanı<br>Ücretsiz · Ateşkes yoksa")+'</button><button data-d="gift:'+id+'">Hediye Gönder<br>55 altın · +22 ilişki</button><button data-d="alliance:'+id+'" '+(ally?'disabled':'')+'>İttifak Kur<br>Ücretsiz · +30 ilişki</button><button data-d="pact:'+id+'" '+(x||truce?'disabled':'')+'>🕊 Saldırmazlık Paktı<br>40 altın · 12 tur</button><button data-d="trade:'+id+'" '+(x||trading?'disabled':'')+'>💰 Ticaret Anlaşması<br>35 altın · +12/tur</button></div></div><p class="muted">Anlaşmalar gerçekten ekonomiyi ve yapay zekâ kararlarını etkiler. Başka bir ülke için haritadan o ülkeye dokun.</p><button data-tab="province">← Eyalete Dön</button>';
}
function eventsPanel(){return '<div class="eyebrow">TELGRAF</div><h2>Olaylar ve Tarihçe</h2><div class="notices">'+S.log.map(e=>'<div class="item"><small>Tur '+e.t+' · '+date(e.t)+'</small>'+safe(e.msg)+'</div>').join("")+'</div>'}
function act(a){
if(a==="menu")return home();
if(a==="nations")return nations();
if(a==="continue"){if(load()){sel=N[S.me][3];render()}else toast("Kayıt bulunamadı.");return}
if(a==="help")return help();
if(a==="historical"){location.href="age.html?scenario=1919";return}
if(a==="world"){location.href="age.html";return}
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
if(a==="plus"||a==="minus"){zoom=clamp(zoom+(a==="plus"?.2:-.2),1,3);transform();return}
if(!S)return;
if(marching&&(a==="move"||a==="end"||a==="recruit"))return toast("Ordu hareketi sürerken yeni bir asker emri veremezsin.");
if(a==="cancelmove"){moving=null;dialog=null;render();return}if(a==="end")return next();
if(a==="move"){
const p=prov(sel);if(!p||p.owner!==S.me)return;
if(p.army<2)return toast("Bu eyalette hareket edecek asker yok.");
if(p.moved)return toast("Bu eyalette bu tur zaten ordu sevkiyatı yaptın.");
moving=sel;render();toast("Haritada seçili eyalete komşu bir bölgeye dokun.");return;
}
if(["recruit","invest","market","farm","fort","festival"].includes(a)){
const p=prov(sel);if(p?.owner!==S.me)return;
const cost={recruit:60,invest:75,market:95,farm:85,fort:65,festival:40}[a];
if(a==="recruit"&&S.men<20)return toast("İnsan gücü yetersiz.");
if(a==="recruit"&&p.moved)return toast("Bu eyalette bu tur zaten ordu sevkiyatı yaptın.");
if(!pay(cost))return;
if(a==="recruit"){p.army+=20;S.men-=20;p.barracks=(p.barracks||0)+1}
if(a==="invest"){p.dev++;p.pop+=2;p.investment=(p.investment||0)+1}
if(a==="market")p.market++;
if(a==="farm"){p.farm++;p.pop+=4}
if(a==="fort")p.fort++;
if(a==="festival")p.festivals=(p.festivals||0)+1;
const models={recruit:"barracks",invest:"investment",market:"market",farm:"farm",fort:"fort",festival:"festival"};
pulseAction(models[a],p.id);
log(p.label+": "+ACTION_LABELS[a]+(a==="recruit"?".":" tamamlandı."));save();render();return;
}
if(["tax","research","mobilize","stabilize"].includes(a)){
S.decisions ||= {};
if(S.decisions[a]===S.turn)return toast("Bu devlet kararını aynı turda yalnızca bir kez uygulayabilirsin.");
if(a==="tax"&&S.stability<6)return toast("Vergi artışı için istikrar yetersiz.");
if(a==="mobilize"&&S.stability<3)return toast("Seferberlik için istikrar yetersiz.");
const cost={tax:0,research:100,mobilize:50,stabilize:70}[a];if(!pay(cost))return;
S.decisions[a]=S.turn;
if(a==="tax"){S.gold+=60;S.stability=clamp(S.stability-6,0,100)}
if(a==="research")S.tech++;
if(a==="mobilize"){S.men+=90;S.stability=clamp(S.stability-3,0,100)}
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
function openMove(to){const f=prov(moving),p=prov(to);if(!f||!p||!adj(f.id).includes(to))return toast("Yalnızca komşu eyalete asker gönder.");if(f.army<2||f.moved)return toast("Bu eyalette hareket edebilecek ordu yok.");dialog={kind:"move",from:f.id,to:p.id,amount:Math.max(1,Math.floor(f.army*.7))};modal()}
function march(){
const d=dialog;if(!d)return;
const f=prov(d.from),p=prov(d.to);if(!f||!p)return;
const input=document.getElementById("amount"),n=clamp(+(input?.value||d.amount),1,f.army-1);
if(f.owner!==p.owner&&!war(f.owner,p.owner)){moving=null;dialog=null;sel=p.id;tab="diplomacy";render();toast("Önce hedef ülkeye savaş ilan et.");return}
moving=null;dialog=null;document.querySelector(".modalbg")?.remove();
const id=++marchSeq; marching={from:d.from,to:d.to,count:n,id};render();
setTimeout(()=>{if(!marching||marching.id!==id)return;marching=null;resolveMarch(d,n)},1180);
}
function resolveMarch(d,n){
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
function ai(){
 const economy=S.aiEconomy ||= {};
 const allies=(a,b)=>S.alliances?.some(pair=>pair.includes(a)&&pair.includes(b))||false;
 const truce=(a,b)=>(S.truce?.[[a,b].sort().join("-")]||0)>S.turn;
 for(const id of Object.keys(N).filter(x=>x!==S.me&&x!=="ne")){
  const regions=S.p.filter(p=>p.owner===id);if(!regions.length)continue;
  const state=economy[id] ||= {gold:80+regions.length*30,men:70+regions.length*25};
  const income=regions.reduce((n,p)=>n+Math.round(p.pop*.12+p.dev*4+p.market*8+p.farm*4),0)+tradeBonus(id);
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
function next(){if(S.win||S.loss)return toast("Sefer sona erdi.");const ps=own(),army=ps.reduce((n,p)=>n+p.army,0),income=incomeOf(S.me),cost=Math.ceil(army*.23);const unpaid=Math.max(0,cost-(S.gold+income));S.gold=Math.max(0,S.gold+income-cost);S.men+=Math.ceil(ps.reduce((n,p)=>n+p.pop,0)/75);S.stability=clamp(S.stability+(unpaid>0?-2:income>=cost?1:0),0,100);for(const p of S.p){p.moved=false;p.pop=Math.min(230,p.pop+(p.farm?2:1));if(p.happy<65)p.happy++}S.turn++;ai();const ev=EVENTS.find(x=>x.t===S.turn);if(ev&&S.me==="tr"){log("📜 "+ev.date+" — "+ev.title);S.seen.push(S.turn)}log("Tur "+S.turn+": gelir "+income+", asker bakım "+cost+".");outcome();save();render();if(ev&&S.me==="tr"&&!dialog)event(ev.date+" — "+ev.title,ev.text)}
function outcome(){if(S.win||S.loss)return;const a=own();if(S.me==="tr"?["Izmir","Afyon","Eskisehir","Istanbul"].every(id=>prov(id).owner==="tr"):a.length>=18){S.win=true;dialog=null;log("🏆 Sefer zaferle tamamlandı.")}else if(!a.length||S.stability<=0){S.loss=true;dialog=null;log("Sefer kaybedildi: devletin kontrolü çöktü.")}}
function event(title,text){dialog={kind:"event",title,text};modal()}
function help(){dialog={kind:"help"};modal()}
function gameConfirm(title,text,onConfirm){dialog={kind:"confirm",title,text,onConfirm};modal()}
function modal(){document.querySelector(".modalbg")?.remove();if(!dialog)return;let h="";
if(dialog.kind==="confirm")h='<div class="eyebrow">ONAY GEREKİYOR</div><h2>'+ico("shield")+' '+safe(dialog.title)+'</h2><p>'+safe(dialog.text)+'</p><div class="actions"><button class="gold" data-modal="confirm">'+ico("swords")+' Onayla</button><button data-modal="cancel">Vazgeç</button></div>';if(dialog.kind==="help")h='<h2>5 Adımda Oyna</h2><p>1. Haritada kendi eyaletini seç.</p><p>2. Sağ panelden asker yetiştir veya ekonomi geliştir.</p><p>3. Ordu Gönder düğmesine bas ve komşu eyalete dokun.</p><p>4. Düşman bölgeye saldırmak için önce Diplomasi menüsünden savaş ilan et.</p><p>5. Turu Bitir ile gelir topla, rakiplerin hamlesini gör ve zafer hedeflerine ilerle.</p><p class="muted">Haritayı sürükle, ＋/− düğmeleriyle yakınlaştır. Her turda otomatik kayıt yapılır.</p><button class="gold" data-modal="close">Anladım, Oyna</button>';
if(dialog.kind==="event")h='<div class="eyebrow">TELGRAF VE HİKÂYE</div><h2>'+safe(dialog.title)+'</h2><p>'+safe(dialog.text)+'</p><button class="gold" data-modal="close">Devam Et</button>';
if(dialog.kind==="move"){const a=prov(dialog.from),b=prov(dialog.to),needsWar=a.owner!==b.owner&&!war(a.owner,b.owner);h='<h2>'+a.label+' → '+b.label+'</h2><p>Asker sevki ve saldırı emri</p><div class="stats"><div class="stat">Asker <b>'+a.army+'</b></div><div class="stat">Savunma <b>'+b.army+'</b></div></div>'+(needsWar?'<div class="warn">Bu ülkeyle savaşta değilsin. Önce savaş ilan et.</div>':'<p>Gönderilecek asker: <b id="count">'+dialog.amount+'</b></p><input type="range" id="amount" min="1" max="'+(a.army-1)+'" value="'+dialog.amount+'">')+'<div class="actions">'+(needsWar?'<button data-modal="dip" class="gold">Diplomasiye Git</button>':'<button data-modal="go" class="gold">Emri Uygula</button>')+'<button data-modal="cancel">Vazgeç</button></div>'}
const ov=document.createElement("div");ov.className="modalbg";ov.innerHTML='<div class="modal" role="dialog" aria-modal="true">'+h+'</div>';document.body.appendChild(ov);ov.querySelectorAll("[data-modal]").forEach(b=>b.onclick=()=>{if(b.dataset.modal==="confirm"){const action=dialog?.kind==="confirm"?dialog.onConfirm:null;dialog=null;moving=null;ov.remove();if(action)action();return}
if(b.dataset.modal==="go")return march();if(b.dataset.modal==="dip"){sel=dialog.to;tab="diplomacy";moving=null;dialog=null;render();return}dialog=null;moving=null;ov.remove();if(S)render()});ov.addEventListener("click",e=>{if(e.target!==ov||dialog?.kind==="event")return;dialog=null;moving=null;ov.remove();if(S)render()});ov.querySelector("[data-modal=confirm]")?.focus();const range=ov.querySelector("#amount");if(range)range.oninput=()=>{dialog.amount=+range.value;ov.querySelector("#count").textContent=range.value}}
function jump(id){if(!prov(id))return;sel=id;moving=null;tab=tab==="diplomacy"?"diplomacy":"province";render()}
function transform(){const el=document.getElementById("world");if(el){el.style.transform="translate("+px+"px,"+py+"px) scale("+zoom+")";el.style.transformOrigin="50% 50%"}}
function wire(){
app.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>act(b.dataset.a));
app.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>start(b.dataset.n,document.getElementById("difficulty")?.value||"normal"));
const filter=app.querySelector("#nation-filter");if(filter)filter.oninput=()=>{let count=0;app.querySelectorAll("[data-n]").forEach(b=>{b.hidden=!b.textContent.toLocaleLowerCase("tr").includes(filter.value.toLocaleLowerCase("tr"));if(!b.hidden)count++});const empty=app.querySelector("#nation-empty");if(empty)empty.hidden=count>0};
app.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{moving=null;tab=b.dataset.tab;render()});
app.querySelectorAll("[data-layer]").forEach(b=>b.onclick=()=>{layer=b.dataset.layer;render()});
app.querySelectorAll("[data-j]").forEach(b=>b.onclick=()=>jump(b.dataset.j));
app.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{const [a,id]=b.dataset.d.split(":");dip(a,id)});
const search=app.querySelector("#map-search");if(search){const locate=()=>{const q=search.value.trim().toLocaleLowerCase("tr");if(!q)return;const region=S.p.find(p=>p.label.toLocaleLowerCase("tr")===q)||S.p.find(p=>p.label.toLocaleLowerCase("tr").includes(q))||S.p.find(p=>name(p.owner).toLocaleLowerCase("tr")===q);if(!region)return toast("Aranan ülke veya bölge bulunamadı.");jump(region.id);const vp=document.getElementById("viewport");if(!vp)return;const w=vp.clientWidth,h=vp.clientHeight,scale=Math.min(w/1080,h/650),ox=(w-1080*scale)/2,oy=(h-650*scale)/2;zoom=2.2;px=zoom*(w/2-(ox+region.x*10.5*scale));py=zoom*(h/2-(oy+(region.y*5.7+25)*scale));transform();};search.onchange=locate;search.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();locate()}}}
const vp=document.getElementById("viewport");if(!vp)return;
vp.querySelectorAll("[data-p]").forEach(b=>{b.onclick=e=>{if(ignoreClick)return;const id=b.dataset.p;moving?openMove(id):jump(id)};b.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();moving?openMove(b.dataset.p):jump(b.dataset.p)}}});
vp.onwheel=e=>{e.preventDefault();zoom=clamp(zoom+(e.deltaY<0?.12:-.12),1,3);transform()};
vp.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ox:px,oy:py,moved:false,captured:false}};
vp.onpointermove=e=>{
if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
if(Math.abs(dx)+Math.abs(dy)>9)drag.moved=true;
if(drag.moved){
if(!drag.captured){try{vp.setPointerCapture(e.pointerId);drag.captured=true}catch(_){}}
px=clamp(drag.ox+dx,-400*zoom,400*zoom);py=clamp(drag.oy+dy,-250*zoom,250*zoom);transform();
}
};
vp.onpointerup=e=>{if(!drag)return;ignoreClick=drag.moved;drag=null;setTimeout(()=>{ignoreClick=false},0)};
vp.onpointercancel=()=>{drag=null;ignoreClick=false};
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog?.kind!=="event"){dialog=null;document.querySelector(".modalbg")?.remove();moving=null;if(S)render()}});
home();

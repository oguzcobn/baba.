
"use strict";
/* 1919 STRATEGY SYSTEMS v1 — original grand-strategy mechanics, historical framing.
   Sefer tek oyunculudur. Historical milestones describe events, not deterministic outcomes. */
(()=>{
const original={fresh,next,campaign,beginBattle,finishBattle,home,scenarios};
const gameStart=new Date(Date.UTC(1919,4,19));
const HIST=[
{turn:1,date:"19 Mayıs 1919",name:"Samsun'a Çıkış",text:"Mustafa Kemal Paşa Samsun'a ulaştı. Millî Mücadele'nin örgütlenme dönemi başlıyor.",focus:"amasya"},
{turn:2,date:"22 Haziran 1919",name:"Amasya Genelgesi",text:"Millî bağımsızlığın milletin kararıyla sağlanması fikri Anadolu'da örgütlenmeyi hızlandırdı.",focus:"amasya"},
{turn:3,date:"23 Temmuz 1919",name:"Erzurum Kongresi",text:"Doğu vilayetlerinde millî irade ve vatanın bütünlüğü öne çıktı.",focus:"kongre"},
{turn:5,date:"4 Eylül 1919",name:"Sivas Kongresi",text:"Müdafaa-i Hukuk teşkilatları daha geniş bir birlik etrafında örgütlendi.",focus:"kongre"},
{turn:8,date:"27 Aralık 1919",name:"Ankara'ya Geliş",text:"Heyet-i Temsiliye Ankara'ya geldi; karar ve haberleşme merkezi güçlendi.",focus:"meclis"},
{turn:12,date:"23 Nisan 1920",name:"TBMM'nin Açılışı",text:"Ankara'da Büyük Millet Meclisi açıldı; düzenli ordu ve meşruiyet mücadelesi yeni aşamaya geçti.",focus:"meclis"},
{turn:21,date:"Ocak 1921",name:"I. İnönü Muharebesi",text:"Düzenli ordunun Batı Cephesi'ndeki mücadele dönemi. Eskişehir hattının ikmali önem kazandı.",focus:"ordu"},
{turn:23,date:"Mart–Nisan 1921",name:"II. İnönü Muharebesi",text:"Batı Cephesi'nde savunma, demiryolu ve topçu desteğinin değeri artıyor.",focus:"ordu"},
{turn:28,date:"Ağustos 1921",name:"Sakarya Hattı",text:"Savunmanın derinliği ve ordunun lojistik dayanıklılığı belirleyici.",focus:"sakarya"},
{turn:29,date:"13 Eylül 1921",name:"Sakarya Zaferi",text:"Tarihsel savaşın sona erdiği dönem. Oyunda zafer veya yenilgi komutanın kararlarına bağlıdır.",focus:"sakarya"},
{turn:40,date:"26 Ağustos 1922",name:"Büyük Taarruz",text:"Batı Cephesi'nde taarruz için asker, topçu ve ikmal birikimi gereklidir.",focus:"taarruz"},
{turn:42,date:"11 Ekim 1922",name:"Mudanya Mütarekesi",text:"Tarihsel diplomatik sonuçlara giden süreç. Oyunda siyasi başarı şartlara bağlıdır.",focus:"diplomasi"},
{turn:51,date:"24 Temmuz 1923",name:"Lozan Antlaşması",text:"Tarihsel barış düzeninin dönüm noktası. Oyunda bağımsızlık sonucu stratejik başarına bağlıdır.",focus:"diplomasi"}];
const FOCUSES=[
{id:"amasya",title:"Amasya Hattı",branch:"Millî Örgütlenme",icon:"✉",duration:2,requires:[],desc:"Haberleşme ağlarını kur. Millî moral ve siyasi irade kazan.",effect:"Moral +12, siyasi güç +25"},
{id:"kongre",title:"Erzurum ve Sivas Kongreleri",branch:"Millî Örgütlenme",icon:"⚑",duration:3,requires:["amasya"],desc:"Bölgesel direnişi ortak komuta altında birleştir.",effect:"İnsan gücü +80, moral +8"},
{id:"meclis",title:"TBMM ve Ulusal İrade",branch:"Millî Örgütlenme",icon:"🏛",duration:3,requires:["kongre"],desc:"Meclis kararları ve yeni ordu idaresi.",effect:"Siyasi güç +60, altın +90"},
{id:"ordu",title:"Düzenli Ordu",branch:"Kara Kuvvetleri",icon:"⚔",duration:3,requires:["meclis"],desc:"Milis birliklerini tertipli savunma kuvvetine dönüştür.",effect:"Asker +35, birlik morali +10"},
{id:"lojistik",title:"İstiklal Yolu",branch:"Lojistik",icon:"📦",duration:2,requires:["amasya"],desc:"İnebolu–Ankara ikmal hattını ve mühimmat sevkiyatını güçlendir.",effect:"İkmal +100, ikmal kapasitesi +1"},
{id:"imalat",title:"İmalat-ı Harbiye",branch:"Sanayi",icon:"⚙",duration:3,requires:["lojistik"],desc:"Atölyeleri büyüt, tüfek ve cephane üretimini artır.",effect:"Üretim +1, teknoloji +1"},
{id:"sakarya",title:"Sathı Müdafaa Doktrini",branch:"Kara Kuvvetleri",icon:"🛡",duration:3,requires:["ordu"],desc:"Cephe gerisinde ikinci savunma hatları ve yedekler oluştur.",effect:"Tahkimat +1, moral +12"},
{id:"taarruz",title:"Büyük Taarruz Planı",branch:"Kara Kuvvetleri",icon:"🐎",duration:4,requires:["sakarya","imalat"],desc:"Topçu hazırlığı ve süvari manevrasını birleştir.",effect:"Asker +40, ikmal +80"},
{id:"diplomasi",title:"Uluslararası Tanınma",branch:"Diplomasi",icon:"⚖",duration:3,requires:["meclis"],desc:"Anlaşmalar için siyasi temsil ve diplomatik imkanları artır.",effect:"Siyasi güç +70, altın +60"}
];
const ALT_FOCUS={
amasya:["Seferberlik Ağı","Cephe haberleşmesini ve askerî koordinasyonu güçlendir."],
kongre:["Kurmay Konferansı","Askerî yönetim birimleri arasında ortak plan oluştur."],
meclis:["Merkezî Hükûmet","Siyasi idare ve bütçe denetimini güçlendir."],
ordu:["Ordu Modernizasyonu","Düzenli birliklerin eğitimini ve ikmalini geliştir."],
lojistik:["Demiryolu İkmal Planı","Cephe gerisine demiryolu, araç ve depo ağı kur."],
imalat:["Savaş Sanayisi","Tüfek, topçu ve mühimmat imalatını artır."],
sakarya:["Derin Savunma","Geri savunma hatları ve takviye planları kur."],
taarruz:["Genel Taarruz Planı","Birlikleri topçu ve manevra planıyla koordine et."],
diplomasi:["Dış Politika Heyeti","Ticaret, sınır ve ateşkes müzakerelerini güçlendir."]
};
const focusTitle=f=>state?.faction==="tr"?f.title:(ALT_FOCUS[f.id]?.[0]||f.title);
const focusDesc=f=>state?.faction==="tr"?f.desc:(ALT_FOCUS[f.id]?.[1]||f.desc);
const LINES=[
{id:"rifle",name:"Mavzer Tüfekleri",icon:"🔧",cost:25,time:2,supply:0,men:18,description:"Düzenli piyade için silah ve eğitim. Tamamlanınca seçilen bölgeye 18 asker."},
{id:"ammo",name:"Cephe Cephanesi",icon:"📦",cost:22,time:2,supply:60,men:0,description:"Makineli tüfek ve topçu bataryalarının cephanesini yenile."},
{id:"artillery",name:"75 mm Topçu Bataryası",icon:"💣",cost:55,time:4,supply:30,men:12,description:"Topçu desteği sağlar; asker ve ikmal kazandırır."},
{id:"wagon",name:"İkmal Kağnı Kolu",icon:"🐂",cost:32,time:3,supply:95,men:0,description:"İnebolu–Ankara hattından yedek ikmal taşır."}
];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const findFocus=id=>FOCUSES.find(f=>f.id===id);
const log=t=>{if(!state)return;state.log.unshift(t);state.log=state.log.slice(0,55)};
function ensure(s){
if(!s)return;
if(!s.strategy)s.strategy={focus:null,completed:[],queue:[],political:40,manpower:240,capacity:1,industry:1,unrest:12,alert:null,seenEvents:[],win:false,loss:false,helpSeen:false};
const st=s.strategy;
for(const [k,v] of Object.entries({focus:null,completed:[],queue:[],political:40,manpower:240,capacity:1,industry:1,unrest:12,alert:null,seenEvents:[],win:false,loss:false,helpSeen:false}))if(st[k]===undefined)st[k]=Array.isArray(v)?[]:v;
}
function fromTurn(t){
const month=(t-1)%12,year=1919+Math.floor((t-1)/12);
return new Date(Date.UTC(year,4+month,19)).toLocaleDateString("tr-TR",{month:"long",year:"numeric",timeZone:"UTC"});
}
function troopSupply(p){
if(!state)return 0;
const own=p.owner===state.faction;
if(!own)return Math.min(100,p.level*24+15);
const anchors=state.regions.filter(q=>q.owner===state.faction&&(q.id==="Ankara"||q.id==="Inebolu"||q.level>=3));
if(!anchors.length)return 0;
const visited=new Set(anchors.map(q=>q.id)),queue=anchors.map(q=>({id:q.id,d:0}));
let hops=Infinity;
for(let i=0;i<queue.length;i++){const cur=queue[i];if(cur.id===p.id){hops=cur.d;break}
for(const [a,b] of edges){const n=a===cur.id?b:b===cur.id?a:null;if(!n||visited.has(n))continue;const r=region(n);if(!r||r.owner!==state.faction)continue;visited.add(n);queue.push({id:n,d:cur.d+1})}}
if(!isFinite(hops))return 12;
return clamp(Math.round(100-hops*18+(p.level-1)*12+(state.strategy.capacity-1)*6),15,100);
}
function doFocus(f){
const st=state.strategy;
if(st.completed.includes(f.id))return;
st.completed.push(f.id);
switch(f.id){
case "amasya":state.morale=clamp(state.morale+12,0,100);st.political+=25;break;
case "kongre":st.manpower+=80;state.morale=clamp(state.morale+8,0,100);break;
case "meclis":st.political+=60;state.gold+=90;break;
case "ordu":{const r=region("Ankara");if(r&&r.owner===state.faction)r.army+=35;state.morale=clamp(state.morale+10,0,100);break}
case "lojistik":state.supply+=100;st.capacity++;break;
case "imalat":st.industry++;state.tech=(state.tech||0)+1;break;
case "sakarya":state.regions.filter(p=>p.owner===state.faction).slice(0,5).forEach(p=>p.fort++);state.morale=clamp(state.morale+12,0,100);break;
case "taarruz":{const r=region("Afyon");const p=r?.owner===state.faction?r:region("Ankara");if(p&&p.owner===state.faction)p.army+=40;state.supply+=80;break}
case "diplomasi":st.political+=70;state.gold+=60;break;
}
log("★ Ulusal odak tamamlandı: "+focusTitle(f)+". "+f.effect+".");
}
function processFocus(){
const st=state.strategy;
if(!st.focus)return;
st.focus.remaining-=1;
if(st.focus.remaining<=0){const f=findFocus(st.focus.id);st.focus=null;if(f)doFocus(f)}
}
function processQueue(){
const st=state.strategy;
for(const q of st.queue){q.remaining-=st.industry}
const ready=st.queue.filter(q=>q.remaining<=0);
st.queue=st.queue.filter(q=>q.remaining>0);
for(const q of ready){
const def=LINES.find(x=>x.id===q.id);if(!def)continue;
const dest=region(q.dest);state.supply+=def.supply;
if(dest&&dest.owner===state.faction&&def.men>0)dest.army+=def.men;
else st.manpower+=Math.ceil(def.men*.5);
log("⚙ Üretim tamamlandı: "+def.name+" → "+(dest?.name||"Ulusal depo")+".");
}}
function processPolitics(){
const st=state.strategy;
st.political+=3+Math.floor(state.regions.filter(p=>p.owner===state.faction).length/6);
st.manpower+=Math.max(1,Math.floor(state.regions.filter(p=>p.owner===state.faction).length/4));
const regionTotal=state.regions.filter(p=>p.owner===state.faction).length;
if(regionTotal>10)st.unrest=Math.max(0,st.unrest-2);
if(st.unrest>65){state.gold=Math.max(0,state.gold-12);state.morale=Math.max(0,state.morale-2)}
if(state.turn%4===0){const towns=state.regions.filter(p=>p.owner===state.faction&&p.army>18);
for(const town of towns.slice(0,3)){const s=troopSupply(town);if(s<35){town.army=Math.max(5,town.army-2);log("⚠ "+town.name+" ikmal yetersizliği nedeniyle 2 asker kaybetti.")}}}
}
function processUpkeep(){
const own=state.regions.filter(p=>p.owner===state.faction);
const armyTotal=own.reduce((n,p)=>n+p.army,0);
const budget=Math.max(5,Math.ceil(armyTotal/11));
const provisions=Math.max(5,Math.ceil(armyTotal/15));
state.gold=Math.max(0,state.gold-budget);
state.supply=Math.max(0,state.supply-provisions);
if(state.gold===0&&state.turn%3===0){state.morale=clamp(state.morale-3,0,100);log("⚠ Hazine boşaldı. Birliklerin moralinde düşüş yaşandı.")}
if(state.supply===0&&state.turn%3===0){state.morale=clamp(state.morale-3,0,100);log("⚠ İkmal stokları tükendi. Yeni üretim ve sevkiyat emirleri ver.")}
}
function processEnemy(){
const st=state.strategy;
const foes=state.regions.filter(p=>p.owner!==state.faction);
if(!foes.length)return;
const target=foes[state.turn%foes.length];
if(target)target.army=clamp(target.army+3+(state.turn%5===0?3:0),0,155);
if(state.turn>4&&state.turn%5===0){
const contested=state.regions.filter(p=>p.owner===state.faction&&edges.some(([a,b])=>a===p.id&&region(b)?.owner!==state.faction||b===p.id&&region(a)?.owner!==state.faction));
if(contested.length){
const p=contested[Math.floor(state.turn/5)%contested.length];
const pressure=3+Math.floor(state.turn/12);
const defense=p.army+p.fort*6;
if(defense<22){p.army=Math.max(1,p.army-pressure);state.morale=clamp(state.morale-2,0,100);log("⚠ "+p.name+" sınırında düşman baskını: "+pressure+" asker kaybedildi.")}
else log("🛡 "+p.name+" sınırında düşman keşif saldırısı püskürtüldü.");
}}
}
function historical(){
if(state.faction!=="tr")return;
const st=state.strategy;for(const event of HIST.filter(x=>x.turn===state.turn&&!st.seenEvents.includes(x.turn))){
st.seenEvents.push(event.turn);
st.alert={kind:"history",title:event.name,date:event.date,text:event.text,focus:event.focus};
log("📜 "+event.date+" · "+event.name+" — "+event.text);
}}
function victory(){
const st=state.strategy;if(st.win||st.loss)return;
if(state.faction==="tr"){
const owns=id=>region(id)?.owner===state.faction;
if(owns("Izmir")&&owns("Afyon")&&owns("Eskisehir")&&owns("Istanbul")&&st.completed.includes("meclis")&&st.completed.includes("taarruz")){
st.win=true;st.alert={kind:"victory",title:"Bağımsızlık Zaferi",date:state.day,text:"Batı Cephesi hedefleri, İstanbul ve millî teşkilatlanma tamamlandı. Alternatif tarih seferini başarıyla bitirdin."};log("🏆 Sefer hedefleri başarıyla tamamlandı.");
}
if(!owns("Ankara")||state.morale<=0){st.loss=true;st.alert={kind:"loss",title:"Seferin Sonu",date:state.day,text:"Karargâhın düştü veya millî moral tükendi. Son kaydı yükleyebilir veya yeni sefer açabilirsin."};}
} else {
const controlled=state.regions.filter(p=>p.owner===state.faction).length;
if(controlled>=12&&state.turn>=8&&st.completed.includes("ordu")){st.win=true;st.alert={kind:"victory",title:"Sefer Hedefi Tamamlandı",date:state.day,text:"Alternatif seferde 12 bölgeyi kontrol altına alıp düzenli ordu planını tamamladın."};}
if(state.morale<=0||controlled===0){st.loss=true;st.alert={kind:"loss",title:"Sefer Kaybedildi",date:state.day,text:"Ordu moralleri dağıldı veya kontrol edilen bölge kalmadı."};}
}
}
const baseFresh=fresh;
fresh=function(f){const s=baseFresh(f);ensure(s);s.day=f==="tr"?"19 Mayıs 1919":s.day;
if(f!=="tr"){
const initial={de:"Istanbul",gb:"Istanbul",fr:"Adana",gr:"Izmir",ru:"Kars"}[f]||"Ankara";
if(f==="de")for(const p of s.regions.filter(p=>["Istanbul","Canakkale"].includes(p.id)))p.owner="de";
s.selected=initial;const home=s.regions.find(p=>p.id===initial);
if(home){home.owner=f;home.army=Math.max(home.army,52)}
s.log.unshift("Alternatif tarih senaryosu: "+f.toUpperCase()+" için Anadolu cepheleri temsilî biçimde düzenlendi.");
}

if(f==="tr"){s.strategy.seenEvents.push(1);s.strategy.alert={kind:"history",title:"Samsun'a Çıkış",date:"19 Mayıs 1919",text:"Mustafa Kemal Paşa Samsun'a ulaştı. İlk görevin: ulusal odaklardan Amasya Hattı'nı seçip millî örgütlenmeyi başlatmak."};}
return s};
const originalAction=action;
action=function(a){
if(!state)return originalAction(a);
ensure(state);const st=state.strategy;
if(a==="recruit"){
const r=region(sel);
if(r?.owner===state.faction&&state.gold>=40){
if(st.manpower<10)return alert("İnsan gücü yetersiz. Siyasi kararlar veya ulusal odaklarla insan gücü kazan.");
st.manpower-=10;
}
}
if(a==="march"){
const r=region(sel),dest=document.getElementById("march")?.value,d=dest?region(dest):null;
if(r&&d&&r.owner===state.faction&&r.army>=12&&edges.some(([x,y])=>x===r.id&&y===d.id||y===r.id&&x===d.id)){
const cost=d.owner===state.faction?4:16;
if(state.supply<cost)return alert("Cephe emri için yeterli ikmal bulunmuyor ("+cost+" gerekli). İkmal üret veya sevk kararı al.");
state.supply-=cost;
}
}
originalAction(a);
};
const oldNext=next;
next=function(){
if(!state)return;ensure(state);if(state.strategy.win||state.strategy.loss)return;
oldNext();
if(!state)return;
ensure(state);
state.day=state.faction==="tr"?fromTurn(state.turn):state.day;
processFocus();processQueue();processPolitics();processUpkeep();processEnemy();historical();victory();
campaign();
};
const oldCampaign=campaign;
campaign=function(){if(!state)return oldCampaign();ensure(state);oldCampaign();renderStrategy()};
const oldPrebattle=prebattle;
prebattle=function(opts){
oldPrebattle(opts);
const modal=document.querySelector("#modal .modal");
if(!modal)return;
const container=modal.querySelector(".actions");
if(!container)return;
const btn=document.createElement("button");btn.type="button";btn.textContent="⚖ Muharebeyi Otomatik Çöz";btn.title="Birlik gücü, ikmal, tahkimat ve moral etkisiyle otomatik sonuç hesaplar.";
container.appendChild(btn);btn.onclick=()=>{
if(!state)return;
ensure(state);
const orig=opts.origin?region(opts.origin):null,to=opts.target?region(opts.target):null;
const s=opts.scenario?SCENARIOS.find(x=>x.id===opts.scenario):null;
const left=orig?.army||100,right=to?.army||100;
const supply=orig?troopSupply(orig):100;
const atk=left*(.65+.35*supply/100)*(state.morale/85)*(1+(state.tech||0)*.07);
const def=right*(1+(to?.fort||1)*.12);
const scenarioFactor=s?.id==="sarikamis"?.83:1;
const ratio=(atk*scenarioFactor)/(atk*scenarioFactor+def);
const seed=Math.abs(Math.sin((state.turn*31+left*17+right*13+(to?.id?.length||6)*23)*.71));
const threshold=(state.difficulty==="hard"?.56:state.difficulty==="easy"?.43:.50)+(seed-.5)*.18;
const win=ratio>=threshold;
const survivors=Math.max(3,Math.round(left*(win?.58+ratio*.19:.22+ratio*.2)));
const enemyRemain=Math.max(1,Math.round(right*(win?.24+(1-ratio)*.2:.60+(1-ratio)*.25)));
const fake={opts,s,origin:opts.origin,target:opts.target,t:0,done:true,end:win?"win":"lose",units:[]};
for(let i=0;i<4;i++)fake.units.push({team:0,hp:survivors/4,max:left/4});
for(let i=0;i<4;i++)fake.units.push({team:1,hp:enemyRemain/4,max:right/4});
battle=fake;document.getElementById("modal")?.remove();finishBattle(fake);
};
};
const oldBegin=beginBattle;
beginBattle=function(opts){
if(state){ensure(state);const poor=opts.origin?troopSupply(region(opts.origin)):100;if(poor<30){log("⚠ Düşük ikmal koşullarında muharebeye girildi.");}}
oldBegin(opts);
if(!battle||!state)return;
const sup=battle.origin?troopSupply(region(battle.origin)):100;
for(const u of battle.units.filter(x=>x.team===0)){u.ammo=Math.max(24,Math.round(u.ammo*sup/100));if(sup<35)u.morale=Math.max(30,u.morale-18)}
};
const oldFinish=finishBattle;
finishBattle=function(b){oldFinish(b);if(state){ensure(state);victory();save()}}
function save(){if(!state)return;try{localStorage.setItem("baba_1919_autosave",JSON.stringify(state))}catch{}}
function runFocus(id){
const f=findFocus(id),st=state?.strategy;if(!f||!st)return;
if(st.completed.includes(id))return alert("Bu odak zaten tamamlandı.");
if(st.focus)return alert("Önce mevcut odağın tamamlanmasını bekle.");
if(!f.requires.every(x=>st.completed.includes(x)))return alert("Önce önkoşulları tamamlamalısın: "+f.requires.map(x=>findFocus(x)?.title||x).join(", "));
st.focus={id,remaining:f.duration};log("★ Ulusal odak başlatıldı: "+focusTitle(f)+". "+f.duration+" tur.");save();renderStrategy();
}
function queueProduction(id){
const st=state?.strategy,line=LINES.find(x=>x.id===id);if(!st||!line)return;
if(st.queue.length>=2+Math.floor(st.industry/2))return alert("Üretim hatları dolu. Mevcut siparişin tamamlanmasını bekle.");
if(state.gold<line.cost)return alert("Bu üretim için "+line.cost+" altın gerekiyor.");
const dest=(region(sel)?.owner===state.faction?sel:state.regions.find(p=>p.owner===state.faction)?.id);
if(!dest)return alert("Üretimi teslim edebileceğin dost bölgen bulunamadı.");
state.gold-=line.cost;
st.queue.push({id,remaining:line.time,dest});log("⚙ Üretim emri: "+line.name+" → "+region(dest).name+".");save();renderStrategy();
}
function doDecree(id){
const st=state.strategy,need={fund:25,mobilize:35,supply:30,calm:20,rail:40}[id];
if(st.political<need)return alert("Siyasi güç yetersiz ("+need+" gerekli).");
st.political-=need;
switch(id){
case "fund":state.gold+=75;log("Hazine tahvilleri: +75 altın");break;
case "mobilize":st.manpower+=120;state.morale=Math.max(5,state.morale-4);log("Seferberlik çağrısı: +120 insan gücü, -4 moral");break;
case "supply":state.supply+=90;log("Yerel ikmal seferberliği: +90 ikmal");break;
case "calm":st.unrest=Math.max(0,st.unrest-18);state.morale=clamp(state.morale+3,0,100);log("Halk meclisleri: huzursuzluk -18");break;
case "rail":st.capacity++;state.supply+=35;log("Demiryolu seferleri düzenlendi: ikmal kapasitesi +1");break;
}save();renderStrategy();
}
function focusMarkup(){
const st=state.strategy,active=st.focus;
const groups=[...new Set(FOCUSES.map(f=>f.branch))];
return '<div class="strategy-grid">'+groups.map(group=>'<section class="strategy-sub"><h3>'+group+'</h3>'+FOCUSES.filter(f=>f.branch===group).map(f=>{
const done=st.completed.includes(f.id),chosen=active?.id===f.id,ready=f.requires.every(x=>st.completed.includes(x));
return '<button class="strategy-focus '+(done?"done":chosen?"active":"")+'" data-focus="'+f.id+'" '+(done||!!active||!ready?"disabled":"")+'><span class="strategy-focus-icon">'+f.icon+'</span><span><b>'+focusTitle(f)+'</b><small>'+focusDesc(f)+'</small><em>'+f.effect+' · '+f.duration+' tur '+(done?"✓ Tamamlandı":chosen?"⏳ "+active.remaining+" tur":ready?"▶ Başlat":"🔒 "+f.requires.map(x=>findFocus(x)?.title).join(", "))+'</em></span></button>'}).join("")+'</section>').join("")+'</div>';
}
function productionMarkup(){
const st=state.strategy;
return '<div class="strategy-info"><b>⚙ Üretim Atölyeleri</b><p>Üretim hattı sayısı: '+(2+Math.floor(st.industry/2))+' · Üretim hızı: '+st.industry+' tur/hamle. Bittiğinde asker ve ikmal seçili dost bölgeye teslim edilir.</p></div><div class="strategy-grid">'+LINES.map(x=>'<div class="strategy-product"><b>'+x.icon+' '+x.name+'</b><p>'+x.description+'</p><span>'+x.cost+' altın · '+x.time+' tur</span><button data-produce="'+x.id+'">＋ Üretim emri ver</button></div>').join("")+'</div><h3>Devam Eden Üretim</h3>'+(st.queue.length?st.queue.map((q,i)=>'<div class="strategy-row">'+(LINES.find(x=>x.id===q.id)?.name||q.id)+' <b>'+q.remaining+' tur</b> · '+(region(q.dest)?.name||"Depo")+'</div>').join(""):'<p class="muted">Henüz üretim emri yok.</p>');
}
function logisticsMarkup(){
const own=state.regions.filter(p=>p.owner===state.faction);
const bars=own.map(p=>{const v=troopSupply(p);return '<button data-region="'+p.id+'" class="supply-row"><span>'+p.name+' <small>'+p.army+' asker</small></span><span class="supply-graphic"><i style="width:'+v+'%;background:'+(v>=65?"#83b888":v>=40?"#e2b668":"#c76f62")+'"></i></span><b>%'+v+'</b></button>'}).join("");
return '<div class="strategy-info"><b>📦 İstiklal Yolu ve Cephe İkmali</b><p>İkmal noktaları Ankara, İnebolu ve gelişmiş ikmal depolarıdır. Dost bölgeler üzerinden cepheye ulaşılamıyorsa birliklerin cephanesi azalır.</p></div><div class="strategy-grid"><div class="strategy-product"><b>Ulusal ikmal</b><div class="strategy-big">'+state.supply+'</div></div><div class="strategy-product"><b>İkmal kapasitesi</b><div class="strategy-big">'+state.strategy.capacity+'</div></div></div><div class="supply-list">'+bars+'</div>';
}
function decisionsMarkup(){
const st=state.strategy;const items=[
["fund","💰 Hazine Tahvilleri","+75 altın","25 siyasi güç"],
["mobilize","⚑ Seferberlik Çağrısı","+120 insan gücü / -4 moral","35 siyasi güç"],
["supply","🐂 Cepheye İkmal Sevki","+90 ikmal","30 siyasi güç"],
["calm","🏛 Halk Meclisleri","Huzursuzluk -18","20 siyasi güç"],
["rail","🚂 Demiryolu Seferleri","İkmal kapasitesi +1","40 siyasi güç"]];
return '<div class="strategy-info"><b>⚖ İdare ve Diplomasi</b><p>Siyasi güç her tur artar. Kararlar cephe ihtiyaçlarına göre uygulanır; stratejik tercihler savaşın gidişini etkiler.</p></div><div class="strategy-grid">'+items.map(([id,title,effect,cost])=>'<button class="strategy-focus" data-decree="'+id+'"><span><b>'+title+'</b><small>'+effect+'</small><em>'+cost+'</em></span></button>').join("")+'</div><p class="muted">Tarihsel antlaşmalar, seferde tamamlanan odaklara ve döneme göre olaylar bölümünde gösterilir.</p>';
}
function historyMarkup(){
if(state.faction!=="tr")return '<div class="strategy-info"><b>📜 Alternatif Tarih Seferi</b><p>Türkiye dışındaki bu sefer, Anadolu strateji haritasında oluşturulmuş alternatif bir askerî senaryodur. Türk Kurtuluş Savaşı kronolojisi bu ülkenin otomatik tarihçesi olarak gösterilmez.</p></div><div class="strategy-history"><div><small>1914–1922</small><h3>Alternatif Sefer Hedefi</h3><p>En az 12 bölgeyi kontrol et ve Ordu Modernizasyonu odağını tamamla.</p></div></div>';
const seen=state.strategy.seenEvents;
return '<div class="strategy-info"><b>📜 Millî Mücadele Kronolojisi</b><p>Tarihsel olayların gerçekleşme zamanları kaynaklara dayanır. Savaş sonuçları oyuncunun tercihlerine göre farklılaşabilir.</p></div>'+HIST.map(x=>'<div class="strategy-history '+(seen.includes(x.turn)?"seen":"")+'"><div><small>'+x.date+'</small><h3>'+x.name+'</h3><p>'+x.text+'</p></div><span>'+(seen.includes(x.turn)?"✓ Yaşandı":"◌ Yaklaşan")+'</span></div>').join("");
}
let tab="focus",noticeLast=0;
function addStrategyShortcut(){
if(!state||mode!=="campaign")return;
const top=app.querySelector(".statbar");
if(!top||document.getElementById("strategyQuick"))return;
const quick=document.createElement("button");quick.id="strategyQuick";quick.className="primary";quick.textContent="★ Ulusal Yönetim ve Üretim";quick.style.cssText="margin:8px 0;min-height:42px;width:100%";
top.insertAdjacentElement("afterend",quick);
quick.onclick=()=>{document.getElementById("grandStrategy")?.scrollIntoView({behavior:"smooth",block:"start"})};
}
function renderStrategy(){
if(!state||mode!=="campaign")return;
ensure(state);
const root=document.querySelector(".layout");if(!root)return;
document.querySelector("#grandStrategy")?.remove();
const st=state.strategy,focus=st.focus&&findFocus(st.focus.id);
const section=document.createElement("section");section.id="grandStrategy";section.className="strategy-shell";
section.innerHTML='<div class="strategy-dashboard"><div><small>ULUSAL KOMUTA KONSEYİ</small><h2>Devlet Yönetimi</h2></div><div class="strategy-kpis"><span>⚖ Siyasi güç <b>'+st.political+'</b></span><span>♟ İnsan gücü <b>'+st.manpower+'</b></span><span>⚙ Sanayi <b>'+st.industry+'</b></span><span>⚠ Huzursuzluk <b>'+st.unrest+'</b></span></div></div><div class="strategy-progress">'+(focus?'<span>★ Aktif odak: <b>'+focusTitle(focus)+'</b> · '+st.focus.remaining+' tur kaldı</span>':'<span>★ Ulusal odak seçilmedi. Odaklar kalıcı stratejik avantaj sağlar.</span>')+'<button id="strategyHelp">? Nasıl oynanır</button></div><div class="strategy-tabs" role="tablist">'+[["focus","★ Ulusal Odaklar"],["production","⚙ Üretim"],["logistics","📦 İkmal"],["decisions","⚖ Kararlar"],["history","📜 Tarih"]].map(([id,n])=>'<button role="tab" aria-selected="'+(tab===id)+'" data-tab="'+id+'">'+n+'</button>').join("")+'</div><div class="strategy-panel">'+({focus:focusMarkup,production:productionMarkup,logistics:logisticsMarkup,decisions:decisionsMarkup,history:historyMarkup}[tab]||focusMarkup)()+'</div>';
root.insertAdjacentElement("afterend",section);
addStrategyShortcut();
section.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderStrategy()});
section.querySelectorAll("[data-focus]").forEach(b=>b.onclick=()=>runFocus(b.dataset.focus));
section.querySelectorAll("[data-produce]").forEach(b=>b.onclick=()=>queueProduction(b.dataset.produce));
section.querySelectorAll("[data-decree]").forEach(b=>b.onclick=()=>doDecree(b.dataset.decree));
section.querySelectorAll("[data-region]").forEach(b=>b.onclick=()=>{sel=b.dataset.region;state.selected=sel;campaign()});
section.querySelector("#strategyHelp").onclick=()=>{
tab="focus";renderStrategy();alert("1. Önce Amasya Hattı odağını seç. 2. Birkaç tur ilerleyerek tamamla. 3. Üretim sekmesinden tüfek ve mühimmat üret. 4. İkmal yüzdesi yüksek bölgelerde asker biriktir. 5. Komşu düşman bölgeye girip taktik muharebe aç.");
};
if(st.alert&&!document.querySelector(".strategy-event")&&Date.now()-noticeLast>900){
noticeLast=Date.now();const msg=st.alert;const box=document.createElement("div");box.className="strategy-event";
box.innerHTML='<div class="strategy-event-card"><small>'+esc(msg.date||"KARARGÂH TELGRAFI")+'</small><h2>'+esc(msg.title)+'</h2><p>'+esc(msg.text)+'</p><div class="strategy-event-actions"><button class="primary" id="dismissEvent">Devam Et</button><button id="openTimeline">Tarih Şeridini Gör</button></div></div>';
document.body.appendChild(box);
box.querySelector("#dismissEvent").onclick=()=>{st.alert=null;box.remove();save()};
box.querySelector("#openTimeline").onclick=()=>{st.alert=null;box.remove();tab="history";renderStrategy()};
}}
const baseHome=home;
home=function(){baseHome();const root=document.querySelector(".hero");if(root&&!document.getElementById("startBrief")){root.insertAdjacentHTML("beforeend",'<div id="startBrief" class="strategy-start"><b>Yeni: Ulusal Odaklar · Üretim · İkmal · Tarihsel Olaylar</b><p>Seferi açtıktan sonra önce bir ulusal odak seç, üretim başlat ve cepheye asker yetiştir. Savaşlar yalnızca asker sayısına değil ikmal ve hazırlığa da bağlı.</p></div>')}};
if(mode==="home")home();
})();

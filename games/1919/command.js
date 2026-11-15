
"use strict";
/* Command Edition v4 — tactical clarity and territorial strategy UI. */
(()=>{
const prev={home,scenarios,factions,campaign,mapSvg,beginBattle,drawBattle,prebattle,fresh,finishBattle};
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const val=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}};
const store=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let difficult=val("war_difficulty_v1","easy"),modeView="political",battleUIAt=0;
const factionPalette={tr:"#497b65",gr:"#a65e59",fr:"#6674a3",gb:"#a7875d",ru:"#9c626b",de:"#82766e"};
const factionShort={tr:"Millî Mücadele",gr:"Yunanistan",fr:"Fransa",gb:"Britanya",ru:"Rusya",de:"Almanya"};
const ownerName=o=>factionShort[o]||o;
function fmt(n){return Number(n||0).toLocaleString("tr-TR")}
function reach(origin){return edges.filter(pair=>pair.includes(origin)).map(pair=>pair.find(k=>k!==origin))}
function powerRatio(from,to){const attack=from.army*(state.morale/80)*(1+(state.tech||0)*.08),defence=to.army*(1+(to.fort-1)*.15);return Math.round(100*attack/(attack+defence))}
function mix(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);const v=n=>Math.round(((A>>n)&255)*(1-t)+((B>>n)&255)*t).toString(16).padStart(2,"0");return "#"+v(16)+v(8)+v(0)}
function clip(poly,a,b,c){const res=[];for(let i=0;i<poly.length;i++){let p=poly[i],q=poly[(i+1)%poly.length];const u=a*p[0]+b*p[1]-c,v=a*q[0]+b*q[1]-c;if(u<=0)res.push(p);if((u<0&&v>0)||(u>0&&v<0)){let f=u/(u-v);res.push([p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f])}}return res}
function polyFor(p,all){let poly=[[0,0],[1080,0],[1080,640],[0,640]];const x=p.x*10.55,y=p.y*5.7+20;for(let q of all){if(q===p)continue;const xx=q.x*10.55,yy=q.y*5.7+20;poly=clip(poly,xx-x,yy-y,(xx*xx+yy*yy-x*x-y*y)/2);if(!poly.length)break}return poly}
const SVG_LAND="M12 136 C83 74 162 103 227 122 C302 112 329 85 406 101 C498 38 615 48 681 98 C777 93 864 113 1057 152 L1071 390 C1031 465 997 531 963 572 L840 594 L754 558 L658 548 L560 591 L474 594 L370 559 L295 558 L187 506 L81 479 L18 404 Z";
function newMap(){
const all=state.regions;const shapes=all.map(p=>{const points=polyFor(p,all).map(x=>x.map(z=>z.toFixed(1)).join(",")).join(" ");const fill=modeView==="strength"?mix("#2c5146","#c89052",Math.min(1,p.army/100)):modeView==="supply"?mix("#895943","#4b966f",Math.min(1,p.level/5)):factionPalette[p.owner]||"#667464";return '<polygon points="'+points+'" fill="'+fill+'" stroke="#d3ccae" stroke-opacity=".43" stroke-width="1.1" class="territory"/>'}).join("");
const detail=all.map(p=>{const x=p.x*10.55,y=p.y*5.7+20,selected=sel===p.id,owned=p.owner===state.faction;return '<g tabindex="0" role="button" aria-label="'+safe(p.name)+' '+p.army+' asker" data-province="'+p.id+'" class="war-map-pin"><title>'+safe(p.name)+' • '+ownerName(p.owner)+' • '+p.army+' asker</title><circle cx="'+x+'" cy="'+y+'" r="'+(selected?22:16)+'" fill="#13241b" stroke="'+(selected?"#ffdf84":"#cfc69f")+'" stroke-width="'+(selected?4:1.8)+'"/><circle cx="'+x+'" cy="'+y+'" r="'+(selected?15:11)+'" fill="'+(factionPalette[p.owner]||"#53655c")+'"/><path d="M'+(x-5)+' '+(y+1)+'v-8h10v8h-10Z" fill="#eee2bc" opacity=".85"/><path d="M'+(x-7)+' '+(y-7)+'l7 -5 7 5Z" fill="#efe0b0"/><text x="'+x+'" y="'+(y+28)+'" text-anchor="middle" class="province-label">'+safe(p.name)+'</text><text x="'+x+'" y="'+(y+4)+'" font-size="11" font-weight="900" fill="#fff" text-anchor="middle">'+p.army+'</text>'+(selected?'<circle cx="'+x+'" cy="'+y+'" r="29" stroke="#f9e6a7" stroke-width="2" stroke-dasharray="4 4" fill="none"/>':"")+(owned?'<path d="M'+(x+9)+' '+(y-13)+'h13v9h-13Z" fill="#f1e2b5" opacity=".9"/>':"")+'</g>'}).join("");
const trees=Array.from({length:90},(_,i)=>{let x=35+(i*139)%1020,y=125+(i*83)%485,h=8+(i%4)*3;return '<path d="M'+x+' '+(y-h)+'l'+(h*.55)+' '+h+'h-'+(h*1.1)+'Z" fill="#183f2f" opacity=".23"/>'}).join("");
const contours=Array.from({length:12},(_,i)=>{let x=60+i*77;return '<path d="M'+x+' 170 Q'+(x+35)+' 240 '+(x-18)+' 300 T'+(x+35)+' 460" fill="none" stroke="#ded3a2" stroke-opacity=".15" stroke-width="1.5"/>'}).join("");
const roads=edges.map(([a,b])=>{let x=region(a),y=region(b);return '<path d="M'+(x.x*10.55)+' '+(x.y*5.7+20)+'L'+(y.x*10.55)+' '+(y.y*5.7+20)+'" stroke="#e8ddbd" stroke-opacity=".3" stroke-width="2.5" stroke-dasharray="6 6"/>'}).join("");
const title='<text x="45" y="64" fill="#f4dfb0" font-family="Georgia" font-weight="700" font-size="29" letter-spacing="3">ANADOLU CEPHELERİ</text><text x="48" y="86" fill="#e4d1a3" font-size="11" letter-spacing="3">STRATEJİK HARP HARİTASI · 1919</text><path d="M1020 40l-14 32h28Z" fill="#e9daab"/><text x="1021" y="35" text-anchor="middle" fill="#f4d69e" font-size="16">K</text>';
return '<svg viewBox="0 0 1080 640" aria-label="Anadolu sefer haritası" role="img"><defs><linearGradient id="seaShade" x2="0" y2="1"><stop stop-color="#173b43"/><stop offset="1" stop-color="#0d2933"/></linearGradient><clipPath id="landClip"><path d="'+SVG_LAND+'"/></clipPath><pattern id="mapGrain" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r="1" fill="#e7dfc0" opacity=".09"/></pattern></defs><rect width="1080" height="640" fill="url(#seaShade)"/><path d="'+SVG_LAND+'" fill="#4f664b" stroke="#c7c4a4" stroke-width="4"/><g clip-path="url(#landClip)">'+shapes+contours+trees+roads+'</g><path d="'+SVG_LAND+'" fill="none" stroke="#ddc999" stroke-width="3" opacity=".7"/><path d="M382 334Q470 294 566 310L740 286" fill="none" stroke="#e4cb8b" stroke-width="3" stroke-dasharray="9 6"/><rect width="1080" height="640" fill="url(#mapGrain)" pointer-events="none"/>'+title+detail+'</svg>';
}
mapSvg=newMap;
function missionCopy(){
if(!state)return null;
const owned=state.regions.filter(p=>p.owner===state.faction);
const ank=region("Ankara"),esk=region("Eskisehir"),afyon=region("Afyon"),izmir=region("Izmir");
if(state.faction==="tr"){
if(!state.events.includes("amasya"))return {title:"Amasya Genelgesi",detail:"Önce karargâhı güçlendir. Karargâh Kararları bölümünden Amasya Genelgesi'ni ilan et.",target:"Ankara",kind:"decisions"};
if(ank.army<45)return {title:"Ankara'da seferberlik",detail:"Ankara'da 10 asker yetiştir. Asker sayısı 45'e ulaşınca Batı Cephesi'ne ilerleyebilirsin.",target:"Ankara",kind:"recruit"};
for(const p of [esk,afyon,izmir])if(p.owner!=="tr")return {title:p.name+" cephesi",detail:"Ordunu komşu cephelere sevk ederek "+p.name+" için bir koridor aç. Tek başına zayıf bir orduyla saldırma.",target:p.id,kind:"map"};
}
return {title:"Yeni cepheyi güvenceye al",detail:"Dost bölgelerde asker yetiştir, ikmal artır ve düşman sınırındaki şehirleri ele geçir.",target:owned[0]?.id||"Ankara",kind:"map"};
}
function tooltipRegion(r){
const owns=r.owner===state.faction,adj=reach(r.id),target=adj.map(id=>region(id)).filter(p=>p.owner!==state.faction);
const connectedSources=adj.map(id=>region(id)).filter(p=>p.owner===state.faction);
return '<div class="war-region-box"><div class="eyebrow">BÖLGE KOMUTANLIĞI</div><h3>'+safe(r.name)+'</h3><p class="ownership">'+(owns?"🟢 Kontrolün altında":"🔴 "+safe(ownerName(r.owner))+" kontrolünde")+'</p><div class="numbers"><span><b>'+r.army+'</b>Asker</span><span><b>'+r.fort+'</b>Siper</span><span><b>'+r.level+'</b>İkmal</span></div>'+
(owns?'<div class="secondary-actions"><button id="cmdRecruit" '+(state.gold<40?"disabled":"")+'>＋ Asker · 40 ₺</button><button id="cmdFort" '+(state.gold<60?"disabled":"")+'>🛡 Siper · 60 ₺</button><button id="cmdSupply" '+(state.gold<50?"disabled":"")+'>📦 İkmal · 50 ₺</button><button id="cmdAbility" '+(state.supply<30?"disabled":"")+'>★ Moral · 30 📦</button></div><p class="hint">Asker yetiştirme: +10 asker. Siper: savunmaya katkı. İkmal: +30 ikmal.</p><label for="march">Hedef cephe</label><div class="target-choice"><select id="march">'+adj.map(id=>{let d=region(id);return '<option value="'+d.id+'">'+safe(d.name)+' · '+(d.owner===state.faction?"Dost":"Düşman")+' · '+d.army+' asker</option>'}).join("")+'</select></div><div id="attackOdds" class="select-tip"></div><button class="big-action" id="cmdMarch">'+(target.length?"⚔ Birlikleri Sevk Et":"↗ Komşu Bölgeye Sevk Et")+'</button>':
'<div class="notice">Bu bölgeyi doğrudan yönetemezsin. Önce sınırındaki dost şehri seçip asker gönder.</div><p class="hint">Saldırı başlatabileceğin komşu dost şehirler: '+(connectedSources.map(x=>x.name).join(", ")||"Yok")+'</p>'+connectedSources.map(p=>'<button class="big-action" data-jump="'+p.id+'">→ '+safe(p.name)+' ordusunu seç</button>').join(""))+
'</div>';
}
function updateOdds(){
const r=region(sel),dest=document.getElementById("march")?.value,d=dest?region(dest):null,bar=document.getElementById("attackOdds");if(!bar||!d)return;
if(d.owner===state.faction){bar.innerHTML="✅ Dost bölgeye asker takviyesi gönderilecek.";return}
const odds=powerRatio(r,d);
bar.innerHTML='<b>'+(odds>=60?"🟢 Güçlü ordu":odds>=44?"🟡 Dengeli savaş":"🔴 Riskli saldırı")+'</b> · Tahmini güç dengesi: <b>%'+odds+'</b><br><small>Kesin kazanma olasılığı değildir. Savaş sonucu taktik emirlerine bağlıdır.</small>';
}
function restoreActions(){const r=region(sel),own=r.owner===state.faction;
function command(btnName,act){document.getElementById(btnName)?.addEventListener("click",()=>{action(act)})}
if(own){command("cmdRecruit","recruit");command("cmdFort","fort");command("cmdSupply","supply");command("cmdAbility","ability");command("cmdMarch","march");document.getElementById("march")?.addEventListener("change",updateOdds);updateOdds()}
document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>{sel=b.dataset.jump;state.selected=sel;campaign()}));
}
function enhanceCampaign(){
if(!state||mode!=="campaign")return;
const left=app.querySelector(".layout>section"),aside=app.querySelector(".layout>aside"),first=left?.querySelector(".panel"),map=first?.querySelector(".mapwrap");if(!aside||!first||!map)return;
const m=missionCopy(),r=region(sel);
app.querySelector(".mission")?.remove();
const guide=document.createElement("div");guide.id="warGuide";
guide.innerHTML='<small>◈ AKTİF CEPHE EMRİ · TUR '+state.turn+'</small><h3>'+safe(m.title)+'</h3><p>'+safe(m.detail)+'</p><div class="guide-bottom"><button id="warGuideFocus" class="primary">🎯 Hedefi göster</button><button id="warGuideHelp">? Öğren</button><button id="warGuideDecisions">📜 Karargâh kararları</button></div>';
app.querySelector(".layout").insertAdjacentElement("beforebegin",guide);
guide.querySelector("#warGuideFocus").onclick=()=>{sel=m.target;state.selected=sel;campaign()};
guide.querySelector("#warGuideHelp").onclick=()=>typeof showHelp==="function"?showHelp():alert("Bölge seç, asker yetiştir ve komşu cepheye sevk et.");
guide.querySelector("#warGuideDecisions").onclick=()=>action("decisions");
const header=first.querySelector(".eyebrow"),h2=first.querySelector("h2");if(header)header.textContent="1914–1922 / DÖNEMSEL HARP HARİTASI";if(h2)h2.textContent="Sefer Haritası";
const toolbar=document.createElement("div");toolbar.className="command-top";toolbar.innerHTML='<span class="command-flag">⚑ '+safe(ownerName(state.faction))+' · '+safe(state.day)+'</span><div class="war-map-options"><button data-layer="political">🗺️ Ülkeler</button><button data-layer="strength">⚔ Kuvvetler</button><button data-layer="supply">📦 İkmal</button></div>';
map.insertAdjacentElement("beforebegin",toolbar);
toolbar.querySelectorAll("[data-layer]").forEach(b=>{b.classList.toggle("primary",b.dataset.layer===modeView);b.onclick=()=>{modeView=b.dataset.layer;campaign()}});
const extras=document.createElement("div");extras.className="war-legend";extras.innerHTML='<span>🟢 Türkiye</span><span>🔴 Yunanistan</span><span>🟣 Fransa</span><span>🟤 Britanya</span><span>📍 Seçili şehir: <b>'+safe(r.name)+'</b></span>';
map.insertAdjacentElement("afterend",extras);
first.querySelector("p.muted")?.remove();first.querySelector(".select-tip")?.remove();
const prevButtons=first.querySelector(".actions");if(prevButtons){prevButtons.innerHTML='<button id="warTurn" class="war-turn-button">⏭ Sonraki Tur</button><button id="warDecision">📜 Diplomasi</button><button id="warScenario">⚔ Muharebeler</button>';prevButtons.querySelector("#warTurn").onclick=()=>action("next");prevButtons.querySelector("#warDecision").onclick=()=>action("decisions");prevButtons.querySelector("#warScenario").onclick=()=>scenarios()}
aside.innerHTML=tooltipRegion(r)+'<div class="war-rail"><h3>🔭 Savaş istihbaratı</h3><p>Saldırıdan önce karşı cephenin asker sayısını ve siper durumunu kontrol et. Siperli savunmacıya karşı topçuyu geride tut; süvariyle yan hücum dene.</p><p><b>Asker yetiştirme:</b> 40 altın · <b>Güçlü ikmal:</b> sürekli takviye</p></div><div class="war-rail"><h3>📡 Telgrafhaneden Son Haber</h3><p>'+safe(state.log?.[0]||"Yeni bir emir bekleniyor.")+'</p></div>';
restoreActions();
store("baba_1919_autosave",JSON.stringify(state));
}
campaign=function(){prev.campaign();enhanceCampaign()};
fresh=function(f){const s=prev.fresh(f);s.difficulty=difficult;if(f==="tr"){const a=s.regions.find(p=>p.id==="Ankara"),esk=s.regions.find(p=>p.id==="Eskisehir");if(a)a.army+=22;if(esk)esk.army=Math.min(esk.army,34);s.gold+=80;s.supply+=40}return s};
function homeEnhance(){
const hero=app.querySelector(".hero");if(!hero)return;
hero.insertAdjacentHTML("beforeend",'<div class="war-region-box" style="max-width:700px;margin:16px 0 0"><div class="eyebrow">OYUN AYARLARI</div><p class="muted" style="margin:5px 0">Önerilen ilk oyun: Türkiye · Kolay · İlk hedef Amasya Genelgesi</p><label for="warDifficulty">Zorluk</label><select id="warDifficulty" style="padding:10px;margin:7px;background:#1b2c25;color:#fff;border:1px solid #887b5c;border-radius:7px"><option value="easy">Kolay · İlk kez oynayanlar</option><option value="normal">Normal · Dengeli mücadele</option><option value="hard">Zor · Tecrübeli komutan</option></select><p class="hint">Bu ayar yeni başlayan muharebelere uygulanır. İstediğin zaman değiştirebilirsin.</p></div>');
const selEl=document.getElementById("warDifficulty");selEl.value=difficult;selEl.onchange=()=>{difficult=selEl.value;store("war_difficulty_v1",difficult)};
if(val("baba_1919_autosave","")){hero.insertAdjacentHTML("beforeend",'<button id="quickContinue" class="primary" style="margin-top:12px">↪ Son kayıtlı sefere devam et</button>');document.getElementById("quickContinue").onclick=()=>{try{const s=JSON.parse(val("baba_1919_autosave",""));if(!s.regions?.length)throw Error();state=s;sel=s.selected||"Ankara";campaign()}catch{alert("Önceki kayıt bulunamadı.")}}}
}
home=function(){prev.home();homeEnhance()};
factions=function(){prev.factions();const banner=app.querySelector(".hero");banner?.insertAdjacentHTML("beforeend",'<div class="notice">🇹🇷 <b>Önerilen:</b> Türkiye 19 Mayıs 1919. Başlangıçta daha fazla asker ve anlaşılır görevler sunulur. Diğer ülkeler alternatif senaryolardır; 1919 sefer haritasında aynı coğrafyayı kullanır.</div>')};
scenarios=function(){prev.scenarios();app.querySelector(".hero")?.insertAdjacentHTML("beforeend",'<div class="notice"><b>Yeni başlayanlar için:</b> II. İnönü veya Sakarya’yı seç. Muharebe içinde birlik kartları ve komutların açıklaması gösterilir.</div>')};
prebattle=function(opts){prev.prebattle(opts);const modal=document.querySelector("#modal .modal");if(!modal)return;const origin=opts.origin?region(opts.origin):null,target=opts.target?region(opts.target):null;if(origin&&target){const odds=powerRatio(origin,target);modal.insertAdjacentHTML("beforeend",'<div class="war-intel"><div><strong>⚖ Tahmini kuvvet dengesi: %'+odds+'</strong><p>Güçlü topçu ve doğru hareket emirleri sonucu değiştirebilir. Bu değer zafer garantisi değildir.</p></div></div>')}else modal.insertAdjacentHTML("beforeend",'<div class="notice">Birlikleri önce siperlere yerleştir. Topçuyu geride, süvariyi yan kanatta tut. Savaş başlamadan birim kartlarını incele.</div>')};
function configureStrength(){
if(!battle)return;const factor=difficult==="easy"?.75:difficult==="hard"?1.32:1;
for(const u of battle.units.filter(x=>x.team===1)){u.hp=Math.max(8,Math.round(u.hp*factor));u.max=u.hp;u.morale=difficult==="hard"?95:70}
if(difficult==="easy")for(const u of battle.units.filter(x=>x.team===0)){u.hp=Math.round(u.hp*1.3);u.max=u.hp;u.morale=94}
}
const ico=["♟️","🪖","🐎","💣"];
const names=["1. Piyade","2. Piyade","3. Süvari","4. Topçu"];
function hudHTML(){
return '<section class="battle-cmd-hud" id="battleCmdHUD"><div class="battle-cmd-head"><div><strong>⚔ Harp Komuta Merkezi</strong><small style="display:block">Birim seç → arazide hedefe tıkla · 1–4 kısayol</small></div><canvas id="tacMini" width="150" height="95" class="battle-minimap" aria-label="Taktik mini harita"></canvas></div><div class="battle-meter"><div id="battlePower" style="width:50%"></div></div><div class="battle-cards" id="battleCards">'+names.map((x,i)=>'<button class="battle-card" data-cmdunit="'+i+'" aria-pressed="'+(i===0)+'"><i>'+ico[i]+'</i><b>'+x+'</b><small id="cmdHp'+i+'">Hazır</small><div class="health"><em style="width:100%"></em></div></button>').join("")+'</div><div class="battle-command-row"><button data-cmd="guard">🛡<br>Mevzi</button><button data-cmd="charge" class="primary">⚔<br>Hücum</button><button data-cmd="retreat">↶<br>Çekil</button><button data-cmd="rally">★<br>Moral</button><button data-cmd="pause">⏸<br>Duraklat</button></div><div class="battle-mini-status"><span id="tacStatus"><strong>1. Piyade</strong> seçildi. Savaş alanında gitmesini istediğin yere dokun.</span><button id="tacHelp">? Nasıl oynanır</button><span id="tacClock">00:00</span></div></section>';
}
function hudUpdate(){
if(!battle||mode!=="battle")return;
const now=performance.now();if(now-battleUIAt<125)return;battleUIAt=now;
const friends=battle.units.filter(u=>u.team===0),foes=battle.units.filter(u=>u.team===1);
const fp=friends.reduce((a,u)=>a+u.hp,0),ep=foes.reduce((a,u)=>a+u.hp,0);
document.getElementById("battlePower")?.style.setProperty("width",(fp+ep>0?100*fp/(fp+ep):50)+"%");
for(let i=0;i<friends.length;i++){
const b=document.querySelector('[data-cmdunit="'+i+'"]'),u=friends[i];if(!b)continue;b.setAttribute("aria-pressed",String(battle.selected===i));b.querySelector("small").textContent=Math.ceil(u.hp)+" / "+u.max+" asker · "+Math.round(u.morale)+" moral";
const health=b.querySelector(".health");health.classList.toggle("warning",u.hp/u.max<.4);health.querySelector("em").style.width=Math.max(0,100*u.hp/u.max)+"%";
}
const mm=document.getElementById("tacMini");if(mm){const g=mm.getContext("2d");g.clearRect(0,0,150,95);g.fillStyle="#314d3d";g.fillRect(0,0,150,95);g.strokeStyle="#9e8d68";for(const x of [35,113]){g.beginPath();g.moveTo(x,0);g.lineTo(x,95);g.stroke()}for(const u of battle.units){if(u.hp<=0)continue;g.fillStyle=u.team===0?"#a5e4af":"#f2a091";g.beginPath();g.arc(u.x*150/800,u.y*95/500,u.team===0?3.8:3,0,7);g.fill()}}
const clock=document.getElementById("tacClock");if(clock)clock.textContent=String(Math.floor(battle.t/60)).padStart(2,"0")+":"+String(Math.floor(battle.t%60)).padStart(2,"0");
}
function enhanceBattle(){
if(!battle||!document.getElementById("field"))return;
configureStrength();
const host=app.querySelector(".battle-layout>div:first-child");if(!host)return;
host.insertAdjacentHTML("beforeend",hudHTML());
for(const [k,act] of [["guard","guard"],["charge","charge"],["retreat","retreat"],["rally","rally"],["pause","pause"]])host.querySelector('[data-cmd="'+k+'"]').onclick=()=>{battleAction(act);document.getElementById("tacStatus").textContent=({"guard":"Mevzi savunması verildi.","charge":"Hücum emri verildi.","retreat":"Geri çekilme emri verildi.","rally":"Moral emri verildi.","pause":"Muharebe duraklatıldı / devam ediyor."})[k]};
host.querySelectorAll("[data-cmdunit]").forEach(b=>b.onclick=()=>{battle.selected=+b.dataset.cmdunit;paintUnitList();hudUpdate();const s=document.getElementById("tacStatus");if(s)s.textContent=names[battle.selected]+" seçildi. Haritada hedefe dokun."});
host.querySelector("#tacHelp").onclick=()=>typeof showHelp==="function"?showHelp():alert("Birim kartına dokun, savaş alanına hareket emri ver.");
const oldButtons=host.querySelector(".actions");if(oldButtons)oldButtons.style.display="none";
const info=host.querySelector(".notice");if(info)info.style.display="none";
const bar=app.querySelector(".statbar");if(bar){bar.style.position="relative";bar.style.top="auto"}
hudUpdate();
}
beginBattle=function(opts){prev.beginBattle(opts);enhanceBattle()};
drawBattle=function(){prev.drawBattle();hudUpdate()};
finishBattle=function(b){prev.finishBattle(b);if(state)store("baba_1919_autosave",JSON.stringify(state))};
document.addEventListener("keydown",ev=>{
if(mode!=="battle"||!battle)return;
if(ev.key==="Escape"&&typeof showHelp==="function")document.getElementById("helpOverlay")?.remove();
if(ev.key.toLowerCase()==="h"){battleAction("guard");hudUpdate()}
});
const originalNext=next;next=function(){originalNext();if(state)store("baba_1919_autosave",JSON.stringify(state))};
if(mode==="home")home();
})();

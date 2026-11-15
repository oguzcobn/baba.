
"use strict";
/* 1919 Enhanced Gameplay Layer — works with existing no-build game */
(() => {
const baseHome=home,baseCampaign=campaign,baseFactions=factions,baseScenarios=scenarios,baseBegin=beginBattle,baseDraw=drawBattle,baseUpdate=updateBattle,baseMap=mapSvg,baseNext=next;
const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let terrain=null,terrainType="",battleSpeed=1,showHealth=true;
let battle3d=null,battle3dLoading=false,battle3dWanted=true;
function dispose3d(){if(battle3d){battle3d.dispose();battle3d=null;}}
async function load3d(){
if(battle3d||battle3dLoading||!battle||!battle3dWanted)return;
battle3dLoading=true;
const status=document.getElementById("battleViewStatus");
if(status)status.textContent="3B savaş alanı hazırlanıyor…";
try{
const module=await import("./three-battle.js?v=4");
if(!battle||!battle3dWanted)return;
battle3d=await module.mount3DBattle({
getBattle:()=>battle,
onSelect:id=>{if(!battle)return;battle.selected=id;paintUnitList();},
onOrder:(x,y)=>{if(!battle)return;const u=battle.units[battle.selected];if(!u)return;u.tx=Math.max(20,Math.min(780,x));u.ty=Math.max(30,Math.min(470,y));u.guard=false;}
});
if(status)status.textContent="3B TAKTİK KAMERA · Sağ tık sürükle: döndür · Tekerlek: yakınlaştır";
}catch(err){console.warn("3D unavailable, using 2D battlefield",err);battle3dWanted=false;if(status)status.textContent="2B görünüm aktif · 3B bu cihazda açılamadı";const t=document.getElementById("toggleBattle3D");if(t)t.textContent="3B tekrar dene"}
finally{battle3dLoading=false}
}
const originalStop=stop;stop=function(){dispose3d();originalStop()};
const tutorialSteps=[
["1","Karargâhını güçlendir","Ankara’yı seç. 40 altın harcayarak asker yetiştir, ikmal ve moralini kontrol et."],
["2","Cepheye ilerle","Haritadaki bir şehre dokun. Komşu bir cephe seçip Kolorduyu Sevk Et komutunu ver."],
["3","Muharebeyi kazan","Bir piyade birliğini seç; düşman yakınlarına dokun. Topçuyu geride, süvariyi kanatta tut."]
];
const guide=()=>'<section class="tut-strip">'+tutorialSteps.map(([n,t,d])=>'<div class="tut-step"><div class="step-number">'+n+'</div><div><b>'+t+'</b><p>'+d+'</p></div></div>').join("")+'</section>';
home=function(){baseHome();const hero=app.querySelector(".hero");if(hero){hero.insertAdjacentHTML("afterend",guide());const lead=hero.querySelector("p");if(lead)lead.textContent="Millî Mücadele'de bir başkomutan ol: şehirlerden asker topla, ikmal hatları kur, diplomasi yürüt ve birliklerine gerçek zamanlı muharebe emirleri ver. Aşağıdaki üç adımla hemen öğren."}};
factions=function(){baseFactions();const hero=app.querySelector(".hero");if(hero)hero.insertAdjacentHTML("beforeend",'<div class="notice">⭐ Önerilen başlangıç: <b>Türkiye — Millî Mücadele.</b> İlk turda Ankara’yı güçlendir, sonra Eskişehir ve Afyon cephelerine ilerle.</div>')};
scenarios=function(){baseScenarios();const hero=app.querySelector(".hero");if(hero)hero.insertAdjacentHTML("beforeend",'<div class="notice">🎖 <b>İlk muhareben için II. İnönü önerilir.</b> Siperlerde mevzi tut, topçuyla ateşi destekle, süvarinle kanatlardan saldır.</div>')};
const mission=()=>{
if(!state)return null;
const owned=state.regions.filter(p=>p.owner===state.faction);
const izmir=region("Izmir"),esk=region("Eskisehir"),afyon=region("Afyon");
if(state.turn===1&&region("Ankara")?.army<=35)return {name:"İLK EMİR: ANKARA’YI HAZIRLA",desc:"Ankara şehrini seç ve +10 Asker düğmesine bas. Ardından Eskişehir cephesini hedefle.",target:"Ankara",action:"recruit"};
if(esk&&esk.owner!==state.faction)return {name:"BATI CEPHESİ: ESKİŞEHİR",desc:"Ankara’yı seç. Komşu bölge listesinden Eskişehir’i belirle, Kolorduyu Sevk Et. Savaşı yöneterek cepheyi ele geçir.",target:"Ankara",action:"focus"};
if(afyon&&afyon.owner!==state.faction)return {name:"İKİNCİ HEDEF: AFYON",desc:"Eskişehir ve Ankara hattından Afyon’a yaklaş. Gerekirse önce asker yetiştir veya siperleri güçlendir.",target:"Ankara",action:"focus"};
if(izmir&&izmir.owner!==state.faction)return {name:"BÜYÜK HEDEF: İZMİR",desc:"Batı cephesindeki kontrolünü genişlet, İzmir’e uzanan koridoru aç ve taarruzu yönet.",target:"Afyon",action:"focus"};
return {name:"BAĞIMSIZLIK MÜCADELESİ SÜRÜYOR",desc:"İstanbul ve diğer cepheleri geri al, birliklerini yenile, diplomasi kararlarını uygula.",target:"Istanbul",action:"focus"};
};
function addMission(){
const root=app.querySelector(".layout");if(!root)return;
const m=mission();if(!m)return;
const banner=document.createElement("section");banner.className="mission";banner.innerHTML='<div class="objective">◈ AKTİF KARARGÂH GÖREVİ</div><h3>'+escapeText(m.name)+'</h3><p>'+escapeText(m.desc)+'</p><button data-mission-target="'+m.target+'" class="primary">🎯 Hedefi haritada göster</button> <button data-help-open="1">? Nasıl oynanır?</button>';
root.insertAdjacentElement("beforebegin",banner);
banner.querySelector("[data-mission-target]").onclick=()=>{sel=m.target;state.selected=sel;baseCampaign();addMission();};
banner.querySelector("[data-help-open]").onclick=showHelp;
}
campaign=function(){baseCampaign();addMission();const help=app.querySelector(".mapwrap");if(help)help.insertAdjacentHTML("afterend",'<div class="select-tip">🗺️ <b>Yeşil şehirler</b> senin. Seçtiğin şehre asker ekle, komşu şehre gönder. <b>Kırmızı/turuncu şehirler</b> düşman; asker gönderince taktik muharebe açılır.</div>');};
next=function(){baseNext();}; // Base next invokes the enhanced campaign automatically
function showHelp(){
const ov=document.createElement("div");ov.className="overlay";ov.id="helpOverlay";
ov.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="Oynanış rehberi"><div class="eyebrow">BAŞKOMUTANLIK AKADEMİSİ</div><h2>1919 Nasıl Oynanır?</h2>'+guide()+'<h3>⚔ Savaş sırasında</h3><p><b>1–4</b> ile birlik seç. Haritada dokunduğun yere hareket eder. Düşmana yaklaştığında otomatik ateş açar. Birliğin üstüne dokunarak da seçebilirsin.</p><p><b>Mevzi Tut:</b> birliğin olduğu yerde siper savunması yapar. <b>Hücum:</b> ileri hareket. <b>Başkomutanlık Emri:</b> moral artırır.</p><p><b>Strateji ipucu:</b> Topçu uzak mesafeden ateş eder, süvari hızlı fakat yakın menzillidir. Piyadeyi önden, süvariyi yandan gönder.</p><button class="primary" id="closeHelp">Anladım, göreve dön</button></section>';
document.body.appendChild(ov);ov.querySelector("#closeHelp").onclick=()=>ov.remove();
}
const originalMap=mapSvg;
mapSvg=function(){
let svg=originalMap();
const hills=Array.from({length:27},(_,i)=>{const x=55+(i*137)%960,y=220+(i*71)%325,sc=.55+(i%4)*.2;return '<path d="M'+(x-36*sc)+' '+(y+9*sc)+' l'+(28*sc)+' '+(-34*sc)+' '+(18*sc)+' '+(24*sc)+' '+(12*sc)+' '+(-42*sc)+' '+(40*sc)+' '+(52*sc)+'Z" fill="#455a48" stroke="#a0a282" stroke-width="1" opacity=".65"/><path d="M'+(x-8*sc)+' '+(y-25*sc)+' l'+(8*sc)+' '+(10*sc)+' '+(8*sc)+' '+(-13*sc)+'Z" fill="#ded3a4" opacity=".7"/>'}).join("");
const forest=Array.from({length:90},(_,i)=>{const x=30+(i*127)%1000,y=180+(i*59)%370,r=3+i%3;return '<path d="M'+x+' '+(y-2*r)+' l'+r+' '+(2*r)+' h-'+(2*r)+'Z" fill="#244e3c" opacity=".56"/>'}).join("");
const cities='<path d="M155 360 Q320 345 420 350 T570 305 Q700 300 740 290" fill="none" stroke="#d0bb80" stroke-width="3" stroke-dasharray="8 6" opacity=".6"/><path d="M190 435 L330 385 545 320 690 460" fill="none" stroke="#e6d096" stroke-width="1.5" opacity=".5"/>';
svg=svg.replace('<g data-province=', hills+forest+cities+'<g data-province=');
return svg;
};
function terrainColor(theme){return theme==="snow"?["#a4b2a8","#c5c8bb","#839389"]:theme==="desert"?["#877a58","#a3986a","#6f6950"]:["#4d6248","#667253","#3d5844"]}
function makeTerrain(b){
const tc=document.createElement("canvas");tc.width=800;tc.height=500;
const g=tc.getContext("2d");const theme=b.s?.id==="sarikamis"?"snow":b.s?.id==="kut"?"desert":"green";
const col=terrainColor(theme);const gradient=g.createLinearGradient(0,0,0,500);gradient.addColorStop(0,col[2]);gradient.addColorStop(.5,col[1]);gradient.addColorStop(1,col[0]);g.fillStyle=gradient;g.fillRect(0,0,800,500);
const rnd=(i,k=0)=>{let n=Math.sin(i*96.345+k*35.7)*43758.5453;return n-Math.floor(n)};
for(let i=0;i<34;i++){let x=rnd(i,1)*850,y=rnd(i,2)*480;g.beginPath();g.ellipse(x,y,38+rnd(i,3)*95,12+rnd(i,4)*36,rnd(i,5)*2,0,Math.PI*2);g.fillStyle=i%2?"#283c2e25":"#c2b88116";g.fill()}
for(let i=0;i<85;i++){const x=rnd(i,8)*800,y=rnd(i,9)*500,size=4+rnd(i,10)*11;if(x>170&&x<625&&i%3===0)continue;g.fillStyle=theme==="snow"?"#e6e4d044":theme==="desert"?"#3f47321f":"#1b433190";g.beginPath();g.moveTo(x,y-size*2);g.lineTo(x-size,y+size);g.lineTo(x+size,y+size);g.fill();g.fillStyle="#16291e40";g.fillRect(x-1,y+size,2,size)}
for(let row=0;row<2;row++){let x=row?600:200;g.strokeStyle="#3a3022";g.lineWidth=19;g.beginPath();g.moveTo(x,18);for(let y=18;y<500;y+=15)g.lineTo(x+Math.sin(y*.024)*9,y);g.stroke();g.strokeStyle="#b2a080";g.lineWidth=2;g.setLineDash([12,6]);g.stroke();g.setLineDash([])}
g.strokeStyle="#393a2f99";g.lineWidth=2;for(let i=0;i<2;i++){let x=i?620:180;for(let y=15;y<490;y+=25){g.beginPath();g.moveTo(x-17,y);g.lineTo(x+18,y);g.stroke()}}
g.save();g.globalAlpha=.14;g.fillStyle="#fff";g.font="bold 120px Georgia";g.translate(420,265);g.rotate(-.24);g.fillText(theme==="snow"?"KARS":theme==="desert"?"KUT":"ANADOLU",-220,0);g.restore();
return tc;
}
function drawSoldier(g,x,y,team,unit,i,b){
const hat=team===0?"#8a856b":"#666f66",coat=team===0?"#aaa18a":"#827c70",stroke=team===0?"#f4dfb5":"#daa69b";
const wobble=Math.sin(b.t*7+i*2)*1.2;
g.save();g.translate(x,y+wobble);g.strokeStyle="#182820";g.lineWidth=1.5;
g.beginPath();g.moveTo(-2,3);g.lineTo(-4,7);g.moveTo(2,3);g.lineTo(4,7);g.stroke();
g.fillStyle=coat;g.fillRect(-3,-7,6,10);g.fillStyle="#cebb9b";g.beginPath();g.arc(0,-10,2.4,0,Math.PI*2);g.fill();
g.fillStyle=hat;g.fillRect(-4,-13,8,3);
g.strokeStyle="#282d2a";g.lineWidth=1.5;g.beginPath();g.moveTo(team===0?3:-3,-6);g.lineTo(team===0?10:-10,-8);g.stroke();g.lineWidth=1;
if(i===0){g.strokeStyle="#181b18";g.beginPath();g.moveTo(-6,-9);g.lineTo(-6,-27);g.stroke();g.fillStyle=team===0?"#a73931":"#ac9f81";g.fillRect(-6,-27,12,8);if(team===0){g.fillStyle="#fff";g.font="8px sans-serif";g.fillText("☾",-5,-20)}}
g.restore();
}
function drawHorse(g,x,y,team,b){
g.save();g.translate(x,y);g.fillStyle=team===0?"#5e4838":"#484a40";
g.beginPath();g.ellipse(0,0,12,5,0,0,Math.PI*2);g.fill();
for(const z of [-7,7]){g.fillRect(z,-2,2,10+Math.sin(b.t*10+z)*2)}
g.fillRect(team===0?9:-14,-8,6,7);
g.fillStyle=team===0?"#c4b390":"#a29484";g.fillRect(-2,-13,5,7);g.fillStyle="#d1c6a0";g.beginPath();g.arc(0,-15,3,0,7);g.fill();g.restore();
}
function drawCannon(g,x,y,team,b){
g.save();g.translate(x,y);g.fillStyle="#303b32";g.fillRect(-17,-8,38,9);g.fillStyle="#50584b";for(const cx of [-9,8]){g.beginPath();g.arc(cx,4,7,0,7);g.fill();g.strokeStyle="#242a25";g.lineWidth=2;g.stroke()}g.fillStyle=team===0?"#a8a58c":"#968b7a";g.fillRect(-9,-13,12,7);g.restore();
}
const originalUpdate=updateBattle;
updateBattle=function(dt){originalUpdate(dt*battleSpeed)};
drawBattle=function(){
const b=battle,cv=document.getElementById("field");if(!b||!cv)return;
const g=cv.getContext("2d");
if(!terrain||terrainType!==(b.s?.id||"field")){terrain=makeTerrain(b);terrainType=b.s?.id||"field"}
g.clearRect(0,0,800,500);g.drawImage(terrain,0,0);
const vignette=g.createRadialGradient(400,250,100,400,250,560);vignette.addColorStop(0,"#0000");vignette.addColorStop(1,"#0d1a17a9");g.fillStyle=vignette;g.fillRect(0,0,800,500);
g.fillStyle="#f4e0ae";g.font="700 14px Georgia";g.shadowColor="#09110e";g.shadowBlur=5;g.fillText("⚑ DOST KOLORDULAR",20,27);g.textAlign="right";g.fillText("KARŞI CEPHE ⚑",780,27);g.textAlign="left";g.shadowBlur=0;
for(const u of b.units){
if(u.hp<=0)continue;
const fraction=u.hp/u.max,count=Math.max(1,Math.min(35,Math.ceil(u.hp/2.6))),cols=u.type==="Topçu"?3:u.type==="Süvari"?4:7;
if(u.guard){g.fillStyle="#625643";g.fillRect(u.x-36,u.y+17,72,9);g.fillStyle="#a08d6a";for(let i=0;i<7;i++)g.fillRect(u.x-35+i*10,u.y+15,9,5)}
for(let i=0;i<count;i++){const px=u.x+(i%cols-(cols-1)/2)*(u.type==="Süvari"?18:10.2),py=u.y+(Math.floor(i/cols)-1)*(u.type==="Süvari"?22:12);if(u.type==="Süvari")drawHorse(g,px,py,u.team,b);else if(u.type==="Topçu"){if(i<3)drawCannon(g,px,py,u.team,b);else drawSoldier(g,px,py,u.team,u,i,b)}else drawSoldier(g,px,py,u.team,u,i,b)}
if(u.team===0&&b.selected===u.id){
g.strokeStyle="#ffe1a0";g.lineWidth=2;g.setLineDash([5,5]);g.beginPath();g.ellipse(u.x,u.y,47,33,0,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(u.x,u.y);g.lineTo(u.tx,u.ty);g.stroke();g.setLineDash([]);
g.fillStyle="#fce4a7";g.beginPath();g.arc(u.tx,u.ty,4,0,7);g.fill()}
g.fillStyle="#15251e";g.fillRect(u.x-34,u.y-53,68,6);
g.fillStyle=u.team===0?"#91dca1":"#ef8276";g.fillRect(u.x-34,u.y-53,68*fraction,6);
g.fillStyle="#f3e8cf";g.font="700 11px system-ui";g.textAlign="center";g.fillText(u.type+" · "+Math.ceil(u.hp),u.x,u.y-58);g.textAlign="left";
if(u.morale<26){g.fillStyle="#f5b861";g.fillText("⚠",u.x+30,u.y-40)}
}
for(const sh of b.shots){
g.save();g.globalAlpha=Math.min(1,sh.life*5);g.strokeStyle=sh.team===0?"#ffeca1":"#ffd2b0";g.lineWidth=sh.boom?4:1.5;g.beginPath();g.moveTo(sh.x,sh.y);g.lineTo(sh.tx,sh.ty);g.stroke();if(sh.boom){const glow=g.createRadialGradient(sh.tx,sh.ty,1,sh.tx,sh.ty,21);glow.addColorStop(0,"#fff0a3");glow.addColorStop(.3,"#ffb45d8a");glow.addColorStop(1,"#f9991100");g.fillStyle=glow;g.beginPath();g.arc(sh.tx,sh.ty,22,0,7);g.fill()}g.restore()}
if(paused){g.fillStyle="#0b1a14c9";g.fillRect(0,0,800,500);g.font="bold 32px Georgia";g.fillStyle="#f3d99f";g.fillText("MUHAREBE DURAKLATILDI",174,245)}
if(battle3d)battle3d.update();
};
function applyBattleUI(){
const cv=document.getElementById("field");if(!cv)return;
dispose3d();battle3dWanted=true;
terrain=null;terrainType="";battleSpeed=1;
const layout=app.querySelector(".battle-layout");
if(layout){layout.insertAdjacentHTML("beforebegin",'<div class="battle-guide"><div><b>🎖 CEPHE EMRİ: Birliklerini yönet</b><p>1. Soldaki dost birliklerini seç. 2. Savaş alanında hedef konuma tıkla. 3. Mevzi tut veya hücum emrini kullan. Düşmana yeterince yaklaşınca ateş başlar.</p></div><button id="battleHelp">? Yardım</button></div>');
document.getElementById("battleHelp")?.addEventListener("click",showHelp);
}
const actions=app.querySelector(".battle-layout .actions");if(actions){actions.insertAdjacentHTML("afterend",'<div class="tactbar"><button data-speed="1" class="primary">▶ 1× Normal</button><button data-speed="2">▶▶ 2× Hızlı</button><button data-speed="3">▶▶▶ 3× Çok Hızlı</button></div><p class="info-hotkey">Dokunarak oynama desteklenir · <b>1–4</b> birlik seçer · <b>Boşluk</b> duraklatır · Sağ tıkla emir ver</p>');app.querySelectorAll("[data-speed]").forEach(btn=>btn.onclick=()=>{battleSpeed=+btn.dataset.speed;app.querySelectorAll("[data-speed]").forEach(x=>x.classList.toggle("primary",x===btn))})}
const controls=document.createElement("div");
controls.className="battle-guide";
controls.innerHTML='<div><b>GÖRÜNÜM</b><p id="battleViewStatus">3B savaş alanı hazırlanıyor…</p></div><button id="toggleBattle3D" class="primary">◈ 2B / 3B Değiştir</button>';
cv.closest(".battlefield").insertAdjacentElement("afterend",controls);
controls.querySelector("#toggleBattle3D").onclick=()=>{
battle3dWanted=!battle3dWanted;
if(!battle3dWanted){dispose3d();document.getElementById("battleViewStatus").textContent="2B görünüm aktif"}
else load3d();
};
load3d();
cv.oncontextmenu=ev=>ev.preventDefault();
cv.onpointerdown=ev=>{
if(!battle||battle.done)return;
const rect=cv.getBoundingClientRect(),x=(ev.clientX-rect.left)/rect.width*800,y=(ev.clientY-rect.top)/rect.height*500;
const friend=battle.units.filter(u=>u.team===0&&u.hp>0).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
if(ev.button!==2&&friend&&Math.hypot(friend.x-x,friend.y-y)<65){battle.selected=friend.id;paintUnitList();document.getElementById("battleinfo").textContent=friend.type+" seçildi. Şimdi gitmesini istediğin yere dokun.";return}
const u=battle.units[battle.selected];if(u){u.tx=Math.max(20,Math.min(780,x));u.ty=Math.max(30,Math.min(470,y));u.guard=false;document.getElementById("battleinfo").textContent=u.type+" yeni hedefe ilerliyor."}
};
}
beginBattle=function(opts){baseBegin(opts);applyBattleUI()};
const baseFinish=finishBattle;
finishBattle=function(b){dispose3d();baseFinish(b);if(mode==="result"){const h=app.querySelector(".hero");if(h)h.insertAdjacentHTML("afterend",'<section class="mission"><h3>Karargâh Raporu</h3><p><b>Bir sonraki adım:</b> Sefer haritasına dön, yaralı birliklerin yerine takviye yetiştir, ikmal puanını yükselt ve yeni cepheye ilerle. Muharebeyi yeniden denemek için Tarihsel Muharebeler menüsünü kullan.</p></section>')}};
window.addEventListener("keydown",ev=>{if(mode!=="campaign"||ev.key!=="?")return;showHelp()});
if(mode==="home")home();
})();

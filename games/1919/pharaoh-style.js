
"use strict";
(()=>{
const originalHome=home,originalBegin=beginBattle,originalDraw=drawBattle;
const names=["Mavzerli Piyade","57. Alay Piyadesi","5. Süvari Kolordusu","75 mm Sahra Topçusu"];
const roles=["Hat piyadesi · Orta menzil","Seçkin piyade · Savunma","Hızlı manevra · Kanat","Uzun menzil · Baskı ateşi"];
const coats=["#ada189","#9b987f","#76644b","#656d62"];
let frames=0,compact=false;
function portrait(i){
const coat=coats[i]||coats[0],horse=i===2,gun=i===3;
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 102"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#274b4b"/><stop offset="1" stop-color="#ad9065"/></linearGradient></defs><rect width="180" height="102" fill="url(#bg)"/><circle cx="142" cy="14" r="36" fill="#eccc8a" opacity=".28"/><path d="M0 84Q38 52 70 65T180 57V102H0Z" fill="#203c36"/>'+(horse?'<path d="M36 93Q46 71 75 75L120 73Q141 69 148 88L130 102H32Z" fill="#66513d"/>':'')+(gun?'<path d="M1 96L141 48L151 56L24 104" fill="#3d4846"/><circle cx="38" cy="91" r="17" fill="#363d3b" stroke="#b5a47e" stroke-width="4"/>':'')+'<path d="M77 54L105 54L132 102H50Z" fill="'+coat+'" stroke="#3c423a" stroke-width="3"/><path d="M78 56L62 99M106 56L120 99" stroke="#635f50" stroke-width="8"/><ellipse cx="92" cy="40" rx="17" ry="20" fill="#c5ae90"/><path d="M74 34L79 14L104 14L110 34Z" fill="#515e53" stroke="#2a3630" stroke-width="2"/><path d="M73 29Q92 25 110 29" fill="none" stroke="#e6d0a0" stroke-width="4"/><path d="M90 13L90 5H96L97 13" fill="#e2bd76"/><path d="M61 100L138 62" stroke="#292d2c" stroke-width="5"/><path d="M125 68L164 49" stroke="#e4ddc9" stroke-width="2"/><path d="M0 0H180V102H0Z" fill="none" stroke="#bd9b66" stroke-width="5"/></svg>';
return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
function getWeather(){
const id=battle?.s?.id;
if(id==="sarikamis")return ["❄ Kar Fırtınası","Soğuk ve kötü görüş"];
if(id==="kut")return ["☀ Çöl Cephesi","Açık arazide uzun menzil"];
if(id==="sakarya")return ["☾ Sakarya Gecesi","Sisli ve tepelik arazi"];
if(id==="taarruz")return ["🌫 Kocatepe Şafağı","Şafak sisi ve topçu"];
return ["⛅ Cephe Havası","Değişken görüş"];
}
function renderCards(){
document.querySelectorAll("#battleCards .battle-card").forEach((el,i)=>{
if(!el.dataset.art){el.dataset.art="1";const icon=el.querySelector("i");if(icon)icon.remove();const img=document.createElement("img");img.alt="";img.src=portrait(i);img.className="ph-card-image";el.prepend(img);const b=el.querySelector("b");if(b)b.textContent=names[i];const role=document.createElement("small");role.className="ph-unit-role";role.textContent=roles[i];img.insertAdjacentElement("afterend",role);el.title=names[i]+" — "+roles[i];}
});
}
function createBattleHeader(){
const stat=app.querySelector(".statbar");if(!stat||!battle)return;
const w=getWeather(),n=battle.s?.name||(battle.target?region(battle.target)?.name+" Cephesi":"Meydan Muharebesi");
const banner=document.createElement("div");banner.className="ph-battle-banner";
const info=document.createElement("div");info.innerHTML='<div class="eyebrow">1919 · HARP KOMUTANLIĞI</div><h2></h2><p>Birlikleri seç · mevzi al · kanattan kuşat · topçuyla destekle</p>';info.querySelector("h2").textContent=n;
const condition=document.createElement("div");condition.className="ph-weather";condition.textContent=w[0];condition.title=w[1];banner.append(info,condition);stat.insertAdjacentElement("afterend",banner);
}
function createOverlay(){
const host=document.querySelector(".battlefield");if(!host)return;
const ctr=document.createElement("div");ctr.className="ph-overlay-controls";
ctr.innerHTML='<button id="phView">◈ 2B / 3B</button><button id="phCam">▣ Kamera</button><button id="phUI">☷ Arayüz</button>';
host.appendChild(ctr);
ctr.querySelector("#phView").onclick=()=>document.getElementById("toggleBattle3D")?.click();
ctr.querySelector("#phCam").onclick=()=>{const n=(Number(host.dataset.camera||"0")+1)%3;host.dataset.camera=n;window.dispatchEvent(new CustomEvent("war-camera",{detail:n}));ctr.querySelector("#phCam").textContent=["▣ Kamera","◈ Yakın Plan","▥ Kuşbakışı"][n];};
ctr.querySelector("#phUI").onclick=()=>{compact=!compact;document.body.classList.toggle("ph-compact",compact);ctr.querySelector("#phUI").classList.toggle("active",compact)};
}
function makeSelectedCard(){
const row=document.getElementById("battleCards");if(!row)return;
const panel=document.createElement("div");panel.id="phUnitInfo";panel.className="ph-selected-unit";
panel.innerHTML='<img alt="" src="'+portrait(0)+'"><div><strong>1. Mavzerli Piyade</strong><small>Birlik seç ve araziye dokunarak emir ver</small></div>';
row.insertAdjacentElement("afterend",panel);
const tip=document.createElement("div");tip.className="ph-command-tips";tip.innerHTML="<b>Komuta ipucu:</b> Piyadeyi önde, topçuyu geride, süvariyi düşman kanadında kullan.";
document.getElementById("battleCmdHUD")?.appendChild(tip);
}
function refresh(){
if(!battle)return;const panel=document.getElementById("phUnitInfo");if(!panel)return;const id=Math.max(0,Math.min(3,battle.selected)),u=battle.units[id];if(!u)return;
if(panel.dataset.i!==String(id)){panel.dataset.i=String(id);panel.querySelector("img").src=portrait(id)}
panel.querySelector("strong").textContent=names[id]+" · "+Math.ceil(u.hp)+" asker";
panel.querySelector("small").textContent="Moral %"+Math.round(u.morale)+" · Yorgunluk %"+Math.round(u.fatigue||0)+" · Cephane "+u.ammo+" · "+(u.guard?"Savunuyor":"Hareket ediyor / ateş ediyor");
}
home=function(){originalHome();const label=document.querySelector(".hero .eyebrow");if(label)label.textContent="1919 · Tarihî Strateji · Command Edition";};
beginBattle=function(opts){originalBegin(opts);if(!battle||!document.getElementById("field"))return;createBattleHeader();renderCards();createOverlay();makeSelectedCard();};
drawBattle=function(){originalDraw();if(++frames%8===0){refresh();renderCards()}};
window.addEventListener("pagehide",()=>document.body.classList.remove("ph-compact"));
})();

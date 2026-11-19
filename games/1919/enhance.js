"use strict";
/* 1919 — oynanış katmanı: zum'dan bağımsız simgeler, tur geçişi, muharebe raporu,
   seçimli olaylar, ulusal hedefler, kaynak animasyonları ve atlas menüsü.
   age.js (ve dünya modunda world.js) yüklendikten sonra Enhance1919(ctx) çağrılır. */
window.Enhance1919=function(ctx){
if(window.__enh1919)return;window.__enh1919=true;
const W=!!ctx?.world;
if(W)ZMAX=18;
const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
const motionOK=!matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Kompakt, zum ile büyümeyen harita simgeleri ---------- */
const ART={
 barracks:'<path d="M1 8 10 2l9 6v10H1Z" fill="#9b704a" stroke="#f0d29a"/><path d="M8 18v-6h4v6M14 2v6m0-6h5v3h-5" fill="none" stroke="#ffe0a2"/>',
 investment:'<path d="M4 18V7h12v11M1 7h18M2 4h16M14 1v5m0-4h5l-5 2M7 18v-6h5v6" fill="none" stroke="#f0c777" stroke-width="1.7"/><path d="M5 9h10" stroke="#8bd4ca"/>',
 market:'<path d="M2 8h16v10H2Z" fill="#8b7351" stroke="#f0d29a"/><path d="m1 8 2-5h14l2 5Z" fill="#b95542" stroke="#ffdaa0"/><path d="M6 8v10m7-5h3v5" stroke="#f8e3bd" stroke-width="1.5"/>',
 farm:'<path d="M2 9 10 3l8 6v9H2Z" fill="#9b704a" stroke="#f0d29a"/><path d="M7 18v-6h6v6M1 20h18m-15 0v-4m5 4v-5m5 5v-4" stroke="#a8d887" stroke-width="1.6"/>',
 fort:'<path d="M1 18V8h4V5h4v3h4V5h4v3h3v10Z" fill="#8a9087" stroke="#e4d6b4"/><path d="M5 13h2m4 0h2m4 0h1" stroke="#384a43" stroke-width="1.5"/>',
 festival:'<path d="M2 2v16m8-16v16m8-16v16" stroke="#e6d9bb"/><path d="M2 3h7L6 8Zm8 1h7l-3 5Z" fill="#d66b56"/><circle cx="18" cy="3" r="2" fill="#f0cd6d"/><path d="M4 20h12" stroke="#a5d7a4"/>'
};
const MODEL_NAMES={barracks:"Kışla",investment:"Altyapı",market:"Pazar",farm:"Çiftlik",fort:"Tahkimat",festival:"Halk Şenliği"};
modelSvg=function(p){
 const types=[["barracks",p.barracks||0],["investment",p.investment||0],["market",p.market||0],["farm",p.farm||0],["fort",p.fort||0],["festival",p.festivals||0]].filter(t=>t[1]>0);
 if(!types.length)return "";
 const cx=p.x*10.5,cy=p.y*5.7+25,n=types.length,step=12.5,dy=W?14:21;
 return '<g pointer-events="none" transform="translate('+cx+' '+cy+')"><g class="mk"><g transform="translate(0 '+dy+')">'+types.map(([type,count],i)=>{
  const x=(i-(n-1)/2)*step,active=actionFx&&actionFx.id===p.id&&actionFx.type===type;
  return '<g transform="translate('+(x-5.5).toFixed(1)+' -5.5) scale(.55)"><g class="province-model model-'+type+(active?' build-active':'')+'"><title>'+MODEL_NAMES[type]+' · '+count+'</title><circle class="mdl-bg" cx="10" cy="10" r="12"/>'+ART[type]+(count>1?'<circle class="model-count-bg" cx="19" cy="19" r="5.5"/><text class="model-count" x="19" y="21.5">'+Math.min(count,9)+'</text>':'')+'</g></g>';
 }).join("")+'</g></g></g>';
};
garrisonSvg=function(p){
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
const _nationPanel=nationPanel;
nationPanel=function(){
 let html=_nationPanel();
 if(S?.debt?.left)html+='<div class="panel debt"><h3>Dış Borç</h3><p class="muted">Kalan '+S.debt.left+' taksit · tur başına '+S.debt.pay+' altın</p></div>';
 return html+missionsPanel();
};

/* ---------- 4. Seçimli olaylar ---------- */
const CHOICES=[
 {id:"drought",t:"Kuraklık",x:"Hasat zayıf geçti; köylüler yardım bekliyor.",a:[["Tahıl yardımı gönder","50 altın · +4 istikrar",{gold:-50,stab:4}],["Kendi çarelerine baksınlar","−5 istikrar",{stab:-5}]]},
 {id:"volunteers",t:"Gönüllü Birlikleri",x:"Kasabalardan gelen gönüllüler orduya katılmak istiyor.",a:[["Orduya kat","30 altın · +25 asker",{gold:-30,army:25}],["Atölyelere yönlendir","+40 insan gücü",{men:40}]]},
 {id:"merchants",t:"Tüccar Heyeti",x:"Yabancı tüccarlar gümrük ayrıcalığı istiyor.",a:[["Ayrıcalık tanı","+90 altın · −3 istikrar",{gold:90,stab:-3}],["Yerli esnafı koru","+3 istikrar",{stab:3}]]},
 {id:"engineer",t:"Genç Mühendis",x:"Bir mühendis cepheyi bağlayan telgraf ağı öneriyor.",a:[["Projeyi finanse et","80 altın · +1 teknoloji",{gold:-80,tech:1}],["Şimdilik reddet","Etkisi yok",{}]]},
 {id:"unrest",t:"Şehirlerde Huzursuzluk",x:"Ağır vergiler yüzünden meydanlarda gösteriler var.",a:[["Vergi affı ilan et","60 altın · +7 istikrar",{gold:-60,stab:7}],["Jandarmayı gönder","−10 asker · −2 istikrar",{army:-10,stab:-2}]]},
 {id:"refugees",t:"Göçmen Kafilesi",x:"Savaştan kaçan aileler sınıra ulaştı.",a:[["Kapıları aç","20 altın · +50 insan gücü",{gold:-20,men:50}],["Sınırı kapat","−2 istikrar",{stab:-2}]]},
 {id:"loan",t:"Dış Borç Teklifi",x:"Bir banka konsorsiyumu hızlı kredi öneriyor.",a:[["150 altın borç al","5 tur boyunca −35 altın/tur",{gold:150,debt:5}],["Reddet","+1 istikrar",{stab:1}]]},
 {id:"harvest",t:"Bereketli Hasat",x:"Ambarlar doldu; halk bayram havasında.",a:[["Ordunun erzakına ayır","+60 insan gücü",{men:60}],["Pazarda sat","+70 altın",{gold:70}]]},
 {id:"spy",t:"Yakalanan Casus",x:"Karargâhta yabancı bir casus yakalandı.",a:[["Sorgula","+1 teknoloji · −2 istikrar",{tech:1,stab:-2}],["Takas et","+50 altın",{gold:50}]]}
];
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
const _next=next;
next=function(){
 if(S?.pendingChoice){showChoice();return toast("Önce meclisin kararını ver.")}
 const b=snap();_next();
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
const _resolve=resolveMarch;
resolveMarch=function(d,n){
 const f=prov(d?.from),p=prov(d?.to);
 const b=f&&p?{fo:f.owner,po:p.owner,fa:f.army,pa:p.army,fl:f.label,pl:p.label,fort:p.fort||0}:null;
 _resolve(d,n);
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
const _render=render;
render=function(){
 _render();
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
const _act=act;
act=function(a){const r=_act(a);if(S&&!["menu","nations","saves","help","continue"].includes(a)){const before=JSON.stringify(S.missions||{});checkMissions();if(JSON.stringify(S.missions||{})!==before){save();render()}}return r};

/* ---------- 8. Atlas ana menüsü ---------- */
const _home=home;
home=function(){
 document.querySelectorAll(".fx-layer").forEach(x=>x.remove());
 _home();
 const hero=document.querySelector("#app .home .hero");if(!hero||hero.querySelector(".compass"))return;
 hero.classList.add("atlas-hero");
 const grand=document.createElement("button");grand.className="gold";grand.textContent="1919–2035+ · Büyük Sefer";grand.onclick=()=>{location.href="campaign.html"+location.search};hero.querySelector(".actions")?.prepend(grand);
 hero.insertAdjacentHTML("afterbegin",'<svg class="compass" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="none" stroke="#e9c58855" stroke-width="1.5"/><circle cx="60" cy="60" r="44" fill="none" stroke="#e9c58833" stroke-dasharray="2 4"/><g class="rose"><path d="M60 8 67 60 60 112 53 60Z" fill="#e9c588"/><path d="M8 60 60 53 112 60 60 67Z" fill="#a7895a"/><path d="M60 8 67 60H53Z" fill="#b43b34"/></g><text x="60" y="6" text-anchor="middle" fill="#e9c588" font-size="9" font-family="Georgia">K</text></svg>');
 hero.insertAdjacentHTML("beforeend",'<div class="howto"><div><i>1</i><b>Devletini seç</b><small>Zorluk ve ülke</small></div><div><i>2</i><b>Ekonomini kur</b><small>Pazar, çiftlik, teknoloji</small></div><div><i>3</i><b>Diplomasi yürüt</b><small>İttifak, ticaret, savaş</small></div><div><i>4</i><b>Cepheye sevk et</b><small>Komşu bölgeleri al</small></div></div>');
 document.querySelector("#app .home")?.classList.add("atlas-menu");
};
};


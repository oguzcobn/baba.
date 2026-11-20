import { resources, buildings, branches, families, units, focusNames, laws, numerals, eraAt, recipe, researchCost } from "../data/industry.js";
import { capacity, count, deposits, usedSlots, slotLimit, marketStock, assigned, quote, budget } from "../engine/industry.js";

const number=v=>Number(v.toFixed(1)).toLocaleString("tr");
const escape=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const button=(id,label)=>'<button type="button" data-a="econ:'+escape(id)+'">'+escape(label)+'</button>';
const panel=(title,body)=>'<section class="panel econ-panel"><h3>'+escape(title)+'</h3>'+body+'</section>';
const row=(name,value)=>'<div class="econ-row"><span>'+escape(name)+'</span><strong>'+escape(value)+'</strong></div>';
const progress=(done,total)=>'<progress max="'+total+'" value="'+Math.min(done,total)+'"></progress>';
const option=(id,label)=>'<option value="'+escape(id)+'">'+escape(label)+'</option>';
const select=(id,label,options)=>'<label class="econ-field">'+escape(label)+'<select id="'+id+'">'+options+'</select></label>';
const info=s=>'<p class="muted">'+escape(s)+'</p>';
const detail=(title,body)=>'<details><summary>'+escape(title)+'</summary>'+body+'</details>';
const pct=v=>Math.round(v*100)+"%";

export function resourceBar(s){
  return Object.entries(resources).map(([k,[label]])=>'<span>'+label+' <b>'+number(s.materials[k])+'</b></span>').join("")+
    '<span>Politik güç <b>'+number(s.industry.political)+'</b></span><span>Savaş desteği <b>'+number(s.industry.support)+'%</b></span>';
}
function facilityPanel(s,p,coastal,month){
  if(p?.owner!==s.me)return panel("Tesisler",info("İnşaat için haritadan kendi eyaletini seç."));
  const current=p.construction,b=buildings[current?.type];
  const status=current?row(b[0],number(current.work)+" / "+b[1]+" iş")+progress(current.work,b[1])+
    button("cancelbuild","İnşaatı iptal et"):info("Etkin inşaat yok.");
  const items=Object.entries(buildings).map(([key,[name,work,budget,steel,slots,effect]])=>{
    let reason="";
    if(key==="yard"&&!coastal)reason="Kıyı gerekli";
    else if(key==="electronics"&&(eraAt(month)<4||s.industry.levels.industry<4))reason="Sanayi IV gerekli";
    else if(key==="infra"&&count(p,key)>=3)reason="En üst seviye";
    else if(usedSlots(p)+slots>slotLimit(p))reason="Boş alan gerekli";
    return '<div class="econ-item">'+row(name,count(p,key)+" tesis")+info(effect)+info(work+" iş · "+budget+" bütçe · "+steel+" çelik · "+slots+" alan")+
      (reason?info(reason):!current?button("build:"+key,"İnşa et"):"")+'</div>';
  }).join("");
  return panel(p.label+" · Tesisler",row("Dolu alan",usedSlots(p)+" / "+slotLimit(p))+status+detail("İnşaat seçenekleri",items));
}
function linePanel(s){
  const e=s.industry;
  const picker=(id,yard)=>{
    const models=[];
    for(const [key,f] of Object.entries(families))for(let lv=f.first;lv<=e.levels[f.branch];lv++){
      const m=recipe(key,lv);
      if(m.yard===yard){
        const inputs=Object.entries(m.inputs).filter(([,n])=>n).map(([r,n])=>n+" "+resources[r][0]).join(", ");
        models.push(option(key+"."+lv,m.name+" · "+m.work+" iş · "+inputs));
      }
    }
    if(!models.length)return info("Bu tesise uygun bir dal araştır.");
    return select("econ-model-"+id,"Model",models.join(""))+button("line:"+id,id==="arms"||id==="yard"?"Hat aç":"Modeli değiştir");
  };
  let html="";
  for(const [type,title] of [["arms","Askerî fabrika"],["yard","Tersane"]]){
    const yard=type==="yard",lines=e.lines.filter(l=>l.yard===yard),slots=capacity(s,yard);
    html+=row(title,assigned(e,yard)+" / "+slots+" tesis tahsisli");
    for(const l of lines){
      const m=recipe(l.key,l.level);
      html+='<div class="econ-item">'+row(m.name,pct(l.efficiency)+" verim")+progress(l.work,m.work)+
        info(number(l.work)+" / "+m.work+" iş · "+l.status)+detail("Hat ayarları",
        info("Model değişince kısmi iş kaybedilir ve verim geçici olarak düşer.")+
        row("Atanan tesis",l.factories||1)+button("assign:"+l.id+":1","Tesis ekle")+button("assign:"+l.id+":-1","Tesisi ayır")+picker(l.id,l.yard)+button("priority:"+l.id,"Kaynak önceliği ver")+button("close:"+l.id,"Hattı kapat"))+'</div>';
    }
    if(assigned(e,yard)<slots)html+=picker(type,yard);
  }
  return panel("Üretim hatları",html);
}
function trainingPanel(s,p){
  const e=s.industry,stock=Object.entries(e.inventory).filter(([,n])=>n>0).map(([id,n])=>{
    const [key,lv]=id.split(".");return row(recipe(key,+lv).name,n+" parti");
  }).join("");
  const jobs=e.training.map(j=>row(units[j.key][0]+" · "+(s.p.find(p=>p.id===j.node)?.label||""),Math.ceil(j.left)+" ay"+(j.waitingFuel?" · Yakıt bekliyor":""))).join("");
  const u=Object.entries(units).map(([key,[name,men,months,kit]])=>option(key,name+" · "+men+" insan · "+months+" ay · "+Object.entries(kit).map(([k,n])=>n+" "+families[k].name).join(", "))).join("");
  return panel("Teçhizat ve eğitim",(stock||info("Depoda hazır parti yok."))+(jobs||info("Eğitim sırası boş."))+
    (p?.owner===s.me?select("econ-unit","Birlik · "+p.label,u)+button("train","Eğitime al"):""));
}
export function industryPanel(s,p,coastal,month,partners,name){
  const home=p?.owner===s.me;
  const yields=home?Object.entries(deposits(p)).map(([k,n])=>row(resources[k][0],number(n)+" / ay")).join(""):"";
  let tradeInfo=info("Barışta olduğun komşu veya ticaret ortağı gerekli.");
  if(partners.length){
    tradeInfo=select("econ-partner","Ticaret ortağı",partners.map(id=>option(id,name(id))).join(""))+
      select("econ-resource","Kaynak",Object.entries(resources).filter(([k])=>k!=="chips"||eraAt(month)>=4).map(([k,[label,price]])=>option(k,label+" · temel fiyat "+price)).join(""))+
      button("buy","5 birim al")+button("sell","5 birim sat")+'<output id="econ-quote"></output>';
  }
  const cargo=s.industry.cargo.map(c=>row(resources[c.key][0]+" · "+(c.buyer===s.me?"İthalat":"İhracat"),c.amount+" birim · "+Math.max(0,c.arrive-month)+" ay")).join("");
  const ledger=budget(s);
  return panel("Sanayi bütçesi",row("Aylık gelir",number(ledger.income))+row("Aylık bakım",number(ledger.upkeep))+row("Ödenmemiş açık",number(s.industry.arrears)))+facilityPanel(s,p,coastal,month)+linePanel(s)+trainingPanel(s,p)+panel("Kaynak ticareti",tradeInfo+cargo)+(home?panel("Yerel üretim · "+p.label,yields):"");
}
export function wireMarket(s){
  const partner=document.getElementById("econ-partner"),resource=document.getElementById("econ-resource");
  if(!partner||!resource)return;
  const updateQuote=()=>{
    if(!partner.value||!resource.value)return;

    document.getElementById("econ-quote").textContent="Ortak stoku "+number(marketStock(s,partner.value)[resource.value])+
      " · 5 birim alış "+quote(s,partner.value,resource.value,5)+" / satış "+quote(s,partner.value,resource.value,-5)+" bütçe";
  };
  partner.onchange=updateQuote;resource.onchange=updateQuote;updateQuote();
}
export function researchPanel(s,month){
  const e=s.industry,r=e.study;
  let html=panel("Araştırma programı",row("Takvim çağı",numerals[eraAt(month)])+row("Ekip",e.teams)+
    (r?row(branches[r.key][r.level],number(r.work)+" / "+researchCost[r.level])+progress(r.work,researchCost[r.level]):info("Bir dalın sıradaki aşamasını seç."))+
    (e.teams===1?button("team","İkinci ekip · 20 politik güç, 2 sivil fabrika"):""));
  for(const [key,[label,...steps]] of Object.entries(branches)){
    const level=e.levels[key];
    const tree=steps.map((title,i)=>{
      const lv=i+1,active=r?.key===key&&r.level===lv;
      const state=lv<=level?"Tamamlandı":active?"Araştırılıyor":lv>eraAt(month)?"Çağ bekliyor":lv>level+1?"Önceki aşama gerekli":researchCost[lv]+" puan";
      return row(numerals[lv]+" · "+title,state);
    }).join("");
    html+=panel(label,detail("5 aşamayı göster · "+level+"/5 tamamlandı",tree)+
      (!r&&level<eraAt(month)?button("research:"+key,steps[level]+" araştır"):""));
  }
  return html;
}
const focusEffects=[
  ["Altyapı inşaatı +%8","Eğitim hızı +%8"],["Üretim işi +%8","İnsan gücü kazanımı +%8"],
  ["Hava araştırması +%8","Petrol rafinajı +%8"],["Çip üretimi +%8","İnşaat işi +%8"],
  ["Üretim işi +%8","Yerel hammadde üretimi +%8"]
];
export function politicsPanel(s,month){
  const e=s.industry;
  let html=panel("Meclis",row("Politik güç",number(e.political))+row("İstikrar",number(s.stability)+"%")+row("Savaş desteği",number(e.support)+"%")+
    (e.crisis?info("Bütçe krizi · Meclis karar bekliyor.")+button("crisis:deal","Uzlaş · 15 politik güç, +6 istikrar")+button("crisis:budget","Bütçe ayır · 12 bütçe, +4 istikrar"):""));
  const effects={economy:["Sivil iş ×1,15 / üretim ×0,90","Standart kapasite","Sivil iş ×0,80 / üretim ×1,20"],service:["Düşük katılım","Orta katılım","Yüksek katılım / sivil iş ×0,85"],trade:["İthalat ×0,95 / inşa ×0,96","Standart fiyat","İthalat ×1,12 / inşa ×1,05"]};
  for(const [key,[label,...options]] of Object.entries(laws)){
    const current=e.laws[key],wait=Math.max(0,6-month+(e.changed[key]??-6));
    html+=panel(label,row("Yürürlükte",options[current])+info(effects[key][current])+(wait?info(wait+" ay sonra değiştirilebilir."):
      detail("Yasayı değiştir · 25 politik güç",options.map((n,i)=>i===current?"":button("law:"+key+":"+i,n+" · "+effects[key][i])).join(""))));
  }
  for(let era=1;era<=eraAt(month);era++){
    const list=focusNames[era-1].map((n,i)=>{
      const id=era+"."+i,active=e.focus?.era===era&&e.focus.index===i,done=e.completed.includes(id);
      const blocked=i===2?!e.completed.some(k=>k===era+".0"||k===era+".1"):e.completed.includes(era+"."+(1-i));
      const state=done?"Tamamlandı":active?e.focus.left+" ay kaldı":blocked?"Kilitli":i===2?"18 ay · 25 PG":"12 ay · 15 PG";
      return row(n,state)+info(i===2?"Araştırma hızı +%5":focusEffects[era-1][i])+(!e.focus&&!done&&!blocked?button("focus:"+era+":"+i,"Odağı seç"):"");
    }).join("");
    html+=panel("Ulusal odak · Çağ "+numerals[era],list);
  }
  return html;
}

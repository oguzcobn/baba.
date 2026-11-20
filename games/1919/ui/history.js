import { atlasImage, portraits, uniformImage } from "../assets/art.js";
import { historicalCard, officer, isoOf, uniformRegion, spirits, branchNames } from "../data/history.js";
const esc=v=>String(v??"").replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
const spiritLabel={arms:"Askerî üretim",yard:"Tersane üretimi",study:"Araştırma",fuel:"Rafineri çıkışı",civil:"İnşaat"};
export function eraArt(era,row,caption,id){
 const path=row===0&&id?uniformImage:atlasImage;
 if(row===0&&id)row=uniformRegion(id);
 return '<figure class="era-card"><div class="era-frame"><span aria-hidden="true">✦</span><img loading="lazy" alt="" src="'+path+'" style="left:-'+(era-1)*100+'%;top:-'+row*100+'%"></div><figcaption>'+esc(caption)+'</figcaption></figure>';
}
export function historyPanel(s,id,era,title){
 const card=historicalCard(id,era);
 if(!card)return "";
 const chief=officer(s,id,era),spirit=spirits[isoOf(id)];
 const files=portraits;
 const portrait=(person,path)=>'<img class="history-portrait" loading="lazy" src="'+path+'" alt="'+esc(person)+'">';
 const found=Object.keys(files).filter(n=>card.leaders.includes(n));
 const photo=found.length?found.map(n=>portrait(n,files[n])).join(""):'<div class="history-initials" aria-hidden="true">'+esc(card.leaders.split(/\s+/).slice(0,2).map(w=>w[0]).join(""))+'</div>';
 const officers=card.officers.map(([person,branch,note],i)=>'<div class="econ-item">'+(files[person]?portrait(person,files[person]):"")+'<strong>'+esc(person)+'</strong> · '+branchNames[branch]+
   (note?'<small> · '+esc(note)+'</small>':'')+(s.me===id?(person===chief?.[0]?'<small> · Görevde</small>':' <button data-a="appoint-'+i+'">Ata</button>'):'')+'</div>').join("");
 return '<section class="panel"><div class="eyebrow">'+esc(title)+' · Dönem kadrosu</div>'+photo+'<h3>'+esc(card.leaders)+'</h3>'+
 '<p>'+esc(card.context||"Bu çağın tarihsel siyasi isimleri")+'</p>'+
 (card.interval?'<small>Kaynak kaydındaki dönem · '+card.interval.join(" – ")+'</small>':'')+
 (spirit?'<p>'+esc(spirit[0])+' · '+spiritLabel[spirit[1]]+' +%5</p>':'')+
 (officers?'<h4>Komutanlar</h4>'+officers+'<small>Görevdeki komutan kendi branşındaki üretime %4 kurmay katkısı sağlar.</small>':'')+
 '<details><summary>Tarihsel bağlam</summary><p>Alternatif tarih senaryosu. İsimler çağ içindeki dönemleri temsil eder. Aynı listede farklı tarihlerde görev yapmış kişiler bulunabilir. 2035 sonrası son dönem kadrosuyla oynanır.</p><small>'+esc(card.source||"Dönem derlemesi")+'</small><p><a href="assets/SOURCES.md" target="_blank" rel="noopener">Görsel ve veri kaynakları</a></p></details></section>'+
 '<div class="era-art-grid">'+[[0,"Piyade"],[1,"Zırhlı araç"],[2,"Havacılık"],[4,"Donanma"],...(era>=3?[[3,"İHA"]]:[]),...(era>=4?[[5,"İDA"]]:[])].map(([row,label])=>eraArt(era,row,label,id)).join("")+'</div>';
}

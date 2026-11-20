const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=v=>Math.round(v*100)+"%";
function gauge(label,value){
 return '<label class="front-gauge">'+label+' <b>'+Math.round(value)+'</b><progress max="100" value="'+Math.round(value)+'"></progress></label>';
}
export function frontsPanel(s,p,name){
 const w=s.theatre,nodes=new Map(s.p.map(v=>[v.id,v]));
 const cards=w.fronts.filter(b=>b.attacker===s.me||b.defender===s.me||b.to===p?.id).map(b=>{
   const l=b.last;
   return '<section class="panel"><small>'+esc(b.phase)+' · '+b.elapsed+' ay</small><h3>'+esc(nodes.get(b.from)?.label)+' → '+esc(nodes.get(b.to)?.label)+'</h3>'+
     '<p>'+esc(name(b.attacker))+' · '+b.group.army+' asker</p>'+gauge("Can",b.hp)+gauge("Organizasyon",b.org)+
     '<p>'+esc(name(b.defender))+' · '+nodes.get(b.to).army+' asker · siper '+pct(b.dug)+'</p>'+gauge("Can",b.defHp)+gauge("Organizasyon",b.defOrg)+
     (l?'<p>'+esc(l.ground)+' · '+esc(l.weather)+' · Cephe genişliği '+l.width+'</p><p>Taarruz / savunma ikmali '+pct(l.supply)+' / '+pct(l.defSupply)+' · Yakıt karşılama '+pct(l.fuel)+' · Teknoloji çarpanı ×'+l.obsolete.toFixed(2)+'</p>':'<p>İntikal gelecek ay başlar.</p>')+
     (b.attacker===s.me?'<button data-a="recall-'+b.id+'">Geri çekil</button>':'')+'</section>';
 }).join("");
 const o=p?.occupation;
 const occupation=o?'<section class="panel"><h3>'+esc(p.label)+' · İşgal yönetimi</h3><p>Önceki yönetim '+esc(name(o.sovereign))+' · Direniş '+Math.round(o.resistance)+'% · Garnizon '+o.garrison+' · Tesis kesintisi '+o.disruption+' ay</p>'+
 (p.owner===s.me?'<button data-a="garrison">'+(o.garrison?"Garnizonu çöz":"Garnizon ayır")+'</button>'+(!s.p.some(q=>q.owner===o.sovereign)?'<button data-a="settle">Barışla denetimi kesinleştir</button>':''):'')+'</section>':'';
 return '<div class="eyebrow">HAREKÂT KARARGÂHI</div><h2>Cepheler</h2><p>Dünya gerilimi '+Math.round(w.tension)+' / 100 · Dünyada '+w.fronts.length+' etkin cephe</p>'+occupation+(cards||'<div class="panel">Bu bölgede veya katıldığın savaşlarda etkin cephe yok.</div>')+
 '<details><summary>Son cephe raporları</summary>'+w.records.map(t=>'<p>'+esc(t)+'</p>').join("")+'</details>';
}

import anatolia from '../data/anatolia.mjs';
import {worldMap} from '../data/world.mjs';
import {calendar,eras,facilities,branches} from '../data/catalog.mjs';
import {initial,order} from '../engine/campaign.mjs';
const $=s=>document.querySelector(s),bar=$('#bar'),panel=$('#panel'),status=$('#status'),svg=$('svg');
const local=new URLSearchParams(location.search).get('scenario')==='1919',scenario=local?'1919':'world',key='baba-grand-v1-'+scenario;
$('#back').href='age.html'+(local?'?scenario=1919':'');
const button=(text,fn,parent,primary=false)=>{const b=document.createElement('button');b.textContent=text;b.classList.toggle('primary',primary);b.onclick=fn;parent.append(b);return b;};
function line(parent,tag,txt){const el=document.createElement(tag);el.textContent=txt;parent.append(el);return el;}
function select(parent,items,value,fn){const el=document.createElement('select');for(const [id,name] of items)el.add(new Option(name,id));el.value=value;el.onchange=()=>fn(el.value);parent.append(el);return el;}
try{
const map=local?anatolia:await worldMap(),names=new Map(map.map(p=>[p.owner,p.country])),paths=new Map(),worker=new Worker(new URL('../engine/worker.mjs',import.meta.url),{type:'module'});
const countries=[...names].sort((a,b)=>a[1].localeCompare(b[1],'tr'));
let s=null,id=map.find(p=>['tr','792'].includes(p.owner))?.id||map[0].id,busy=false,section='Sanayi',foreign='',selectedCountry=map.find(p=>p.id===id).owner;
const color=owner=>'hsl('+((countries.findIndex(c=>c[0]===owner)*137.5)%360)+',28%,47%)';
for(const g of map){const el=document.createElementNS(svg.namespaceURI,'path');el.setAttribute('d',g.path);el.setAttribute('fill-rule','evenodd');el.setAttribute('fill',color(g.owner));const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=g.label;el.append(title);el.onclick=()=>{if(busy)return;id=g.id;if(!s)selectedCountry=g.owner;draw();};svg.append(el);paths.set(g.id,el);}
function save(){try{localStorage.setItem(key,JSON.stringify(s));}catch{status.textContent='Tarayıcı kaydı yazılamadı.';}}
function command(a,arg){if(busy)return;const error=order(s,map,id,a,arg);status.textContent=error||'Emir kaydedildi.';if(!error)save();draw();}
function draw(){
 bar.replaceChildren();panel.replaceChildren();
 for(const g of map){const el=paths.get(g.id),paint=color(s?s.provinces[g.id].owner:g.owner);if(el.getAttribute('fill')!==paint)el.setAttribute('fill',paint);el.classList.toggle('active',g.id===id);}
 if(!s){
   line(bar,'strong',local?'Anadolu · Mayıs 1919':'Dünya · Ocak 1919');select(bar,countries,selectedCountry,v=>{selectedCountry=v;id=map.find(p=>p.owner===v).id;draw();});
   button('Sefer başlat',()=>{s=initial(map,selectedCountry,scenario);save();draw();},bar,true);
   if(localStorage.getItem(key))button('Kaydı aç',()=>{try{const v=JSON.parse(localStorage.getItem(key));if(v.version!==1||v.scenario!==scenario||!v.countries[v.me]||!map.every(p=>v.provinces[p.id]))throw Error();s=v;id=map.find(p=>s.provinces[p.id].owner===s.me)?.id||id;draw();}catch{status.textContent='Kayıt okunamadı.';}},bar);
   line(panel,'h2','1919’dan modern çağa');line(panel,'p','Bir devlet seç. Fabrika kur, üretim hattını belirle ve eğitim için teçhizat biriktir. Sefer her tur sonunda kaydedilir.');const link=line(panel,'a',local?'Dünya haritası':'Anadolu senaryosu');link.href='campaign.html'+(local?'':'?scenario=1919');return;
 }
 const c=s.countries[s.me],p=s.provinces[id],g=map.find(x=>x.id===id),date=calendar(s);
 line(bar,'strong',names.get(s.me)+' · '+new Date(Date.UTC(date.year,date.month)).toLocaleDateString('tr',{month:'long',year:'numeric',timeZone:'UTC'}));
 line(bar,'span',eras[date.era]);select(bar,[['3','3 ay'],['6','6 ay']],String(s.tempo),v=>{if(!busy){s.tempo=Number(v);save();}});
 button(busy?'Tur ilerliyor…':'Turu bitir',()=>{if(busy)return;busy=true;draw();worker.postMessage({state:s,map:map.map(({path,...g})=>g)});},bar,true).disabled=busy;
 select(panel,map.map(g=>[g.id,g.label]),id,v=>{id=v;draw();});line(panel,'h2',g.label);line(panel,'small',names.get(p.owner)+' · '+p.army+' asker · Direniş %'+Math.round(p.resist));
 line(panel,'p','Bütçe '+Math.floor(c.gold)+' · İnsan gücü '+c.men+' · Politik güç '+c.pp+' · Çelik '+Math.floor(c.steel)+' · Alaşım '+Math.floor(c.alloy)+' · Yakıt '+Math.floor(c.fuel));
 for(const v of ['Sanayi','Araştırma','Diplomasi','Cephe'])button(v,()=>{section=v;draw();},panel,v===section);
 const box=document.createElement('article');panel.append(box);
 if(section==='Sanayi'){
 line(box,'h3','Üretim ve inşaat');line(box,'p',Object.entries(p.buildings).map(([k,n])=>facilities[k][0]+' ×'+n).join(' · '));
 for(const [k,[n]] of Object.entries(facilities))if(k!=='yard'||g.coastal)button(n+' · 40 bütçe',()=>command('build',k),box);
 line(box,'p','Hat verimi %'+Math.round(c.eff*100)+' · Kara teçhizatı '+Math.floor(c.stock.land||0));
 for(const [k,models] of Object.entries(branches))if(models[c.tech[k]]&&k!=='industry')button(models[c.tech[k]],()=>command('line',k),box,c.line===k);
 button('20 asker eğit · 4 ay',()=>command('train'),box);for(const j of p.jobs)line(box,'p',j.kind==='build'?facilities[j.arg][0]+' · '+j.left+' inşaat puanı':'Eğitim · '+j.left+' ay');
 }else if(section==='Araştırma'){
 for(const [k,models] of Object.entries(branches)){const level=(c.tech[k]??-1)+1;if(level<5)button((models[level]||'Öncül teknoloji')+' · '+k,()=>command('research',k),box);}
 if(c.research)line(box,'p','Araştırma · '+c.research.arg+' · '+c.research.left+' ay');button('Ekonomi yasası · '+(c.law==='civil'?'Sivil':'Seferberlik'),()=>command('law'),box);button(c.focus?'Sanayi odağı · '+c.focus.left+' ay':'Ulusal sanayi odağı · 6 ay',()=>command('focus'),box);
 }else if(section==='Diplomasi'){
 const options=countries.filter(([k])=>k!==s.me);if(!options.some(([k])=>k===foreign))foreign=options[0][0];select(box,options,foreign,v=>{foreign=v;draw();});const pair=[foreign,s.me].sort().join('|');line(box,'p',s.wars.includes(pair)?'Savaş':s.alliances.includes(pair)?'İttifak':'Barış');
 for(const [k,n] of [['trade','10 çelik satın al'],['alliance','İttifak kur'],['war','Savaş ilan et'],['peace','Barış yap']])button(n,()=>command(k,foreign),box);
 }else{
 for(const n of g.neighbours.filter(n=>s.provinces[n]&&s.provinces[n].owner!==p.owner))button(map.find(g=>g.id===n).label+' · harekât',()=>command('attack',n),box);
 for(const b of s.battles)line(box,'p',map.find(g=>g.id===b.to).label+' · '+b.round+' ay · Organizasyon '+Math.round(b.org));for(const msg of s.log.slice(0,5))line(box,'p',msg);
 }
 const canvas=$('canvas');canvas.width=1080;canvas.height=650;const ctx=canvas.getContext('2d');ctx.strokeStyle='#ffca70';ctx.lineWidth=3;
 for(const b of s.battles){const a=map.find(g=>g.id===b.from),t=map.find(g=>g.id===b.to);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(t.x,t.y);ctx.stroke();}
}
worker.onmessage=({data})=>{busy=false;if(data.state){s=data.state;save();status.textContent='Tur tamamlandı.';}else status.textContent=data.error;draw();};worker.onerror=()=>{busy=false;status.textContent='Tur hesaplanamadı.';draw();};draw();
}catch(e){status.textContent=e.message;}

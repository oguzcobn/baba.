import {calendar,branches,facilities} from '../data/catalog.mjs';
export function initial(map,me,scenario){
 const provinces={},countries={};
 for(const p of map){
   provinces[p.id]={owner:p.owner,army:45,resist:0,buildings:{civil:1,mil:1},jobs:[]};
   countries[p.owner]??={gold:150,men:160,steel:45,fuel:30,alloy:20,pp:30,tech:{land:0},line:'land',eff:.5,stock:{},law:'civil',focus:null,research:null};
 }
 return {version:1,scenario,me,month:0,tempo:6,provinces,countries,wars:[],alliances:[],battles:[],log:[],tension:0};
}
const pair=(a,b)=>[a,b].sort().join('|');
export function order(s,map,id,action,arg,actor=s.me){
 const p=s.provinces[id],c=s.countries[actor],geo=map.find(g=>g.id===id);
 if(!p||p.owner!==actor)return 'Kendi bölgeni seç.';
 const era=calendar(s).era;
 if(action==='build'){
   if(!facilities[arg]||arg==='yard'&&!geo.coastal)return 'Kıyı bölgesi gerekli.';
   if(p.jobs.some(j=>j.kind==='build')||Object.values(p.buildings).reduce((a,b)=>a+b,0)>=8)return 'İnşaat alanı dolu.';
   if(c.gold<40)return '40 bütçe gerekli.';
   c.gold-=40;p.jobs.push({kind:action,arg,left:facilities[arg][1]});
 }else if(action==='research'){
   const level=(c.tech[arg]??-1)+1;
   if(!branches[arg]||c.research||level>era||c.pp<8)return 'Araştırma için uygun çağ, boş ekip ve 8 politik güç gerekli.';
   c.pp-=8;c.research={arg,level,left:4+2*level};
 }else if(action==='line'){
   if(!branches[arg]?.[c.tech[arg]]||arg==='industry')return 'Bu model için araştırma gerekli.';
   if(c.line!==arg){c.line=arg;c.eff=Math.max(.3,c.eff*.6);}
 }else if(action==='train'){
   if(c.men<20||(c.stock.land||0)<2)return '20 insan gücü ve 2 kara teçhizatı gerekli.';
   c.men-=20;c.stock.land-=2;p.jobs.push({kind:action,left:4});
 }else if(action==='law'||action==='focus'){
   if(c.pp<20||action==='focus'&&c.focus)return '20 politik güç veya boş odak gerekli.';
   c.pp-=20;if(action==='law')c.law=c.law==='civil'?'mobilise':'civil';else c.focus={left:6};
 }else if(action==='trade'){
   const seller=s.countries[arg];if(!seller||seller===c||seller.steel<10||c.gold<12||s.wars.includes(pair(actor,arg)))return 'Ticaret koşulları karşılanmadı.';
   seller.steel-=10;c.steel+=10;c.gold-=12;seller.gold+=12;
 }else if(action==='alliance'||action==='war'||action==='peace'){
   const key=pair(actor,arg);
   if(!s.countries[arg]||arg===actor)return 'Başka bir devlet seç.';
   if(action==='war'&&!s.wars.includes(key)&&!s.alliances.includes(key)){s.wars.push(key);s.tension+=3;}
   else if(action==='peace'&&s.wars.includes(key)){s.wars=s.wars.filter(w=>w!==key);}
   else if(action==='alliance'&&!s.wars.includes(key)&&!s.alliances.includes(key)&&c.pp>=15){c.pp-=15;s.alliances.push(key);}
   else return 'Diplomatik koşullar uygun değil.';
 }else if(action==='attack'){
   const t=s.provinces[arg];
   if(!t||!geo.neighbours.includes(arg)||!s.wars.includes(pair(actor,t.owner))||p.army<24||c.fuel<3||s.battles.some(b=>b.to===arg))return 'Komşu düşman, 24 asker, boş cephe ve 3 yakıt gerekli.';
   const force=Math.floor(p.army*.6);p.army-=force;c.fuel-=3;s.battles.push({from:id,to:arg,actor,enemy:t.owner,force,org:100,defOrg:100,round:0});
 }else return 'Geçersiz emir.';
 return '';
}
export function month(s,map){
 const {month:m,era}=calendar(s);
 for(const [id,p] of Object.entries(s.provinces)){
   const c=s.countries[p.owner],b=p.buildings;
   c.gold+=2+b.civil;c.men+=c.law==='mobilise'?3:1;c.steel+=2;c.fuel+=1+(b.refinery||0)*2;c.alloy++;
   for(const j of p.jobs){j.left-=j.kind==='build'?10*b.civil:1;if(j.left<=0){if(j.kind==='build')b[j.arg]=(b[j.arg]||0)+1;else p.army+=20;}}
   p.jobs=p.jobs.filter(j=>j.left>0);p.resist=Math.max(0,p.resist-(p.army>=20?2:.5));
   const naval=['navy','surface'].includes(c.line),capacity=naval?(b.yard||0):b.mil;
   const output=Math.min(c.steel,c.alloy,capacity*c.eff*(c.law==='mobilise'?1.15:1)*(1+(c.tech.industry??-1)*.04)*(1-p.resist/200));
   c.steel-=output;c.alloy-=output;c.stock[c.line]=(c.stock[c.line]||0)+output;
 }
 for(const c of Object.values(s.countries)){
   c.pp+=1;c.eff=Math.min(.95,c.eff+.03);
   if(c.research&&--c.research.left<=0){c.tech[c.research.arg]=c.research.level;if(c.line===c.research.arg)c.eff*=.7;c.research=null;}
   if(c.focus&&--c.focus.left<=0){c.gold+=40;c.steel+=12;c.focus=null;}
 }
 for(const b of s.battles){
   const dest=s.provinces[b.to],src=s.provinces[b.from],a=s.countries[b.actor],d=s.countries[dest.owner];
   if(dest.owner!==b.enemy||src.owner!==b.actor||!s.wars.includes(pair(b.actor,b.enemy))){if(src.owner===b.actor)src.army+=b.force;b.done=true;continue;}
   const winter=[11,0,1].includes(m),supply=Math.min(1,(45+12*(src.buildings.depot||0))/b.force);
   const power=b.force*(.4+.006*b.org)*(.5+.5*supply)*(winter?.9:1)*Math.pow(.78,Math.max(0,(d.tech.land||0)-(a.tech.land||0)));
   const defense=Math.max(1,dest.army*(.4+.006*b.defOrg)*(1+.05*Math.min(4,b.round)));
   const ratio=Math.min(4,Math.max(.25,power/defense));b.round++;b.force=Math.max(0,b.force-Math.ceil(3/ratio));dest.army=Math.max(0,dest.army-Math.ceil(3*ratio));b.org-=12/ratio;b.defOrg-=12*ratio;
   if(!b.force||b.org<20){src.army+=b.force;b.done=true;}
   else if(!dest.army||b.defOrg<20){dest.owner=b.actor;dest.army=b.force;dest.jobs=[];dest.resist=45;b.done=true;s.log.unshift(map.find(p=>p.id===b.to).label+' el değiştirdi.');}
 }
 s.battles=s.battles.filter(b=>!b.done);s.month++;s.tension=Math.max(0,s.tension-.1);s.log.length=Math.min(20,s.log.length);
}

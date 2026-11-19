import {month,order} from './campaign.mjs';
import {calendar,branches} from '../data/catalog.mjs';
export function advance(s,map){
 const byId=new Map(map.map(p=>[p.id,p]));
 for(let step=0;step<s.tempo;step++){
   const owned=new Map();
   for(const [id,p] of Object.entries(s.provinces)){if(!owned.has(p.owner))owned.set(p.owner,[]);owned.get(p.owner).push(id);}
   for(const [actor,ids] of owned){
     if(actor===s.me)continue;
     const id=ids[s.month%ids.length],p=s.provinces[id],c=s.countries[actor];
     const neighbours=byId.get(id).neighbours.filter(n=>s.provinces[n]&&s.provinces[n].owner!==actor);
     const target=neighbours.sort((a,b)=>s.provinces[a].army-s.provinces[b].army)[0], enemy=s.provinces[target]?.owner;
     const key=[actor,enemy].sort().join('|');
     const options=[['train','',p.army<80?8:2],['build',byId.get(id).coastal&&!p.buildings.yard?'yard':'mil',p.buildings.mil<2?6:1],['focus','',3]];
     for(const branch of Object.keys(branches))if((c.tech[branch]??-1)<calendar(s).era)options.push(['research',branch,branch==='land'?9:5]);
     if(enemy){
       if(s.wars.includes(key)){options.push(['attack',target,p.army>s.provinces[target].army?10:1],['peace',enemy,p.army<25?11:0]);}
       else if(p.army>1.5*s.provinces[target].army)options.push(['war',enemy,7]);
       else if(s.tension>15)options.push(['alliance',enemy,5]);
       if(c.steel<8)options.push(['trade',enemy,9]);
     }
     for(const [action,arg] of options.sort((a,b)=>b[2]-a[2]))if(!order(s,map,id,action,arg,actor))break;
   }
   month(s,map);
 }
 return s;
}

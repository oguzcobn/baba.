// node games/1919/tools/build-leaders-db.mjs [--wikidata result.json] [--strict]
// Offline validation always runs. The online option writes dated candidate records separately so
// political sovereignty and predecessor relationships can be reviewed before updating regional files.
import fs from "node:fs/promises";
import path from "node:path";
import { history } from "../data/history.js";
import { playable } from "../data/playable.js";
const topology=JSON.parse(await fs.readFile(new URL("../../../data/countries-50m.json",import.meta.url),"utf8"));
const ids=[...new Set(topology.objects.countries.geometries.map(g=>g.id).filter(id=>/^\d{3}$/.test(id)&&id!=="010"))].sort();
const missing=[];
for(const id of ids)for(let era=0;era<5;era++){
 const c=history[id]?.[era];
 if(!c?.leaders||!Array.isArray(c.officers)||playable.has(id)&&(c.officers.length<3||c.officers.some(([name,branch])=>!name||!["K","Z","D","H","M","S","T"].includes(branch))))missing.push([id,era+1]);
}
if(missing.length)throw Error("Eksik dönem kayıtları: "+JSON.stringify(missing));
console.log(ids.length+" bölge · "+ids.length*5+" dönem kaydı · "+playable.size+" ayrıntılı kadro.");
const args=process.argv.slice(2),i=args.indexOf("--wikidata");
if(i>=0){
 const destination=args[i+1];if(!destination||destination.startsWith("--"))throw Error("Çıktı JSON yolu gerekli.");
 const entries=[],failed=[];
 for(let j=0;j<ids.length;j+=4){
  const group=ids.slice(j,j+4);
  const query=`SELECT DISTINCT ?iso ?country ?person ?personLabel ?role ?start ?end WHERE {
   VALUES ?iso { ${group.map(id=>'"'+id+'"').join(' ')} }
   ?country wdt:P299 ?iso .
   { VALUES (?property ?value ?role) {(p:P6 ps:P6 "government")(p:P35 ps:P35 "state")}
     ?country ?property ?statement . ?statement ?value ?person . }
   UNION { VALUES (?officeProperty ?role) {(wdt:P1906 "state")(wdt:P1313 "government")}
     ?country ?officeProperty ?office . ?person p:P39 ?statement . ?statement ps:P39 ?office . }
   ?person wdt:P31 wd:Q5 . ?statement pq:P580 ?start .
   OPTIONAL {?statement pq:P582 ?end} FILTER(!BOUND(?end)||YEAR(?end)>=1919)
   SERVICE wikibase:label {bd:serviceParam wikibase:language "tr,en".}
  }`;
  let rows;
  for(let n=0;n<3&&!rows;n++){
   try{
    const url=new URL("https://query.wikidata.org/sparql");url.search=new URLSearchParams({query,format:"json"});
    const res=await fetch(url,{headers:{Accept:"application/sparql-results+json","User-Agent":"1919-Campaign-Research/1.0 (github.com/oguzcobn/baba.)"},signal:AbortSignal.timeout(30000)});
    if(!res.ok)throw Error("HTTP "+res.status);
    rows=(await res.json()).results.bindings;
   }catch(error){if(n===2)console.error(group.join(","),error.message);else await new Promise(r=>setTimeout(r,2000*(n+1)));}
  }
  if(!rows)failed.push(...group);
  else for(const x of rows)entries.push({iso:x.iso.value,qid:x.person.value.split("/").pop(),name:x.personLabel.value,
   role:x.role.value,from:x.start.value,to:x.end?.value??null,country:x.country.value});
 }
 const intervals=[[1919,1935],[1936,1949],[1950,1989],[1990,2014],[2015,2035]];
 const gaps=[],comparisons=[];
 for(const id of ids)for(const [from,to] of intervals){
  const candidates=entries.filter(x=>x.iso===id&&Number(x.from.slice(0,4))<=to&&Number((x.to||x.from).slice(0,4))>=from);
  if(!candidates.length)gaps.push([id,from]);
  const card=history[id][intervals.findIndex(interval=>interval[0]===from)];
  const clean=v=>v.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().trim();
  const named=card.leaders.split(/ \/ |; /).map(v=>clean(v.replace(/\([^)]*\)/g,"")));
  const matches=candidates.filter(x=>named.includes(clean(x.name)));
  comparisons.push({id,eraStart:from,roster:card.leaders,matchedPeople:matches.map(x=>x.qid),
   status:matches.length?"name-and-period-match":candidates.length?"review-names-and-offices":"no-dated-statement"});

 }
 const temp=destination+".tmp";
 await fs.writeFile(temp,JSON.stringify({license:"CC0",date:new Date().toISOString(),failed,gaps,comparisons,entries},null,2));await fs.rename(temp,destination);
 if(failed.length||args.includes("--strict")&&comparisons.some(c=>!c.matchedPeople.length))process.exitCode=1;
}

// Rebuild the six static modules after human review of historical jurisdiction and names.
// --emit DIR [--approved approved.json --candidates wikidata-adaylar.json]
if(args.includes("--emit")){
 const option=name=>{const n=args.indexOf(name);return n<0?undefined:args[n+1];};
 const destination=option("--emit");if(!destination||destination.startsWith("--"))throw Error("Çıktı dizini gerekli.");
 const data=structuredClone(history);
 if(option("--approved")){
  const reviewed=JSON.parse(await fs.readFile(option("--approved"),"utf8"));
  const candidates=JSON.parse(await fs.readFile(option("--candidates"),"utf8")).entries;
  for(const {iso,era,qid,context} of reviewed){
   const ref=candidates.find(c=>c.iso===iso&&c.qid===qid);
   const card=data[iso]?.[era-1],bounds=[[1919,1935],[1936,1949],[1950,1989],[1990,2014],[2015,2035]][era-1];
   if(!ref||!card||!context||!/^Q\d+$/.test(qid)||+ref.from.slice(0,4)>bounds[1]||+(ref.to||ref.from).slice(0,4)<bounds[0])throw Error("Geçersiz onay: "+iso+" "+qid);
   Object.assign(card,{leaders:ref.name,context,source:"Wikidata · "+qid,qid,interval:[ref.from.slice(0,10),ref.to?.slice(0,10)||"açık"]});
  }
 }
 await fs.mkdir(destination,{recursive:true});
 for(const region of ["africa","americas","asia","europe","mena","oceania"]){
  const current=(await import("../data/leaders-"+region+".js"))[region];
  const lines=Object.keys(current).sort().map(id=>JSON.stringify(id)+":"+JSON.stringify(data[id]));
  await fs.writeFile(path.join(destination,"leaders-"+region+".js"),"export const "+region+" = {\n"+lines.join(",\n")+"\n};\n");
 }
}

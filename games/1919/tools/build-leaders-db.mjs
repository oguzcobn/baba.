// Run from any directory with Node 20+. Candidate records require editorial review.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const map=JSON.parse(await readFile(new URL('../../../data/countries-50m.json',import.meta.url)));
const ids=[...new Set(map.objects.countries.geometries.map(g=>String(g.id)).filter(id=>/^\d{3}$/.test(id)))].sort();
const output=new URL('./history-candidates/',import.meta.url);await mkdir(output,{recursive:true});
const missing=[],eras=[[1919,1935],[1936,1949],[1950,1989],[1990,2014],[2015,new Date().getUTCFullYear()]];
for(const iso of ids){
 const file=new URL(iso+'.json',output);let rows;
 try{rows=JSON.parse(await readFile(file));}catch{
 const query=`SELECT DISTINCT ?person ?personLabel ?office ?start ?end ?source WHERE {
 ?territory wdt:P299 "${iso}". ?territory (wdt:P1906|wdt:P1313) ?office.
 ?person p:P39 ?term. ?term ps:P39 ?office; pq:P580 ?start; prov:wasDerivedFrom ?source.
 OPTIONAL {?term pq:P582 ?end} FILTER(!BOUND(?end)||YEAR(?end)>=1919)
 SERVICE wikibase:label {bd:serviceParam wikibase:language "tr,en".} }`;
 const url=new URL('https://query.wikidata.org/sparql');url.searchParams.set('query',query);
 let response;
 for(let attempt=0;attempt<4;attempt++){response=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':'Baba1919HistoricalCatalog/1.0 (github.com/oguzcobn/baba.)'},signal:AbortSignal.timeout(60000)});if(response.status!==429&&response.status!==503)break;await new Promise(done=>setTimeout(done,1000*Math.min(120,Number(response.headers.get('retry-after'))||5*(attempt+1))));}
 if(!response.ok)throw Error(iso+' HTTP '+response.status);
 rows=(await response.json()).results.bindings.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.value])));await writeFile(file,JSON.stringify(rows,null,2));
 }
 for(const [first,last] of eras)if(!rows.some(r=>Number(r.start.slice(0,4))<=last&&Number((r.end||r.start).slice(0,4))>=first))missing.push({iso,first,last});
}
await writeFile(new URL('coverage.json',output),JSON.stringify({territories:ids.length,missing},null,2));console.log(ids.length+' bölge, '+missing.length+' eksik dönem');if(missing.length)process.exitCode=1;

import Geo1919 from "./geo-utils.js";
import COUNTRY_META_1919 from "./country-meta.js";
export async function loadWorld(){
const RAW=[], LINKS=[], N={};
const response=await fetch("../../data/countries-50m.json");if(!response.ok)throw Error("Harita indirilemedi");
const topology=await response.json(),geometries=topology.objects.countries.geometries;
const ids={"792":"tr","826":"gb","250":"fr","300":"gr","643":"ru"};
const shapeData=new Map();
const trNames=new Intl.DisplayNames(["tr-TR"],{type:"region"});
const specialNames={"792":"Türkiye","826":"Birleşik Krallık","643":"Rusya"};
const geomValid=g=>Geo1919.validCountryId(g.id);
const validIds=new Set();
const all=topojson.feature(topology,topology.objects.countries).features;
const features=all.filter(f=>{
 if(!geomValid(f)||validIds.has(f.id))return false;
 validIds.add(f.id);return true;
});
for(const [i,f] of features.entries()){
 const id="c"+f.id,owner=ids[f.id]||id;
 const info=COUNTRY_META_1919[f.id]||["",""];
 const code=info[0],label=specialNames[f.id]||(code?trNames.of(code):null)||f.properties.name;
 const capital=info[1]||label;
 const paths=Geo1919.featurePath(f.geometry);
 const [x,y]=Geo1919.labelPoint(f.geometry);
 const paint="hsl("+((i*137.508)%360)+",26%,43%)";
 N[owner]=[label,"",paint,id,capital,code];RAW.push([id,label,x/10.5,(y-25)/5.7,owner]);shapeData.set(id,{paths,x,y});
}
N.ne=["Tarafsız","","#737b70","","",""];
const neighbours=topojson.neighbors(geometries),routesSeen=new Set();
geometries.forEach((g,i)=>{
 if(!geomValid(g))return;
 neighbours[i].forEach(j=>{
  const other=geometries[j];
  if(!geomValid(other)||other.id===g.id||!validIds.has(other.id))return;
  const a="c"+g.id,b="c"+other.id,key=Geo1919.routeKey(a,b);
  if(!routesSeen.has(key)){routesSeen.add(key);LINKS.push([a,b])}
 });
});
const landRoutes=new Set(LINKS.map(l=>l.slice().sort().join("|")));
const seaRoutes=new Set();
const arcUse=new Map();
const arcIds=g=>g.arcs.flat(Infinity).map(a=>a<0?~a:a);
for(const g of geometries)for(const a of new Set(arcIds(g)))arcUse.set(a,(arcUse.get(a)||0)+1);
const coastal=new Set(geometries.filter(g=>geomValid(g)&&arcIds(g).some(a=>arcUse.get(a)===1)).map(g=>"c"+g.id));
const routeKey=(a,b)=>[a,b].sort().join("|");
// Explicit maritime corridors: never connect countries merely because their centroids are close.
const maritimeCorridors=[
 ["826","250"],["504","724"],["380","300"],["818","682"],
 ["392","410"],["392","156"],["360","036"],["036","554"],
 ["840","192"],["192","332"],["792","196"],["620","076"],
 ["076","024"],["792","422"],["364","682"],["156","158"],
 ["304","352"],["352","826"],["124","304"],["608","704"],
 ["608","360"],["250","012"],["724","012"],["208","578"],
 ["356","144"],["458","360"]
];
const availableCountries=new Set(RAW.map(p=>p[0]));
for(const [a,b] of maritimeCorridors){
 const from="c"+a,to="c"+b,key=routeKey(from,to);
 if(!availableCountries.has(from)||!availableCountries.has(to)||!coastal.has(from)||!coastal.has(to)||landRoutes.has(key)||seaRoutes.has(key))continue;
 seaRoutes.add(key);LINKS.push([from,to]);
}

for(const feature of all){
 const entry=shapeData.get("c"+feature.id);
 if(entry && !features.includes(feature))
    entry.paths+=" "+Geo1919.featurePath(feature.geometry);
}
return {N,RAW,LINKS,shapeData,seaRoutes,coastal};
}

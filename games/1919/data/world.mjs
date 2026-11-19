export async function worldMap(){
  const response=await fetch('../../data/countries-50m.json');
  if(!response.ok) throw Error('Dünya haritası yüklenemedi.');
  const topology=await response.json(), collection=topology.objects.countries;
  const features=topojson.feature(topology,collection).features;
  const neighbours=topojson.neighbors(collection.geometries), usage=new Map();
  for(const g of collection.geometries) for(const a of new Set(g.arcs.flat(Infinity).map(k=>k<0?~k:k))) usage.set(a,(usage.get(a)||0)+1);
  const names=new Intl.DisplayNames(['tr'],{type:'region'}), seen=new Set();
  return features.flatMap((f,i)=>{
    if(!Geo1919.validCountryId(f.id)||seen.has(f.id))return [];
    seen.add(f.id);
    const id=String(f.id), code=COUNTRY_META_1919[id]?.[0], label=code?names.of(code):f.properties.name;
    const [x,y]=Geo1919.labelPoint(f.geometry);
    return [{id,label,x,y,country:label,owner:id,path:Geo1919.featurePath(f.geometry),coastal:collection.geometries[i].arcs.flat(Infinity).some(k=>usage.get(k<0?~k:k)===1),neighbours:neighbours[i].map(j=>String(features[j].id))}];
  });
}

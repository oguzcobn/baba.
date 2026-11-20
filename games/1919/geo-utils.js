"use strict";
/** Geographic helpers for the 2D world map; no DOM or gameplay state. */
const Geo1919 = (() => {
  const ID=/^\d{3}$/;
  const validCountryId=id=>typeof id==="string"&&ID.test(id)&&id!=="010";
  const projected=([lon,lat])=>[(lon+180)*3,(90-lat)*3.6];
  const unwrap=ring=>{
    const out=[];let offset=0,prev=null;
    for(const [lng,lat] of ring){
      let lon=lng+offset;
      if(prev!==null){
        while(lon-prev>180){offset-=360;lon-=360}
        while(lon-prev< -180){offset+=360;lon+=360}
      }
      out.push([lon,lat]);prev=lon;
    }
    return out;
  };
  // Polygon clipping rather than a naked moveTo: each dateline fragment remains
  // separately CLOSED. This avoids Russia/Pacific strips caused by SVG fill.
  function clipSide(ring,limit,keepGreater){
    const inside=p=>keepGreater?p[0]>=limit-1e-8:p[0]<=limit+1e-8;
    const result=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],ia=inside(a),ib=inside(b);
      if(ia)result.push(a);
      if(ia!==ib){
        const t=(limit-a[0])/(b[0]-a[0]);
        result.push([limit,a[1]+(b[1]-a[1])*t]);
      }
    }
    return result;
  }
  function fragments(ring){
    if(!ring?.length)return [];
    const points=unwrap(ring);
    const min=Math.min(...points.map(p=>p[0])),max=Math.max(...points.map(p=>p[0]));
    const out=[];
    for(let k=Math.floor((min+180)/360);k<=Math.floor((max+180)/360);k++){
      const lower=360*k-180,upper=360*k+180;
      let clipped=clipSide(points,lower,true);
      if(clipped.length<3)continue;
      clipped=clipSide(clipped,upper,false);
      if(clipped.length<3)continue;
      // Reject degenerate polygons on the seam.
      const shifted=clipped.map(([x,y])=>[Math.max(-180,Math.min(180,x-360*k)),y]);
      if(area(shifted)<1e-7)continue;
      out.push(shifted);
    }
    return out;
  }
  function area(p){
    let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return Math.abs(a)/2;
  }
  const projectedPolygons=geometry=>{
    const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
    return polygons.flatMap(poly=>poly.flatMap(fragments));
  };
  function featurePath(geometry){
    return projectedPolygons(geometry).map(ring=>{
      return ring.map((p,i)=>(i?"L":"M")+projected(p).map(n=>n.toFixed(2)).join(" ")).join("")+"Z";
    }).join("");
  }
  function labelPoint(geometry){
    const rings=projectedPolygons(geometry).sort((a,b)=>area(b)-area(a));
    const best=rings[0];if(!best?.length)return [540,325];
    const p=best.map(projected);
    return [p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
  }
  const routeKey=(a,b)=>[a,b].sort().join("|");
  function nearForVisual(a,b,max=240){
    const dx=Math.abs(a.x-b.x),dy=a.y-b.y;
    return Math.hypot(Math.min(dx,1080-dx),dy)<=max;
  }
  return {validCountryId,featurePath,labelPoint,projectedPolygons,routeKey,nearForVisual,fragments};
})();

export default Geo1919;

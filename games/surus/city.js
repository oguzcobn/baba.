import {buildingLots} from './lots.js';
// One road graph supplies both visible pavement and tyre surface queries.
export function buildCity(pose,length) {
  const segments=[];
  function road(a,b,width,city) {
    const dx=b.x-a.x,dy=b.y-a.y;
    const squared=dx*dx+dy*dy;
    if (squared>.01) segments.push({a,b,dx,dy,squared,width,city});
  }
  for(let d=0;d<length;d+=8) road(pose(d),pose(Math.min(length,d+8)),3.7,false);
  for(let d=90;d<length-150;d+=180) {
    road(pose(d,0),pose(d,-220),4.3,true);
    for(const side of [-70,-145,-215]) {
      for(let i=0;i<180;i+=6) road(pose(d+i,side),pose(d+i+6,side),4,true);
    }
  }
  const cells=new Map(), cellSize=30;
  for(const edge of segments) {
    const {a,b,width}=edge;
    for(let x=Math.floor((Math.min(a.x,b.x)-width)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+width)/cellSize);x++)
      for(let y=Math.floor((Math.min(a.y,b.y)-width)/cellSize);y<=Math.floor((Math.max(a.y,b.y)+width)/cellSize);y++){
        const key=x+','+y;
        if(!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(edge);
      }
  }
  function paved(x,y) {
    const nearby=cells.get(Math.floor(x/cellSize)+','+Math.floor(y/cellSize))||[];
    return nearby.some(e=>{
      const t=Math.min(1,Math.max(0,((x-e.a.x)*e.dx+(y-e.a.y)*e.dy)/e.squared));
      return Math.hypot(x-e.a.x-t*e.dx,y-e.a.y-t*e.dy)<=e.width;
    });
  }
  return {segments,paved,buildings:buildingLots(pose,length,segments)};
}

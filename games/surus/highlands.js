// Local coordinates: u heads inland from the signed junction, v runs along the shore.
export function countryside(pose,length){
  const start=pose(90),tip=pose(90,-220);
  const dx=tip.x-start.x,dy=tip.y-start.y,n=Math.hypot(dx,dy),ix=dx/n,iy=dy/n;
  const world=(u,v)=>({x:start.x+ix*u+iy*v,y:start.y+iy*u-ix*v});
  const local=(x,y)=>({u:(x-start.x)*ix+(y-start.y)*iy,v:(x-start.x)*iy-(y-start.y)*ix});
  function height(x,y){
    const {u,v}=local(x,y);
    const ramp=Math.max(0,Math.min(1,(u-410)/570));
    const edge=Math.max(0,Math.min(1,(435-Math.abs(v))/125));
    return edge*ramp*ramp*(3-2*ramp)*(82+9*Math.sin(v/75))*Math.max(0,Math.min(1,(1300-u)/210));
  }
  const path=[];
  for(let u=220;u<=1010;u+=3){
    const t=Math.max(0,(u-395)/615);
    path.push(world(u,t?Math.sin(t*Math.PI*4.1)*Math.min(1,t*5)*103:0));
  }
  const shore=[];
  for(let d=0;d<length;d+=5)shore.push(pose(d,42));
  shore.push(pose(length,42));
  const first=shore[0],last=shore.at(-1),sx=last.x-first.x,sy=last.y-first.y,span=Math.hypot(sx,sy);
  // Extend the end caps beyond the spawn and the last playable junction.
  shore.unshift({x:first.x-sx/span*80,y:first.y-sy/span*80});
  shore.push({x:last.x+sx/span*80,y:last.y+sy/span*80});
  const end=shore.at(-1),begin=shore[0];
  shore.push({x:end.x-sy/span*4200,y:end.y+sx/span*4200},{x:begin.x-sy/span*4200,y:begin.y+sx/span*4200});
  // Bucket edges by northing for repeated footprint checks on physics substeps.
  const rows=new Map();
  shore.forEach((a,i)=>{
    const b=shore[(i+1)%shore.length];
    for(let row=Math.floor(Math.min(a.y,b.y)/32);row<=Math.floor(Math.max(a.y,b.y)/32);row++){
      if(!rows.has(row))rows.set(row,[]);
      rows.get(row).push([a,b]);
    }
  });
  function dry(x,y){
    let inside=false;
    for(const [a,b] of rows.get(Math.floor(y/32))||[]){
      if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function fits(car){
    const s=Math.sin(car.angle),c=Math.cos(car.angle);
    return [-2.26,2.26].every(z=>[-.91,.91].every(w=>dry(car.x+s*z+c*w,car.y+c*z-s*w)));
  }
  return {world,local,height,path,shore,fits,dry};
}

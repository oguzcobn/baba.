export const widths=[8.6,11.6,10.2],depths=[10,13,11];
export function buildingLots(pose,length,segments){
  const blocks=[];
  for(let theme=0;theme<3;theme++){
    const w=widths[theme],dep=depths[theme];
    for(let i=0,distance=18;distance<length-16;i++,distance+=24){
      for(const [j,side] of [-25,-105,-178].entries()){
        if((i+j)%3!==theme)continue;
        const p=pose(distance,side),radius=Math.hypot(w/2+1.6,dep/2+1);
        if(segments.some(s=>{
          const t=Math.min(1,Math.max(0,((p.x-s.a.x)*s.dx+(p.y-s.a.y)*s.dy)/s.squared));
          return Math.hypot(p.x-s.a.x-t*s.dx,p.y-s.a.y-t*s.dy)<radius+s.width+1;
        }))continue;
        if(blocks.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<radius+q.radius))continue;
        blocks.push({...p,radius,width:w,depth:dep,theme});
      }
    }
  }
  return blocks;
}

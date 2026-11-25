// Separating-axis contact between the car footprint and the actual oriented wall footprint.
export function collideBuildings(car,lots){
  const c=Math.cos(car.angle),s=Math.sin(car.angle);
  const right=[c,-s],forward=[s,c];
  for(const lot of lots){
    const dx=car.x-lot.x,dy=car.y-lot.y;
    if(dx*dx+dy*dy>(lot.radius+2.6)**2)continue;
    const bc=Math.cos(lot.heading),bs=Math.sin(lot.heading);
    const axes=[right,forward,[bc,-bs],[bs,bc]];
    let penetration=Infinity,nx=0,ny=0;
    for(const [ax,ay] of axes){
      const dist=dx*ax+dy*ay;
      const r=.90*Math.abs(ax*c-ay*s)+2.26*Math.abs(ax*s+ay*c);
      const b=lot.width*.5*Math.abs(ax*bc-ay*bs)+lot.depth*.5*Math.abs(ax*bs+ay*bc);
      const overlap=r+b-Math.abs(dist);
      if(overlap<=0){penetration=0;break;}
      if(overlap<penetration){penetration=overlap;const sign=dist<0?-1:1;nx=ax*sign;ny=ay*sign;}
    }
    if(!penetration)continue;
    car.x+=nx*(penetration+.001);car.y+=ny*(penetration+.001);
    const normalForward=s*nx+c*ny,normalRight=c*nx-s*ny;
    const approach=car.speed*normalForward+car.lateral*normalRight;
    if(approach<0){
      car.speed-=approach*normalForward;car.lateral-=approach*normalRight;
      if(Math.abs(car.speed)<.04)car.speed=0;
    }
    car.yawRate*=.6;
  }
}

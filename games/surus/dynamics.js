// SI units. Bicycle model in the road-aligned frame; positive lateral is right.
const mass=1670, gravity=9.81, wheelbase=2.72, frontArm=1.28, rearArm=wheelbase-frontArm;
const radius=.315, ratios=[3.59,2.19,1.41,1,.83], differential=3.07;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const fresh=()=>({x:0,y:0,distance:0,offset:1.5,speed:0,lateral:0,yawRate:0,angle:0,steer:0,
  gear:0,rpm:850,shiftTime:0,accel:0,roll:0,pitch:0,rollRate:0,pitchRate:0,spin:0});

function lateralForce(slip, stiffness, capacity, longitudinal) {
  const remaining=Math.sqrt(Math.max(1,capacity**2-longitudinal**2));
  return remaining*Math.tanh(stiffness*slip/remaining);
}
export function advance(s,gas,brake,steer,grip,dt,paved=true) {
  const u=s.speed;
  // Outer front tyre path for a 10.76 m curb-to-curb circle.
  const lock=Math.atan(wheelbase/(Math.sqrt(5.38**2-wheelbase**2)-.79));
  const target=steer*Math.min(lock,Math.atan(wheelbase*grip*gravity*1.45/Math.max(1,u*u)));
  s.steer+=clamp(target-s.steer,-2.35*dt,2.35*dt);
  if (u<0 || (u===0 && brake && !gas)) {
    s.speed=clamp(u+dt*(gas?6:brake?-2.3:1.15),-5,0);
    s.yawRate=s.speed*Math.tan(s.steer)/wheelbase;
    s.lateral=0;s.angle+=dt*s.yawRate;s.x+=dt*s.speed*Math.sin(s.angle);s.y+=dt*s.speed*Math.cos(s.angle);
    s.spin+=dt*s.speed/radius;s.distance+=dt*Math.abs(s.speed);
    s.gear=0;s.rpm=850+Math.abs(s.speed)*240;s.accel=0;s.roll*=Math.exp(-8*dt);s.pitch*=Math.exp(-8*dt);
    return;
  }
  const wheelRpm=u/radius*60/(2*Math.PI);
  const shaft=wheelRpm*differential;
  s.shiftTime=Math.max(0,s.shiftTime-dt);
  if (!s.shiftTime) {
    const old=s.gear;
    if (shaft*ratios[old]>5550 && old<4) s.gear++;
    else if (old>0 && shaft*ratios[old]<1750) s.gear--;
    if (old!==s.gear) s.shiftTime=.28;
  }
  s.rpm=Math.max(gas?1450:850,shaft*ratios[s.gear]);
  const torque=clamp(450-.000018*(s.rpm-4400)**2,160,450);
  const frontLoad=clamp((mass*gravity*rearArm-mass*.53*s.accel)/wheelbase,mass*gravity*.22,mass*gravity*.84);
  const frontGrip=grip*frontLoad, rearGrip=grip*(mass*gravity-frontLoad);
  const drive=gas&&!s.shiftTime&&s.rpm<6400?torque*ratios[s.gear]*differential*.85/radius:0;
  const frontX=-Math.min(brake*mass*8.5*.66,frontGrip);
  const rearX=clamp(drive-brake*mass*8.5*.34,-rearGrip,rearGrip);
  const frontY=lateralForce(s.steer-Math.atan2(s.lateral+frontArm*s.yawRate,Math.max(u,2)),61500,frontGrip,frontX);
  const rearY=lateralForce(-Math.atan2(s.lateral-rearArm*s.yawRate,Math.max(u,2)),66000,rearGrip,rearX);
  const frontBodyY=frontY*Math.cos(s.steer)+frontX*Math.sin(s.steer);
  const ay=(frontBodyY+rearY)/mass;
  s.accel=(frontX*Math.cos(s.steer)-frontY*Math.sin(s.steer)+rearX-.5*1.225*.82*u*u)/mass
    -(u>.01||drive ? (paved?.014:.064)*gravity:0);
  s.speed=Math.max(0,u+dt*(s.accel+s.lateral*s.yawRate));
  if (u<2) {
    s.yawRate=s.speed*Math.tan(s.steer)/wheelbase;
    s.lateral=rearArm*s.yawRate;
  } else {
    s.lateral+=dt*(ay-u*s.yawRate);
    s.yawRate+=dt*(frontArm*frontBodyY-rearArm*rearY)/2450;
    // Stability control limits excessive sideslip and yaw overshoot.
    const yawLimit=grip*gravity/Math.max(2,u);
    const neutral=clamp(u*Math.tan(s.steer)/wheelbase,-yawLimit,yawLimit);
    s.yawRate+=(neutral-s.yawRate)*(1-Math.exp(-3*dt));
    s.lateral*=Math.exp(-2.6*dt);
  }
  s.angle+=dt*s.yawRate;
  s.x+=dt*(s.speed*Math.sin(s.angle)+s.lateral*Math.cos(s.angle));
  s.y+=dt*(s.speed*Math.cos(s.angle)-s.lateral*Math.sin(s.angle));
  s.distance+=dt*Math.hypot(s.speed,s.lateral);
  const bodyAy=u<2 ? u*s.yawRate : ay;
  s.rollRate+=dt*(90*(clamp(bodyAy*.009,-.11,.11)-s.roll)-13*s.rollRate);
  s.pitchRate+=dt*(105*(clamp(s.accel*.005,-.055,.055)-s.pitch)-14*s.pitchRate);
  s.roll+=dt*s.rollRate; s.pitch+=dt*s.pitchRate; s.spin+=s.speed*dt/radius;
}

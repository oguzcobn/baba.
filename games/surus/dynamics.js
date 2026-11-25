// SI units. Bicycle model in the road-aligned frame; positive lateral is right.
const mass=1135, gravity=9.81, wheelbase=2.49, frontArm=1.13, rearArm=wheelbase-frontArm;
const radius=.305, ratios=[3.67,2.10,1.36,1,.84], differential=3.9;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const fresh=()=>({distance:0,offset:1.5,speed:0,lateral:0,yawRate:0,angle:0,steer:0,
  gear:0,rpm:850,shiftTime:0,accel:0,roll:0,pitch:0,rollRate:0,pitchRate:0,spin:0});

function lateralForce(slip, stiffness, capacity, longitudinal) {
  const remaining=Math.sqrt(Math.max(1,capacity**2-longitudinal**2));
  return remaining*Math.tanh(stiffness*slip/remaining);
}
export function advance(s,gas,brake,steer,curvature,dt) {
  const u=s.speed;
  const target=steer*.55/(1+.005*u*u);
  s.steer+=clamp(target-s.steer,-1.35*dt,1.35*dt);
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
  const torque=clamp(132-.0000037*(s.rpm-2900)**2,55,132);
  const frontLoad=clamp((mass*gravity*rearArm-mass*.53*s.accel)/wheelbase,mass*gravity*.22,mass*gravity*.84);
  const frontGrip=.88*frontLoad, rearGrip=.88*(mass*gravity-frontLoad);
  const drive=gas&&!s.shiftTime&&s.rpm<6400?torque*ratios[s.gear]*differential*.85/radius:0;
  const frontX=-Math.min(brake*mass*8.5*.66,frontGrip);
  const rearX=clamp(drive-brake*mass*8.5*.34,-rearGrip,rearGrip);
  const frontY=lateralForce(s.steer-Math.atan2(s.lateral+frontArm*s.yawRate,Math.max(u,2)),61500,frontGrip,frontX);
  const rearY=lateralForce(-Math.atan2(s.lateral-rearArm*s.yawRate,Math.max(u,2)),66000,rearGrip,rearX);
  const frontBodyY=frontY*Math.cos(s.steer)+frontX*Math.sin(s.steer);
  const ay=(frontBodyY+rearY)/mass;
  s.accel=(frontX*Math.cos(s.steer)-frontY*Math.sin(s.steer)+rearX-.5*1.225*.82*u*u)/mass
    -(u>.01||drive ? .014*gravity:0);
  s.speed=Math.max(0,u+dt*(s.accel+s.lateral*s.yawRate));
  if (u<2) {
    s.yawRate=s.speed*Math.tan(s.steer)/wheelbase;
    s.lateral=rearArm*s.yawRate;
  } else {
    s.lateral+=dt*(ay-u*s.yawRate);
    s.yawRate+=dt*(frontArm*frontBodyY-rearArm*rearY)/1520;
  }
  const progress=(s.speed*Math.cos(s.angle)-s.lateral*Math.sin(s.angle))/Math.max(.5,1-curvature*s.offset);
  s.angle+=dt*(s.yawRate-curvature*progress);
  s.distance=Math.max(0,s.distance+dt*progress);
  s.offset+=dt*(s.speed*Math.sin(s.angle)+s.lateral*Math.cos(s.angle));
  if (Math.abs(s.offset)>3.05) {
    s.offset=clamp(s.offset,-3.05,3.05);
    s.angle*=Math.exp(-6*dt); s.lateral*=Math.exp(-6*dt); s.speed*=Math.exp(-.35*dt);
  }
  const bodyAy=u<2 ? u*s.yawRate : ay;
  s.rollRate+=dt*(90*(clamp(bodyAy*.009,-.11,.11)-s.roll)-13*s.rollRate);
  s.pitchRate+=dt*(105*(clamp(s.accel*.005,-.055,.055)-s.pitch)-14*s.pitchRate);
  s.roll+=dt*s.rollRate; s.pitch+=dt*s.pitchRate; s.spin+=s.speed*dt/radius;
}

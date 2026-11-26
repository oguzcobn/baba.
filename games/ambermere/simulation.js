// SI units. Effective rod and line compliance modeled as a single tension-only spring.
function rigModel(cm,depth,range){
 const L=cm/100,m=1030*.44*L*(L*depth/95)*(L*.15);
 return {L,m,range,r:range,line:range,v:0,tension:0,clock:0,energy:1,beat:0,
  slip:false,reeling:true,z:0,vz:0,limit:1.4+1.7*m,stiff:7+2*m};
}
function stepFloat(s,time,bite,dt){
 const area=.00032,m=.008,water=.0025*Math.sin(time*2.7),volume=area*Math.max(0,Math.min(.07,.025+s.z-water));
 const pull=bite?.065*(.68+.32*Math.sin(time*6)):0;
 s.vz+=(m*9.81+pull-1000*9.81*volume-.12*s.vz)/m*dt;s.z+=s.vz*dt;
}
function stepFight(s,dt){
 s.clock+=dt;let burst=Math.pow(Math.max(0,Math.cos(s.clock*1.17)),4)*s.energy;
 let thrust=s.limit*(.20+1.12*burst)*(.45+.55*s.energy);
 let tension=Math.max(0,s.stiff*(s.r-s.line)+.28*s.v);
 s.slip=tension>s.limit;
 if(s.slip)s.line+=(tension-s.limit)/s.stiff;
 else if(s.reeling)s.line=Math.max(.15,s.line-(1.28-.4*tension/s.limit)*dt);
 s.tension=Math.min(tension,s.limit);
 const drag=.5*1000*.65*(.037*s.L*s.L)*s.v*Math.abs(s.v);
 s.v+=(thrust-s.tension-drag)/Math.max(.15,s.m*1.25)*dt;
 s.r=Math.max(.15,s.r+s.v*dt);
 s.energy=Math.max(.12,s.energy-(.016+.06*burst)*dt);
 let speed=Math.abs(s.v)+.35*s.L+burst*s.L;
 s.beat+=2*Math.PI*Math.min(8,.3*speed/(.2*s.L))*dt;
}

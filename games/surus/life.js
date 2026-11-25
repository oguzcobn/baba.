import * as T from '../../js/vendor/three.module.min.js';

const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const links=[[0,1],[1,2],[1,3],[3,4],[1,5],[5,6],[0,7],[7,8],[0,9],[9,10]];
const up=vec(0,1,0);
function skeleton(phase,role){
  const stride=role==='walk'?Math.sin(phase):0;
  const pts=[vec(0,.89,0),vec(0,1.39,0),vec(0,1.65,0)];
  for(const side of [-1,1]){
    const swing=role==='swim'?Math.sin(phase+side*1.57):side*stride;
    pts.push(vec(side*.23,1.16,-swing*.16),vec(side*.21,role==='fish'?1.18:.97,-.08-swing*.27-(role==='fish'?.30:0)));
  }
  for(const side of [-1,1])pts.push(vec(side*.11,.48,side*stride*.17+.055),vec(side*.12,.10+Math.max(0,side*stride)*.08,side*stride*.33));
  return pts;
}
export function startFall(points,velocity){
  const dt=1/90;
  const pairs=[...links,[3,5],[7,9],[0,2],[3,7],[5,9]];
  return {points:points.map(p=>p.clone()),previous:points.map((p,i)=>p.clone().addScaledVector(velocity,-dt*(.48+.32*p.y)).addScaledVector(up,-dt*(i===2?.85:.25))),
    joints:pairs.map(([a,b])=>[a,b,points[a].distanceTo(points[b])]),age:0,remainder:0};
}
export function stepFall(f,elapsed){
  f.age+=elapsed;f.remainder+=elapsed;
  const delta=vec();
  while(f.remainder>=1/90){
    f.remainder-=1/90;
    f.points.forEach((p,i)=>{const prev=f.previous[i];delta.subVectors(p,prev).multiplyScalar(p.y<=.121?.78:.994);prev.copy(p);p.add(delta);p.y-=9.81/8100;});
    for(let iteration=0;iteration<6;iteration++){
      for(const [a,b,length] of f.joints){
        delta.subVectors(f.points[b],f.points[a]);const dist=delta.length();
        delta.multiplyScalar(.5*(dist-length)/Math.max(dist,.0001));
        f.points[a].add(delta);f.points[b].sub(delta);
      }
      for(const p of f.points)p.y=Math.max(.12,p.y);
    }
  }
}
export function coastalLife(scene,pose,length){
  const actors=[],boats=[];
  for(let d=18,i=0;d<length-65;d+=53,i++){
    actors.push({d,role:'walk',side:[5.6,-5.7,-64,-139][i%4],i});
    if(i%3===0)actors.push({d,role:'swim',side:49+i%8,i});
    if(i%5===0)actors.push({d,role:'fish',side:41,i});
  }
  const shape=new T.SphereGeometry(1,10,8),mat=new T.MeshStandardMaterial({roughness:.79});
  const parts=new T.InstancedMesh(shape,mat,actors.length*12);
  parts.frustumCulled=false;parts.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(parts);
  const dummy=new T.Object3D(),axis=vec(),color=new T.Color();
  function piece(i,a,b,width,depth,tint){
    axis.subVectors(b,a);const h=axis.length();
    dummy.position.copy(a).lerp(b,.5);dummy.quaternion.setFromUnitVectors(up,axis.normalize());
    dummy.scale.set(width,Math.max(.02,h*.57),depth);dummy.updateMatrix();
    parts.setMatrixAt(i,dummy.matrix);parts.setColorAt(i,color.set(tint));
  }
  const rods=[],rodGeo=new T.BufferGeometry();
  const rodPositions=new Float32Array(actors.length*12);
  rodGeo.setAttribute('position',new T.BufferAttribute(rodPositions,3));
  const lines=new T.LineSegments(rodGeo,new T.LineBasicMaterial({color:0x413d34}));
  lines.frustumCulled=false;scene.add(lines);
  const hullGeometry=new T.LatheGeometry([new T.Vector2(.05,0),new T.Vector2(.7,.25),new T.Vector2(1,.8),new T.Vector2(.79,.83)],16);
  const hull=new T.MeshStandardMaterial({color:0x375b70,side:T.DoubleSide});
  const deck=new T.MeshStandardMaterial({color:0xf2e7d0});
  for(let d=42;d<length-40;d+=180){
    const boat=new T.Group(),base=new T.Mesh(hullGeometry,hull);
    base.scale.set(1.15,1,3.1);boat.add(base);
    const cabin=new T.Mesh(new T.BoxGeometry(1.35,.86,2.05),deck);cabin.position.y=.89;boat.add(cabin);
    const glass=new T.Mesh(new T.BoxGeometry(1.39,.32,1.72),new T.MeshStandardMaterial({color:0x456776}));
    glass.position.y=1.03;boat.add(glass);scene.add(boat);boats.push({d,boat});
  }
  let last=performance.now()/1000,time=0,lastCar=null;
  return car=>{
    const now=performance.now()/1000,dt=Math.min(.09,now-last);last=now;time+=dt;
    const carPos=vec(car.x,0,-car.y),forward=vec(Math.sin(car.angle),0,-Math.cos(car.angle));
    const previous=lastCar&&lastCar.distanceTo(carPos)<12?lastCar:carPos;
    const sweep=carPos.clone().sub(previous),sweepSq=sweep.lengthSq();
    let count=0;rods.length=0;
    for(const actor of actors){
      const {role,i}=actor;
      const walking=role==='walk',u=(time*.95+i*3)%36;
      const d=actor.d+(walking?18-Math.abs(u-18):role==='swim'?Math.sin(time*.12+i)*2:0);
      const loc=pose(d,actor.side);
      if(!actor.fall&&Math.hypot(loc.x-car.x,loc.y-car.y)>165)continue;
      const cy=role==='swim'?-.40:role==='fish'?-.20:0;
      const root=vec(loc.x,cy,-loc.y),heading=role==='fish'?Math.PI/2-loc.heading:-loc.heading+(u<18?0:Math.PI);
      let pts=skeleton(time*(walking?4:2.4)+i,role);
      for(const v of pts){
        if(role==='swim'){v.y-=1.4;v.applyAxisAngle(vec(1,0,0),-1.08);v.y-=.10;}
        v.applyAxisAngle(up,heading).add(root);
      }
      if(walking&&!actor.fall&&Math.abs(car.speed)>1.25){
        const t=sweepSq?Math.min(1,Math.max(0,root.clone().sub(previous).dot(sweep)/sweepSq)):0;
        const relative=root.clone().sub(previous.clone().addScaledVector(sweep,t));
        if(Math.abs(relative.dot(forward))<2.45&&Math.abs(relative.x*forward.z-relative.z*forward.x)<1.05)
          actor.fall=startFall(pts,forward.clone().multiplyScalar(Math.max(-9,Math.min(13,car.speed))));
      }
      if(actor.fall){
        stepFall(actor.fall,dt);pts=actor.fall.points;
        if(actor.fall.age>12&&root.distanceTo(carPos)>28)actor.fall=null;
      }
      const shirt=[0x3d8290,0xbc704f,0xd4a84b,0x706188][i%4],skin=0xc28d70;
      for(const [j,[a,b]] of links.entries()){
        const width=j===0?.20:j===1?.088:j<6?.065:.082;
        piece(count++,pts[a],pts[b],width,j===0?.115:width,j===0||j===2||j===4?shirt:j>=6?0x374555:skin);
      }
      piece(count++,pts[2].clone().addScaledVector(up,-.10),pts[2].clone().addScaledVector(up,.13),.115,.107,skin);
      if(role==='fish'){
        const tip=pts[6].clone().add(vec(1.5*Math.cos(loc.heading),1.42,1.5*Math.sin(loc.heading)));
        rods.push(...pts[6].toArray(),...tip.toArray(),...tip.toArray(),tip.x+2*Math.cos(loc.heading),-.38,tip.z+2*Math.sin(loc.heading));
      }
    }
    lastCar=carPos;parts.count=count;parts.instanceMatrix.needsUpdate=true;
    if(parts.instanceColor)parts.instanceColor.needsUpdate=true;
    rodPositions.set(rods);rodGeo.attributes.position.needsUpdate=true;rodGeo.setDrawRange(0,rods.length/3);
    for(const {d,boat} of boats){
      const p=pose(d+9*Math.sin(time*.045+d),65+9*Math.sin(d));
      boat.position.set(p.x,-.59+.08*Math.sin(time*1.4+d),-p.y);
      boat.rotation.set(.025*Math.sin(time+d),-p.heading,.046*Math.sin(time*1.3+d));
    }
  };
}

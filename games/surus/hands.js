import * as T from '../../js/vendor/three.module.min.js';
export function steeringRig(body){
  const skin=new T.MeshStandardMaterial({color:0xb58161}),cloth=new T.MeshStandardMaterial({color:0x344958}),leather=new T.MeshStandardMaterial({color:0x26282a});
  const column=new T.Group();column.position.set(-.35,.91,-.43);column.rotation.x=-.26;body.add(column);
  const wheel=new T.Group();column.add(wheel);
  const rim=new T.Mesh(new T.TorusGeometry(.175,.016,12,56),leather);wheel.add(rim);
  const hub=new T.Mesh(new T.BoxGeometry(.29,.07,.045),leather);wheel.add(hub);
  const v=new T.Vector3(),axis=new T.Vector3(0,1,0);
  const arms=[-1,1].map(side=>{
    const hand=new T.Mesh(new T.SphereGeometry(1,12,10),skin);
    hand.scale.set(.041,.048,.033);wheel.add(hand);hand.position.set(side*.173,.017,.017);
    for(let i=0;i<4;i++){
      const finger=new T.Mesh(new T.CapsuleGeometry(.008,.021,3,6),skin);
      finger.position.set(side*.161,.042-i*.015,.037);finger.rotation.z=1.2*side;wheel.add(finger);
    }
    const segments=[cloth,skin].map(mat=>{const m=new T.Mesh(new T.CylinderGeometry(.035,.043,1,10),mat);body.add(m);return m;});
    return {side,hand,segments};
  });
  // Two-link elbow solution in driver space. Grip endpoints rotate with the rim.
  return angle=>{
    wheel.rotation.z=-angle*3.8;wheel.updateMatrix();column.updateMatrix();
    for(const {side,hand,segments} of arms){
      const wrist=hand.position.clone().applyMatrix4(wheel.matrix).applyMatrix4(column.matrix);
      const shoulder=new T.Vector3(-.35+side*.19,.99,-.016);
      const dir=wrist.clone().sub(shoulder),span=dir.length();dir.normalize();
      const bend=new T.Vector3(side*.32,-1,.18);bend.addScaledVector(dir,-bend.dot(dir)).normalize();
      const elbow=shoulder.clone().lerp(wrist,.5).addScaledVector(bend,Math.sqrt(Math.max(.001,.29**2-(span/2)**2)));
      const points=[shoulder,elbow,wrist];
      segments.forEach((m,i)=>{v.subVectors(points[i+1],points[i]);m.scale.y=v.length();m.quaternion.setFromUnitVectors(axis,v.normalize());m.position.copy(points[i]).lerp(points[i+1],.5);});
    }
  };
}

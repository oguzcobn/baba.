import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';

// Both distances use textured triangle meshes. Reuse posed low-detail geometry
// across the crowd so distant units do not each require a live skeleton.
export function createPeople(scene){
 const rules=window.ModernPeople,loader=new GLTFLoader();
 const position=new T.Vector3(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0);
 const size=new T.Vector3(),matrix=new T.Matrix4(),vertex=new T.Vector3();
 const crateGeometry=new T.BoxGeometry(.37,.26,.28),crateMaterial=new T.MeshStandardMaterial({color:0x927447,roughness:.88});
 let nearCount=0,crowdCount=0;
 const models=rules.names.map(name=>({name,high:null,low:null,pool:[],used:0,poses:new Map()}));
 async function load(){
  await Promise.all(models.map(async m=>{
   [m.high,m.low]=await Promise.all([m.name,m.name+'-lod'].map(n=>loader.loadAsync(rules.url(n,'glb'))));
   m.mixer=new T.AnimationMixer(m.low.scene);
   m.clips=rules.actions.map(name=>m.mixer.clipAction(m.low.animations.find(c=>c.name===name)));
  }))
 }
 function live(m){
  const root=clone(m.high.scene),mixer=new T.AnimationMixer(root);
  const actions=rules.actions.map(name=>mixer.clipAction(m.high.animations.find(c=>c.name===name)));
  const crate=new T.Mesh(crateGeometry,crateMaterial);crate.position.set(0,1.04,.27);root.add(crate);
  root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.frustumCulled=false}});
  scene.add(root);return {root,mixer,actions,crate,last:-1}
 }
 function cachePose(m,a,frame){
  const key=a*8+frame;
  if(m.poses.has(key))return m.poses.get(key);
  m.mixer.stopAllAction();const action=m.clips[a];action.reset().play();
  action.time=frame/8*action.getClip().duration;m.mixer.update(0);m.low.scene.updateMatrixWorld(true);
  const parts=[];
  m.low.scene.traverse(o=>{
   if(!o.isSkinnedMesh)return;
   const geometry=o.geometry.clone(),attr=geometry.attributes.position;
   for(let i=0;i<attr.count;i++){
    o.getVertexPosition(i,vertex);vertex.applyMatrix4(o.matrixWorld);attr.setXYZ(i,vertex.x,vertex.y,vertex.z)
   }
   geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();geometry.computeBoundingSphere();
   parts.push({geometry,material:o.material,mesh:null})
  });
  if(a===3||a===4)parts.push({geometry:crateGeometry.clone().translate(0,1.04,.27),material:crateMaterial,mesh:null});
  const pose={parts,count:0};m.poses.set(key,pose);return pose
 }
 function append(part,index){
  let mesh=part.mesh;
  if(!mesh||index===mesh.instanceMatrix.count){
   const next=new T.InstancedMesh(part.geometry,part.material,mesh?mesh.instanceMatrix.count*2:16);
   next.castShadow=true;next.frustumCulled=false;next.instanceMatrix.setUsage(T.DynamicDrawUsage);
   if(mesh){next.instanceMatrix.array.set(mesh.instanceMatrix.array);scene.remove(mesh);mesh.dispose()}
   scene.add(next);part.mesh=mesh=next
  }
  mesh.setMatrixAt(index,matrix)
 }
 function begin(){nearCount=0;crowdCount=0;for(const m of models){m.used=0;for(const p of m.poses.values())p.count=0}}
const tiltAxis=new T.Vector3(1,0,0),tilt=new T.Quaternion();
 function add(u,time,close){
  const m=models[rules.variant(u)],a=rules.pose(u),f=rules.phase(u,time,a),s=rules.scale(u),yaw=Math.PI/2-(u.angle||0);
  const fall=Math.min(1,(u.fall||0)/.72),tiltAngle=1.51*fall*fall*(3-2*fall);
  if(close&&nearCount<24){
   const i=m.used++,n=m.pool[i]||(m.pool[i]=live(m));
   if(n.last!==a){if(n.last>=0)n.actions[n.last].stop();n.actions[a].reset().play();n.last=a}
   n.actions[a].time=n.actions[a].getClip().duration*f;n.mixer.update(0);
   n.crate.visible=a===3||a===4;n.root.position.set(u.x,0,u.y);n.root.rotation.set(tiltAngle,yaw,0,'YXZ');n.root.position.y=.14*fall;n.root.scale.setScalar(s);n.root.visible=true;nearCount++;return
  }
  const pose=cachePose(m,a,Math.floor(f*8));position.set(u.x,0,u.y);size.setScalar(s);rotation.setFromAxisAngle(up,yaw).multiply(tilt.setFromAxisAngle(tiltAxis,tiltAngle));position.y=.14*fall;matrix.compose(position,rotation,size);
  for(const part of pose.parts)append(part,pose.count);
  pose.count++;crowdCount++
 }
 function end(metrics){
  for(const m of models){
   for(let i=m.used;i<m.pool.length;i++)m.pool[i].root.visible=false;
   for(const pose of m.poses.values())for(const part of pose.parts){const mesh=part.mesh;if(mesh){mesh.visible=pose.count>0;mesh.count=pose.count;mesh.instanceMatrix.needsUpdate=true}}
  }
  metrics.skinnedPeople=nearCount;metrics.crowdPeople=crowdCount
 }
 function dispose(){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const m of models){
   for(const n of m.pool){n.mixer.stopAllAction();n.mixer.uncacheRoot(n.root);scene.remove(n.root);n.root.traverse(o=>o.skeleton?.dispose())}
   for(const p of m.poses.values())for(const part of p.parts){if(part.mesh){scene.remove(part.mesh);part.mesh.dispose()}geometries.add(part.geometry)}
   for(const asset of [m.high,m.low])asset?.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);if(o.material.map)textures.add(o.material.map)}})
  }
  geometries.add(crateGeometry);materials.add(crateMaterial);
  for(const o of [...geometries,...materials,...textures])o.dispose()
 }
 return {load,begin,add,end,dispose}
}
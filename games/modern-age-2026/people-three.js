import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';

export function createPeople(scene){
 const data=window.ModernPeople,loader=new GLTFLoader();
 const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3();
 const facing=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(new T.Vector3(1,1,1),new T.Vector3(),new T.Vector3(0,1,0)));
 const crateGeo=new T.BoxGeometry(.37,.26,.28),crateMat=new T.MeshStandardMaterial({color:0x927447,roughness:.88});
 let nearCount=0,billboardCount=0,closed=false;
 const models=data.names.map((name,i)=>{
   const map=new T.Texture(data.sheets[i]);map.colorSpace=T.SRGBColorSpace;
   map.generateMipmaps=false;map.minFilter=T.LinearFilter;
   const ready=()=>{map.needsUpdate=true};
   if(data.sheets[i].complete)ready();else data.sheets[i].addEventListener('load',ready,{once:true});
   const mat=new T.MeshBasicMaterial({map,alphaTest:.33,toneMapped:false});
   mat.onBeforeCompile=shader=>{
     shader.vertexShader='attribute vec2 cell;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n vMapUv = (vMapUv + cell) / vec2(8.0,36.0);')
   };
   return {name,mat,map,mesh:null,pool:[],used:0,count:0,asset:null,loading:false}
 });
 function load(m){
   if(m.loading)return;m.loading=true;
   loader.load(data.url(m.name,'glb'),asset=>{if(!closed)m.asset=asset},undefined,e=>console.warn('Character mesh:',m.name,e))
 }
 function instance(m){
   const root=clone(m.asset.scene),mixer=new T.AnimationMixer(root);
   const actions=data.actions.map(name=>mixer.clipAction(m.asset.animations.find(c=>c.name===name)));
   const crate=new T.Mesh(crateGeo,crateMat);crate.position.set(0,1.04,.27);root.add(crate);
   root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.frustumCulled=false}});
   scene.add(root);return {root,mixer,actions,crate,action:-1}
 }
 function grow(m){
   const old=m.mesh,cap=old?old.instanceMatrix.count*2:32;
   const geometry=new T.PlaneGeometry(1,1);
   const cells=new T.InstancedBufferAttribute(new Float32Array(cap*2),2).setUsage(T.DynamicDrawUsage);
   geometry.setAttribute('cell',cells);
   const mesh=new T.InstancedMesh(geometry,m.mat,cap);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   if(old){mesh.instanceMatrix.array.set(old.instanceMatrix.array);cells.array.set(old.geometry.attributes.cell.array);scene.remove(old);old.geometry.dispose();old.dispose()}
   scene.add(mesh);m.mesh=mesh;return mesh
 }
 function begin(){nearCount=0;billboardCount=0;for(const m of models){m.used=0;m.count=0}}
 function add(u,time,close){
   const m=models[data.variant(u)],a=data.pose(u),f=data.phase(u,time,a),s=data.scale(u);
   if(close&&!m.asset)load(m);
   if(close&&m.asset&&nearCount<24){
     const i=m.used++,n=m.pool[i]||(m.pool[i]=instance(m));
     if(n.action!==a){if(n.action>=0)n.actions[n.action].stop();n.actions[a].reset().play();n.action=a}
     n.actions[a].time=n.actions[a].getClip().duration*f;n.mixer.update(0);
     n.crate.visible=a===3||a===4;n.root.position.set(u.x,0,u.y);n.root.rotation.y=Math.PI/2-(u.angle||0);n.root.scale.setScalar(s);n.root.visible=true;nearCount++;return true
   }
   if(!data.sheets[data.variant(u)].naturalWidth)return false;
   const mesh=(!m.mesh||m.count===m.mesh.instanceMatrix.count)?grow(m):m.mesh;
   const i=m.count++;position.set(u.x,.84*s,u.y);scale.setScalar(2.1*s);
   matrix.compose(position,facing,scale);mesh.setMatrixAt(i,matrix);
   mesh.geometry.attributes.cell.setXY(i,data.direction(u),35-(a*6+Math.floor(f*6)));billboardCount++;return true
 }
 function end(day,metrics){
   for(const m of models){
     for(let i=m.used;i<m.pool.length;i++)m.pool[i].root.visible=false;
     if(!m.mesh)continue;m.mesh.visible=m.count>0;m.mesh.count=m.count;
     m.mesh.instanceMatrix.needsUpdate=true;m.mesh.geometry.attributes.cell.needsUpdate=true;m.mat.color.setScalar(.40+.60*day)
   }
   metrics.skinnedPeople=nearCount;metrics.crowdPeople=billboardCount
 }
 function dispose(){
   closed=true;
   for(const m of models){
    if(m.mesh){scene.remove(m.mesh);m.mesh.geometry.dispose();m.mesh.dispose()}
    for(const n of m.pool){n.mixer.stopAllAction();n.mixer.uncacheRoot(n.root);scene.remove(n.root);n.root.traverse(o=>o.skeleton?.dispose())}
    m.asset?.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.map?.dispose();o.material.dispose()}});
    m.map.dispose();m.mat.dispose()
   }crateGeo.dispose();crateMat.dispose()
 }
 return {begin,add,end,dispose}
}
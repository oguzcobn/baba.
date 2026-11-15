
/* 1919 — Three-dimensional tactical battlefield using local Three.js */
import * as THREE from "../../js/vendor/three.module.min.js";
const groundHeight=(x,z,snow=false)=>Math.sin(x*.065)*1.8+Math.cos(z*.11)*1.3+Math.sin(x*.025+z*.075)*2.2+Math.max(0,Math.abs(z)-28)*.08;
const xWorld=x=>(x-400)*.175;
const zWorld=y=>(y-250)*.175;
const battlePosition=(x,y)=>new THREE.Vector3(xWorld(x),groundHeight(xWorld(x),zWorld(y))+.7,zWorld(y));
function makeLabel(text,color="#f4e4c2"){const cv=document.createElement("canvas");cv.width=256;cv.height=64;const g=cv.getContext("2d");g.fillStyle="#1e2b25dd";g.fillRect(0,0,256,64);g.lineWidth=3;g.strokeStyle=color;g.strokeRect(2,2,252,60);g.font="bold 24px Georgia,serif";g.fillStyle=color;g.textAlign="center";g.fillText(text,128,41);const tex=new THREE.CanvasTexture(cv);const mat=new THREE.SpriteMaterial({map:tex,depthTest:false});const sprite=new THREE.Sprite(mat);sprite.scale.set(10,2.5,1);return sprite;}
function createTree(scene,x,z,scale=1,snow=false){
const y=groundHeight(x,z);
const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13*scale,.25*scale,2.0*scale,5),new THREE.MeshStandardMaterial({color:0x564733,roughness:1}));trunk.position.set(x,y+.9*scale,z);scene.add(trunk);
for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.ConeGeometry((1.2-i*.18)*scale,2.2*scale,6),new THREE.MeshStandardMaterial({color:snow?0x8caaa0:i%2?0x284b3a:0x315840,roughness:1}));crown.position.set(x,y+(2.0+i*.9)*scale,z);scene.add(crown)}
}
export async function mount3DBattle({getBattle,onOrder,onSelect}){
const host=document.querySelector(".battlefield"),base=host?.querySelector("canvas");if(!host||!base)throw Error("Battlefield unavailable");
const scene=new THREE.Scene();scene.background=new THREE.Color(0x96a69a);scene.fog=new THREE.FogExp2(0xa9b2a3,.008);
const camera=new THREE.PerspectiveCamera(58,1,.1,480);const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(1.7,window.devicePixelRatio||1));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=false;
const canvas=renderer.domElement;canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;z-index:2;cursor:crosshair";host.appendChild(canvas);
const ambient=new THREE.HemisphereLight(0xf4e9ce,0x33483a,2.3);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffd4a1,2.8);sun.position.set(-60,100,-40);scene.add(sun);
const b=getBattle(),snow=b?.s?.id==="sarikamis",desert=b?.s?.id==="kut";
if(snow){scene.background=new THREE.Color(0xc6d4d8);scene.fog.color.set(0xb6c9ce)}
if(desert){scene.background=new THREE.Color(0xc3af86);scene.fog.color.set(0xc3af86)}
const geometry=new THREE.PlaneGeometry(160,105,72,50);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position,colors=[];
const cLow=new THREE.Color(snow?0xb3c0b4:desert?0x8c7955:0x415d43),cHigh=new THREE.Color(snow?0xe3e4d5:desert?0xbfa47a:0x818c62);
for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),h=groundHeight(x,z);positions.setY(i,h);const t=Math.min(1,Math.max(0,(h+3.5)/11));const col=cLow.clone().lerp(cHigh,t);const n=Math.sin(i*1.621)*.065;col.offsetHSL(0,0,n);colors.push(col.r,col.g,col.b)}
positions.needsUpdate=true;geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
const terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide}));scene.add(terrain);
const seed=(i,j=1)=>{const x=Math.sin(i*78.233+j*47.1)*43758.23;return x-Math.floor(x)};
for(let i=0;i<110;i++){let x=-78+seed(i,1)*156,z=-51+seed(i,2)*102;if(Math.abs(x)>62||Math.abs(z)>38||seed(i,4)<.14)createTree(scene,x,z,.45+seed(i,3)*.7,snow)}

/* Landscapes: shaded rock outcrops and grass clumps, instanced for mobile performance. */
const rockGeom=new THREE.DodecahedronGeometry(1,0);
const rockMat=new THREE.MeshStandardMaterial({color:snow?0x909c9b:desert?0x8b7862:0x5b6555,roughness:1,flatShading:true});
const rocks=new THREE.InstancedMesh(rockGeom,rockMat,145);rocks.frustumCulled=false;rocks.instanceMatrix.setUsage(THREE.StaticDrawUsage);
const inst=new THREE.Object3D();
for(let i=0;i<145;i++){
const x=-76+seed(i+202,1)*152,z=-49+seed(i+202,2)*98,scale=.4+seed(i+202,3)*2.6;
inst.position.set(x,groundHeight(x,z)+scale*.3,z);
inst.rotation.set(seed(i,4)*.4,seed(i,5)*6.28,seed(i,6)*.2);inst.scale.set(scale,scale*.45,scale*1.5);inst.updateMatrix();rocks.setMatrixAt(i,inst.matrix);
}scene.add(rocks);
if(!snow&&!desert){
const grassGeom=new THREE.ConeGeometry(.3,1.4,3);
const grassMat=new THREE.MeshStandardMaterial({color:0x526e44,roughness:1,side:THREE.DoubleSide});
const grass=new THREE.InstancedMesh(grassGeom,grassMat,850);grass.frustumCulled=false;
for(let i=0;i<850;i++){
const x=-78+seed(i+410,1)*156,z=-52+seed(i+410,2)*104,t=.35+seed(i+410,3)*.9;
inst.position.set(x,groundHeight(x,z)+t*.45,z);inst.rotation.set(0,seed(i,5)*6.28,0);inst.scale.set(t,t,t);inst.updateMatrix();grass.setMatrixAt(i,inst.matrix);
}scene.add(grass);
}
const ridgeGeo=new THREE.ConeGeometry(18,22,6,1);
const ridgeMat=new THREE.MeshStandardMaterial({color:snow?0xc2cfca:desert?0x8c795d:0x4c5d4c,flatShading:true,roughness:1});
for(let i=0;i<9;i++){
const ridge=new THREE.Mesh(ridgeGeo,ridgeMat);
ridge.scale.set(.7+seed(i+90,4),.55+seed(i+90,5),.6+seed(i+90,6));
ridge.position.set(-90+i*23,-8,(-75+(i%2)*146));ridge.rotation.y=seed(i+90,7)*Math.PI;scene.add(ridge);
}
const trenchMat=new THREE.MeshStandardMaterial({color:snow?0x8c968a:0x4b3f2e,roughness:1});
const sandbagMat=new THREE.MeshStandardMaterial({color:snow?0xc4beac:0x9c8a69,roughness:1});
for(const x of [-37,38]){for(let i=0;i<33;i++){const z=-50+i*3.15,xx=x+Math.sin(i*.6)*1.4,y=groundHeight(xx,z);const bar=new THREE.Mesh(new THREE.BoxGeometry(2.2,.6,3.1),trenchMat);bar.position.set(xx,y+.18,z);scene.add(bar);for(let k=0;k<2;k++){const bag=new THREE.Mesh(new THREE.BoxGeometry(.65,.35,2.65),sandbagMat);bag.position.set(xx+(k?1.2:-1.2),y+.3,z);scene.add(bag)}}}
const wireMat=new THREE.LineBasicMaterial({color:0x909690,transparent:true,opacity:.6});for(const wx of [-26,27]){let points=[];for(let i=0;i<=110;i++){const z=-49+i*.9;points.push(new THREE.Vector3(wx+Math.sin(i*2)*.4,groundHeight(wx,z)+1.15,z))}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),wireMat);scene.add(line)}
const bodyShape=new THREE.CylinderGeometry(.35,.42,1.65,7),headShape=new THREE.SphereGeometry(.34,8,6),helmetShape=new THREE.CylinderGeometry(.47,.40,.34,9),horseShape=new THREE.BoxGeometry(1.5,.75,.58),wheelShape=new THREE.CylinderGeometry(.7,.7,.22,9),barrelShape=new THREE.CylinderGeometry(.14,.19,3.5,8),rifleShape=new THREE.BoxGeometry(.10,.13,2.1),packShape=new THREE.BoxGeometry(.66,.87,.26),legsShape=new THREE.BoxGeometry(.48,.85,.3),bayonetShape=new THREE.CylinderGeometry(.015,.025,.72,5);
const factionPalette=[{coat:0xc0a883,helmet:0x565c4a,horse:0x755342},{coat:0x817a71,helmet:0x575e59,horse:0x5e5546}];
const uniforms=[];const dummy=new THREE.Object3D();
for(let team=0;team<2;team++){
const p=factionPalette[team];
const mk=(geo,color,max=300)=>{const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:.92}),max);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);return mesh};
uniforms.push({body:mk(bodyShape,p.coat),head:mk(headShape,0xd2b895),helmet:mk(helmetShape,p.helmet),horses:mk(horseShape,p.horse,120),cannons:mk(barrelShape,0x343c3a,40),rifles:mk(rifleShape,0x3c352b),packs:mk(packShape,team===0?0x726344:0x565b4d),legs:mk(legsShape,team===0?0x8d8469:0x6c736b),bayonets:mk(bayonetShape,0xb4bdb4),counts:{}});
}
let labels=[];for(const u of b.units){const name=u.type==="Piyade"?"PİYADE":u.type==="Topçu"?"TOPÇU":"SÜVARİ";const lbl=makeLabel(name,u.team===0?"#e8d6a9":"#df9a87");scene.add(lbl);labels.push(lbl)}
const pennantMaterial=[new THREE.MeshStandardMaterial({color:0xa53731,side:THREE.DoubleSide,roughness:.86}),new THREE.MeshStandardMaterial({color:0x9d8766,side:THREE.DoubleSide,roughness:.86})];
const banners=b.units.map(u=>{const group=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.065,.08,5.6,7),new THREE.MeshStandardMaterial({color:0x705f3b}));pole.position.y=2.5;group.add(pole);const cloth=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.45),pennantMaterial[u.team]);cloth.position.set(1.2,4.3,0);cloth.rotation.y=Math.PI/6;group.add(cloth);const insignia=new THREE.Mesh(new THREE.SphereGeometry(.23,8,6),new THREE.MeshStandardMaterial({color:0xf5e8ca,emissive:0x58462a}));insignia.position.set(1.2,4.3,.07);group.add(insignia);scene.add(group);return group;});
const marker=new THREE.Mesh(new THREE.RingGeometry(2.7,3.15,36),new THREE.MeshBasicMaterial({color:0xf3dc94,side:THREE.DoubleSide,transparent:true,opacity:.88}));marker.rotation.x=-Math.PI/2;scene.add(marker);
const smoke=[];const smokeGeom=new THREE.SphereGeometry(.6,6,5);
for(let i=0;i<18;i++){const puff=new THREE.Mesh(smokeGeom,new THREE.MeshBasicMaterial({color:0xd1c9b3,transparent:true,opacity:0,depthWrite:false}));scene.add(puff);smoke.push({mesh:puff,t:0})}
let orbit={angle:0,dist:128,height:75};function setCamera(){camera.position.set(Math.sin(orbit.angle)*orbit.dist,orbit.height,Math.cos(orbit.angle)*orbit.dist);camera.lookAt(0,0,0)}
function cameraPreset(n){if(n===1){orbit.angle=-.42;orbit.dist=82;orbit.height=32}else if(n===2){orbit.angle=.04;orbit.dist=145;orbit.height=135}else{orbit.angle=0;orbit.dist=128;orbit.height=75}setCamera()}
const onPreset=event=>cameraPreset(Number(event.detail)||0);
window.addEventListener("war-camera",onPreset);
setCamera();
function resize(){const w=host.clientWidth||800,h=host.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}resize();
const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;if(ro)ro.observe(host);else window.addEventListener("resize",resize);
let start=null,dragging=false;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function commandAt(ev){const rect=canvas.getBoundingClientRect();pointer.set(((ev.clientX-rect.left)/rect.width)*2-1,-((ev.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObject(terrain);if(!hits.length)return;const pt=hits[0].point,x=pt.x/.175+400,y=pt.z/.175+250;const b=getBattle();if(!b)return;const near=b.units.filter(u=>u.team===0&&u.hp>0).sort((a,c)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(c.x-x,c.y-y))[0];if(ev.button===0&&near&&Math.hypot(near.x-x,near.y-y)<65){onSelect(near.id);return}onOrder(x,y)}
canvas.addEventListener("pointerdown",ev=>{start={x:ev.clientX,y:ev.clientY,button:ev.button};dragging=false;canvas.setPointerCapture(ev.pointerId)});
canvas.addEventListener("pointermove",ev=>{if(!start)return;const dx=ev.clientX-start.x,dy=ev.clientY-start.y;if(Math.hypot(dx,dy)>8)dragging=true;if(start.button===2&&dragging){orbit.angle-=dx*.004;orbit.height=Math.max(26,Math.min(130,orbit.height+dy*.09));setCamera();start.x=ev.clientX;start.y=ev.clientY}});
canvas.addEventListener("pointerup",ev=>{if(!dragging)commandAt(ev);start=null;dragging=false});
canvas.addEventListener("contextmenu",ev=>ev.preventDefault());
canvas.addEventListener("wheel",ev=>{ev.preventDefault();orbit.dist=Math.max(66,Math.min(230,orbit.dist+ev.deltaY*.09));orbit.height=Math.max(35,Math.min(135,orbit.dist*.58));setCamera()},{passive:false});
function place(mesh,i,x,y,z,scale=1,rotation=0){dummy.position.set(x,y,z);dummy.rotation.set(0,rotation,0);dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
let lastShotCount=0,frame=0;
function update(){
const b=getBattle();if(!b)return;
frame++;const count=[{body:0,head:0,helmet:0,horses:0,cannons:0,rifles:0,packs:0,legs:0,bayonets:0},{body:0,head:0,helmet:0,horses:0,cannons:0,rifles:0,packs:0,legs:0,bayonets:0}];
for(let j=0;j<b.units.length;j++){const u=b.units[j],label=labels[j],pos=battlePosition(u.x,u.y);label.visible=u.hp>0;label.position.set(pos.x,pos.y+9,pos.z);if(banners[j]){banners[j].visible=u.hp>0;banners[j].position.set(pos.x-3,pos.y+.2,pos.z)}
if(u.hp<=0)continue;
const total=Math.max(1,Math.min(42,Math.ceil(u.hp/2.3))),cols=u.type==="Topçu"?3:u.type==="Süvari"?5:7,un=uniforms[u.team],counts=count[u.team];
for(let i=0;i<total;i++){
const wx=pos.x+(i%cols-(cols-1)/2)*(u.type==="Süvari"?2.15:1.12),wz=pos.z+(Math.floor(i/cols)-1)*1.85,wy=groundHeight(wx,wz);
if(u.type==="Topçu"&&i<3){place(un.cannons,counts.cannons++,wx,wy+1.15,wz,.85,Math.PI/2);continue}
if(u.type==="Süvari"){place(un.horses,counts.horses++,wx,wy+.75,wz,1);place(un.body,counts.body++,wx,wy+2.0,wz,.63);place(un.head,counts.head++,wx,wy+2.8,wz,.65);place(un.helmet,counts.helmet++,wx,wy+3.1,wz,.7);place(un.legs,counts.legs++,wx,wy+1.3,wz,.6);place(un.rifles,counts.rifles++,wx+.25,wy+2.5,wz+.2,.55,Math.PI*.4);place(un.bayonets,counts.bayonets++,wx+.6,wy+2.5,wz-.55,.55,Math.PI*.4)}
else{const swing=Math.sin((b.t+i)*5)*.13;place(un.body,counts.body++,wx,wy+1.2+swing,wz,.9);place(un.head,counts.head++,wx,wy+2.25+swing,wz,.9);place(un.helmet,counts.helmet++,wx,wy+2.62+swing,wz,.9);place(un.legs,counts.legs++,wx,wy+.33+Math.abs(swing)*.2,wz,1);place(un.packs,counts.packs++,wx,wy+1.35+swing,wz+.35,.8);place(un.rifles,counts.rifles++,wx+.48,wy+1.56+swing,wz-.35,.65);place(un.bayonets,counts.bayonets++,wx+.48,wy+1.52+swing,wz-1.2,.52)}
}
}
for(let team=0;team<2;team++)for(const key of Object.keys(count[team])){const mesh=uniforms[team][key];mesh.count=count[team][key];mesh.instanceMatrix.needsUpdate=true}
const selected=b.units[b.selected];if(selected&&selected.hp>0){const p=battlePosition(selected.x,selected.y);marker.position.set(p.x,p.y+.15,p.z);marker.visible=true}else marker.visible=false;
for(const p of smoke){if(p.t>0){p.t-=.035;p.mesh.material.opacity=Math.max(0,p.t*.15);p.mesh.position.y+=.06;p.mesh.scale.addScalar(.005)}}
if(frame%4===0&&b.shots.length){const shot=b.shots[b.shots.length-1],p=smoke.find(x=>x.t<=0);if(p&&shot){p.t=1;p.mesh.position.copy(battlePosition(shot.tx,shot.ty));p.mesh.scale.setScalar(1)}}
renderer.render(scene,camera);
}
function dispose(){window.removeEventListener("war-camera",onPreset);ro?.disconnect();if(!ro)window.removeEventListener("resize",resize);scene.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();if(obj.material){for(const m of (Array.isArray(obj.material)?obj.material:[obj.material])){if(m.map)m.map.dispose();m.dispose()}}});renderer.dispose();canvas.remove()}
return {update,dispose,cameraPreset};
}

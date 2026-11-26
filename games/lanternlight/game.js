import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

/* =========================================================
   Lanternlight 3D — Three.js PBR pipeline + career mode
   ========================================================= */
const CALIB=location.hash==='#calib';
const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeNoise(seed){const r=mulberry(seed),perm=[...Array(256).keys()];for(let i=255;i>0;i--){const j=r()*(i+1)|0;[perm[i],perm[j]]=[perm[j],perm[i]]}const p=new Uint16Array(512);for(let i=0;i<512;i++)p[i]=perm[i&255];const v=new Float32Array(256).map(()=>r());
  return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),w=yf*yf*(3-2*yf),X=xi&255,Y=yi&255,a=v[p[p[X]+Y]&255],b=v[p[p[X+1]+Y]&255],c=v[p[p[X]+Y+1]&255],d=v[p[p[X+1]+Y+1]&255];return a+(b-a)*u+(c-a)*w+(a-b-c+d)*u*w}}
const fbm=(n,x,y,o)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=n(x*f,y*f)*a;t+=a;a*=.5;f*=2.03}return s/t};
const N1=makeNoise(11),N2=makeNoise(23),N3=makeNoise(37);
const R=mulberry(7);let rnd=CALIB?mulberry(99):Math.random;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,pick=(a,r=rnd)=>a[(r()*a.length)|0];
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return Math.abs(d)};
const W=80; // world half-size (m)

/* ---------- quality & calibrated look parameters ---------- */
const isTouch=matchMedia('(pointer:coarse)').matches;
const QL={low:{pr:.7,sh:1024,sp:512,grass:7000,gtao:false,bloom:true},mid:{pr:1,sh:2048,sp:1024,grass:18000,gtao:false,bloom:true},high:{pr:Math.min(devicePixelRatio||1,1.5),sh:2048,sp:1024,grass:36000,gtao:true,bloom:true}};
let qName=CALIB?'mid':store.get('ll_quality',isTouch?'low':'high');if(!QL[qName])qName='mid';const Q=QL[qName];
export const DEFAULT_PARAMS={exposure:1.7,aeRef:.03,moon:.5,moonTemp:7800,hemi:.4,fog:.026,flash:900,bounce:2.4,lantern:24,sat:.92,contrast:1.06,liftB:.012};
const PARAMS={...DEFAULT_PARAMS,...(window.LL_CALIBRATED||{})};
function kelvin(k){const t=k/100;let r,g,b;if(t<=66){r=255;g=99.47*Math.log(t)-161.12;b=t<=19?0:138.52*Math.log(t-10)-305.04}else{r=329.7*Math.pow(t-60,-.1332);g=288.12*Math.pow(t-60,-.0755);b=255}return new THREE.Color().setRGB(clamp(r,0,255)/255,clamp(g,0,255)/255,clamp(b,0,255)/255,THREE.SRGBColorSpace)}

/* ---------- renderer & post pipeline ---------- */
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CALIB});
renderer.setPixelRatio(Q.pr);renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=PARAMS.exposure;renderer.outputColorSpace=THREE.SRGBColorSpace;
$('stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x04070b);scene.fog=new THREE.FogExp2(0x0a111b,PARAMS.fog);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.5,220);

class AutoExposurePass extends Pass{
  constructor(){super();this.needsSwap=false;this.rt=new THREE.WebGLRenderTarget(16,16,{type:THREE.FloatType,depthBuffer:false});this.buf=new Float32Array(16*16*4);this.f=0;this.avg=PARAMS.aeRef;this.ok=true;
    this.q=new FullScreenQuad(new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){float l=0.;for(int i=0;i<4;i++)for(int j=0;j<4;j++){vec2 o=(vec2(float(i),float(j))-1.5)/64.;vec3 c=texture2D(tDiffuse,vUv+o).rgb;l+=log(max(dot(c,vec3(.2126,.7152,.0722)),1e-4));}gl_FragColor=vec4(l/16.,0.,0.,1.);}'}))}
  render(r,w,read){if(!this.enabled||!this.ok||++this.f%10)return;this.q.material.uniforms.tDiffuse.value=read.texture;r.setRenderTarget(this.rt);this.q.render(r);
    try{r.readRenderTargetPixels(this.rt,0,0,16,16,this.buf);let s=0,n=0;for(let y=0;y<16;y++)for(let x=0;x<16;x++){const wgt=1.5-Math.hypot(x-7.5,y-7.5)/11;s+=this.buf[(y*16+x)*4]*wgt;n+=wgt}const a=Math.exp(s/n);if(isFinite(a))this.avg=a}catch(e){this.ok=false}}}
const GradeShader={uniforms:{tDiffuse:{value:null},uSat:{value:1},uContrast:{value:1},uLift:{value:new THREE.Vector3()},uVig:{value:.55},uGrain:{value:.05},uTime:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uSat,uContrast,uVig,uGrain,uTime;uniform vec3 uLift;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec3 c=max(texture2D(tDiffuse,vUv).rgb,0.);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,uSat);c=.18*pow(c/.18,vec3(uContrast));
  c+=uLift*(1.-smoothstep(0.,.06,l));vec2 d=vUv-.5;c*=1.-uVig*dot(d,d)*2.2;c*=1.+(h(vUv*vec2(1733.,977.)+uTime)-.5)*uGrain;gl_FragColor=vec4(c,1.);}`};
const composer=new EffectComposer(renderer);composer.setPixelRatio(Q.pr);composer.setSize(innerWidth,innerHeight);
composer.addPass(new RenderPass(scene,camera));
let gtao=null;if(Q.gtao){try{gtao=new GTAOPass(scene,camera,innerWidth,innerHeight);gtao.blendIntensity=.85;gtao.updateGtaoMaterial({radius:.6,distanceExponent:1.5,thickness:1.2,scale:1,samples:12});composer.addPass(gtao)}catch(e){gtao=null}}
const ae=new AutoExposurePass();composer.addPass(ae);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.55,.55,.9);composer.addPass(bloom);
const grade=new ShaderPass(GradeShader);composer.addPass(grade);composer.addPass(new OutputPass());
if(CALIB){ae.enabled=false;grade.uniforms.uGrain.value=0}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);if(gtao)gtao.setSize(innerWidth,innerHeight)});

/* ---------- lights ---------- */
const hemi=new THREE.HemisphereLight(0x2c3d5e,0x0b0f0a,PARAMS.hemi);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xffffff,PARAMS.moon);moon.castShadow=true;moon.shadow.mapSize.set(Q.sh,Q.sh);
Object.assign(moon.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:1,far:140});moon.shadow.bias=-.0004;moon.shadow.normalBias=.03;scene.add(moon,moon.target);
const MOON_DIR=new THREE.Vector3(-.45,1,-.62).normalize();
const flash=new THREE.SpotLight(0xffd9a8,PARAMS.flash,48,.42,.45,2);flash.castShadow=true;flash.shadow.mapSize.set(Q.sp,Q.sp);flash.shadow.camera.near=.3;flash.shadow.camera.far=48;flash.shadow.bias=-.00015;flash.shadow.normalBias=.02;scene.add(flash,flash.target);
const bounce=new THREE.PointLight(0xc9b087,PARAMS.bounce,16,2);scene.add(bounce); // one-bounce GI approximation from the torch
const muzzle=new THREE.PointLight(0xffc27a,0,14,2);scene.add(muzzle);
const flareL=new THREE.PointLight(0xffd59a,0,30,2);scene.add(flareL);

/* ---------- procedural PBR textures ---------- */
function canvasTex(w,h,fn,srgb){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);fn(im.data,w,h);x.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t}
function heightToNormal(hf,w,h,str){return canvasTex(w,h,(d)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){const l=hf((x-1+w)%w,y),r=hf((x+1)%w,y),u=hf(x,(y-1+h)%h),dn=hf(x,(y+1)%h);let nx=(l-r)*str,ny=(u-dn)*str,nz=1;const m=Math.hypot(nx,ny,nz);const i=(y*w+x)*4;d[i]=(nx/m*.5+.5)*255;d[i+1]=(ny/m*.5+.5)*255;d[i+2]=(nz/m*.5+.5)*255;d[i+3]=255}})}
const TS=512,tileN=(n,x,y,s,o)=>{const a=fbm(n,x/s,y/s,o),b=fbm(n,(x-TS)/s,y/s,o),c=fbm(n,x/s,(y-TS)/s,o),d=fbm(n,(x-TS)/s,(y-TS)/s,o),u=x/TS,v=y/TS;return lerp(lerp(a,b,u),lerp(c,d,u),v)};
const gH=new Float32Array(TS*TS);for(let y=0;y<TS;y++)for(let x=0;x<TS;x++)gH[y*TS+x]=tileN(N1,x,y,24,4)*.7+tileN(N2,x,y,5,2)*.3;
const groundMap=canvasTex(TS,TS,(d)=>{for(let i=0;i<TS*TS;i++){const v=gH[i],k=.55+v*.55,j=i*4;d[j]=200*k;d[j+1]=205*k;d[j+2]=180*k;d[j+3]=255}},true);
const groundNrm=heightToNormal((x,y)=>gH[y*TS+x],TS,TS,6);groundMap.repeat.set(36,36);groundNrm.repeat.set(36,36);
const barkH=(x,y)=>fbm(N3,x/3,y/40,3)*.7+fbm(N2,x/1.5,y/8,2)*.3;
const barkMap=canvasTex(128,256,(d)=>{for(let y=0;y<256;y++)for(let x=0;x<128;x++){const v=barkH(x,y),i=(y*128+x)*4;d[i]=70+v*90;d[i+1]=56+v*70;d[i+2]=44+v*52;d[i+3]=255}},true);const barkNrm=heightToNormal(barkH,128,256,9);
const rockH=(x,y)=>tileN(N3,x*2,y*2,40,5);const rockNrm=heightToNormal(rockH,256,256,7);rockNrm.repeat.set(2,2);
const woodH=(x,y)=>fbm(N2,x/60,y/2,3)*.6+fbm(N3,x/8,y/1,2)*.4;const woodMap=canvasTex(256,64,(d)=>{for(let y=0;y<64;y++)for(let x=0;x<256;x++){const v=woodH(x,y),i=(y*256+x)*4,g=(y%16<1)?.4:1;d[i]=(95+v*80)*g;d[i+1]=(72+v*60)*g;d[i+2]=(50+v*40)*g;d[i+3]=255}},true);const woodNrm=heightToNormal(woodH,256,64,5);

const M={
  ground:new THREE.MeshStandardMaterial({map:groundMap,normalMap:groundNrm,normalScale:new THREE.Vector2(.9,.9),roughness:.97,vertexColors:true}),
  bark:new THREE.MeshStandardMaterial({map:barkMap,normalMap:barkNrm,roughness:.95}),
  leaves:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82}),
  rock:new THREE.MeshStandardMaterial({vertexColors:true,normalMap:rockNrm,normalScale:new THREE.Vector2(1.2,1.2),roughness:.9}),
  wood:new THREE.MeshStandardMaterial({map:woodMap,normalMap:woodNrm,roughness:.85}),
  metal:new THREE.MeshStandardMaterial({color:0x6d7277,metalness:.85,roughness:.42}),
  darkMetal:new THREE.MeshStandardMaterial({color:0x25282b,metalness:.8,roughness:.38}),
  cloth:new THREE.MeshStandardMaterial({color:0x6e6248,roughness:1}),
  stone:new THREE.MeshStandardMaterial({color:0x5d605b,normalMap:rockNrm,roughness:.92}),
  brass:new THREE.MeshStandardMaterial({color:0xc9a24e,metalness:1,roughness:.3}),
  glassOff:new THREE.MeshStandardMaterial({color:0x8090a0,roughness:.1,metalness:0,transparent:true,opacity:.55}),
  glassOn:new THREE.MeshStandardMaterial({color:0xffe2b0,emissive:0xffb262,emissiveIntensity:9,roughness:.2}),
  flame:new THREE.MeshBasicMaterial({color:0xffa040,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}),
  olive:new THREE.MeshStandardMaterial({color:0x4b5236,roughness:.8}),
  white:new THREE.MeshStandardMaterial({color:0xd9d4c8,roughness:.6}),
  red:new THREE.MeshStandardMaterial({color:0xa8322c,roughness:.6}),
};
const shadowy=o=>{o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}});return o};

/* ---------- world layout ---------- */
const OBS=[];const TREES=[],ROCKS=[],LOGS=[];
function freeAt(x,z,r,gap=1){if(Math.hypot(x,z)<16)return false;for(const o of OBS)if(Math.hypot(x-o.x,z-o.z)<r+o.r+gap)return false;for(const t of TREES)if(Math.hypot(x-t.x,z-t.z)<r+t.s*1.4)return false;return true}
for(let n=0;n<4000&&TREES.length<120;n++){const x=(R()*2-1)*(W-8),z=(R()*2-1)*(W-8),s=.85+R()*.6;if(freeAt(x,z,s*1.6,1.5)){TREES.push({x,z,s,v:R()*3|0,ry:R()*7});OBS.push({x,z,r:.34*s,k:'tree'})}}
for(let i=0;i<130;i++){const a=i/130*Math.PI*2+R()*.05,d=W-2-R()*9,x=Math.cos(a)*d*1.02,z=Math.sin(a)*d*1.02,s=1.1+R()*.6;TREES.push({x:clamp(x,-W,W),z:clamp(z,-W,W),s,v:R()*3|0,ry:R()*7});OBS.push({x,z,r:.34*s,k:'tree'})}
for(let n=0;n<2000&&ROCKS.length<55;n++){const x=(R()*2-1)*(W-8),z=(R()*2-1)*(W-8),s=.35+R()*1.1;if(freeAt(x,z,s,1)){ROCKS.push({x,z,s,v:R()*2|0,ry:R()*7,sy:.5+R()*.4});OBS.push({x,z,r:s*.85,k:'rock'})}}
for(let n=0;n<800&&LOGS.length<10;n++){const x=(R()*2-1)*(W-10),z=(R()*2-1)*(W-10),a=R()*Math.PI;if(!freeAt(x,z,2,1))continue;LOGS.push({x,z,a});for(let k=-1;k<=1;k++)OBS.push({x:x+Math.sin(a)*k*1.2,z:z+Math.cos(a)*k*1.2,r:.42,k:'log'})}
OBS.push({x:0,z:0,r:2.6,k:'hut'});
const STATIC_OBS=OBS.length;

/* lanterns (reposition each night) & path */
let LAN=[];
function placeLanterns(night){const r=mulberry(1000+night);LAN=[];for(let i=0;i<5;i++){for(let t=0;t<60;t++){const a=i/5*Math.PI*2+r()*.9,d=30+r()*30,x=Math.cos(a)*d,z=Math.sin(a)*d;if(OBS.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+3))continue;LAN.push({x,z,lit:false,prog:0,fl:r()*9});break}}}
function pathDist(x,z){let best=1e9;const pts=[...LAN].sort((a,b)=>Math.atan2(a.z,a.x)-Math.atan2(b.z,b.x));const seg=(ax,az,bx,bz)=>{const vx=bx-ax,vz=bz-az,t=clamp(((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(x-ax-vx*t,z-az-vz*t)};
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];best=Math.min(best,seg(a.x,a.z,b.x,b.z))}if(pts.length)best=Math.min(best,seg(0,0,pts[0].x,pts[0].z));return best}

/* ---------- ground ---------- */
const groundGeo=new THREE.PlaneGeometry(W*2+40,W*2+40,220,220).rotateX(-Math.PI/2);
const ground=new THREE.Mesh(groundGeo,M.ground);ground.receiveShadow=true;scene.add(ground);
groundGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count*3),3));
function paintGround(){const p=groundGeo.attributes.position,c=groundGeo.attributes.color;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n1=fbm(N1,x/38,z/38,3),n2=fbm(N2,x/7,z/7,2),g=clamp((n1-.36)*2.2+(n2-.5)*.6,0,1);
    let r=lerp(.21,lerp(.055,.12,n2),g),gg=lerp(.2,lerp(.085,.17,n2),g),b=lerp(.11,lerp(.05,.075,n2),g);
    const pd=pathDist(x,z),pt=clamp(1-(pd-.6)/1.6,0,1)*(.8+n2*.4);const bd=clamp(1-(Math.hypot(x,z)-11)/3,0,1);const dirt=Math.max(pt,bd*.9);
    if(dirt>0){r=lerp(r,.2+n2*.06,dirt);gg=lerp(gg,.15+n2*.04,dirt);b=lerp(b,.1+n2*.03,dirt)}
    const edge=clamp((Math.max(Math.abs(x),Math.abs(z))-W+4)/12,0,1);c.setXYZ(i,r*(1-edge*.6),gg*(1-edge*.6),b*(1-edge*.6))}c.needsUpdate=true}

/* ---------- grass (instanced tufts with wind) ---------- */
const grassU={uTime:{value:0},uPlayer:{value:new THREE.Vector2()}};
function tuftGeo(){const parts=[];for(let i=0;i<5;i++){const h=.45+R()*.5,g=new THREE.PlaneGeometry(.045,h,1,3);g.translate(0,h/2,0);const p=g.attributes.position,lean=(R()-.5)*.5;const hs=new Float32Array(p.count);
    for(let k=0;k<p.count;k++){const y=p.getY(k),t=y/h;p.setX(k,p.getX(k)*(1-t*.85));p.setZ(k,t*t*lean);hs[k]=t}g.setAttribute('aH',new THREE.BufferAttribute(hs,1));g.rotateY(R()*Math.PI);g.translate((R()-.5)*.16,0,(R()-.5)*.16);
    const nn=g.attributes.normal;for(let k=0;k<nn.count;k++)nn.setXYZ(k,0,1,0);parts.push(g)}return mergeGeometries(parts)}
const grassMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,side:THREE.DoubleSide});
grassMat.onBeforeCompile=s=>{Object.assign(s.uniforms,grassU);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aH;varying float vH;uniform float uTime;uniform vec2 uPlayer;').replace('#include <begin_vertex>',`#include <begin_vertex>
    vH=aH;vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.);float w=sin(uTime*1.6+ip.x*.31+ip.z*.23)*.6+sin(uTime*2.9+ip.x*.9)*.25;float hh=aH*aH;transformed.x+=w*hh*.14;transformed.z+=w*hh*.07;
    vec2 dp=ip.xz-uPlayer;float dl=length(dp);float push=smoothstep(1.1,.0,dl);transformed.xz+=normalize(dp+1e-4)*push*hh*.45;transformed.y-=push*hh*.2;`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vH;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.28,1.05,vH);')};
let grass=null;
function buildGrass(){const geo=tuftGeo(),n=Q.grass,m=new THREE.InstancedMesh(geo,grassMat,n);const d=new THREE.Object3D(),col=new THREE.Color();let i=0,tries=0;
  while(i<n&&tries<n*6){tries++;const x=(R()*2-1)*(W-2),z=(R()*2-1)*(W-2);if(Math.hypot(x,z)<12)continue;const pd=pathDist(x,z);if(pd<1.6&&R()<.9)continue;const dens=fbm(N1,x/30,z/30,2);if(R()>dens*1.6)continue;
    d.position.set(x,0,z);d.rotation.set(0,R()*7,0);const s=.75+R()*.6;d.scale.set(s,s*(.6+dens*.9),s);d.updateMatrix();m.setMatrixAt(i,d.matrix);
    const n2=fbm(N2,x/6,z/6,2);col.setRGB(lerp(.09,.24,n2)*(.8+R()*.3),lerp(.16,.24,n2)*(.85+R()*.25),lerp(.06,.09,n2));m.setColorAt(i,col);i++}
  m.count=i;m.receiveShadow=true;m.castShadow=false;m.frustumCulled=false;scene.add(m);grass=m}

/* ---------- trees, rocks, logs (instanced, PBR) ---------- */
function blob(r,detail,amp,seed){let g=new THREE.IcosahedronGeometry(r,detail);g.deleteAttribute('uv');g.deleteAttribute('normal');g=mergeVertices(g);const p=g.attributes.position,n=makeNoise(seed);
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),l=v.length(),k=1+(fbm(n,v.x*1.7+5,v.z*1.7+v.y*1.3,3)-.5)*amp;v.multiplyScalar(k);p.setXYZ(i,v.x,v.y,v.z)}g.computeVertexNormals();return g}
function treeVariant(seed){const r=mulberry(seed),trunk=new THREE.CylinderGeometry(.17,.34,4.6,9,8);trunk.translate(0,2.3,0);const tp=trunk.attributes.position;
  for(let i=0;i<tp.count;i++){const y=tp.getY(i);tp.setX(i,tp.getX(i)+Math.sin(y*.7+seed)*.12*y/4.6);tp.setZ(i,tp.getZ(i)+Math.cos(y*.5+seed)*.08*y/4.6)}trunk.computeVertexNormals();
  const parts=[];const k=7+(r()*4|0);for(let i=0;i<k;i++){const rr=1.0+r()*.9,g=blob(rr,3,.55,seed*13+i);const a=r()*7,d=Math.sqrt(r())*1.5;g.translate(Math.cos(a)*d,4.2+r()*1.9-d*.3,Math.sin(a)*d);parts.push(g)}
  const can=mergeGeometries(parts),cp=can.attributes.position,cols=new Float32Array(cp.count*3),tint=[[.06,.13,.06],[.09,.13,.05],[.05,.12,.09]][seed%3],nn=makeNoise(seed+5);
  for(let i=0;i<cp.count;i++){const y=cp.getY(i),t=clamp((y-3.2)/3.4,0,1),v=fbm(nn,cp.getX(i)*1.3,cp.getZ(i)*1.3+y,3),k2=(.45+t*.75)*(.7+v*.6);cols[i*3]=tint[0]*k2;cols[i*3+1]=tint[1]*k2;cols[i*3+2]=tint[2]*k2}
  can.setAttribute('color',new THREE.BufferAttribute(cols,3));return{trunk,can}}
const rockGeos=[0,1].map(i=>{const g=blob(1,4,.7,300+i),p=g.attributes.position,uv=new Float32Array(p.count*2);for(let k=0;k<p.count;k++){uv[k*2]=p.getX(k)*.5+.5;uv[k*2+1]=p.getZ(k)*.5+p.getY(k)*.3+.5}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));const c=new Float32Array(p.count*3),n=makeNoise(400+i);for(let k=0;k<p.count;k++){const y=p.getY(k),v=fbm(n,p.getX(k)*2,p.getZ(k)*2+y,3),moss=clamp((y-.35)*2.5,0,1)*clamp(v*1.6-.4,0,1),gr=.16+v*.12;c[k*3]=lerp(gr,.07,moss);c[k*3+1]=lerp(gr,.1,moss);c[k*3+2]=lerp(gr*.95,.05,moss)}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g});
function buildForest(){const d=new THREE.Object3D();for(let v=0;v<3;v++){const{trunk,can}=treeVariant(v+1),list=TREES.filter(t=>t.v===v);const tm=new THREE.InstancedMesh(trunk,M.bark,list.length),cm=new THREE.InstancedMesh(can,M.leaves,list.length);
    list.forEach((t,i)=>{d.position.set(t.x,0,t.z);d.rotation.set(0,t.ry,0);d.scale.setScalar(t.s);d.updateMatrix();tm.setMatrixAt(i,d.matrix);cm.setMatrixAt(i,d.matrix)});for(const m of[tm,cm]){m.castShadow=m.receiveShadow=true;scene.add(m)}}
  for(let v=0;v<2;v++){const list=ROCKS.filter(t=>t.v===v),m=new THREE.InstancedMesh(rockGeos[v],M.rock,list.length);list.forEach((t,i)=>{d.position.set(t.x,-.12*t.s,t.z);d.rotation.set(0,t.ry,0);d.scale.set(t.s,t.s*t.sy,t.s*.9);d.updateMatrix();m.setMatrixAt(i,d.matrix)});m.castShadow=m.receiveShadow=true;scene.add(m)}
  const lg=new THREE.CylinderGeometry(.36,.42,3.6,12,4);lg.rotateX(Math.PI/2);const lm=new THREE.InstancedMesh(lg,M.bark,LOGS.length);LOGS.forEach((l,i)=>{d.position.set(l.x,.34,l.z);d.rotation.set(0,l.a,0);d.scale.setScalar(1);d.updateMatrix();lm.setMatrixAt(i,d.matrix)});lm.castShadow=lm.receiveShadow=true;scene.add(lm)}

/* ---------- lanterns ---------- */
const lanternObjs=[];
for(let i=0;i<5;i++){const g=new THREE.Group(),base=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,.35,10),M.stone);base.position.y=.17;
  const post=new THREE.Mesh(new THREE.BoxGeometry(.13,2.4,.13),M.darkMetal);post.position.y=1.5;const cap=new THREE.Mesh(new THREE.ConeGeometry(.32,.3,4),M.darkMetal);cap.position.y=3.15;cap.rotation.y=Math.PI/4;
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.42,.06,.42),M.darkMetal);frame.position.y=2.68;const glass=new THREE.Mesh(new THREE.BoxGeometry(.34,.42,.34),M.glassOff);glass.position.y=2.92;
  const light=new THREE.PointLight(0xffb46b,0,22,2);light.position.y=2.9;g.add(base,post,cap,frame,glass,light);shadowy(g);glass.castShadow=false;scene.add(g);lanternObjs.push({g,glass,light})}
function syncLanterns(){LAN.forEach((l,i)=>{const o=lanternObjs[i];o.g.position.set(l.x,0,l.z);o.glass.material=l.lit?M.glassOn:M.glassOff;o.light.intensity=l.lit?PARAMS.lantern:0})}

/* ---------- base: hut + 6 build slots ---------- */
const hut=new THREE.Group();{const floor=new THREE.Mesh(new THREE.BoxGeometry(4.4,.25,3.4),M.wood);floor.position.y=.12;hut.add(floor);
  const wall=(w,h,x,z,ry)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.14),M.wood);m.position.set(x,h/2+.25,z);m.rotation.y=ry;hut.add(m)};wall(4.2,2.2,0,-1.6,0);wall(3.2,2.2,-2.1,0,Math.PI/2);wall(3.2,2.2,2.1,0,Math.PI/2);wall(1.5,2.2,-1.35,1.6,0);wall(1.5,2.2,1.35,1.6,0);wall(1.2,.5,0,1.6,0);hut.children.at(-1).position.y=2.2;
  for(const s of[-1,1]){const r=new THREE.Mesh(new THREE.BoxGeometry(4.8,.1,2.3),M.metal);r.position.set(0,2.95,s*.9);r.rotation.x=s*.42;hut.add(r)}
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),M.glassOn);lamp.position.set(0,2.3,1.75);hut.add(lamp);const hl=new THREE.PointLight(0xffc483,6,9,2);hl.position.set(0,2.2,2.1);hut.add(hl);
  const gen=new THREE.Mesh(new THREE.BoxGeometry(.9,.6,.6),M.olive);gen.position.set(2.8,.3,1.2);hut.add(gen)}
scene.add(shadowy(hut));
const SLOT_POS=[...Array(6)].map((_,i)=>{const a=i/6*Math.PI*2+Math.PI/6;return{x:Math.cos(a)*9,z:Math.sin(a)*9,a}});
const slotObjs=SLOT_POS.map(p=>{const g=new THREE.Group();g.position.set(p.x,0,p.z);g.rotation.y=-p.a+Math.PI/2;scene.add(g);const ring=new THREE.Mesh(new THREE.RingGeometry(1.1,1.25,40),new THREE.MeshBasicMaterial({color:0xffcf8a,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;g.add(ring);
  const light=new THREE.PointLight(0xffe3b8,0,24,2);light.position.y=4.4;g.add(light);return{g,ring,light,mesh:null,head:null,hp:0,max:0,cd:0,obs:[]}});

/* ---------- humanoid characters ---------- */
const GEO={torso:new THREE.CapsuleGeometry(.19,.34,4,12),hip:new THREE.CapsuleGeometry(.16,.12,4,10),uLeg:new THREE.CapsuleGeometry(.085,.34,4,8),lLeg:new THREE.CapsuleGeometry(.072,.34,4,8),foot:new THREE.BoxGeometry(.11,.08,.26),
  uArm:new THREE.CapsuleGeometry(.065,.24,4,8),lArm:new THREE.CapsuleGeometry(.055,.22,4,8),hand:new THREE.SphereGeometry(.058,10,8),head:new THREE.SphereGeometry(.125,18,14),hair:new THREE.SphereGeometry(.132,18,10,0,Math.PI*2,0,Math.PI*.55),neck:new THREE.CylinderGeometry(.055,.06,.1,8)};
function humanoid(c){const mat=(col,r=.85,m=0)=>new THREE.MeshStandardMaterial({color:col,roughness:r,metalness:m});const skin=mat(c.skin,.62),shirt=mat(c.shirt,.95),pants=mat(c.pants,.92),shoes=mat(c.shoes,.7),hair=mat(c.hair,.75);
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);const add=(p,g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o};
  const hips=add(body,GEO.hip,pants,0,.98,0);hips.rotation.z=Math.PI/2;hips.scale.set(1,1,.8);
  const torso=add(body,GEO.torso,shirt,0,1.34,0);torso.scale.set(1.05,1,.72);add(body,GEO.neck,skin,0,1.62,0);
  const head=new THREE.Group();head.position.set(0,1.74,0);body.add(head);add(head,GEO.head,skin);const hr=add(head,GEO.hair,hair,0,.012,-.01);hr.rotation.x=-.25;
  const leg=s=>{const hip=new THREE.Group();hip.position.set(s*.1,.95,0);body.add(hip);add(hip,GEO.uLeg,pants,0,-.22,0);const knee=new THREE.Group();knee.position.y=-.46;hip.add(knee);add(knee,GEO.lLeg,pants,0,-.2,0);add(knee,GEO.foot,shoes,0,-.44,.05);return{hip,knee}};
  const arm=s=>{const sh=new THREE.Group();sh.position.set(s*.27,1.5,0);body.add(sh);add(sh,GEO.uArm,shirt,0,-.17,0);const el=new THREE.Group();el.position.y=-.34;sh.add(el);add(el,GEO.lArm,c.sleeves===false?skin:shirt,0,-.14,0);const hand=add(el,GEO.hand,skin,0,-.3,0);return{sh,el,hand}};
  const L=leg(-1),Rl=leg(1),A=arm(-1),B=arm(1);shadowy(root);return{root,body,head,legL:L,legR:Rl,armL:A,armR:B,torso,mats:[skin,shirt,pants,shoes,hair],skin,shirt}}
function animHuman(h,ph,amt,mode,t){const sw=Math.sin(ph)*.65*amt;h.legL.hip.rotation.x=sw;h.legR.hip.rotation.x=-sw;h.legL.knee.rotation.x=Math.max(0,-Math.sin(ph))*.9*amt;h.legR.knee.rotation.x=Math.max(0,Math.sin(ph))*.9*amt;
  h.body.position.y=Math.abs(Math.sin(ph))*.04*amt;
  if(mode==='zombie'){const w=Math.sin(t*1.3+h.seed)*.12;h.armL.sh.rotation.set(-1.35+w,0,.08);h.armR.sh.rotation.set(-1.25-w,0,-.08);h.armL.el.rotation.x=-.2;h.armR.el.rotation.x=-.35;h.head.rotation.set(.25+Math.sin(t*.7+h.seed)*.08,0,Math.sin(t*.9+h.seed)*.25);h.body.rotation.z=Math.sin(ph*.5)*.06;h.torso.rotation.x=.15}
  else{h.armR.sh.rotation.set(-1.42+h.recoil*.25,0,-.05);h.armR.el.rotation.x=-.12;h.armL.sh.rotation.set(-1.28,0,.42);h.armL.el.rotation.x=-.5;if(h.reload>0){const k=Math.sin(h.reload*Math.PI);h.armL.sh.rotation.x=-1.28+k*.9;h.armL.el.rotation.x=-.5-k*.9;h.armR.sh.rotation.x=-1.1+k*.2}}}

/* player */
const PH=humanoid({skin:0xb08566,shirt:0x2f4446,pants:0x2a2b2f,shoes:0x1d1b19,hair:0x2b1f18});PH.seed=0;PH.recoil=0;PH.reload=0;scene.add(PH.root);
{const pack=new THREE.Mesh(new THREE.BoxGeometry(.34,.44,.2),M.olive);pack.position.set(0,1.36,-.21);PH.body.add(shadowy(pack));const scarf=new THREE.Mesh(new THREE.TorusGeometry(.12,.045,8,16),new THREE.MeshStandardMaterial({color:0x9c7a3e,roughness:1}));scarf.rotation.x=Math.PI/2;scarf.position.y=1.6;PH.body.add(scarf)}
const gunHolder=new THREE.Group();gunHolder.position.set(0,-.3,0);PH.armR.el.add(gunHolder);
const muzzleFx=new THREE.Mesh(new THREE.PlaneGeometry(.35,.35),new THREE.MeshBasicMaterial({color:0xffd08a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
function buildGun(id){gunHolder.clear();const g=new THREE.Group(),box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o};
  const L={pistol:.24,smg:.42,shotgun:.75,rifle:.85}[id];box(.05,.06,L,M.darkMetal,0,0,L/2-.05);box(.045,.12,.06,M.darkMetal,0,-.07,0);
  if(id==='smg')box(.04,.18,.05,M.darkMetal,0,-.12,.12);if(id==='shotgun'){box(.06,.07,.3,M.wood,0,-.02,-.2);box(.05,.05,.25,M.wood,0,-.05,.35)}if(id==='rifle'){box(.05,.08,.32,M.wood,0,-.02,-.22);const sc=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.3,10),M.darkMetal);sc.rotation.x=Math.PI/2;sc.position.set(0,.06,.3);g.add(sc)}
  const fl=new THREE.Mesh(new THREE.CylinderGeometry(.022,.026,.12,10),M.metal);fl.rotation.x=Math.PI/2;fl.position.set(0,-.045,Math.min(L*.6,.2));g.add(fl);
  g.rotation.x=Math.PI/2;g.position.set(0,-.02,.02);shadowy(g);gunHolder.add(g);muzzleFx.position.set(0,0,L+.08);g.add(muzzleFx);PH.gunLen=L}

/* ---------- volumetric torch beam ---------- */
const BEAM_LEN=20;const beamGeo=new THREE.ConeGeometry(Math.tan(.42)*BEAM_LEN,BEAM_LEN,40,12,true);beamGeo.translate(0,-BEAM_LEN/2,0);beamGeo.rotateX(-Math.PI/2);
const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uTime:{value:0},uI:{value:.05},uColor:{value:new THREE.Color(0xffd6a0)},uLen:{value:BEAM_LEN}},
  vertexShader:'varying float vT;varying vec3 vN,vV,vW;uniform float uLen;void main(){vT=position.z/uLen;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*mv;}',
  fragmentShader:`varying float vT;varying vec3 vN,vV,vW;uniform float uTime,uI;uniform vec3 uColor;
  float hs(vec3 p){return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5);}float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hs(i),hs(i+vec3(1,0,0)),f.x),mix(hs(i+vec3(0,1,0)),hs(i+vec3(1,1,0)),f.x),f.y),mix(mix(hs(i+vec3(0,0,1)),hs(i+vec3(1,0,1)),f.x),mix(hs(i+vec3(0,1,1)),hs(i+vec3(1,1,1)),f.x),f.y),f.z);}
  void main(){float e=pow(abs(dot(vN,vV)),1.6);float fall=pow(1.-vT,1.6)*smoothstep(0.,.06,vT);float n=.55+.45*vn(vW*.9+vec3(uTime*.35,uTime*.1,0.));gl_FragColor=vec4(uColor*e*fall*n*uI,1.);}`});
const beam=new THREE.Mesh(beamGeo,beamMat);beam.frustumCulled=false;scene.add(beam);

/* ---------- pools: tracers, sparks, shells ---------- */
const tracers=[...Array(28)].map(()=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffe2b0,transparent:true,opacity:0,blending:THREE.AdditiveBlending}));l.frustumCulled=false;scene.add(l);return{l,t:0}});
const SPARKN=260,sparks=new THREE.InstancedMesh(new THREE.BoxGeometry(.05,.05,.05),new THREE.MeshBasicMaterial({color:0xffffff}),SPARKN);sparks.frustumCulled=false;scene.add(sparks);const SP=[...Array(SPARKN)].map(()=>({life:0}));let spI=0;
const SHELLN=120,shells=new THREE.InstancedMesh(new THREE.CylinderGeometry(.013,.013,.045,6),M.brass,SHELLN);shells.castShadow=true;shells.frustumCulled=false;scene.add(shells);const SH=[...Array(SHELLN)].map(()=>({life:0,x:0,y:-5,z:0,vx:0,vy:0,vz:0,rx:0,rz:0}));let shI=0;
const tmpO=new THREE.Object3D(),tmpC=new THREE.Color();
function spark(x,y,z,col,n,sp=4){for(let i=0;i<n;i++){const s=SP[spI=(spI+1)%SPARKN];Object.assign(s,{x,y,z,vx:(rnd()-.5)*sp,vy:rnd()*sp*.8,vz:(rnd()-.5)*sp,life:.35+rnd()*.4,max:.75});sparks.setColorAt(spI,tmpC.set(col))}if(sparks.instanceColor)sparks.instanceColor.needsUpdate=true}
function tracer(a,b){const t=tracers.find(t=>t.t<=0)||tracers[0];t.l.geometry.attributes.position.setXYZ(0,a.x,a.y,a.z);t.l.geometry.attributes.position.setXYZ(1,b.x,b.y,b.z);t.l.geometry.attributes.position.needsUpdate=true;t.t=.05}

/* ---------- pickups ---------- */
const pickupGeo={box:new THREE.BoxGeometry(.5,.28,.3),lid:new THREE.BoxGeometry(.52,.05,.32),med:new THREE.BoxGeometry(.42,.24,.3),crossA:new THREE.BoxGeometry(.06,.01,.2),crossB:new THREE.BoxGeometry(.2,.01,.06)};
function makePickup(kind){const g=new THREE.Group();if(kind==='ammo'){const b=new THREE.Mesh(pickupGeo.box,M.olive);b.position.y=.14;const l=new THREE.Mesh(pickupGeo.lid,M.darkMetal);l.position.y=.3;g.add(b,l)}else{const b=new THREE.Mesh(pickupGeo.med,M.white);b.position.y=.12;const a=new THREE.Mesh(pickupGeo.crossA,M.red),c=new THREE.Mesh(pickupGeo.crossB,M.red);a.position.y=c.position.y=.25;g.add(b,a,c)}return shadowy(g)}

/* ---------- audio ---------- */
let AC=null,master=null,muted=store.get('ll_muted',false);
function initAudio(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:.55;master.connect(AC.destination);
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=600;lp.connect(master);const pad=AC.createGain();pad.gain.setValueAtTime(0,AC.currentTime);pad.gain.linearRampToValueAtTime(.05,AC.currentTime+5);pad.connect(lp);
  [110,164.81,220,261.63,329.63].forEach((f,i)=>{const o=AC.createOscillator(),v=AC.createGain(),l=AC.createOscillator(),lg=AC.createGain();o.type=i%2?'triangle':'sine';o.frequency.value=f;o.detune.value=(i-2)*5;v.gain.value=.18;l.frequency.value=.04+i*.027;lg.gain.value=.14;l.connect(lg);lg.connect(v.gain);o.connect(v);v.connect(pad);o.start();l.start()})}catch(e){AC=null}}
function tone(f,dur,{type='sine',vol=.12,at=0,to=0}={}){if(!AC)return;const t=AC.currentTime+at,o=AC.createOscillator(),v=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(vol,t+.008);v.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(v);v.connect(master);o.start(t);o.stop(t+dur+.05)}
function hiss(dur,vol,freq,at=0){if(!AC)return;const b=AC.createBuffer(1,AC.sampleRate*dur|0,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)**2;const s=AC.createBufferSource(),f=AC.createBiquadFilter(),v=AC.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=freq;f.Q.value=.9;v.gain.value=vol;s.connect(f);f.connect(v);v.connect(master);s.start(AC.currentTime+at)}
const SFX={pistol(){hiss(.22,.6,1200);tone(140,.18,{vol:.14,to:60})},smg(){hiss(.1,.45,1500);tone(170,.08,{vol:.08,to:80})},shotgun(){hiss(.45,.9,700);tone(90,.35,{vol:.2,to:40})},rifle(){hiss(.5,.7,2200);tone(120,.3,{vol:.18,to:45})},turret(){hiss(.08,.18,1700)},
  hit(){hiss(.08,.25,500)},empty(){tone(1400,.04,{type:'square',vol:.025})},magOut(){hiss(.06,.35,2600)},magIn(){hiss(.05,.4,3200);hiss(.07,.35,1800,.14);tone(900,.04,{type:'square',vol:.02,at:.15})},
  hurt(){tone(120,.35,{type:'triangle',vol:.14,to:80})},pick(){tone(660,.16,{vol:.06});tone(990,.22,{vol:.05,at:.08})},flare(){hiss(.8,.35,500);tone(330,.9,{vol:.05,to:660})},buy(){tone(523,.2,{vol:.07});tone(784,.3,{vol:.06,at:.1})},
  chime(){[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,1.4,{vol:.07,at:i*.12}))},dawn(){[392,493.88,587.33,739.99,880].forEach((f,i)=>tone(f,2.6,{vol:.06,at:i*.25}))}};

/* =========================================================
   Career data
   ========================================================= */
const WEAPONS={pistol:{ad:'Tabanca',price:0,dmg:1,mag:8,rate:.24,reload:1.3,spread:.025,pellets:1,auto:false,range:40,pierce:1,box:16,start:24,max:72,desc:'Güvenilir, yarı otomatik.'},
  smg:{ad:'Hafif makineli',price:350,dmg:.6,mag:30,rate:.075,reload:2,spread:.07,pellets:1,auto:true,range:30,pierce:1,box:45,start:60,max:180,desc:'Tam otomatik, kalabalığı tarar.'},
  shotgun:{ad:'Pompalı',price:550,dmg:.75,mag:6,rate:.75,reload:2.4,spread:.2,pellets:7,auto:false,range:16,pierce:1,box:12,start:18,max:48,desc:'Yakın mesafede durdurur.'},
  rifle:{ad:'Tüfek',price:900,dmg:3.5,mag:5,rate:.9,reload:2.2,spread:.006,pellets:1,auto:false,range:60,pierce:3,box:10,start:15,max:40,desc:'Delip geçer, iri zombiler için.'}};
const W_ORDER=['pistol','smg','shotgun','rifle'];
const UPG={dmg:{ad:'Mermi hasarı',max:5,c:l=>120+l*110,d:'+15% hasar'},mag:{ad:'Geniş şarjör',max:4,c:l=>140+l*120,d:'+20% şarjör'},reload:{ad:'Hızlı değiştirme',max:4,c:l=>110+l*100,d:'-12% değiştirme süresi'},
  hp:{ad:'Dayanıklılık',max:5,c:l=>150+l*130,d:'+1 can'},torch:{ad:'Güçlü el feneri',max:3,c:l=>160+l*160,d:'+4 m menzil, daha çok yavaşlatır'},ammo:{ad:'Mermi kemeri',max:3,c:l=>130+l*120,d:'+30% yedek mermi'}};
const BUILD={barricade:{ad:'Barikat',cost:[80,160,280],d:'Yolu keser, zombiler kırmaya çalışır.'},light:{ad:'Projektör',cost:[150,260,400],d:'Işığına zombi giremez.'},
  turret:{ad:'Taret',cost:[300,480,700],d:'Yakındaki zombilere kendiliğinden ateş eder.'},fire:{ad:'Kamp ateşi',cost:[120,220,350],d:'Yanında dururken canını yeniler.'}};
const NEW_CAREER=()=>({night:1,scrap:0,owned:['pistol'],upg:{},slots:[null,null,null,null,null,null],kills:0,best:0});
let career=store.get('ll_career',null);
const save=()=>store.set('ll_career',career);
const ul=k=>(career&&career.upg[k])||0;

/* ---------- base building meshes ---------- */
function buildSlot(i){const s=slotObjs[i],d=career.slots[i];if(s.mesh){s.g.remove(s.mesh);s.mesh=null;s.head=null}s.light.intensity=0;s.obs=[];
  if(!d)return;const g=new THREE.Group(),L=d.lvl,box=(w,h,dd,m,x,y,z,p=g)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,dd),m);o.position.set(x,y,z);p.add(o);return o},cyl=(r1,r2,h,m,x,y,z,p=g)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),m);o.position.set(x,y,z);p.add(o);return o};
  if(d.type==='barricade'){for(const x of[-2,0,2])cyl(.09,.11,1.5,M.bark,x,.75,0);for(let k=0;k<3;k++)box(4.6,.22,.08,M.wood,0,.35+k*.42,.1).rotation.z=(rnd()-.5)*.06;
    if(L>=2)for(let k=0;k<7;k++){const sb=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.32,4,8),M.cloth);sb.rotation.z=Math.PI/2;sb.position.set(-1.95+k*.65,.15,-.25);g.add(sb)}
    if(L>=3)box(4.6,1.1,.05,M.metal,0,.75,.18);
    const wp=new THREE.Vector3();for(const x of[-1.8,-.6,.6,1.8]){wp.set(x,0,0);s.g.localToWorld(wp);s.obs.push({x:wp.x,z:wp.z,r:.75,k:'barricade',slot:i})}}
  if(d.type==='light'){cyl(.07,.09,4.4,M.darkMetal,0,2.2,0);for(let k=0;k<L;k++){const h=new THREE.Group();h.position.set(0,4.4,0);h.rotation.y=k*2.1;g.add(h);box(.36,.26,.3,M.darkMetal,0,0,.15,h);const lens=new THREE.Mesh(new THREE.CircleGeometry(.12,16),M.glassOn);lens.position.set(0,0,.31);h.add(lens)}s.light.intensity=40+L*25;s.light.distance=14+L*5}
  if(d.type==='turret'){for(let k=0;k<3;k++){const a=k/3*Math.PI*2,leg=cyl(.04,.05,1.3,M.darkMetal,Math.cos(a)*.35,.6,Math.sin(a)*.35);leg.rotation.set(Math.sin(a)*.3,0,-Math.cos(a)*.3)}
    const head=new THREE.Group();head.position.y=1.25;g.add(head);box(.5,.32,.6,M.olive,0,0,0,head);for(let k=0;k<L;k++){const b=cyl(.035,.035,.7,M.darkMetal,(k-(L-1)/2)*.1,.02,.6,head);b.rotation.x=Math.PI/2}s.head=head}
  if(d.type==='fire'){for(let k=0;k<9;k++){const a=k/9*Math.PI*2,st=new THREE.Mesh(new THREE.DodecahedronGeometry(.16),M.stone);st.position.set(Math.cos(a)*.6,.08,Math.sin(a)*.6);g.add(st)}
    for(let k=0;k<3;k++){const lg=cyl(.07,.08,.9,M.bark,0,.15,0);lg.rotation.set(Math.PI/2-.3,k*1.05,0)}const fl=new THREE.Group();fl.position.y=.25;g.add(fl);for(let k=0;k<3;k++){const c=new THREE.Mesh(new THREE.ConeGeometry(.22-k*.04,.7+k*.2,8),M.flame);c.position.set((k-1)*.1,.35,0);fl.add(c)}s.head=fl;s.light.position.y=1;s.light.color.set(0xff9a4a);s.light.intensity=18+L*8;s.light.distance=10+L*2}
  else s.light.position.y=4.4,s.light.color.set(0xffe3b8);
  shadowy(g);g.traverse(c=>{if(c.material===M.flame||c.material===M.glassOn)c.castShadow=false});s.g.add(g);s.mesh=g;s.max=60*L+40;s.hp=s.max}
function rebuildBase(){for(let i=0;i<6;i++)buildSlot(i);OBS.length=STATIC_OBS;for(const s of slotObjs)OBS.push(...s.obs)}

/* =========================================================
   Game state
   ========================================================= */
let state='title',P,zs=[],pickups=[],G={};
const keys={},mouse={x:innerWidth/2,y:innerHeight/2,on:false,down:false,press:false},touch={joy:null,aim:null,jx:0,jy:0};
const ZSHIRTS=[0x4e5a4c,0x5d4f45,0x4a5566,0x6a6250,0x5a4a52,0x3f4a48,0x6d5d4a],ZSKIN=[0x6f7a66,0x7a7868,0x677162,0x807a6a],ZPANTS=[0x2e3035,0x3b352c,0x2b3238];
function nightCfg(n){return{dur:100+15*n,cap:Math.min(30,6+n*2),every:Math.max(.55,2.2-n*.15),run:n>=3?Math.min(.35,(n-2)*.07):0,brute:n>=5?Math.min(.22,(n-4)*.045):0,hp:1+n*.08}}
function wStats(id){const w=WEAPONS[id];return{...w,dmg:w.dmg*(1+.15*ul('dmg')),mag:Math.round(w.mag*(1+.2*ul('mag'))),reload:w.reload*(1-.12*ul('reload')),maxRes:Math.round(w.max*(1+.3*ul('ammo')))}}
function startNight(){const n=career.night,cfg=nightCfg(n);placeLanterns(n);paintGround();syncLanterns();rebuildBase();
  for(const z of zs)disposeZ(z);zs=[];for(const p of pickups)scene.remove(p.g);pickups=[];
  const ammo={};for(const id of career.owned){const s=wStats(id);ammo[id]={mag:s.mag,res:Math.round(WEAPONS[id].start*(1+.3*ul('ammo')))}}
  P={x:0,z:4.5,ang:Math.PI,hp:5+ul('hp'),max:5+ul('hp'),inv:0,calm:0,ph:0,cur:career.owned.includes(G.lastW)?G.lastW:'pistol',ammo,reloadT:0,fireCd:0};
  G={...G,cfg,t:0,spawnT:4,flareCd:0,flareT:0,kills:0,earned:0,lit:0,dawn:0,ending:0,hurt:0};buildGun(P.cur);
  for(let i=0;i<9;i++)spawnPickup(true);state='night';showHud(true);closeOverlay();toast(`Gece ${n} — şafağa kadar dayan. Fenerleri yakmak ek hurda verir.`,5)}
function spawnPickup(init){for(let k=0;k<40;k++){const a=rnd()*7,d=init?8+rnd()*55:14+rnd()*30,x=(init?0:P.x)+Math.cos(a)*d,z=(init?0:P.z)+Math.sin(a)*d;
  if(Math.abs(x)>W-6||Math.abs(z)>W-6||OBS.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+.8))continue;const kind=rnd()<.17?'med':'ammo',g=makePickup(kind);g.position.set(x,0,z);g.rotation.y=rnd()*7;scene.add(g);pickups.push({x,z,kind,g,ph:rnd()*9});return}}
function spawnZombie(){const c=G.cfg;for(let k=0;k<30;k++){const a=rnd()*7,d=24+rnd()*10,x=P.x+Math.cos(a)*d,z=P.z+Math.sin(a)*d;
  if(Math.abs(x)>W-4||Math.abs(z)>W-4||OBS.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+.6))continue;if(inSafeLight(x,z,2))continue;
  const r=rnd(),type=r<c.brute?'brute':r<c.brute+c.run?'runner':'walker',h=humanoid({skin:pick(ZSKIN),shirt:type==='brute'?0x3a3330:pick(ZSHIRTS),pants:pick(ZPANTS),shoes:0x1c1a18,hair:0x1e1b16,sleeves:rnd()<.5});
  h.seed=rnd()*9;const sc=type==='brute'?1.32:.92+rnd()*.14;h.root.scale.setScalar(sc);h.root.position.set(x,0,z);scene.add(h.root);
  const base={walker:[2,1.1+rnd()*.5],runner:[1.4,2.8+rnd()*.4],brute:[8,1.05]}[type];
  zs.push({h,x,z,type,hp:base[0]*c.hp,sp:base[1],a:Math.atan2(P.x-x,P.z-z),ph:rnd()*9,wa:rnd()*7,kx:0,kz:0,stun:0,hit:0,dead:0,fade:1,dying:false,r:type==='brute'?.55:.4,dmg:type==='brute'?2:1,atk:0});return}}
function disposeZ(z){scene.remove(z.h.root);z.h.mats.forEach(m=>m.dispose())}
function inSafeLight(x,z,pad=0){for(const l of LAN)if(l.lit&&Math.hypot(x-l.x,z-l.z)<9+pad)return true;for(let i=0;i<6;i++){const d=career.slots[i];if(d&&d.type==='light'&&Math.hypot(x-SLOT_POS[i].x,z-SLOT_POS[i].z)<6+2*d.lvl+pad)return true}return false}

/* ---------- combat ---------- */
const v3=new THREE.Vector3(),v3b=new THREE.Vector3();
function muzzlePos(o){PH.root.updateMatrixWorld(true);return muzzleFx.getWorldPosition(o)}
function fire(){const id=P.cur,w=wStats(id),am=P.ammo[id];if(P.reloadT>0)return;if(am.mag<=0){P.fireCd=.3;if(am.res>0)reload();else{SFX.empty();nudge('ammo');toast('Bu silahın mermisi bitti — kutu ara ya da silah değiştir (1-4)',3)}return}
  am.mag--;P.fireCd=w.rate;PH.recoil=1;SFX[id]();muzzle.intensity=id==='shotgun'?60:35;muzzleFx.material.opacity=1;muzzleFx.rotation.z=rnd()*3;const mp=muzzlePos(v3b.clone());muzzle.position.copy(mp);
  for(let k=0;k<w.pellets;k++){const a=P.ang+(rnd()-.5)*w.spread*2,dx=Math.sin(a),dz=Math.cos(a);let maxD=w.range;
    for(const o of OBS){const ox=o.x-P.x,oz=o.z-P.z,t=ox*dx+oz*dz;if(t<0||t>maxD)continue;const pd=Math.abs(ox*dz-oz*dx);if(pd<o.r){const hitT=t-Math.sqrt(o.r*o.r-pd*pd);if(hitT<maxD&&hitT>.3){maxD=hitT}}}
    const hits=[];for(const z of zs){if(z.dead||z.dying)continue;const ox=z.x-P.x,oz=z.z-P.z,t=ox*dx+oz*dz;if(t<0||t>maxD)continue;if(Math.abs(ox*dz-oz*dx)<z.r)hits.push([t,z])}hits.sort((a,b)=>a[0]-b[0]);
    let end=maxD;for(let j=0;j<Math.min(w.pierce,hits.length);j++){const[t,z]=hits[j];damageZ(z,w.dmg,dx,dz);end=t;spark(P.x+dx*t,1.2,P.z+dz*t,0x2e3229,5,3)}
    if(!hits.length&&maxD<w.range)spark(P.x+dx*maxD,1.1,P.z+dz*maxD,0xffd59a,5,3);if(hits.length>=w.pierce||!hits.length)end=Math.min(end,maxD);
    tracer(mp,v3.set(P.x+dx*end,1.15,P.z+dz*end))}
  const s=SH[shI=(shI+1)%SHELLN],ra=P.ang-Math.PI/2;Object.assign(s,{x:mp.x,y:mp.y,z:mp.z,vx:Math.sin(ra)*2+(rnd()-.5),vy:2+rnd(),vz:Math.cos(ra)*2+(rnd()-.5),life:12,rx:rnd()*7,rz:rnd()*7});
  if(am.mag===0&&am.res>0)toast('Şarjör boş — R',1.6)}
function damageZ(z,d,dx,dz){z.hp-=d;z.hit=.12;z.kx+=dx*3;z.kz+=dz*3;z.stun=Math.max(z.stun,.25);SFX.hit();if(z.hp<=0&&!z.dead){z.dead=.001;G.kills++;const s={walker:8,runner:12,brute:35}[z.type];G.earned+=s;if(rnd()<.25)dropAt(z.x,z.z)}}
function dropAt(x,z){const g=makePickup('ammo');g.position.set(x,0,z);scene.add(g);pickups.push({x,z,kind:'ammo',g,ph:0})}
function reload(){const id=P.cur,w=wStats(id),am=P.ammo[id];if(P.reloadT>0||am.mag>=w.mag||am.res<=0||state!=='night')return;P.reloadT=w.reload;P.reloadMax=w.reload;SFX.magOut()}
function switchW(id){if(!career.owned.includes(id)||id===P.cur||state!=='night')return;P.cur=id;G.lastW=id;P.reloadT=0;buildGun(id);P.fireCd=.25;tone(500,.05,{type:'square',vol:.02})}
function flare(){if(G.flareCd>0||state!=='night')return;G.flareCd=9;G.flareT=.9;SFX.flare();for(const z of zs){if(z.dead)continue;const dx=z.x-P.x,dz=z.z-P.z,d=Math.hypot(dx,dz)||1;if(d<9){z.stun=2.8;z.kx+=dx/d*9;z.kz+=dz/d*9}}spark(P.x,1.5,P.z,0xffe2a8,30,7)}

/* ---------- update ---------- */
let time=0;
function pushOut(o,r){for(const b of OBS){if(b.k==='barricade'&&slotObjs[b.slot].hp<=0)continue;const dx=o.x-b.x,dz=o.z-b.z,d=Math.hypot(dx,dz),m=b.r+r;if(d<m&&d>0){o.x=b.x+dx/d*m;o.z=b.z+dz/d*m;if(o.onBlock)o.onBlock(b)}}}
function update(dt){G.t+=dt;const cfg=G.cfg;
  let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);if(touch.joy){mx=touch.jx;mz=touch.jy}const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
  const spd=P.reloadT>0?3.1:4.2;P.x+=mx*spd*dt;P.z+=mz*spd*dt;pushOut(P,.38);P.x=clamp(P.x,-W+3,W-3);P.z=clamp(P.z,-W+3,W-3);P.ph+=dt*ml*9;
  let ta=P.ang;if(touch.aim)ta=touch.aim.ang;else if(mouse.on){const g=groundPoint(mouse.x,mouse.y);if(g)ta=Math.atan2(g.x-P.x,g.z-P.z)}else if(ml>.1)ta=Math.atan2(mx,mz);
  let da=ta-P.ang;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;P.ang+=da*Math.min(1,dt*18);
  P.fireCd-=dt;const w=WEAPONS[P.cur],want=touch.aim?true:(w.auto?mouse.down:mouse.press);if(want&&P.fireCd<=0)fire();mouse.press=false;
  if(P.reloadT>0){P.reloadT-=dt;if(P.reloadT<=0){P.reloadT=0;const s=wStats(P.cur),am=P.ammo[P.cur],n=Math.min(s.mag-am.mag,am.res);am.mag+=n;am.res-=n;SFX.magIn()}}
  PH.recoil=Math.max(0,PH.recoil-dt*9);PH.reload=P.reloadT>0?1-P.reloadT/P.reloadMax:0;
  G.flareCd=Math.max(0,G.flareCd-dt);G.flareT=Math.max(0,G.flareT-dt);P.inv=Math.max(0,P.inv-dt);G.hurt=Math.max(0,G.hurt-dt*1.3);
  P.calm+=dt;if(P.calm>12&&P.hp<P.max){P.hp++;P.calm=6}
  for(const l of LAN){l.fl+=dt;if(l.lit)continue;if(Math.hypot(P.x-l.x,P.z-l.z)<2.3){l.prog+=dt/1.7;if(l.prog>=1){l.lit=true;G.lit++;G.earned+=40;SFX.chime();syncLanterns();spark(l.x,2.9,l.z,0xffcf8a,24,4);
    for(const z of zs){const dx=z.x-l.x,dz=z.z-l.z,d=Math.hypot(dx,dz)||1;if(d<11){z.kx+=dx/d*8;z.kz+=dz/d*8;z.stun=1.5}}toast(`${G.lit}/5 fener yandı · +40 hurda`,3)}}else l.prog=Math.max(0,l.prog-dt*.6)}
  const dawning=G.t>=cfg.dur;
  if(!dawning){G.spawnT-=dt;if(G.spawnT<=0){G.spawnT=cfg.every;if(zs.filter(z=>!z.dead&&!z.dying).length<cfg.cap)spawnZombie()}}
  if(pickups.length<5&&rnd()<dt*.4)spawnPickup();
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.ph+=dt;p.g.position.y=Math.sin(p.ph*2)*.03;if(Math.hypot(P.x-p.x,P.z-p.z)<1.2){if(p.kind==='ammo'){const s=wStats(P.cur),am=P.ammo[P.cur];if(am.res>=s.maxRes){const other=career.owned.find(id=>P.ammo[id].res<wStats(id).maxRes);if(!other)continue;P.ammo[other].res=Math.min(wStats(other).maxRes,P.ammo[other].res+WEAPONS[other].box)}else am.res=Math.min(s.maxRes,am.res+WEAPONS[P.cur].box)}else{if(P.hp>=P.max)continue;P.hp=Math.min(P.max,P.hp+2)}SFX.pick();scene.remove(p.g);pickups.splice(i,1)}}
  const torchR=22+4*ul('torch'),slow=.35-.07*ul('torch');
  for(let i=zs.length-1;i>=0;i--){const z=zs[i];
    if(z.dead){z.dead+=dt;const f=Math.min(1,z.dead*2.6);z.h.body.rotation.x=-f*Math.PI/2*.98;z.h.body.position.y=.1*f;if(z.dead>5){z.h.root.position.y=-(z.dead-5)*.3}if(z.dead>7){disposeZ(z);zs.splice(i,1)}continue}
    z.hit=Math.max(0,z.hit-dt);z.h.skin.emissive.setScalar(z.hit*3);z.h.shirt.emissive.setScalar(z.hit*2);
    if(dawning&&!z.dying&&rnd()<dt*.9)z.dying=true;if(z.dying){z.fade-=dt/1.6;z.h.root.position.y=-(1-z.fade)*1.9;if(z.fade<=0){disposeZ(z);zs.splice(i,1);continue}}
    const dx=P.x-z.x,dz=P.z-z.z,d=Math.hypot(dx,dz)||1;if(d>70){disposeZ(z);zs.splice(i,1);continue}
    const lit=d<torchR&&angDiff(Math.atan2(-dx,-dz),P.ang)<.44;let sp=z.sp*(lit&&z.type!=='brute'?slow:lit?.7:1);if(z.stun>0){z.stun-=dt;sp=0}if(z.atk>0){z.atk-=dt;sp*=.2}
    z.wa+=(rnd()-.5)*dt*3;let vx=dx/d+Math.sin(z.wa)*.35,vz=dz/d+Math.cos(z.wa)*.35;const vl=Math.hypot(vx,vz)||1;vx=vx/vl*sp;vz=vz/vl*sp;
    for(const l of LAN)if(l.lit){const lx=z.x-l.x,lz=z.z-l.z,ld=Math.hypot(lx,lz)||1;if(ld<9.5){vx+=lx/ld*5;vz+=lz/ld*5}}
    for(let s=0;s<6;s++){const dd=career.slots[s];if(dd&&dd.type==='light'){const R2=6+2*dd.lvl,lx=z.x-SLOT_POS[s].x,lz=z.z-SLOT_POS[s].z,ld=Math.hypot(lx,lz)||1;if(ld<R2+.5){vx+=lx/ld*5;vz+=lz/ld*5}}}
    for(const o of zs)if(o!==z&&!o.dead){const ox=z.x-o.x,oz=z.z-o.z,od=Math.hypot(ox,oz)||1,m=z.r+o.r;if(od<m){vx+=ox/od*1.6;vz+=oz/od*1.6}}
    z.x+=(vx+z.kx)*dt;z.z+=(vz+z.kz)*dt;const kd=Math.exp(-6*dt);z.kx*=kd;z.kz*=kd;
    z.onBlock=b=>{if(b.k==='barricade'){const so=slotObjs[b.slot];so.hp-=dt*(z.type==='brute'?18:7);if(so.hp<=0&&so.mesh&&so.mesh.visible){so.mesh.visible=false;hiss(.6,.4,300);toast('Bir barikat yıkıldı',2)}}};pushOut(z,z.r);z.onBlock=null;
    let td=Math.atan2(dx,dz)-z.a;while(td>Math.PI)td-=Math.PI*2;while(td<-Math.PI)td+=Math.PI*2;z.a+=td*Math.min(1,dt*5);z.ph+=dt*sp*2.4;
    if(!z.dying&&z.stun<=0&&d<z.r+.45&&P.inv<=0){P.hp-=z.dmg;P.inv=1.3;P.calm=0;G.hurt=1;SFX.hurt();z.kx-=dx/d*5;z.kz-=dz/d*5;z.stun=.7;z.atk=.5;if(P.hp<=0){endNight(false);return}}}
  for(let s=0;s<6;s++){const d=career.slots[s],so=slotObjs[s];if(!d)continue;
    if(d.type==='turret'){so.cd-=dt;let best=null,bd=12+3*d.lvl;for(const z of zs){if(z.dead||z.dying)continue;const zd=Math.hypot(z.x-SLOT_POS[s].x,z.z-SLOT_POS[s].z);if(zd<bd){bd=zd;best=z}}
      if(best){const wa=Math.atan2(best.x-SLOT_POS[s].x,best.z-SLOT_POS[s].z)-so.g.rotation.y;so.head.rotation.y=wa;if(so.cd<=0){so.cd=.7/d.lvl+.15;damageZ(best,1,(best.x-SLOT_POS[s].x)/bd,(best.z-SLOT_POS[s].z)/bd);SFX.turret();tracer(v3.set(SLOT_POS[s].x,1.3,SLOT_POS[s].z),v3b.set(best.x,1.2,best.z));spark(best.x,1.2,best.z,0x2e3229,3,2)}}}
    if(d.type==='fire'){so.head.children.forEach((c,k)=>{c.scale.y=1+Math.sin(time*9+k*2)*.18;c.scale.x=1+Math.sin(time*13+k)*.08});so.light.intensity=(18+d.lvl*8)*(1+Math.sin(time*11)*.08+Math.sin(time*23)*.05);
      if(Math.hypot(P.x-SLOT_POS[s].x,P.z-SLOT_POS[s].z)<4.5){so.cd-=dt;if(so.cd<=0&&P.hp<P.max){P.hp++;so.cd=5-d.lvl;spark(P.x,1,P.z,0xffb26b,8,2)}}}}
  if(dawning){G.dawn=Math.min(1,G.dawn+dt/6);if(G.dawn>=1&&!G.ending){G.ending=1;SFX.dawn();setTimeout(()=>endNight(true),1200)}}
  if(mouse.on||touch.aim)$('stage').style.cursor='none'}
function endNight(won){if(state!=='night')return;state='summary';showHud(false);const n=career.night;let gain=G.earned,txt;
  if(won){const bonus=80+25*n;gain+=bonus;career.scrap+=gain;career.night++;career.kills+=G.kills;career.best=Math.max(career.best,n);txt=`Gece ${n} bitti. ${G.kills} zombi durdurdun, ${G.lit}/5 fener yaktın. Gece ödülü ${bonus} dahil toplam +${gain} hurda.`}
  else{gain=Math.floor(gain/2);career.scrap+=gain;career.kills+=G.kills;txt=`Gece seni yere serdi. Topladığın hurdanın yarısını (+${gain}) üsse getirebildin. Gece ${n}'i yeniden deneyebilirsin.`}
  save();overlay(`<h1>${won?'Günaydın':'Geri çekil'}</h1><p>${txt}</p><button class="go" data-act="hub">Üsse dön</button>`)}

/* ---------- camera, aiming, per-frame visuals ---------- */
const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.1),ndc=new THREE.Vector2();
function groundPoint(sx,sy){ndc.set(sx/innerWidth*2-1,-(sy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(plane,new THREE.Vector3())}
const camPos=new THREE.Vector3(0,22,18),camLook=new THREE.Vector3();
function placeCharacters(dt){PH.root.position.set(P.x,0,P.z);PH.root.rotation.y=P.ang;animHuman(PH,P.ph,Math.min(1,Math.hypot((keys.KeyD||keys.KeyA||keys.KeyW||keys.KeyS||touch.joy)?1:0,0)),'aim',time);
  for(const z of zs){z.h.root.position.x=z.x;z.h.root.position.z=z.z;z.h.root.rotation.y=z.a;if(!z.dead)animHuman(z.h,z.ph,z.stun>0?.15:z.type==='runner'?1.2:.75,'zombie',time)}}
function lightRig(dt){const fx=Math.sin(P.ang),fz=Math.cos(P.ang);flash.position.set(P.x+fx*.45,1.35,P.z+fz*.45);flash.target.position.set(P.x+fx*10,0,P.z+fz*10);
  const tr=ul('torch');flash.distance=48+tr*8;flash.intensity=PARAMS.flash*(1+tr*.18);flash.angle=.42;
  bounce.position.set(P.x+fx*6,1.2,P.z+fz*6);bounce.intensity=PARAMS.bounce*(flash.intensity>0?1:0);
  beam.position.copy(flash.position);beam.lookAt(flash.target.position);beamMat.uniforms.uI.value=flash.intensity>0?.06:0;
  const ts=68/Q.sh,mx=Math.round(P.x/ts)*ts,mz=Math.round(P.z/ts)*ts;moon.target.position.set(mx,0,mz);moon.position.set(mx+MOON_DIR.x*70,MOON_DIR.y*70,mz+MOON_DIR.z*70);
  muzzle.intensity*=Math.exp(-dt*40);muzzleFx.material.opacity*=Math.exp(-dt*45);flareL.position.set(P.x,2.5,P.z);flareL.intensity=G.flareT>0?G.flareT*90:0;
  const dawn=state==='night'?G.dawn:0;moon.intensity=PARAMS.moon*(1+dawn*2.5);moon.color.copy(kelvin(lerp(PARAMS.moonTemp,3600,dawn)));hemi.intensity=PARAMS.hemi*(1+dawn*4);scene.fog.density=PARAMS.fog*(1-dawn*.5);
  for(const l of LAN){const o=lanternObjs[LAN.indexOf(l)];if(l.lit)o.light.intensity=PARAMS.lantern*(1+Math.sin(time*9+l.fl)*.05+Math.sin(time*23+l.fl)*.03)}}
function particles(dt){for(let i=0;i<SPARKN;i++){const s=SP[i];if(s.life<=0){tmpO.position.set(0,-50,0);tmpO.scale.setScalar(0)}else{s.life-=dt;s.vy-=9*dt;s.x+=s.vx*dt;s.y=Math.max(.02,s.y+s.vy*dt);s.z+=s.vz*dt;tmpO.position.set(s.x,s.y,s.z);tmpO.scale.setScalar(Math.max(0,s.life/s.max))}tmpO.rotation.set(0,0,0);tmpO.updateMatrix();sparks.setMatrixAt(i,tmpO.matrix)}sparks.instanceMatrix.needsUpdate=true;
  for(let i=0;i<SHELLN;i++){const s=SH[i];if(s.life>0){s.life-=dt;if(s.y>.015||s.vy>0){s.vy-=9.8*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.rx+=dt*20;if(s.y<.015){s.y=.015;s.vy=-s.vy*.3;s.vx*=.5;s.vz*=.5;if(Math.abs(s.vy)<.4){s.vy=0;s.rx=Math.PI/2}}}}
    tmpO.position.set(s.x,s.life>0?s.y:-5,s.z);tmpO.rotation.set(s.rx,0,s.rz);tmpO.scale.setScalar(s.life>0?Math.min(1,s.life):0);tmpO.updateMatrix();shells.setMatrixAt(i,tmpO.matrix)}shells.instanceMatrix.needsUpdate=true;
  for(const t of tracers){t.t-=dt;t.l.material.opacity=t.t>0?.9:0}}
function exposure(dt){const base=PARAMS.exposure;if(CALIB||!ae.ok){renderer.toneMappingExposure=base;return}const tgt=base*clamp(Math.pow(PARAMS.aeRef/Math.max(ae.avg,1e-4),.5),.6,1.8);renderer.toneMappingExposure+=(tgt-renderer.toneMappingExposure)*Math.min(1,dt*1.5)}
function applyGrade(){grade.uniforms.uSat.value=PARAMS.sat;grade.uniforms.uContrast.value=PARAMS.contrast;grade.uniforms.uLift.value.set(PARAMS.liftB*.35,PARAMS.liftB*.6,PARAMS.liftB);grade.uniforms.uTime.value=time%10}

/* ---------- HUD ---------- */
const heartSvg=f=>`<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 5 6.7 5c2.1 0 3.6 1.2 5.3 3.1C13.7 6.2 15.2 5 17.3 5c3.4 0 5.5 3.4 4.2 6.7C19.5 16.4 12 21 12 21z" fill="${f?'#e98b8b':'none'}" stroke="#e98b8b" stroke-width="1.6" opacity="${f?1:.45}"/></svg>`;
let hudKey='';
function hud(){if(state!=='night')return;const s=wStats(P.cur),am=P.ammo[P.cur],key=[P.hp,P.max,P.cur,am.mag,am.res,G.lit,career.scrap+G.earned,P.reloadT>0].join('|');
  if(key!==hudKey){hudKey=key;$('hearts').innerHTML=Array.from({length:P.max},(_,i)=>heartSvg(i<P.hp)).join('');
    const rounds=s.mag<=12?Array.from({length:s.mag},(_,i)=>`<i class="rnd${i<am.mag?'':' off'}"></i>`).join(''):`<b>${am.mag}</b><span class="dim">/${s.mag}</span>`;
    $('ammo').innerHTML=`<span class="wname">${WEAPONS[P.cur].ad}</span>${rounds}<span class="sep">|</span><b>${am.res}</b>${P.reloadT>0?'<span class="dim">değiştiriliyor</span><i class="bar" id="rbar"></i>':''}`;
    $('lan').innerHTML=`<span>Fenerler</span>`+LAN.map(l=>`<i class="dot${l.lit?' on':''}"></i>`).join('');$('scrap').innerHTML=`<svg viewBox="0 0 24 24"><path d="M4 15l4-8h8l4 8-8 5z" fill="#c9a24e"/></svg><b>${career.scrap+G.earned}</b>`;
    $('wlist').innerHTML=W_ORDER.map((id,i)=>career.owned.includes(id)?`<span class="${id===P.cur?'on':''}">${i+1}</span>`:'').join('')}
  const rb=$('rbar');if(rb&&P.reloadT>0)rb.style.width=((1-P.reloadT/P.reloadMax)*100).toFixed(1)+'%';
  $('dawnFill').style.width=(Math.min(1,G.t/G.cfg.dur)*100).toFixed(1)+'%';$('dawnTxt').textContent=G.t>=G.cfg.dur?'Şafak':`Şafağa ${Math.ceil(G.cfg.dur-G.t)} sn`;
  const fb=$('flareBtn');fb.style.setProperty('--p',(1-G.flareCd/9).toFixed(3));fb.firstChild.textContent=G.flareCd>0?Math.ceil(G.flareCd):'Fişek';
  $('vig').style.opacity=G.hurt.toFixed(2);
  arrow('lanArrow',LAN.filter(l=>!l.lit).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0]);arrow('baseArrow',Math.hypot(P.x,P.z)>30?{x:0,z:0}:null)}
function arrow(id,t){const el=$(id);if(!t){el.style.display='none';return}v3.set(t.x,1,t.z).project(camera);const sx=(v3.x*.5+.5)*innerWidth,sy=(-v3.y*.5+.5)*innerHeight;
  if(sx>30&&sy>30&&sx<innerWidth-30&&sy<innerHeight-30&&v3.z<1){el.style.display='none';return}const a=Math.atan2(sy-innerHeight/2,sx-innerWidth/2),r=Math.min(innerWidth,innerHeight)/2-46;el.style.display='block';el.style.transform=`translate(${innerWidth/2+Math.cos(a)*r-14}px,${innerHeight/2+Math.sin(a)*r-14}px) rotate(${a}rad)`}
let toastT=0;function toast(t,dur=4){const el=$('toast');el.textContent=t;el.classList.add('show');toastT=dur}
function nudge(id){const a=$(id);a.classList.remove('empty');void a.offsetWidth;a.classList.add('empty')}
function showHud(on){document.body.classList.toggle('playing',on)}

/* ---------- overlays: title, hub, pause ---------- */
const ov=$('overlay'),card=$('card');let hubTab='weapons',selSlot=0;
function overlay(html,wide){card.className='card'+(wide?' wide':'');card.innerHTML=html;ov.classList.add('show');$('stage').style.cursor='default';mouse.down=false;setTimeout(()=>{const b=card.querySelector('.go');if(b)b.focus()},40)}
function closeOverlay(){ov.classList.remove('show')}
function title(){state='title';showHud(false);const has=!!career;overlay(`<h1>Lanternlight</h1><p>Her gece biraz daha uzun, biraz daha kalabalık. Üssünü güçlendir, silahlarını geliştir, şafağı gör.</p>
  <div class="keys"><span>WASD</span><span>yürü</span><span>Fare</span><span>el fenerini çevir</span><span>Tık</span><span>ateş</span><span>R</span><span>şarjör değiştir</span><span>1–4</span><span>silah değiştir</span><span>Boşluk</span><span>fişek</span><span>P · M</span><span>duraklat · ses</span></div>
  <div class="row">${has?`<button class="go" data-act="hub">Kariyere devam · Gece ${career.night}</button>`:''}<button class="${has?'ghost':'go'}" data-act="new">${has?'Yeni kariyer':'Kariyere başla'}</button></div>`)}
function hub(){state='hub';showHud(false);for(const z of zs)disposeZ(z);zs=[];for(const p of pickups)scene.remove(p.g);pickups=[];LAN.forEach(l=>l.lit=false);syncLanterns();if(P){P.x=2.6;P.z=4.6;P.ang=.7;P.reloadT=0}rebuildBase();slotObjs.forEach((s,i)=>s.ring.visible=true);const c=career;
  const tabs=[['weapons','Silahlar'],['upg','Geliştirme'],['base','Üs'],['set','Ayarlar']].map(([k,t])=>`<button class="tab${hubTab===k?' on':''}" data-tab="${k}">${t}</button>`).join('');let body='';
  if(hubTab==='weapons')body=W_ORDER.map(id=>{const w=WEAPONS[id],s=wStats(id),own=c.owned.includes(id);return`<div class="item"><div><b>${w.ad}</b><small>${w.desc} Hasar ${s.dmg.toFixed(1)}${w.pellets>1?'×'+w.pellets:''} · şarjör ${s.mag} · değiştirme ${s.reload.toFixed(1)} sn</small></div>${own?'<span class="tag">Sende</span>':`<button class="buy" data-buy="w:${id}" ${c.scrap<w.price?'disabled':''}>${w.price}</button>`}</div>`}).join('');
  if(hubTab==='upg')body=Object.entries(UPG).map(([k,u])=>{const l=ul(k),done=l>=u.max,cost=u.c(l);return`<div class="item"><div><b>${u.ad} <span class="lv">${'●'.repeat(l)}${'○'.repeat(u.max-l)}</span></b><small>${u.d}</small></div>${done?'<span class="tag">Tam</span>':`<button class="buy" data-buy="u:${k}" ${c.scrap<cost?'disabled':''}>${cost}</button>`}</div>`}).join('');
  if(hubTab==='base'){const d=c.slots[selSlot];body=`<div class="slots">${c.slots.map((s,i)=>`<button class="slot${i===selSlot?' on':''}" data-slot="${i}"><b>${i+1}</b><small>${s?BUILD[s.type].ad+' '+s.lvl:'Boş'}</small></button>`).join('')}</div>`+
    (d?`<div class="item"><div><b>${BUILD[d.type].ad} · seviye ${d.lvl}</b><small>${BUILD[d.type].d}</small></div>${d.lvl<3?`<button class="buy" data-buy="b:${d.type}" ${c.scrap<BUILD[d.type].cost[d.lvl]?'disabled':''}>Yükselt ${BUILD[d.type].cost[d.lvl]}</button>`:'<span class="tag">Tam</span>'}</div><button class="ghost small" data-sell="1">Sök (+${Math.floor(BUILD[d.type].cost.slice(0,d.lvl).reduce((a,b)=>a+b,0)*.5)})</button>`
      :Object.entries(BUILD).map(([k,b])=>`<div class="item"><div><b>${b.ad}</b><small>${b.d}</small></div><button class="buy" data-buy="b:${k}" ${c.scrap<b.cost[0]?'disabled':''}>${b.cost[0]}</button></div>`).join(''))}
  if(hubTab==='set')body=`<p class="small">Grafik kalitesi (sayfa yeniden yüklenir)</p><div class="row">${['low','mid','high'].map(q=>`<button class="tab${qName===q?' on':''}" data-q="${q}">${{low:'Düşük',mid:'Orta',high:'Yüksek'}[q]}</button>`).join('')}</div><p class="small">Kayıt bu tarayıcıda tutulur.</p><button class="ghost small" data-act="title">Ana menü</button>`;
  overlay(`<div class="hubhead"><h2>Üs · Gece ${c.night}</h2><span class="scrap"><svg viewBox="0 0 24 24"><path d="M4 15l4-8h8l4 8-8 5z" fill="#c9a24e"/></svg><b>${c.scrap}</b> hurda</span></div><div class="tabs">${tabs}</div><div class="list">${body}</div><button class="go" data-act="night">Gece ${c.night}'e çık</button>`,true)}
card.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;initAudio();if(AC&&AC.state==='suspended')AC.resume();const d=b.dataset;
  if(d.act==='new'){career=NEW_CAREER();save();hubTab='weapons';hub()}else if(d.act==='hub')hub();else if(d.act==='night'){slotObjs.forEach(s=>s.ring.visible=false);startNight()}else if(d.act==='resume'){state='night';showHud(true);closeOverlay()}else if(d.act==='title')title();else if(d.act==='quit'){endNight(false)}
  if(d.tab){hubTab=d.tab;hub()}if(d.slot){selSlot=+d.slot;hub()}if(d.q){store.set('ll_quality',d.q);location.reload()}
  if(d.sell){const s=career.slots[selSlot];career.scrap+=Math.floor(BUILD[s.type].cost.slice(0,s.lvl).reduce((a,b)=>a+b,0)*.5);career.slots[selSlot]=null;save();hub()}
  if(d.buy){const[t,k]=d.buy.split(':');if(t==='w'){const p=WEAPONS[k].price;if(career.scrap>=p){career.scrap-=p;career.owned.push(k);G.lastW=k}}
    if(t==='u'){const p=UPG[k].c(ul(k));if(career.scrap>=p){career.scrap-=p;career.upg[k]=ul(k)+1}}
    if(t==='b'){const cur=career.slots[selSlot],lvl=cur?cur.lvl:0,p=BUILD[k].cost[lvl];if(career.scrap>=p){career.scrap-=p;career.slots[selSlot]={type:k,lvl:lvl+1}}}SFX.buy();save();hub()}});
function pause(){if(state!=='night')return;state='paused';showHud(false);overlay(`<h1>Duraklatıldı</h1><p>Gece ${career.night} · ${G.kills} zombi · +${G.earned} hurda</p><div class="row"><button class="go" data-act="resume">Devam</button><button class="ghost" data-act="quit">Geceyi bırak</button></div>`)}

/* ---------- input ---------- */
addEventListener('keydown',e=>{keys[e.code]=true;const body=e.target===document.body;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&body)e.preventDefault();
  if(e.code==='KeyR')reload();if(e.code==='Space'&&body)flare();if(/^Digit[1-4]$/.test(e.code))switchW(W_ORDER[+e.code.slice(5)-1]);if(e.code==='KeyQ'&&state==='night'){const o=career.owned,i=o.indexOf(P.cur);switchW(o[(i+1)%o.length])}
  if(e.code==='KeyP'||e.code==='Escape'){if(state==='night')pause();else if(state==='paused'){state='night';showHud(true);closeOverlay()}}if(e.code==='KeyM')toggleMute()});
addEventListener('keyup',e=>{keys[e.code]=false});addEventListener('blur',()=>{for(const k in keys)keys[k]=false;pause()});
const stage=$('stage');
function aimFrom(e){const g=groundPoint(e.clientX,e.clientY);return g?Math.atan2(g.x-P.x,g.z-P.z):P.ang}
stage.addEventListener('pointerdown',e=>{if(state!=='night')return;if(e.pointerType==='touch'){if(e.clientX<innerWidth/2&&!touch.joy)touch.joy={id:e.pointerId,x:e.clientX,y:e.clientY};else if(!touch.aim)touch.aim={id:e.pointerId,ang:aimFrom(e)}}else{mouse.down=true;mouse.press=true;mouse.on=true;mouse.x=e.clientX;mouse.y=e.clientY}});
stage.addEventListener('pointermove',e=>{if(e.pointerType==='touch'){if(touch.joy&&e.pointerId===touch.joy.id){let dx=(e.clientX-touch.joy.x)/52,dy=(e.clientY-touch.joy.y)/52;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}touch.jx=dx;touch.jy=dy;$('joy').style.cssText=`display:block;left:${touch.joy.x-52}px;top:${touch.joy.y-52}px`;$('knob').style.transform=`translate(${dx*52}px,${dy*52}px)`}else if(touch.aim&&e.pointerId===touch.aim.id)touch.aim.ang=aimFrom(e)}else{mouse.on=true;mouse.x=e.clientX;mouse.y=e.clientY}
  if(e.pointerType!=='touch'){const c=$('cross');c.style.transform=`translate(${e.clientX-12}px,${e.clientY-12}px)`}});
const up=e=>{if(e.pointerType==='touch'){if(touch.joy&&e.pointerId===touch.joy.id){touch.joy=null;touch.jx=touch.jy=0;$('joy').style.display='none'}if(touch.aim&&e.pointerId===touch.aim.id)touch.aim=null}else mouse.down=false};
stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);stage.addEventListener('contextmenu',e=>e.preventDefault());
$('reloadBtn').onclick=e=>{e.stopPropagation();reload()};$('flareBtn').onclick=e=>{e.stopPropagation();flare()};$('swapBtn').onclick=e=>{e.stopPropagation();if(state!=='night')return;const o=career.owned,i=o.indexOf(P.cur);switchW(o[(i+1)%o.length])};
$('pauseBtn').onclick=()=>state==='night'?pause():null;
function toggleMute(){muted=!muted;store.set('ll_muted',muted);if(master)master.gain.value=muted?0:.55;drawMute()}
function drawMute(){$('muteBtn').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${muted?'<path d="M17 9l5 6M22 9l-5 6"/>':'<path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/>'}</svg>`}
$('muteBtn').onclick=toggleMute;drawMute();

/* ---------- boot ---------- */
placeLanterns(career?career.night:1);paintGround();buildGrass();buildForest();syncLanterns();
if(!career)career=null;
P={x:0,z:4.5,ang:Math.PI*.85,hp:5,max:5,ph:0,cur:'pistol',ammo:{},reloadT:0};buildGun('pistol');
{const c=career;career=c||NEW_CAREER();rebuildBase();career=c}
slotObjs.forEach(s=>s.ring.visible=false);
$('loading').remove();

/* ---------- calibration API (only with #calib) ---------- */
const CAL_VIEWS=[{p:[24,0,-20],ang:2.2,lit:[0]},{p:[-30,0,18],ang:-.6,lit:[1]}];
if(CALIB){window.__ll={
  params:()=>({...PARAMS}),
  setParams(o){Object.assign(PARAMS,o);scene.fog.density=PARAMS.fog;hemi.intensity=PARAMS.hemi;moon.intensity=PARAMS.moon;moon.color.copy(kelvin(PARAMS.moonTemp));renderer.toneMappingExposure=PARAMS.exposure;syncLanterns();applyGrade()},
  views:CAL_VIEWS.length,
  setView(i){const v=CAL_VIEWS[i];P.x=v.p[0];P.z=v.p[2];P.ang=v.ang;LAN.forEach((l,k)=>{l.lit=v.lit.includes(k)});
    // move lit lantern next to the player so every view contains each measured surface
    const l=LAN[v.lit[0]];l.x=P.x+Math.sin(P.ang+1.9)*7;l.z=P.z+Math.cos(P.ang+1.9)*7;syncLanterns();time=1;grassU.uTime.value=1},
  areas(){const out=[],sc=(x,y,z)=>{v3.set(x,y,z).project(camera);return[(v3.x*.5+.5),(-v3.y*.5+.5)]},box=(n,c,s=.035)=>out.push({name:n,box:[c[0]-s,c[1]-s,s*2,s*2]});
    const fx=Math.sin(P.ang),fz=Math.cos(P.ang);box('torch_ground',sc(P.x+fx*7,0,P.z+fz*7));box('moonlit_grass',sc(P.x-fx*5+fz*4,0,P.z-fz*5-fx*4));
    const l=LAN.find(l=>l.lit);box('lantern_ground',sc(l.x+1.6,0,l.z+1.6),.025);
    let tb=null,bd=1e9;for(const t of TREES){const d=Math.hypot(t.x-P.x,t.z-P.z);if(d<bd&&d>4){bd=d;tb=t}}if(tb){box('canopy',sc(tb.x,5.2*tb.s,tb.z),.025);box('shaded_grass',sc(tb.x-MOON_DIR.x*2.2*tb.s,0,tb.z-MOON_DIR.z*2.2*tb.s),.02)}
    let rb=null;bd=1e9;for(const r of ROCKS){const d=Math.hypot(r.x-P.x,r.z-P.z);if(d<bd){bd=d;rb=r}}if(rb)box('rock',sc(rb.x,rb.s*rb.sy*.6,rb.z),.015);
    out.push({name:'distance_fog',box:[.4,.02,.2,.06]});return out.filter(a=>a.box[0]>0&&a.box[1]>0&&a.box[0]+a.box[2]<1&&a.box[1]+a.box[3]<1)},
  render(){state='title';lightRig(0);placeCharacters(0);updateCam(1,true);composer.render(0);return renderer.domElement.toDataURL('image/png')}}}

/* ---------- main loop ---------- */
function updateCam(dt,snap){if(state==='hub'){const a=time*.06;camLook.set(0,0,0);camPos.set(Math.sin(a)*24,20,Math.cos(a)*24)}else{camLook.set(P.x,0,P.z);camPos.set(P.x,22,P.z+15)}
  if(snap){camera.position.copy(camPos)}else camera.position.lerp(camPos,Math.min(1,dt*5));camera.lookAt(camLook.x,camLook.y+.5,camLook.z)}
let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(CALIB){return}
  time+=dt;grassU.uTime.value=time;beamMat.uniforms.uTime.value=time;
  if(state==='night')update(dt);else if(state==='title'){P.ang+=dt*.25}
  if(P){grassU.uPlayer.value.set(P.x,P.z);placeCharacters(dt)}lightRig(dt);particles(dt);updateCam(dt);exposure(dt);applyGrade();
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').classList.remove('show')}hud();
  composer.render(dt);requestAnimationFrame(frame)}
applyGrade();
if(CALIB){updateCam(1,true)}else{title();requestAnimationFrame(frame)}

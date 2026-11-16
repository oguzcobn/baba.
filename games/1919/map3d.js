/* Strategic 3D map for 1919: Medeniyetlerin Çağı.
   This is an opt-in renderer: the existing SVG map remains the source of truth
   for province ownership, orders, and selection. */
import * as THREE from "../../js/vendor/three.module.min.js";

const LAND_PATH = "M10 135 Q80 62 175 108 T310 106 Q441 66 561 87 T781 108 Q916 105 1065 138 L1073 403 Q1036 505 950 573 L839 607 741 564 666 541 555 611 432 592 315 551 209 511 95 481 11 409Z";
const MAP_W = 1080, MAP_H = 650, SCALE = .18;
const WORLD_X = x => (x - MAP_W / 2) * SCALE;
const WORLD_Z = y => (y - MAP_H / 2) * SCALE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const css = `
.map3d-toggle{margin-left:auto!important;border-color:#c4a259!important;color:#f0d69d!important}
.map3d-toggle.is-on{background:#b9975d!important;color:#172329!important}
.map3d-tools{position:absolute;z-index:8;left:10px;top:10px;display:flex;gap:4px;max-width:calc(100% - 20px);overflow-x:auto;padding:3px;background:#172329d9;border:1px solid #b9975d;border-radius:5px}
.map3d-tools button{font-size:10px;padding:6px 8px;white-space:nowrap}
.map3d-tools button.is-on{background:#c4a259;color:#172329}
.map3d-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:3;touch-action:none;cursor:grab}
.map3d-label{position:absolute;z-index:4;top:48px;right:10px;padding:5px 8px;background:#172329d9;border:1px solid #b9975d;color:#f4e7c6;font:11px Georgia,serif;pointer-events:none}
.viewport.map3d-on #world,.viewport.map3d-on .maptip,.viewport.map3d-on .zoom{visibility:hidden}
@media(max-width:700px){.map3d-tools{top:7px;left:7px}.map3d-tools button{padding:7px 8px}.map3d-label{top:auto;bottom:8px;right:8px}}
`;
const style = document.createElement("style"); style.textContent = css; document.head.append(style);

let active = true, layer = "political", mountedHost = null, renderer = null, scene = null, camera = null;
let canvas = null, raf = 0, observer = null, resizeObserver = null, provinceMeshes = [], seaMaterial = null;
let cameraTarget = new THREE.Vector3(0, 0, 0), yaw = 0, distance = 128, pitch = .66, drag = null, skipClick = false, forwardingClick = false;
const clock = new THREE.Clock();

function heightAt(x, z) {
  const gauss = (cx, cz, sx, sz, h) => h * Math.exp(-(((x-cx)/sx)**2 + ((z-cz)/sz)**2));
  let h = gauss(59, 18, 22, 25, 10) + gauss(28, 28, 12, 9, 6.2) + gauss(17, 9, 20, 5.5, 3.8);
  h += .55 * Math.sin(x * .17 + z * .12) * Math.cos(z * .19) + .26 * Math.sin(x * .47 - z * .32);
  return Math.max(-.45, h);
}
function toWorld(sx, sy) { return [WORLD_X(sx), WORLD_Z(sy)]; }

function sampledLandShape() {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", LAND_PATH); const length = path.getTotalLength(), pts = [];
  for (let i = 0; i < 260; i++) { const p = path.getPointAtLength(length * i / 260); pts.push(toWorld(p.x, p.y)); }
  const shape = new THREE.Shape(); shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]); shape.closePath();
  return new THREE.ShapeGeometry(shape, 1);
}
function addHeight(geometry) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x=p.getX(i),z=p.getY(i); p.setXYZ(i,x,heightAt(x,z),z); }
  p.needsUpdate = true; geometry.computeVertexNormals(); return geometry;
}
function subdividedProvince(poly, level = 5) {
  const contour = poly.map(([x,y]) => new THREE.Vector2(...toWorld(x,y)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []), verts = [];
  const pushTri = (a,b,c) => {
    const n = level, at = (i,j) => {
      const u = i / n, v = j / n, w = 1 - u - v;
      return [a.x*w + b.x*u + c.x*v, a.y*w + b.y*u + c.y*v];
    };
    const grid = [];
    for (let i=0; i<=n; i++) { grid[i]=[]; for(let j=0; j<=n-i; j++) grid[i][j]=at(i,j); }
    const emit = (p,q,r) => { for (const [x,z] of [p,q,r]) verts.push(x,heightAt(x,z),z); };
    for (let i=0; i<n; i++) for (let j=0; j<n-i; j++) {
      emit(grid[i][j],grid[i+1][j],grid[i][j+1]);
      if (j < n-i-1) emit(grid[i+1][j],grid[i+1][j+1],grid[i][j+1]);
    }
  };
  for (const t of tris) pushTri(contour[t[0]],contour[t[1]],contour[t[2]]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3)); g.computeVertexNormals(); return g;
}
function createSea() {
  const geometry = new THREE.PlaneGeometry(420, 260, 1, 1); geometry.rotateX(-Math.PI/2);
  seaMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: {value:0}, uDeep: {value:new THREE.Color(0x082535)}, uLight: {value:new THREE.Color(0x1a5262)} },
    vertexShader: `varying vec2 vUv; varying vec3 vPos; uniform float uTime; void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.12+uTime*.55)*.18+cos(p.z*.14-uTime*.4)*.12;vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader: `varying vec2 vUv; varying vec3 vPos; uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; void main(){float w=sin(vPos.x*.16+uTime*.6)*cos(vPos.z*.2-uTime*.5);float glint=pow(max(0.0,sin(vPos.x*.25+vPos.z*.19+uTime*.8)),22.0)*.2;vec3 c=mix(uDeep,uLight,.22+.12*w+glint);gl_FragColor=vec4(c,1.0);}`
  });
  const mesh = new THREE.Mesh(geometry, seaMaterial); mesh.position.y = -1.05; scene.add(mesh);
}
const maskCanvas=document.createElement("canvas");maskCanvas.width=1080;maskCanvas.height=650;
const maskContext=maskCanvas.getContext("2d");maskContext.fillStyle="#000";maskContext.fillRect(0,0,1080,650);maskContext.fillStyle="#fff";const landPath=new Path2D(LAND_PATH);maskContext.fill(landPath);
const landMask=new THREE.CanvasTexture(maskCanvas);
function addProvince(svgPoly) {
  const id = svgPoly.dataset.p, points = (svgPoly.getAttribute("points")||"").trim().split(/[ ,]+/).map(Number);
  if (points.length < 6) return;
  const poly=[]; for(let i=0;i+1<points.length;i+=2) poly.push([points[i],points[i+1]]);
  const geometry=subdividedProvince(poly), fill=svgPoly.getAttribute("fill")||"#65806a";
  const pos=geometry.attributes.position,uv=[];for(let i=0;i<pos.count;i++)uv.push((pos.getX(i)/SCALE+540)/1080,1-(pos.getZ(i)/SCALE+325)/650);geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({alphaMap:landMask,alphaTest:.5,color:fill,roughness:.94,metalness:.02,side:THREE.DoubleSide,transparent:true,opacity:.94}));
  mesh.userData={id,fill,poly}; mesh.position.y=.035; scene.add(mesh); provinceMeshes.push(mesh);
  const borderPts=poly.filter(([x,y])=>maskContext.isPointInPath(landPath,x,y)).map(([x,y])=>{const [wx,wz]=toWorld(x,y);return new THREE.Vector3(wx,heightAt(wx,wz)+.12,wz)});
  if(borderPts.length<2)return;borderPts.push(borderPts[0]);
  const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(borderPts),new THREE.LineBasicMaterial({color:0xe7d9b9,transparent:true,opacity:.72}));scene.add(border);
}
function makeLabel(name, x, y, capital=false) {
  const c=document.createElement("canvas");c.width=320;c.height=72;const ctx=c.getContext("2d");
  ctx.font=capital?"bold 28px Georgia":"bold 19px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.lineWidth=5;ctx.strokeStyle="#182421";ctx.fillStyle=capital?"#ffe0a1":"#f3ead2";ctx.strokeText(name,160,35);ctx.fillText(name,160,35);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.scale.set(capital?15:9,capital?3.4:2,1);
  const sx=x*10.5, sy=y*5.7+25, wx=WORLD_X(sx), wz=WORLD_Z(sy);
  sprite.position.set(wx,heightAt(wx,wz)+1.7,wz);scene.add(sprite);
}
function buildScene() {
  scene=new THREE.Scene();scene.background=new THREE.Color(0x102b3a);scene.fog=new THREE.FogExp2(0x102b3a,.0032);
  camera=new THREE.PerspectiveCamera(42,1,.1,600);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=false;
  renderer.domElement.className="map3d-canvas";renderer.domElement.setAttribute("aria-label","Etkileşimli 3B Anadolu haritası");canvas=renderer.domElement;
  scene.add(new THREE.HemisphereLight(0xdce4d5,0x263b35,2.0));
  const sun=new THREE.DirectionalLight(0xffd6a0,2.3);sun.position.set(-65,100,-40);scene.add(sun);
  createSea();
  const land=addHeight(sampledLandShape());scene.add(new THREE.Mesh(land,new THREE.MeshStandardMaterial({color:0x647459,roughness:1,side:THREE.DoubleSide})));
  const polygons=mountedHost.querySelectorAll("svg#world polygon[data-p]");polygons.forEach(addProvince);
  const names=[...polygons].map(el=>{const m=(el.querySelector("title")?.textContent||"").split(" · ");return {id:el.dataset.p,name:m[0]};});
  const coords={Istanbul:[17,19],Izmir:[18,68],Ankara:[55,48],Samsun:[68,25],Erzurum:[89,51],Inebolu:[49,19],Trabzon:[86,25],Canakkale:[8,42],Adana:[75,86]};
  for(const n of names){const xy=coords[n.id];if(xy)makeLabel(n.name,...xy,["Istanbul","Izmir","Ankara"].includes(n.id));}
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.65,12,8),new THREE.MeshBasicMaterial({color:0xffd27b}));
  marker.position.set(WORLD_X(55*10.5),heightAt(WORLD_X(55*10.5),WORLD_Z(48*5.7+25))+1,WORLD_Z(48*5.7+25));scene.add(marker);
  mountedHost.append(canvas);mountedHost.classList.add("map3d-on");
  applyLayer();addControls();resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mountedHost);resize();setCamera();
  canvas.addEventListener("pointerdown",onPointerDown);canvas.addEventListener("pointermove",onPointerMove);canvas.addEventListener("pointerup",onPointerUp);canvas.addEventListener("pointercancel",onPointerUp);canvas.addEventListener("contextmenu",e=>e.preventDefault());canvas.addEventListener("wheel",onWheel,{passive:false});
  tick();
}
function addControls(){
  const tools=document.createElement("div");tools.className="map3d-tools";tools.setAttribute("aria-label","3D harita katmanları");
  const modes=[["political","Siyasi"],["terrain","Arazi"],["army","Ordu"]];
  for(const [id,label] of modes){const b=document.createElement("button");b.textContent=label;b.dataset.mode=id;b.classList.toggle("is-on",id===layer);b.onclick=()=>{layer=id;tools.querySelectorAll("button").forEach(x=>x.classList.toggle("is-on",x.dataset.mode===id));applyLayer()};tools.append(b)}
  mountedHost.append(tools);
  const caption=document.createElement("div");caption.className="map3d-label";caption.textContent="Sürükle: kaydır · sağ tuşla sürükle: döndür · tekerlek: yakınlaştır";mountedHost.append(caption);
}
function applyLayer(){
  for(const mesh of provinceMeshes){const d=mesh.userData;let color=d.fill;
    if(layer==="terrain"){const avg=d.poly.reduce((a,p)=>a+heightAt(...toWorld(p[0],p[1])),0)/d.poly.length;color=avg>8?"#777b71":avg>5?"#8e906f":avg>2?"#aaa078":"#728365"}
    else if(layer==="supply"){const p=d.poly.reduce((a,v)=>[a[0]+v[0]/d.poly.length,a[1]+v[1]/d.poly.length],[0,0]);const score=Math.abs(p[0]-500)/500+Math.abs(p[1]-340)/340;color=score<.65?"#4eaa70":score<1.15?"#d2b649":"#a34d43"}
    else if(layer==="army"){const el=mountedHost.querySelector(`[data-p="${d.id}"] title`);const n=Number((el?.textContent||"").match(/(\d+) asker/)?.[1]||0);color=new THREE.Color().setHSL(.33-Math.min(n/150,1)*.3,.5,.4);}
    else if(layer==="diplomacy")color="#6d8290";
    mesh.material.color.set(color);
  }
}
function setCamera(){const horizontal=Math.cos(pitch)*distance;camera.position.set(cameraTarget.x+Math.sin(yaw)*horizontal,cameraTarget.y+Math.sin(pitch)*distance,cameraTarget.z+Math.cos(yaw)*horizontal);camera.lookAt(cameraTarget);}
function resize(){if(!renderer||!mountedHost)return;const w=mountedHost.clientWidth||800,h=mountedHost.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function onPointerDown(e){drag={x:e.clientX,y:e.clientY,button:e.button,moved:false};canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing"}
function onPointerMove(e){if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;drag.x=e.clientX;drag.y=e.clientY;if(drag.button===2||drag.button===1){yaw-=dx*.004;pitch=clamp(pitch+dy*.003,.42,1.12)}else{const step=distance*.008,sx=Math.cos(yaw),sz=-Math.sin(yaw);cameraTarget.x-=sx*dx*step;cameraTarget.z-=sz*dx*step;cameraTarget.x+=Math.sin(yaw)*dy*step;cameraTarget.z+=Math.cos(yaw)*dy*step}setCamera()}
function onPointerUp(){skipClick=!!drag?.moved;drag=null;if(canvas)canvas.style.cursor="grab";if(skipClick)setTimeout(()=>skipClick=false,0)}
function onWheel(e){e.preventDefault();distance=clamp(distance+e.deltaY*.065,64,230);pitch=clamp(.42+(distance-64)/166*.46,.42,.9);setCamera()}
function onKeys(e){if(!active||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||""))return;const step=distance*.035;const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));if(e.key.toLowerCase()==="w")cameraTarget.addScaledVector(fwd,-step);else if(e.key.toLowerCase()==="s")cameraTarget.addScaledVector(fwd,step);else if(e.key.toLowerCase()==="a")cameraTarget.addScaledVector(right,-step);else if(e.key.toLowerCase()==="d")cameraTarget.addScaledVector(right,step);else return;e.preventDefault();setCamera()}
function onClick(e){if(forwardingClick||skipClick||drag||!canvas||!camera||e.target!==canvas)return;const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(provinceMeshes)[0];if(hit){const target=mountedHost.querySelector(`svg#world polygon[data-p="${CSS.escape(hit.object.userData.id)}"]`);if(target){forwardingClick=true;try{target.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:e.clientX,clientY:e.clientY}))}finally{forwardingClick=false}}}}
function tick(){if(!active||!renderer)return;raf=requestAnimationFrame(tick);if(seaMaterial)seaMaterial.uniforms.uTime.value=clock.getElapsedTime();renderer.render(scene,camera)}
function disposeScene(){cancelAnimationFrame(raf);resizeObserver?.disconnect();resizeObserver=null;if(canvas){canvas.removeEventListener("pointerdown",onPointerDown);canvas.removeEventListener("pointermove",onPointerMove);canvas.removeEventListener("pointerup",onPointerUp);canvas.removeEventListener("pointercancel",onPointerUp);canvas.removeEventListener("wheel",onWheel);canvas.remove()};mountedHost?.querySelectorAll(".map3d-tools,.map3d-label").forEach(x=>x.remove());mountedHost?.classList.remove("map3d-on");scene?.traverse(o=>{o.geometry?.dispose();const m=o.material;if(m)for(const mat of(Array.isArray(m)?m:[m])){mat.map?.dispose();mat.dispose()}});renderer?.dispose();scene=null;camera=null;renderer=null;canvas=null;seaMaterial=null;provinceMeshes=[]}
function mount(){if(!active)return;const host=document.querySelector("#app .viewport");if(!host)return;if(host===mountedHost&&canvas)return;if(mountedHost)disposeScene();mountedHost=host;try{buildScene()}catch(err){console.error("3D map could not start",err);active=false;buttonState();disposeScene()}}
function buttonState(){document.querySelectorAll(".map3d-toggle").forEach(b=>{b.classList.toggle("is-on",active);b.setAttribute("aria-pressed",String(active));const label=active?"2D Harita":"3D Harita";if(b.textContent!==label)b.textContent=label})}
function inject(){const toolbar=document.querySelector("#app .toolbar");if(!toolbar)return;if(!toolbar.querySelector(".map3d-toggle")){const b=document.createElement("button");b.className="map3d-toggle";b.type="button";b.textContent="3D Harita";b.setAttribute("aria-pressed","false");b.onclick=()=>{active=!active;if(active){mount();if(!canvas)active=false}else disposeScene();buttonState()};toolbar.append(b)}buttonState()}
observer=new MutationObserver(()=>{if(mountedHost&&!mountedHost.isConnected){disposeScene();mountedHost=null}inject();if(active)mount()});observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener("keydown",onKeys);document.addEventListener("click",onClick,true);
inject();

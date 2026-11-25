import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const $=id=>document.getElementById(id);
const say=t=>$('status').textContent=t;
const v=$('viewport');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){say('WebGL başlatılamadı. Donanım hızlandırmayı etkinleştirin.');throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
v.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#171b22');
const camera=new THREE.PerspectiveCamera(45,1,.01,1000);camera.position.set(4,3,5);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.1;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
const env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0x4b5266,1.3));
const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(4,8,5);scene.add(key);
const grid=new THREE.GridHelper(10,20,0x647587,0x303948);scene.add(grid);
const transform=new TransformControls(camera,renderer.domElement);scene.add(transform);
transform.setSize(.85);transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);
transform.addEventListener('objectChange',()=>{syncTransform();updateStats();});
const box=new THREE.BoxHelper(new THREE.Object3D(),0x93d7ff);box.visible=false;scene.add(box);
const draco=new DRACOLoader();draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/gltf/');
const ktx=new KTX2Loader();ktx.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/basis/').detectSupport(renderer);
const loader=new GLTFLoader();loader.setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
let root=null,selected=null,source=null,filename='model.glb',clips=[],mixer=null,action=null,playing=false,paused=false,busy=false,mode='orbit',wire=false;
let initial=new WeakMap(),originalWire=new WeakMap(),pose=[];
const clock=new THREE.Clock(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
const snap=o=>({p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),v:o.visible});
const restore=(o,s)=>{o.position.copy(s.p);o.quaternion.copy(s.q);o.scale.copy(s.s);o.visible=s.v;};
function resize(){const w=v.clientWidth,h=v.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(v);resize();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);if(mixer&&playing&&!paused)mixer.update(dt);orbit.update();if(box.visible&&selected){box.setFromObject(selected);}renderer.render(scene,camera);}frame();
function materials(o){return o?.isMesh?(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean):[];}
function release(o){const gs=new Set(),ms=new Set(),ts=new Set();o.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of materials(n)){ms.add(m);for(const x of Object.values(m))if(x?.isTexture)ts.add(x);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
function stop(){if(mixer){mixer.stopAllAction();mixer.uncacheRoot(root);mixer=null;}for(const [o,s] of pose)restore(o,s);pose=[];action=null;playing=false;paused=false;$('play').textContent='▶ Oynat';$('stop').disabled=true;syncInspector();setMode(mode);}
function clear(){stop();transform.detach();box.visible=false;selected=null;if(root){scene.remove(root);release(root);}root=null;clips=[];initial=new WeakMap();originalWire=new WeakMap();wire=false;$('wire').classList.remove('active');}
function install(model,animations,name){clear();root=model;filename=name;clips=animations||[];root.name=root.name||'Model';scene.add(root);root.traverse(o=>{initial.set(o,snap(o));if(o.isMesh){const clone=m=>{if(!m)return m;const c=m.clone();originalWire.set(c,!!c.wireframe);return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});$('filename').textContent=name;$('empty').hidden=true;$('export').disabled=false;$('original').disabled=false;$('clips').replaceChildren();if(!clips.length)$('clips').add(new Option('Animasyon yok',''));else clips.forEach((c,i)=>$('clips').add(new Option((c.name||'Animasyon '+(i+1))+' · '+c.duration.toFixed(2)+' s',String(i))));$('clips').disabled=!clips.length;$('play').disabled=!clips.length;select(root);fit();updateStats();say('Model hazır. Sürükleyerek döndürün; sahne ağacından bir parça seçin.');}
function fit(dir=new THREE.Vector3(1,.7,1)){if(!root)return;root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root);if(b.isEmpty())return;const c=b.getCenter(new THREE.Vector3()),s=b.getBoundingSphere(new THREE.Sphere());const radius=Math.max(s.radius,.001);const vf=THREE.MathUtils.degToRad(camera.fov/2),hf=Math.atan(Math.tan(vf)*camera.aspect);const dist=radius/Math.sin(Math.min(vf,hf))*1.2;orbit.target.copy(c);camera.position.copy(c).addScaledVector(dir.normalize(),dist);camera.near=Math.max(radius/10000,.00001);camera.far=Math.max(radius*100,dist*4);camera.updateProjectionMatrix();orbit.minDistance=radius*.02;orbit.maxDistance=radius*40;orbit.update();grid.position.set(c.x,b.min.y,c.z);grid.scale.setScalar(Math.max(radius*.4,.001));}
function updateStats(){if(!root){$('stats').textContent='—';return;}let meshes=0,vertices=0,tri=0,objects=0;const mats=new Set();root.traverse(o=>{objects++;if(o.isMesh){meshes++;const g=o.geometry,n=g?.attributes?.position?.count||0;vertices+=n;tri+=Math.floor((g?.index?.count||n)/3);materials(o).forEach(m=>mats.add(m));}});root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=b.isEmpty()?new THREE.Vector3():b.getSize(new THREE.Vector3());const num=n=>n.toLocaleString('tr-TR');$('stats').textContent='Nesne: '+num(objects)+'\nMesh: '+num(meshes)+'\nVertex: '+num(vertices)+'\nÜçgen: '+num(tri)+'\nMalzeme: '+num(mats.size)+'\nBoyut: '+[s.x,s.y,s.z].map(x=>x.toPrecision(4)).join(' × ')+' m\nAnimasyon: '+clips.length;}
function tree(){const el=$('tree');el.replaceChildren();if(!root)return;const frag=document.createDocumentFragment();const visit=(o,depth)=>{const b=document.createElement('button');b.className='node'+(o===selected?' sel':'')+(!o.visible?' invisible':'');b.style.paddingLeft=6+Math.min(depth,12)*12+'px';b.textContent=(o.isMesh?'◇ ':o.isBone?'· ':'▸ ')+(o.name||o.type);b.title=o.name||o.type;b.onclick=()=>select(o);frag.append(b);o.children.forEach(c=>visit(c,depth+1));};visit(root,0);el.append(frag);}
function select(o){selected=o;box.visible=!!o&&!o.isBone;tree();syncInspector();setMode(mode);}
function setMode(m){mode=m;for(const id of ['orbit','translate','rotate','scale'])$(id).classList.toggle('active',id===m);transform.detach();if(selected&&m!=='orbit'&&!playing&&!busy){transform.setMode(m);transform.attach(selected);}}
const fields={};
for(const group of ['pos','rot','scl']){fields[group]=['x','y','z'].map((axis,i)=>{const e=document.createElement('input');e.type='number';e.step=group==='rot'?'1':'.01';e.setAttribute('aria-label',group+' '+axis);$(group).append(e);e.addEventListener('change',()=>{if(!selected||playing||busy)return;const n=Number(e.value);if(!Number.isFinite(n)||e.value===''||group==='scl'&&Math.abs(n)<.000001){syncTransform();return;}const vec=group==='pos'?selected.position:group==='rot'?selected.rotation:selected.scale;vec[axis]=group==='rot'?THREE.MathUtils.degToRad(n):n;updateStats();syncTransform();});return e;});}
function syncTransform(){if(!selected)return;for(const [group,vec] of [['pos',selected.position],['rot',selected.rotation],['scl',selected.scale]])['x','y','z'].forEach((a,i)=>{const e=fields[group][i];if(document.activeElement!==e)e.value=Number((group==='rot'?THREE.MathUtils.radToDeg(vec[a]):vec[a]).toFixed(4));});}
function activeMaterial(){return materials(selected)[Number($('material').value)||0];}
function syncMat(){const m=activeMaterial();$('materialFields').disabled=!m||playing||busy;$('color').disabled=!m?.color;$('metal').disabled=m?.metalness===undefined;$('rough').disabled=m?.roughness===undefined;$('color').value=m?.color?'#'+m.color.getHexString():'#ffffff';for(const [id,value] of [['metal',m?.metalness??0],['rough',m?.roughness??1],['opacity',m?.opacity??1]]){$(id).value=value;$(id+'Val').textContent=Number(value).toFixed(2);}}
function syncInspector(){$('inspector').disabled=!selected||playing||busy;$('selection').textContent=selected?(selected.name||selected.type):'—';$('visible').checked=!!selected?.visible;syncTransform();$('material').replaceChildren();materials(selected).forEach((m,i)=>$('material').add(new Option(m.name||'Malzeme '+(i+1),String(i))));$('material').disabled=!materials(selected).length;syncMat();}
$('material').onchange=syncMat;
$('visible').onchange=()=>{if(selected&&!playing&&!busy){selected.visible=$('visible').checked;tree();}};
$('reset').onclick=()=>{if(selected&&!playing&&!busy&&initial.has(selected)){restore(selected,initial.get(selected));syncInspector();tree();updateStats();}};
$('color').oninput=()=>{const m=activeMaterial();if(m?.color&&!playing&&!busy)m.color.set($('color').value);};
for(const [id,prop] of [['metal','metalness'],['rough','roughness'],['opacity','opacity']])$(id).oninput=()=>{const m=activeMaterial();if(!m||playing||busy||m[prop]===undefined)return;const n=Number($(id).value);m[prop]=n;$(id+'Val').textContent=n.toFixed(2);if(prop==='opacity'){m.transparent=n<1||m.transparent;m.needsUpdate=true;}};
for(const m of ['orbit','translate','rotate','scale'])$(m).onclick=()=>setMode(m);
$('fit').onclick=()=>fit();$('top').onclick=()=>fit(new THREE.Vector3(0,1,.0001));$('front').onclick=()=>fit(new THREE.Vector3(0,0,1));
$('grid').onclick=()=>{grid.visible=!grid.visible;$('grid').classList.toggle('active',!grid.visible);};
function setWire(on){wire=on;if(root)root.traverse(o=>materials(o).forEach(m=>{if('wireframe'in m)m.wireframe=on||!!originalWire.get(m);}));$('wire').classList.toggle('active',on);}
$('wire').onclick=()=>setWire(!wire);
$('bg').oninput=()=>scene.background.set($('bg').value);$('exposure').oninput=()=>renderer.toneMappingExposure=Number($('exposure').value);
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.center').requestFullscreen();}catch{say('Bu tarayıcıda tam ekran desteklenmiyor.');}};
let down=null;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!root||mode!=='orbit'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObject(root,true).find(h=>{let o=h.object;if(!o.isMesh)return false;while(o){if(!o.visible)return false;o=o.parent;}return true;});if(hit)select(hit.object);});
async function load(bytes,name,remember=true){if(busy)return;busy=true;transform.detach();say('GLB çözümleniyor…');try{if(bytes.byteLength<12||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw new Error('Geçerli bir GLB dosyası değil.');const g=await loader.parseAsync(bytes,'');if(remember)source=bytes;install(g.scene,g.animations,name);}catch(e){say('Model açılamadı: '+(e.message||e));}finally{busy=false;syncInspector();setMode(mode);}}
async function read(f){if(!f||busy)return;if(!/\.glb$/i.test(f.name)){say('Lütfen .glb uzantılı dosya seçin.');return;}if(f.size>250*1024*1024){say('Dosya 250 MB sınırını aşıyor. Önce modeli optimize edin.');return;}try{await load(await f.arrayBuffer(),f.name);}catch(e){say('Dosya okunamadı: '+e.message);}}
$('open').onclick=()=>$('file').click();$('file').onchange=()=>{const f=$('file').files[0];$('file').value='';read(f);};
for(const type of ['dragenter','dragover'])v.addEventListener(type,e=>{e.preventDefault();v.classList.add('drag');});v.addEventListener('dragleave',()=>v.classList.remove('drag'));v.addEventListener('drop',e=>{e.preventDefault();v.classList.remove('drag');read(e.dataTransfer.files[0]);});
function demo(){if(busy)return;const g=new THREE.Group();g.name='Demo model';const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.75,1),new THREE.MeshStandardMaterial({color:0x348dc1,metalness:.35,roughness:.3}));body.name='Gövde';body.position.y=.38;g.add(body);const top=new THREE.Mesh(new THREE.SphereGeometry(.45,40,24),new THREE.MeshStandardMaterial({color:0xeac379,metalness:.65,roughness:.25}));top.name='Küre';top.position.y=1.15;g.add(top);source=null;install(g,[],'demo.glb');}
$('demo').onclick=demo;$('original').onclick=()=>{if(!root||busy)return;if(!confirm('Tüm model düzenlemeleri sıfırlansın mı?'))return;if(source)load(source,filename,false);else demo();};
$('play').onclick=()=>{if(!root||!clips.length||busy)return;if(playing){paused=!paused;$('play').textContent=paused?'▶ Devam':'Ⅱ Duraklat';return;}pose=[];root.traverse(o=>pose.push([o,snap(o)]));mixer=new THREE.AnimationMixer(root);action=mixer.clipAction(clips[Number($('clips').value)||0]);action.play();playing=true;paused=false;$('play').textContent='Ⅱ Duraklat';$('stop').disabled=false;syncInspector();setMode(mode);};
$('stop').onclick=stop;$('clips').onchange=()=>{if(playing)stop();};
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('export').onclick=async()=>{if(!root||busy)return;if(playing)stop();busy=true;$('export').disabled=true;transform.detach();syncInspector();const wasWire=wire;setWire(false);say('GLB oluşturuluyor…');try{const buffer=await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:!$('hiddenExport').checked});download(new Blob([buffer],{type:'model/gltf-binary'}),filename.replace(/\.glb$/i,'')+'-edited.glb');say('Yeni GLB hazır. Orijinal dosyanız değişmedi.');}catch(e){say('Dışa aktarma başarısız: '+(e.message||e));}finally{setWire(wasWire);busy=false;$('export').disabled=false;syncInspector();setMode(mode);}};
$('shot').onclick=()=>{const show=box.visible;box.visible=false;transform.visible=false;renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)download(blob,filename.replace(/\.glb$/i,'')+'.png');else say('PNG oluşturulamadı.');},'image/png');transform.visible=true;box.visible=show;};
say('Hazır • GLB yükleyin veya Demo ile başlayın.');

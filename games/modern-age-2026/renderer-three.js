import * as THREE from './vendor/three.module.min.js';

import {createPeople} from './people-three.js';
export function createThreeRenderer(api) {
 const canvas=api.canvas;
 const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.14;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const gl=renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 const software=/swiftshader|llvmpipe|software/i.test(gpu);
 const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,400);
 scene.background=new THREE.Color('#66844d');
 const people=createPeople(scene);
 const sky=new THREE.HemisphereLight(0xc9e0ff,0x73715a,1.65);scene.add(sky);
 const sun=new THREE.DirectionalLight(0xffecd0,2.6);scene.add(sun,sun.target);
 sun.castShadow=true;sun.shadow.mapSize.set(software?512:2048,software?512:2048);
 sun.shadow.camera.near=.1;sun.shadow.camera.far=100;
 sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;
 // Small procedural environment for metal/glass reflections; not an HDR photo.
 const envScene=new THREE.Scene();
 envScene.background=new THREE.Color(0xa4b9d0);
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshBasicMaterial({color:new THREE.Color(2.8,2.5,2.1),side:THREE.DoubleSide}));
 panel.position.set(-5,8,3);panel.lookAt(0,0,0);envScene.add(panel);
 const pmrem=new THREE.PMREMGenerator(renderer);
 const env=pmrem.fromScene(envScene,.02);scene.environment=env.texture;scene.environmentIntensity=.65;
 panel.geometry.dispose();panel.material.dispose();pmrem.dispose();
 const geos={box:new THREE.BoxGeometry(1,1,1),plane:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),sphere:new THREE.SphereGeometry(.5,10,8),low:new THREE.IcosahedronGeometry(.5,1),cyl:new THREE.CylinderGeometry(.5,.5,1,12),cone:new THREE.ConeGeometry(.5,1,10)};
 geos.wheel=new THREE.CylinderGeometry(.5,.5,1,12).rotateZ(Math.PI/2);
 const roofShape=new THREE.Shape();roofShape.moveTo(-.5,-.5);roofShape.lineTo(.5,-.5);roofShape.lineTo(0,.5);roofShape.closePath();
 geos.roof=new THREE.ExtrudeGeometry(roofShape,{depth:1,bevelEnabled:false}).translate(0,0,-.5).rotateY(Math.PI/2);
 geos.mansion=api.landmark;
 // Reproducible surface microdetail: correlated height and diffuse/normal textures.
 function textures(seed,amp){
   const size=128,h=new Float32Array(size*size),a=new Uint8Array(size*size*4),b=new Uint8Array(a.length);let r=seed;
   function random(){r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296}
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const q=x+y*size;h[q]=.5+.14*Math.sin(x*Math.PI/16)*Math.cos(y*Math.PI/16)+.07*Math.sin((x+y)*Math.PI/4)+(random()-.5)*.32}
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const q=x+y*size,i=q*4,v=Math.round(218+h[q]*37);a.set([v,v,v,255],i);let dx=(h[y*size+(x+1)%size]-h[y*size+(x+size-1)%size])*amp,dy=(h[((y+1)%size)*size+x]-h[((y+size-1)%size)*size+x])*amp;let l=Math.hypot(dx,dy,1);b.set([Math.round(127.5*(1-dx/l)),Math.round(127.5*(1-dy/l)),Math.round(127.5*(1+1/l)),255],i)}
   const make=(arr,srgb)=>{let t=new THREE.DataTexture(arr,size,size);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;return t};
   return {map:make(a,true),normalMap:make(b,false)};
 }
 const surfaces={earth:textures(17,2.4),wall:textures(55,.65),water:textures(71,.24)};
 const materials=new Map(),cache=new Map();
 const matrix=new THREE.Matrix4(),color=new THREE.Color(),position=new THREE.Vector3(),quat=new THREE.Quaternion(),euler=new THREE.Euler(),size=new THREE.Vector3();
 let world,defs,countries,debris,N,T,cam,W,H,zoom,hour,season,weather,tile,project,quality,metrics;
 let batch={},buildingStatic=false,staticKey='',buildingKey='',statWorld=null,scale=software?.65:1,baseDpr=1,lastAdapt=0,lastShadow=0,lastX=Infinity,lastZ=Infinity,lastZoom=0,lastClimate='',disposed=false,drawCount=0,lastQuality=null;
 function add(g,x,y,z,sx,sy,sz,c,m=0,r=.8,yaw=0,pitch=0){
   const type=r===-1?'contact':g==='mansion'?'landmark':g==='plane'?(r<.2?'water':'earth'):m>.17?(r<.35?'glass':'metal'):'wall';
   const k=g+'|'+type+(buildingStatic?'|'+Math.floor(x/12)+','+Math.floor(z/12):''); (batch[k]??=[]).push([x,y,z,sx,sy,sz,c,yaw,pitch]);
 }
 const box=(x,y,z,w,h,d,c,m=0,r=.8,ya=0,pi=0)=>add('box',x,y,z,w,h,d,c,m,r,ya,pi);
 function tree3(x,z,t){
   const h=.84+t.tone*.85;
   add('cyl',x,h*.34,z,.105,h*.67,.105,'#73583e');
   add('plane',x+.04,.008,z+.04,h*.81,1,h*.68,'#ffffff',0,-1);
   if(t.tone>.59){
     for(let j=0;j<4;j++)add('cone',x,h*(.49+j*.17),z,h*(.63-j*.108),h*(.69-j*.09),h*(.63-j*.108),['#315541','#3e6649','#4d7851','#648b59'][j],0,.9,j*.74)
   }else for(let j=0;j<7;j++){
     const a=j*2.399+t.tone*8,r=j===6?0:h*.21;
     add('low',x+Math.cos(a)*r,h*(.67+j*.051),z+Math.sin(a)*r,h*.51,h*(.51+.1*t.detail),h*.50,['#466738','#55753c','#648346','#51753d','#73934c','#628845','#82a35b'][j],0,.9,a)
   }
 }
 function building(b){let s=defs[b.type].size,x=b.x+s/2,z=b.y+s/2,kind=b.type,country=b.enemy?world.enemyCountry:world.country,fc=countries[country][2],p=Math.max(.035,b.progress),base=country==='TR'?'#e6ddc7':country==='GB'?'#aa846f':country==='IR'?'#d4b38c':country==='IL'?'#ddcfac':country==='GR'?'#f1eee5':'#d3cfc0', roofc=country==='TR'?'#a95843':'#7c8785';box(x,.018,z,s,.036,s,'#b4ad96');if(p<.75){
   for(const side of [-1,1])box(x+side*s*.38,.08,z,.14,.16,s*.83,'#aba599');
   if(p>=.25){
     const height=.35+p*1.3;
     for(const side of [-1,1])for(const end of [-1,1])box(x+side*s*.36,height/2,z+end*s*.36,.09,height,.09,'#9d7852');
     for(const end of [-1,1])box(x,height,z+end*s*.36,s*.79,.09,.1,'#ac8f67')
   }
   return
 }
 if(kind==='landmark'&&country==='TR'){add('mansion',x,.02,z,.48,.48*p,.48,'#ffffff',0,.83);return}if(kind==='farm'){for(let i=0;i<6;i++){box(x-s*.38+i*s*.15,.04,z,s*.11,.07,s*.83,'#766044');for(let j=0;j<6;j++)add('low',x-s*.38+i*s*.15,.19*p,z-s*.35+j*s*.14,.18,.33*p,.18,'#a7b65e')}return}if(kind==='power'){for(let i=0;i<3;i++)for(let j=0;j<3;j++){let xx=x+(i-1)*.8,zz=z+(j-1)*.8;box(xx,.21*p,zz,.12,.4*p,.12,'#848e8f',.5);box(xx,.43*p,zz,.7,.06,.66,'#385c77',.35,.25,0,.26);for(let k=-1;k<=1;k++)box(xx+k*.21,.47*p,zz,.012,.012,.6,'#9db5c6',.4)}return}let h=(kind==='hq'?1.36:kind==='house'?1.15:kind==='hangar'?1.05:.87)*p,w=s*.82,d=s*.76;box(x,.09,z,w+.14,.18,d+.14,'#9a9e95');box(x,h*.5+.15,z,w,h,d,base);if(['house','barracks','hq'].includes(kind)&&!['IL','IR','US'].includes(country)){add('roof',x,h+.33*p+.15,z,w+.19,.45*p,d+.2,roofc,0,.79);for(let i=0;i<Math.floor(w/.23);i++){let xx=x-w/2+.13+i*.23;box(xx,h+.16*p+.15,z+d*.24,.025,.018,d*.51, '#bd8064',0,.8,0,-.28)}}else{box(x,h+.18,z,w+.12,.12,d+.12,'#8b9694',.3,.55);for(let j=0;j<2;j++)box(x-.45+j*.9,h+.36,z-.25,.46,.24,.48,'#a7afaa',.3,.65)}for(let j=0;j<Math.floor(w/.5);j++){let xx=x-w/2+.28+j*.5;for(let side of [-1,1]){box(xx,.15+h*.57,z+side*(d/2+.014),.33,h*.39,.035,'#deded0');box(xx,.15+h*.57,z+side*(d/2+.035),.25,h*.3,.025,'#416674',.22,.21);box(xx,.15+h*.57,z+side*(d/2+.052),.016,h*.3,.014,'#afc4c5')}}for(let j=0;j<Math.floor(d/.5);j++){let zz=z-d/2+.29+j*.5;box(x+w/2+.02,.15+h*.58,zz,.045,h*.38,.33,'#d2d6ca');box(x+w/2+.05,.15+h*.58,zz,.023,h*.29,.25,'#527580',.25,.2)}box(x,.15+h*.26,z+d/2+.065,.47,h*.52,.10,'#48564e',.13,.55);if(['factory','hangar','dock'].includes(kind))box(x,.15+h*.42,z+d/2+.09,w*.56,h*.8,.10,'#7b8c8b',.48,.6);if(kind==='hq'||kind==='research'){box(x+w*.42,h+.55,z-d*.36,.035,1.08,.035,'#d8dfdc',.4);box(x+w*.42+.18,h+.98,z-d*.36,.36,.22,.022,fc)}if(kind==='hq'||kind==='house'){
   const front=z+d*.5,edge=x+w*.43;
   if(country==='TR'){box(x,h*.82,front,w*.65,.1,.48,'#efe5d3');for(const dir of [-1,1])box(x+dir*w*.28,h*.4,front+.12,.09,h*.8,.09,base)}
   if(country==='US'){for(const dir of [-1,1]){box(x+dir*w*.43,h*.36,z,w*.26,h*.7,d*.74,base);box(x+dir*w*.43,h*.73,z,w*.29,.09,d*.78,'#75818a')}}
   if(country==='IL'){for(let i=0;i<7;i++)box(x+(i-3)*w*.115,h*.82,front,w*.065,.08,.48,'#ccb693')}
   if(country==='IR'){for(const dir of [-1,1])box(x+dir*w*.21,h*.48,front+.13,.18,h*.94,.34,'#ba9679');box(x,h*.95,front+.13,w*.49,.22,.34,'#b78b69')}
   if(country==='GB'){for(const dir of [-1,1]){box(edge,h+.55,z+dir*d*.29,.24,.72,.24,'#975e4a');add('cyl',edge,h+.97,z+dir*d*.29,.16,.19,.16,'#925943')}}
   if(country==='GR'){for(const dir of [-1,1]){add('cyl',x+dir*w*.26,h*.48,front+.17,.13,h*.91,.13,'#f3f0e3')}box(x,h*.96,front,w*.67,.11,.59,'#efeadd')}
 }
 if(b.hp<120){for(let i=0;i<5;i++)box(x-w*.4+i*w*.17,.12+h*.3,z+d/2+.08,.11,.22,.055,'#575953')}}
 // Two equal-length planar links. Solve knee by intersecting circles around hip and ankle.
 function person(u){
   const yaw=Math.PI/2-u.angle,co=Math.cos(yaw),si=Math.sin(yaw);
   const nation=u.enemy?world.enemyCountry:world.country,team=countries[nation][2];
   const moving=Boolean(u.path?.length),phase=((u.travel||0)/.42)%1;
   const soldier=u.kindUnit==='infantry',jacket=soldier?'#66765c':'#d9aa58';
   function part(g,lx,y,lz,w,h,d,c,pitch=0){add(g,u.x+co*lx+si*lz,y,u.y-si*lx+co*lz,w,h,d,c,0,.82,yaw,pitch)}
   part('box',0,.401,0,.225,.255,.143,jacket);
   part('sphere',0,.615,0,.147,.172,.143,'#c4a78e');
   part('sphere',0,.684,0,.181,.09,.17,soldier?'#586a52':'#eec464');
   part('box',0,.437,.076,.158,.043,.016,team);
   if(['TR','IL','US'].includes(nation))part('box',0,.36,-.088,.16,.17,.075,'#606c62');
   if(['GB','IR','US'].includes(nation))part('box',.105,.31,0,.062,.091,.09,'#6b6553');
   if(['GR','IR','TR'].includes(nation))part('box',0,.48,.011,.245,.043,.153,'#d5cfad');
   for(const side of [-1,1]){
     const t=(phase+(side===1?.5:0))%1, swing=t>=.5, f=swing?(t-.5)*2:t*2;
     const ankleZ=moving?(swing?-.105+.21*f:.105-.21*f):0;
     const ankleY=.044+(moving&&swing?.065*Math.sin(Math.PI*f):0);
     const hipY=.30,dy=ankleY-hipY,len=Math.hypot(dy,ankleZ),lift=Math.sqrt(Math.max(0,.15**2-(len/2)**2));
     const kneeY=(hipY+ankleY)/2+ankleZ/len*lift,kneeZ=ankleZ/2-dy/len*lift;
     const leg=(ay,az,by,bz)=>part('box',side*.064,(ay+by)/2,(az+bz)/2,.079,Math.hypot(ay-by,az-bz),.08,'#495650',Math.atan2(az-bz,ay-by));
     leg(hipY,0,kneeY,kneeZ);leg(kneeY,kneeZ,ankleY,ankleZ);
     part('box',side*.064,ankleY-.014,ankleZ+.032,.095,.058,.14,'#343b38');
     const work=['build','gather'].includes(u.role);
     const arm=u.carry>0?-.72:work&&!moving?-.48+.30*Math.sin(world.time*5):moving?.48*Math.sin(phase*2*Math.PI)*side:0;
     part('box',side*.147,.383,-Math.sin(arm)*.105,.072,.222,.076,'#bfa186',arm);
   }
   if(u.carry>0)part('box',0,.31,.143,.235,.17,.18,'#ac916d')
 }
 function vehicle(u){let x=u.x,z=u.y,ya=Math.PI/2-u.angle,co=Math.cos(ya),si=Math.sin(ya),kind=u.kindUnit,air=kind==='air',nav=kind==='naval',h=air?1.6:nav?.09+Math.sin(world.time*2+u.id)*.035:0,team=countries[u.enemy?world.enemyCountry:world.country][2];function p(g,lx,y,lz,w,hh,d,c,m=.25,r=.6,pi=0){add(g,x+co*lx+si*lz,h+y,z-si*lx+co*lz,w,hh,d,c,m,r,ya,pi)}if(air){p('sphere',0,.2,0,.30,.28,1.25,'#b4c0c4',.45,.36);p('box',0,.17,-.03,1.45,.045,.40,'#9facb3');p('box',0,.23,-.44,.64,.045,.22,'#9facb3');p('sphere',0,.33,.25,.19,.12,.32,'#456c83',.4,.2);p('box',0,.33,-.48,.05,.31,.21,team)}else if(nav){p('sphere',0,.12,0,.56,.35,1.40,'#899b9e',.4);p('box',0,.32,-.14,.40,.24,.46,'#b1b9b7');p('box',0,.35,.12,.32,.14,.04,'#456779',.3,.2);p('box',0,.65,-.14,.035,.48,.035,'#d4d5c8');p('box',.11,.79,-.14,.20,.12,.035,team)}else{p('box',0,.23,0,.65,.33,1.10,'#76866c');const nation=u.enemy?world.enemyCountry:world.country;
 const count={TR:4,US:4,IL:5,IR:3,GB:5,GR:3}[nation];
 for(const side of [-1,1]){
   if(count===5)p('box',side*.335,.16,0,.15,.23,1.05,'#353d39');
   for(let i=0;i<count;i++){
     const along=-.405+i*.81/(count-1),radius=count===5?.104:.132;
     p('wheel',side*.35,radius,along,.133,radius*2,radius*2,'#333936',0,.9);
     p('box',side*.422,radius,along,.02,radius*1.39,.027,'#a0a591',.36,.57,(u.travel||0)/radius)
   }
 }
 p('sphere',0,.46,-.05,.53,.27,.62,'#8b9b7e');p('box',0,.40,.42,.11,.10,.66,'#66745f',.5);p('box',.18,.40,.21,.11,.07,.14,team)}}
 function material(type){
   if(materials.has(type))return materials.get(type);
   if(type==='contact'){
     const dim=32,alpha=new Uint8Array(dim*dim*4);
     for(let i=0;i<dim*dim;i++){
       const r2=((i%dim+.5)/dim*2-1)**2+((Math.floor(i/dim)+.5)/dim*2-1)**2;
       alpha.set([45,54,28,Math.round(84*Math.max(0,1-r2)**2)],i*4)
     }
     const tex=new THREE.DataTexture(alpha,dim,dim);tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
     const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
     materials.set(type,m);return m
   }
   const surf=surfaces[type==='earth'?'earth':type==='water'?'water':'wall'];
   const options={color:0xffffff,metalness:type==='metal'?.65:type==='glass'?.35:0,roughness:type==='water'?.18:type==='glass'?.21:type==='metal'?.55:type==='earth'?.96:.82,side:type==='landmark'?THREE.DoubleSide:THREE.FrontSide};
   if(type==='landmark')options.vertexColors=true;
   else {options.map=surf.map;options.normalMap=surf.normalMap;options.normalScale=new THREE.Vector2(type==='earth'?.8:.35,type==='earth'?.8:.35)}
   const m=new THREE.MeshStandardMaterial(options);materials.set(type,m);return m;
 }
 function updateMeshes(prefix,entries){
   for(const [key,mesh] of cache)if(key.startsWith(prefix+'|'))mesh.visible=false;
   for(const [k,arr] of Object.entries(entries)){
     if(!arr.length)continue;
     const key=prefix+'|'+k,[g,type]=k.split('|');let mesh=cache.get(key);
     if(!mesh||mesh.instanceMatrix.count<arr.length){
       if(mesh){scene.remove(mesh);mesh.dispose()}
       const cap=prefix==='static'?arr.length:Math.max(16,2**Math.ceil(Math.log2(arr.length)));
       mesh=new THREE.InstancedMesh(geos[g],material(type),cap);mesh.instanceMatrix.setUsage(prefix==='static'?THREE.StaticDrawUsage:THREE.DynamicDrawUsage);
       mesh.castShadow=g!=='plane';mesh.receiveShadow=true;scene.add(mesh);cache.set(key,mesh);
     }
     mesh.count=arr.length;mesh.visible=true;
     for(let i=0;i<arr.length;i++){const [x,y,z,sx,sy,sz,c,yaw,pitch]=arr[i];position.set(x,y,z);size.set(Math.max(.0001,sx),Math.max(.0001,sy),Math.max(.0001,sz));euler.set(pitch,yaw,0,'YXZ');quat.setFromEuler(euler);matrix.compose(position,quat,size);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.set(c))}
     mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
     if(prefix!=='dynamic')mesh.computeBoundingSphere();else mesh.frustumCulled=false;
   }
 }
 let groundWorld=null,ground=null,river=null;
 function buildGround(){
   if(ground){scene.remove(ground);ground.geometry.dispose();ground.material.dispose()}
   if(river){scene.remove(river);river.geometry.dispose()}
   const banks=[],waterUV=[],waterIndex=[];
   for(let z=0;z<=N;z++){
     const row=Math.min(z,N-1);let first=-1,last=-1;
     for(let x=0;x<N;x++)if(tile(x,row).type==='water'){if(first<0)first=x;last=x}
     if(first<0)continue;
     const start=banks.length/3;
     for(const x of [first+.42,last+.58]){banks.push(x,-.002,z);waterUV.push(x*.26,z*.26)}
     if(start>0)waterIndex.push(start-2,start,start-1,start-1,start,start+1)
   }
   const waterGeom=new THREE.BufferGeometry();waterGeom.setIndex(waterIndex);
   waterGeom.setAttribute('position',new THREE.Float32BufferAttribute(banks,3));
   waterGeom.setAttribute('uv',new THREE.Float32BufferAttribute(waterUV,2));waterGeom.computeVertexNormals();
   const waterMaterial=material('water');waterMaterial.color.set('#6199a7');
   river=new THREE.Mesh(waterGeom,waterMaterial);scene.add(river);
   const data=[],rgb=[],uv=[],a=new THREE.Color(),b=new THREE.Color();
   const colors={grass:['#638747','#a6b965'],rock:['#83897a','#acb09b'],sand:['#b6ac80','#d6c79c'],water:['#438097','#72a6ac']};
   function vertex(x,z){
     const weights={};
     // Bilinear interpolation across tile centres gives shorelines a half-cell transition.
     for(let dz=-1;dz<=0;dz++)for(let dx=-1;dx<=0;dx++){
       const kind=tile(Math.min(N-1,Math.max(0,x+dx)),Math.min(N-1,Math.max(0,z+dz))).type;
       weights[kind]=(weights[kind]||0)+.25
     }
     const field=.5+.185*Math.sin(x*.27+z*.17)+.145*Math.cos(z*.38-x*.12)+.084*Math.sin(1.61*x+.83*z)+.035*Math.cos(z*2.78+x*1.83);
     let red=0,green=0,blue=0;
     for(const [kind,w] of Object.entries(weights)){
       a.set(colors[kind][0]).lerp(b.set(colors[kind][1]),field);
       red+=w*a.r;green+=w*a.g;blue+=w*a.b
     }
     rgb.push(red,green,blue);data.push(x,-.012,z);uv.push(x*.63,z*.63)
   }
   const index=[];
   for(let z=0;z<=N;z++)for(let x=0;x<=N;x++){
     vertex(x,z);
     if(x<N&&z<N){const i=z*(N+1)+x;index.push(i,i+N+1,i+1,i+1,i+N+1,i+N+2)}
   }
   const g=new THREE.BufferGeometry();g.setIndex(index);
   g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));
   g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
   g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
   const m=material('earth').clone();m.vertexColors=true;ground=new THREE.Mesh(g,m);
   ground.receiveShadow=true;scene.add(ground)
 }
 function rebuildTerrain(){
   buildingStatic=true;batch={};
   if(groundWorld!==world){buildGround();groundWorld=world}
   for(let z=0;z<N;z++)for(let x=0;x<N;x++){
     const t=tile(x,z);
     if(t.type==='grass'&&t.detail>.94&&Math.hypot(x-world.spawn.x,z-world.spawn.y)>10&&!world.resources.some(r=>Math.hypot(r.x-x,r.y-z)<2)&&!world.buildings.some(b=>x>=b.x&&x<b.x+defs[b.type].size&&z>=b.y&&z<b.y+defs[b.type].size))tree3(x+.5,z+.5,t);
     if(t.type==='rock'&&t.detail>.73){add('low',x+.43,.09,z+.5,.36,.22,.3,'#909182',0,.95,t.tone*6.28)}
   }
   for(let r of world.resources){if(r.amount<=0)continue;let c={mat:'#9a9b90',food:'#c5b55c',oil:'#484e4c',money:'#c1a362'}[r.type];for(let i=0;i<6;i++){let x=r.x+.5+(i%3-1)*.26,z=r.y+.5+((i/3|0)-.5)*.35;add(r.type==='oil'?'cyl':r.type==='mat'?'low':'box',x,.18,z,.28,.35,.30,c,r.type==='oil'?.4:0,.8)}}
   updateMeshes('static',batch);buildingStatic=false;
 }
 function rebuildBuildings(){
   buildingStatic=true;batch={};
   for(const b of world.buildings){building(b);if(b.progress>=1&&['hq','house','research','barracks'].includes(b.type)){let s=defs[b.type].size,x=b.x+s/2,z=b.y+s/2;for(let j=0;j<3;j++){let xx=x-s*.35+j*.26;box(xx,.07,z+s*.43,.22,.14,.18,'#a49c83');add('low',xx,.19,z+s*.43,.19,.25,.20,'#577849')}}}
   updateMeshes('buildings',batch);buildingStatic=false;renderer.shadowMap.needsUpdate=true;
 }
 function resize(){
   const s=api.state();baseDpr=Math.min(window.devicePixelRatio||1,1.5);renderer.setPixelRatio(baseDpr*scale);renderer.setSize(Math.max(1,s.W),Math.max(1,s.H),false);
 }
 function draw(){
   if(disposed)return;
   const now=performance.now();({world,defs,countries,debris,N,T,cam,W,H,zoom,hour,season,weather,tile,project,quality,metrics}=api.state());
   if(!world||!W||!H)return;
   const footprint=world.buildings.map(b=>b.id).join(',')+';'+world.resources.map(r=>r.amount>0).join('');
   const stages=world.buildings.map(b=>b.id+':'+Math.floor(b.progress*4)+':'+(b.hp<120)).join('|');
   const changed=statWorld!==world;
   if(changed||staticKey!==footprint){staticKey=footprint;rebuildTerrain()}
   if(changed||buildingKey!==stages){buildingKey=stages;rebuildBuildings()}
   statWorld=world;
   people.begin();batch={};for(const u of world.units){let q=project(u.x,u.y);if(q.x<-100||q.x>W+100||q.y<-150||q.y>H+150)continue;if(u.kindUnit&&u.kindUnit!=='worker'&&u.kindUnit!=='infantry')vehicle(u);else {const close=zoom>=1.8||(zoom>=.90&&world.units.length<=40);if(!people.add(u,world.time,close))person(u);add('plane',u.x,.012,u.y,.32,1,.28,'#ffffff',0,-1)}}
   for(const d of debris)add('box',d.x,d.y,d.z,d.s,d.s*.7,d.s,'#8e9088',0,.86,d.angle,d.angle*.7);
   updateMeshes('dynamic',batch);
   const halfW=W/(2*T*zoom),halfH=H/(2*T*zoom);
   camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;camera.position.set(cam.x+80,80,cam.y+80);camera.lookAt(cam.x,0,cam.y);camera.updateProjectionMatrix();
   const h=hour(),day=Math.max(.035,Math.sin((h-6)*Math.PI/12)),ang=(h-6)*Math.PI/12;
   people.end(day,metrics);sun.intensity=2.8*day;sun.color.set(day<.35?'#ffb47f':'#fff0db');sky.intensity=.40+1.15*day;scene.environmentIntensity=.32+.40*day;
   const ckey=weather()+'|'+season();
   if(ckey!==lastClimate){lastClimate=ckey;let wet=weather()==='rain';material('earth').roughness=wet?.63:.96;material('wall').roughness=wet?.62:.82;if(ground){ground.material.roughness=wet?.63:.96;ground.material.color.set(season()==='Kış'?'#ccd6d9':'#ffffff')}material('earth').color.set(season()==='Kış'?'#c8d1d6':'#ffffff')}
   if(now-lastShadow>(software?1000:250)||Math.hypot(cam.x-lastX,cam.y-lastZ)>2||Math.abs(zoom-lastZoom)>.1){
     lastShadow=now;lastX=cam.x;lastZ=cam.y;lastZoom=zoom;sun.target.position.set(cam.x,0,cam.y);sun.position.set(cam.x-25*Math.cos(ang),25+20*day,cam.y+23);const span=Math.max(14,Math.min(42,halfW+halfH+5));Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span});sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;
   }
   if(quality!==lastQuality||now-lastAdapt>2500){lastQuality=quality;lastAdapt=now;const f=metrics.frames.slice(-120).sort((a,b)=>a-b);const p90=f[Math.floor(f.length*.9)]||16.7;
     renderer.shadowMap.enabled=quality!=='low'&&!(software&&quality==='auto');let next=quality==='high'?1:quality==='low'?.55:scale;
     if(quality==='auto'&&f.length>=60){if(p90>18.3)next=Math.max(.40,scale-.08);else if(p90<16.9)next=Math.min(1,scale+.025)}
     if(Math.abs(next-scale)>.005){scale=next;resize()}
   }
   surfaces.water.normalMap.offset.set(world.time*.016,world.time*.009);
   renderer.info.reset();renderer.render(scene,camera);drawCount++;
   metrics.scale=scale;metrics.draws=renderer.info.render.calls;metrics.triangles=renderer.info.render.triangles;metrics.instances=Object.values(batch).reduce((sum,a)=>sum+a.length,0);metrics.cpu=performance.now()-now;
 }
 resize();
 return {active:true,draw,resize,gpu,software,engine:'Three.js r'+THREE.REVISION,get drawCount(){return drawCount},get resolution(){return [canvas.width,canvas.height]},dispose(){disposed=true;people.dispose();for(const m of cache.values()){scene.remove(m);m.dispose()}if(ground){ground.geometry.dispose();ground.material.dispose()}if(river)river.geometry.dispose();materials.get('contact')?.map.dispose();for(const g of Object.values(geos))g.dispose();for(const m of materials.values())m.dispose();for(const s of Object.values(surfaces)){s.map.dispose();s.normalMap.dispose()}env.dispose();renderer.dispose()}};
}

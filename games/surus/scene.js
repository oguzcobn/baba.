import * as T from '../../js/vendor/three.module.min.js';

const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .72, ...extra });
import { GLTFLoader } from './GLTFLoader.js';

// The supplied GLB uses metres, Y up and negative Z forward.
async function loadMercedes(scene) {
  const {scene:asset}=await new GLTFLoader().loadAsync(new URL('./c32.glb',import.meta.url).href);
  const car=new T.Group(), body=new T.Group(), wheels=[], steering=[];
  scene.add(car); car.add(body); body.add(asset);
  asset.updateMatrixWorld(true);
  for (const name of ['Object_32','Object_36','Object_40','Object_44']) {
    const assembly=asset.getObjectByName(name).parent;
    const center=new T.Box3().setFromObject(assembly).getCenter(new T.Vector3());
    const pivot=new T.Group(), wheel=new T.Group();
    car.add(pivot); pivot.position.copy(center);pivot.add(wheel);
    wheel.attach(assembly); wheels.push(wheel);
    if(center.z<0) steering.push(pivot);
  }
  asset.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=true;node.receiveShadow=true;
    if(node.material.name.includes('glass_ex')){
      node.material.transparent=true;node.material.opacity=.20;
      node.material.depthWrite=false;node.material.side=T.DoubleSide;
    }
  });
  return {car,body,wheels,steering};
}

export async function createCoast(container, pose, length, city) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x8ab6cd);
  scene.fog = new T.FogExp2(0xa9c6d2,.0017);
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  container.append(renderer.domElement);
  // Linear HDR sky and horizon for directional reflections in paint and glass.
  const environmentScene = new T.Scene();
  const dome = new T.Mesh(new T.SphereGeometry(20,48,24),new T.ShaderMaterial({
    side:T.BackSide,
    vertexShader:'varying vec3 ray; void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 ray;
      void main(){
        vec3 d=normalize(ray);
        vec3 sky=mix(vec3(1.32,1.36,1.39),vec3(.23,.49,.89),sqrt(max(d.y,0.)));
        float sun=pow(max(dot(d,normalize(vec3(.7,.9,-.45))),0.),350.);
        vec3 c=mix(vec3(.14,.13,.11),sky,smoothstep(-.09,.03,d.y))+sun*vec3(9.,7.,4.);
        gl_FragColor=vec4(c,1.);
      }`
  }));
  environmentScene.add(dome);
  const pmrem=new T.PMREMGenerator(renderer);
  const reflection=pmrem.fromScene(environmentScene);
  scene.environment=reflection.texture;
  pmrem.dispose(); dome.geometry.dispose(); dome.material.dispose();
  const camera = new T.PerspectiveCamera(60,1,.12,1700);
  scene.add(new T.HemisphereLight(0xcbe6ff,0x746451,2.05));
  const sun = new T.DirectionalLight(0xffe2b3,2.55);
  sun.position.set(210,270,-140);
  scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,far:150});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.025;

  function strip(left, right, height, color, spacing = 2) {
    const coords = [], faces = [];
    for (let d=0;d<=length+spacing;d+=spacing) {
      for (const offset of [left,right]) {
        const p = pose(Math.min(length,d),offset);
        coords.push(p.x,height,-p.y);
      }
      const i = coords.length / 3 - 2;
      if (i) faces.push(i-2,i,i-1,i-1,i,i+1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
    g.setIndex(faces); g.computeVertexNormals();
    const mesh=new T.Mesh(g,material(color,{side:T.DoubleSide}));mesh.receiveShadow=true;scene.add(mesh);
  }
  strip(-235,-7,-.21,0x7d8467,5);
  strip(-7,-3.7,-.035,0xb4aa98);
  strip(-3.7,3.7,0,0x34393b);
  strip(3.7,9,-.035,0xc4b5a1);
  strip(9,43,-.21,0xc5b596);
  const water = material(0x2d879b,{roughness:.28,metalness:.21});
  const sea = new T.Mesh(new T.PlaneGeometry(6000,6000),water);
  sea.position.set(1900,-.4,550);
  sea.rotation.x = -Math.PI/2;
  scene.add(sea);

  function instances(geometry, surface, items) {
    const mesh = new T.InstancedMesh(geometry,surface,items.length);
    const helper = new T.Object3D();
    items.forEach(([d, offset, y, w, h, depth, angle],i) => {
      const p = pose(d,offset);
      helper.position.set(p.x,y,-p.y);
      helper.rotation.y = -p.heading + (angle || 0);
      helper.scale.set(w,h,depth);
      helper.updateMatrix();
      mesh.setMatrixAt(i,helper.matrix);
    });
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
  const markings=[], buildings=[], windows=[], trunks=[], crowns=[];
  for (let d=4;d<length-4;d+=8) markings.push([d,0,.011,.105,.014,3]);
  for (let d=12;d<length-20;d+=23) {
    const variation = Math.sin(d*.81);
    const h=9+(variation+1)*8, w=10+(variation+1)*3;
    if(city.paved(pose(d,-24).x,pose(d,-24).y) || Math.abs(((d-90+270)%180)-90)<14) continue;
    for(const side of [-108,-180]) buildings.push([d,side,h/2,w,h,15]);
    buildings.push([d,-24,h/2,w,h,15]);
    for (let y=2;y<h-1;y+=2.65) {
      for (const along of [-4,0,4]) windows.push([d+along,-24+w/2+.07,y,.14,1.13,1.5]);
    }
    trunks.push([d,8.1,1.65,.22,3.3,.22],[d+8,-9,1.45,.26,2.9,.26]);
    crowns.push([d,8.1,3.55,1.8,.82,1.5],[d+8,-9,3.1,2.15,2.05,2.1]);
  }
  const cube=new T.BoxGeometry(1,1,1);
  instances(cube,material(0xe8dfc3),markings);
  instances(cube,material(0xbfb29a),buildings);
  instances(cube,material(0x3d535c,{roughness:.4}),windows);
  instances(new T.CylinderGeometry(.5,.63,1,8),material(0x6e5741),trunks);
  instances(new T.IcosahedronGeometry(.71,1),material(0x526c40),crowns);
  const model = await loadMercedes(scene);
  const streetVertices=[];
  for(const e of city.segments.filter(e=>e.city)){
    const nx=e.dy/Math.sqrt(e.squared)*e.width, ny=-e.dx/Math.sqrt(e.squared)*e.width;
    for(const [point,side] of [[e.a,-1],[e.b,-1],[e.a,1],[e.a,1],[e.b,-1],[e.b,1]]){
      streetVertices.push(point.x+side*nx,.024,-point.y-side*ny);
    }
  }
  const streets=new T.BufferGeometry();
  streets.setAttribute('position',new T.Float32BufferAttribute(streetVertices,3));streets.computeVertexNormals();
  const pavement=material(0x404344,{side:T.DoubleSide});
  const cityMesh=new T.Mesh(streets,pavement);cityMesh.receiveShadow=true;scene.add(cityMesh);
  strip(-1200,-234,-.27,0x8a9167,12);
  const rainGeometry=new T.BufferGeometry(), drops=[];
  for(let i=0;i<750;i++){
    const x=Math.random()*48-24,y=Math.random()*20,z=Math.random()*48-24;
    drops.push(x,y,z,x-.04,y+.42,z);
  }
  rainGeometry.setAttribute('position',new T.Float32BufferAttribute(drops,3));
  const rain=new T.LineSegments(rainGeometry,new T.LineBasicMaterial({color:0xaac0cd,transparent:true,opacity:.58}));
  scene.add(rain);
  let lastWeather;
  function atmosphere(mode){
    const wet=mode==='rain', dusk=mode==='dusk', fog=mode==='fog';
    scene.background.set(dusk?0xe2a27e:wet?0x85929b:fog?0xb5c2c6:0x8ab6cd);
    scene.fog.color.copy(scene.background);scene.fog.density=fog?.014:wet?.005:.0017;
    sun.color.set(dusk?0xffae63:wet?0xc8d7e3:0xffe2b3);
    sun.intensity=wet||fog?.77:dusk?2.1:2.55;
    pavement.roughness=wet?.18:.76;rain.visible=wet;
  }
  const shadow = new T.Mesh(new T.CircleGeometry(1,24),new T.MeshBasicMaterial({color:0x161c1e,transparent:true,opacity:.34,depthWrite:false}));
  shadow.rotation.x = -Math.PI/2;
  shadow.scale.set(.99,2.05,1);
  scene.add(shadow);
  const observer = new ResizeObserver(() => resize());
  observer.observe(container);
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  resize();
  return {
    draw(car, chase, weather) {
      const p={x:car.x,y:car.y,heading:car.angle};
      if(weather!==lastWeather){atmosphere(weather);lastWeather=weather;}
      const dusk=weather==='dusk';
      sun.target.position.set(p.x,0,-p.y);
      sun.position.set(p.x+48,dusk?12:62,-p.y-30);
      rain.position.set(p.x,4-(performance.now()*.011)%7,-p.y);
      const vx=Math.sin(p.heading), vz=-Math.cos(p.heading);
      model.car.position.set(p.x,0,-p.y);
      model.car.rotation.y = -p.heading;
      model.car.visible = true;
      model.body.rotation.z = car.roll;
      model.body.rotation.x = car.pitch;
      for (const wheel of model.wheels) wheel.rotation.x = -car.spin;
      for (const pivot of model.steering) {
        const tangent=Math.tan(car.steer);
        pivot.rotation.y=-Math.atan(tangent/(1-pivot.position.x*tangent/2.72));
      }
      shadow.position.set(p.x,.012,-p.y);
      shadow.rotation.z = -p.heading;
      shadow.visible = chase;
      if(chase){
        camera.position.set(p.x-vx*6.6,2.62,-p.y-vz*6.6);
        camera.lookAt(p.x+vx*9,.88,-p.y+vz*9);
      }else{
        model.body.updateWorldMatrix(true,false);
        camera.position.set(-.35,1.16,-.07).applyMatrix4(model.body.matrixWorld);
        camera.quaternion.copy(model.body.getWorldQuaternion(camera.quaternion));
        camera.rotateX(-.06);
      }
      renderer.render(scene,camera);
    }
  };
}

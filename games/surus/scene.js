import {buildHighlands} from './landscape.js';
import {coastalLife} from './life.js';
import {buildHouses} from './houses.js?v=7';
import {steeringRig} from './hands.js';
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
    for(const [along,side] of [[d,8.1],[d+8,-9]]){
      const p=pose(along,side);
      const blocked=city.segments.some(e=>{
        const t=Math.min(1,Math.max(0,((p.x-e.a.x)*e.dx+(p.y-e.a.y)*e.dy)/e.squared));
        return Math.hypot(p.x-e.a.x-t*e.dx,p.y-e.a.y-t*e.dy)<e.width+2.2;
      });
      if(blocked)continue;
      trunks.push([along,side,1.6,.23,3.2,.23]);crowns.push([along,side,3.54,1.9,1.2,1.65]);
    }
  }
  const cube=new T.BoxGeometry(1,1,1);
  instances(cube,material(0xe8dfc3),markings);
  buildHouses(scene,pose,length,city);
  instances(new T.CylinderGeometry(.5,.63,1,8),material(0x6e5741),trunks);
  instances(new T.IcosahedronGeometry(.71,1),material(0x526c40),crowns);
  const updateLife=coastalLife(scene,pose,length);
  const model = await loadMercedes(scene);
  const moveHands=steeringRig(model.body);
  const streetVertices=[];
  for(const e of city.segments.filter(e=>e.city)){
    const nx=e.dy/Math.sqrt(e.squared)*e.width, ny=-e.dx/Math.sqrt(e.squared)*e.width;
    for(const [point,side] of [[e.a,-1],[e.b,-1],[e.a,1],[e.a,1],[e.b,-1],[e.b,1]]){
      const x=point.x+side*nx,y=point.y+side*ny;
      streetVertices.push(x,city.area.height(x,y)+.04,-y);
    }
  }
  const streets=new T.BufferGeometry();
  streets.setAttribute('position',new T.Float32BufferAttribute(streetVertices,3));streets.computeVertexNormals();
  const pavement=material(0x404344,{side:T.DoubleSide});
  const cityMesh=new T.Mesh(streets,pavement);cityMesh.receiveShadow=true;scene.add(cityMesh);
  // Close the shoreline on the inland side without sweeping a wide ribbon around tight bends.
  const shore=new T.Shape(city.area.shore.map(p=>new T.Vector2(p.x,p.y)));
  shore.closePath();
  buildHighlands(scene,city.area,city);
  const land=new T.Mesh(new T.ShapeGeometry(shore),material(0x859371,{side:T.DoubleSide}));
  land.rotation.x=-Math.PI/2;land.position.y=-.22;scene.add(land);
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
      const altitude=city.area.height(p.x,p.y);
      const dusk=weather==='dusk';
      sun.target.position.set(p.x,altitude,-p.y);
      sun.position.set(p.x+48,altitude+(dusk?12:62),-p.y-30);
      rain.position.set(p.x,altitude+4-(performance.now()*.011)%7,-p.y);
      const vx=Math.sin(p.heading), vz=-Math.cos(p.heading);
      model.car.position.set(p.x,altitude,-p.y);
      model.car.rotation.y = -p.heading;
      model.car.visible = true;
      moveHands(car.steer);
      model.body.rotation.z = car.roll;
      model.body.rotation.x = car.pitch+Math.atan((city.area.height(p.x+vx,p.y-vz)-city.area.height(p.x-vx,p.y+vz))/2);
      for (const wheel of model.wheels) wheel.rotation.x = -car.spin;
      for (const pivot of model.steering) {
        const tangent=Math.tan(car.steer);
        pivot.rotation.y=-Math.atan(tangent/(1-pivot.position.x*tangent/2.72));
      }
      shadow.position.set(p.x,altitude+.055,-p.y);
      shadow.rotation.z = -p.heading;
      shadow.visible = chase;
      if(chase){
        camera.position.set(p.x-vx*6.6,altitude+2.62,-p.y-vz*6.6);
        camera.lookAt(p.x+vx*9,altitude+.88,-p.y+vz*9);
      }else{
        model.body.updateWorldMatrix(true,false);
        camera.position.set(-.35,1.16,-.07).applyMatrix4(model.body.matrixWorld);
        camera.quaternion.copy(model.body.getWorldQuaternion(camera.quaternion));
        camera.rotateX(-.06);
      }
      updateLife(car);
      renderer.render(scene,camera);
    }
  };
}

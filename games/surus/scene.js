import * as T from '../../js/vendor/three.module.min.js';

const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .72, ...extra });
const box = (parent, surface, x, y, z, w, h, d) => {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), surface);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

function shell(parent, rings, surface) {
  const positions = [], indices = [];
  for (const [z, bottom, shoulder, top, width, upper] of rings) {
    positions.push(-width,bottom,z, -width,shoulder,z, -upper,top,z, upper,top,z, width,shoulder,z, width,bottom,z);
  }
  for (let row = 0; row < rings.length - 1; row++) {
    for (let col = 0; col < 6; col++) {
      const a = row * 6 + col, b = row * 6 + (col + 1) % 6;
      indices.push(a,b,b+6,a,b+6,a+6);
    }
  }
  const last = (rings.length - 1) * 6;
  for (let i = 1; i < 5; i++) indices.push(0,i+1,i,last,last+i,last+i+1);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, surface);
  parent.add(mesh);
}

function makeKartal(scene) {
  const car = new T.Group();
  scene.add(car);
  const coat = new T.MeshPhysicalMaterial({ color: 0xc4b88f, metalness: .32, roughness: .31, clearcoat: .85, side: T.DoubleSide });
  const glass = material(0x243b40, { roughness: .19, metalness: .35, side: T.DoubleSide });
  const rubber = material(0x171817), trim = material(0x222627), alloy = material(0xa1a39d, { metalness: .65 });
  const red = material(0x980f09, { emissive: 0x270401 }), amber = material(0xd47720);
  const white = material(0xf2ead3, { emissive: 0x292514 });
  const wheels = [], steering = [];
  const body = new T.Group();
  car.add(body);
  shell(body, [[-2.1,.39,.67,.72,.74,.72],[-1.92,.37,.77,.82,.81,.79],[-.83,.36,.83,.86,.83,.8],[1.94,.36,.84,.86,.82,.79],[2.09,.4,.78,.81,.77,.75]], coat);
  shell(body, [[-.82,.83,.85,.86,.78,.76],[-.27,.84,.91,1.40,.76,.65],[1.78,.84,.91,1.39,.77,.65],[2.02,.84,.9,1.29,.75,.64]], glass);
  box(body, coat, 0,1.41,.73,1.32,.065,2.13);
  for (const side of [-1,1]) {
    for (const [z, angle] of [[-.56,-.79],[.43,0],[1.34,0],[1.90,.54]]) {
      box(body, coat, side*.705,1.125,z,.065,.57,.065).rotation.x = angle;
    }
    box(body, trim, side*.817,.64,.02,.035,.057,3.58);
    box(body, trim, side*.88,.99,-.57,.21,.11,.13);
    box(body, trim, side*.51,1.47,.79,.057,.058,1.94);
    for (const z of [-.22,.82]) {
      box(body, trim, side*.828,.77,z,.022,.043,.15);
      box(body, trim, side*.836,.60,z+.12,.01,.25,.015);
    }
    box(body, red, side*.607,.684,2.088,.29,.122,.047);
    box(body, amber, side*.607,.774,2.088,.29,.05,.047);
    box(body, white, side*.604,.685,-2.105,.29,.12,.041);
    for (const z of [-1.24,1.25]) {
      const pivot = new T.Group(), wheel = new T.Group();
      pivot.position.set(side*.77,.298,z);
      car.add(pivot); pivot.add(wheel);
      const tire = new T.Mesh(new T.CylinderGeometry(.298,.298,.177,36), rubber);
      tire.rotation.z = Math.PI/2;
      wheel.add(tire);
      const rim = new T.Mesh(new T.CylinderGeometry(.177,.177,.191,24), alloy);
      rim.rotation.z = Math.PI/2;
      wheel.add(rim);
      for (let i=0;i<6;i++) {
        const a = i*Math.PI/3;
        const hole = box(wheel, trim, side*.098, Math.sin(a)*.103, Math.cos(a)*.103, .004,.047,.035);
        hole.rotation.x = -a;
      }
      wheels.push(wheel);
      if (z < 0) steering.push(pivot);
    }
  }
  box(body, trim, 0,.445,2.104,1.65,.115,.135);
  box(body, trim, 0,.445,-2.109,1.64,.115,.135);
  box(body, trim, 0,.68,-2.105,.85,.125,.04);
  for (let n=0;n<3;n++) box(body, alloy, 0,.642+n*.037,-2.129,.78,.011,.012);
  const plate = document.createElement('canvas');
  plate.width = 256; plate.height = 64;
  const p = plate.getContext('2d');
  p.fillStyle = '#ecebe1'; p.fillRect(0,0,256,64);
  p.fillStyle = '#2056a5'; p.fillRect(0,0,22,64);
  p.fillStyle = '#161d21'; p.font = 'bold 40px sans-serif'; p.textAlign = 'center';
  p.fillText('07 KRT 94',139,47);
  const texture = new T.CanvasTexture(plate);
  texture.colorSpace = T.SRGBColorSpace;
  box(body, material(0xffffff,{map:texture}),0,.59,2.12,.36,.09,.018);
  box(body, trim, -.37,.895,2.025,.68,.025,.02).rotation.z = -.15;
  return { car, body, wheels, steering };
}

export function createCoast(container, pose, length) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x8ab6cd);
  scene.fog = new T.FogExp2(0xa9c6d2,.0017);
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  container.append(renderer.domElement);
  const camera = new T.PerspectiveCamera(60,1,.12,1700);
  scene.add(new T.HemisphereLight(0xcbe6ff,0x746451,2.05));
  const sun = new T.DirectionalLight(0xffe2b3,2.55);
  sun.position.set(210,270,-140);
  scene.add(sun);

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
    scene.add(new T.Mesh(g,material(color,{side:T.DoubleSide})));
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
    scene.add(mesh);
  }
  const markings=[], buildings=[], windows=[], trunks=[], crowns=[];
  for (let d=4;d<length-4;d+=8) markings.push([d,0,.011,.105,.014,3]);
  for (let d=12;d<length-20;d+=23) {
    const variation = Math.sin(d*.81);
    const h=9+(variation+1)*8, w=10+(variation+1)*3;
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
  const model = makeKartal(scene);
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
    draw(car, chase, steering) {
      const p = pose(car.distance,car.offset), vx=Math.sin(p.heading), vz=-Math.cos(p.heading);
      model.car.position.set(p.x,0,-p.y);
      model.car.rotation.y = -p.heading;
      model.car.visible = chase;
      model.body.rotation.z = -steering * car.speed * .0017;
      for (const wheel of model.wheels) wheel.rotation.x = -car.distance/.298;
      for (const pivot of model.steering) pivot.rotation.y = -steering*.23;
      shadow.position.set(p.x,.012,-p.y);
      shadow.rotation.z = -p.heading;
      shadow.visible = chase;
      const follow = chase ? 6.4 : -.35;
      camera.position.set(p.x-vx*follow,chase ? 2.72 : 1.28,-p.y-vz*follow);
      camera.lookAt(p.x+vx*11,chase ? .83 : 1.10,-p.y+vz*11);
      renderer.render(scene,camera);
    }
  };
}

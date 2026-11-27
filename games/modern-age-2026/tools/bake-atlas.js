import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setClearColor(0,0);
const cell=80,steps=6,actions=['idle','walk','work','carry','carryIdle','ready'];
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xfff4e5,0x9da095,1.75));
const sun=new T.DirectionalLight(0xfff2dc,2.25);sun.position.set(-3,6,4);scene.add(sun);
const cam=new T.OrthographicCamera(-1.05,1.05,1.05,-1.05,.1,50);
cam.position.set(8,8+.84,8);cam.lookAt(0,.84,0);
const loader=new GLTFLoader();
export async function bake(id){
 const g=await loader.loadAsync('./assets/people/'+id+'.glb');scene.add(g.scene);
 const mixer=new T.AnimationMixer(g.scene);
 const crate=new T.Mesh(new T.BoxGeometry(.37,.26,.28),new T.MeshStandardMaterial({color:0x927447}));crate.position.set(0,1.04,.27);g.scene.add(crate);
 renderer.setSize(cell,cell,false);
 const sheet=document.createElement('canvas');sheet.width=8*cell;sheet.height=cell*steps*actions.length;const ctx=sheet.getContext('2d');
 for(let a=0;a<actions.length;a++){
  mixer.stopAllAction();const clip=g.animations.find(c=>c.name===actions[a]);const act=mixer.clipAction(clip).play();
  crate.visible=actions[a].startsWith('carry');
  for(let s=0;s<steps;s++){
   act.time=clip.duration*s/steps;mixer.update(0);
   for(let dir=0;dir<8;dir++){
    g.scene.rotation.y=dir*Math.PI/4;
    renderer.render(scene,cam);ctx.drawImage(renderer.domElement,dir*cell,(a*steps+s)*cell)
   }
  }
 }
 scene.remove(g.scene);return sheet.toDataURL('image/webp',.90).split(',')[1]
}

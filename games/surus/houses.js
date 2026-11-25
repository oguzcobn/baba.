import {widths,depths} from './lots.js';
import * as T from '../../js/vendor/three.module.min.js';

// Each facade is generated floor by floor, with recessed windows, timber trim and a stone plinth.
function facade(theme,floors) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=floors*96;
  const c=canvas.getContext('2d'),H=canvas.height;
  c.fillStyle=['#e4d5b7','#eadfc9','#debaa4'][theme];c.fillRect(0,0,512,H);
  c.fillStyle='#a79781';c.fillRect(0,H-22,512,22);
  for(let y=0;y<H;y+=96){
    c.fillStyle=theme===0?'#78563f':'#b6a18b';c.fillRect(0,y,512,6);
    for(let i=0;i<4;i++){
      const x=24+i*123;
      c.fillStyle='#705b4d';c.fillRect(x,y+18,76,56);
      c.fillStyle='#6d8590';c.fillRect(x+4,y+22,68,48);
      c.fillStyle='#d2c9b8';c.fillRect(x+37,y+21,3,50);c.fillRect(x+4,y+41,68,2);
      c.fillStyle='#b9a993';c.fillRect(x-3,y+73,82,4);
      if(theme===0){c.fillStyle='#635342';c.fillRect(x-9,y+19,8,53);c.fillRect(x+77,y+19,8,53);}
    }
  }
  c.fillStyle='#584639';c.fillRect(218,H-69,42,69);
  if(theme===1){
    c.fillStyle='#223e42';c.fillRect(0,H-85,512,85);
    c.fillStyle='#b9d3d0';for(let x=12;x<512;x+=82)c.fillRect(x,H-48,72,43);
    c.fillStyle='#962f27';c.fillRect(0,H-88,512,34);
    c.fillStyle='#fff2d6';c.font='bold 26px sans-serif';c.textAlign='center';c.fillText('AKDENİZ MARKET',256,H-62);
    for(let i=0;i<24;i++){c.fillStyle=['#bc9038','#729248','#ce7141'][i%3];c.fillRect(15+i*20,H-18,12,10);}
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  return new T.MeshStandardMaterial({map:texture});
}
export function buildHouses(scene,pose,length,roads){
  const roof=new T.BufferGeometry();
  const a=[-.5,0,-.5],b=[.5,0,-.5],c=[.5,0,.5],d=[-.5,0,.5],e=[0,1,-.27],f=[0,1,.27];
  roof.setAttribute('position',new T.Float32BufferAttribute([a,e,b,b,e,f,b,f,c,c,f,d,d,f,e,d,e,a].flat(),3));roof.computeVertexNormals();
  const box=new T.BoxGeometry(),dummy=new T.Object3D();
  const tile=new T.MeshStandardMaterial({color:0x964a32,side:T.DoubleSide}),stone=new T.MeshStandardMaterial({color:0xc4b7a0});
  for(let theme=0;theme<3;theme++){
    const floors=[2,4,3][theme],h=floors*2.85,w=widths[theme],dep=depths[theme];
    const walls=facade(theme,floors),items=[];
    items.push(...roads.buildings.filter(lot=>lot.theme===theme));
    function batch(geo,mat,parts){
      const mesh=new T.InstancedMesh(geo,mat,items.length*parts.length);let k=0;
      for(const p of items)for(const [x,y,z,sx,sy,sz] of parts){
        dummy.rotation.y=-p.heading;dummy.position.set(p.x,y,-p.y);
        dummy.translateX(x);dummy.translateZ(z);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(k++,dummy.matrix);
      }
      mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
    }
    batch(box,walls,[[0,h/2-.19,0,w,h,dep]]);
    batch(roof,tile,[[0,h-.19,0,w+1.2,1.65,dep+1.2]]);
    const balconies=[];
    for(let k=1;k<floors;k++){
      balconies.push([w/2+.48,k*2.85,0,1.25,.18,4.2],[w/2+1.03,k*2.85+.55,0,.13,1.05,4.2]);
    }
    batch(box,stone,balconies);
  }
}

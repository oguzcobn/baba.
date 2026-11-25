import * as T from '../../js/vendor/three.module.min.js';
export function buildHighlands(scene,area,city){
  const verts=[],indices=[],colors=[];
  const grass=new T.Color(0x899454),stone=new T.Color(0x806e5c),tint=new T.Color();
  const steps=88;
  for(let i=0;i<=90;i++)for(let j=0;j<=steps;j++){
    const p=area.world(400+i*10,-440+j*10),h=area.height(p.x,p.y);
    verts.push(p.x,h-.13,-p.y);
    tint.copy(grass).lerp(stone,Math.min(1,h/112+.12*Math.sin(i*.54)*Math.cos(j*.31)));colors.push(tint.r,tint.g,tint.b);
    const k=i*(steps+1)+j;
    if(i&&j)indices.push(k,k-1,k-steps-2,k,k-steps-2,k-steps-1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  const terrain=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide}));terrain.receiveShadow=true;scene.add(terrain);
  const trees=[];
  for(let i=0;i<960;i++){
    const u=470+(i*337%650),v=(i*281%700)-350,p=area.world(u,v);
    if(!city.paved(p.x,p.y)&&!area.path.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<8))trees.push(p);
  }
  const mesh=new T.InstancedMesh(new T.ConeGeometry(2.3,8,8),new T.MeshStandardMaterial({color:0x3e604a}),trees.length);
  const o=new T.Object3D();trees.forEach((p,i)=>{o.position.set(p.x,area.height(p.x,p.y)+3.8,-p.y);o.updateMatrix();mesh.setMatrixAt(i,o.matrix)});scene.add(mesh);
  for(const [d,side,label] of [[78,-5.7,'← KÖY  •  DAĞ YOLU'],[90,-215,'YAYLA KÖYÜ  ↑']]){
    const p=city.pose(d,side),canvas=document.createElement('canvas');canvas.width=512;canvas.height=92;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#305346';ctx.fillRect(0,0,512,92);ctx.strokeStyle='#e3e5ce';ctx.strokeRect(5,5,502,82);
    ctx.fillStyle='#fff';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(label,256,59);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas)}));sprite.position.set(p.x,2.6,-p.y);sprite.scale.set(5.6,1,1);scene.add(sprite);
  }
}

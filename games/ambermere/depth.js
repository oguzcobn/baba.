// Revolve measured silhouette sections around the spine and retain the painted flank as vertex colour.
const fishMeshes=new Map();
function fishMesh(id){
 if(fishMeshes.has(id))return fishMeshes.get(id);
 const art=portrait(id),w=art.width,h=art.height,rgba=art.getContext('2d').getImageData(0,0,w,h).data;
 const nx=88,nr=36,vertices=[],panels=[];
 for(let i=0;i<=nx;i++){
  const u=i/nx,x=Math.round((8+u*192)*3);
  let top=h,bottom=-1;
  for(let y=0;y<h;y++){if(rgba[(y*w+x)*4+3]>50){top=Math.min(top,y);bottom=y}}
  if(bottom<0){top=bottom=h/2}
  const cy=(top+bottom)/2,ry=Math.max(1,(bottom-top)/2);
  let width=.084*Math.pow(Math.sin(Math.PI*u),.65)*(1-.65*u);
  if(u>.76)width*=Math.max(.10,1-(u-.76)*14);
  for(let j=0;j<nr;j++){
   const a=2*Math.PI*j/nr,dy=Math.sin(a),iy=Math.max(0,Math.min(h-1,Math.round(cy+dy*(ry-1))));
   const idx=(iy*w+x)*4;
   vertices.push([u-.5,(iy-h/2)/(192*3),Math.cos(a)*width,u]);
   if(i<nx){const k=i*nr+j,n=i*nr+(j+1)%nr;
    panels.push({ids:[k,n,n+nr,k+nr],color:rgba[idx+3]>50?[rgba[idx],rgba[idx+1],rgba[idx+2]]:[110,109,77]})}
  }
 }
 const mesh={vertices,panels};fishMeshes.set(id,mesh);return mesh
}
function renderFish3D(g,id,x,y,size,yaw,beat,tilt=0){
 const {vertices,panels}=fishMesh(id),cs=Math.cos(yaw),sn=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
 const pts=vertices.map(([vx,vy,vz,u])=>{
  const bend=.057*u*u*Math.sin(beat-u*7),z=vz+bend;
  const xx=vx*cs-z*sn,zz=vx*sn+z*cs;
  return [xx*ct-vy*st,xx*st+vy*ct-zz*.10,zz]
 });
 let visible=[];
 for(const p of panels){let [a,b,c,d]=p.ids.map(i=>pts[i]);
  let dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],ex=d[0]-a[0],ey=d[1]-a[1],ez=d[2]-a[2];
  let nz=ex*dy-ey*dx;if(nz<=0)continue;
  let ny=ez*dx-ex*dz,nx=ey*dz-ez*dy,n=Math.hypot(nx,ny,nz)||1;
  const light=.74+.29*Math.max(0,(nz*.74-ny*.60-nx*.28)/n);
  visible.push({a,b,c,d,z:a[2]+b[2]+c[2]+d[2],col:p.color.map(k=>Math.min(255,Math.round(k*light)))})
 }
 visible.sort((a,b)=>a.z-b.z);g.save();g.translate(x,y);g.scale(size,size);
 g.lineWidth=.6/size;g.lineJoin='round';
 for(const p of visible){g.fillStyle=g.strokeStyle='rgb('+p.col.join(',')+')';g.beginPath();g.moveTo(p.a[0],p.a[1]);g.lineTo(p.b[0],p.b[1]);g.lineTo(p.c[0],p.c[1]);g.lineTo(p.d[0],p.d[1]);g.closePath();g.fill();g.stroke()}
 g.restore()
}
let orbitYaw=.28,dragX=null,lastInspect=-100;
function inspectFish(now){
 const c=document.getElementById('specimen');if(!c||phase!=='landed'||now-lastInspect<42)return;
 lastInspect=now;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
 renderFish3D(g,fishID,c.width*.5,c.height*.51,c.width*.84,orbitYaw+.15*Math.sin(now*.00055),now*.004)
}
function bindOrbit(c){
 orbitYaw=.28;c.style.touchAction='none';c.style.cursor='grab';c.tabIndex=0;
 c.onpointerdown=e=>{dragX=e.clientX;c.setPointerCapture(e.pointerId)};
 c.onpointermove=e=>{if(dragX!==null){orbitYaw+=(e.clientX-dragX)*.015;dragX=e.clientX}};
 c.onlostpointercapture=()=>{dragX=null};c.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();orbitYaw+=e.key==='ArrowLeft'?-.18:.18}}
}

const foreground=document.createElement('canvas'),pier=document.createElement('canvas');
let look=0,cam=0;
document.addEventListener('pointermove',e=>{look=(e.clientX/innerWidth-.5)*2});
const lake=document.querySelector('#lake'),ctx=lake.getContext('2d'),bg=document.createElement('canvas');
let W,H,sea,px,py,seed,tip,waterX,waterY,phase='idle',castAt=0;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))}
function line(c,x,y,X,Y,col,n=1){let k=Math.ceil(Math.max(Math.abs(x-X),Math.abs(y-Y)));for(let i=0;i<=k;i++)rect(c,x+(X-x)*i/k,y+(Y-y)*i/k,n,n,col)}
function pine(c,x,y,h,col){rect(c,x-h*.025,y-h,h*.05,h,col);for(let j=0;j<h*.91;j++){let width=(j/h*.28+0.012)*h*(.73+.27*((j%Math.max(3,h*.16))/(h*.16)));rect(c,x-width,y-h+j,2*width+1,1,col)}}
function makeScene(){
W=lake.width=Math.max(240,Math.round(lake.clientWidth/2.5));H=lake.height=Math.max(140,Math.round(lake.clientHeight/2.5));bg.width=W;bg.height=H;let c=bg.getContext('2d');seed=1235;sea=Math.round(H*.51);px=Math.round(W*.30);py=Math.round(H*.77);waterX=W*.60;waterY=H*.77;
for(let y=0;y<H;y++){let t=y/sea;let col=t<.55?mix('#716984','#eb9b91',t/.55):t<1?mix('#eb9b91','#ffce90',(t-.55)/.45):mix('#d69993','#535777',(y-sea)/(H-sea));rect(c,0,y,W,1,col)}
let sx=W*.625,sy=sea*.78,R=Math.min(W*.052,H*.106);
for(let y=-R;y<R;y++){let half=Math.sqrt(R*R-y*y);rect(c,sx-half,sy+y,half*2,1,mix('#fff5bf','#ffcf81',(y+R)/(2*R)))}
for(let j=0;j<30;j++){let x=rnd()*W,y=rnd()*sea*.8,len=(.03+rnd()*.12)*W;for(let k=0;k<11;k++){let dx=rnd()*len,dy=Math.sin(dx/len*Math.PI)*4;rect(c,x+dx,y-dy+rnd()*3,rnd()*len*.5+2,1+rnd()*2,mix('#e3a0a0','#ffc7a7',y/sea))}}
function ridge(base,amp,col,trees,freq){let prev=0,target=0,noise=0;for(let x=0;x<W;x++){if(x%12===0){prev=target;target=rnd()*3}noise=prev+(target-prev)*(x%12)/12;let y=base-amp*(.5+.31*Math.sin(x/W*freq+.8)+.19*Math.sin(x/W*freq*2.4))+noise;rect(c,x,y,1,sea-y+1,col);if(trees&&x%2===0)pine(c,x,y+2,2+rnd()*trees,col)}}
ridge(sea,sea*.27,'#b58090',0,9);ridge(sea+2,sea*.17,'#996e87',3,13);ridge(sea+2,sea*.075,'#715e78',6,8);
for(let j=0;j<W*6;j++){let x=rnd()*W,t=rnd(),y=sea+t*(H-sea);let glow=Math.abs(x-sx)<(R*.38+R*t*2)*(rnd()+.2);rect(c,x,y,(1+rnd()*5)*(1+t*2),1,glow?mix('#ffdb9d','#e6a584',t):mix('#d9a2a0','#686c8a',t))}
function island(side,width,base,col){for(let i=0;i<width;i++){let x=side?W-i:i,top=base-(1-i/width)*H*.055;rect(c,x,top,1,base-top+1,col);if(i%3===0)pine(c,x,top+1,(4+rnd()*13)*(1-i/width+.1),col);if(i%4===0)rect(c,x+rnd()*4,base+1+rnd()*4,3+rnd()*6,1,'#8b7789')}}
island(1,W*.26,sea+H*.05,'#54516a');island(0,W*.19,sea+H*.075,'#494b63');
pier.width=foreground.width=W;pier.height=foreground.height=H;c=pier.getContext('2d');
// Timber piles, cross-braces and the individual boards of the old pier.
for(let i=0;i<3;i++){let x=px*i/2;rect(c,x,py+3,5,H*.16,'#3c3843');rect(c,x,py+5,1,H*.13,'#987267');line(c,x,py+H*.13,x+20,py+4,'#53424a',2)}
// Project each timber as a quadrilateral with a receding back edge.
for(let i=0;i<12;i++){const ax=i*(px+12)/12,bx=(i+1)*(px+12)/12;const nearY=py+11+(1-i/12)*7;
 c.fillStyle=i%2?'#ab7964':'#b9876b';c.beginPath();c.moveTo(ax,py);c.lineTo(bx-.5,py);c.lineTo(bx-10,nearY);c.lineTo(ax-10,nearY+.5);c.closePath();c.fill();
 rect(c,ax-10,nearY,bx-ax,3,'#634c4c')}
// Seated angler, cap, russet jacket, dark trousers and boots.
let x=px-2,y=py;
rect(c,x-5,y-9,9,6,'#404353');rect(c,x,y-6,8,4,'#42465a');rect(c,x+5,y-4,4,10,'#3d4358');rect(c,x+5,y+6,7,2,'#302f3c');rect(c,x-4,y-4,4,10,'#555369');rect(c,x-4,y+5,6,3,'#393542');
rect(c,x-6,y-17,9,11,'#a2584d');rect(c,x-4,y-17,6,9,'#c77d5b');rect(c,x+2,y-13,4,3,'#a25c4f');rect(c,x+5,y-12,5,2,'#e9b082');rect(c,x-3,y-24,7,7,'#e2a77b');rect(c,x-4,y-23,3,6,'#65494b');rect(c,x-6,y-26,9,5,'#bc7153');rect(c,x-7,y-23,15,2,'#754f49');rect(c,x-5,y-16,8,2,'#e3a263');
tip=[x+37,y-37];
let lx=px-26;rect(c,lx-3,y-7,6,7,'#53434b');rect(c,lx-2,y-6,4,4,'#ffdb8e');rect(c,lx-1,y-9,2,2,'#57454a');
c=foreground.getContext('2d');
// Dark banks with layered conifers and reeds framing the water.
for(let side=0;side<2;side++){let edge=side?W:0,sign=side?-1:1;for(let i=0;i<W*.145;i++){let t=i/(W*.145),y=H*(.84+.17*t)+Math.sin(i*.12)*2;rect(c,edge+sign*i,y,1,H-y,'#333746');if(i%2===0){let h=3+rnd()*13;line(c,edge+sign*i,y,edge+sign*i+rnd()*8-4,y-h,'#41434f');if(i%6===0)rect(c,edge+sign*i,y-h,2,4,'#755960')}}}
for(let i=0;i<6;i++){let x=W-i*W*.013,y=H*(.89+i*.018);pine(c,x,y,H*(.48-i*.053),'#3b4052')}
pine(c,0,H*.83,H*.34,'#414254');pine(c,W*.026,H*.86,H*.21,'#444759');
for(let i=0;i<7;i++){let x=W*(.4+rnd()*.35),y=sea*(.19+rnd()*.26);line(c,x-2,y-1,x,y+1,'#775e72');line(c,x,y+1,x+3,y-1,'#775e72')}
}
function animate(t){cam+=(look-cam)*.045;ctx.drawImage(bg,-2+cam,0,W+4,H);for(let i=0;i<45;i++){let a=Math.sin(t*.001+i*37);if(a>.28){let x=(i*73.13)%W,y=sea+5+(i*19.3)%(H-sea-6);ctx.globalAlpha=a*.45;rect(ctx,x+a*2,y,3+i%6,1,'#ffe3ae')}}ctx.globalAlpha=1;
ctx.save();ctx.translate(cam*3,0);ctx.drawImage(pier,0,0);updateRig(t);
const load=phase==='fight'?rig.tension/rig.limit:0;
let end=[tip[0]+load*3,tip[1]+load*8];
ctx.beginPath();ctx.moveTo(px+5,py-11);ctx.quadraticCurveTo(px+23,py-39,...end);ctx.strokeStyle='#604a48';ctx.lineWidth=1;ctx.stroke();
if(['waiting','bite','fight'].includes(phase)){
 let f=Math.min(1,Math.max(0,(t-castAt)/620)),progress=phase==='fight'?Math.min(1.2,rig.r/rig.range):1;
 let x=end[0]+(px+10+(castX*W-px-10)*progress-end[0])*f;
 let y=end[1]+(py+12+(castY*H-py-12)*progress-end[1])*f-4*24*f*(1-f);
 if(phase==='fight')y+=Math.sin(rig.clock*1.6)*3*progress;
 const dip=rig.z*190;
 ctx.strokeStyle='#f0ddbeae';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(...end);ctx.quadraticCurveTo((end[0]+x)/2,(end[1]+y)/2+(1-load)*10,x,y+dip);ctx.stroke();
 if(phase==='fight'){ctx.globalAlpha=.72;renderFish3D(ctx,fishID,x+4,y+4,13+rig.L*33,.42*Math.sin(rig.clock),rig.beat,Math.sin(rig.clock)*.12);ctx.globalAlpha=1}
 rect(ctx,x-1,y-3+dip,2,Math.max(1,4-dip),'#df6549');rect(ctx,x-1,y+1+Math.min(2,dip),2,1,'#fce6c1');
 if(f===1){ctx.strokeStyle='#fbd7b699';ctx.beginPath();ctx.ellipse(x,y+3,4+(t/230)%7,1.6,0,0,Math.PI*2);ctx.stroke()}
}
if(phase==='release'){
 let u=Math.min(1,(t-releaseTime)/2100);ctx.globalAlpha=(1-u)*.9;
 renderFish3D(ctx,fishID,px+15+u*W*.23,py+12+u*H*.14,(15+rig.L*33)*(1-u*.4),Math.PI+u*.7,t*.017,-.12);
 ctx.globalAlpha=1;if(u===1)reset('The fish swims back into the lake.');
}
ctx.restore();ctx.drawImage(foreground,-8+cam*7,0,W+16,H);inspectFish(t);requestAnimationFrame(animate)}


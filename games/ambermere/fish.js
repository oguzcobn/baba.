// Field-guide portraits use a consistent lateral projection, facing left.
// Latin name, depth, game length range, four colours, display name, fin shape, markings, bait weights.
const profiles = [
  ["Perca flavescens", 29, 13, 38, "#47512f", "#c7ad48", "#e4d8a5", "#b86b32", "Yellow perch", "perch", "bars", "0012"],
  ["Oncorhynchus mykiss", 22, 20, 55, "#405c54", "#9eaf9d", "#e8e1d0", "#796b69", "Rainbow trout", "trout", "rainbow", "22"],
  ["Lepomis macrochirus", 40, 10, 28, "#354a41", "#879550", "#deb979", "#6d7449", "Bluegill", "sunfish", "bars", "012"],
  ["Cyprinus carpio", 33, 25, 70, "#59492f", "#bd9550", "#e2c998", "#9d7441", "Golden carp", "soft", "plain", "11"],
  ["Lepomis gibbosus", 40, 9, 25, "#4c6050", "#a9a66b", "#e5ab54", "#838048", "Pumpkinseed", "sunfish", "spots", "01"],
  ["Micropterus dolomieu", 30, 18, 49, "#474c34", "#9d8952", "#d5cba2", "#83764c", "Smallmouth bass", "perch", "bars", "02"],
  ["Salmo trutta", 25, 20, 65, "#66513b", "#b69962", "#e1d5ad", "#866544", "Brown trout", "trout", "redspots", "02"],
  ["Salvelinus fontinalis", 24, 16, 45, "#394841", "#878954", "#efb27a", "#bc6948", "Brook trout", "trout", "redspots", "02"],
  ["Salvelinus namaycush", 23, 30, 80, "#384d49", "#617875", "#c4cfbb", "#748d84", "Lake trout", "trout", "lightspots", "2"],
  ["Salvelinus alpinus", 23, 22, 65, "#3d5559", "#779399", "#de9b72", "#a75e4b", "Arctic char", "trout", "lightspots", "2"],
  ["Oncorhynchus nerka", 22, 18, 46, "#394f67", "#9eb3be", "#e4e5d9", "#727f8c", "Kokanee salmon", "trout", "plain", "12"],
  ["Coregonus clupeaformis", 25, 25, 60, "#53655b", "#a8b8b0", "#eae6d3", "#8b9686", "Lake whitefish", "trout", "plain", "0"],
  ["Esox lucius", 15, 30, 95, "#394835", "#758054", "#d7d2a0", "#81794b", "Northern pike", "pike", "lightspots", "2"],
  ["Esox niger", 15, 22, 62, "#49512d", "#a6ac58", "#e2d49c", "#817e4a", "Chain pickerel", "pike", "chain", "2"],
  ["Esox masquinongy", 16, 40, 105, "#4b5349", "#9ca88b", "#d6d7c3", "#86775e", "Muskellunge", "pike", "bars", "2"],
  ["Sander vitreus", 22, 23, 67, "#53553c", "#a59156", "#dfd9b8", "#8d8055", "Walleye", "perch", "mottle", "02"],
  ["Sander canadensis", 20, 18, 48, "#49483d", "#9a8965", "#c9c7af", "#826e58", "Sauger", "perch", "mottle", "0"],
  ["Micropterus salmoides", 32, 18, 58, "#374b35", "#90a267", "#e5dfbf", "#818453", "Largemouth bass", "perch", "stripe", "02"],
  ["Ambloplites rupestris", 36, 11, 28, "#54523c", "#a28d60", "#d0c7a8", "#82775e", "Rock bass", "perch", "spots", "0"],
  ["Pomoxis nigromaculatus", 38, 15, 37, "#384641", "#9bada0", "#e0e5d4", "#708174", "Black crappie", "perch", "mottle", "02"],
  ["Pomoxis annularis", 36, 15, 39, "#485549", "#b7c4af", "#e6ead5", "#929f8c", "White crappie", "perch", "bars", "02"],
  ["Lepomis auritus", 37, 10, 26, "#3f5252", "#819a77", "#e18a51", "#94765b", "Redbreast sunfish", "sunfish", "cheek", "02"],
  ["Lepomis cyanellus", 34, 10, 25, "#3d513d", "#829765", "#cdbd76", "#8c8853", "Green sunfish", "sunfish", "cheek", "0"],
  ["Lepomis microlophus", 39, 12, 32, "#4f5640", "#9e9c72", "#dfd5aa", "#918764", "Redear sunfish", "sunfish", "ear", "01"],
  ["Ictalurus punctatus", 23, 23, 75, "#48565c", "#85979c", "#d5d7c8", "#73838b", "Channel catfish", "catfish", "spots", "0"],
  ["Ameiurus natalis", 26, 15, 42, "#625937", "#b8a465", "#e4d298", "#958358", "Yellow bullhead", "catfish", "plain", "0"],
  ["Tinca tinca", 30, 20, 56, "#3e5237", "#83904c", "#d0bd7c", "#626843", "Tench", "soft", "plain", "01"],
  ["Scardinius erythrophthalmus", 32, 11, 37, "#5c603c", "#c9b66c", "#eae2bc", "#c55b42", "Rudd", "soft", "plain", "12"],
  ["Rutilus rutilus", 27, 11, 39, "#505e62", "#acb9b5", "#e6e3cd", "#b46850", "Common roach", "soft", "plain", "01"],
  ["Notemigonus crysoleucas", 25, 8, 24, "#526344", "#c4bb6b", "#e6dfad", "#9b9361", "Golden shiner", "soft", "plain", "12"]
];
const artwork=new Map();
function portrait(id){
 if(artwork.has(id))return artwork.get(id);
 const [,depth,,,back,side,belly,fin,,family,pattern]=profiles[id], c=document.createElement('canvas');
 c.width=660;c.height=320;const g=c.getContext('2d');g.scale(3,3);g.translate(6,54);
 function path(d,fill,stroke,width=.65){const p=new Path2D(d);if(fill){g.fillStyle=fill;g.fill(p)}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke(p)}return p}
 function ellipse(x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,2*Math.PI);g.fill()}
 function rays(ax,ay,bx,by,cx,cy,n){for(let j=0;j<n;j++){let k=j/(n-1);path('M'+ax+' '+ay+' L'+(bx+(cx-bx)*k)+' '+(by+(cy-by)*k),null,'#44372470',.45)}}
 let d=depth,top=-d*.76;
 path('M151 -5 Q169 -8 194 -22 Q194 -11 186 0 Q194 12 195 22 Q175 15 151 5 Z',fin,back);rays(155,0,192,-20,189,19,17);
 if(family==="trout"){path('M69 -13 L82 -33 Q97 -33 103 -14 Z',fin,back);path('M133 -9 Q139 -19 144 -12 L147 -7Z',fin,back)}
 else if(family==='soft'||family==='catfish'||family==='pike'){
  const dx=family==='pike'?49:0;
  g.save();g.translate(dx,0);path('M65 -10 Q75 -22 78 -34 Q91 -27 105 -11 Z',fin,back);rays(90,-12,78,-32,97,-16,8);g.restore();
  if(family==='catfish')path('M127 -7 Q133 -16 143 -11 L146 -6Z',fin,back);
 }
 else{let p='M46 '+(top+8);for(let j=0;j<12;j++)p+=' L'+(49+j*4.8)+' '+(top-3-Math.sin(j*.30)*5)+' l2 5';p+=' Q122 '+(top-7)+' 134 -8 L123 -4 Z';path(p,fin,back);rays(85,top+8,57,top-5,109,top,14)}
 path('M102 11 L116 30 Q122 32 132 27 L127 10 Z',fin,back);rays(109,13,117,29,131,27,7);
 const body='M3 2 Q7 -6 21 '+(-d*.36)+' C52 '+(-d*1.18)+' 81 '+(-d*1.10)+' 115 '+(-d*.60)+' Q141 -5 157 -5 L158 5 Q133 5 111 '+(d*.54)+' Q68 '+(d*1.17)+' 36 '+(d*.70)+' Q16 '+(d*.52)+' 6 8 L2 5 Z';
 let grad=g.createLinearGradient(0,-d,2,d);[[0,back],[.27,back],[.49,side],[.66,side],[.86,belly],[1,'#ada184']].forEach(([s,v])=>grad.addColorStop(s,v));let outline=path(body,grad,back);g.save();g.clip(outline);
 if(id===1)path('M0 -1 Q50 -3 80 -2 T159 -1 L159 2 Q80 3 22 10Z','#c881908c');
 let seed=29+id;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let j=0;j<8;j++){let x=35+j*14;if(pattern==='bars')path('M'+x+' -36 q-3 12 2 25 l3 '+(12+rand()*8)+' q3 -13 4 -18 l0 -27Z',id===0?'#374932a8':'#50503768')}
 for(let row=-9;row<=8;row++){for(let j=0;j<31;j++){let x=38+j*4.4+(row%2)*2,y=row*3.3;path('M'+x+' '+y+' q2 3 4 -.2',null,rand()>.45?'#fff7dd47':'#403e3840',.45)}}
 if(['redspots','spots','lightspots','mottle','rainbow'].includes(pattern)){for(let j=0;j<200;j++){let x=14+rand()*140,y=(rand()-.7)*d*1.65;ellipse(x,y,.4+rand(),.4+rand(),pattern==='lightspots'?'#e3d9aece':pattern==='redspots'?(j%4?'#423d30aa':'#af4f38'):pattern==='mottle'?'#36443999':id===4?'#b5732b99':'#313a38ab')}}
 if(pattern==='stripe')path('M30 0 Q64 -4 96 -1 L153 0 Q95 6 42 7Z','#374a32a8');
 if(pattern==='chain')for(let x=35;x<141;x+=12)path('M'+x+' -12 q-8 12 3 17 q10 -6 4 -17Z',null,'#445035',1.2);
 path('M38 4 Q87 0 150 1',null,'#f1e6c660',.7);g.restore();
 path('M31 '+(-d*.44)+' Q45 1 32 '+(d*.54),null,back,1.2);
 if(family==="sunfish"){ellipse(37,-3,4,2.7,'#283635');if(id===4||pattern==="ear")ellipse(40,-3,1.7,2,'#d47141');for(let j=0;j<4;j++)path('M11 '+(3+j*2)+' q12 3 19 -2',null,'#72a6a0',.85)}
 path('M39 5 Q52 5 63 15 Q53 20 42 13Z',fin,back);rays(40,6,60,14,53,16,6);
 ellipse(17,-d*.18,3.7,3.7,back);ellipse(17,-d*.18,2.9,2.9,'#d5b472');ellipse(17,-d*.18,1.9,2.1,'#142222');ellipse(16.4,-d*.18-.9,.6,.6,'#fff5e2');path('M3 5 Q11 7 17 3',null,back);if(id===3)path('M8 6 Q7 14 3 13 M12 7 q0 7 -2 8',null,fin,1);
 if(family==='catfish')path('M8 5 Q2 17 17 24 M10 6 Q16 16 28 18 M6 4 Q1 9 1 14',null,back,1.1);
 artwork.set(id,c);return c;
}
function drawFish(g,id,x,y,length,angle,beat){
 const img=portrait(id),h=length*img.height/img.width;g.save();g.translate(x,y);g.rotate(angle);
 for(let col=0;col<img.width;col+=12){let n=Math.min(12,img.width-col),u=col/img.width,dy=h*.10*u*u*Math.sin(beat-u*6);g.drawImage(img,col,0,n,img.height,(u-.5)*length,-h/2+dy,length*n/img.width+.28,h)}
 g.restore();
}

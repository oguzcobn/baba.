const $=s=>document.getElementById(s),species=profiles.map(profile=>profile[8]),baits=['Earthworm','Sweet corn','Feather fly'];let bait=0,timer,session=0,records=[],audio;
try{let data=JSON.parse(localStorage.getItem('ambermere-journal'));if(Array.isArray(data))records=data.filter(f=>f&&species.includes(f.name)&&Number.isFinite(f.cm))}catch{}
function reset(msg){clearTimeout(timer);$('cast').disabled=false;phase='idle';$('cast').textContent='⚓  Cast line';$('notice').textContent=msg;$('hint').innerHTML='Click or press <kbd>SPACE</kbd>'}
let rig,fishID,castX,castY,releaseTime,lastFrame=0,accum=0,lastReadout=0,inspecting=false;
const baitPools=baits.map((_,baitIndex)=>profiles.flatMap((profile,id)=>
 Array.from(profile[11]).filter(code=>Number(code)===baitIndex).map(()=>id)));
function pickFish(){
 const pool=baitPools[bait];
 fishID=pool[Math.floor(Math.random()*pool.length)];
 const [,depth,min,max]=profiles[fishID],cm=Math.round(min+(max-min)*(Math.random()+Math.random())/2);
 rig=rigModel(cm,depth,6+Math.random()*4);accum=0;
}
function act(){
 if($('panel').open)return;
 if(phase==='idle'){
  pickFish();phase='waiting';castAt=performance.now();castX=.48+Math.random()*.22;castY=.64+Math.random()*.15;
  $('notice').textContent='Watch the float for a bite.';$('cast').textContent='Retrieve line';$('hint').textContent='The bait is in the water';
  timer=setTimeout(()=>{phase='bite';$('notice').textContent='The float dips. Set the hook!';$('cast').textContent='Set hook';tone(620)},3000+Math.random()*4000);tone(230)
 }else if(phase==='waiting')reset('Line retrieved.');
 else if(phase==='bite'){phase='fight';$('cast').textContent='Pause reel';$('hint').textContent='Click or press Space to pause';lastReadout=0}
 else if(phase==='fight'){rig.reeling=!rig.reeling;$('cast').textContent=rig.reeling?'Pause reel':'Resume reel';$('hint').textContent=rig.reeling?'Click or press Space to pause':'Click or press Space to resume'}
}
function updateRig(now){
 const elapsed=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(!rig||$('panel').open||!['waiting','bite','fight'].includes(phase))return;
 accum+=elapsed;const dt=1/120;
 while(accum>=dt){stepFloat(rig,now/1000,phase==='bite',dt);if(phase==='fight')stepFight(rig,dt);accum-=dt}
 if(phase==='fight'&&rig.r<.85){land();return}
 if(phase==='fight'&&now-lastReadout>200){lastReadout=now;$('notice').textContent=(rig.slip?'Drag slipping':rig.reeling?'Reeling':'Holding')+' · '+rig.r.toFixed(1)+' m · '+rig.tension.toFixed(1)+' N'}
}
function land(){
 const name=species[fishID],cm=Math.round(rig.L*100);
 records.push({name,cm});try{localStorage.setItem('ambermere-journal',JSON.stringify(records))}catch{}
 $('count').textContent=++session;$('total').textContent=records.length;
 phase='landed';inspecting=true;$('notice').textContent='';$('cast').disabled=true;tone(790);
 show(name,'<p class="latin">'+profiles[fishID][0]+'</p><canvas class="specimen" id="specimen" width="660" height="320"></canvas><small>Drag to rotate · ← →</small><div class="measure">'+cm+' cm <small>total length</small></div><button class="release" id="release">Release into lake</button>');
 paintSpecimen($('specimen'),fishID);bindOrbit($('specimen'));$('release').onclick=()=>$('panel').close();$('release').focus()
}
function paintSpecimen(canvas,id){canvas.setAttribute('aria-label',species[id]+' side view');canvas.getContext('2d').drawImage(portrait(id),0,0,canvas.width,canvas.height)}
$('panel').addEventListener('close',()=>{if(inspecting){inspecting=false;phase='release';releaseTime=performance.now();$('notice').textContent='Released';$('cast').textContent='Releasing…';$('hint').textContent='Watch the fish swim away'}}); 
$('total').textContent=records.length;$('cast').onclick=act;
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!$('panel').open&&(document.activeElement===document.body||document.activeElement===$('cast'))){e.preventDefault();act()}});
function show(title,html){$('inside').innerHTML='<h2>'+title+'</h2>'+html;$('panel').showModal();$('close').focus()}
$('journal').onclick=()=>{
 const caught=species.filter(n=>records.some(f=>f.name===n));
 show('Catch journal',caught.length?'<p>'+caught.length+' of '+species.length+' species discovered</p>'+caught.map(n=>{
 let list=records.filter(f=>f.name===n),id=species.indexOf(n);
 return '<article><canvas class="thumb" data-fish="'+id+'" width="220" height="106"></canvas><span><b>'+n+'</b><br>'+list.length+' caught · longest '+list.reduce((m,f)=>Math.max(m,f.cm),0)+' cm</span></article>'}).join(''):'<p>0 of '+species.length+' species discovered. Your first catch will appear here. Try an earthworm to tempt a perch.</p>');
 document.querySelectorAll('.thumb').forEach(c=>paintSpecimen(c,Number(c.dataset.fish)))
};
$('help').onclick=()=>show('How to fish','<p>Cast, watch the float, and set the hook when it dips. The reel starts winding. During a strong run the drag gives line automatically. Click the reel button or press Space to pause or resume.</p><p>The readout shows distance in metres and tension in newtons. Bring the fish alongside the pier to see it up close, then release it.</p>');
$('close').onclick=()=>$('panel').close();$('panel').onclick=e=>{if(e.target===$('panel'))$('panel').close()};
$('bait').onclick=()=>{if(phase!=='idle'){$('notice').textContent='Retrieve your line before changing bait.';return}$('baits').hidden=!$('baits').hidden};baits.forEach((n,i)=>{let b=document.createElement('button');b.textContent=n;b.onclick=()=>{bait=i;$('baitname').textContent=n;document.querySelector('.worm').textContent=['🪱','🌽','🪶'][i];$('baits').hidden=true};$('baits').append(b)});document.addEventListener('click',e=>{if(!e.target.closest('.gear'))$('baits').hidden=true});
function tone(hz){if(!audio||audio.state!=='running')return;let o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.4);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.42)}
$('sound').onclick=async()=>{if(!audio){audio=new AudioContext();let length=audio.sampleRate*4,b=audio.createBuffer(1,length,audio.sampleRate),d=b.getChannelData(0),v=0;for(let i=0;i<length;i++){v=.976*v+.024*(Math.random()*2-1);d[i]=v*.5*(.65+.35*Math.sin(i/length*2*Math.PI))}let s=audio.createBufferSource();s.buffer=b;s.loop=true;s.connect(audio.destination);s.start();await audio.resume()}else if(audio.state==='running')await audio.suspend();else await audio.resume();let on=audio.state==='running';$('sound').textContent=on?'♫':'♪';$('sound').style.color=on?'#f9bb7b':'';$('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label','Turn lake sounds '+(on?'off':'on'))}

new ResizeObserver(makeScene).observe(lake);makeScene();requestAnimationFrame(animate);

const {test,expect,devices}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
const xi=['KL','ST','ST','BK','BK','OS','OS','OS','KN','KN','FV'].map((pos,i)=>({name:pos+' Player '+i,pos,r:76}));
const slots=xi.map((p,i)=>({x:12+i*7,y:p.pos==='KL'?95:p.pos==='FV'?12:Math.max(14,83-i*7)}));
const team=(name,short,c1)=>({name,short,c1,xi,slots});
for(const [name,device] of [['Desktop', {viewport:{width:1440,height:900}}],['iPhone 13',devices['iPhone 13']]]){
 test.describe('Real browser 2D match replay: '+name,()=>{
  const {defaultBrowserType,browserName,...emulation}=device;
  test.use({...emulation,reducedMotion:'reduce'});
  test('goal crosses line before score; passes and players move without jumps; stadium extends beyond goals',async({page})=>{
   test.setTimeout(110000);
   await page.addInitScript(()=>{sessionStorage.setItem('baba_ok','1');window.__BABA_MATCH_TEST__=true;});
   await page.goto(BASE+'#draft');
   await page.evaluate(({xi,slots})=>{
    const h={name:'Home',short:'HOM',c1:'#e6403d',xi,slots};
    const a={name:'Away',short:'AWY',c1:'#3b78ce',xi,slots};
    Match2D.show({home:h,away:a,gh:1,ga:0,lh:1.5,la:.7,ev:[{t:'h',sc:'FV Player 10',as:'OS Player 5',min:23}]});
   },{xi,slots});
   await expect(page.locator('.m2d-ov canvas')).toBeVisible();
   const canvas=await page.locator('.m2d-ov canvas').evaluate(el=>({width:el.width,height:el.height}));
   expect(Math.max(canvas.width,canvas.height)).toBeGreaterThan(1050);
   await expect.poll(()=>page.evaluate(()=>window.__BABA_MATCH_DIAGNOSTICS__?.done),{timeout:90000,intervals:[500,1000]}).toBe(true);
   const result=await page.evaluate(()=>({
     diag:window.__BABA_MATCH_DIAGNOSTICS__,
     score:document.querySelector('.m2d-sc')?.textContent,
     pitch:document.querySelector('.m2d-pitch')?.getBoundingClientRect().toJSON()
   }));
   expect(result.score).toContain('1 – 0');
   expect(result.diag.goals).toHaveLength(1);
   expect(result.diag.goals[0].valid,'goal should only be awarded after the ball crosses the line').toBe(true);
   expect(result.diag.passes.length).toBeGreaterThan(0);
   expect(result.diag.passes.every(p=>p.end!==null)).toBe(true);
   expect(result.diag.passes.every(p=>Number.isFinite(p.receptionGap)&&p.receptionGap<=2.5),'no pass should be collected by a teammate far from its landing spot').toBe(true);
   expect(result.diag.frames.length).toBeGreaterThan(15);
   expect(result.diag.frames.every(f=>f.players.length===22)).toBe(true);
   for(const frame of result.diag.frames){
     for(const p of frame.players){
       expect(Number.isFinite(p.x)&&Number.isFinite(p.y)).toBe(true);
       expect(p.x).toBeGreaterThan(-5);expect(p.x).toBeLessThan(110);
       expect(p.y).toBeGreaterThan(-5);expect(p.y).toBeLessThan(73);
     }
   }
   // Sampling at >=120ms: players should not teleport across the pitch.
   for(let i=1;i<result.diag.frames.length;i++){
     const before=result.diag.frames[i-1],after=result.diag.frames[i],dt=(after.time-before.time)/1000;
     if(dt>1||before.clip!==after.clip)continue;
     for(let j=0;j<22;j++){
       const d=Math.hypot(after.players[j].x-before.players[j].x,after.players[j].y-before.players[j].y);
       expect(d,'player jumped '+after.players[j].name).toBeLessThanOrEqual(20*dt+2.5);
     }
   }
   await page.locator('.m2d-ov canvas').screenshot({path:'test-results/match2d-'+name.replaceAll(' ','-')+'.png',timeout:8000,animations:'disabled'}).catch(e=>console.warn('Optional screenshot unavailable:',e.message));
  });
 });
}

test('IFAB foul location determines penalty or free kick on both sides',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
 await page.goto(BASE+'#draft');
 const result=await page.evaluate(()=>({
  midfield:Match2D.foulRestart({x:52,y:34}),
  nearBox:Match2D.foulRestart({x:88.49,y:34}),
  onBoxLine:Match2D.foulRestart({x:88.5,y:34}),
  centralBox:Match2D.foulRestart({x:93,y:34}),
  wide:Match2D.foulRestart({x:92,y:56}),
  sideline:Match2D.foulRestart({x:103,y:13.84}),
  outsideField:Match2D.foulRestart({x:110,y:34})
 }));
 expect(result).toEqual({
  midfield:'FREEKICK',nearBox:'FREEKICK',onBoxLine:'PENALTY',
  centralBox:'PENALTY',wide:'FREEKICK',sideline:'PENALTY',outsideField:'FREEKICK'
 });
});


test.describe('Realistic scoring positions and pass reception',()=>{
 test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 test('centre-back only scores after reaching the attacking penalty area',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{sessionStorage.setItem('baba_ok','1');window.__BABA_MATCH_TEST__=true;});
  await page.goto(BASE+'#career');
  await page.evaluate(({xi,slots})=>{
   Match2D.show({
    home:{name:'Home',short:'HOM',c1:'#bd4458',xi,slots},
    away:{name:'Away',short:'AWY',c1:'#22648c',xi,slots},
    gh:1,ga:0,lh:1.2,la:.8,
    ev:[{t:'h',sc:'ST Player 1',as:'OS Player 5',min:28,how:'cross'}]
   });
  },{xi,slots});
  await expect.poll(()=>page.evaluate(()=>window.__BABA_MATCH_DIAGNOSTICS__?.done),{timeout:105000,intervals:[1000]}).toBe(true);
  const result=await page.evaluate(()=>window.__BABA_MATCH_DIAGNOSTICS__);
  const cbShots=result.shots.filter(s=>s.pos==='ST'&&s.out==='goal');
  expect(cbShots.length).toBeGreaterThan(0);
  for(const shot of cbShots){
   expect(shot.distance,'centre-back must reach the box before shooting').toBeLessThanOrEqual(19);
  }
  for(const pass of result.passes){
   expect(pass.end).not.toBeNull();
   expect(pass.receptionGap,'no receiver should collect the ball from a long distance').toBeLessThanOrEqual(2.5);
  }
  expect(result.goals).toHaveLength(1);
 });
});

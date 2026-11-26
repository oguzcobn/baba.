import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try {
 const page = await browser.newPage({viewport:{width:1280,height:800}});
 const errors = [];
 page.on('pageerror', e => errors.push(String(e)));
 await page.setContent(await readFile(new URL('./index.html',import.meta.url),'utf8'));
 await page.click('#new');
 await page.waitForTimeout(1000);
 assert.equal(await page.evaluate(()=>__MA.world.units.filter(u=>!u.enemy).length),6);
 await page.keyboard.press('b');
 await page.click('[data-build=hq]');
 const pos=await page.evaluate(()=>__MA.project(24,27));
 await page.locator('#map').click({position:pos});
 await page.evaluate(()=>{for(let i=0;i<900;i++)__MA.step(.05)});
 assert.equal(await page.evaluate(()=>__MA.world.buildings.find(b=>!b.enemy&&b.type==='hq')?.progress),1);
 await page.waitForTimeout(4000);
 const report=await page.evaluate(()=>({
 renderer:__MA.renderer?.gpu||'Canvas fallback',
 webgl2:!!__MA.renderer?.active,
 units:__MA.world.units.length,
 frames:__MA.metrics.frames.slice()
 }));
 const frames=report.frames.sort((a,b)=>a-b);
 report.meanFPS=frames.length?1000/(frames.reduce((a,b)=>a+b,0)/frames.length):null;
 report.p95FrameMs=frames.length?frames[Math.min(frames.length-1,Math.floor(frames.length*.95))]:null;
 report.errors=errors;
 delete report.frames;
 await writeFile('modern-age-report.json',JSON.stringify(report,null,2));
 await page.screenshot({path:'modern-age-preview.png'});
 console.log(report);
 assert.deepEqual(errors,[]);
 if(process.env.REQUIRE_WEBGL==='1') assert.equal(report.webgl2,true,'WebGL2 unavailable; 3D not verified');
} finally { await browser.close(); }

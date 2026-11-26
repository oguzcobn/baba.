const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../games/element/index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
new Function(script);
const engine=script.slice(0,script.indexOf('\nconst $=id'));
const factory=script.slice(script.indexOf('function createReactionLab('),script.indexOf('function mountReactionLab('));
const {M,makeEngine,createReactionLab}=new Function(engine+'\n'+factory+'\nreturn {M,makeEngine,createReactionLab}')();
const lab=createReactionLab(makeEngine,M);
const water=lab.pair(2,16,{},true);
assert.equal(water.status,'direct');assert.ok(water.novel.includes(17));assert.equal(water.frames.length,25);
assert.deepEqual(lab.pair(2,16,{},true),water);
assert.ok(lab.pair(16,2,{}).direct>0);
const lava=lab.pair(10,2,{});assert.ok(lava.direct>0&&lava.novel.includes(28));
assert.equal(lab.pair(24,24,{}).status,'none');
assert.ok(lab.pair(39,2,{}).plus[2]>0);
const tally={direct:0,difference:0,field:0,none:0};
let n=0;
for(const A of lab.IDs)for(const B of lab.IDs){
  const r=lab.pair(A,B,{steps:8,trials:1});
  assert.equal(r.A,A);assert.equal(r.B,B);
  assert.ok(Object.hasOwn(tally,r.status));
  assert.equal(r.plus.length,M.length);assert.equal(r.minus.length,M.length);
  assert.ok(Object.values(r.peak).every(Number.isFinite));
  tally[r.status]++;n++;
}
assert.equal(n,(M.length-1)**2);
console.log('All ordered pairs passed:',n,tally);

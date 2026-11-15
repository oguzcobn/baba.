
const {test,expect}=require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';

test('20 full Draft seasons: standings, goals, spread and rating sensitivity',async({page})=>{
  test.setTimeout(180000);
  await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
  await page.goto(BASE+'#draft',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#draftRoot')).toBeVisible({timeout:15000});
  const results=[];
  for(let i=0;i<20;i++){
    const rating=i<10?84:76;
    await page.evaluate(({rating,i})=>{
      const picks={};
      for(const [j,s] of DRAFT_SLOTS.entries()){
        picks[s.id]={name:'DRAFTTEST_'+i+'_'+j,pos:s.pos,r:rating,club:DRAFT_CLUBS[(j*3+i)%DRAFT_CLUBS.length].id,era:'FC27'};
      }
      const bench=['OS','FV'].map((pos,j)=>({name:'DRAFTTEST_BENCH_'+i+'_'+j,pos,r:rating-3,club:DRAFT_CLUBS[(j+9+i)%DRAFT_CLUBS.length].id,era:'FC27'}));
      const saved={v:3,bag:[],drawn:[],picks,bench,tac:{tempo:'dengeli',pres:'orta',hat:'dengeli',yon:'dengeli'},phase:'tactics',tab:'awards',mode:'normal',jokers:2,club:null,coach:3,last:null};
      localStorage.setItem('draft_state',JSON.stringify(saved));
      Draft.open(document.querySelector('#draftRoot'));
    },{rating,i});
    await expect(page.locator('#draftRoot [data-a=play]')).toBeEnabled({timeout:12000});
    await page.locator('#draftRoot [data-a=play]').click();
    await page.evaluate(()=>window.__draftSeason.fast());
    await expect(page.locator('#draftRoot .ss-showcase')).toBeVisible({timeout:12000});
    const record=await page.evaluate(({rating,i})=>{
      const state=JSON.parse(localStorage.getItem('draft_state'));
      const L=state.last;
      const rank=L.table.findIndex(x=>x.me)+1;
      return {sample:i+1,rating,rank,points:L.pts,scored:L.gf,conceded:L.ga,wins:L.w,draws:L.d,losses:L.l,champion:L.rank===1,
        validLeague:L.table.length,ownTablePoints:L.table.find(x=>x.me)?.p,clubs:L.table.map(x=>x.name)};
    },{rating,i});
    results.push(record);
    console.log('DRAFT_SEASON_RESULT '+JSON.stringify(record));
  }
  const summary={
    runs:results.length,
    strong:results.filter(x=>x.rating===84).map(x=>x.rank),
    medium:results.filter(x=>x.rating===76).map(x=>x.rank),
    rankCounts:Object.fromEntries(Array.from({length:18},(_,i)=>[i+1,results.filter(x=>x.rank===i+1).length]).filter(x=>x[1])),
    strongAverage:results.filter(x=>x.rating===84).reduce((a,x)=>a+x.rank,0)/10,
    mediumAverage:results.filter(x=>x.rating===76).reduce((a,x)=>a+x.rank,0)/10,
    avgPoints:results.reduce((a,x)=>a+x.points,0)/20,
    avgGoals:results.reduce((a,x)=>a+x.scored,0)/20
  };
  console.log('DRAFT_20_SUMMARY '+JSON.stringify(summary));
  expect(results).toHaveLength(20);
  for(const row of results){
    expect(row.validLeague).toBe(18);
    expect(row.rank).toBeGreaterThanOrEqual(1);
    expect(row.rank).toBeLessThanOrEqual(18);
    expect(row.points).toBe(row.ownTablePoints);
    expect(row.wins+row.draws+row.losses).toBe(34);
    expect(row.points).toBe(3*row.wins+row.draws);
  }
});

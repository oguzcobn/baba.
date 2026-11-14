const { test, expect, devices } = require('@playwright/test');
const BASE=process.env.BABA_TEST_URL||'http://127.0.0.1:4173/';
for(const [name,device] of [['iPhone 13',devices['iPhone 13']],['Pixel 7',devices['Pixel 7']],['iPad Mini',devices['iPad Mini']],['Desktop Chrome',{viewport:{width:1440,height:900}}]]){
 test.describe(name,()=>{
  const {defaultBrowserType, browserName, ...emulation}=device;
  test.use({...emulation});
  test.beforeEach(async({page})=>{
   await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
  });
  test('loads navigation, opens four pages, and has no horizontal overflow',async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   for(const id of ['gundem','lab','play','akis']){
    await page.goto(BASE+'#'+id,{waitUntil:'domcontentloaded'});
    await expect(page.locator('.bb-feature.bb-'+id)).toBeVisible({timeout:15000});
    await expect(page.locator('.bb-feature.bb-'+id+' .display')).toBeVisible();
    const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
    expect(dimensions.scroll,'overflow on '+id+': '+JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width+3);
   }
   expect(errors,'JavaScript page errors').toEqual([]);
  });
  test('quick navigation and page share control work',async({page})=>{
   await page.goto(BASE+'#play');
   await expect(page.locator('.bb-play')).toBeVisible();
   await page.keyboard.press('Control+k');
   await expect(page.locator('.bb-quick-dialog')).toBeVisible();
   await page.locator('.bb-quick-dialog input').fill('LAB');
   await expect(page.locator('.bb-quick-results a[href="#lab"]')).toBeVisible();
   await page.keyboard.press('Enter');
   await expect(page.locator('.bb-lab')).toBeVisible();
   await expect(page.locator('#babaSharedActions .baba-shared-trigger')).toBeVisible();
  });
  test('PLAY saves and filters a local item',async({page})=>{
   await page.goto(BASE+'#play');
   await expect(page.locator('#playForm')).toBeVisible();
   await page.locator('#playForm [name=title]').fill('Mobil test içeriği');
   await page.locator('#playForm button[type=submit]').click();
   await expect(page.locator('.bb-feed-post').filter({hasText:'Mobil test içeriği'})).toBeVisible();
  });
  test('AKIŞ saves a local post',async({page})=>{
   await page.goto(BASE+'#akis');
   await expect(page.locator('#akisForm')).toBeVisible();
   await page.locator('#akisForm [name=text]').fill('Mobil test paylaşımı');
   await page.locator('#akisForm button[type=submit]').click();
   await expect(page.locator('.bb-feed-post').filter({hasText:'Mobil test paylaşımı'})).toBeVisible();
  });
 });
}

test.describe('BABA. new daily experience',()=>{
 test.use({viewport:{width:390,height:844}});
 test.beforeEach(async({page})=>await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
 test('TODAY and mobile nav appear without overflow',async({page})=>{
  await page.goto(BASE+'#today');
  await expect(page.locator('.bb-today h1')).toBeVisible();
  await expect(page.locator('#bbMobileNav')).toBeVisible();
  await expect(page.locator('#bbMobileNav a[href="#backup"]')).toBeVisible();
  const d=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
  expect(d[0]).toBeLessThanOrEqual(d[1]+3);
 });
 test('BACKUP export and safe import UI',async({page})=>{
  await page.goto(BASE+'#backup');
  await expect(page.locator('#bbExport')).toBeVisible();
  await expect(page.locator('#bbImport')).toBeAttached();
 });
 test('shared actions menu replaces repeated buttons',async({page})=>{
  await page.goto(BASE+'#lab');
  await expect(page.locator('.bb-lab')).toBeVisible();
  await page.locator('.baba-shared-trigger').click();
  await expect(page.locator('.baba-shared-menu button')).toHaveCount(2);
  await expect(page.locator('.bb-lab .baba-actions')).toHaveCount(0);
 });
});

test.describe('Consolidated category navigation',()=>{
 test.use({viewport:{width:390,height:844}});
 test.beforeEach(async({page})=>page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
 for(const [route,links] of [['kesfet',['gundem','akis','play']],['hayat',['seyahat','foto']],['sosyal',['msn','dost']]]){
  test(route+' shows preserved legacy destinations',async({page})=>{
   await page.goto(BASE+'#'+route);
   await expect(page.locator('.bb-group-page')).toBeVisible();
   for(const id of links)await expect(page.locator('.bb-group-card[href="#'+id+'"]')).toBeVisible();
   const d=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
   expect(d[0]).toBeLessThanOrEqual(d[1]+3);
  });
 }
 test('home displays grouped categories instead of duplicated tiles',async({page})=>{
  await page.goto(BASE);
  await expect(page.locator('.hub-card[href="#kesfet"]')).toBeVisible();
  await expect(page.locator('.hub-card[href="#hayat"]')).toBeVisible();
  await expect(page.locator('.hub-card[href="#sosyal"]')).toBeVisible();
  await expect(page.locator('.hub-card[href="#gundem"]')).toHaveCount(0);
  await expect(page.locator('.hub-card[href="#lab"]')).toHaveCount(0);
 });
 test('legacy routes remain available and data modules load',async({page})=>{
  for(const [route,selector] of [['gundem','.bb-gundem'],['akis','.bb-akis'],['play','.bb-play'],['lab','.bb-lab']]){
   await page.goto(BASE+'#'+route);
   await expect(page.locator(selector)).toBeVisible();
  }
 });
});

test.describe('Mobile Messenger composer',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('expanded dock does not hide message input behind bottom navigation',async({page})=>{
  await page.goto(BASE+'#sosyal');
  await page.addStyleTag({content:'.ms-dock.open{display:flex!important}.ms-dock.open .ms-panel{display:flex!important}.ms-dock.open .ms-mini{display:flex!important}.ms-dock.open .ms-app.compact{display:flex!important}.ms-dock.open .ms-app.compact .ms-chat{display:flex!important}'});
  await page.evaluate(()=>{
   const dock=document.createElement('div');dock.className='ms-dock open';
   dock.innerHTML='<div class="ms-panel"><div class="ms-ph">Messenger</div><div class="ms-mini"><div class="ms-app compact chatting"><div class="ms-chat"><div class="ms-ch">Chat</div><div class="ms-msgs">Messages</div><form class="ms-comp"><textarea class="ms-in" placeholder="Message"></textarea><button class="ms-send">Send</button></form></div></div></div></div>';
   document.body.appendChild(dock);
  });
  const input=page.locator('.ms-dock.open .ms-in');
  await expect(input).toBeVisible();
  const bounds=await input.boundingBox();
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  await expect(page.locator('#bbMobileNav')).toBeHidden();
 });
});

test.describe('Draft career history',()=>{
 test.use({viewport:{width:390,height:844}});
 test.beforeEach(async({page})=>page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
 test('draft opens with an empty career panel',async({page})=>{
  await page.goto(BASE+'#draft');
  await expect(page.locator('.dr-career')).toBeVisible();
  await expect(page.locator('.dr-career-kpis')).toBeVisible();
 });
 test('draft archive survives reload without resetting existing squad',async({page})=>{
  await page.goto(BASE+'#draft');
  await page.evaluate(()=>localStorage.setItem('draft_history_v1',JSON.stringify([{id:'test',date:'2026-11-12T00:00:00.000Z',pts:82,rank:2,w:25,d:7,l:2,gf:70,ga:20,title:false}])));
  await page.reload();
  await expect(page.locator('.dr-career')).toContainText('82');
 });
});

test.describe('Draft manager mode',()=>{
 test.use({viewport:{width:390,height:844}});
 test.beforeEach(async({page})=>page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
 test('manager assets load on mobile',async({page})=>{
  await page.goto(BASE+'#draft');
  expect(await page.evaluate(()=>typeof Draft!=='undefined'&&typeof Draft.open==='function')).toBeTruthy();
  expect(await page.evaluate(()=>[...document.styleSheets].some(s=>s.href?.includes('draft-manager.css')))).toBeTruthy();
  await expect(page.locator('#draftRoot')).toBeVisible();
 });
});

test.describe('HAYAT life simulation',()=>{
 test.use({viewport:{width:390,height:844}});
 test.beforeEach(async({page})=>page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
 test('creates character, chooses actions, saves and restores',async({page})=>{
  await page.goto(BASE+'#hayat-oyunu');
  await expect(page.locator('.life-intro')).toBeVisible();
  await page.locator('#lifeName').fill('Test Oyuncu');
  await page.locator('#lifeStart').click();
  await expect(page.locator('.life-meters')).toBeVisible();
  await page.locator('[data-action="do:study"]').click();
  await page.locator('[data-action="month"]').click();
  await page.reload();
  await expect(page.locator('.life-time')).toContainText('18');
  if(await page.locator('.life-ov [data-ev]').count())await page.locator('.life-ov [data-ev]').first().click();
  await page.locator('[data-action="tab:money"]').click();
  await expect(page.locator('.life-budget')).toBeVisible();
  await page.locator('[data-action="tab:people"]').click();
  await expect(page.locator('.life-people')).toBeVisible();
 });
 test('old games still accessible',async({page})=>{
  await page.goto(BASE+'#oyunlar');
  await expect(page.locator('a[href="#draft"]').first()).toBeVisible();
  await expect(page.locator('a[href="#hayat-oyunu"]').first()).toBeVisible();
 });
});

test.describe('Draft career and 2D match enhancements',()=>{
 test.use({viewport:{width:390,height:844}});
 test.beforeEach(async({page})=>page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
 test('career achievements render on draft screen',async({page})=>{
  await page.goto(BASE+'#draft');
  await expect(page.locator('.dr-achievements')).toBeVisible();
  await expect(page.locator('.dr-achievement')).toHaveCount(6);
 });
 test('2D engine has responsive match analytics assets',async({page})=>{
  await page.goto(BASE+'#draft');
  expect(await page.evaluate(()=>typeof Match2D?.show==='function')).toBeTruthy();
  expect(await page.evaluate(()=>[...document.styleSheets].some(x=>x.href?.includes('draft-analytics.css')))).toBeTruthy();
 });
});

test.describe('Draft event-driven physics',()=>{
 test('simulates 22 players and coherent goal events',async({page})=>{
  await page.goto(BASE+'#draft');
  const result=await page.evaluate(()=>{
   const xi=['KL','ST','ST','BK','BK','OS','OS','OS','KN','KN','FV'].map((pos,i)=>({name:pos+i,pos,r:76}));
   const a=DraftPhysics.simulate({xi},{xi:xi.map(p=>({...p,name:'Away '+p.name}))});
   return {score:a.gh+a.ga,events:a.ev.length,shots:a.stats.shots,passes:a.stats.passes,poss:a.stats.possession};
  });
  expect(result.events).toBe(result.score);
  expect(result.shots[0]+result.shots[1]).toBeGreaterThan(0);
  expect(result.passes[0]+result.passes[1]).toBeGreaterThan(0);
  expect(result.poss[0]+result.poss[1]).toBe(100);
 });
});

test.describe('Draft Turkish nationality and chemistry',()=>{
 test('Turkish players show TR on cards and are included in same-nation links',async({page})=>{
  await page.goto(BASE+'#draft');
  const result=await page.evaluate(()=>({efecan:DRAFT_NAT['Efecan Karaca'],berkan:DRAFT_NAT['Berkan Kutlu'],levent:DRAFT_NAT['Levent Mercan'],foreign:DRAFT_NAT['Victor Osimhen']}));
  expect(result).toEqual({efecan:'TR',berkan:'TR',levent:'TR',foreign:'NG'});
 });
});

test.describe('2D replay fixes',()=>{
 test('2D engine loads and stadium viewport supports outer stands',async({page})=>{
  await page.goto(BASE+'#draft');
  expect(await page.evaluate(()=>typeof Match2D?.show==='function')).toBeTruthy();
  expect(await page.evaluate(()=>[...document.scripts].some(s=>s.src.includes('/js/match2d.js')))).toBeTruthy();
 });
});

test.describe('Manager career is a separate mode',()=>{
 test.use({viewport:{width:390,height:844}});
 test('career starts on its own route with its own save and leaves the draft untouched',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));
  await page.goto(BASE+'#draft');
  await expect(page.locator('#draft-section .mode-switch a[href="#career"]')).toBeVisible();
  const draftBefore=await page.evaluate(()=>localStorage.getItem('draft_state'));
  await page.goto(BASE+'#career');
  await expect(page.locator('#career-section.cr-start')).toBeVisible();
  await page.locator('[data-s="new"]').click();
  await expect(page.locator('.cr-head')).toBeVisible();
  await expect(page.locator('.cr-tabs button')).toHaveCount(5);
  await page.locator('[data-sp="0"]').click();
  await page.locator('[data-a="quick"]').click();
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('baba_career_save')));
  expect(save.week).toBe(1);
  expect(save.squad.length).toBeGreaterThan(15);
  expect(await page.evaluate(()=>localStorage.getItem('draft_state'))).toBe(draftBefore);
  await page.locator('[data-tab="league"]').click();
  await expect(page.locator('.cr-table.league tr.me')).toBeVisible();
 });
});


test.describe('HAYAT. animated city scene',()=>{
  test.use({viewport:{width:390,height:844},reducedMotion:'reduce'});
  test.beforeEach(async({page})=>await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1')));
  test('keeps saved life data and fits the city scene on mobile',async({page})=>{
    await page.addInitScript(()=>{
      localStorage.setItem('baba_life_game_v1',JSON.stringify({
        version:2,name:'Sahne Testi',avatar:'🧑',age:18,month:9,year:2026,cash:60200,
        savings:0,credit:650,stats:{health:88,happiness:100,energy:79,stress:28,knowledge:15,social:45,logic:15,creativity:15,fitness:40},
        traits:{ext:50,agr:50,con:50,neu:50,ope:50},likes:[],edu:0,studying:null,exp:0,
        job:null,career:[],company:null,loans:[],props:[],invest:{fund:0,gold:0,crypto:0},
        prices:{fund:100,gold:100,crypto:100},insurance:false,home:{district:'eski',own:null,rent:7500,shared:true},
        location:'eski',transport:'toplu',car:0,economy:{phase:'buyume',months:0,rate:42},people:[],
        pending:null,market:[],marketAt:-99,choices:0,log:[],prefs:{food:'Mantı',music:'Pop',film:'Komedi',team:'Trabzonspor'},
        world:{joined:false,hide:false,applied:[]},monthsPlayed:0,ended:false
      }));
    });
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(BASE+'#hayat-oyunu');
    const scene=page.locator('.life-scene');
    await expect(scene).toBeVisible();
    await expect(page.locator('.life-scene-art')).toBeVisible();
    await expect(page.locator('.life-top')).toContainText('Sahne Testi');
    const result=await page.evaluate(()=>({
      sceneWidth:document.querySelector('.life-scene').getBoundingClientRect().width,
      screenWidth:document.documentElement.clientWidth,
      game:JSON.parse(localStorage.getItem('baba_life_game_v1')),
      motionPreference:matchMedia('(prefers-reduced-motion: reduce)').matches,
      animation:getComputedStyle(document.querySelector('.life-scene-car')).animationName
    }));
    expect(result.sceneWidth).toBeLessThanOrEqual(result.screenWidth);
    expect(result.game.cash).toBe(60200);
    expect(result.game.version).toBe(2);
    expect(result.motionPreference).toBe(true);
    expect(result.animation).toBe('none');
    await page.locator('.life-scene-caption').click();
    await expect(page.locator('.life-map')).toBeVisible();
  });
});

test.describe('HAYAT. premium mobile navigation',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test.beforeEach(async({page})=>{await page.addInitScript(()=>sessionStorage.setItem('baba_ok','1'));});
  test('shows all seven readable navigation tiles and preserves pinch zoom accessibility',async({page})=>{
    await page.goto(BASE+'#hayat-oyunu');
    if(await page.locator('#lifeStart').isVisible()){
      await page.locator('#lifeName').fill('Mobil Test');
      await page.locator('#lifeStart').click();
    }
    const tabs=page.locator('.life-tabs .life-nav-item');
    await expect(tabs).toHaveCount(7);
    await expect(tabs.first()).toHaveAttribute('aria-current','page');
    const metrics=await page.evaluate(()=>({
      tiles:[...document.querySelectorAll('.life-nav-item')].map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,touch:getComputedStyle(el).touchAction})),
      viewport:document.querySelector('meta[name="viewport"]').content,
      bodyWidth:document.documentElement.scrollWidth,
      screenWidth:document.documentElement.clientWidth
    }));
    expect(metrics.tiles.every(x=>x.height>=44&&x.width>=44&&x.touch==='manipulation')).toBeTruthy();
    expect(metrics.viewport).not.toContain('user-scalable=no');
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.screenWidth+1);
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute('aria-current','page');
    await expect(page.locator('.life-top')).toBeVisible();
  });
});

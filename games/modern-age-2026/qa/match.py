"""Real-time UI match. Reads world coordinates to aim; never writes simulation state."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, threading
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=root))
threading.Thread(target=server.serve_forever,daemon=True).start()
log=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    page=browser.new_page(viewport={'width':1280,'height':800})
    page.set_default_timeout(12000)
    page.on('pageerror',lambda e:log.append({'error':str(e)}))
    def rec(event):
        log.append(dict(event=event,**page.evaluate('''()=>({seconds:__MA.world.time,stock:{...__MA.world.stock},opponent:__MA.world.ai,units:__MA.world.units.length,result:__MA.world.outcome})''')))
        (root/'qa/match-result.json').write_text(json.dumps(log,indent=2,ensure_ascii=False))
    try:
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        page.wait_for_function("window.__MA?.renderer?.drawCount>0")
        page.select_option('#difficulty','easy')
        page.click('#new')
        page.select_option('#quality','low')
        page.keyboard.press('b')
        def mapclick(expr,button='left'):
            pos=page.evaluate(expr)
            page.locator('#map').click(position=pos,button=button)
        mapclick('()=>__MA.project(13.5,20.5)','right')
        page.wait_for_function('__MA.world.stock.mat>350',timeout=55000)
        rec('first delivery')
        page.click('#tech')
        page.locator('#techbody button').first.click()
        page.locator('#techdialog >button').click()
        def build(kind,x,y):
            page.keyboard.press('Escape')
            page.keyboard.press('b')
            page.click(f'[data-build={kind}]')
            pos=page.evaluate("""([kind,x,y])=>{
                const size=__MA.buildingSize(kind);
                for(let r=0;r<=6;r++)for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)
                  if(__MA.canBuild(kind,x+i,y+j))return __MA.project(x+i+size/2+.2,y+j+size/2+.2)
            }""",[kind,x,y])
            page.locator('#map').click(position=pos)
            page.wait_for_function(f'__MA.world.buildings.some(b=>!b.enemy&&b.type==="{kind}"&&b.progress===1)',timeout=45000)
        build('barracks',19,23)
        build('house',18,31)
        mapclick("()=>{let b=__MA.world.buildings.find(b=>!b.enemy&&b.type==='barracks');return __MA.project(b.x+1.5,b.y+1.5)}")
        for i in range(4):page.get_by_role('button',name='Piyade').click()
        page.wait_for_function("__MA.world.units.filter(u=>!u.enemy&&u.kindUnit==='infantry').length===4",timeout=65000)
        rec('four infantry trained')
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Tüm birlikler').click()
        page.click('#diplomacy')
        page.get_by_role('button',name='Savaş',exact=True).click()
        page.locator('#dip >button').click()
        base=page.evaluate("()=>__MA.world.buildings.find(b=>b.enemy&&b.type==='hq')")
        mini=page.locator('#mini')
        box=mini.bounding_box()
        mini.click(position={'x':(base['x']+2)*box['width']/64,'y':(base['y']+2)*box['height']/64})
        mapclick(f"()=>__MA.project({base['x']+2},{base['y']+2})",'right')
        rec('enemy HQ ordered')
        page.wait_for_function('!!__MA.world.outcome',timeout=110000)
        rec('match ended')
        page.screenshot(path=str(root/'qa/match-end.png'))
    except Exception as e:
        rec(str(e))
        raise
    finally:
        browser.close()
server.shutdown()

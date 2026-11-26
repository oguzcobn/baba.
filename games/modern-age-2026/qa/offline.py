from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_page();errors=[];remote=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.goto((root/'OYNA.html').as_uri());page.click('#new')
    page.wait_for_function('window.__MA?.renderer?.drawCount>1')
    page.click('#menu');page.click('[data-menu-tab=settings]')
    with page.expect_download() as d:page.click('#jsonexport')
    saved=json.loads(Path(d.value.path()).read_text())
    assert saved['version']==7
    page.locator('#savefile').set_input_files({'name':'session.json','mimeType':'application/json','buffer':json.dumps(saved).encode()})
    page.wait_for_function("!document.querySelector('#start').open")
    result=page.evaluate('()=>({engine:__MA.renderer.engine,draws:__MA.metrics.draws,player:__MA.world.country,units:__MA.world.units.length})')
    assert not errors and not remote and result['draws']>0
    (root/'qa/offline.json').write_text(json.dumps(dict(**result,networkRequests=remote,errors=errors,exportImport=True),indent=2))
    b.close()

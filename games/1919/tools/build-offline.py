from pathlib import Path
import re,json,base64,sys
g=Path(__file__).resolve().parents[1]
root=g.parents[1]
parts=[];done={}
def bundle(p):
 p=p.resolve()
 if p in done:return done[p]
 s=p.read_text();imports=[]
 for m in re.finditer(r'^import (.+?) from "(.+?)";$',s,re.M):
  bind,name=m.groups();ident=bundle(p.parent/name)
  if bind.startswith('* as '):bind=bind[5:]
  elif not bind.startswith('{'):ident+='.default'
  imports.append('const '+bind+'='+ident+';')
 s=re.sub(r'^import .+?;$','',s,flags=re.M)
 exports={}
 for match in re.finditer(r'export (?:async )?(?:function|const) (\w+)',s):exports[match[1]]=match[1]
 for match in re.finditer(r'export \{(.*?)\};',s):
  for item in match[1].split(','):exports[item.strip()]=item.strip()
 for match in re.finditer(r'export default (\w+);',s):exports['default']=match[1]
 s=re.sub(r'export (?:\{.*?\}|default \w+);','',s).replace('export ','')
 if p.name=='art.js':
  def embedded(m):
   data=base64.b64encode((g/m[1]).read_bytes()).decode()
   return 'offlineFile("'+data+'","image/webp")'
  s=re.sub(r'"(assets/[^"]+\.webp)"',embedded,s)
 if p.name=='history.js' and p.parent.name=='ui':
  credits=base64.b64encode((g/'assets/SOURCES.md').read_bytes()).decode()
  s=s.replace('href="assets/SOURCES.md"', 'href="\'+offlineFile("'+credits+'","text/plain;charset=utf-8")+\'"')
 if p.name=='age.js':
  s=s.replace('new URL("./engine/world-worker.js",import.meta.url)','offlineWorker')
 if p.name=='world.js':
  s=re.sub(r'const response=await fetch\(.*?const topology=await response.json\(\),', 'const topology=JSON.parse(document.getElementById("world-data").textContent),', s,flags=re.S)
 ident='module'+str(len(parts))
 parts.append('const '+ident+'='+('await (async ' if p.name=='age.js' else '(')+'()=>{\n'+'\n'.join(imports)+'\n'+s+'\nreturn {'+','.join(k+':'+v for k,v in exports.items())+'};})();')
 done[p]=ident
 return ident
bundle(g/'engine/world-worker.js')
worker='\n'.join(parts)
parts.clear();done.clear()
bundle(g/'age.js')
h=(g/'age.html').read_text()
h=re.sub(r'<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">',lambda m:'<style>'+ (g/m[1]).read_text()+'</style>',h)
vendor=(root/'js/vendor/topojson-client.min.js').read_text()
topology=(root/'data/countries-50m.json').read_text().replace('<',r'\u003c')
bootstrap="""
const offlineFile=(data,type)=>URL.createObjectURL(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type}));
const offlineWorker=URL.createObjectURL(new Blob([document.getElementById("world-worker").textContent],{type:"text/javascript"}));
"""
h=h[:h.index('<script src=')]+('<script>'+vendor+'</script><script id="world-data" type="application/json">'+topology+
 '</script><script id="world-worker" type="text/plain">'+worker+'</script><script type="module">'+bootstrap+'\n'.join(parts)+'</script></body></html>')
Path(sys.argv[1] if len(sys.argv)>1 else '1919-Adim-5.html').write_text(h)

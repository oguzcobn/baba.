"""Make a file:// entry point from the same local ES modules and assets."""
from pathlib import Path
from base64 import b64encode
import json
root=Path(__file__).resolve().parents[1]
def uri(mime,data):return 'data:'+mime+';base64,'+b64encode(data).decode()
mapping={'three-local':uri('text/javascript',(root/'vendor/three.module.min.js').read_bytes())}
for key,filename in [('modern-utils','vendor/BufferGeometryUtils.js'),('modern-gltf','vendor/GLTFLoader.js'),('modern-skeleton','vendor/SkeletonUtils.js'),('modern-people','people-three.js'),('modern-render','renderer-three.js'),('modern-landmark','landmark.js')]:
    source=(root/filename).read_text().replace('./vendor/three.module.min.js','three-local')
    source=source.replace("new URL('./assets/trabzon-kosku.glb',import.meta.url)",json.dumps(uri('model/gltf-binary',(root/'assets/trabzon-kosku.glb').read_bytes())))
    for ref,target in [('./three.module.min.js','three-local'),('./BufferGeometryUtils.js','modern-utils'),('./vendor/GLTFLoader.js','modern-gltf'),('./vendor/SkeletonUtils.js','modern-skeleton'),('./people-three.js','modern-people')]:
        source=source.replace("'"+ref+"'","'"+target+"'")
    mapping[key]=uri('text/javascript',source.encode())
html=(root/'index.html').read_text().replace('</head>','<script type="importmap">'+json.dumps({'imports':mapping})+'</script></head>')
people={p.name:uri('model/gltf-binary' if p.suffix=='.glb' else 'image/webp',p.read_bytes()) for p in (root/'assets/people').iterdir() if p.suffix in ('.glb','.webp')}
html=html.replace('<script src="./people-state.js"></script>','<script>window.MODERN_EMBEDDED_PEOPLE='+json.dumps(people)+';'+(root/'people-state.js').read_text()+'</script>')
html=html.replace('<script src="./mansion-data.js"></script>','<script>'+(root/'mansion-data.js').read_text()+'</script>')
html=html.replace("import('./renderer-three.js')","import('modern-render')").replace("import('./landmark.js')","import('modern-landmark')")
(root/'OYNA.html').write_text(html)

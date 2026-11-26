"""Bake the supplied prototype and curved garden stair into one GLB draw primitive."""
from pathlib import Path
import json, struct, math
import numpy as np
root=Path(__file__).resolve().parents[1]
src=(root/'design/referans/ataturk-kosku-prototip.glb').read_bytes()
jslen=struct.unpack_from('<I',src,12)[0]
doc=json.loads(src[20:20+jslen])
binary=src[28+jslen:]
def array(accessor):
    a=doc['accessors'][accessor]; view=doc['bufferViews'][a['bufferView']]
    return np.frombuffer(binary,{5125:'<u4',5126:'<f4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=view.get('byteOffset',0)+a.get('byteOffset',0))
positions=[];colors=[]
def faces(points,color):
    points=np.array(points,dtype='<f4').reshape(-1,3)
    positions.append(points);colors.append(np.tile(color,(len(points),1)))
for node in doc['nodes']:
    if 'mesh' not in node: continue
    primitive=doc['meshes'][node['mesh']]['primitives'][0]
    color=doc['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorFactor'][:3]
    if 134<=node['mesh']<=139: continue
    faces(array(primitive['attributes']['POSITION']).reshape(-1,3)[array(primitive['indices'])],color)
# Six nested elliptical treads. Rise, run and centre are artistic estimates in prototype units.
for step in range(6):
    radius=.52+.135*step; top=.44-.056*step
    for seg in range(24):
        a,b=seg*math.pi/24,(seg+1)*math.pi/24
        def point(t,h):return [-2.27+radius*math.cos(t),h,.96+1.15*radius*math.sin(t)]
        p,q=point(a,top),point(b,top)
        faces([[-2.27,top,.96],q,p,p,q,point(a,.08),q,point(b,.08),point(a,.08)],[.80,.79,.72])
pos=np.concatenate(positions);col=np.concatenate(colors);tri=pos.reshape(-1,3,3)
norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
data=bytearray();views=[];access=[]
for arr in [pos,np.repeat(norm,3,axis=0),col]:
    views.append(dict(buffer=0,byteOffset=len(data),byteLength=arr.size*4,target=34962))
    access.append(dict(bufferView=len(views)-1,componentType=5126,count=len(arr),type='VEC3',min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist()))
    data.extend(arr.astype('<f4').tobytes())
g=dict(asset=dict(version='2.0',generator='Modern Age landmark baker'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0,name='Trabzon Atatürk Köşkü')],meshes=[dict(primitives=[dict(attributes=dict(POSITION=0,NORMAL=1,COLOR_0=2),material=0)])],materials=[dict(pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=.82))],buffers=[dict(byteLength=len(data))],bufferViews=views,accessors=access)
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
(root/'assets/trabzon-kosku.glb').write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(j)+len(data),len(j),0x4e4f534a)+j+struct.pack('<II',len(data),0x004e4942)+data)

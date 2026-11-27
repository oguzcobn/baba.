from pathlib import Path
from urllib.request import urlretrieve
from PIL import Image
import sys
src,out=map(Path,sys.argv[1:])
src.mkdir(parents=True,exist_ok=True)
out.mkdir(parents=True,exist_ok=True)
root='https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/0943055db6ec570bcef9f2c8b41c9e5467c808f9/'
urlretrieve(root+'LICENSE.md',out/'LICENSE.md')
for name,prefix,materials in [('Construction_Male_02','m101',['body','head','helmet']),('Construction_Female_01','f101',['body','head','helmet']),('Military_Male_01','sm002',['body','equipment','head','helmet','combat_knife'])]:
    base=root+'Assets/Avatars/Professions/'+name+'/'
    urlretrieve(base+'Export/'+name+'.fbx',src/(name+'.fbx'))
    for material in materials:
        suffix='_acu' if prefix=='sm002' and material in ['body','equipment','helmet'] else ''
        file=prefix+'_'+material+'_color'+suffix
        urlretrieve(base+'Textures/'+file+'.tga',src/(file+'.tga'))
        im=Image.open(src/(file+'.tga')).convert('RGB')
        im.thumbnail((512,512))
        im.save(src/(file+'.jpg'),quality=85)

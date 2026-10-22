"""Refresh the static model registry after rebuilding GLBs and previews."""
from pathlib import Path
import json,hashlib,os
from PIL import Image
from pygltflib import GLTF2
ROOT=Path(os.environ.get('BC_JOURNEY_ROOT',Path(__file__).resolve().parents[3]/'site/data-journey'))
path=ROOT/'assets/glass/catalog.generated.json'
if not path.exists(): path=ROOT/'assets/glass/catalog.json'
records=json.loads(path.read_text())
for r in records:
 model=ROOT/'assets/glass/models'/r['file']
 preview=ROOT/'assets/glass/previews'/r['file'].replace('.glb','.webp')
 gltf=GLTF2().load(str(model))
 r.update(url='/data-journey/assets/glass/models/'+model.name,
          preview='/data-journey/assets/glass/previews/'+preview.name,
          bytes=model.stat().st_size,
          sha256=hashlib.sha256(model.read_bytes()).hexdigest(),
          animations=[a.name for a in gltf.animations])
 with Image.open(preview) as image: r['width'],r['height']=image.size
(ROOT/'assets/glass/catalog.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
(ROOT/'glass-index.js').write_text('/* GLB meshes and previews are loaded on demand. */\nwindow.BCGlass='+json.dumps({r['id']:r for r in records},separators=(',',':'))+';\n')
by={r['id']:r for r in records};canvas=Image.new('RGB',(1440,1080),(5,7,10))
for i,n in enumerate([21,49,4,3,50,1,5,6,7]):
 with Image.open(ROOT/'assets/glass/previews'/by[n]['file'].replace('.glb','.webp')) as image:
  image=image.convert('RGB').resize((480,360),Image.Resampling.LANCZOS)
  canvas.paste(image,(i%3*480,i//3*360))
canvas.save(ROOT/'assets/glass/components.webp',quality=91,method=6)
print('Refreshed',len(records),'models')

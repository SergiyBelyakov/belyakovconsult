"""Volumetric silver, clear glass and neon ruby icon family. Y-up, front +Z."""
from pathlib import Path
import argparse, math, json, hashlib, re
import numpy as np
import trimesh as tm
from trimesh.visual.material import PBRMaterial
from pygltflib import GLTF2
import geometry as G

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/glass/models'
STYLE='BC Metal Glass Neon Red'
MATERIALS={
 'silver':PBRMaterial(name='BC satin silver metal',baseColorFactor=[.67,.70,.74,1],metallicFactor=1,roughnessFactor=.24),
 'bright':PBRMaterial(name='BC polished silver metal',baseColorFactor=[.85,.88,.92,1],metallicFactor=1,roughnessFactor=.16),
 'steel':PBRMaterial(name='BC dark brushed metal',baseColorFactor=[.19,.22,.27,1],metallicFactor=.95,roughnessFactor=.28),
 'black':PBRMaterial(name='BC dark brushed metal',baseColorFactor=[.19,.22,.27,1],metallicFactor=.95,roughnessFactor=.28),
 'clear':PBRMaterial(name='BC clear optical glass',baseColorFactor=[.92,.97,1,1],metallicFactor=0,roughnessFactor=.075),
 'red':PBRMaterial(name='BC ruby optical glass',baseColorFactor=[1,.12,.19,1],metallicFactor=0,roughnessFactor=.09,emissiveFactor=[.10,.0003,.002]),
 'signal':PBRMaterial(name='BC neon red glass edge',baseColorFactor=[1,.01,.035,1],metallicFactor=0,roughnessFactor=.1,emissiveFactor=[1,.0007,.009]),
}
MATERIALS['graphite']=MATERIALS['clear'];G.MATERIALS.update(MATERIALS)
old_add=G.Icon.add
def add(self,mesh,mat='silver',name='part',pos=(0,0,0),rot=None,scale=None):
 # Choose real materials per semantic component, before draw-call consolidation.
 if name in ['document sheet','folded map panel','inspection lens','KPI dial']:mat='clear'
 if name in ['temple column','map pin metal core','text rule','checklist text']:mat='red'
 if name=='map pin teardrop':mat='silver'
 if name=='gear hub rim':mat='signal'
 return old_add(self,mesh,mat,name,pos,rot,scale)
G.Icon.add=add

def panel(ic,x=0,y=0,z=0,w=2,h=1.45,stand=False):
 G.box(ic,x,y,z,w-.045,h-.045,.045,'clear',.04,'transparent screen')
 pts=G.rounded(w,h,.05,8)
 G.tube(ic,[(x+a,y+b,z+.006) for a,b in pts],.025,'bright','machined screen frame',12,True)
 pts=G.rounded(w-.075,h-.075,.035,8)
 G.tube(ic,[(x+a,y+b,z+.027) for a,b in pts],.006,'signal','neon glass perimeter',8,True)
 if stand:
  G.box(ic,x,y-h/2-.18,z-.02,.15,.32,.13,'silver',.025,'metal monitor stem')
  G.box(ic,x,y-h/2-.37,z+.03,.70,.085,.4,'silver',.025,'metal monitor foot')
G.panel=panel

def database(ic,x=0,y=0,z=0,r=.56,tiers=3,step=.37):
 for i in range(tiers):
  cy=y+(i-(tiers-1)/2)*step
  shell=G.lathe([(r,-step*.43),(r,step*.43),(r-.026,step*.43),(r-.026,-step*.43),(r,-step*.43)],64)
  ic.add(shell,'clear','clear hollow database chamber',(x,cy,z))
  for yy in [cy-step*.43,cy+step*.43]:
   G.arc(ic,(x,yy,z),r-.006,thick=.012,mat='signal',plane='xz',name='neon chamber rim',steps=64)
  if i<tiers-1:G.cyl(ic,(x,cy+step*.5,z),r+.015,.035,'bright',name='metal separator ring')
  G.sphere(ic,(x-r*.5,cy,z+r*.87),.018,'signal','red glass status light')
 for yy in [y-tiers*step/2,y+tiers*step/2]:
  G.cyl(ic,(x,yy,z),r+.025,.075,'silver',name='machined database end cap')
G.database=database

def cube(ic,p,size=.42,mat='red',name='data cube'):
 x,y,z=p
 G.box(ic,x,y,z,size,size,size,'clear',.025,name+' glass body')
 for zz in [-1,1]:
  pts=[(x-size/2,y-size/2,z+zz*size/2),(x+size/2,y-size/2,z+zz*size/2),(x+size/2,y+size/2,z+zz*size/2),(x-size/2,y+size/2,z+zz*size/2)]
  G.tube(ic,pts,.012,'bright','metal cube rim',10,True)
 for xx in [-1,1]:
  for yy in [-1,1]:G.line(ic,(x+xx*size/2,y+yy*size/2,z-size/2),(x+xx*size/2,y+yy*size/2,z+size/2),.007,'signal','neon cube rail')
G.cube=cube

def bars(ic,x=-.7,y=-.55,z=.22,heights=(.35,.6,.85,1.1),w=.25,gap=.13):
 for i,h in enumerate(heights):
  xx=x+i*(w+gap)
  G.box(ic,xx,y+h/2,z,w,h,.14,'red' if i==len(heights)-1 else 'clear',.018,'glass chart column')
  for yy in [y,y+h]:G.box(ic,xx,yy,z,w+.012,.025,.155,'silver',.008,'metal chart cap')
  G.line(ic,(xx-w/2+.012,y,z+.073),(xx-w/2+.012,y+h,z+.073),.006,'signal','neon chart edge')
G.bars=bars

old_document=G.document
def document(ic,x=0,y=0,z=0,w=1.3,h=1.7):
 old_document(ic,x,y,z,w,h)
 pts=[[-w/2+.035,-h/2+.035],[w/2-.035,-h/2+.035],[w/2-.035,h/2-.32],[w/2-.32,h/2-.035],[-w/2+.035,h/2-.035]]
 G.tube(ic,[(a+x,b+y,z+.078) for a,b in pts],.006,'signal','neon document contour',8,True)
G.document=document

def analysis(ic):
 for x,w in [(-.91,.7),(0,1.02),(.94,.68)]:panel(ic,x,.18,-.15,w,1.3)
 G.donut(ic,-.91,.39,-.08,.22,.12);G.text_lines(ic,-.91,-.16,-.08,.42,3,.1)
 bars(ic,-.35,-.37,-.05,[.19,.29,.41,.55],.13,.07)
 G.polyline(ic,[(-.4,.18,.04),(-.17,.33,.04),(.08,.25,.04),(.4,.64,.04)],.016,'signal','analytical trend')
 G.text_lines(ic,.94,.54,-.08,.44,3,.16);G.donut(ic,.94,-.24,-.08,.19,.10)
 database(ic,0,-.76,.19,.24,2,.16)
 for x in [-.91,.94]:G.polyline(ic,[(0,-.76,.19),(x,-.76,.19),(x,-.48,-.06)],.018,'silver','analytical connection')

def export(ic,path):
 grouped={}
 for mesh in ic.scene.geometry.values():grouped.setdefault(mesh.visual.material.name,[]).append(mesh)
 scene=tm.Scene()
 for name,meshes in grouped.items():
  mesh=tm.util.concatenate(meshes);mesh.visual=tm.visual.TextureVisuals(material=meshes[0].visual.material)
  scene.add_geometry(mesh,node_name=name,geom_name=name)
 scene.apply_translation(-scene.bounds.mean(axis=0))
 path.write_bytes(scene.export(file_type='glb',include_normals=True));G.add_animations(path)
 gltf=GLTF2().load(str(path))
 for m in gltf.materials:
  glass='glass' in m.name;m.doubleSided=glass
  if glass:
   red='ruby' in m.name;neon='neon' in m.name
   m.extensions={'KHR_materials_transmission':{'transmissionFactor':.48 if neon else .86 if red else .96},'KHR_materials_volume':{'thicknessFactor':.05,'attenuationDistance':.6 if red else 2,'attenuationColor':[1,.16,.23] if red or neon else [.91,.96,1]},'KHR_materials_ior':{'ior':1.46},'KHR_materials_clearcoat':{'clearcoatFactor':.35,'clearcoatRoughnessFactor':.06}}
   if neon or red:m.extensions['KHR_materials_emissive_strength']={'emissiveStrength':3.5 if neon else 1.0}
 gltf.extensionsUsed=['KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_clearcoat','KHR_materials_emissive_strength']
 gltf.asset.extras={'style':STYLE,'geometry':'volumetric meshes, no raster planes','metallic':True,'up':'+Y','front':'+Z'}
 gltf.save_binary(str(path))
 return int(sum(len(m.faces) for m in scene.geometry.values())),len(grouped)

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--only',type=int,nargs='*');args=ap.parse_args()
 records=[]
 for n,name in list(enumerate(G.NAMES,1))+[(49,'Data Architecture Reference'),(50,'Data Analysis')]:
  if args.only and n not in args.only:continue
  ic=G.Icon(name)
  if n==50:analysis(ic)
  else:G.build(2 if n==49 else n,ic)
  slug=re.sub('[^a-z0-9]+','-',name.lower());path=OUT/f'{n:02d}-{slug}.glb'
  triangles,draws=export(ic,path)
  records.append({'id':n,'name':name,'file':path.name,'style':STYLE,'triangles':triangles,'parts':ic.count,'drawCalls':draws,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'animations':['Turntable_360','Float_Idle']})
  print(n,name,triangles,flush=True)
 if not args.only:(ROOT/'assets/glass/catalog.generated.json').write_text(json.dumps(records,indent=2))

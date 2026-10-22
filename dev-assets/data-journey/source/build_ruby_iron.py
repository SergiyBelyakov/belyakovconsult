"""BC icon family: machined iron, optical glass and enclosed ruby emitters."""
import argparse, hashlib, json, re
import numpy as np
import trimesh as tm
from trimesh.visual.material import PBRMaterial
from pygltflib import GLTF2
import geometry as G

ROOT=G.ROOT
OUT=ROOT/'assets/glass/models'
OUT.mkdir(parents=True,exist_ok=True)
STYLE='BC Iron Clear Glass Ruby Core'
MATERIALS={
 'silver':PBRMaterial(name='BC satin iron',baseColorFactor=[.64,.65,.67,1],metallicFactor=1,roughnessFactor=.26),
 'bright':PBRMaterial(name='BC polished iron bevel',baseColorFactor=[.86,.87,.89,1],metallicFactor=1,roughnessFactor=.16),
 'steel':PBRMaterial(name='BC brushed iron',baseColorFactor=[.38,.39,.41,1],metallicFactor=1,roughnessFactor=.29),
 'black':PBRMaterial(name='BC recessed iron',baseColorFactor=[.13,.14,.16,1],metallicFactor=1,roughnessFactor=.33),
 'clear':PBRMaterial(name='BC clear optical glass',baseColorFactor=[.96,.98,1,1],metallicFactor=0,roughnessFactor=.075),
 'red':PBRMaterial(name='BC ruby optical glass',baseColorFactor=[.55,.006,.028,1],metallicFactor=0,roughnessFactor=.10,emissiveFactor=[.045,.0002,.001]),
 'signal':PBRMaterial(name='BC internal ruby light',baseColorFactor=[.8,.004,.025,1],metallicFactor=0,roughnessFactor=.16,emissiveFactor=[1,.001,.012]),
}
MATERIALS['graphite']=MATERIALS['clear']
G.MATERIALS.update(MATERIALS)
original_add=G.Icon.add
def add(self,mesh,mat='silver',name='part',pos=(0,0,0),rot=None,scale=None):
 if name in ['document sheet','folded map panel','inspection lens','KPI dial']:mat='clear'
 if name in ['text rule','checklist text','temple column','map pin metal core']:mat='silver'
 if name=='map pin teardrop':mat='red'
 if name=='gear hub rim':mat='bright'
 node=original_add(self,mesh,mat,name,pos,rot,scale)
 if mat=='red':
  # A separate emissive solid is completely enclosed by its ruby glass shell.
  core=mesh.copy();center=core.bounds.mean(axis=0)
  core.apply_translation(-center);core.apply_scale(.70);core.apply_translation(center)
  original_add(self,core,'signal','enclosed ruby emitter',pos,rot,scale)
 return node
G.Icon.add=add

def panel(ic,x=0,y=0,z=0,w=2,h=1.45,stand=False):
 G.box(ic,x,y,z-.065,w,h,.075,'steel',.05,'iron display back')
 G.box(ic,x,y,z+.006,w-.075,h-.075,.055,'clear',.04,'transparent screen')
 G.tube(ic,[(x+a,y+b,z+.006) for a,b in G.rounded(w,h,.05,8)],.028,'bright','machined display frame',12,True)
 G.box(ic,x,y-h/2+.045,z-.006,w-.18,.018,.016,'signal',.006,'recessed display light guide')
 if stand:
  G.box(ic,x,y-h/2-.18,z-.02,.15,.32,.13,'silver',.025,'iron monitor stem')
  G.box(ic,x,y-h/2-.37,z+.03,.70,.085,.4,'silver',.025,'iron monitor foot')
G.panel=panel

def database(ic,x=0,y=0,z=0,r=.56,tiers=3,step=.37):
 for i in range(tiers):
  cy=y+(i-(tiers-1)/2)*step
  G.cyl(ic,(x,cy,z),r,step*.74,'silver',name='solid iron database tier')
  for yy in [cy-step*.35,cy+step*.35]:
   G.arc(ic,(x,yy,z),r-.006,thick=.011,mat='bright',plane='xz',name='polished tier bevel',steps=64)
  if i<tiers-1:G.cyl(ic,(x,cy+step*.5,z),r*.965,step*.17,'red',name='ruby glass database seam')
  G.sphere(ic,(x-r*.5,cy,z+r*.87),.024,'black','status recess')
  G.sphere(ic,(x-r*.5,cy,z+r*.89),.013,'red','ruby glass status light')
G.database=database

def cube(ic,p,size=.42,mat='red',name='data cube'):
 x,y,z=p
 G.box(ic,x,y,z,size,size,size,'red',.025,name+' ruby glass body')
 for zz in [-1,1]:
  pts=[(x-size/2,y-size/2,z+zz*size/2),(x+size/2,y-size/2,z+zz*size/2),(x+size/2,y+size/2,z+zz*size/2),(x-size/2,y+size/2,z+zz*size/2)]
  G.tube(ic,pts,.009,'bright','polished cube rim',10,True)
 for xx in [-1,1]:
  for yy in [-1,1]:G.line(ic,(x+xx*size/2,y+yy*size/2,z-size/2),(x+xx*size/2,y+yy*size/2,z+size/2),.007,'bright','polished cube rail')
G.cube=cube

def bars(ic,x=-.7,y=-.55,z=.22,heights=(.35,.6,.85,1.1),w=.25,gap=.13):
 for i,h in enumerate(heights):
  xx=x+i*(w+gap)
  G.box(ic,xx,y+h/2,z,w,h,.23,'red' if i==len(heights)-1 else 'clear',.025,'glass chart column')
  G.box(ic,xx,y+h*.08,z,w*.68,h*.09,.14,'signal',.01,'internal chart light')
  for yy in [y,y+h]:G.box(ic,xx,yy,z,w+.012,.025,.24,'silver',.008,'iron chart cap')
  for side in [-1,1]:G.line(ic,(xx+side*w/2,y,z+.12),(xx+side*w/2,y+h,z+.12),.006,'bright','polished column bevel')
G.bars=bars

def analysis(ic):
 for x,w in [(-.91,.7),(0,1.02),(.94,.68)]:panel(ic,x,.18,-.15,w,1.3)
 G.donut(ic,-.91,.39,-.08,.22,.12);G.text_lines(ic,-.91,-.16,-.08,.42,3,.1)
 bars(ic,-.35,-.37,-.05,[.19,.29,.41,.55],.13,.07)
 G.polyline(ic,[(-.4,.18,.04),(-.17,.33,.04),(.08,.25,.04),(.4,.64,.04)],.016,'red','analytical trend')
 G.text_lines(ic,.94,.54,-.08,.44,3,.16);G.donut(ic,.94,-.24,-.08,.19,.10)
 database(ic,0,-.76,.19,.24,2,.16)
 for x in [-.91,.94]:G.polyline(ic,[(0,-.76,.19),(x,-.76,.19),(x,-.48,-.06)],.018,'silver','analytical connection')

original_build=G.build
def build(n,ic):
 if n==1:
  G.box(ic,0,-.79,0,2.2,.12,.72,'steel',.035,'iron analytics plinth')
  bars(ic,-.78,-.69,0,[.38,.66,.99,1.32],.31,.17)
  G.flat_arrow(ic,[(-.98,-.12),(-.54,.07),(-.03,.39),(.60,.97)],.075,.24,.26)
 elif n==4:
  database(ic,.48,-.02,-.18,.57)
  G.shield(ic,-.38,.02,.48,.93,'check')
 elif n==50:analysis(ic)
 else:original_build(2 if n==49 else n,ic)

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
  glass='glass' in m.name;light='internal ruby' in m.name;m.doubleSided=glass
  if glass:
   red='ruby' in m.name
   m.extensions={'KHR_materials_transmission':{'transmissionFactor':.78 if red else .94},'KHR_materials_volume':{'thicknessFactor':.15 if red else .08,'attenuationDistance':.48 if red else 2.5,'attenuationColor':[.66,.009,.035] if red else [.94,.97,1]},'KHR_materials_ior':{'ior':1.5},'KHR_materials_clearcoat':{'clearcoatFactor':.55,'clearcoatRoughnessFactor':.07}}
  if light:m.extensions={'KHR_materials_emissive_strength':{'emissiveStrength':1.15}}
 gltf.extensionsUsed=['KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_clearcoat','KHR_materials_emissive_strength']
 gltf.asset.extras={'style':STYLE,'geometry':'volumetric meshes, no raster planes','interiorEmitters':True,'up':'+Y','front':'+Z'}
 gltf.save_binary(str(path))
 return int(sum(len(m.faces) for m in scene.geometry.values())),len(grouped)

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--only',type=int,nargs='*');args=ap.parse_args();records=[]
 for n,name in list(enumerate(G.NAMES,1))+[(49,'Data Architecture Reference'),(50,'Data Analysis')]:
  if args.only and n not in args.only:continue
  ic=G.Icon(name);build(n,ic)
  slug=re.sub('[^a-z0-9]+','-',name.lower())
  path=OUT/f'{n:02d}-{slug}.glb'
  triangles,draws=export(ic,path)
  records.append({'id':n,'name':name,'file':path.name,'style':STYLE,'triangles':triangles,'parts':ic.count,'drawCalls':draws,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'animations':['Turntable_360','Float_Idle']})
  print(n,name,triangles,flush=True)
 if not args.only:(ROOT/'assets/glass/catalog.generated.json').write_text(json.dumps(records,indent=2))

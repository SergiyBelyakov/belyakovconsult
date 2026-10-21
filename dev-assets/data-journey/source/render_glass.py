"""Ray-traced previews of the shipped GLB meshes; no drawn substitute icons."""
from pathlib import Path
import tempfile,math,json,argparse
import numpy as np
import mitsuba as mi
import drjit as dr
import trimesh
from PIL import Image
from scipy.ndimage import gaussian_filter, median_filter
mi.set_variant('llvm_ad_rgb');dr.set_thread_count(4)
FORCE=False
ROOT=Path(__file__).resolve().parents[1];(ROOT/'assets/glass/previews').mkdir(exist_ok=True)
def render(item,width=480,height=360,spp=128,yaw=.23):
 dest=ROOT/'assets/glass/previews'/item['file'].replace('.glb','.webp')
 if dest.exists() and not FORCE:return str(dest)
 source=trimesh.load(ROOT/'assets/glass/models'/item['file'],force='scene');b=source.bounds;dist=(b[1]-b[0]).max()*2.35;T=mi.ScalarTransform4f
 scene={'type':'scene','integrator':{'type':'path','max_depth':16,'rr_depth':6,'hide_emitters':False},'sensor':{'type':'perspective','fov':34,'to_world':T.look_at(origin=[math.sin(yaw)*dist,.26*dist,math.cos(yaw)*dist],target=[0,0,0],up=[0,1,0]),'sampler':{'type':'independent','sample_count':spp},'film':{'type':'hdrfilm','width':width,'height':height,'rfilter':{'type':'tent'}}},'environment':{'type':'constant','radiance':{'type':'rgb','value':[.035,.035,.04]}}}
 with tempfile.TemporaryDirectory() as td:
  for i,name in enumerate(source.graph.nodes_geometry):
   transform,geom=source.graph.get(name);mesh=source.geometry[geom].copy();mat=mesh.visual.material;mesh.apply_transform(transform)
   file=Path(td)/f'{i}.ply';mesh.export(file)
   if 'glass' in mat.name:
    red='ruby' in mat.name or 'neon' in mat.name
    bsdf={'type':'roughdielectric','int_ior':1.46,'ext_ior':1.0,'distribution':'ggx','alpha':.012,'specular_transmittance':{'type':'rgb','value':[1,.24,.30] if red else [.97,.99,1]}}
   else:
    color=np.array(mat.baseColorFactor[:3])/255
    bsdf={'type':'principled','base_color':{'type':'rgb','value':color.tolist()},'metallic':float(mat.metallicFactor or 0),'roughness':float(mat.roughnessFactor or .24)}
   part={'type':'ply','filename':str(file),'bsdf':bsdf}
   if 'neon' in mat.name:part['emitter']={'type':'area','radiance':{'type':'rgb','value':[3.5,.0025,.0315]}}
   elif 'ruby' in mat.name:part['emitter']={'type':'area','radiance':{'type':'rgb','value':[.10,.0003,.002]}}
   scene[f'part{i}']=part
  lights=[([-4,5,3],[.5,1.6,1],[3,3,3]),([4,2,4],[.6,3,1],[2.5,2.5,2.5]),([-5,3,-3],[.65,1.5,1],[5,5,5]),([5,2,-3],[.5,1.4,1],[2,.025,.07]),([0,5,-1],[2,1,1],[2,2,2]),([0,2,12],[6,4,1],[.35,.35,.35])]
  for i,(pos,scale,radiance) in enumerate(lights):scene[f'softbox{i}']={'type':'rectangle','to_world':T.look_at(origin=pos,target=[0,0,0],up=[0,1,0])@T.scale(scale),'bsdf':{'type':'diffuse','reflectance':0},'emitter':{'type':'area','radiance':{'type':'rgb','value':radiance}}}
  scene['floor']={'type':'rectangle','to_world':T.translate([0,b[0][1]-.06,0])@T.rotate([1,0,0],-90)@T.scale([100,100,100]),'bsdf':{'type':'principled','base_color':{'type':'rgb','value':[.004,.004,.006]},'metallic':0.0,'specular':.08,'roughness':.5}}
  x=np.asarray(mi.render(mi.load_dict(scene),spp=spp,seed=27))*.95
 # Film bloom around the emissive glass, before tone mapping.
 x=median_filter(x,size=(2,2,1))*.3+x*.7
 hot=np.maximum(x-1.1,0)
 x=x+gaussian_filter(hot,sigma=(4,4,0))*.12+gaussian_filter(hot,sigma=(12,12,0))*.055
 x=np.clip((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0,1);s=np.where(x<=.0031308,x*12.92,1.055*x**(1/2.4)-.055)
 Image.fromarray(np.uint8(np.clip(s*255,0,255))).save(dest,quality=88,method=6)
 return str(dest)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--only',type=int,nargs='*');ap.add_argument('--samples',type=int,default=128);ap.add_argument('--force',action='store_true');ap.add_argument('--width',type=int,default=640);ap.add_argument('--height',type=int,default=480);args=ap.parse_args();FORCE=args.force
 for item in json.loads((ROOT/'assets/glass/catalog.json').read_text()):
  if args.only and item['id'] not in args.only:continue
  print(render(item,width=args.width,height=args.height,spp=args.samples),flush=True)

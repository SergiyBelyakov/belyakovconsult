"""Belyakov Consult: real procedural 3D icon reconstruction.

Y-up, front +Z, metres (relative icon units). No image planes or textures.
Install: pip install numpy trimesh shapely mapbox-earcut pygltflib
Run: python source/build_icons.py
"""
from pathlib import Path
import math, json, struct, csv
import numpy as np
import trimesh as tm
from shapely.geometry import Polygon, Point
from trimesh.visual.material import PBRMaterial
from pygltflib import GLTF2, BufferView, Accessor, Animation, AnimationSampler, AnimationChannel, AnimationChannelTarget, Node

ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/'assets/glass/models'; MODELS.mkdir(exist_ok=True)
TAU=math.tau
MATERIALS={
 'silver':PBRMaterial(name='Soft silver',baseColorFactor=[.67,.71,.78,1],metallicFactor=.91,roughnessFactor=.24),
 'bright':PBRMaterial(name='Polished silver',baseColorFactor=[.88,.91,.96,1],metallicFactor=.93,roughnessFactor=.17),
 'steel':PBRMaterial(name='Dark steel',baseColorFactor=[.105,.13,.17,1],metallicFactor=.8,roughnessFactor=.28),
 'graphite':PBRMaterial(name='Graphite panel',baseColorFactor=[.021,.027,.038,1],metallicFactor=.5,roughnessFactor=.27),
 'red':PBRMaterial(name='Ruby red D90429',baseColorFactor=[.694,.0012,.0222,1],metallicFactor=.68,roughnessFactor=.2),
 'signal':PBRMaterial(name='Ruby signal light',baseColorFactor=[.9,.002,.025,1],metallicFactor=.35,roughnessFactor=.19,emissiveFactor=[.85,.001,.018]),
 'black':PBRMaterial(name='Black recess',baseColorFactor=[.004,.006,.009,1],metallicFactor=.2,roughnessFactor=.36),
}

class Icon:
 def __init__(self,name):self.name=name;self.scene=tm.Scene();self.count=0;self.dynamic=[]
 def add(self,mesh,mat='silver',name='part',pos=(0,0,0),rot=None,scale=None):
  mesh=mesh.copy()
  if scale is not None:mesh.apply_scale(scale)
  if rot is not None:mesh.apply_transform(rot)
  mesh.apply_translation(pos)
  mesh.update_faces(mesh.nondegenerate_faces(height=1e-9))
  mesh.remove_unreferenced_vertices()
  mesh.fix_normals(multibody=True)
  mesh=tm.graph.smooth_shade(mesh,angle=math.radians(35),facet_minarea=None)
  normals=np.asarray(mesh.vertex_normals).copy();lengths=np.linalg.norm(normals,axis=1)
  for vi in np.flatnonzero(lengths<1e-8):
   faces=mesh.vertex_faces[vi];faces=faces[faces>=0]
   normals[vi]=mesh.face_normals[faces[0]] if len(faces) else [0,1,0]
  normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-20)
  mesh.vertex_normals=normals
  mesh.visual=tm.visual.TextureVisuals(material=MATERIALS[mat])
  self.count+=1;node=f'{name}_{self.count:03d}'
  self.scene.add_geometry(mesh,node_name=node,geom_name=node)
  return node

def rounded(w,h,r=.08,n=6):
 r=min(r,w/2-.0001,h/2-.0001);pts=[]
 for cx,cy,a in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
  for t in np.linspace(a,a+90,n+1):
   a1=math.radians(t);pts.append([cx+r*math.cos(a1),cy+r*math.sin(a1)])
 return np.array(pts)

def extrusion(points,depth):
 poly=Polygon(points)
 if not poly.is_valid:poly=poly.buffer(0)
 mesh=tm.creation.extrude_polygon(poly,depth,engine='earcut');mesh.apply_translation((0,0,-depth/2));return mesh

def box(ic,x,y,z,w,h,d,mat='silver',r=.055,name='rounded housing'):
 # Rounded rectangle with an inset front/back ring, making the depth edges bevelled.
 pts=rounded(w,h,r,6); b=min(.024,d*.22,w*.035,h*.035);n=len(pts)
 inner=pts*np.array([(w-2*b)/w,(h-2*b)/h])
 layers=[(inner,-d/2),(pts,-d/2+b),(pts,d/2-b),(inner,d/2)]
 vertices=np.array([[p[0],p[1],zz] for pp,zz in layers for p in pp])
 faces=[]
 for k in range(3):
  for j in range(n):
   a=k*n+j;bb=k*n+(j+1)%n;c=(k+1)*n+(j+1)%n;dd=(k+1)*n+j
   faces.extend([(a,bb,c),(a,c,dd)])
 # triangulate rounded convex faces with a central vertex.
 vertices=np.vstack([vertices,[0,0,-d/2],[0,0,d/2]])
 for j in range(n):faces.extend([(4*n,(j+1)%n,j),(4*n+1,3*n+j,3*n+(j+1)%n)])
 mesh=tm.Trimesh(vertices,faces,process=False)
 return ic.add(mesh,mat,name,(x,y,z))

def sphere(ic,p,r,mat='silver',name='sphere',scale=None):
 return ic.add(tm.creation.uv_sphere(radius=r,count=[16,24]),mat,name,p,scale=scale)

def lathe(profile,segments=64):
 # Profile runs from lower axis via exterior to upper axis, Y is vertical.
 vs=[]
 for rr,yy in profile:
  for a in np.linspace(0,TAU,segments,endpoint=False):vs.append([rr*math.cos(a),yy,rr*math.sin(a)])
 fs=[]
 for k in range(len(profile)-1):
  for j in range(segments):
   a=k*segments+j;b=k*segments+(j+1)%segments;c=(k+1)*segments+(j+1)%segments;d=(k+1)*segments+j
   fs.extend([(a,c,b),(a,d,c)])
 mesh=tm.Trimesh(vs,fs,process=True);mesh.fix_normals();return mesh

def cyl(ic,p,r,h,mat='silver',axis='y',name='cylinder'):
 b=min(.025,h*.16,r*.12)
 mesh=lathe([(0,-h/2),(r-b,-h/2),(r,-h/2+b),(r,h/2-b),(r-b,h/2),(0,h/2)])
 if axis=='z':mesh.apply_transform(tm.transformations.rotation_matrix(math.pi/2,[1,0,0]))
 if axis=='x':mesh.apply_transform(tm.transformations.rotation_matrix(math.pi/2,[0,0,1]))
 return ic.add(mesh,mat,name,p)

def tube(ic,pts,r=.025,mat='silver',name='pipe',sides=10,closed=False):
 pts=np.array(pts,dtype=float)
 pts=pts[np.r_[True,np.linalg.norm(np.diff(pts,axis=0),axis=1)>1e-8]]
 if closed and np.linalg.norm(pts[-1]-pts[0])<1e-8:pts=pts[:-1]
 if closed:pts=np.vstack([pts,pts[0]])
 # Parallel transported-ish frames, smooth round pipe and end caps.
 tangent=np.gradient(pts,axis=0)
 for k in range(len(tangent)):
  if np.linalg.norm(tangent[k])<1e-9:tangent[k]=pts[min(k+1,len(pts)-1)]-pts[max(0,k-1)]
  if np.linalg.norm(tangent[k])<1e-9:tangent[k]=[0,1,0]
 tangent/=np.linalg.norm(tangent,axis=1)[:,None]
 vertices=[]
 for p,t in zip(pts,tangent):
  ref=np.array([0,0,1.])
  if abs(t@ref)>.95:ref=np.array([0,1.,0])
  u=np.cross(t,ref);u/=np.linalg.norm(u);v=np.cross(t,u)
  vertices.extend([p+r*(math.cos(a)*u+math.sin(a)*v) for a in np.linspace(0,TAU,sides,endpoint=False)])
 faces=[]
 for k in range(len(pts)-1):
  for j in range(sides):
   a=k*sides+j;b=k*sides+(j+1)%sides;c=(k+1)*sides+(j+1)%sides;d=(k+1)*sides+j
   faces.extend([(a,b,c),(a,c,d)])
 faces.extend([(0,j+1,j) for j in range(1,sides-1)])
 off=(len(pts)-1)*sides;faces.extend([(off,off+j,off+j+1) for j in range(1,sides-1)])
 mesh=tm.Trimesh(vertices,faces,process=False);mesh.fix_normals()
 return ic.add(mesh,mat,name)

def arc(ic,c,r,a0=0,a1=TAU,thick=.03,mat='silver',name='ring',plane='xy',steps=64):
 x,y,z=c;pts=[]
 for a in np.linspace(a0,a1,max(4,int(steps*abs(a1-a0)/TAU))):
  if plane=='xy':pts.append([x+r*math.cos(a),y+r*math.sin(a),z])
  elif plane=='xz':pts.append([x+r*math.cos(a),y,z+r*math.sin(a)])
  else:pts.append([x,y+r*math.cos(a),z+r*math.sin(a)])
 return tube(ic,pts,thick,mat,name,12)

def line(ic,a,b,r=.025,mat='silver',name='line'):return tube(ic,[a,b],r,mat,name)
def polyline(ic,pts,r=.025,mat='signal',name='line'):return tube(ic,pts,r,mat,name)

def arrow(ic,pts,r=.035,mat='red',head=.15,name='arrow'):
 polyline(ic,pts,r,mat,name+' shaft')
 a=np.array(pts[-2]);b=np.array(pts[-1]);direction=b-a;direction/=np.linalg.norm(direction)
 cone=tm.creation.cone(radius=head,height=head*2,sections=24)
 # Cone's base at z=0 and tip at +z.
 cone.apply_translation([0,0,-head*2])
 cone.apply_transform(tm.geometry.align_vectors([0,0,1],direction))
 ic.add(cone,mat,name+' head',b)

def flat_arrow(ic,pts,width=.065,head=.2,z=.16,mat='red'):
 from shapely.geometry import LineString
 pp=np.array(pts);last=pp[-1]-pp[-2];last/=np.linalg.norm(last)
 linepoly=LineString(pp).buffer(width/2,cap_style=1,join_style=1)
 perp=np.array([-last[1],last[0]]);tip=pp[-1]+last*.02;base=tip-last*head*1.4
 headpoly=Polygon([tip,base+perp*head*.62,base-perp*head*.62])
 shape=linepoly.union(headpoly)
 mesh=tm.creation.extrude_polygon(shape,.055,engine='earcut');mesh.apply_translation([0,0,z]);ic.add(mesh,mat,'rising arrow')

def panel(ic,x=0,y=0,z=0,w=2,h=1.45,stand=False):
 box(ic,x,y,z,w,h,.14,'silver',.09,'panel outer frame')
 box(ic,x,y,z+.078,w-.085,h-.085,.04,'graphite',.065,'panel face')
 outline=rounded(w-.03,h-.03,.075,8);tube(ic,[(x+a,y+b,z+.102) for a,b in outline],.012,'red','ruby panel edge',closed=True)
 for sx,sy in [(-1,1),(1,1)]:cyl(ic,(x+sx*(w/2-.105),y+sy*(h/2-.105),z+.12),.022,.015,'steel','z','panel screw')
 if stand:
  box(ic,x,y-h/2-.21,z-.015,.17,.34,.19,'silver',.025,'monitor stem')
  box(ic,x,y-h/2-.4,z+.03,.7,.1,.44,'silver',.03,'monitor foot')

def bars(ic,x=-.7,y=-.55,z=.22,heights=(.35,.6,.85,1.1),w=.25,gap=.13):
 for i,h in enumerate(heights):
  xx=x+i*(w+gap);box(ic,xx,y+h/2,z,w,h,.22,'red' if i==len(heights)-1 else 'silver',.025,'bar chart column')

def text_lines(ic,x,y,z,width=.6,n=3,gap=.17):
 for k in range(n):box(ic,x,y-k*gap,z,width*(1-.17*(k%3)),.038,.035,'silver',.015,'text rule')

def donut(ic,x,y,z,r=.36,hole=.19):
 # Separated metal/ruby annular sectors with genuine hollow center.
 for a0,a1,mat in [(0,.28*TAU,'red'),(.29*TAU,.68*TAU,'silver'),(.69*TAU,.99*TAU,'silver')]:
  angles=np.linspace(a0,a1,28);pts=[[x+r*math.cos(a),y+r*math.sin(a)] for a in angles]
  pts += [[x+hole*math.cos(a),y+hole*math.sin(a)] for a in angles[::-1]]
  ic.add(extrusion(pts,.1),mat,'donut chart sector',(0,0,z))

def pie(ic,x,y,z,r=.47):
 for a0,a1,mat in [(0,.31*TAU,'red'),(.325*TAU,.64*TAU,'silver'),(.655*TAU,.985*TAU,'silver')]:
  pts=[[x,y]]+[[x+r*math.cos(a),y+r*math.sin(a)] for a in np.linspace(a0,a1,30)]
  ic.add(extrusion(pts,.13),mat,'pie chart sector',(0,0,z))

def database(ic,x=0,y=0,z=0,r=.56,tiers=3,step=.37):
 for i in range(tiers):
  yy=y+(i-(tiers-1)/2)*step
  cyl(ic,(x,yy,z),r,step*.86,'silver',name='database metal tier')
  if i<tiers-1:
   cyl(ic,(x,yy+step*.48,z),r*.96,step*.11,'black',name='database groove')
   arc(ic,(x,yy+step*.48,z),r*.97,0,TAU,.015,'signal','ruby database band','xz')
 # Front status dots.
 for i in range(tiers):sphere(ic,(x-r*.63,y+(i-(tiers-1)/2)*step,z+r*.81),.024,'steel','status recess')

def cube(ic,p,size=.42,mat='red',name='data cube'):
 x,y,z=p;box(ic,x,y,z,size,size,size,mat,.035,name)
 # Slim polished edge rails keep the faceted cube readable when rotating.
 for xx in [-1,1]:
  for yy in [-1,1]:line(ic,(x+xx*size/2,y+yy*size/2,z-size/2),(x+xx*size/2,y+yy*size/2,z+size/2),.009,'bright','cube edge')
 for zz in [-1,1]:
  pts=[(x-size/2,y-size/2,z+zz*size/2),(x+size/2,y-size/2,z+zz*size/2),(x+size/2,y+size/2,z+zz*size/2),(x-size/2,y+size/2,z+zz*size/2)]
  tube(ic,pts,.009,'bright','cube rim',8,True)

def person(ic,x,y,z,s=.5,mat='silver'):
 sphere(ic,(x,y+s*.42,z),s*.23,mat,'person head')
 # Rotationally solid shoulders / torso, flattened in depth.
 body=lathe([(0,-s*.34),(s*.38,-s*.34),(s*.4,-s*.3),(s*.38,-s*.07),(s*.29,s*.13),(s*.15,s*.2),(0,s*.2)],48)
 body.apply_scale([1,1,.65]);ic.add(body,mat,'person torso',(x,y,z))

def shield(ic,x=0,y=0,z=.15,s=1,detail='check'):
 outline=np.array([[-.65,.63],[-.33,.7],[0,.88],[.33,.7],[.65,.63],[.61,-.08],[.41,-.48],[0,-.85],[-.41,-.48],[-.61,-.08]])*s
 ic.add(extrusion(outline,.17*s),'silver','shield frame',(x,y,z))
 ic.add(extrusion(outline*.88,.04*s),'red','shield ruby face',(x,y,z+.107*s))
 tube(ic,[(x+a*.98,y+b*.98,z+.1*s) for a,b in outline],.025*s,'bright','shield bevel',closed=True)
 if detail=='check':polyline(ic,[(x-.29*s,y-.02*s,z+.18*s),(x-.06*s,y-.25*s,z+.18*s),(x+.34*s,y+.22*s,z+.18*s)],.073*s,'bright','verification check')
 elif detail=='lock':
  box(ic,x,y-.1*s,z+.22*s,.48*s,.43*s,.14*s,'silver',.05*s,'lock body')
  arc(ic,(x,y+.17*s,z+.23*s),.18*s,0,math.pi,.042*s,'bright','lock shackle')
  cyl(ic,(x,y-.08*s,z+.3*s),.047*s,.03*s,'black','z','keyhole')
  box(ic,x,y-.17*s,z+.31*s,.04*s,.1*s,.02*s,'black',.01*s,'keyhole slot')

def check(ic,x,y,z,s=.15):
 polyline(ic,[(x-s*.7,y,z),(x-s*.15,y-s*.5,z),(x+s*.75,y+s*.55,z)],s*.14,'signal','check mark')

def checklist(ic,x=-.3,y=0,z=0,w=1.3,h=1.6,rows=3,clip=False):
 panel(ic,x,y,z,w,h)
 for i in range(rows):
  yy=y+h*.28-i*h*.22
  box(ic,x-w*.32,yy,z+.14,.22,.22,.04,'steel',.025,'checkbox')
  check(ic,x-w*.32,yy,z+.18,.13)
  box(ic,x+w*.06,yy,z+.15,w*.45,.045,.045,'silver',.018,'checklist text')
 if clip:
  box(ic,x,y+h/2+.02,z+.14,.55,.16,.1,'silver',.025,'clipboard clip')
  arc(ic,(x,y+h/2+.16,z+.1),.11,0,math.pi,.04,'silver','clipboard eye')

def temple(ic,x=.48,y=-.24,z=.45,s=.85):
 box(ic,x,y-.56*s,z,1.12*s,.13*s,.62*s,'silver',.025,'temple step')
 box(ic,x,y-.46*s,z,1*s,.1*s,.5*s,'red',.02,'temple plinth')
 for xx in [-.36,0,.36]:
  cyl(ic,(x+xx*s,y-.08*s,z),.067*s,.66*s,'silver',name='temple column')
  for yy in [-.4,.25]:cyl(ic,(x+xx*s,y+yy*s,z),.09*s,.055*s,'bright',name='column capital')
 roof=[[-.61*s,.29*s],[.61*s,.29*s],[0,.73*s]]
 ic.add(extrusion(roof,.5*s),'silver','temple pediment',(x,y,z))
 ic.add(extrusion(np.array(roof)*.79,.025*s),'red','ruby pediment',(x,y+.025*s,z+.267*s))

def magnifier(ic,x=.5,y=-.25,z=.55,r=.43,kind='check'):
 cyl(ic,(x,y,z),r,.11,'steel','z','inspection lens')
 arc(ic,(x,y,z+.06),r,0,TAU,.055,'silver','magnifier metal rim')
 arc(ic,(x,y,z+.092),r-.04,0,TAU,.012,'red','lens ruby bezel')
 line(ic,(x+r*.72,y-r*.72,z),(x+r*1.5,y-r*1.5,z),.085,'silver','magnifier handle')
 if kind=='check':check(ic,x,y,z+.1,r*.6)
 elif kind=='bars':bars(ic,x-r*.37,y-r*.3,z+.1,[r*.35,r*.65,r*.95],r*.15,r*.08)

def gear(ic,x,y,z,r=.43):
 # Annular gear polygon, real open central bore.
 teeth=12;pts=[]
 for i in range(teeth):
  for phase,rr in [(0,.81),(.16,1),(.64,1),(.8,.81)]:
   a=TAU*(i+phase)/teeth;pts.append([x+r*rr*math.cos(a),y+r*rr*math.sin(a)])
 poly=Polygon(pts,[[(x+r*.38*math.cos(a),y+r*.38*math.sin(a)) for a in np.linspace(0,-TAU,48)]])
 m=tm.creation.extrude_polygon(poly,.14,engine='earcut');m.apply_translation([0,0,z-.07]);ic.add(m,'silver','gear teeth and bore')
 arc(ic,(x,y,z+.075),r*.4,0,TAU,.015,'steel','gear hub rim')

def pin(ic,x,y,z,s=.6):
 # Extruded teardrop with an actual circular opening and spherical metal insert.
 rr=s*.43;cy=y+s*.21;angles=np.linspace(-.28*math.pi,1.28*math.pi,48)
 pts=[[x+rr*math.cos(a),cy+rr*math.sin(a)] for a in angles];pts.append([x,y-s*.7])
 outer=Polygon(pts);hole=Point(x,cy).buffer(rr*.62,resolution=32)
 poly=outer.difference(hole)
 m=tm.creation.extrude_polygon(poly,.14*s,engine='earcut');m.apply_translation([0,0,z]);ic.add(m,'red','map pin teardrop')
 arc(ic,(x,cy,z+.14*s),rr*.98,-.28*math.pi,1.28*math.pi,.015,'signal','pin ruby edge')
 sphere(ic,(x,cy,z+.075*s),rr*.53,'silver','map pin metal core',scale=[1,1,.53])

def map_base(ic,x=0,y=-.5,z=0,w=2,d=1.1,fold=True):
 # Horizontal folded map, not a flat image. Y is height; Z runs into page.
 nx=4
 for i in range(nx):
  x0=x-w/2+i*w/nx;x1=x0+w/nx
  y0=y+(i%2)*.14 if fold else y;y1=y+((i+1)%2)*.14 if fold else y
  top=[[x0,y0,z-d/2],[x1,y1,z-d/2],[x1,y1,z+d/2],[x0,y0,z+d/2]]
  v=top+[[a,b-.055,c] for a,b,c in top];f=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]]
  ic.add(tm.Trimesh(v,f),'steel','folded map panel')
  tube(ic,top,.018,'silver','map panel border',closed=True)
  line(ic,(x0,y0+.02,z),(x1,y1+.02,z),.014,'silver','map grid')

def route_on_map(ic,x=0,y=-.32,z=0):
 pts=[(x-.84,y,z+.28),(x-.4,y+.08,z-.18),(x+.04,y,z+.13),(x+.55,y+.1,z-.02),(x+.85,y,z+.27)]
 polyline(ic,pts,.024,'signal','map route')
 for p in pts:sphere(ic,p,.045,'red','route waypoint')

def document(ic,x=0,y=0,z=0,w=1.3,h=1.7):
 pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2-.32],[w/2-.32,h/2],[-w/2,h/2]]
 ic.add(extrusion(pts,.13),'steel','document sheet',(x,y,z))
 tube(ic,[(a+x,b+y,z+.075) for a,b in pts],.025,'silver','document bevel',closed=True)
 tri=[[x+w/2-.32,y+h/2],[x+w/2-.32,y+h/2-.32],[x+w/2,y+h/2-.32]]
 ic.add(extrusion(tri,.06),'silver','folded document corner',(0,0,z+.09))

def road(ic,wide=.62,y=-.3,points=None):
 if points is None:
  t=np.linspace(0,1,80);points=np.column_stack([.65*np.sin(t*TAU),t*1.95-.9])
 from shapely.geometry import LineString
 poly=LineString(points).buffer(wide/2,cap_style=1,join_style=1)
 m=tm.creation.extrude_polygon(poly,.09,engine='earcut')
 # XY -> XZ, Y height.
 m.apply_transform(tm.transformations.rotation_matrix(math.pi/2,[1,0,0]));m.apply_translation([0,y,0]);ic.add(m,'steel','road surface')
 xy=np.array(poly.exterior.coords)
 polyline(ic,[(a,y+.012,b) for a,b in xy],.018,'signal','road ruby edge')
 for i in range(0,len(points)-3,7):
  a,b=points[i],points[i+3];line(ic,(a[0],y+.017,a[1]),(b[0],y+.017,b[1]),.014,'silver','road lane dash')
 return points

def medical_heart(ic,x=0,y=0,z=.2,s=1):
 t=np.linspace(0,TAU,100);xx=16*np.sin(t)**3/18;yy=(13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))/18
 pts=np.column_stack([xx*s,yy*s]);ic.add(extrusion(pts,.15),'red','medical heart',(x,y,z))
 tube(ic,[(x+a,y+b,z+.09) for a,b in pts],.018,'bright','heart bevel',closed=True)

def star(ic,x,y,z,r=.35):
 pts=[]
 for i in range(10):
  a=math.pi/2+TAU*i/10;rr=r if i%2==0 else r*.43;pts.append([x+rr*math.cos(a),y+rr*math.sin(a)])
 ic.add(extrusion(pts,.07),'bright','five pointed star',(0,0,z))

def build(n,ic):
 if n==1:
  panel(ic,y=.12,w=2,h=1.5,stand=True);donut(ic,-.5,.02,.17,.35,.18);bars(ic,.07,-.12,.18,[.28,.45,.62,.8],.16,.07);text_lines(ic,-.35,.65,.16,.8,3,.13);text_lines(ic,.31,-.39,.18,.8,2,.12)
 elif n==2:
  database(ic,-.55,0,0,.57)
  for x,y,z in [(.75,.65,-.05),(1,.05,.1),(.66,-.6,.2)]:
   cube(ic,(x,y,z),.43);polyline(ic,[(-.08,y*.56,.05),(.25,y*.56,.05),(.25,y,z),(x-.22,y,z)],.026,'silver','database connector')
 elif n==3:checklist(ic,-.37,.12,0,1.42,1.65,3);temple(ic,.48,-.23,.48,.85)
 elif n==4:database(ic,-.2,.05,0,.65);magnifier(ic,.4,-.19,.68,.49)
 elif n==5:
  bars(ic,-.8,-.68,.0,[.4,.7,1,1.35],.3,.16);flat_arrow(ic,[(-1,-.1),(-.5,.07),(.05,.39),(.63,.92)],.075,.24,.22)
  cyl(ic,(.28,-.56,.53),.33,.12,'red','z','coin');arc(ic,(.28,-.56,.61),.29,thick=.017,mat='bright');dollar(ic,.28,-.56,.64,.24)
  for i in range(3):cyl(ic,(.75,-.68+i*.07,.22),.23,.055,'silver',name='coin stack')
 elif n==6:
  panel(ic,w=2,h=1.55);donut(ic,-.57,-.29,.17,.31,.16);bars(ic,-.07,-.55,.18,[.28,.43,.59,.86],.16,.09);text_lines(ic,-.43,.49,.16,.9,2);pts=[(-.12,-.08,.36),(.14,.12,.36),(.4,.0,.36),(.76,.52,.36)];polyline(ic,pts,.023);[sphere(ic,p,.047,'signal') for p in pts]
 elif n==7:
  map_base(ic);route_on_map(ic);pin(ic,.22,.4,.0,.92)
 elif n==8:
  box(ic,0,-.15,0,1.7,1.2,.6,'steel');roof=[[-.85,.45],[-.85,.72],[-.35,.46],[-.35,.7],[.1,.45],[.1,.62],[.85,.37]];ic.add(extrusion(roof,.6),'silver','sawtooth factory roof')
  for x in [-.55,-.28,.0]:
   for y in [-.03,.24]:box(ic,x,y,.33,.19,.2,.04,'red',.015,'factory window')
  for x in [.35,.68]:cyl(ic,(x,.9,-.05),.09,.85,'silver',name='factory chimney');arc(ic,(x,1.32,-.05),.09,thick=.012,mat='red',plane='xz')
  text_lines(ic,-.36,-.38,.34,.52,2,.13);gear(ic,.6,-.48,.56,.48)
 elif n==9:
  panel(ic,w=2,h=1.5);donut(ic,-.5,.08,.17,.42,.23);text_lines(ic,.44,.45,.17,.65,3,.15);bars(ic,.02,-.57,.18,[.25,.42,.6,.85],.15,.09)
 elif n==10:
  panel(ic,x=.35,y=.25,w=1.4,h=1.2);text_lines(ic,.2,.66,.16,.7,2,.14);bars(ic,-.82,-.69,.29,[.43,.76,1.06],.24,.13);cyl(ic,(.58,-.25,.52),.61,.14,'steel','z','KPI dial');arc(ic,(.58,-.25,.62),.6,thick=.035);arc(ic,(.58,-.25,.65),.51,0,math.pi*.65,.055,'red');line(ic,(.58,-.25,.73),(.9,.07,.73),.025,'signal','gauge needle');sphere(ic,(.58,-.25,.73),.08,'red')
 elif n==11:database(ic,r=.73,step=.44)
 elif n==12:
  for x,y,z in [(-.8,0,.1),(.52,.45,-.2),(.7,-.4,.35)]:database(ic,x,y,z,.32,1,.62)
  arrow(ic,[(-.5,.1,.1),(-.3,.6,-.05),(.16,.55,-.2)],.035,head=.12);arrow(ic,[(.8,.37,-.2),(1.2,.1,.1),(1,-.28,.35)],.035,head=.12);arrow(ic,[(.39,-.4,.35),(-.1,-.4,.3),(-.5,-.1,.1)],.035,head=.12)
 elif n==13:
  gear(ic,-.46,-.28,0,.57);gear(ic,.44,.42,0,.55);arrow(ic,[(-.9,.12,.13),(-.86,.63,.13),(-.25,.88,.13)],.028,head=.12);arrow(ic,[(.92,.09,.13),(.99,-.44,.13),(.48,-.74,.13)],.028,head=.12);flat_arrow(ic,[(.1,-.57),(.73,-.57)],.11,.22,.2)
 elif n==14:
  panel(ic,w=1.25,h=1.25);text_api(ic,0,0,.19)
  for side in [-1,1]:
   for y in [-.42,0,.42]:line(ic,(side*.64,y,0),(side*1.02,y,.0),.035,'silver','API connector');sphere(ic,(side*1.07,y,0),.09,'red','API endpoint')
 elif n==15:
  document(ic);text_lines(ic,-.12,.52,.12,.69,3,.16);bars(ic,-.43,-.62,.18,[.5,.7],.19,.1);pie(ic,.33,-.35,.2,.35)
 elif n==16:
  for i in [2,1,0]:document(ic,x=i*.13,y=i*.07,z=-i*.18)
  text_lines(ic,-.03,.5,.16,.77,3,.21);box(ic,0,-.51,.15,.84,.17,.06,'red',.025,'document highlight')
 elif n==17:
  for p in [(-.8,-.6,0),(0,.65,0),(.75,-.6,0),(0,-.6,0)]:cube(ic,p,.4,'silver','workflow step')
  dia=extrusion([[-.3,0],[0,.3],[.3,0],[0,-.3]],.25);ic.add(dia,'red','decision diamond',(0,0,.05))
  arrow(ic,[(-.8,-.39,0),(-.8,.65,0),(-.22,.65,0)],.025,head=.11);arrow(ic,[(.22,0,0),(.75,0,0),(.75,-.38,0)],.025,head=.11);arrow(ic,[(0,-.22,0),(0,-.38,0)],.025,head=.09);arrow(ic,[(.53,-.6,0),(.23,-.6,0)],.024,head=.08)
 elif n==18:map_base(ic,fold=False);route_on_map(ic);pin(ic,-.18,.4,-.06,.95)
 elif n==19:checklist(ic,-.35,.05,0,1.3,1.65,4,True);shield(ic,.48,-.25,.4,.66,'none');temple(ic,.48,-.24,.6,.33)
 elif n==20:database(ic,.55,-.13,-.1,.45);shield(ic,-.2,.04,.47,.9)
 elif n==21:
  target(ic,0,0,0,.9);arrow(ic,[(1.1,.95,.6),(.6,.5,.34),(.01,0,.15)],.037,'red',.14,'target arrow');
  for d in [0,.14]:box(ic,1.1+d,.98+d,.62,.25,.07,.1,'red',.015,'arrow feather')
 elif n==22:
  person(ic,-.59,-.07,-.15,.7);person(ic,.62,-.07,-.12,.72,'red');person(ic,0,-.18,.22,1.13)
 elif n==23:
  cyl(ic,(-.4,-.62,0),.45,.18,'silver',name='robot pedestal');robot_arm(ic)
  gear(ic,.6,-.16,.16,.43)
 elif n==24:
  panel(ic,w=2,h=1.45,stand=True);polyline(ic,[(-.88,-.03,.18),(-.57,-.03,.18),(-.43,.35,.18),(-.22,-.36,.18),(0,.4,.18),(.18,-.07,.18),(.38,-.07,.18)],.028);text_lines(ic,.48,.44,.18,.65,3,.13);alert_disk(ic,.64,-.38,.27,.32)
 elif n==25:
  panel(ic,x=-.35,w=1.3,h=1.6);polyline(ic,[(-.8,-.47,.16),(-.63,-.12,.16),(-.3,.14,.16),(-.14,.52,.16)],.025);[sphere(ic,p,.06,'red') for p in [(-.8,-.47,.16),(-.63,-.12,.16),(-.3,.14,.16)]]
  for x,y in [(-.7,.35),(-.38,.6)]:line(ic,(x-.06,y-.06,.18),(x+.06,y+.06,.18),.022);line(ic,(x-.06,y+.06,.18),(x+.06,y-.06,.18),.022)
  chess_king(ic,.52,-.73,.43)
 elif n==26:
  road(ic);pin(ic,-.46,.05,.5,.55);pin(ic,.2,.65,-.72,.5)
 elif n==27:
  for i in [2,1,0]:panel(ic,x=-i*.16,y=i*.08,z=-i*.19,w=1.75,h=1.5)
  sphere(ic,(-.54,-.02,.22),.11,'silver')
  for yy in [-.5,0,.5]:arrow(ic,[(-.4,-.02,.2),(-.05,-.02,.2),(.2,yy,.2),(.69,yy,.2)],.022,head=.1)
 elif n==28:
  database(ic,.48,.15,-.1,.55);warning(ic,-.37,-.17,.55,.89)
 elif n==29:
  database(ic,0,-.37,0,.5)
  for x,y,kind in [(-.85,.55,'person'),(.85,.55,'doc'),(-.9,-.5,'cube'),(.9,-.5,'gear')]:
   panel(ic,x,y,.0,.55,.55);line(ic,(x,y,0),(x*.25,-.1,0),.023,'silver','master data link')
   if kind=='person':person(ic,x,y-.05,.16,.3)
   if kind=='doc':text_lines(ic,x,y+.15,.15,.29,3,.1)
   if kind=='cube':cube(ic,(x,y,.19),.25,'silver')
   if kind=='gear':gear(ic,x,y,.16,.2)
 elif n==30:
  panel(ic,w=1.65,h=1.65);box(ic,0,.84,.18,.58,.15,.1,'silver',.025,'registry clip');arc(ic,(0,1,.08),.13,0,math.pi,.035)
  for yy in [.5,.06,-.4]:person(ic,-.48,yy-.04,.2,.3,'red');text_lines(ic,.15,yy+.02,.17,.65,2,.12)
  flag=[[-.1,.45],[.1,.45],[.1,-.1],[0,.02],[-.1,-.1]];ic.add(extrusion(flag,.05),'red','registry ribbon',(.59,.44,.23))
 elif n==31:
  panel(ic,x=-.33,y=.12,w=1.4,h=1.55);text_lines(ic,-.37,-.38,.18,.74,2,.14)
  polyline(ic,[(-.6,.5,.21),(-.8,.29,.21),(-.6,.08,.21)],.045,'bright','left code bracket');polyline(ic,[(-.07,.5,.21),(.13,.29,.21),(-.07,.08,.21)],.045,'bright','right code bracket');line(ic,(-.42,.04,.21),(-.27,.56,.21),.04,'silver','code slash')
  tree(ic,.53,-.22,.35,.74)
 elif n==32:
  pts=[(-.75,.43,0),(.1,.82,0),(.85,.35,0),(-.75,-.49,0),(.1,-.1,0),(.85,-.55,0)]
  for a,b in [(0,1),(1,2),(0,3),(1,4),(2,5),(3,4),(4,5)]:line(ic,pts[a],pts[b],.03,'silver','data model relation')
  for i,p in enumerate(pts):cube(ic,p,.4,'silver' if i%3==0 else 'red','data model entity')
 elif n==33:
  database(ic,-.5,.06,-.05,.55);warehouse(ic,.56,-.2,.5,.8)
 elif n==34:
  database(ic,0,.2,0,.66)
  for yy in [-.62,-.42,-.22]:
   pts=[(x,yy+.07*math.sin(x*math.pi*3),.62) for x in np.linspace(-.9,.9,80)];polyline(ic,pts,.028)
  arc(ic,(0,-.42,0),.92,0,TAU,.025,'red','lakehouse basin','xz');cyl(ic,(0,-.65,0),.92,.06,'steel',name='lakehouse base')
 elif n==35:
  database(ic,-.7,0,0,.36,2,.3);database(ic,.7,0,0,.36,2,.3)
  for a0,a1 in [(.18,math.pi-.18),(math.pi+.18,TAU-.18)]:
   pts=[(.9*math.cos(a),.72*math.sin(a),.09) for a in np.linspace(a0,a1,50)];arrow(ic,pts,.043,'red',.15)
 elif n==36:
  cube(ic,(0,0,0),.58,'silver','connector hub')
  for i in range(6):
   a=TAU*i/6+.3;p=(math.cos(a)*1.03,math.sin(a)*1.03,0);line(ic,(math.cos(a)*.3,math.sin(a)*.3,0),p,.04,'silver','connector socket');sphere(ic,p,.14,'red' if i%2==0 else 'silver','connector endpoint')
 elif n==37:shield(ic,-.3,.08,.19,.96,'lock');person(ic,.56,-.47,.08,.62);person(ic,.9,-.48,.1,.5,'red')
 elif n==38:
  person(ic,-.38,-.12,.15,1.25)
  pts=[(.59,.57,0),(.88,-.04,0),(.59,-.64,0)];polyline(ic,[(.2,.13,.0),(.4,.13,.0),(.4,.57,0),pts[0]],.03,'silver','user role tree');polyline(ic,[(.4,.13,0),(.4,-.64,0),pts[2]],.03,'silver','user role tree');line(ic,(.4,-.04,0),pts[1],.025)
  for p in pts:cube(ic,p,.37,'red' if p[1]>-.5 else 'silver','role node')
 elif n==39:document(ic,x=-.25);text_lines(ic,-.3,.5,.13,.8,5,.24);magnifier(ic,.47,-.38,.42,.46)
 elif n==40:bell(ic)
 elif n==41:
  bars(ic,-.8,-.7,0,[.32,.52,.82,1.22],.3,.16);flat_arrow(ic,[(-1,-.1),(-.48,.04),(.1,.37),(.7,.88)],.07,.2,.23);magnifier(ic,.42,-.4,.52,.4,'bars')
 elif n==42:
  bars(ic,-.8,-.7,0,[.63,.91,1.17,1.42],.28,.15);cyl(ic,(.55,-.3,.55),.4,.12,'red','z','benchmark medal');arc(ic,(.55,-.3,.63),.36,thick=.02);star(ic,.55,-.3,.65,.26)
 elif n==43:pie(ic,-.3,.2,0,.87);person(ic,-.02,-.5,.45,.49);person(ic,.78,-.48,.4,.47,'red');person(ic,.36,-.56,.7,.72)
 elif n==44:
  pts=road(ic,wide=.34)
  for i in [7,23,39,55,70]:x,t=pts[i];sphere(ic,(x,-.19,t),.09,'red','journey milestone');arc(ic,(x,-.19,t),.1,thick=.01,mat='bright',plane='xz')
  x,t=pts[-1];pin(ic,x,.26,t,.58)
 elif n==45:
  building(ic,0,-.06,0,.75)
  for a in np.linspace(0,TAU,5,endpoint=False):
   x,z=1.05*math.cos(a),.8*math.sin(a);pin(ic,x,-.06,z,.42);line(ic,(0,-.54,0),(x,-.54,z),.024,'signal','service connection')
  arc(ic,(0,-.54,0),1.08,thick=.02,mat='red',plane='xz')
 elif n==46:
  person(ic,-.63,.1,0,.52);person(ic,.61,.1,0,.52);person(ic,0,-.1,.2,.54);medical_heart(ic,0,.77,.04,.3);hand(ic)
 elif n==47:
  medical_heart(ic,-.1,.12,.15,.88)
  pts=[[-.13,-.33],[.13,-.33],[.13,-.13],[.33,-.13],[.33,.13],[.13,.13],[.13,.33],[-.13,.33],[-.13,.13],[-.33,.13],[-.33,-.13],[-.13,-.13]]
  ic.add(extrusion(pts,.05),'bright','medical cross',(-.1,.18,.27));stethoscope(ic)
 elif n==48:
  # Rear service-person silhouette and front heraldic shield.
  person(ic,.62,-.15,-.15,1.08,'steel');cyl(ic,(.62,.53,-.1),.32,.12,'steel',name='service cap');box(ic,.66,.49,.12,.66,.07,.27,'silver',.02,'cap visor')
  shield(ic,-.18,.06,.29,.96,'none');star(ic,-.18,.42,.45,.24)
  for yy in [-.16,-.43]:polyline(ic,[(-.52,yy+.13,.47),(-.18,yy-.08,.47),(.16,yy+.13,.47)],.05,'bright','service chevron')

def dollar(ic,x,y,z,s):
 pts=[(x+s*.45,y+s*.6,z),(x,y+s*.75,z),(x-s*.4,y+s*.4,z),(x-s*.25,y+s*.06,z),(x+s*.3,y-s*.08,z),(x+s*.4,y-s*.4,z),(x,y-s*.65,z),(x-s*.4,y-s*.5,z)]
 polyline(ic,pts,.025,'bright','currency S');line(ic,(x,y-s*.9,z),(x,y+s*.95,z),.018,'bright','currency vertical')

def text_api(ic,x,y,z):
 # Explicit solid strokes; no embedded raster typography.
 polyline(ic,[(x-.47,y-.24,z),(x-.32,y+.26,z),(x-.16,y-.24,z)],.036,'silver','API A');line(ic,(x-.41,y-.06,z),(x-.23,y-.06,z),.028)
 polyline(ic,[(x-.02,y-.24,z),(x-.02,y+.24,z),(x+.15,y+.24,z),(x+.25,y+.14,z),(x+.15,y+.02,z),(x-.02,y+.02,z)],.034,'silver','API P')
 line(ic,(x+.4,y-.24,z),(x+.4,y+.24,z),.036,'silver','API I')

def target(ic,x,y,z,r):
 cyl(ic,(x,y,z),r,.16,'red','z','target back')
 for rr,mat in [(r*.76,'silver'),(r*.51,'red'),(r*.28,'silver'),(r*.12,'red')]:cyl(ic,(x,y,z+.1+(r-rr)*.025),rr,.05,mat,'z','target ring')
 arc(ic,(x,y,z+.1),r,thick=.018,mat='bright')

def robot_arm(ic):
 pts=[(-.4,-.5,0),(-.5,.3,0),(.32,.88,0),(.72,.47,.0)]
 for a,b in zip(pts,pts[1:]):
  line(ic,a,b,.09,'silver','robot arm segment');line(ic,np.array(a)+[0,0,.09],np.array(b)+[0,0,.09],.018,'red','robot arm ruby rail')
 for p in pts:
  cyl(ic,p,.14,.18,'silver','z','robot joint');cyl(ic,np.array(p)+[0,0,.1],.1,.035,'red','z','robot joint cap')
 polyline(ic,[(.72,.47,0),(.86,.29,0),(.72,.21,0)],.035,'steel','robot gripper');polyline(ic,[(.72,.47,0),(.58,.29,0),(.69,.21,0)],.035,'steel','robot gripper')

def alert_disk(ic,x,y,z,r):
 cyl(ic,(x,y,z),r,.07,'red','z','alert badge');arc(ic,(x,y,z+.05),r,thick=.012,mat='bright');box(ic,x,y+.04,z+.08,.044,r*.85,.03,'bright',.018,'exclamation stem');sphere(ic,(x,y-r*.57,z+.09),.027,'bright','exclamation dot')

def chess_king(ic,x,y,z):
 profile=[(0,0),(.31,0),(.33,.05),(.31,.13),(.23,.18),(.2,.28),(.13,.38),(.11,.8),(.18,.92),(.2,1),(.14,1.1),(.12,1.2),(0,1.2)]
 ic.add(lathe(profile),'silver','strategy chess king',(x,y,z))
 for yy,rr in [(.15,.25),(.95,.18),(1.1,.15)]:arc(ic,(x,y+yy,z),rr,thick=.022,mat='red',plane='xz')
 box(ic,x,y+1.36,z,.09,.3,.12,'bright',.02,'king cross vertical');box(ic,x,y+1.4,z,.26,.08,.12,'bright',.02,'king cross horizontal')

def warning(ic,x,y,z,s):
 p=[[-s*.8,-s*.59],[s*.8,-s*.59],[0,s*.83]];ic.add(extrusion(p,.16),'red','warning triangle',(x,y,z));tube(ic,[(x+a,y+b,z+.1) for a,b in p],.03,'signal','warning edge',closed=True)
 box(ic,x,y+.13*s,z+.13,.09*s,.48*s,.07,'bright',.04,'warning exclamation');sphere(ic,(x,y-.27*s,z+.16),.057*s,'bright','warning dot')

def tree(ic,x,y,z,s):
 cube(ic,(x,y+s*.56,z),s*.31,'red','hierarchy parent');polyline(ic,[(x,y+s*.4,z),(x,y+.09*s,z),(x-.5*s,y+.09*s,z),(x+.5*s,y+.09*s,z)],.02)
 for xx in [-.5,0,.5]:line(ic,(x+xx*s,y+.09*s,z),(x+xx*s,y-.35*s,z),.023);cube(ic,(x+xx*s,y-.5*s,z),s*.28,'red','hierarchy child')

def warehouse(ic,x,y,z,s):
 box(ic,x,y-.15*s,z,.95*s,.85*s,.6*s,'steel',.03,'warehouse shell')
 roof=[[-.63,.23],[0,.8],[.63,.23],[.51,.11],[0,.55],[-.51,.11]];ic.add(extrusion(np.array(roof)*s,.7*s),'silver','warehouse roof',(x,y,z))
 box(ic,x,y-.24*s,z+.32*s,.65*s,.65*s,.04,'black',.02,'warehouse shutter')
 for yy in [-.48,-.29,-.1,.09]:box(ic,x,y+yy*s,z+.36*s,.62*s,.07*s,.04,'red',.012,'shutter slat')

def bell(ic):
 profile=[(0,-.6),(.64,-.6),(.67,-.56),(.61,-.49),(.49,-.39),(.44,-.19),(.43,.18),(.38,.49),(.27,.68),(.11,.77),(0,.79)]
 ic.add(lathe(profile),'silver','notification bell shell')
 arc(ic,(0,-.53,0),.64,thick=.025,mat='red',plane='xz');sphere(ic,(0,-.66,0),.13,'red','bell clapper');arc(ic,(0,.85,0),.105,0,TAU,.033,'silver','bell hanging eye')
 for side in [-1,1]:
  for r in [.85,1.03]:
   aa=np.linspace(-.64,.64,35);polyline(ic,[(side*r*math.cos(a),a*.85,0) for a in aa],.026,'signal','bell sound wave')

def building(ic,x,y,z,s):
 box(ic,x,y,z,.85*s,1.1*s,.7*s,'steel',.04,'service building')
 roof=[[-.56,.52],[.56,.52],[0,.87]];ic.add(extrusion(np.array(roof)*s,.85*s),'silver','service building roof',(x,y,z))
 for xx in [-.23,.23]:
  for yy in [.27,-.03]:box(ic,x+xx*s,y+yy*s,z+.37*s,.17*s,.2*s,.04,'silver',.015,'building window')
 box(ic,x,y-.39*s,z+.37*s,.23*s,.33*s,.05,'black',.02,'building entrance')

def hand(ic):
 # A solid palm and bent fingers, not an image cutout.
 box(ic,-.15,-.64,.32,1.33,.22,.44,'silver',.1,'supporting palm')
 polyline(ic,[(-.82,-.69,.31),(-.44,-.58,.35),(.25,-.55,.35),(.63,-.35,.29),(.93,-.16,.18)],.11,'silver','cupped hand fingers')
 polyline(ic,[(-.46,-.5,.55),(-.2,-.36,.55),(.28,-.39,.55)],.085,'silver','supporting thumb')
 for i in range(2):polyline(ic,[(.38+i*.06,-.55,.28+i*.07),(.73+i*.04,-.35,.18+i*.07),(.89+i*.03,-.16,.12+i*.07)],.045,'silver','hand finger detail')

def stethoscope(ic):
 pts=[(.61,.7,.25),(.9,.71,.25),(1,.32,.25),(.84,-.05,.28),(.74,-.42,.35),(.34,-.75,.36),(-.37,-.79,.35),(-.72,-.54,.36)]
 polyline(ic,pts,.042,'red','stethoscope tubing');polyline(ic,[(.61,.7,.25),(.48,.48,.25),(.57,.12,.28),(.74,-.05,.28)],.029,'silver','stethoscope metal earpiece');polyline(ic,[(.9,.71,.25),(1.03,.48,.25),(.93,.12,.28),(.74,-.05,.28)],.029,'silver','stethoscope metal earpiece');cyl(ic,(-.72,-.54,.4),.19,.09,'silver','z','stethoscope chestpiece');cyl(ic,(-.72,-.54,.46),.12,.025,'steel','z','stethoscope diaphragm')

NAMES=['Business Intelligence','Data Architecture','Data Governance','Data Quality','Financial Analytics','Management Analytics','Geoanalytics','Industry Solutions','Dashboard','KPI','Database','Data Pipeline','ETL Integration','API','Report','Document','Workflow','Map','Compliance','Security','Target','Team','Automation','Monitoring','Strategy','Roadmap','Scenario Planning','Risk','Master Data','Registry','Metadata','Data Model','Warehouse','Lakehouse','Synchronization','Connectors','Access Control','User Role','Audit','Alert','Forecast','Benchmark','Segmentation','Customer Journey','Service Network','Social Programs','Healthcare','Veteran Services']

def add_animations(path):
 gltf=GLTF2().load(str(path));blob=bytearray(gltf.binary_blob())
 for mesh in gltf.meshes:
  for primitive in mesh.primitives:
   for ai in primitive.attributes.__dict__.values():
    if isinstance(ai,int):gltf.bufferViews[gltf.accessors[ai].bufferView].target=34962
   if primitive.indices is not None:gltf.bufferViews[gltf.accessors[primitive.indices].bufferView].target=34963
 # One pivot at the object center. Child nodes retain their semantic identity.
 sc=gltf.scenes[gltf.scene or 0];children=sc.nodes.copy();pivot=len(gltf.nodes)
 gltf.nodes.append(Node(name='BC_Animation_Pivot',children=children,rotation=[0,0,0,1],translation=[0,0,0]));sc.nodes=[pivot]
 def accessor(array,typ,components):
  nonlocal blob
  while len(blob)%4:blob.append(0)
  a=np.array(array,dtype='<f4').reshape(-1,components);off=len(blob);b=a.tobytes();blob.extend(b)
  bi=len(gltf.bufferViews);gltf.bufferViews.append(BufferView(buffer=0,byteOffset=off,byteLength=len(b)))
  ai=len(gltf.accessors);gltf.accessors.append(Accessor(bufferView=bi,componentType=5126,count=len(a),type=typ,min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist()))
  return ai
 times=np.linspace(0,8,65);rot=[[0,math.sin(math.pi*t/8),0,math.cos(math.pi*t/8)] for t in times]
 ti=accessor(times,'SCALAR',1);ri=accessor(rot,'VEC4',4)
 gltf.animations=[Animation(name='Turntable_360',samplers=[AnimationSampler(input=ti,output=ri,interpolation='LINEAR')],channels=[AnimationChannel(sampler=0,target=AnimationChannelTarget(node=pivot,path='rotation'))])]
 tt=np.linspace(0,4,65);loc=[[0,.045*math.sin(TAU*t/4),0] for t in tt];rr=[[0,0,math.sin(.025*math.sin(TAU*t/4)),math.cos(.025*math.sin(TAU*t/4))] for t in tt]
 ti=accessor(tt,'SCALAR',1);li=accessor(loc,'VEC3',3);ri=accessor(rr,'VEC4',4)
 gltf.animations.append(Animation(name='Float_Idle',samplers=[AnimationSampler(input=ti,output=li,interpolation='LINEAR'),AnimationSampler(input=ti,output=ri,interpolation='LINEAR')],channels=[AnimationChannel(sampler=0,target=AnimationChannelTarget(node=pivot,path='translation')),AnimationChannel(sampler=1,target=AnimationChannelTarget(node=pivot,path='rotation'))]))
 gltf.asset.generator='Belyakov Consult procedural 3D reconstruction';gltf.asset.extras={'source':'Belyakov_Consult_Metallic_Icon_Timesaver_v2(5).pptx','geometry':'solid meshes, no image planes','front':'+Z','up':'+Y','reconstruction':True}
 gltf.buffers[0].byteLength=len(blob);gltf.set_binary_blob(bytes(blob));gltf.save_binary(str(path))

def main():
 import argparse,re
 ap=argparse.ArgumentParser();ap.add_argument('--only',type=int,nargs='*');args=ap.parse_args();records=[]
 for i,name in enumerate(NAMES,1):
  if args.only and i not in args.only:continue
  ic=Icon(name);build(i,ic)
  # Center the icon in all axes without flattening any geometry.
  bounds=ic.scene.bounds;center=bounds.mean(axis=0);ic.scene.apply_translation(-center)
  slug=re.sub('[^a-z0-9]+','-',name.lower());path=MODELS/f'{i:02d}-{slug}.glb'
  temp=path.with_suffix('.building.glb')
  temp.write_bytes(ic.scene.export(file_type='glb',include_normals=True));add_animations(temp);temp.replace(path)
  record={'id':i,'name':name,'file':path.name,'nodes':ic.count,'triangles':int(sum(len(m.faces) for m in ic.scene.geometry.values())),'bounds':ic.scene.bounds.tolist(),'bytes':path.stat().st_size,'animations':['Turntable_360','Float_Idle']}
  records.append(record);print(json.dumps(record),flush=True)
 if not args.only:(ROOT/'assets/glass/catalog.generated.json').write_text(json.dumps(records,indent=2),encoding='utf-8')

if __name__=='__main__':main()

'use strict';
/** Interactive orbit camera, no external service. All rotations are applied to the camera,
 * not to individual icons; 360° horizontal navigation works in every scene and in the map. */
window.BCSceneOrbit = class BCSceneOrbit {
  constructor(canvas, camera, onChange) {
    this.canvas=canvas;this.camera=camera;this.onChange=onChange;
    this.yaw=.20;this.tYaw=.20;this.polar=1.36;this.tPolar=1.36;
    this.distance=1;this.tDistance=1;
    this.pointers=new Map();this.dragging=false;this.suppressClick=false;
    this.lastCenter=null;this.lastPinch=null;this.rotating=false;
    this.active=true;this.autoRotate=false;this.baseDistance=21;
    this.goal=new THREE.Vector3(0,0,0);
    this.target=new THREE.Vector3(0,0,0);
    this.bind();
    document.addEventListener('contextmenu',e=>{if(e.target.closest('#visual,#catalog'))e.preventDefault()});
    document.addEventListener('dragstart',e=>{if(e.target.closest('#visual,#catalog'))e.preventDefault()});
  }
  clampDistance(v){return Math.max(.38,Math.min(3.4,v))}
  rotate(dx,dy){this.tYaw-=dx*.007;this.tPolar=Math.max(.14,Math.min(Math.PI-.14,this.tPolar-dy*.006));this.onChange()}
  zoom(delta){this.tDistance=this.clampDistance(this.tDistance*Math.exp(delta));this.onChange()}
  zoomStep(dir){this.zoom(dir*.24)}
  reset(){this.tYaw=.20;this.tPolar=1.36;this.tDistance=1;this.onChange()}
  toggleAuto(){this.autoRotate=!this.autoRotate;this.onChange();return this.autoRotate}
  bind(){const c=this.canvas;
    c.style.touchAction='none';c.tabIndex=0;
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('dragstart',e=>e.preventDefault());
    c.addEventListener('pointerdown',e=>{
      if(e.button!==0 && e.pointerType!=='touch')return;
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      this.dragging=false;
      if(this.pointers.size===2){this.lastPinch=this.pinchDistance();this.lastCenter=null}
      c.classList.add('orbit-active');this.autoRotate=false;
    });
    c.addEventListener('pointermove',e=>{
      const last=this.pointers.get(e.pointerId);if(!last)return;
      const dx=e.clientX-last.x,dy=e.clientY-last.y;
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.pointers.size>1){
        const d=this.pinchDistance();
        if(this.lastPinch&&d>0){this.zoom(Math.log(this.lastPinch/d));this.dragging=true;this.suppressClick=true}
        this.lastPinch=d;
        return;
      }
      if(Math.abs(dx)+Math.abs(dy)>.1){this.rotate(dx,dy);this.dragging=true;this.suppressClick=true}
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture']) c.addEventListener(name,e=>{
      this.pointers.delete(e.pointerId);
      this.lastPinch=this.pointers.size===2?this.pinchDistance():null;
      if(!this.pointers.size)c.classList.remove('orbit-active');
    });
    c.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.max(-.35,Math.min(.35,e.deltaY*.00125)))},{passive:false});
    c.addEventListener('keydown',e=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_','0','Home'].includes(e.key))e.preventDefault();
      if(e.key==='ArrowLeft')this.rotate(-35,0);
      if(e.key==='ArrowRight')this.rotate(35,0);
      if(e.key==='ArrowUp')this.rotate(0,35);
      if(e.key==='ArrowDown')this.rotate(0,-35);
      if(e.key==='+'||e.key==='=')this.zoomStep(-1);
      if(e.key==='-'||e.key==='_')this.zoomStep(1);
      if(e.key==='0'||e.key==='Home')this.reset();
    });
  }
  pinchDistance(){const p=[...this.pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):null}
  clickedAfterDrag(){if(this.suppressClick){this.suppressClick=false;return true}return false}
  update(dt,{overview=false,focus=false,mobile=false,wide=false,span=9,verticalSpan=8,viewHeight=800,viewWidth=700,paused=false}={}){
    const eased=1-Math.exp(-dt*8);
    if(this.autoRotate&&!paused){this.tYaw+=dt*.17;this.onChange()}
    this.yaw+= (this.tYaw-this.yaw)*eased;
    this.polar+=(this.tPolar-this.polar)*eased;
    this.distance+=(this.tDistance-this.distance)*eased;
    const aspect=Math.max(.4,viewWidth/Math.max(viewHeight,1));
    const fov=this.camera.fov*Math.PI/180;
    const fitHorizontal=(span+3.6)/(2*Math.tan(fov/2)*aspect);
    const fitVertical=(verticalSpan+4.1)/(2*Math.tan(fov/2));
    const fit=Math.max(fitHorizontal,fitVertical);
    this.baseDistance=focus?(mobile?10.5:10):overview?Math.max(34,fit*1.11):Math.max(mobile?13:16,fit*1.06);
    this.goal.set(0,focus?.65:overview?.75:0,0);
    this.target.lerp(this.goal,eased);
    const dist=this.baseDistance*this.distance;
    const sin=Math.sin(this.polar);
    this.camera.position.set(this.target.x+dist*sin*Math.sin(this.yaw),this.target.y+dist*Math.cos(this.polar),this.target.z+dist*sin*Math.cos(this.yaw));
    this.camera.lookAt(this.target);
    return Math.abs(this.tYaw-this.yaw)>.0002||Math.abs(this.tPolar-this.polar)>.0002||Math.abs(this.tDistance-this.distance)>.0002||this.target.distanceTo(this.goal)>.002;
  }
};

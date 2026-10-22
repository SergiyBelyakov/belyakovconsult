'use strict';
/* HDR red-only bloom. The graphite/metal base remains crisp: extract ruby emission,
 * blur at half resolution, then tone-map the composed HDR image exactly once. */
window.BCNeonBloom = class {
  constructor(renderer){
    const T=THREE; this.renderer=renderer;
    this.enabled=renderer.extensions.has('EXT_color_buffer_float');
    if(!this.enabled)return; // Direct tone-mapped render avoids clipping HDR into an 8-bit buffer.
    const type=T.HalfFloatType;
    this.sceneTarget=new T.WebGLRenderTarget(1,1,{type,depthBuffer:true});
    this.glowTarget=new T.WebGLRenderTarget(1,1,{type,depthBuffer:false});
    const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    this.horizontal=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{source:{value:this.sceneTarget.texture},stepSize:{value:new T.Vector2(1,0)}},vertexShader,
      fragmentShader:`uniform sampler2D source; uniform vec2 stepSize; varying vec2 vUv;
       vec3 redOnly(vec2 uv){vec3 c=texture2D(source,clamp(uv,0.0,1.0)).rgb;
         float excess=max(0.,c.r-max(c.g,c.b)*2.0-.48);
         float r=min(excess,1.05);
         return vec3(r,r*.008,r*.065);}
       void main(){vec3 b=redOnly(vUv)*.227027;
         b+=(redOnly(vUv+stepSize)+redOnly(vUv-stepSize))*.194595;
         b+=(redOnly(vUv+stepSize*2.)+redOnly(vUv-stepSize*2.))*.121622;
         b+=(redOnly(vUv+stepSize*3.)+redOnly(vUv-stepSize*3.))*.054054;
         b+=(redOnly(vUv+stepSize*4.)+redOnly(vUv-stepSize*4.))*.016216;
         gl_FragColor=vec4(b,1.);}`});
    this.composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,
      uniforms:{source:{value:this.sceneTarget.texture},glow:{value:this.glowTarget.texture},stepSize:{value:new T.Vector2(0,1)}},vertexShader,
      fragmentShader:`uniform sampler2D source; uniform sampler2D glow; uniform vec2 stepSize; varying vec2 vUv;
         vec3 g(vec2 uv){return texture2D(glow,clamp(uv,0.0,1.0)).rgb;}
         void main(){vec3 b=g(vUv)*.227027;
           b+=(g(vUv+stepSize)+g(vUv-stepSize))*.194595;
           b+=(g(vUv+stepSize*2.)+g(vUv-stepSize*2.))*.121622;
           b+=(g(vUv+stepSize*3.)+g(vUv-stepSize*3.))*.054054;
           b+=(g(vUv+stepSize*4.)+g(vUv-stepSize*4.))*.016216;
           gl_FragColor=vec4(texture2D(source,vUv).rgb+b*.38,1.);
           #include <tonemapping_fragment>
           #include <colorspace_fragment>
         }`});
    this.screen=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.horizontal);
    this.quad.frustumCulled=false;this.screen.add(this.quad);
  }
  setSize(width,height){
    if(!this.enabled)return;
    const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
    this.sceneTarget.setSize(w,h);
    this.glowTarget.setSize(Math.ceil(w/2),Math.ceil(h/2));
    this.horizontal.uniforms.stepSize.value.set(2/w,0);
    this.composite.uniforms.stepSize.value.set(0,2/Math.ceil(h/2));
  }
  render(scene,camera){
    if(!this.enabled){this.renderer.render(scene,camera);return;}
    const r=this.renderer,prev=r.getRenderTarget(),tone=r.toneMapping;
    try{
      r.toneMapping=THREE.NoToneMapping;
      r.setRenderTarget(this.sceneTarget);r.render(scene,camera);
      this.quad.material=this.horizontal;
      r.setRenderTarget(this.glowTarget);r.render(this.screen,this.camera);
      this.quad.material=this.composite;
      r.toneMapping=tone;
      r.setRenderTarget(prev);r.render(this.screen,this.camera);
    }finally{r.toneMapping=tone;r.setRenderTarget(prev)}
  }
};

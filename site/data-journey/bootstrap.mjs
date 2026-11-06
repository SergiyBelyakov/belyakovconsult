import * as THREE from './assets/vendor/three.module.js';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
window.THREE=THREE;
// Стиснені моделі (EXT_meshopt_compression + KHR_mesh_quantization): декодер підключається, якщо він є поруч.
let meshopt=null;
try{const m=await import('./assets/vendor/meshopt_decoder.module.js');await m.MeshoptDecoder.ready;meshopt=m.MeshoptDecoder}catch(_){}
class BCLoader extends GLTFLoader{constructor(manager){super(manager);if(meshopt)this.setMeshoptDecoder(meshopt)}}
window.BCGLTFLoader=BCLoader;
const base='/data-journey/';const en=document.documentElement.lang==='en';
for(const file of ['studio-lighting.js','glass-index.js','models3d.js','scene-orbit.js','scene-fullscreen.js',en?'story-data.en.js':'story-data.js','perspective-renderer.js','neon-effects.js',en?'journey.en.js':'journey.js']){
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=base+file+'?v=20261107b';script.onload=resolve;script.onerror=reject;document.head.append(script)});
}

import * as THREE from './assets/vendor/three.module.js';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
window.THREE=THREE;window.BCGLTFLoader=GLTFLoader;
const base='/data-journey/';const en=document.documentElement.lang==='en';
for(const file of ['studio-lighting.js','glass-index.js','models3d.js','scene-orbit.js','scene-fullscreen.js',en?'story-data.en.js':'story-data.js','perspective-renderer.js','neon-effects.js',en?'journey.en.js':'journey.js']){
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=base+file+'?v=ruby-neon-fullscreen-20261022';script.onload=resolve;script.onerror=reject;document.head.append(script)});
}

import * as THREE from './assets/vendor/three.module.js';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
import {RoomEnvironment} from './assets/vendor/RoomEnvironment.js';
window.THREE=THREE;window.BCGLTFLoader=GLTFLoader;window.BCRoomEnvironment=RoomEnvironment;
const base='/data-journey/';const en=document.documentElement.lang==='en';
for(const file of ['glass-index.js','models3d.js','scene-orbit.js',en?'story-data.en.js':'story-data.js','perspective-renderer.js','neon-effects.js',en?'journey.en.js':'journey.js']){
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=base+file;script.onload=resolve;script.onerror=reject;document.head.append(script)});
}

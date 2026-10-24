/* Shared scene brightness UI for Ukrainian and English data journey. */
(() => {
 'use strict';
 const input=document.getElementById('sceneBrightness');
 const output=document.getElementById('sceneBrightnessValue');
 const reset=document.getElementById('sceneBrightnessReset');
 if(!input||!output)return;
 const DEFAULT=135;
 const storageKey='bc-journey-brightness-v1';
 let value=DEFAULT;
 try{const saved=Number(localStorage.getItem(storageKey));if(Number.isFinite(saved)&&saved>=55&&saved<=220)value=saved;}catch(_){}
 const apply=()=>{
  const level=value/100;
  input.value=String(value);
  output.textContent=String(value)+'%';
  if(window.BCStudioLighting)window.BCStudioLighting.currentLevel=level;
  if(window.BCStudioLighting&&window.bcSceneLightingTarget){
    const target=window.bcSceneLightingTarget;
    window.BCStudioLighting.setBrightness(level,target.renderer,target.scene);
  }
  document.documentElement.style.setProperty('--bc-scene-brightness',String(level));
 };
 input.addEventListener('input',()=>{
  value=Number(input.value);
  try{localStorage.setItem(storageKey,String(value));}catch(_){}
  apply();
 });
 reset?.addEventListener('click',()=>{value=DEFAULT;try{localStorage.removeItem(storageKey);}catch(_){}apply();});
 document.addEventListener('bc-scene-initialized',apply);
 apply();
})();

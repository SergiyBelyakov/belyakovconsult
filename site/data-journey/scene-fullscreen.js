'use strict';
(() => {
 const visual=document.getElementById('visual'),button=document.getElementById('sceneFullscreen');
 const stages=document.querySelector('.stage-nav'),en=document.documentElement.lang==='en';
 if(!visual||!button||!stages)return;
 const anchor=document.createComment('stage navigation');stages.before(anchor);
 let expanded=false,busy=false;
 const resize=()=>window.dispatchEvent(new Event('resize'));
 function update(value){
  if(expanded===value)return;
  expanded=value;document.body.classList.toggle('scene-expanded',value);
  button.setAttribute('aria-pressed',String(value));
  button.textContent=value?(en?'Exit full screen':'Згорнути сцену'):(en?'Full screen':'На весь екран');
  if(value){visual.append(stages);button.focus();}
  else {anchor.after(stages);document.dispatchEvent(new Event('bc-scene-collapsed'));button.focus();}
  resize();
 }
 button.addEventListener('click',async()=>{
  if(busy)return;busy=true;
  try{
   if(expanded){if(document.fullscreenElement===visual)await document.exitFullscreen();update(false);}
   else {
    update(true);
    if(visual.requestFullscreen&&document.fullscreenEnabled){
     try{await visual.requestFullscreen();}catch{/* CSS viewport expansion remains available. */}
    }
   }
  } finally {busy=false;resize();}
 });
 document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement===visual)update(true);
  else if(expanded)update(false);
  resize();
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&expanded&&!document.fullscreenElement){
   event.preventDefault();event.stopImmediatePropagation();update(false);
  }
 },true);
 // In the CSS fallback, keep keyboard focus within the expanded scene.
 document.addEventListener('keydown',event=>{
  if(!expanded||event.key!=='Tab')return;
  const items=[...visual.querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 new ResizeObserver(resize).observe(visual);
})();

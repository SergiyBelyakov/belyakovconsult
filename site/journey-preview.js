'use strict';
// The illustration stays lightweight; motion runs only while it is visible.
document.querySelectorAll('.journey-art-frame').forEach(frame => {
  const button=frame.querySelector('.journey-motion-toggle');
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=preference.matches, inView=false;
  const update=()=>{
    button.hidden=preference.matches;
    frame.classList.toggle('is-animated',inView&&!paused&&!document.hidden);
    button.setAttribute('aria-pressed',String(paused));
    button.textContent=paused?button.dataset.resume:button.dataset.pause;
  };
  button.hidden=false;
  button.addEventListener('click',()=>{paused=!paused;update()});
  preference.addEventListener('change',()=>{paused=preference.matches;update()});
  document.addEventListener('visibilitychange',update);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting;update();
    },{threshold:.12});
    observer.observe(frame);
  }else{inView=true}
  update();
});

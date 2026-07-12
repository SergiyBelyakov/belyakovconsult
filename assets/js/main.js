const header=document.querySelector('[data-header]');
const nav=document.querySelector('[data-nav]');
const menuButton=document.querySelector('[data-menu-button]');
const pageLang=document.documentElement.lang||'uk';
const formMessages={
  uk:{invalid:'Заповніть обов’язкові поля і підтвердіть згоду. Неповна заявка не має сенсу.',success:'Готово. У продакшн-версії ця заявка піде в email-сервіс, CRM, Google Sheets або Telegram bot.'},
  en:{invalid:'Fill in the required fields and confirm consent. An incomplete request is useless.',success:'Done. In production this request would be sent to an email service, CRM, Google Sheets or a Telegram bot.'},
  de:{invalid:'Füllen Sie die Pflichtfelder aus und bestätigen Sie die Zustimmung. Eine unvollständige Anfrage ist nutzlos.',success:'Fertig. In der Produktionsversion würde diese Anfrage an einen E-Mail-Dienst, ein CRM, Google Sheets oder einen Telegram-Bot gesendet.'}
};
const copy=formMessages[pageLang]||formMessages.uk;
let lastScroll=0;

menuButton?.addEventListener('click',()=>{
  nav?.classList.toggle('is-open');
  document.body.classList.toggle('no-scroll',nav?.classList.contains('is-open'));
});

nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
  nav.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
}));

window.addEventListener('scroll',()=>{
  if(!header) return;
  const current=window.scrollY;
  if(current>lastScroll&&current>140){
    header.classList.add('is-hidden');
  }else{
    header.classList.remove('is-hidden');
  }
  lastScroll=current;
});

const revealItems=document.querySelectorAll('.reveal');
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(prefersReduced){
  revealItems.forEach(el=>el.classList.add('is-visible'));
}else{
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.12});
  revealItems.forEach(el=>observer.observe(el));
}

const form=document.querySelector('#lead-form');
const status=document.querySelector('[data-form-status]');
form?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!form.checkValidity()){
    if(status){
      status.textContent=copy.invalid;
      status.classList.add('show');
    }
    form.reportValidity();
    return;
  }
  if(status){
    status.textContent=copy.success;
    status.classList.add('show');
  }
  form.reset();
});

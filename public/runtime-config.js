const PINOY_API_ORIGIN = location.hostname === 'admin-pinoy-ambula.duckdns.org'
  ? ''
  : 'https://pinoyambulakw.duckdns.org';

window.PINOY_RUNTIME = Object.freeze({
  appName: 'PinoyAmbula',
  apiOrigin: PINOY_API_ORIGIN,
  mediaOrigin: PINOY_API_ORIGIN
});

// Keep native Capacitor builds self-contained. The APK must load its bundled
// HTML/CSS/JS locally and use the production host only for live API/media data.
// Do not inject a <base> tag here: that would redirect bundled script/assets
// back to the web host and can make the native shell appear "web unavailable".
(function loadMediaRuntime(){
  const s=document.createElement('script');
  s.src='/media-runtime-fix.js?v=20261003-android1';
  s.defer=false;
  document.head.appendChild(s);
})();

// Admin-only navigation shell. Loaded here so the existing admin page logic
// remains untouched while the navigation becomes responsive and functional.
(function loadAdminNavigation(){
  if(location.hostname!=='admin-pinoy-ambula.duckdns.org' && !location.pathname.startsWith('/admin')) return;
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='/admin-nav.css?v=20261005-nav1';
  document.head.appendChild(css);

  const enhance=()=>{
    const side=document.getElementById('side');
    if(!side) return;
    const existingMenu=side.querySelector('.admin-nav-menu');
    const existingToggle=side.querySelector('.admin-nav-toggle');
    if(existingMenu && existingToggle) return;
    side.dataset.navEnhanced='1';
    const brand=side.querySelector('.admin-brand');
    const buttons=[...side.querySelectorAll(':scope > button')];
    if(!brand || !buttons.length) return;

    const menu=document.createElement('div');
    menu.className='admin-nav-menu';
    menu.id='adminNavMenu';
    buttons.forEach((button,index)=>{
      if(index===buttons.length-2){
        const sep=document.createElement('span');
        sep.className='admin-nav-separator';
        sep.setAttribute('aria-hidden','true');
        menu.appendChild(sep);
      }
      menu.appendChild(button);
    });

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='admin-nav-toggle';
    toggle.setAttribute('aria-controls','adminNavMenu');
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','Open admin navigation');
    toggle.textContent='☰';
    toggle.addEventListener('click',()=>{
      const open=menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.textContent=open?'×':'☰';
      toggle.setAttribute('aria-label',open?'Close admin navigation':'Open admin navigation');
    });

    side.appendChild(menu);
    side.appendChild(toggle);
    menu.addEventListener('click',event=>{
      if(event.target.closest('button')){
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
        toggle.textContent='☰';
        toggle.setAttribute('aria-label','Open admin navigation');
      }
    });
    document.addEventListener('click',event=>{
      if(!side.contains(event.target)){
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
        toggle.textContent='☰';
      }
    });
  };

  const watch=()=>{
    enhance();
    const side=document.getElementById('side');
    if(side && !side.dataset.navObserver){
      const observer=new MutationObserver(enhance);
      observer.observe(side,{childList:true});
      side.dataset.navObserver='1';
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watch,{once:true});
  else watch();
})();

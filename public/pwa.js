(() => {
  const isNative = !!window.Capacitor?.isNativePlatform?.();
  if (isNative) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=20261006-v26', {scope:'/', updateViaCache:'none'})
        .then(reg => reg.update())
        .catch(error => console.warn('PWA service worker registration failed', error));
    });

  const installResponsiveNav = () => {
    const nav = document.querySelector('body > nav');
    const burger = document.getElementById('burger');
    const menu = document.getElementById('nl');
    if (nav && burger && menu) {
      const home = nav.querySelector('.home-nav-link');
      if (home) home.hidden = true;
      const cartItem = menu.querySelector('button[onclick*="cartT"]')?.closest('li');
      if (cartItem) cartItem.hidden = false;
    }
  };

  const injectResponsiveStyles = () => {
    if (document.getElementById('responsive-nav-footer-runtime')) return;
    const style = document.createElement('style');
    style.id = 'responsive-nav-footer-runtime';
    style.textContent = `
      /* Navigation layout is owned by style.css + master-enhancements.js. */
      /* Admin navigation layout is owned by admin-nav.css. */
      .site-footer{background:var(--b)!important;color:#fff!important;border-top:3px solid var(--y)!important;padding:0!important;text-align:left!important;overflow:hidden!important}
      .site-footer-inner{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;max-width:1320px!important;min-height:58px!important;white-space:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
      .site-footer-inner::-webkit-scrollbar{display:none!important}
      .footer-brand{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important}
      .footer-brand .footer-logo img{width:34px!important;height:34px!important}
      .footer-brand .brand-logo{color:#fff!important;font-size:.92rem!important;font-weight:800!important}
      .footer-brand .footer-thanks{margin:0!important;opacity:.7!important;font-size:.76rem!important}
      .footer-links,.footer-nav{display:flex!important;align-items:center!important;gap:12px!important;flex:0 0 auto!important;margin:0!important;padding:0!important;border:0!important;min-width:0!important}
      .footer-links:empty{display:none!important}
      .site-footer a{color:#fff!important;text-decoration:none!important;opacity:.88!important;font-size:.78rem!important;white-space:nowrap!important}
      .site-footer a:hover,.site-footer a:focus-visible{color:var(--y)!important;opacity:1!important}
      @media(max-width:600px){
        .site-footer-inner{min-height:52px!important;gap:10px!important;padding-inline:10px!important}
        .footer-brand .footer-logo img{width:30px!important;height:30px!important}
        .footer-brand .footer-thanks{display:none!important}
        .footer-links,.footer-nav{gap:10px!important}
        .site-footer a{font-size:.74rem!important}
      }
    `;
    document.head.appendChild(style);
  };

  window.addEventListener('DOMContentLoaded', () => {
    injectResponsiveStyles();
    installResponsiveNav();
  });
})();


/* PUBLIC NAV TOGGLE — keep the existing HTML onclick functional. */
window.togglePublicNav = function(button){
  const menu = document.getElementById('nl');
  if(!menu) return;
  const open = !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  if(button) button.setAttribute('aria-expanded', String(open));
  if(button) button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
};

window.addEventListener('click', function(event){
  const menu = document.getElementById('nl');
  const button = document.getElementById('burger');
  if(!menu || !button || !menu.classList.contains('open')) return;
  if(!menu.contains(event.target) && !button.contains(event.target)){
    menu.classList.remove('open');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label','Open navigation menu');
  }
});

window.addEventListener('keydown', function(event){
  if(event.key !== 'Escape') return;
  const menu = document.getElementById('nl');
  const button = document.getElementById('burger');
  if(!menu || !button) return;
  menu.classList.remove('open');
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-label','Open navigation menu');
});

(() => {
  const isNative = !!window.Capacitor?.isNativePlatform?.();
  if (!isNative && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=20261003-nativefix1', {scope:'/'})
        .catch(error => console.warn('PWA service worker registration failed', error));
    });
  }

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

    const side = document.getElementById('side');
    const adminApp = document.getElementById('app');
    if (side && adminApp && !document.getElementById('admin-nav-toggle')) {
      const toggle = document.createElement('button');
      toggle.id = 'admin-nav-toggle';
      toggle.type = 'button';
      toggle.className = 'btn s admin-nav-toggle';
      toggle.textContent = '☰ Admin Menu';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.onclick = () => {
        const open = side.classList.toggle('admin-nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      };
      adminApp.insertBefore(toggle, side);
    }
  };

  const injectResponsiveStyles = () => {
    if (document.getElementById('responsive-nav-footer-runtime')) return;
    const style = document.createElement('style');
    style.id = 'responsive-nav-footer-runtime';
    style.textContent = `
      nav .home-nav-link{display:none!important}
      nav #nl{display:none!important}
      nav #burger{display:inline-flex!important;margin-left:auto;flex:0 0 auto}
      nav #nl.open{display:flex!important;position:absolute;top:72px;left:12px;right:12px;max-height:calc(100vh - 84px);overflow:auto;flex-direction:column;align-items:stretch;gap:4px;padding:12px;background:rgba(255,255,255,.99);border:1px solid #e5dccb;border-radius:16px;box-shadow:0 18px 42px #0003;z-index:80;margin:0}
      nav #nl.open li,nav #nl.open a,nav #nl.open .btn{width:100%}
      nav #nl.open a,nav #nl.open .btn{min-height:44px;text-align:center}
      .admin-nav-toggle{display:none}
      @media(max-width:980px){
        #app{position:relative}
        #admin-nav-toggle{display:inline-flex;margin:10px 10px 0;position:sticky;top:8px;z-index:60;box-shadow:0 4px 12px #0003}
        #side{display:none!important;position:sticky!important;top:0!important;height:auto!important;max-height:calc(100vh - 70px)!important;overflow:auto!important;flex-direction:column!important;align-items:stretch!important;white-space:normal!important;padding:10px!important;border-radius:0 0 14px 14px}
        #side.admin-nav-open{display:flex!important}
        #side .admin-brand{position:static!important;display:flex!important;border:0!important;margin:0 0 4px!important}
        #side button{width:100%!important;text-align:left!important;min-height:44px!important}
      }
      @media(max-width:600px){
        nav .wrap{padding-inline:10px;gap:8px}
        nav #burger{width:42px;height:42px;margin-left:0}
        nav #nl.open{top:62px;left:8px;right:8px}
      }
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
    const side = document.getElementById('side');
    if (side) new MutationObserver(installResponsiveNav).observe(side, {childList:true, subtree:true});
  });
})();

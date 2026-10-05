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
      const wrap = burger.parentElement;
      const cartItem = menu.querySelector('li:last-child');
      const cartButton = cartItem?.querySelector('button[onclick*="cartT"]');
      if (cartButton && cartButton.parentElement !== wrap) {
        cartButton.id = 'public-cart-nav';
        cartButton.classList.add('nav-cart');
        cartButton.innerHTML = '🛒 <span class="cart-label">Cart</span> (<span id="cc">' + (document.getElementById('cc')?.textContent || '0') + '</span>)';
        cartItem.remove();
        wrap.insertBefore(cartButton, burger);
      }
      const home = nav.querySelector('.home-nav-link');
      if (home) home.hidden = true;
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
      nav #public-cart-nav{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 13px;border-radius:999px;white-space:nowrap;flex:0 0 auto}
      nav #public-cart-nav .cart-label{display:inline}
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
        nav #public-cart-nav{width:42px;height:42px;padding:0;font-size:0;border-radius:11px}
        nav #public-cart-nav .cart-label{display:none}
        nav #public-cart-nav #cc{font-size:.78rem;margin-left:2px}
        nav #burger{width:42px;height:42px;margin-left:0}
        nav #nl.open{top:62px;left:8px;right:8px}
      }
      .site-footer{background:linear-gradient(135deg,#12352d 0%,#173f35 55%,#244f43 100%)!important;border-top:3px solid var(--y)!important;padding:34px 0 26px!important;text-align:left!important}
      .site-footer-inner{display:grid!important;grid-template-columns:minmax(220px,1.25fr) minmax(180px,1fr) minmax(180px,1fr) auto;align-items:center;gap:26px;max-width:1320px}
      .footer-brand{display:flex!important;align-items:center;gap:14px;min-width:0}
      .footer-brand .footer-thanks{margin:0!important;white-space:nowrap}
      .footer-links,.footer-nav{display:flex!important;align-items:center;justify-content:flex-start;gap:8px 16px;flex-wrap:wrap;min-width:0}
      .footer-nav{justify-content:flex-end}
      .site-footer a{color:#fff;text-decoration:none;opacity:.94}
      .site-footer a:hover,.site-footer a:focus-visible{color:var(--y);opacity:1}
      @media(max-width:980px){.site-footer-inner{grid-template-columns:1fr 1fr}.footer-brand{grid-column:1/-1}.footer-nav{justify-content:flex-start}}
      @media(max-width:600px){.site-footer{padding:28px 0 22px!important}.site-footer-inner{display:flex!important;flex-direction:column;align-items:stretch;text-align:left;gap:18px}.footer-brand{align-items:center;justify-content:center;flex-direction:column}.footer-brand .footer-thanks{white-space:normal}.footer-links,.footer-nav{justify-content:center;width:100%;text-align:center}.footer-links a,.footer-nav a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 10px}}
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

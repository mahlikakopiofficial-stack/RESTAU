(() => {
  const isNative = !!window.Capacitor?.isNativePlatform?.();
  if (isNative) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=20261006-v28', {scope:'/', updateViaCache:'none'})
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
      /* Footer styling lives in public/style.css as the single responsive authority. */
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

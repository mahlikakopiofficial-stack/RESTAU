(() => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=20261001-auth1', {scope:'/'})
      .catch(error => console.warn('PWA service worker registration failed', error));
  });
})();
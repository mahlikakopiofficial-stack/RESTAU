(() => {
  // Capacitor Android/iOS should keep native WebView/plugin behavior independent
  // from the browser PWA service worker. The web/PWA site retains service-worker
  // caching while native builds keep a clean local shell and live API connection.
  const isNative = !!window.Capacitor?.isNativePlatform?.();
  if (isNative) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=20261003-nativefix1', {scope:'/'})
      .catch(error => console.warn('PWA service worker registration failed', error));
  });
})();

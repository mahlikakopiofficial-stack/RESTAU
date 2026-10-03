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

const PINOY_API_ORIGIN = location.hostname === 'admin-pinoy-ambula.duckdns.org'
  ? ''
  : 'https://pinoyambulakw.duckdns.org';

// Capacitor/Android loads the UI from a local origin, while uploaded images
// are served by the production web origin. A base URL makes relative media
// paths such as /uploads/... resolve to the production server in the APK too.
if (PINoyBaseNeeded()) {
  const base = document.createElement('base');
  base.href = PINOY_API_ORIGIN + '/';
  document.head.prepend(base);
}

function PINoyBaseNeeded() {
  return location.protocol === 'capacitor:' ||
    location.protocol === 'ionic:' ||
    location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
}

window.PINOY_RUNTIME = Object.freeze({
  appName: 'PinoyAmbula',
  apiOrigin: PINOY_API_ORIGIN,
  mediaOrigin: PINOY_API_ORIGIN
});

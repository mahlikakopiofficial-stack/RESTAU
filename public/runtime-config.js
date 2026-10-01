window.PINOY_RUNTIME = Object.freeze({
  appName: 'PinoyAmbula',
  apiOrigin: location.hostname === 'admin-pinoy-ambula.duckdns.org'
    ? ''
    : 'https://pinoyambulakw.duckdns.org'
});

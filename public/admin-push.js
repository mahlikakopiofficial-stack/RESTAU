(function () {
  'use strict';

  if (!window.NativeAdminPush || window.__pinoyAdminPushClient) return;
  window.__pinoyAdminPushClient = true;

  const apiBase = () => String(window.PINOY_RUNTIME?.apiOrigin || '').replace(/\/$/, '');
  const authToken = () => String(localStorage.getItem('at') || '');
  let latestFcmToken = '';
  let pendingRoute = null;
  let registering = false;

  function nativeToken() {
    try {
      return String(window.NativeAdminPush?.getFcmToken?.() || latestFcmToken || '').trim();
    } catch {
      return latestFcmToken;
    }
  }

  async function register() {
    const auth = authToken();
    const token = nativeToken();
    if (!auth || !token || registering) return;
    registering = true;
    try {
      const response = await fetch(apiBase() + '/api/admin/push/register', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          device: 'PinoyAmbula Admin Android'
        }),
        cache: 'no-store'
      });
      if (!response.ok) {
        // Keep the admin dashboard usable if push has not been configured on the VPS yet.
        console.warn('[Admin Push] Registration failed with HTTP ' + response.status);
      }
    } catch (error) {
      console.warn('[Admin Push] Registration unavailable.');
    } finally {
      registering = false;
    }
  }

  async function unregister() {
    const auth = authToken();
    const token = nativeToken();
    if (!auth || !token) return;
    try {
      await fetch(apiBase() + '/api/admin/push/unregister', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token }),
        cache: 'no-store'
      });
    } catch (_) {}
  }

  function openNotification(detail) {
    const route = String(detail?.adminRoute || '');
    if (!['Orders', 'Inquiries', 'Subscriptions'].includes(route)) return;
    pendingRoute = route;
    if (authToken() && typeof window.go === 'function') {
      const target = pendingRoute;
      pendingRoute = null;
      setTimeout(() => window.go(target), 150);
    }
  }

  window.registerAdminPush = register;
  window.unregisterAdminPush = unregister;

  window.addEventListener('admin-auth-ready', () => {
    register();
    if (pendingRoute && authToken() && typeof window.go === 'function') {
      const target = pendingRoute;
      pendingRoute = null;
      setTimeout(() => window.go(target), 150);
    }
  });

  window.addEventListener('admin-fcm-token', event => {
    latestFcmToken = String(event.detail?.token || '').trim();
    register();
  });
  window.addEventListener('admin-push-open', event => openNotification(event.detail));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) register();
  });

  // Also register when the dashboard was already authenticated before this script ran.
  register();
})();
(() => {
  if (document.title.includes('Admin') || window.__customerLiveController) return;

  const token = () => window.tk ? window.tk('ct') : localStorage.getItem('ct');
  let controller = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let generation = 0;
  const seen = { orders: 0, messages: 0 };

  const notify = (title, body) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch (_) {}
    }
  };

  const handleEvent = (event) => {
    if (!event?.type) return;

    if (event.type === 'ready') {
      seen.orders = Math.max(seen.orders, Number(event.orders) || 0);
      seen.messages = Math.max(seen.messages, Number(event.messages) || 0);
      return;
    }

    if (event.type === 'order' || event.type === 'order_status') {
      if (event.type === 'order') {
        const id = Number(event.id) || 0;
        if (id <= seen.orders) return;
        seen.orders = id;
      }
      const label = event.type === 'order'
        ? 'Order #' + event.id + ' received'
        : 'Order #' + event.id + ' is now ' + (event.status || 'updated');
      if (typeof window.toast === 'function') window.toast('🔔 ' + label);
      notify('PinoyAmbula', label);
      window.dispatchEvent(new CustomEvent('customer-live-event', { detail: event }));
      return;
    }

    if (event.type === 'message') {
      const id = Number(event.id) || 0;
      if (id <= seen.messages) return;
      seen.messages = id;
      if (typeof window.toast === 'function') window.toast('💬 New message from PinoyAmbula');
      notify('PinoyAmbula message', 'You have a new restaurant reply.');
      window.dispatchEvent(new CustomEvent('customer-live-event', { detail: event }));
    }
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const stop = () => {
    generation += 1;
    clearReconnect();
    try { controller?.abort(); } catch (_) {}
    controller = null;
    window.__customerLiveController = null;
  };

  const connect = () => {
    const authToken = token();
    if (!authToken) {
      stop();
      return;
    }

    clearReconnect();
    try { controller?.abort(); } catch (_) {}

    const myGeneration = ++generation;
    controller = new AbortController();
    const currentController = controller;
    window.__customerLiveController = { stop };

    const qs = new URLSearchParams();
    if (seen.orders || seen.messages) {
      qs.set('orders', String(seen.orders));
      qs.set('messages', String(seen.messages));
    }

    const apiOrigin = String(window.PINOY_RUNTIME?.apiOrigin || '').replace(/\/$/, '');
    const url = apiOrigin + '/api/customer/events' + (qs.toString() ? '?' + qs.toString() : '');

    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + authToken,
        Accept: 'text/event-stream'
      },
      cache: 'no-store',
      signal: currentController.signal
    }).then(async response => {
      if (!response.ok) throw new Error('Customer live notifications ' + response.status);
      if (myGeneration !== generation) return;

      reconnectDelay = 1000;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Customer live stream unavailable');

      const decoder = new TextDecoder();
      let buffer = '';

      while (myGeneration === generation) {
        const part = await reader.read();
        if (part.done) break;

        buffer += decoder.decode(part.value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const data = frame
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .join('');
          if (data) {
            try { handleEvent(JSON.parse(data)); } catch (_) {}
          }
        }
      }

      if (myGeneration === generation) {
        throw new Error('Customer live stream closed');
      }
    }).catch(error => {
      if (myGeneration !== generation) return;
      if (error?.name === 'AbortError') return;

      window.__customerLiveController = { stop };
      if (!token()) {
        stop();
        return;
      }

      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 10000);
    });
  };

  window.startCustomerLiveNotifications = () => {
    if (!document.title.includes('Admin') && !window.__customerLiveController && token()) {
      connect();
    }
  };

  window.stopCustomerLiveNotifications = stop;
  window.addEventListener('customer-auth-ready', window.startCustomerLiveNotifications);
  window.addEventListener('beforeunload', stop);

  if (token()) {
    connect();
  }
})();

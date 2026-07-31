// TinySteps service worker: receives push reminders and opens the app.

// Take control immediately so pushes work without a page reload.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // ignore malformed payloads
  }
  const title = data.title || 'TinySteps';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Time for your routine.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'tinysteps-reminder', // per-routine tag: replaces same routine only
      data: { url: data.url || '/app' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          // navigate() can reject on uncontrolled clients — fall back to a new window.
          return Promise.resolve(win.navigate(url))
            .catch(() => clients.openWindow(url))
            .then(() => win.focus());
        }
      }
      return clients.openWindow(url);
    }),
  );
});

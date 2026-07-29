// TinySteps service worker: receives push reminders and opens the app.

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
      tag: data.tag || 'tinysteps-reminder', // replaces, never stacks
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
          win.navigate(url);
          return win.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});

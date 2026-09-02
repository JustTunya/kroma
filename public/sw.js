// Nothing else lives in this worker. It is not a cache, it is not offline
// support — it exists because Web Push requires a service worker to receive.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "KROMA", {
      body: data.body ?? "Ready at the bar.",
      badge: "/icon.png",
      icon: "/icon.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

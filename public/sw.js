/* TrippinDays On the Water push service worker
   This file intentionally handles push only and does not cache pages,
   so it will not interfere with the rest of the TrippinDays PWA. */

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : "",
    };
  }

  const title =
    payload.title || "TrippinDays Water Alert";

  const options = {
    body:
      payload.body ||
      "A saved water spot reached your condition alert threshold.",
    tag:
      payload.tag ||
      "trippindays-water-condition-alert",
    data: {
      url:
        payload.url ||
        "/on-the-water",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    "/on-the-water";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            "focus" in client &&
            client.url.includes("/on-the-water")
          ) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(
            targetUrl
          );
        }

        return undefined;
      })
  );
});

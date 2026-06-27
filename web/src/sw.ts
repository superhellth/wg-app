/// <reference lib="webworker" />
// Custom service worker (vite-plugin-pwa injectManifest). Handles app-shell
// caching + Web Push display. Excluded from the app tsconfig; compiled by the
// plugin. Push payload shape = @wg/shared PushPayload { title, body, url?, tag? }.

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const CACHE = "wg-shell-v1";
const ASSETS = self.__WB_MANIFEST.map((e) => e.url);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", ...ASSETS]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// App-shell: network-first for navigations, fall back to cached index.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }
  event.respondWith(caches.match(req).then((cached) => cached ?? fetch(req)));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: { title: string; body: string; url?: string; tag?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "WG", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url ?? "/" },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

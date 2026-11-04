// Сервис-воркер — маленький помощник, который браузер держит в фоне.
// Он перехватывает запросы игры и складывает ответы в кэш,
// поэтому игра открывается и без интернета.

// Меняй номер версии при каждом обновлении игры — тогда старый кэш удалится.
const VERSION = "coder-path-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

// 1. Установка: сразу кладём в кэш все файлы игры
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// 2. Включение: удаляем кэши старых версий
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 3. Каждый запрос
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Шрифты Google: берём из кэша, а в фоне обновляем
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const cached = await c.match(req);
        const fresh = fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Файлы игры: сначала пробуем интернет (чтобы обновления приходили сразу),
  // нет сети или долго (3 с) — отдаём из кэша
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const cached = await c.match(req, { ignoreSearch: true });
        const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; });
        if (!cached) return net;
        const slow = new Promise((res) => setTimeout(() => res(cached), 3000));
        return Promise.race([net.catch(() => cached), slow]);
      })
    );
  }
});

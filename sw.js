// Сервис-воркер — маленький помощник, который браузер держит в фоне.
// Он хранит файлы игры в кэше, поэтому игра открывается и без интернета.
//
// Обновления: игра всегда берётся из кэша своей версии. Новую версию браузер
// скачивает в отдельный кэш, но включает её только когда игрок нажмёт «Обновить»
// (страница присылает сообщение "activate"). Старый кэш после этого удаляется.

// Меняй номер версии при каждом обновлении игры (и в version.json, и APP_VERSION в index.html)
const VERSION = "coder-path-v23";
const FILES = ["./", "index.html", "manifest.webmanifest", "version.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

// 1. Установка: скачиваем все файлы новой версии мимо HTTP-кэша браузера
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
  // Здесь нет skipWaiting: новая версия ждёт, пока игрок подтвердит обновление
});

// Игрок нажал «Обновить» — включаемся
self.addEventListener("message", (e) => {
  if (e.data === "activate") self.skipWaiting();
});

// 2. Включение: удаляем кэши старых версий
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("coder-path-") && k !== VERSION).map((k) => caches.delete(k))))
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

  if (url.origin !== location.origin) return; // Firebase и прочее — напрямую

  // Сведения о новой версии — всегда из интернета (так игра узнаёт об обновлении)
  if (url.pathname.endsWith("/version.json") && url.searchParams.has("check")) return;

  // Файлы игры: из кэша своей версии; чего нет — из интернета
  e.respondWith(
    caches.open(VERSION).then(async (c) => (await c.match(req, { ignoreSearch: true })) || fetch(req))
  );
});

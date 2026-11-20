// Сервис-воркер — маленький помощник, который браузер держит в фоне.
// Он хранит файлы игры в кэше, поэтому игра открывается и без интернета.
//
// Обновления: игра всегда берётся из кэша своей версии. Новую версию браузер
// скачивает в отдельный кэш, но включает её только когда игрок нажмёт «Обновить»
// (страница присылает сообщение "activate"). Старый кэш после этого удаляется.

// Меняй номер версии при каждом обновлении игры (и в version.json, и APP_VERSION в index.html)
const VERSION = "coder-path-v227";
const FILES = ["./", "index.html", "art.js", "art-scenes.js", "art-isle2.js", "art-isle3.js", "art-isle4.js", "art-isle5.js", "lang-en.js", "isle1.js", "isle2.js", "isle3.js", "isle4.js", "isle5.js", "isle6.js", "fonts.css", "manifest.webmanifest", "version.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "water.mp3", "duck.mp3", "leafsteps.mp3", "goblin-attack.mp3", "goblin-death.mp3", "sword-hit.mp3", "spear-thrust.mp3", "arrow-swish.mp3", "tnt-boom.mp3"];

// 1. Установка: скачиваем только то, что изменилось. В version.json у каждого файла есть отпечаток;
// если он такой же, как в кэше прошлой версии, файл берём оттуда, а не из интернета.
// Поэтому обычное обновление кода не тянет заново картинки (art.js) и шрифты (fonts.css).
async function install() {
  const cache = await caches.open(VERSION);
  const fresh = await fetch(new Request("version.json", { cache: "reload" }));
  const info = await fresh.clone().json();
  let old = null, oldInfo = null;
  for (const k of await caches.keys()) {
    if (!k.startsWith("coder-path-") || k === VERSION) continue;
    const c = await caches.open(k), r = await c.match("version.json");
    if (r) { old = c; oldInfo = await r.json().catch(() => null); }
  }
  await cache.put("version.json", fresh);
  await Promise.all(FILES.filter((f) => f !== "version.json" && f !== "./").map(async (f) => {
    const same = oldInfo?.files?.[f] && info.files?.[f] && oldInfo.files[f].hash === info.files[f].hash;
    if (same) {
      const r = await old.match(f);
      if (r) return cache.put(f, r);
    }
    await cache.add(new Request(f, { cache: "reload" }));
  }));
  // Стартовый адрес ("./") — это тот же index.html: второй раз его не качаем, кладём копию уже скачанного
  const page = await cache.match("index.html");
  if (page) await cache.put("./", page);
  else await cache.add(new Request("./", { cache: "reload" }));
}
self.addEventListener("install", (e) => {
  e.waitUntil(install());
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

  if (url.origin !== location.origin) return; // Firebase и прочее — напрямую

  // Сведения о новой версии — всегда из интернета (так игра узнаёт об обновлении)
  if (url.pathname.endsWith("/version.json") && url.searchParams.has("check")) return;

  // Файлы игры: из кэша своей версии; чего нет — из интернета
  e.respondWith(
    caches.open(VERSION).then(async (c) => (await c.match(req, { ignoreSearch: true })) || fetch(req))
  );
});

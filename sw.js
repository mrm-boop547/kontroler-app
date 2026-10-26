/* Офлайн: оболонка застосунку — з кешу; тайли карти, шрифти — кешуються під час перегляду. */
var SHELL = 'shell-v0.26.1';
var OFFLINE = 'offline-v1'; /* карта дільниці, збережена кнопкою «Зберегти карту офлайн» — не чиститься автоматично */
var TILES = 'tiles-v1';
var SAT = 'sat-v1'; /* супутник, збережений по селах кнопкою — не чиститься автоматично */
var FILES = ['./', './index.html', './styles.css', './app.js', './mapstyle.js', './manifest.webmanifest',
  './lib/maplibre-gl.js', './lib/qrcode.js', './lib/jsQR.js', './lib/maplibre-gl.css', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== SHELL && k !== TILES && k !== OFFLINE && k !== SAT; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isTile(url) {
  return /tiles\.openfreemap\.org|arcgisonline\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url);
}
var trimming = false;
function trim() {
  if (trimming) return; trimming = true;
  caches.open(TILES).then(function (c) {
    return c.keys().then(function (ks) {
      var extra = ks.length - 8000;
      return Promise.all(ks.slice(0, Math.max(0, extra)).map(function (k) { return c.delete(k); }));
    });
  }).then(function () { trimming = false; }, function () { trimming = false; });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = req.url;
  /* опис джерела карти: з мережею — свіжий, без мережі (або за 4 с) — той, під який збережено офлайн-тайли */
  if (/tiles\.openfreemap\.org\/planet$/.test(url)) {
    e.respondWith(new Promise(function (ok) {
      var done = false, fb = function () { if (done) return; done = true; caches.open(OFFLINE).then(function (c) { return c.match(url); }).then(function (h) { return h || caches.match(req); }).then(ok); };
      var t = setTimeout(fb, 4000);
      fetch(req).then(function (res) {
        if (done) return; if (!res.ok) return fb(); done = true; clearTimeout(t);
        var cp = res.clone(); caches.open(TILES).then(function (c) { c.put(req, cp); }); ok(res);
      }).catch(function () { clearTimeout(t); fb(); });
    }));
    return;
  }
  if (isTile(url)) {
    /* завантаження «наперед» сторінка кладе у своє сховище сама — тут не дублюємо */
    if (url.indexOf('#kc-off') >= 0) return;
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) { var cp = res.clone(); caches.open(TILES).then(function (c) { c.put(req, cp); trim(); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    }));
    return;
  }
  if (/version\.json/.test(url)) return; /* завжди напряму з мережі */
  if (new URL(url).origin === self.location.origin) {
    /* спершу мережа (оминаючи кеш браузера), без мережі — збережена копія */
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res.ok) { var cp = res.clone(); caches.open(SHELL).then(function (c) { c.put(req, cp); }); }
      return res;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
  }
});

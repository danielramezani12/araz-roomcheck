// Service Worker: فایل‌های صفحه روی گوشی ذخیره می‌شوند تا بدون اینترنت هم باز شود.
// بعد از هر تغییر در فایل‌های سایت، عدد VERSION را یکی بالا ببرید.
var VERSION = 'rc-v20';
var FILES = ['./', 'index.html', 'app.js', 'style.css', 'logo.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// فقط فایل‌های خود سایت؛ درخواست‌های گوگل (API) دست نمی‌خورند.
// با اینترنت: نسخهٔ تازه از سایت (تا تغییرها همان بار اول دیده شوند)؛ بی‌اینترنت یا اینترنت کند (بیش از ۳ ثانیه): نسخهٔ روی گوشی.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    var key = req.mode === 'navigate' ? './' : req;
    var fromCache = function () { return c.match(key, { ignoreSearch: true }).then(function (hit) { return hit || c.match('./'); }); };
    var net = fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) c.put(key, res.clone());
      return res;
    });
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { fromCache().then(function (hit) { if (!done && hit) { done = true; resolve(hit); } }); }, 3000);
      net.then(function (res) { if (!done) { done = true; clearTimeout(timer); resolve(res); } })
        .catch(function () { clearTimeout(timer); fromCache().then(function (hit) { if (!done) { done = true; resolve(hit || Response.error()); } }); });
    });
  }));
});

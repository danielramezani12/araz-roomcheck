// Service Worker: فایل‌های صفحه روی گوشی ذخیره می‌شوند تا بدون اینترنت هم باز شود.
// بعد از هر تغییر در فایل‌های سایت، عدد VERSION را یکی بالا ببرید.
var VERSION = 'rc-v4';
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
// اول از حافظهٔ گوشی، و در پس‌زمینه نسخهٔ تازه از اینترنت گرفته می‌شود.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req.mode === 'navigate' ? './' : req, res.clone());
        return res;
      }).catch(function () { return hit || c.match('./'); });
      return hit || net;
    });
  }));
});

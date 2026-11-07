// آدرس Web App گوگل (Deploy > Manage deployments). با New version همین آدرس می‌ماند.
var GOOGLE_API = 'https://script.google.com/macros/s/AKfycbw5YxgvUZ0RGgtEQu5KdBSaTIzhgYaeCE9XeIByjlb2lUUOHCnVDU9GMO0OBYZwZ24R/exec';
// روی GitHub Pages مستقیم به گوگل؛ روی سرور داخلی هتل به خود سرور (که تیک‌ها را نگه می‌دارد و به گوگل می‌فرستد)
var LOCAL = !/github\.io$/.test(location.hostname);
var API = LOCAL ? 'api' : GOOGLE_API;
var LABELS = ['وضعیت کنترل', 'داخلی TV', 'وضعیت IPTV', 'تلفن داخلی', 'Time', 'DND', 'Menu'];
var GUEST = 'مهمان دارد', NO_GUEST = 'بدون مهمان', OOS = 'خارج از سرویس';
var S = { init: null, people: [], me: null, from: 0, to: 9999999, floor: null, rooms: [] };
var NET = { online: true, busy: false, wasOffline: false };
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function toast(m, ms) { var t = el('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, ms || 2600); }
function mem(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function memJson(k, d) { try { var v = mem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
// ---------- کد شخصی کارشناس (از لینک ?k=… یک بار روی گوشی ذخیره می‌شود) ----------
var TOKEN = (function () {
  var m = location.search.match(/[?&]k=([A-Za-z0-9]+)/);
  if (m) { mem('rc_k', m[1]); return m[1]; }
  return mem('rc_k') || '';
})();
// درخواست به Apps Script به صورت simple request (POST با text/plain) تا preflight لازم نشود
function api(fn, args) {
  var ctl = window.AbortController ? new AbortController() : null;
  var tm = setTimeout(function () { if (ctl) ctl.abort(); }, 30000);
  return fetch(API, { method: 'POST', body: JSON.stringify({ k: TOKEN, fn: fn, a: args || {} }), redirect: 'follow', signal: ctl ? ctl.signal : undefined })
    .then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('net'); return r.json(); })
    .then(function (o) {
      if (o && o.auth) { askToken(o.error); var e = new Error(o.error); e.auth = true; throw e; }
      if (!o || !o.ok) { var e2 = new Error((o && o.error) || 'خطا'); e2.server = true; throw e2; }
      return o.data;
    }, function (e) { clearTimeout(tm); throw e; });
}
function askToken(msg) {
  el('nav').innerHTML = ''; el('prog').style.width = '0';
  el('main').innerHTML = '<div class="msg">' + esc(msg || 'لینک شخصی خود را کپی کنید و اینجا بچسبانید (یا فقط کد بعد از k=).') + '</div>' +
    '<div class="login"><input id="tok" autocomplete="off" autocapitalize="off" placeholder="کد شخصی یا کل لینک"><button data-tok="1">ورود</button></div>';
}
function normMac(v) { var h = String(v || '').toUpperCase().replace(/[^0-9A-F]/g, ''); return h.length === 12 ? h.match(/../g).join(':') : null; }

// ---------- آفلاین: هر تغییر اول در صف گوشی ذخیره و بعد به شیت فرستاده می‌شود ----------
function qLoad() { return memJson('rc_q', []); }
function qStore(q) { mem('rc_q', JSON.stringify(q)); }
function setNet(online) {
  if (!online) NET.wasOffline = true;
  NET.online = online;
  var n = qLoad().length, b = el('net');
  if (!online) { b.className = 'net off'; b.textContent = '● آفلاین' + (n ? ' | ' + n + ' مورد روی گوشی ذخیره شده' : '') + ' | با وصل شدن اینترنت خودکار ارسال می‌شود'; }
  else if (n) { b.className = 'net wait'; b.textContent = 'در حال ارسال ' + n + ' مورد…'; }
  else if (PRE.busy) { b.className = 'net wait'; b.textContent = 'در حال ذخیرهٔ طبقه‌ها روی گوشی: ' + PRE.done + ' از ' + PRE.total; }
  else { b.className = 'net'; b.textContent = ''; }
}
function sync() {
  var q = qLoad();
  if (!q.length) { setNet(navigator.onLine !== false); return; }
  if (NET.busy) return;
  if (navigator.onLine === false) { setNet(false); return; }
  NET.busy = true;
  var batch = q.slice(0, 50), ids = batch.map(function (x) { return x.id; });
  api('save', { list: batch }).then(function (res) {
    NET.busy = false;
    qStore(qLoad().filter(function (x) { return ids.indexOf(x.id) < 0; }));
    (res.errors || []).forEach(function (er) { toast('ذخیره نشد (اتاق ' + er.room + '): ' + er.msg, 5000); });
    var left = qLoad().length;
    if (NET.wasOffline && !left) { NET.wasOffline = false; toast('✓ اینترنت وصل شد و ' + (res.done || 0) + ' مورد ' + (LOCAL ? 'به سرور هتل' : 'به گوگل شیت') + ' منتقل شد', 4500); }
    setNet(true);
    if (left) sync();
  }, function (e) {
    NET.busy = false;
    setNet(!!e.server || !!e.auth);
    if (e.server) toast('ذخیره نشد: ' + e.message, 5000);
  });
}
window.addEventListener('online', sync);
window.addEventListener('offline', function () { setNet(false); });
setInterval(sync, 15000);

function applyField(r, f, v) {
  if (f === 'note') r.note = v;
  else if (f === 'all') r.items = r.items.map(function () { return v; });
  else if (f === 'ap') { r.ap = v; if (!v) r.mac = ''; }
  else if (f === 'mac') { r.ap = true; r.mac = v; }
  else if (/^i[0-6]$/.test(f)) r.items[+f.charAt(1)] = v;
}
// تغییرهایی که هنوز ارسال نشده‌اند روی دادهٔ رسیده از شیت اعمال می‌شوند تا چیزی برنگردد
function overlay(rows, floor) {
  rows = JSON.parse(JSON.stringify(rows));
  qLoad().forEach(function (x) {
    if (x.pid !== S.init.pid || x.floor !== floor) return;
    var r = rows.filter(function (y) { return y.row === x.row; })[0];
    if (r) applyField(r, x.field, x.value);
  });
  return rows;
}
// هر طبقه کامل (همهٔ اتاق‌ها) روی گوشی ذخیره می‌شود؛ هنگام نمایش فقط بازهٔ کارشناس جدا می‌شود
function cacheKey(floor) { return 'rc_f|' + S.init.pid + '|' + floor; }
function cacheSet(floor, rows) { mem(cacheKey(floor), JSON.stringify(rows)); }
function cacheGet(floor) { return memJson(cacheKey(floor), null); }
function inRange(rows) { return rows.filter(function (r) { var n = Number(r.room); return n >= S.from && n <= S.to; }); }
function view(rows, floor) { return overlay(inRange(rows), floor); }
// تغییر اتاق‌های نمایش‌داده‌شده در نسخهٔ کامل طبقه روی گوشی
function cacheMerge(floor, rooms) {
  var full = cacheGet(floor);
  if (!full) return;
  rooms.forEach(function (r) { for (var j = 0; j < full.length; j++) if (full[j].row === r.row) full[j] = r; });
  cacheSet(floor, full);
}
// اول طبقه‌های خود کارشناس (طبقهٔ فعلی اول)، بعد بقیهٔ طبقه‌ها
function allFloorsOrdered(first) {
  var mine = myFloors().map(function (f) { return f.name; });
  return S.init.floors.slice().sort(function (a, b) {
    var ka = a.name === first ? 0 : mine.indexOf(a.name) >= 0 ? 1 : 2, kb = b.name === first ? 0 : mine.indexOf(b.name) >= 0 ? 1 : 2;
    return ka - kb;
  });
}
function cleanCache() {
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf('rc_f|') === 0 && (k.indexOf('rc_f|' + S.init.pid + '|') !== 0 || k.split('|').length !== 3)) localStorage.removeItem(k);
    }
  } catch (e) {}
}
// همهٔ طبقه‌های این کارشناس از قبل روی گوشی ذخیره می‌شوند تا بدون اینترنت هم باز شوند
// همین که صفحه با اینترنت باز شد، همهٔ طبقه‌های کارشناس (سه‌تا سه‌تا) روی گوشی ذخیره می‌شوند
var PRE = { busy: false, done: 0, total: 0, run: 0 };
function preload(list) {
  if (!list.length || navigator.onLine === false || !S.init) return;
  var run = ++PRE.run, names = list.map(function (f) { return f.name; }), pid = S.init.pid;
  PRE.busy = true; PRE.done = 0; PRE.total = names.length; setNet(NET.online);
  (function next() {
    if (run !== PRE.run) return;  // کارشناس یا دوره عوض شد
    var part = names.slice(PRE.done, PRE.done + 3);
    if (!part.length) {
      PRE.busy = false; setNet(true);
      fetchAps();
      toast('✓ همهٔ اتاق‌های هتل روی گوشی ذخیره شد؛ بدون اینترنت هم باز می‌شود', 3500);
      return;
    }
    api('floors', { names: part, from: 0, to: 9999999, pid: pid }).then(function (map) {
      if (run !== PRE.run) return;
      Object.keys(map).forEach(function (n) {
        cacheSet(n, map[n]);
        if (n === S.floor && S.shown !== n) { S.rooms = view(map[n], n); render(); }  // طبقه‌ای که منتظرش بود
      });
      PRE.done += part.length; setNet(true); next();
    }, function (e) {
      if (run !== PRE.run) return;
      PRE.busy = false; setNet(!!e.server);  // با وصل شدن دوباره ادامه پیدا می‌کند
    });
  })();
}
function missingFloors() {
  return S.init ? S.init.floors.filter(function (f) { return !cacheGet(f.name); }) : [];
}
window.addEventListener('online', function () {
  if (!S.init || S.me === null || S.me === undefined) return;
  if (S.apView) loadAps();
  else if (S.floor && S.shown !== S.floor) loadFloor(S.floor);
  if (!PRE.busy && missingFloors().length) preload(allFloorsOrdered(S.floor));
});

function start(d) {
  S.init = d; S.people = d.people || []; el('sub').textContent = d.label || '';
  mem('rc_init', JSON.stringify(d));
  cleanCache();
  // بار اول: کارشناس از روی کد شخصی خودش شناخته می‌شود (مدیر: همهٔ طبقه‌ها)
  var me = mem('rc_me');
  if (me === null || (me !== '' && !findPerson(me))) me = findPerson(d.me) ? d.me : (d.admin ? '' : null);
  if (me !== null) choose(me); else pickName();
  sync();
}
// اول دادهٔ ذخیره‌شده روی گوشی نشان داده می‌شود (بدون اینترنت هم)، بعد نسخهٔ تازه از شیت
function boot() {
  if (!TOKEN) { askToken(); return; }
  var d = memJson('rc_init', null);
  if (d) start(d);
  api('init').then(function (fresh) {
    // اگر دوره عوض شده یا اطلاعات تغییر کرده، صفحه با دادهٔ تازه ساخته می‌شود
    if (!d || JSON.stringify(fresh) !== JSON.stringify(d)) {
      if (d && fresh.pid === d.pid) { S.init = fresh; S.people = fresh.people || []; mem('rc_init', JSON.stringify(fresh)); if (S.floor) loadFloor(S.floor); }
      else start(fresh);
    }
  }, function (e) {
    if (e.auth) return;
    if (!d) el('main').innerHTML = '<div class="msg">' + (e.server ? esc(e.message) : 'بارگذاری نشد. اولین بار باید با اینترنت باز شود.') + '</div>';
    else setNet(!!e.server);
  });
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (r) { r.update(); }).catch(function () {});
boot();

function findPerson(name) { return S.people.filter(function (p) { return p.name === name; })[0] || null; }

function pickName() {
  var h = '<p>نام خودت را انتخاب کن:</p><div class="pick">';
  S.people.forEach(function (p) {
    var range = p.from && p.to < 9999999 ? '<small>' + p.from + ' تا ' + p.to + '</small>' : '';
    h += '<button data-me="' + esc(p.name) + '">' + esc(p.name) + range + '</button>';
  });
  h += '<button data-me="">همهٔ طبقه‌ها</button></div>';
  el('main').innerHTML = h; el('prog').style.width = '0';
  el('nav').innerHTML = ''; el('sub').textContent = S.init.label || '';
}
function myFloors() {
  if (!S.me) return S.init.floors;
  return S.init.floors.filter(function (f) { return S.from <= f.lastRoom && S.to >= f.firstRoom; });
}
function choose(me) {
  S.me = me; mem('rc_me', me);
  var p = findPerson(me);
  S.from = p ? p.from : 0; S.to = p ? p.to : 9999999;
  var fl = myFloors(), last = mem('rc_floor');
  var f = fl.filter(function (x) { return x.name === last; })[0] || fl[0];
  if (!f) { el('nav').innerHTML = ''; el('main').innerHTML = '<div class="msg">این دوره طبقه‌ای به نام شما ثبت نشده.</div><button class="who" data-who="1">تغییر نام</button>'; return; }
  loadFloor(f.name);
  preload(allFloorsOrdered(f.name));
}
function loadFloor(name) {
  S.apView = false;
  S.floor = name; S.shown = null; mem('rc_floor', name);
  var cached = cacheGet(name);
  renderNav();  // دکمهٔ بازگشت و طبقه‌ها همیشه هست، حتی وقتی طبقه هنوز نیامده
  if (cached) { S.rooms = view(cached, name); render(); window.scrollTo(0, 0); }
  else el('main').innerHTML = '<div class="msg">در حال بارگذاری ' + esc(name) + '…</div>';
  api('floor', { name: name, from: 0, to: 9999999, pid: S.init.pid }).then(function (rows) {
    cacheSet(name, rows);
    if (!qLoad().length) setNet(true);
    if (S.floor !== name) return;
    var fresh = view(rows, name), a = document.activeElement;
    if (JSON.stringify(fresh) === JSON.stringify(S.rooms)) return;
    if (cached && a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) return;  // وسط تایپ صفحه عوض نشود
    S.rooms = fresh; render(); if (!cached) window.scrollTo(0, 0);
  }, function (e) {
    if (e.auth) return;
    setNet(!!e.server);
    if (!cached && S.floor === name) el('main').innerHTML = '<div class="msg">' + (e.server ? esc(e.message) : 'اینترنت وصل نیست و ' + esc(name) + ' هنوز روی گوشی ذخیره نشده.<br>با وصل شدن اینترنت دوباره بزنید.') + '</div>';
  });
}
// ---------- لیست اکسس پوینت‌ها (از لیست دائمی فایل اصلی؛ روی گوشی هم ذخیره می‌شود) ----------
function apsKey() { return 'rc_aps'; }
function fetchAps() {
  return api('aps').then(function (list) { mem(apsKey(), JSON.stringify(list)); return list; });
}
function loadAps() {
  S.apView = true; S.shown = null;
  renderNav(); window.scrollTo(0, 0);
  el('prog').style.width = '0';
  el('sub').innerHTML = esc((S.me ? S.me + ' | ' : '') + 'اکسس پوینت‌ها') + (S.init.label ? '<br>' + esc(S.init.label) : '');
  var cached = memJson(apsKey(), null);
  if (cached) renderAps(cached);
  else el('main').innerHTML = '<div class="msg">در حال بارگذاری لیست اکسس پوینت‌ها…</div>';
  fetchAps().then(function (list) { if (!S.apView) return; if (el('apq')) { S.aps = list; apFilter(); } else renderAps(list); }, function (e) {
    if (e.auth) return;
    setNet(!!e.server);
    if (!cached && S.apView) el('main').innerHTML = '<div class="msg">' + (e.server ? esc(e.message) : 'اینترنت وصل نیست و لیست اکسس پوینت‌ها هنوز روی گوشی ذخیره نشده.') + '</div>';
  });
}
function renderAps(list) {
  var q = (el('apq') && el('apq').value) || '';
  var h = '<input id="apq" class="apq" placeholder="جستجو: شماره اتاق، طبقه یا MAC" value="' + esc(q) + '" autocomplete="off">';
  h += '<div class="apcount">' + list.length + ' اتاق دارای اکسس پوینت' + (list.filter(function (a) { return !a.mac; }).length ? ' | ' + list.filter(function (a) { return !a.mac; }).length + ' اتاق بدون MAC' : '') + '</div><div id="aplist"></div>';
  el('main').innerHTML = h;
  S.aps = list; apFilter();
  el('apq').addEventListener('input', apFilter);
}
function apFilter() {
  var q = String(el('apq').value || '').trim().toUpperCase().replace(/[-.\s]/g, ':');
  var list = (S.aps || []).filter(function (a) {
    return !q || String(a.room).indexOf(q) >= 0 || String(a.mac).toUpperCase().indexOf(q) >= 0 || String(a.floor) === q;
  });
  var h = '', last = null;
  list.forEach(function (a) {
    if (a.floor !== last) { h += '<div class="apfloor">طبقه ' + esc(a.floor) + '</div>'; last = a.floor; }
    h += '<div class="aprow"><span class="aproom">' + esc(a.room) + '</span><span class="apmac" dir="ltr">' + (a.mac ? esc(a.mac) : '<i>MAC ثبت نشده</i>') + '</span>' +
      '<span class="apmeta">' + esc([a.date, a.who].filter(Boolean).join(' | ')) + '</span></div>';
  });
  el('aplist').innerHTML = h || '<div class="msg">چیزی پیدا نشد.</div>';
}
function status(r) {
  if (r.note === GUEST) return ['guest', 'مهمان دارد'];
  if (r.note === OOS) return ['oos', OOS];
  if (r.note && r.note !== NO_GUEST) return ['defect', 'نقص'];
  var n = r.items.filter(Boolean).length;
  if (n === 7) return ['done', 'چک شد'];
  return n ? ['part', 'ناقص'] : ['', 'مانده'];
}
function card(i) {
  var r = S.rooms[i], s = status(r), h = '';
  h += '<div class="room ' + s[0] + '" id="r' + i + '"><div class="top"><span class="num">' + esc(r.room) + '</span><span class="st">' + s[1] + '</span></div>';
  var c = (S.init.carry || {})[r.room];
  if (c) h += '<div class="carry' + (c.d ? ' d' : '') + '">' + (c.m ? '⚠ ' + c.m + ' دوره چک نشده' : 'نقص دورهٔ قبل: ' + esc(c.d)) + '</div>';
  h += '<div class="grid">';
  r.items.forEach(function (v, k) { h += '<button class="t' + (v ? ' on' : '') + '" data-i="' + i + '" data-k="' + k + '">' + LABELS[k] + '</button>'; });
  h += '<button class="t' + (r.ap ? ' on' : '') + '" data-i="' + i + '" data-k="ap">AP</button></div>';
  h += '<div class="acts"><button class="big all" data-i="' + i + '" data-a="all">همه ✓</button><button class="big gst" data-i="' + i + '" data-a="guest">مهمان دارد</button><button class="big oosb" data-i="' + i + '" data-a="oos">خارج از سرویس</button></div>';
  var note = (r.note === GUEST || r.note === NO_GUEST || r.note === OOS) ? '' : r.note;
  h += '<textarea data-i="' + i + '" dir="rtl" placeholder="توضیحات و نواقص (اختیاری)">' + esc(note) + '</textarea>';
  if (r.ap) h += '<div class="macbox"><label>MAC اکسس پوینت</label><input class="mac" id="mac' + i + '" data-i="' + i + '" dir="ltr" autocomplete="off" autocapitalize="characters" placeholder="AA:BB:CC:DD:EE:FF" value="' + esc(r.mac || '') + '"></div>';
  h += '</div>';
  return h;
}
// دکمهٔ بازگشت و طبقه‌ها داخل نوار بالا (چسبیده به بالای صفحه) تا موقع پایین رفتن هم دیده شوند
function renderNav() {
  var nav = '<button class="back" data-who="1">→ بازگشت</button><div class="chips">';
  myFloors().forEach(function (f) { nav += '<button class="chip' + (!S.apView && f.name === S.floor ? ' on' : '') + '" data-f="' + esc(f.name) + '">' + esc(f.name) + '</button>'; });
  nav += '<button class="chip apchip' + (S.apView ? ' on' : '') + '" data-aps="1">اکسس پوینت‌ها</button>';
  el('nav').innerHTML = nav + '</div>';
  var on = document.querySelector('.chip.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function render() {
  renderNav(); S.shown = S.floor;
  var h = '';
  h += '<div id="notice"></div>';
  S.rooms.forEach(function (r, i) { h += card(i); });
  el('main').innerHTML = h; progress();
}
function redraw(i) { var c = el('r' + i); if (c) c.outerHTML = card(i); progress(); }
// بالای طبقه: اتاق‌هایی که این دوره هنوز چک نشده‌اند (وضعیت «مانده» یا «مهمان دارد»)، و از بین آن‌ها اتاق‌های پیگیری دورهٔ قبل
function notice() {
  var n = el('notice'); if (!n) return;
  // «مهمان دارد» هم چک‌نشده حساب می‌شود (مثل گزارش‌ها)
  var left = S.rooms.filter(function (r) { var st = status(r)[0]; return st === '' || st === 'guest'; });
  var carry = left.filter(function (r) { return (S.init.carry || {})[r.room]; });
  var rooms = function (a) { return a.map(function (r) { return esc(r.room); }).join('، '); };
  n.className = left.length ? 'notice' : '';
  n.innerHTML = left.length ? 'هنوز چک نشده (' + left.length + '): ' + rooms(left) +
    (carry.length ? '<br><b>از دورهٔ قبل پیگیری شود: ' + rooms(carry) + '</b>' : '') : '';
}
function progress() {
  notice();
  var done = S.rooms.filter(function (r) { return status(r)[0] !== ''; }).length;
  el('prog').style.width = (S.rooms.length ? Math.round(100 * done / S.rooms.length) : 0) + '%';
  // خط اول: نام و پیشرفت طبقه؛ خط دوم: نام و تاریخ دوره
  el('sub').innerHTML = esc((S.me ? S.me + ' | ' : '') + S.floor + ': ' + done + ' از ' + S.rooms.length) +
    (S.init.label ? '<br>' + esc(S.init.label) : '');
}
// تغییر در صف گوشی (جایگزین تغییر قبلی همان خانه) + ذخیرهٔ طبقه روی گوشی + ارسال
function save(i, field, value) {
  var r = S.rooms[i], key = S.init.pid + '|' + S.floor + '|' + r.row + '|' + field;
  var q = qLoad().filter(function (x) { return x.key !== key; });
  q.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), key: key, pid: S.init.pid, floor: S.floor,
    row: r.row, room: r.room, field: field, value: value, who: S.me || '' });
  qStore(q);
  cacheMerge(S.floor, S.rooms);
  setNet(NET.online && navigator.onLine !== false);
  sync();
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-tok')) {
    var raw = el('tok').value || '', km = raw.match(/[?&]k=([A-Za-z0-9]+)/);
    var v = (km ? km[1] : raw).replace(/[^A-Za-z0-9]/g, '');  // کل لینک هم قبول است
    if (!v) return;
    TOKEN = v; mem('rc_k', v); mem('rc_init', null); mem('rc_me', null);
    el('main').innerHTML = '<div class="msg">در حال بارگذاری…</div>'; boot(); return;
  }
  if (b.hasAttribute('data-me')) { choose(b.getAttribute('data-me')); return; }
  if (b.hasAttribute('data-who')) { pickName(); return; }
  if (b.hasAttribute('data-f')) { loadFloor(b.getAttribute('data-f')); return; }
  if (b.hasAttribute('data-aps')) { loadAps(); return; }
  if (!b.hasAttribute('data-i')) return;
  var i = +b.getAttribute('data-i'), r = S.rooms[i];
  var k = b.getAttribute('data-k'), a = b.getAttribute('data-a');
  if (k === 'ap') {
    // AP و MAC در لیست دائمی می‌مانند؛ برداشتن تیک یعنی حذف از لیست، پس اول تأیید گرفته می‌شود
    if (r.ap && !confirm('اکسس پوینت اتاق ' + r.room + (r.mac ? ' (MAC: ' + r.mac + ')' : '') + ' از لیست دائمی حذف شود؟')) return;
    r.ap = !r.ap; if (!r.ap) r.mac = '';
    save(i, 'ap', r.ap);
    redraw(i);
    if (r.ap) { var m = el('mac' + i); if (m) m.focus(); }
    return;
  }
  else if (k !== null) { k = +k; r.items[k] = !r.items[k]; save(i, 'i' + k, r.items[k]); }
  else if (a === 'all') {
    var v = !r.items.every(Boolean);
    r.items = r.items.map(function () { return v; });
    if (v && (r.note === GUEST || r.note === OOS)) { r.note = ''; save(i, 'note', ''); }
    save(i, 'all', v);
  } else if (a === 'guest') { r.note = r.note === GUEST ? '' : GUEST; save(i, 'note', r.note); }
  else if (a === 'oos') { r.note = r.note === OOS ? '' : OOS; save(i, 'note', r.note); }
  redraw(i);
});
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.hasAttribute('data-i')) return;
  var i = +t.getAttribute('data-i'), r = S.rooms[i];
  if (!r) return;
  if (t.tagName === 'TEXTAREA') { r.note = t.value.trim(); save(i, 'note', r.note); redraw(i); }
  else if (t.classList.contains('mac')) {
    var raw = t.value.trim(), mac = raw ? normMac(raw) : '';
    if (mac === null) { toast('MAC باید ۱۲ کاراکتر باشد، مثل AA:BB:CC:DD:EE:FF', 4000); t.value = r.mac || ''; return; }
    r.mac = mac; r.ap = true; save(i, 'mac', mac); redraw(i);
    toast(mac ? 'MAC ثبت شد' : 'MAC پاک شد');
  }
});

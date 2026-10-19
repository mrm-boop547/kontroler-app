/* Карта контролера · MVP v0.1
   Усі дані зберігаються лише на цьому телефоні (IndexedDB). */
(function () {
  'use strict';
  var VERSION = '0.4.2';

  /* ---------- довідники ---------- */
  var ST = {
    g: { label: 'Доступ завжди', short: 'Завжди', color: '#16A34A' },
    y: { label: 'При власнику', short: 'Власник', color: '#F59E0B' },
    r: { label: 'Нема доступу', short: 'Нема', color: '#DC2626' },
    n: { label: 'Не живуть', short: 'Не живуть', color: '#FFFFFF' }
  };
  var ST_ORDER = ['g', 'y', 'r', 'n'];
  var TAGS = [['dog', 'Собака'], ['eve', 'Після 18:00'], ['wk', 'Вихідні'], ['cam', 'Камера'], ['facade', 'На фасаді'],
    ['call', 'Дзвонити'], ['jur', 'Юридичний'], ['summer', 'Лише влітку'], ['owner', 'Тільки з власником']];
  var TAGNAME = {}; TAGS.forEach(function (t) { TAGNAME[t[0]] = t[1]; });
  var RESULTS = [['ok', 'Зчитано', 'показник внесено'], ['none', 'Не застав', 'повернутись пізніше'],
    ['blocked', 'Не відкрили', 'були вдома, не пустили'], ['empty', 'Не живуть', 'прибрати з обходу']];
  var RESNAME = {}; RESULTS.forEach(function (r) { RESNAME[r[0]] = r[1]; });
  var PLACEMENTS = ['', 'В середині житлового будинку', 'В підсобному приміщенні', 'В гаражі', 'В квартирі', 'В щиту сходових клітин',
    'В щитовій підвального приміщення', 'На опорі в ящику', 'На внутрішній стороні паркану', 'На фасаді будинку',
    'На тильній стороні будинку', 'На підсобному приміщенні'];
  var NOTES = ['', 'Самовільне підключення', 'Відсутня/порушена пломба ДП на лічильнику', 'Відсутня/порушена пломба постачальника на клемній',
    'Відсутня/порушена пломба постачальника на ввідному', 'Не працює 1-ф лічильник', 'Не працює 3-ф лічильник',
    'Показники зняті в присутності неповнолітніх', 'Показник зі слів споживача', 'Показник повідомили по телефону',
    'Показники повідомили сусіди', 'Проблемний споживач (скарга)', 'Відключений на опорі', 'Відключений на лічильнику'];
  var ZKO = ['', 'Без зауважень', 'Пошкоджено корпус', 'Розбите скло', 'Пошкоджена клемна кришка', 'Пошкоджена шафа обліку'];
  var SEALS = ['', 'Без зауважень', 'Відсутня пломба', 'Пошкоджена пломба'];
  var OFFICIAL = [
    ['fio', 'Абонент', 'text'], ['address', 'Адреса', 'text'], ['phone', 'Телефон', 'tel'], ['serial', 'Серійний номер', 'text'],
    ['mtype', 'Тип', 'text'], ['instStatus', 'Статус установки', 'text'], ['placement', 'Розміщення', 'select', PLACEMENTS],
    ['devicePlace', 'Місце прилада', 'text'], ['alarm', 'Сигнал тривоги на лічильнику', 'select', ['', 'Ні', 'Так']],
    ['readings', 'Показники', 'info'], ['placement2', 'Розміщення (уточнити)', 'select', PLACEMENTS], ['noteSel', 'Примітка', 'select', NOTES],
    ['zko', 'ЗКО', 'select', ZKO], ['seals', 'Пломби', 'select', SEALS], ['avOld', 'Номінал автомата (старе значення)', 'text'],
    ['av', 'Номінал автомата', 'text'], ['feederOld', "Пофідерна прив'язка (старе значення)", 'text'],
    ['feeder', "Пофідерна прив'язка", 'text'], ['sealStatuses', 'Статуси пломб', 'textarea'], ['visitCode', 'Код візиту', 'text']
  ];
  var FLAGNAME = { no_street: 'Немає вулиці', no_house: 'Немає номера', dup: 'Можливий дубль', no_village: 'Немає села',
    village_guess: 'Село визначено автоматично', village_check: 'Перевірити село' };
  var QUEUE_FLAGS = ['no_street', 'no_house', 'dup', 'no_village'];

  /* ---------- утиліти ---------- */
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function dist(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fdist(m) { return m < 1000 ? Math.round(m) + ' м' : (m / 1000).toFixed(1).replace('.', ',') + ' км'; }
  function cycleKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  var MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  function monthName() { return MONTHS[new Date().getMonth()]; }
  function dt(ts) { var d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }
  function tm(ts) { var d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200); }
  function addr(p) { return [p.street, p.house].filter(Boolean).join(', ') || (p.note ? p.note.slice(0, 40) : 'Без адреси'); }
  function icon(name, size, sw) {
    size = size || 20; sw = sw || 2.2;
    var P = {
      back: '<path d="M15 18l-6-6 6-6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
      gear: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
      down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', go: '<path d="M7 17L17 7M9 7h8v8"/>',
      check: '<path d="M5 12l5 5 9-10"/>', nav: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
      phone: '<path d="M5 4h4l2 5-3 2a11 11 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z"/>',
      home: '<path d="M4 11l8-7 8 7v9H4z"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
      list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', village: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/>',
      skip: '<path d="M5 5l9 7-9 7zM19 5v14"/>', pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
      locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
      camera: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
      grid: '<path d="M12 3v18M3 12h18"/><rect x="3" y="3" width="18" height="18" rx="4"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  function dotHtml(st) { return '<span class="dot ' + st + '"></span>'; }

  /* ---------- база даних ---------- */
  var db;
  function openDb() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open('kontroler', 2);
      rq.onupgradeneeded = function (e) {
        var d = rq.result;
        if (e.oldVersion < 1) {
          d.createObjectStore('points', { keyPath: 'id' });
          var v = d.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
          v.createIndex('pointId', 'pointId');
          d.createObjectStore('meta', { keyPath: 'k' });
        }
        if (e.oldVersion < 2) {
          var ph = d.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
          ph.createIndex('pointId', 'pointId');
        }
      };
      rq.onsuccess = function () { db = rq.result; res(); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function all(store) { return new Promise(function (res, rej) { var r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function put(store, obj) { return new Promise(function (res, rej) { var tx = db.transaction(store, 'readwrite'); var r = tx.objectStore(store).put(obj); tx.oncomplete = function () { res(r.result); }; tx.onerror = function () { rej(tx.error); }; }); }
  function del(store, key) { return new Promise(function (res, rej) { var tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); }
  function bulkReplace(points, visits, meta) {
    return new Promise(function (res, rej) {
      var tx = db.transaction(['points', 'visits', 'meta'], 'readwrite');
      ['points', 'visits', 'meta'].forEach(function (s) { tx.objectStore(s).clear(); });
      points.forEach(function (p) { tx.objectStore('points').put(p); });
      (visits || []).forEach(function (v) { tx.objectStore('visits').put(v); });
      (meta || []).forEach(function (m) { tx.objectStore('meta').put(m); });
      tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
    });
  }
  function photosOf(pid) {
    return new Promise(function (res) {
      var r = db.transaction('photos').objectStore('photos').index('pointId').getAll(pid);
      r.onsuccess = function () { res(r.result.sort(function (a, b) { return b.ts - a.ts; })); }; r.onerror = function () { res([]); };
    });
  }
  /* стискаємо фото до ~1280 px, JPEG — приблизно 150–250 КБ замість 4–8 МБ */
  function compress(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('blob')); }, 'image/jpeg', 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }
  function blobToData(b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(b); }); }
  function dataToBlob(d) { var p = d.split(','), bin = atob(p[1]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: 'image/jpeg' }); }
  function setMeta(k, v) { S.meta[k] = v; return put('meta', { k: k, v: v }); }

  /* ---------- стан ---------- */
  var S = { points: new Map(), visits: [], meta: {}, pos: null, route: null, sel: null, filter: null, skipped: {}, moved: false };
  function village() { return S.meta.village || null; }
  function villagePoints(v) { var out = []; S.points.forEach(function (p) { if (p.village === (v || village())) out.push(p); }); return out; }
  function villages() {
    var c = {}; S.points.forEach(function (p) { var k = p.village || 'Без села'; c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) { return { name: k, n: c[k] }; });
  }
  function visitsOf(pid) { return S.visits.filter(function (v) { return v.pointId === pid; }).sort(function (a, b) { return b.ts - a.ts; }); }
  var cycleCache = null;
  function cycleMap() {
    if (cycleCache) return cycleCache;
    var ck = cycleKey(), m = {};
    S.visits.forEach(function (v) { if (cycleKey(new Date(v.ts)) === ck) { if (!m[v.pointId] || m[v.pointId].ts < v.ts) m[v.pointId] = v; } });
    return (cycleCache = m);
  }
  function invalidate() { cycleCache = null; }
  function doneThisCycle(p) { var v = cycleMap()[p.id]; return !!(v && (v.result === 'ok' || v.result === 'empty')); }
  function readThisCycle(p) { var v = cycleMap()[p.id]; return !!(v && v.result === 'ok'); }

  /* ---------- GPS ---------- */
  var watchId = null, gpsListeners = [];
  function startGps() {
    if (watchId !== null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(function (pos) {
      S.pos = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, ts: Date.now() };
      gpsListeners.forEach(function (f) { f(S.pos); });
    }, function (err) { if (err.code === 1) toast('Дозвольте доступ до геолокації'); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function onGps(f) { gpsListeners.push(f); }
  function offGps() { gpsListeners = []; }

  /* ---------- маршрут ---------- */
  /* слайдер кількості адрес: 10…150, крайнє праве положення = «Усі» */
  var LIM_MAX = 160;
  function limLabel(n) { return n >= 9999 || n >= LIM_MAX ? 'Усі' : String(n); }
  function sliderHtml(id, n) {
    var v = n >= 9999 ? LIM_MAX : Math.min(LIM_MAX, n);
    return '<div class="sld"><div class="between"><span class="small mute">Скільки адрес</span><b class="sld-val" id="' + id + '-v">' + limLabel(n) + '</b></div>' +
      '<input type="range" class="range" id="' + id + '" min="10" max="' + LIM_MAX + '" step="5" value="' + v + '" style="--p:' + ((v - 10) / (LIM_MAX - 10) * 100) + '%">' +
      '<div class="between small mute"><span>10</span><span>50</span><span>100</span><span>Усі</span></div></div>';
  }
  function bindSlider(id, onSet) {
    var el = $('#' + id) || document.getElementById(id); if (!el) return;
    var upd = function () { var v = +el.value; el.style.setProperty('--p', ((v - 10) / (LIM_MAX - 10) * 100) + '%'); (document.getElementById(id + '-v') || {}).textContent = limLabel(v); return v >= LIM_MAX ? 9999 : v; };
    el.oninput = function () { upd(); };
    el.onchange = function () { onSet(upd()); };
  }
  function setLimit(n) {
    var nc = Object.assign({}, S.meta.routeCfg || {}); nc.limit = n;
    setMeta('dayLimit', n); return setMeta('routeCfg', nc).then(function () { S.route = null; });
  }

  /* ---------- налаштування маршруту ---------- */
  function routeCfg() {
    var c = S.meta.routeCfg || {};
    return { auto: c.auto !== false, limit: c.limit || Number(S.meta.dayLimit) || 40, types: c.types && c.types.length ? c.types : ['g', 'y', 'r'], streets: c.streets || {} };
  }
  /* «вартість» переходу: зміна вулиці дорожча — маршрут іде вздовж вулиці, а не зигзагом через квартал */
  function cost(a, b) { var d = dist(a, b); return a.street && b.street && a.street !== b.street ? d * 1.6 + 40 : d; }
  function computeRoute() {
    var v = village(); if (!v) return null;
    var cfg = routeCfg(), st = cfg.streets[v] || [];
    var all = villagePoints(v).filter(function (p) { return p.status !== 'n' && !doneThisCycle(p); });
    var cand = all.filter(function (p) { return !S.skipped[p.id] && cfg.types.indexOf(p.status) >= 0 && (!st.length || st.indexOf(p.street) >= 0); });
    if (!cfg.auto) return { village: v, ids: [], meters: 0, total: cand.length, off: true };
    if (!cand.length) return { village: v, ids: [], meters: 0, total: 0 };
    var start = S.pos && dist(S.pos, cand[0]) < 30000 ? S.pos : centroid(cand);
    var late = cand.filter(function (p) { return (p.tags || []).indexOf('eve') >= 0; });
    var early = cand.filter(function (p) { return (p.tags || []).indexOf('eve') < 0; });
    var limit = cfg.limit >= 9999 ? cand.length : cfg.limit;
    var lateN = Math.min(late.length, Math.round(limit * 0.25));
    var order = nn(start, early, cost).slice(0, Math.max(1, limit - lateN));
    order = twoOpt(start, order, 300, cost);
    var last = order.length ? order[order.length - 1] : start;
    order = order.concat(nn(last, late, cost).slice(0, Math.max(0, limit - order.length)));
    var m = 0, prev = start;
    order.forEach(function (p) { m += dist(prev, p); prev = p; });
    var r = { village: v, ids: order.map(function (p) { return p.id; }), meters: m, total: cand.length, fromGps: start === S.pos, start: { lat: start.lat, lon: start.lon } };
    r.key = routeKey(r);
    setTimeout(function () { improveRoute(r); }, 0);
    return r;
  }
  function routeKey(r) { return r.start.lat.toFixed(4) + ',' + r.start.lon.toFixed(4) + ':' + r.ids.join(','); }
  function centroid(ps) { var a = 0, b = 0; ps.forEach(function (p) { a += p.lat; b += p.lon; }); return { lat: a / ps.length, lon: b / ps.length }; }
  function nn(start, pts, cf) {
    cf = cf || dist;
    var rest = pts.slice(), out = [], cur = start;
    while (rest.length) {
      var bi = 0, bd = Infinity;
      for (var i = 0; i < rest.length; i++) { var d = cf(cur, rest[i]); if (d < bd) { bd = d; bi = i; } }
      cur = rest.splice(bi, 1)[0]; out.push(cur);
    }
    return out;
  }
  function twoOpt(start, r, ms, cf) {
    cf = cf || dist;
    var t0 = Date.now(), n = r.length, improved = true;
    if (n < 4) return r;
    var P = [start].concat(r);
    while (improved && Date.now() - t0 < ms) {
      improved = false;
      for (var i = 1; i < P.length - 2; i++) {
        for (var k = i + 1; k < P.length - 1; k++) {
          var a = P[i - 1], b = P[i], c = P[k], d = P[k + 1];
          if (cf(a, c) + cf(b, d) < cf(a, b) + cf(c, d) - 0.5) {
            P = P.slice(0, i).concat(P.slice(i, k + 1).reverse(), P.slice(k + 1)); improved = true;
          }
        }
        if (Date.now() - t0 > ms) break;
      }
    }
    return P.slice(1);
  }

  /* ---------- пішохідний маршрут по дорогах (Valhalla, OpenStreetMap) — лише з інтернетом ---------- */
  var VALHALLA = 'https://valhalla1.openstreetmap.de';
  function decode6(str) {
    var idx = 0, lat = 0, lng = 0, out = [];
    while (idx < str.length) {
      var b, sh = 0, res = 0;
      do { b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lat += (res & 1) ? ~(res >> 1) : (res >> 1); sh = 0; res = 0;
      do { b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lng += (res & 1) ? ~(res >> 1) : (res >> 1);
      out.push([lng / 1e6, lat / 1e6]);
    }
    return out;
  }
  function vpost(path, body) {
    var ctl = new AbortController(); setTimeout(function () { ctl.abort(); }, 15000);
    return fetch(VALHALLA + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  function improveRoute(r) {
    if (!navigator.onLine || !r.ids.length || r.walkDone) return;
    var pts = r.ids.map(function (id) { return S.points.get(id); });
    var locs = [r.start].concat(pts).map(function (p) { return { lat: p.lat, lon: p.lon }; });
    var step = locs.length <= 50
      ? vpost('/sources_to_targets', { sources: locs, targets: locs, costing: 'pedestrian' }).then(function (j) {
          var M = j.sources_to_targets;
          var idx = locs.map(function (_, i) { return i; });
          var mc = function (a, b) { var c = M[a][b]; return c && c.distance != null ? c.distance * 1000 : 1e9; };
          var rest = idx.slice(1), order = [], cur = 0;
          while (rest.length) { var bi = 0, bd = Infinity; rest.forEach(function (x, i) { var d = mc(cur, x); if (d < bd) { bd = d; bi = i; } }); cur = rest.splice(bi, 1)[0]; order.push(cur); }
          var P = [0].concat(order), improved = true, t0 = Date.now();
          while (improved && Date.now() - t0 < 400) { improved = false;
            for (var i = 1; i < P.length - 2; i++) for (var k = i + 1; k < P.length - 1; k++) {
              if (mc(P[i - 1], P[k]) + mc(P[i], P[k + 1]) < mc(P[i - 1], P[i]) + mc(P[k], P[k + 1]) - 1) { P = P.slice(0, i).concat(P.slice(i, k + 1).reverse(), P.slice(k + 1)); improved = true; }
            } }
          var late = r.ids.filter(function (id) { return (S.points.get(id).tags || []).indexOf('eve') >= 0; });
          var ids = P.slice(1).map(function (i) { return r.ids[i - 1]; });
          ids = ids.filter(function (id) { return late.indexOf(id) < 0; }).concat(ids.filter(function (id) { return late.indexOf(id) >= 0; }));
          return ids;
        }).catch(function () { return r.ids; })
      : Promise.resolve(r.ids);
    step.then(function (ids) {
      if (S.route !== r) return;
      var seq = [r.start].concat(ids.map(function (id) { return S.points.get(id); }));
      var chunks = [], i = 0;
      while (i < seq.length - 1) { chunks.push(seq.slice(i, Math.min(seq.length, i + 20))); i += 19; }
      var res = [];
      return chunks.reduce(function (pr, c) {
        return pr.then(function () { return new Promise(function (ok) { setTimeout(ok, 1100); }); }).then(function () {
          return vpost('/route', { locations: c.map(function (p) { return { lat: p.lat, lon: p.lon, type: 'break' }; }), costing: 'pedestrian', directions_type: 'none' }).then(function (j) { res.push(j); });
        });
      }, Promise.resolve()).then(function () {
        if (S.route !== r) return;
        var coords = [], meters = 0;
        res.forEach(function (j) { (j.trip.legs || []).forEach(function (l) { coords = coords.concat(decode6(l.shape)); }); meters += (j.trip.summary.length || 0) * 1000; });
        r.ids = ids; r.meters = meters; r.walk = coords; r.walkDone = true; r.key = routeKey(r);
        setMeta('lastWalk', { key: r.key, coords: coords, meters: meters });
        if (location.hash === '#map') { updateMap(); renderSheet(); }
      });
    }).catch(function () { if (!S.walkWarned) { S.walkWarned = 1; toast('Пішохідний маршрут недоступний, показано напряму'); } });
  }
  function routeCfgSheet() {
    var c = routeCfg(), v = village(), T = { auto: c.auto, limit: c.limit, types: c.types.slice(), streets: (c.streets[v] || []).slice() };
    var streets = {}; villagePoints(v).forEach(function (p) { if (p.status !== 'n' && p.street) streets[p.street] = (streets[p.street] || 0) + 1; });
    var names = Object.keys(streets).sort(function (a, b) { return streets[b] - streets[a]; });
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov';
    var draw = function () {
      var same = function (a, b) { return a.slice().sort().join() === b.slice().sort().join(); };
      var chip = function (act, val, label, on) { return '<button class="chip fchip' + (on ? ' on' : '') + '" data-rc="' + act + '" data-v="' + esc(val) + '">' + label + '</button>'; };
      ov.innerHTML = '<div class="pk-sheet"><div class="pk-grip"></div>' +
        '<div class="between" style="padding:0 4px"><div class="h2">Маршрут на сьогодні</div><button class="iconbtn" data-rc="close" aria-label="Закрити" style="box-shadow:none;background:#F1F1F3;width:40px;height:40px">' + icon('close', 18, 2.4) + '</button></div>' +
        '<div class="pk-list" style="gap:14px">' +
        '<button class="pk-row' + (T.auto ? ' on' : '') + '" data-rc="auto"><span>Будувати маршрут автоматично</span><span class="sw' + (T.auto ? ' on' : '') + '"></span></button>' +
        '<div class="col" style="gap:8px"><div class="small mute">Кого обходимо</div><div class="tags">' +
          ['g', 'y', 'r'].map(function (s) { return '<button class="chip fchip' + (T.types.indexOf(s) >= 0 ? ' on' : '') + '" data-rc="type" data-v="' + s + '">' + dotHtml(s) + ST[s].short + '</button>'; }).join('') + '</div></div>' +
        sliderHtml('rc-lim', T.limit) +
        '<div class="col" style="gap:8px"><div class="small mute">Вулиці (сектор)</div><div class="tags">' + chip('street', '', 'Усі вулиці', !T.streets.length) +
          names.map(function (n) { return chip('street', n, esc(n) + ' <span style="opacity:.6">' + streets[n] + '</span>', T.streets.indexOf(n) >= 0); }).join('') + '</div></div>' +
        '</div><button class="btn" data-rc="apply">Побудувати маршрут</button></div>';
    };
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rc]'); if (e.target === ov) return closeSheet(); if (!b) return;
      var a = b.getAttribute('data-rc'), val = b.getAttribute('data-v');
      if (a === 'close') return closeSheet();
      if (a === 'auto') T.auto = !T.auto;
      if (a === 'preset') T.types = val.split(',');
      if (a === 'type') { var i = T.types.indexOf(val); if (i >= 0) { if (T.types.length > 1) T.types.splice(i, 1); } else T.types.push(val); }
      if (a === 'limit') T.limit = +val;
      if (a === 'street') { if (!val) T.streets = []; else { var j = T.streets.indexOf(val); if (j >= 0) T.streets.splice(j, 1); else T.streets.push(val); } }
      if (a === 'apply') {
        var nc = Object.assign({}, S.meta.routeCfg || {}); nc.auto = T.auto; nc.limit = T.limit; nc.types = T.types;
        nc.streets = Object.assign({}, nc.streets || {}); nc.streets[v] = T.streets;
        setMeta('routeCfg', nc).then(function () { closeSheet(); S.route = computeRoute(); S.sel = S.route.ids[0] || S.sel; renderMap.fitNext = true; render(); });
        return;
      }
      var y = ov.querySelector('.pk-list').scrollTop; draw(); ov.querySelector('.pk-list').scrollTop = y; bindSlider('rc-lim', function (n) { T.limit = n; });
    });
    draw(); document.body.appendChild(ov); bindSlider('rc-lim', function (n) { T.limit = n; }); requestAnimationFrame(function () { ov.classList.add('show'); });
  }
  function ensureRoute(force) {
    if (force || !S.route || S.route.village !== village()) S.route = computeRoute();
    return S.route;
  }
  function routeIndex(pid) { var r = S.route; if (!r) return -1; return r.ids.indexOf(pid); }

  /* ---------- маршрутизація екранів ---------- */
  var app;
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function render() {
    var h = (location.hash || '#home').slice(1).split('/');
    var name = h[0] || 'home', arg = h[1] ? decodeURIComponent(h[1]) : null;
    offGps();
    showMap(name === 'map' || name === 'bind' || name === 'all');
    if (name !== 'map' && name !== 'all') cancelAdd(true);
    if (!S.points.size && name !== 'settings') return renderEmpty();
    var f = { home: renderHome, map: renderMap, all: renderAll, card: renderCard, visit: renderVisit, bind: renderBind, villages: renderVillages,
      list: renderList, queue: renderQueue, settings: renderSettings }[name] || renderHome;
    f(arg);
    window.scrollTo(0, 0);
  }
  function tabs(active) {
    var t = [['home', 'Головна', 'home'], ['map', 'Обхід', 'map'], ['all', 'Мітки', 'pin'], ['villages', 'Села', 'village']];
    return '<nav class="tabs">' + t.map(function (x) {
      var on = x[0] === active;
      return '<a href="#' + x[0] + '" class="' + (on ? 'on' : '') + '">' + icon(x[2], on ? 18 : 20) + x[1] + '</a>';
    }).join('') + '</nav>';
  }

  /* ---------- порожній стан / імпорт ---------- */
  function renderEmpty() {
    app.innerHTML = '<div class="screen"><div class="empty">' +
      '<h1 class="h1">Карта контролера</h1>' +
      '<p class="mute" style="margin:0;font-weight:600;line-height:1.5">Даних на цьому телефоні ще немає. Завантажте файл з точками (points.json) або резервну копію.</p>' +
      '<label class="btn" for="imp">Завантажити файл</label><input id="imp" type="file" accept="application/json,application/octet-stream,text/plain,.json" hidden>' +
      '<div class="small mute">Версія ' + VERSION + '. Усі дані зберігаються лише на цьому пристрої.</div>' +
      '</div></div>';
    $('#imp').onchange = importFile;
  }
  function importFile(e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var data; try { data = JSON.parse(rd.result); } catch (x) { return toast('Файл пошкоджений'); }
      var pts = data.points || [], vis = data.visits || [], meta = data.meta || [];
      if (!pts.length) return toast('У файлі немає точок');
      if (S.points.size && !confirm('Замінити всі дані на телефоні даними з файлу? (' + pts.length + ' точок)')) {
        if (!confirm('Тоді лише оновити назви з MAPS.ME, не чіпаючи ваших змін і візитів?')) return;
        var n = 0, tx = db.transaction('points', 'readwrite');
        pts.forEach(function (q) { var p = S.points.get(q.id); if (p && q.orig && p.orig !== q.orig) { p.orig = q.orig; tx.objectStore('points').put(p); n++; } });
        tx.oncomplete = function () { toast('Оновлено назв: ' + n); render(); };
        return;
      }
      bulkReplace(pts, vis, meta).then(function () {
        var ph = data.photos || []; if (!ph.length) return;
        return new Promise(function (res) {
          var tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').clear();
          ph.forEach(function (x) { tx.objectStore('photos').put({ pointId: x.pointId, ts: x.ts, kind: x.kind, blob: dataToBlob(x.data) }); });
          tx.oncomplete = res; tx.onerror = res;
        });
      }).then(load).then(function () {
        if (!S.meta.village) { var v = villages()[0]; setMeta('village', v && v.name !== 'Без села' ? v.name : null); }
        toast('Завантажено ' + fmt(pts.length) + ' точок'); go('#home');
      });
    };
    rd.readAsText(f);
  }
  function exportBackup() {
    toast('Готую копію…');
    all('photos').then(function (ph) {
      return Promise.all(ph.map(function (x) { return blobToData(x.blob).then(function (d) { return { pointId: x.pointId, ts: x.ts, kind: x.kind, data: d }; }); }));
    }).then(function (photos) {
    var meta = Object.keys(S.meta).map(function (k) { return { k: k, v: S.meta[k] }; });
    var data = { version: 2, app: VERSION, exported: new Date().toISOString(), points: Array.from(S.points.values()), visits: S.visits, meta: meta, photos: photos };
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'kontroler-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
    setMeta('lastBackup', Date.now()); toast('Резервну копію збережено' + (photos.length ? ' (фото: ' + photos.length + ')' : ''));
    });
  }
  function exportKml() {
    var col = { g: 'ff4aa316', y: 'ff0b9ef5', r: 'ff2626dc', n: 'ffaaa1a1' };
    var out = ['<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Карта контролера</name>'];
    ST_ORDER.forEach(function (s) { out.push('<Style id="' + s + '"><IconStyle><color>' + col[s] + '</color></IconStyle></Style>'); });
    var by = {}; S.points.forEach(function (p) { var k = p.village || 'Без села'; (by[k] = by[k] || []).push(p); });
    Object.keys(by).forEach(function (v) {
      out.push('<Folder><name>' + esc(v) + '</name>');
      by[v].forEach(function (p) {
        out.push('<Placemark><name>' + esc(addr(p)) + '</name><description>' + esc([ST[p.status].label].concat((p.tags || []).map(function (t) { return TAGNAME[t]; }), p.note ? [p.note] : []).join('; ')) +
          '</description><styleUrl>#' + p.status + '</styleUrl><Point><coordinates>' + p.lon + ',' + p.lat + '</coordinates></Point></Placemark>');
      });
      out.push('</Folder>');
    });
    out.push('</Document></kml>');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('')], { type: 'application/vnd.google-earth.kml+xml' }));
    a.download = 'kontroler-' + new Date().toISOString().slice(0, 10) + '.kml'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Головна ---------- */
  /* ---------- власне вікно вибору замість системного списку ---------- */
  function openSheet(title, opts, current, onPick) {
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov';
    ov.innerHTML = '<div class="pk-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="pk-grip"></div>' +
      '<div class="between" style="padding:0 4px"><div class="h2">' + esc(title) + '</div><button class="iconbtn" data-pk="close" aria-label="Закрити" style="box-shadow:none;background:#F1F1F3;width:40px;height:40px">' + icon('close', 18, 2.4) + '</button></div>' +
      '<div class="pk-list">' + opts.map(function (o, i) {
        var v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? (o || 'Не вибрано') : o.l, sub = typeof o === 'string' ? '' : (o.sub || '');
        var on = v === current;
        return '<button class="pk-row' + (on ? ' on' : '') + '" data-pk="' + i + '"><span class="col" style="gap:2px;min-width:0"><span>' + esc(l) + '</span>' + (sub ? '<span class="small" style="opacity:.6">' + esc(sub) + '</span>' : '') + '</span>' +
          (on ? '<span class="pk-check">' + icon('check', 16, 3) + '</span>' : '<span class="pk-radio"></span>') + '</button>';
      }).join('') + '</div></div>';
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pk]');
      if (e.target === ov || (b && b.getAttribute('data-pk') === 'close')) return closeSheet();
      if (b) { var o = opts[+b.getAttribute('data-pk')]; closeSheet(); onPick(typeof o === 'string' ? o : o.v); }
    });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
  }
  function closeSheet() { var o = $('#picker'); if (o) o.remove(); }
  function pickBtn(field, val, ph) {
    return '<button type="button" class="input selbtn" data-act="pick" data-f="' + field + '" data-val="' + esc(val || '') + '"><span class="' + (val ? '' : 'mute') + '">' + esc(val || ph || 'Вибрати') + '</span>' + icon('down', 18, 2.4) + '</button>';
  }
  var PICK_OPTS = { vm: [{ v: 'зчитано', l: 'Зчитано з лічильника' }, { v: 'зі слів споживача', l: 'Зі слів споживача' }, { v: 'по телефону', l: 'Повідомили по телефону' }, { v: 'сусіди', l: 'Повідомили сусіди' }] };
  OFFICIAL.forEach(function (o) { if (o[2] === 'select') PICK_OPTS[o[0]] = o[3]; });
  var PICK_TITLE = { vm: 'Як отримано показник' };
  OFFICIAL.forEach(function (o) { PICK_TITLE[o[0]] = o[1]; });
  function doPick(el) {
    var f = el.getAttribute('data-f'), opts = PICK_OPTS[f];
    openSheet(PICK_TITLE[f] || 'Вибір', opts, el.getAttribute('data-val'), function (v) {
      el.setAttribute('data-val', v);
      var lab = v; opts.forEach(function (o) { if (typeof o !== 'string' && o.v === v) lab = o.l; });
      el.querySelector('span').textContent = lab || 'Не вибрано'; el.querySelector('span').className = v ? '' : 'mute';
    });
  }
  function villageSelect() {
    var v = village();
    return '<button type="button" class="pill" data-act="pickVillageSheet" style="max-width:60%;box-shadow:0 6px 20px rgba(0,0,0,.06)"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(v || 'Без села') + '</span>' + icon('down', 16, 2.6) + '</button>';
  }
  function pickVillage() {
    openSheet('Населений пункт', villages().map(function (x) { return { v: x.name, l: x.name, sub: x.n + ' точок' }; }), village() || 'Без села', function (v) {
      setMeta('village', v === 'Без села' ? null : v).then(function () { S.route = null; S.filter = null; S.sel = null; render(); });
    });
  }
  function bindVillageSelect() {}
  function counts(ps) { var c = { g: 0, y: 0, r: 0, n: 0 }; ps.forEach(function (p) { c[p.status]++; }); return c; }
  function renderHome() {
    var ps = villagePoints(), c = counts(ps);
    var active = ps.filter(function (p) { return p.status !== 'n'; });
    var read = active.filter(readThisCycle).length;
    var left = active.filter(function (p) { return !doneThisCycle(p); }).length;
    var r = ensureRoute(); var first = r && r.ids.length ? S.points.get(r.ids[0]) : null;
    var km = r ? fdist(r.meters) : '—', hrs = r ? Math.max(1, Math.round((r.meters / 1.25 / 60 + r.ids.length * 3) / 60)) : 0;
    var needBackup = !S.meta.lastBackup || Date.now() - S.meta.lastBackup > 3 * 864e5;
    app.innerHTML = '<div class="screen">' +
      '<div class="between">' + villageSelect('vsel') + '<div class="row"><a class="iconbtn" href="#list" aria-label="Пошук">' + icon('search') + '</a><a class="iconbtn" href="#settings" aria-label="Налаштування">' + icon('gear') + '</a></div></div>' +
      '<div class="col" style="gap:2px;padding:4px 2px 0"><div class="small mute" style="font-size:13px">' + monthName() + ' · сьогодні</div><h1 class="h1">' + left + ' адрес чекають</h1></div>' +
      '<a href="#map" data-act="startRoute" class="card big dark" style="gap:16px">' +
        '<div class="between" style="align-items:flex-start"><div class="col" style="gap:4px"><span style="font-size:22px;font-weight:800">Почати обхід</span>' +
        '<span class="small mute" style="font-size:13px">' + (r ? r.ids.length : 0) + ' адрес на сьогодні · ' + km + (hrs ? ' · ≈ ' + hrs + ' год' : '') + '</span></div>' +
        '<span style="width:52px;height:52px;border-radius:26px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon('go', 22, 2.4) + '</span></div>' +
        '<div class="col" style="gap:8px">' + (first ? '<div class="between small" style="font-size:13px"><span class="mute">Перша адреса</span><span>' + esc(addr(first)) + (S.pos ? ' · ' + fdist(dist(S.pos, first)) : '') + '</span></div>' : '') +
        '<div class="progress"><span style="width:' + pct(read, active.length) + '%"></span></div><div class="small mute">' + read + ' з ' + active.length + ' знято · ' + pct(read, active.length) + '%</div></div></a>' +
      '<div class="grid2">' + ST_ORDER.map(function (s) {
        return '<a class="tile" href="#map" data-act="filter" data-st="' + s + '"><span class="dot ' + s + '" style="width:22px;height:22px;border:4px solid #fff;box-shadow:0 0 0 1px #E4E4E7' + (s === 'n' ? ';border:3.5px solid #A1A1AA;box-shadow:none' : '') + '"></span>' +
          '<div class="col"><span class="num">' + c[s] + '</span><span class="small mute" style="font-size:13px">' + ST[s].label + '</span></div></a>';
      }).join('') + '</div>' +
      (needBackup ? '<button class="btn sec" data-act="backup">Зробити резервну копію даних</button>' : '') +
      '<button class="btn sec" disabled style="border-style:dashed">' + icon('grid') + 'Сектори між контролерами · скоро</button>' +
      '</div>' + tabs('home');
    bindVillageSelect('vsel');
    startGps();
    onGps(function () { if (S.route && !S.route.fromGps && (location.hash || '#home') === '#home') { S.route = null; offGps(); renderHome(); } });
  }

  /* ---------- Карта ---------- */
  var map = null, mapReady = false, mapMode = 'route';
  function showMap(on) {
    var el = $('#map');
    if (!el) { el = document.createElement('div'); el.id = 'map'; document.body.insertBefore(el, app); }
    el.style.display = on ? 'block' : 'none';
    if (on && !map) initMap();
    if (on && map) setTimeout(function () { map.resize(); }, 30);
  }
  function initMap() {
    var start = centroid(villagePoints().length ? villagePoints() : Array.from(S.points.values()));
    map = new maplibregl.Map({ container: 'map', style: MAP_STYLE(S.meta.layer || 'scheme'), center: [start.lon, start.lat], zoom: 15.5,
      attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false });
    map.touchZoomRotate.disableRotation();
    map.on('style.load', addLayers);
    /* підстраховка: якщо після зміни шару наші точки зникли, повертаємо їх */
    map.on('styledata', function () { if (map.isStyleLoaded() && !map.getLayer('pts')) addLayers(); });
    map.on('click', function (e) {
      if (mapMode !== 'route' && mapMode !== 'all') return;
      var x = e.point.x, y = e.point.y;
      var hit = map.getLayer('pts') ? map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers: ['pts'] }) : [];
      if (S.adding) { startAdd(e.lngLat, e.point); return; }
      if (hit.length) { S.sel = hit[0].properties.id; updateMap(); renderSheet(); return; }
      startAdd(e.lngLat, e.point);
    });
    map.on('movestart', function (e) { if (e.originalEvent) S.moved = true; });
    map.on('moveend', function () { if (mapMode === 'bind' && S.moved && $('#bindBtn')) $('#bindBtn').disabled = false; });
    map.on('error', function (e) { if (e && e.error && !/Failed to fetch|NetworkError|AJAXError/.test(e.error.message)) console.warn('map', e.error.message); });
  }
  function addLayers() {
    mapReady = true;
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('me', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('lbl', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    map.addLayer({ id: 'route-case', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 7 } });
    map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#111111', 'line-width': 3.5 } });
    map.addLayer({ id: 'pts', type: 'circle', source: 'pts', paint: {
      'circle-radius': ['case', ['==', ['get', 'sel'], true], 14, ['>', ['get', 'num'], 0], 10, 6],
      'circle-color': ['match', ['get', 'st'], 'g', '#16A34A', 'y', '#F59E0B', 'r', '#DC2626', '#FFFFFF'],
      'circle-stroke-color': ['case', ['==', ['get', 'sel'], true], '#111111', ['==', ['get', 'st'], 'n'], '#A1A1AA', '#FFFFFF'],
      'circle-stroke-width': ['case', ['==', ['get', 'sel'], true], 3, 2],
      'circle-opacity': ['case', ['==', ['get', 'dim'], true], 0.3, 1], 'circle-stroke-opacity': ['case', ['==', ['get', 'dim'], true], 0.3, 1] } });
    /* підписи адрес — окреме джерело: якщо шрифти не завантажились без інтернету, точки все одно видно */
    map.addLayer({ id: 'lbl', type: 'symbol', source: 'lbl', minzoom: 16, layout: {
      'text-field': ['step', ['zoom'], ['get', 'h'], 17.6, ['get', 'a']], 'text-font': ['Noto Sans Bold'], 'text-size': 11,
      'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 },
      paint: { 'text-color': '#111111', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 } });
    updateMap();
    if (S.pendingFit) { var f = S.pendingFit; S.pendingFit = null; f(); }
  }
  /* моя позиція — окрема HTML-мітка: видно на будь-якому шарі, з колом точності */
  var meMarker = null;
  function updateMe() {
    if (!map) return;
    if (!S.pos) { if (meMarker) { meMarker.remove(); meMarker = null; } return; }
    if (!meMarker) {
      var el = document.createElement('div'); el.className = 'me';
      el.innerHTML = '<span class="me-acc"></span><span class="me-dot"></span>';
      meMarker = new maplibregl.Marker({ element: el }).setLngLat([S.pos.lon, S.pos.lat]).addTo(map);
      map.on('zoom', sizeAcc);
    }
    meMarker.setLngLat([S.pos.lon, S.pos.lat]); sizeAcc();
  }
  function sizeAcc() {
    if (!meMarker || !S.pos) return;
    var mpp = 156543.03 * Math.cos(S.pos.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    var d = Math.max(28, Math.min(400, 2 * (S.pos.acc || 10) / mpp));
    var a = meMarker.getElement().querySelector('.me-acc'); a.style.width = a.style.height = d + 'px';
  }
  function updateMap() {
    if (!map || !mapReady || !map.getSource('pts')) return;
    var r = mapMode === 'route' ? ensureRoute() : null, order = {};
    if (r) r.ids.forEach(function (id, i) { order[id] = i + 1; });
    var feats = [], lbl = [];
    var list = mapMode === 'all' ? allFiltered() : villagePoints();
    list.forEach(function (p) {
      var num = order[p.id] || 0;
      var dim = p.id === S.sel ? false : mapMode === 'route' ? (S.filter ? p.status !== S.filter : (r && r.off ? false : !num)) : mapMode === 'all' ? false : true;
      var g = { type: 'Point', coordinates: [p.lon, p.lat] };
      feats.push({ type: 'Feature', geometry: g, properties: { id: p.id, st: p.status, num: S.filter ? 0 : num, sel: p.id === S.sel, dim: dim } });
      if (!dim || mapMode === 'route') lbl.push({ type: 'Feature', geometry: g, properties: { h: p.house || '', a: addr(p) } });
    });
    map.getSource('pts').setData({ type: 'FeatureCollection', features: feats });
    if (map.getSource('lbl')) map.getSource('lbl').setData({ type: 'FeatureCollection', features: lbl });
    /* номери маршруту — HTML-мітки: не залежать від шрифтів карти і працюють без інтернету */
    (S.markers || []).forEach(function (mk) { mk.remove(); });
    S.markers = [];
    if (r && !S.filter && mapMode === 'route') {
      r.ids.forEach(function (id, i) {
        var p = S.points.get(id), sel = id === S.sel, el = document.createElement('button');
        el.type = 'button'; el.className = 'rnum' + (sel ? ' sel' : '') + ' st-' + p.status; el.textContent = i + 1;
        el.setAttribute('aria-label', '№' + (i + 1) + ' ' + addr(p));
        el.onclick = function (e) { e.stopPropagation(); S.sel = id; updateMap(); renderSheet(); };
        S.markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
      });
    }
    var line = [];
    if (r && !S.filter && mapMode === 'route' && r.ids.length) {
      var lw = S.meta.lastWalk;
      if (r.walk) line = r.walk;
      else if (lw && lw.key === r.key) { line = lw.coords; r.walk = lw.coords; r.meters = lw.meters; }
      else { line.push([r.start.lon, r.start.lat]); r.ids.forEach(function (id) { var p = S.points.get(id); line.push([p.lon, p.lat]); }); }
    }
    map.getSource('route').setData({ type: 'FeatureCollection', features: line.length > 1 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} }] : [] });
    updateMe();
  }
  function fitTo(ps) {
    if (!map || !ps.length) return;
    if (ps.length === 1) return map.easeTo({ center: [ps[0].lon, ps[0].lat], zoom: 17.5 });
    var b = new maplibregl.LngLatBounds();
    ps.forEach(function (p) { b.extend([p.lon, p.lat]); });
    map.fitBounds(b, { padding: { top: 190, bottom: 280, left: 40, right: 40 }, maxZoom: 17.5, duration: 0 });
  }
  function setLayer(l) {
    setMeta('layer', l); mapReady = false;
    map.setStyle(MAP_STYLE(l), { diff: false });
    if (l === 'sat' && !navigator.onLine) toast('Супутник доступний лише з інтернетом');
  }
  function renderMap() {
    mapMode = 'route';
    var r = ensureRoute();
    if (!S.sel || routeIndex(S.sel) < 0 && !S.points.get(S.sel)) S.sel = r && r.ids[0];
    if (r && r.off && !S.sel && S.pos) { var bp = null, bd = Infinity; villagePoints().forEach(function (p) { var d = dist(S.pos, p); if (d < bd && p.status !== 'n') { bd = d; bp = p; } }); S.sel = bp && bp.id; }
    var c = counts(villagePoints()), lay = S.meta.layer || 'scheme';
    app.innerHTML = '<div class="mapui" style="top:18px;display:flex;flex-direction:column;gap:10px">' +
      '<div class="row">' + villageSelect('vsel') + '<a class="pill" href="#list" style="flex-grow:1;color:#6B6B70;box-shadow:0 6px 20px rgba(0,0,0,.06)">' + icon('search', 18) + 'Пошук</a></div>' +
      (S.meta.tilesMin
        ? '<div class="pill tilebar" style="padding:0 4px 0 8px;gap:2px;align-self:flex-start">' + ST_ORDER.map(function (s) {
            return '<button class="tb-item' + (S.filter === s ? ' on' : '') + (S.filter && S.filter !== s ? ' off' : '') + '" data-act="filter" data-st="' + s + '" aria-label="' + ST[s].label + '">' + dotHtml(s) + '<b>' + c[s] + '</b></button>';
          }).join('') + '<button class="tb-item" data-act="toggleTiles" aria-label="Розгорнути статуси">' + icon('down', 16, 2.6) + '</button></div>'
        : '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' + ST_ORDER.map(function (s) {
            return '<button class="ftile' + (S.filter === s ? ' on' : '') + '" data-act="filter" data-st="' + s + '">' + dotHtml(s) + '<b>' + c[s] + '</b><span>' + ST[s].short + '</span></button>';
          }).join('') + '</div>') +
      '<div class="between"><div class="row"><button class="iconbtn" data-act="locate" aria-label="Моя позиція">' + icon('locate') + '</button>' +
      '<button class="pill" data-act="routeCfg" style="height:48px;box-shadow:0 6px 20px rgba(0,0,0,.06)">' + icon('gear', 18) + (routeCfg().auto ? 'Маршрут' : 'Маршрут вимк.') + '</button>' +
      (S.meta.tilesMin ? '' : '<button class="iconbtn" data-act="toggleTiles" aria-label="Згорнути статуси">' + '<span style="transform:rotate(180deg);display:flex">' + icon('down', 20, 2.6) + '</span></button>') + '</div>' +
      '<div class="seg"><button data-act="layer" data-l="scheme" class="' + (lay === 'scheme' ? 'on' : '') + '">Схема</button><button data-act="layer" data-l="sat" class="' + (lay === 'sat' ? 'on' : '') + '">Супутник</button></div></div>' +
      '</div><div id="sheet"></div>' + tabs('map');
    bindVillageSelect('vsel');
    renderSheet();
    var doFit = function () { updateMap(); var sel = S.points.get(S.sel); if (renderMap.fitNext !== false) { fitTo(sel ? [sel] : villagePoints()); } renderMap.fitNext = true; };
    if (mapReady) doFit(); else S.pendingFit = doFit;
    startGps();
    var lastRecalc = 0;
    onGps(function () {
      updateMe(); renderSheet();
      if (S.route && !S.route.fromGps && Date.now() - lastRecalc > 20000) { lastRecalc = Date.now(); S.route = computeRoute(); S.sel = S.route.ids[0]; updateMap(); renderSheet(); }
    });
  }
  function sheetSwipe(el) {
    var sh = el.firstElementChild; if (!sh || S.adding) return;
    var y0 = null;
    sh.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchend', function (e) {
      if (y0 === null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null;
      if (dy > 40 && !S.meta.sheetMin) { setMeta('sheetMin', true); renderSheet(); }
      else if (dy < -40 && S.meta.sheetMin) { setMeta('sheetMin', false); renderSheet(); }
    });
  }
  function renderSheet() {
    renderSheetInner(); sheetSwipe($('#sheet') || document.createElement('div'));
  }
  function renderSheetInner() {
    var el = $('#sheet'); if (!el) return;
    if (S.adding) return renderAddSheet(el);
    var r = mapMode === 'route' ? S.route : null, p = S.points.get(S.sel);
    if (!p && mapMode === 'all') { el.innerHTML = '<div class="sheet mini"><div class="small mute" style="padding:6px 4px">Торкніться точки, щоб відкрити її, або порожнього місця, щоб додати нову</div></div>'; return; }
    if (!p) { el.innerHTML = r && !r.ids.length ? '<div class="sheet"><div class="h2">Усі адреси в цьому селі пройдено</div><div class="small mute">Відмічені «Зчитано» та «Не живуть» у маршрут не потрапляють.</div></div>' : ''; return; }
    var idx = routeIndex(p.id), rn = (S.meta.routeNo || {})[village()] || '';
    var d = S.pos ? fdist(dist(S.pos, p)) : '';
    if (S.meta.sheetMin) {
      el.innerHTML = '<div class="sheet mini"><button class="grip" data-act="toggleSheet" aria-label="Розгорнути панель"></button>' +
        '<div class="row"><button class="row" data-act="toggleSheet" style="flex-grow:1;min-width:0;border:0;background:transparent;padding:0;font-size:16px;font-weight:800;color:#111;text-align:left">' +
        (idx >= 0 ? '<span class="numbadge">' + (idx + 1) + '</span>' : dotHtml(p.status)) +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(addr(p)) + '</span>' + (d ? '<span class="small mute" style="flex-shrink:0">' + d + '</span>' : '') + '</button>' +
        '<a class="iconbtn" href="#card/' + p.id + '" aria-label="Відкрити картку" style="background:#111;color:#fff;box-shadow:none;width:44px;height:44px">' + icon('arrow', 18, 2.4) + '</a></div></div>';
      return;
    }
    el.innerHTML = '<div class="sheet"><button class="grip" data-act="toggleSheet" aria-label="Згорнути панель"></button>' +
      '<div class="between" style="align-items:flex-start"><div class="col" style="gap:4px;min-width:0">' +
      '<div class="row small mute" style="flex-wrap:wrap"><label class="chip" style="height:26px;color:#111">Маршрут №<input id="rno" value="' + esc(rn) + '" placeholder="внести" style="width:84px;border:0;outline:0;background:transparent;font-weight:800"></label>' +
      (r ? (r.off ? 'Авто-маршрут вимкнено' : r.ids.length + ' з ' + r.total + ' адрес · ' + fdist(r.meters) + (r.walk ? ' пішки' : '')) : '') + '</div>' +
      '<div class="row" style="font-size:18px;font-weight:800">' + (idx >= 0 ? '<span class="numbadge">' + (idx + 1) + '</span>' : '') + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(addr(p)) + '</span></div>' +
      '<div class="small mute">' + (idx === 0 ? 'Наступна' : idx > 0 ? 'У маршруті' : 'Поза маршрутом') + (d ? ' · ' + d : '') + ' · ' + ST[p.status].label.toLowerCase() + '</div>' +
      '</div>' + dotHtml(p.status) + '</div>' +
      '<div class="row"><a class="btn" href="#card/' + p.id + '" style="flex-grow:1;height:54px;font-size:15px">Відкрити картку ' + icon('arrow', 18, 2.4) + '</a>' +
      (idx >= 0 ? '<button class="iconbtn" data-act="skip" aria-label="Пропустити адресу" style="width:54px;height:54px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('skip') + '</button>' : '') + '</div></div>';
    var rno = $('#rno');
    if (rno) rno.onchange = function () { var m = Object.assign({}, S.meta.routeNo || {}); m[village()] = rno.value.trim(); setMeta('routeNo', m); toast('Номер маршруту збережено'); };
  }

  /* ---------- Нова точка тапом по карті ---------- */
  var addMarker = null;
  function cleanStreet(n) { return String(n || '').replace(/^(вулиця|вул\.|провулок|пров\.)\s+/i, '').replace(/\s+(вулиця|провулок)$/i, '').trim(); }
  function nearestFeature(feats, pt) {
    var best = null, bd = Infinity;
    feats.forEach(function (f) {
      var cs = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.type === 'MultiLineString' ? [].concat.apply([], f.geometry.coordinates) : [];
      cs.forEach(function (c) { var q = map.project(c), d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = f; } });
    });
    return best;
  }
  function startAdd(ll, pt) {
    var street = '', house = '';
    try {
      var box = [[pt.x - 70, pt.y - 70], [pt.x + 70, pt.y + 70]];
      var hn = map.getLayer('housenumber') ? map.queryRenderedFeatures(box, { layers: ['housenumber'] }) : [];
      var nh = nearestFeature(hn, pt); if (nh) house = nh.properties.housenumber || '';
      var sn = map.getLayer('street-name') ? map.queryRenderedFeatures([[pt.x - 160, pt.y - 160], [pt.x + 160, pt.y + 160]], { layers: ['street-name'] }) : [];
      var ns = nearestFeature(sn, pt); if (ns) street = cleanStreet(ns.properties.name);
    } catch (x) { /* карта без даних — поля порожні */ }
    S.adding = { lat: ll.lat, lon: ll.lng, street: street, house: house, st: 'y', auto: !!(street || house) };
    if (!addMarker) {
      var el = document.createElement('div'); el.className = 'addpin';
      el.innerHTML = '<svg width="34" height="44" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 50s-17-15-17-29A17 17 0 0137 21c0 14-17 29-17 29z" fill="#111" stroke="#fff" stroke-width="3"/><circle cx="20" cy="21" r="7" fill="#fff"/></svg>';
      addMarker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true }).setLngLat(ll).addTo(map);
      addMarker.on('dragend', function () { var c = addMarker.getLngLat(); if (S.adding) { S.adding.lat = c.lat; S.adding.lon = c.lng; } });
    } else addMarker.setLngLat(ll);
    if (S.meta.sheetMin) setMeta('sheetMin', false);
    renderSheet();
  }
  function cancelAdd(quiet) { S.adding = null; if (addMarker) { addMarker.remove(); addMarker = null; } if (!quiet) renderSheet(); }
  function renderAddSheet(el) {
    var a = S.adding;
    el.innerHTML = '<div class="sheet"><div class="between"><div class="h2">Нова точка тут</div><button class="iconbtn" data-act="addCancel" aria-label="Скасувати" style="box-shadow:none;background:#F1F1F3;width:40px;height:40px">' + icon('close', 18, 2.4) + '</button></div>' +
      '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><input id="ad-s" class="input" placeholder="Вулиця" value="' + esc(a.street) + '"><input id="ad-h" class="input" placeholder="Будинок" value="' + esc(a.house) + '"></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">' + ST_ORDER.map(function (s) {
        return '<button class="opt' + (a.st === s ? ' on' : '') + '" data-act="addSt" data-v="' + s + '" style="min-height:44px;align-items:center;padding:6px 4px">' + dotHtml(s) + '<small style="opacity:1;font-weight:700">' + ST[s].short + '</small></button>';
      }).join('') + '</div>' +
      '<div class="small mute">' + (a.auto ? 'Адресу підставлено з карти, перевірте. ' : '') + 'Мітку можна перетягнути.</div>' +
      '<button class="btn" data-act="addSave">' + icon('pin') + 'Зберегти точку</button></div>';
    $('#ad-s').oninput = function () { a.street = this.value; };
    $('#ad-h').oninput = function () { a.house = this.value; };
  }
  function saveAdd() {
    var a = S.adding; if (!a) return;
    var s = a.street.trim(), h = a.house.trim(), near = null, bd = Infinity;
    S.points.forEach(function (q) { var d = dist(a, q); if (d < bd && q.village) { bd = d; near = q; } });
    var p = { id: 'n' + Date.now().toString(36), lat: +a.lat.toFixed(6), lon: +a.lon.toFixed(6), village: near && bd < 1500 ? near.village : village(),
      street: s, house: h, status: a.st, tags: [], note: '', src: 'карта', created: new Date().toISOString().slice(0, 10),
      flags: [].concat(s ? [] : ['no_street'], h ? [] : ['no_house']) };
    S.points.set(p.id, p); S.route = null; cancelAdd(true); S.sel = p.id;
    put('points', p).then(function () { toast('Точку додано: ' + addr(p)); updateMap(); renderSheet(); });
  }

  /* ---------- Усі мітки з фільтрами ---------- */
  var CY = [['ok', 'Був'], ['miss', 'Не потрапив'], ['todo', 'Не був']];
  function cycleState(p) { var v = cycleMap()[p.id]; if (!v) return 'todo'; return v.result === 'ok' || v.result === 'empty' ? 'ok' : 'miss'; }
  function allF() { return S.meta.allF || { st: [], cy: [] }; }
  function allFiltered() {
    var F = allF(), out = [];
    S.points.forEach(function (p) {
      if (F.st.length && F.st.indexOf(p.status) < 0) return;
      if (F.cy.length && F.cy.indexOf(cycleState(p)) < 0) return;
      out.push(p);
    });
    return out;
  }
  function renderAll() {
    mapMode = 'all';
    var F = allF(), shown = allFiltered(), cs = { g: 0, y: 0, r: 0, n: 0 }, cc = { ok: 0, miss: 0, todo: 0 };
    S.points.forEach(function (p) { cs[p.status]++; cc[cycleState(p)]++; });
    var chip = function (grp, v, label, n, dot) {
      var on = F[grp].indexOf(v) >= 0;
      return '<button class="chip fchip' + (on ? ' on' : '') + '" data-act="allF" data-g="' + grp + '" data-v="' + v + '">' + (dot ? dotHtml(v) : '') + label + ' <span style="opacity:.6">' + fmt(n) + '</span></button>';
    };
    var panel = S.meta.allMin
      ? '<button class="pill tilebar" data-act="toggleAll" style="align-self:flex-start">' + icon('grid', 16) + 'Фільтри' + (F.st.length + F.cy.length ? ' · ' + (F.st.length + F.cy.length) : '') + ' · ' + fmt(shown.length) + icon('down', 16, 2.6) + '</button>'
      : '<div class="card" style="padding:12px;gap:10px;box-shadow:0 6px 20px rgba(0,0,0,.06)">' +
        '<div class="small mute">Доступ</div><div class="tags">' + ST_ORDER.map(function (s) { return chip('st', s, ST[s].short, cs[s], true); }).join('') + '</div>' +
        '<div class="small mute">' + monthName() + '</div><div class="tags">' + CY.map(function (c) { return chip('cy', c[0], c[1], cc[c[0]]); }).join('') + '</div>' +
        '<div class="between"><span class="small">Показано ' + fmt(shown.length) + ' з ' + fmt(S.points.size) + '</span><span class="row">' +
        (F.st.length + F.cy.length ? '<button class="chip" data-act="allReset">Скинути</button>' : '') +
        '<button class="chip" data-act="toggleAll" aria-label="Згорнути фільтри"><span style="transform:rotate(180deg);display:flex">' + icon('down', 16, 2.6) + '</span></button></span></div></div>';
    var lay = S.meta.layer || 'scheme';
    app.innerHTML = '<div class="mapui" style="top:18px;display:flex;flex-direction:column;gap:10px">' +
      '<a class="pill" href="#list" style="color:#6B6B70;box-shadow:0 6px 20px rgba(0,0,0,.06)">' + icon('search', 18) + 'Пошук адреси</a>' + panel +
      '<div class="between"><button class="iconbtn" data-act="locate" aria-label="Моя позиція">' + icon('locate') + '</button>' +
      '<div class="seg"><button data-act="layer" data-l="scheme" class="' + (lay === 'scheme' ? 'on' : '') + '">Схема</button><button data-act="layer" data-l="sat" class="' + (lay === 'sat' ? 'on' : '') + '">Супутник</button></div></div>' +
      '</div><div id="sheet"></div>' + tabs('all');
    if (S.sel && shown.indexOf(S.points.get(S.sel)) < 0) S.sel = null;
    renderSheet();
    var fit = function () { updateMap(); if (renderAll.fitNext !== false) fitTo(shown.length ? shown : Array.from(S.points.values())); renderAll.fitNext = true; };
    if (mapReady) fit(); else S.pendingFit = fit;
    startGps(); onGps(function () { updateMe(); });
  }

  /* ---------- Картка ---------- */
  function lastReading(pid) { var v = visitsOf(pid).filter(function (x) { return x.reading != null && x.reading !== ''; }); return v; }
  function renderCard(id) {
    var p = S.points.get(id); if (!p) return go('#home');
    var idx = routeIndex(p.id), cv = cycleMap()[p.id], rd = lastReading(p.id), f = p.fields || {};
    var last = rd[0], prev = rd[1];
    var delta = last && prev ? Number(last.reading) - Number(prev.reading) : null;
    var flags = (p.flags || []).filter(function (x) { return FLAGNAME[x]; });
    var phone = (f.phone || '').replace(/[^\d+]/g, '');
    var navUrl = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + p.lat + ',' + p.lon;
    app.innerHTML = '<div class="screen" style="padding-bottom:40px">' +
      '<div class="row"><a class="iconbtn" href="#map" aria-label="Назад">' + icon('back', 20, 2.4) + '</a><div class="small mute" style="font-size:13px">' + esc(p.village || 'Без села') + (idx >= 0 ? ' · №' + (idx + 1) + ' у маршруті' : '') + '</div></div>' +
      '<div class="card big" style="gap:14px">' +
        '<h1 class="h1" style="font-size:26px">' + esc(addr(p)) + '</h1>' +
        (p.orig && p.orig.replace(/\s/g, '').toLowerCase() !== addr(p).replace(/\s/g, '').toLowerCase() ? '<div class="small mute" style="margin-top:-8px">У MAPS.ME: ' + esc(p.orig) + '</div>' : '') +
        '<div class="tags"><span class="chip">' + dotHtml(p.status) + ST[p.status].label + '</span><span class="chip mute">' + monthName() + ': ' + (cv ? RESNAME[cv.result].toLowerCase() : 'не відвідано') + '</span></div>' +
        (flags.length ? '<div class="tags">' + flags.map(function (x) { return '<span class="chip" style="background:#FEF3C7;color:#92400E">' + FLAGNAME[x] + '</span>'; }).join('') + '</div>' : '') +
        '<a class="btn" href="#visit/' + p.id + '">' + icon('check', 20, 2.6) + 'Відмітити візит</a>' +
        '<div class="row" style="gap:8px"><button class="btn sec" data-act="showOnMap" data-id="' + p.id + '" style="flex:1">' + icon('map', 18) + 'На карті</button>' +
        '<a class="iconbtn" href="' + navUrl + '" target="_blank" rel="noopener" aria-label="Навігація в Google Maps" style="width:48px;height:48px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('nav', 18) + '</a>' +
        (phone ? '<a class="iconbtn" href="tel:' + esc(phone) + '" aria-label="Подзвонити" style="width:48px;height:48px;background:#111;color:#fff;box-shadow:none">' + icon('phone', 18) + '</a>' : '') + '</div>' +
      '</div>' +
      '<div class="card"><div class="h2" style="font-size:15px">Як знайти</div>' +
        ((p.tags || []).length ? '<div class="tags">' + p.tags.map(function (t) { return '<span class="chip on">' + esc(TAGNAME[t] || t) + '</span>'; }).join('') + '</div>' : '') +
        '<div id="photos" class="photos"></div>' +
        '<div class="grid2" style="gap:8px"><label class="btn sec" for="ph-m" style="height:46px">' + icon('camera', 18) + 'Лічильник</label><label class="btn sec" for="ph-h" style="height:46px">' + icon('camera', 18) + 'Будинок, хвіртка</label></div>' +
        '<input id="ph-m" type="file" accept="image/*" capture="environment" hidden data-kind="Лічильник"><input id="ph-h" type="file" accept="image/*" capture="environment" hidden data-kind="Будинок">' +
        '<textarea id="note" class="input" placeholder="Орієнтир: колір хвіртки, де лічильник, коли вдома">' + esc(p.note || '') + '</textarea></div>' +
      '<div class="card"><div class="h2">Показники</div>' +
        '<div class="grid2" style="gap:8px"><div class="card dark" style="padding:12px 14px;gap:2px;border-radius:18px"><span class="small mute">Останній</span><span style="font-size:24px;font-weight:800">' + (last ? fmt(last.reading) : '—') + '</span><span class="small mute">' + (last ? dt(last.ts) + ' · ' + tm(last.ts) : 'ще немає') + '</span></div>' +
        '<div class="card" style="background:#F6F6F7;padding:12px 14px;gap:2px;border-radius:18px"><span class="small mute">З попереднього</span><span style="font-size:24px;font-weight:800">' + (delta != null ? (delta >= 0 ? '+' : '') + fmt(delta) : '—') + '</span><span class="small mute">кВт·год</span></div></div>' +
        '<div class="field"><label for="rdg">Загальний' + (last ? ' (попередній: ' + fmt(last.reading) + ')' : '') + '</label><input id="rdg" class="input" inputmode="numeric" placeholder="Новий показник"></div>' +
        '<button class="btn out" data-act="saveReading" data-id="' + p.id + '">Зберегти показник</button>' +
        (rd.length ? '<button class="btn sec" data-act="toggleHist" style="justify-content:space-between;padding:0 14px;border:0;background:#F6F6F7">Історія показників · ' + rd.length + icon('down', 18, 2.4) + '</button>' +
          '<div id="hist" style="display:none">' + rd.map(function (v, i) {
            var nx = rd[i + 1], dd = nx ? Number(v.reading) - Number(nx.reading) : null;
            return '<div class="list-row" style="justify-content:space-between"><div class="col"><b>' + dt(v.ts) + '</b><span class="small mute">' + tm(v.ts) + (v.method ? ' · ' + esc(v.method) : '') + '</span></div><div class="col" style="align-items:flex-end"><b style="font-size:16px">' + fmt(v.reading) + '</b><span class="small mute">' + (dd != null ? (dd >= 0 ? '+' : '') + fmt(dd) : '—') + '</span></div></div>';
          }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="card"><div class="h2">Адреса на карті</div>' +
        '<div class="field"><label for="a-v">Село</label><input id="a-v" class="input" list="vlist" value="' + esc(p.village || '') + '"><datalist id="vlist">' + villages().map(function (v) { return '<option value="' + esc(v.name) + '">'; }).join('') + '</datalist></div>' +
        '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><div class="field"><label for="a-s">Вулиця</label><input id="a-s" class="input" value="' + esc(p.street || '') + '"></div><div class="field"><label for="a-h">Будинок</label><input id="a-h" class="input" value="' + esc(p.house || '') + '"></div></div>' +
        '<a class="between list-row" href="#bind/' + p.id + '" style="border:0"><span class="mute small" style="font-size:14px">Прив\'язка</span><b class="row" style="gap:6px">' + (p.acc ? '±' + Math.round(p.acc) + ' м · ' : '') + esc(p.src || '') + icon('right', 14, 2.4) + '</b></a>' +
      '</div>' +
      '<div class="card"><div class="col" style="gap:2px"><div class="h2">Дані абонента</div><div class="small mute">Усі поля офіційного застосунку, в тому ж порядку</div></div>' +
        OFFICIAL.map(function (o, i) {
          var val = f[o[0]] || '', inp;
          if (o[2] === 'info') inp = '<div style="font-weight:700">' + (last ? fmt(last.reading) + ' · ' + dt(last.ts) : 'Блок «Показники» вище') + '</div>';
          else if (o[2] === 'select') inp = pickBtn(o[0], val, 'Вибрати');
          else if (o[2] === 'textarea') inp = '<textarea class="input" data-f="' + o[0] + '" placeholder="Номер пломби: статус">' + esc(val) + '</textarea>';
          else if (o[2] === 'tel') inp = '<div class="row" style="gap:8px"><input class="input" data-f="phone" id="f-phone" type="tel" inputmode="tel" value="' + esc(val) + '" placeholder="Номер телефону">' +
            '<button type="button" class="iconbtn" data-act="callPhone" aria-label="Подзвонити" style="width:52px;height:52px;border-radius:16px;background:#111;color:#fff;box-shadow:none">' + icon('phone', 20) + '</button></div>';
          else inp = '<input class="input" data-f="' + o[0] + '" type="text" value="' + esc(val) + '">';
          return '<div class="field"><label><span style="color:#A1A1AA;margin-right:6px">' + (i + 1) + '</span>' + esc(o[1]) + '</label>' + inp + '</div>';
        }).join('') +
        '<button class="btn" data-act="saveCard" data-id="' + p.id + '">Зберегти</button>' +
      '</div>' +
      '<button class="btn sec" data-act="deletePoint" data-id="' + p.id + '" style="color:#B91C1C">Видалити точку (дубль)</button>' +
      '</div>';
    loadPhotos(p.id); bindPhotoInputs(p.id);
  }
  function loadPhotos(pid) {
    var box = $('#photos'); if (!box) return;
    (S.phUrls || []).forEach(function (u) { URL.revokeObjectURL(u); }); S.phUrls = [];
    photosOf(pid).then(function (ph) {
      box.innerHTML = ph.map(function (x) {
        var u = URL.createObjectURL(x.blob); S.phUrls.push(u);
        return '<button class="ph" data-act="viewPhoto" data-pid="' + x.id + '" data-url="' + u + '" data-kind="' + esc(x.kind || '') + '" data-ts="' + x.ts + '"><img src="' + u + '" alt="' + esc(x.kind || 'Фото') + '"><span>' + esc(x.kind || '') + '</span></button>';
      }).join('');
      box.style.display = ph.length ? '' : 'none';
    });
  }
  function bindPhotoInputs(pid) {
    ['#ph-m', '#ph-h'].forEach(function (sel) {
      var inp = $(sel); if (!inp) return;
      inp.onchange = function () {
        var file = inp.files[0]; if (!file) return;
        toast('Зберігаю фото…');
        compress(file).then(function (b) { return put('photos', { pointId: pid, ts: Date.now(), kind: inp.getAttribute('data-kind'), blob: b }); })
          .then(function () { inp.value = ''; toast('Фото збережено'); loadPhotos(pid); })
          .catch(function () { toast('Не вдалося зберегти фото'); });
      };
    });
  }
  function viewPhoto(el) {
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov show ph-view';
    ov.innerHTML = '<img src="' + el.getAttribute('data-url') + '" alt="">' +
      '<div class="ph-bar"><span>' + esc(el.getAttribute('data-kind')) + ' · ' + dt(+el.getAttribute('data-ts')) + '</span>' +
      '<button class="chip" data-pk="del" style="background:#fff;color:#B91C1C">Видалити</button><button class="chip" data-pk="close" style="background:#fff">Закрити</button></div>';
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pk]');
      if (b && b.getAttribute('data-pk') === 'del') {
        if (!confirm('Видалити фото?')) return;
        del('photos', +el.getAttribute('data-pid')).then(function () { closeSheet(); toast('Фото видалено'); loadPhotos(location.hash.split('/')[1]); });
        return;
      }
      closeSheet();
    });
    document.body.appendChild(ov);
  }
  function saveCard(id) {
    var p = S.points.get(id); if (!p) return;
    var f = Object.assign({}, p.fields || {});
    document.querySelectorAll('[data-f]').forEach(function (el) { f[el.getAttribute('data-f')] = (el.tagName === 'BUTTON' ? el.getAttribute('data-val') : el.value).trim(); });
    p.fields = f; p.note = $('#note').value.trim();
    var v = $('#a-v').value.trim(), s = $('#a-s').value.trim(), h = $('#a-h').value.trim();
    if (v !== (p.village || '')) { p.village = v || null; S.route = null; }
    p.street = s; p.house = h;
    var same = 0;
    S.points.forEach(function (q) { if (q.id !== p.id && s && h && q.village === p.village && (q.street || '').toLowerCase() === s.toLowerCase() && (q.house || '').toLowerCase() === h.toLowerCase()) same++; });
    p.flags = (p.flags || []).filter(function (x) {
      if (x === 'no_street') return !s;
      if (x === 'no_house') return !h;
      if (x === 'no_village' || x === 'village_guess' || x === 'village_check') return !v;
      if (x === 'dup') return same > 0;
      return true;
    });
    p.updated = Date.now();
    return put('points', p).then(function () { toast('Збережено'); });
  }

  /* ---------- Візит ---------- */
  var V = {};
  function renderVisit(id) {
    var p = S.points.get(id); if (!p) return go('#home');
    if (V.id !== id) V = { id: id, res: null, prof: p.status, tags: (p.tags || []).slice() };
    var idx = routeIndex(id), next = S.route && S.route.ids[idx >= 0 ? idx + 1 : 0];
    app.innerHTML = '<div class="screen" style="padding-bottom:120px">' +
      '<div class="row"><a class="iconbtn" href="#card/' + id + '" aria-label="Назад">' + icon('back', 20, 2.4) + '</a><div class="col"><div class="small mute">' + (idx >= 0 ? '№' + (idx + 1) + ' · ' : '') + monthName().toLowerCase() + '</div><div style="font-size:18px;font-weight:800">' + esc(addr(p)) + '</div></div></div>' +
      '<div class="card"><div class="h2">1. Що сьогодні?</div><div class="grid2" style="gap:8px">' + RESULTS.map(function (r) {
        return '<button class="opt' + (V.res === r[0] ? ' on' : '') + '" data-act="res" data-v="' + r[0] + '"><b style="font-size:15px">' + r[1] + '</b><small>' + r[2] + '</small></button>';
      }).join('') + '</div>' +
      (V.res === 'ok' ? '<div class="field"><label for="vr">Показник (необов\'язково)</label><input id="vr" class="input" inputmode="numeric" placeholder="Загальний"></div>' +
        '<div id="vmw">' + pickBtn('vm', 'зчитано').replace('>зчитано<', '>Зчитано з лічильника<') + '</div>' : '') +
      '</div>' +
      '<div class="card"><div class="col" style="gap:2px"><div class="h2">2. Доступ до лічильника</div><div class="small mute">Зберігається на наступні місяці</div></div><div class="grid2" style="gap:8px">' + ST_ORDER.map(function (s) {
        return '<button class="opt' + (V.prof === s ? ' on' : '') + '" data-act="prof" data-v="' + s + '" style="flex-direction:row;align-items:center;justify-content:flex-start;gap:10px;min-height:48px">' + dotHtml(s) + '<b style="font-size:14px">' + ST[s].label + '</b></button>';
      }).join('') + '</div></div>' +
      '<div class="card"><div class="h2">3. Мітки</div><div class="tags">' + TAGS.map(function (t) {
        return '<button class="tag' + (V.tags.indexOf(t[0]) >= 0 ? ' on' : '') + '" data-act="vtag" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><textarea id="vn" class="input" placeholder="Нотатка (необов\'язково)"></textarea></div>' +
      '</div>' +
      '<div style="position:fixed;left:16px;right:16px;bottom:calc(16px + var(--safe-b))"><button class="btn" data-act="saveVisit" data-id="' + id + '" ' + (V.res ? '' : 'disabled') + ' style="height:58px">' +
      (next ? 'Зберегти · до наступної' : 'Зберегти') + icon('arrow', 20, 2.4) + '</button></div>';
  }
  function saveVisit(id) {
    var p = S.points.get(id); if (!p || !V.res) return;
    var reading = $('#vr') ? $('#vr').value.replace(/\s/g, '') : '';
    if (reading && !/^\d+(\.\d+)?$/.test(reading)) return toast('Показник: лише цифри');
    var note = $('#vn').value.trim();
    var v = { pointId: id, ts: Date.now(), result: V.res, prof: V.prof, reading: reading || null, method: reading ? (($('#vmw [data-f]') || {}).getAttribute ? $('#vmw [data-f]').getAttribute('data-val') : 'зчитано') : null, note: note || null,
      pos: S.pos ? { lat: S.pos.lat, lon: S.pos.lon, acc: Math.round(S.pos.acc) } : null };
    if (V.res === 'empty') V.prof = 'n';
    p.status = V.prof; p.tags = V.tags.slice();
    if (note) p.note = p.note ? p.note + '; ' + note : note;
    put('visits', v).then(function (k) { v.id = k; S.visits.push(v); invalidate(); return put('points', p); }).then(function () {
      V = {}; S.route = computeRoute(); S.sel = S.route && S.route.ids[0]; renderMap.fitNext = true;
      toast('Збережено: ' + RESNAME[v.result]); go('#map');
    });
  }
  function saveReading(id) {
    var val = ($('#rdg').value || '').replace(/\s/g, '');
    if (!/^\d+(\.\d+)?$/.test(val)) return toast('Введіть показник цифрами');
    var v = { pointId: id, ts: Date.now(), result: 'ok', prof: S.points.get(id).status, reading: val, method: 'зчитано', note: null,
      pos: S.pos ? { lat: S.pos.lat, lon: S.pos.lon, acc: Math.round(S.pos.acc) } : null };
    put('visits', v).then(function (k) { v.id = k; S.visits.push(v); invalidate(); S.route = null; toast('Показник збережено'); renderCard(id); });
  }

  /* ---------- Прив'язка GPS ---------- */
  var B = {};
  function renderBind(id) {
    mapMode = 'bind'; S.moved = false;
    var p = id && id !== 'new' ? S.points.get(id) : null;
    B = { id: id, p: p };
    app.innerHTML = '<svg class="crosshair" width="40" height="52" viewBox="0 0 40 52" role="img" aria-label="Точка лічильника"><path d="M20 50s-17-15-17-29A17 17 0 0137 21c0 14-17 29-17 29z" fill="#111" stroke="#fff" stroke-width="3"/><circle cx="20" cy="21" r="7" fill="' + (p ? ST[p.status].color : '#F59E0B') + '"/></svg>' +
      '<div class="mapui" style="top:18px"><div class="row"><a class="iconbtn" href="' + (p ? '#card/' + p.id : '#map') + '" aria-label="Скасувати">' + icon('close', 20, 2.4) + '</a>' +
      '<div class="pill" style="flex-grow:1;height:48px;flex-direction:column;align-items:flex-start;justify-content:center;gap:0;box-shadow:0 6px 20px rgba(0,0,0,.06)"><span class="small mute" style="font-size:11px">' + (p ? 'Прив\'язуємо' : 'Нова точка') + '</span><span style="font-size:14px;font-weight:800">' + esc(p ? addr(p) : 'Стань біля лічильника') + '</span></div></div></div>' +
      '<div class="sheet" style="bottom:calc(16px + var(--safe-b))">' +
        '<div class="row" style="gap:14px"><div class="acc"><b id="accv">—</b><span class="small mute">метри</span></div><div class="col" style="gap:6px;flex-grow:1"><div id="acct" style="font-size:16px;font-weight:800">Шукаю GPS…</div>' +
        '<div class="row" style="gap:4px" id="accbar">' + [1, 2, 3, 4].map(function () { return '<span style="height:6px;flex-grow:1;border-radius:3px;background:#E4E4E7"></span>'; }).join('') + '</div>' +
        '<div class="small mute">Кнопка працює при ±15 м або після ручного уточнення карти</div></div></div>' +
        (p ? '' : '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><input id="nb-s" class="input" placeholder="Вулиця"><input id="nb-h" class="input" placeholder="Будинок"></div>') +
        '<button class="btn" id="bindBtn" data-act="doBind" disabled>' + icon('pin') + 'Прив\'язати тут</button>' +
        '<div class="small mute" style="text-align:center">Стань біля лічильника, а не біля дороги. Або перетягни карту під мітку.</div>' +
      '</div>';
    var c = p ? [p.lon, p.lat] : S.pos ? [S.pos.lon, S.pos.lat] : null;
    var setup = function () { updateMap(); if (c) map.jumpTo({ center: c, zoom: 18.5 }); };
    if (mapReady) setup(); else S.pendingFit = setup;
    var first = !p;
    startGps();
    var upd = function (pos) {
      var a = Math.round(pos.acc), lvl = a <= 5 ? 4 : a <= 10 ? 3 : a <= 15 ? 2 : a <= 40 ? 1 : 0;
      $('#accv').textContent = '±' + a;
      $('#acct').innerHTML = (lvl >= 2 ? dotHtml('g') + ' Точність добра' : lvl === 1 ? dotHtml('y') + ' Слабка точність' : dotHtml('r') + ' Погана точність');
      document.querySelectorAll('#accbar span').forEach(function (s, i) { s.style.background = i < lvl ? '#111' : '#E4E4E7'; });
      $('#bindBtn').disabled = !(a <= 15 || S.moved);
      if (!S.moved && (first || !p)) { map.jumpTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 18) }); first = false; }
      updateMe();
    };
    onGps(upd); if (S.pos) upd(S.pos);
  }
  function doBind() {
    var c = map.getCenter(), useGps = !S.moved && S.pos;
    var lat = useGps ? S.pos.lat : c.lat, lon = useGps ? S.pos.lon : c.lng, acc = useGps ? S.pos.acc : null;
    var p = B.p;
    if (!p) {
      var s = $('#nb-s').value.trim(), h = $('#nb-h').value.trim();
      var near = null, bd = Infinity; S.points.forEach(function (q) { var d = dist({ lat: lat, lon: lon }, q); if (d < bd && q.village) { bd = d; near = q; } });
      p = { id: 'n' + Date.now().toString(36), lat: lat, lon: lon, village: near && bd < 1500 ? near.village : village(), street: s, house: h, status: 'y', tags: [], note: '',
        src: 'GPS', created: new Date().toISOString().slice(0, 10), flags: [].concat(s ? [] : ['no_street'], h ? [] : ['no_house']) };
      S.points.set(p.id, p);
    } else {
      p.lat = +lat.toFixed(6); p.lon = +lon.toFixed(6); p.acc = acc; p.src = useGps ? 'GPS' : 'вручну'; p.bound = Date.now();
    }
    S.route = null;
    put('points', p).then(function () { toast('Точку прив\'язано'); go('#card/' + p.id); });
  }

  /* ---------- Села ---------- */
  function renderVillages() {
    var vs = villages(), allActive = 0, allRead = 0;
    var rows = vs.map(function (v) {
      var ps = villagePoints(v.name === 'Без села' ? null : v.name);
      if (v.name === 'Без села') ps = Array.from(S.points.values()).filter(function (p) { return !p.village; });
      var c = counts(ps), act = ps.filter(function (p) { return p.status !== 'n'; }), rd = act.filter(readThisCycle).length;
      allActive += act.length; allRead += rd;
      var seg = function (s) { return '<span style="flex:' + c[s] + ' 1 0;min-width:' + (c[s] ? 3 : 0) + 'px;background:' + (s === 'n' ? '#fff;box-sizing:border-box;border:1.5px solid #A1A1AA' : ST[s].color) + '"></span>'; };
      return '<button class="card" data-act="pickVillage" data-v="' + esc(v.name) + '" style="padding:12px 16px;gap:8px;border:0;text-align:left">' +
        '<div class="between"><div class="col"><b style="font-size:15px">' + esc(v.name) + '</b><span class="small mute">' + v.n + ' точок</span></div>' +
        '<div class="row"><span style="width:56px;height:6px;border-radius:3px;background:#F1F1F3;overflow:hidden;display:flex"><span style="width:' + pct(rd, act.length) + '%;background:#111;border-radius:3px"></span></span><b style="font-size:18px;min-width:44px;text-align:right">' + pct(rd, act.length) + '%</b></div></div>' +
        '<div class="bar">' + ST_ORDER.map(seg).join('') + '</div>' +
        '<div class="row small" style="gap:10px;font-size:11px;color:#3F3F46">' + ST_ORDER.map(function (s) { return '<span class="row" style="gap:4px">' + dotHtml(s) + pct(c[s], ps.length) + '%</span>'; }).join('') + '</div></button>';
    });
    var q = queuePoints().length;
    app.innerHTML = '<div class="screen"><div class="col" style="gap:2px;padding:6px 4px 0"><div class="small mute" style="font-size:13px">Здолбунівська дільниця</div><h1 class="h1">Села</h1></div>' +
      '<div class="card big"><div class="between" style="align-items:flex-end"><div class="col" style="gap:2px"><span class="small mute" style="font-size:13px">Знято за ' + monthName().toLowerCase() + ' · усі абоненти</span><span style="font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1">' + pct(allRead, allActive) + '%</span></div>' +
      '<span class="small mute" style="font-size:13px;text-align:right">' + fmt(allRead) + ' з ' + fmt(allActive) + '</span></div><div class="bar" style="height:10px"><span style="width:' + pct(allRead, allActive) + '%;background:#111"></span></div></div>' +
      '<a href="#queue" class="card big dark"><div class="between"><span style="font-size:17px;font-weight:800">Уточнити в полі</span><span class="numbadge" style="background:#F59E0B;color:#111">' + fmt(q) + '</span></div><span class="small mute">Без вулиці чи номера, без села, можливі дублі</span></a>' +
      rows.join('') + '</div>' + tabs('villages');
  }
  function queuePoints() { var out = []; S.points.forEach(function (p) { if ((p.flags || []).some(function (f) { return QUEUE_FLAGS.indexOf(f) >= 0; })) out.push(p); }); return out; }
  var QF = null;
  function renderQueue() {
    var qp = queuePoints(), c = {};
    qp.forEach(function (p) { p.flags.forEach(function (f) { if (QUEUE_FLAGS.indexOf(f) >= 0) c[f] = (c[f] || 0) + 1; }); });
    var list = qp.filter(function (p) { return !QF || p.flags.indexOf(QF) >= 0; });
    var ref = S.pos || centroid(villagePoints().length ? villagePoints() : qp);
    list.sort(function (a, b) { return dist(ref, a) - dist(ref, b); });
    app.innerHTML = '<div class="screen"><div class="row"><a class="iconbtn" href="#villages" aria-label="Назад">' + icon('back', 20, 2.4) + '</a><h1 class="h1" style="font-size:24px">Уточнити в полі</h1></div>' +
      '<div class="tags"><button class="chip' + (!QF ? ' on' : '') + '" data-act="qf" data-v="">Усі · ' + qp.length + '</button>' + QUEUE_FLAGS.filter(function (f) { return c[f]; }).map(function (f) {
        return '<button class="chip' + (QF === f ? ' on' : '') + '" data-act="qf" data-v="' + f + '">' + FLAGNAME[f] + ' · ' + c[f] + '</button>';
      }).join('') + '</div><div class="small mute">Відсортовано за відстанню від вас</div>' +
      '<div class="card" style="gap:0;padding:6px 16px">' + list.slice(0, 150).map(function (p) {
        return '<a class="list-row" href="#card/' + p.id + '">' + dotHtml(p.status) + '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(addr(p)) + '</b><span class="small mute">' + esc(p.village || 'Без села') + ' · ' + p.flags.filter(function (f) { return QUEUE_FLAGS.indexOf(f) >= 0; }).map(function (f) { return FLAGNAME[f]; }).join(', ') + '</span></div><span class="small">' + fdist(dist(ref, p)) + '</span></a>';
      }).join('') + '</div>' + (list.length > 150 ? '<div class="small mute">Показано 150 найближчих з ' + list.length + '</div>' : '') + '</div>' + tabs('villages');
  }

  /* ---------- Список / пошук ---------- */
  var LQ = '';
  function renderList() {
    app.innerHTML = '<div class="screen"><div class="row"><label class="pill" style="flex-grow:1;height:52px" for="lq">' + icon('search', 18) + '<input id="lq" value="' + esc(LQ) + '" placeholder="Адреса, рахунок, ПІБ, серійник" style="border:0;outline:0;background:transparent;width:100%;font-weight:600"></label></div>' +
      '<div class="row"><a class="btn sec" href="#bind/new" style="height:44px">' + icon('plus', 18) + 'Нова точка тут</a></div>' +
      '<div id="lres" class="card" style="gap:0;padding:6px 16px"></div></div>' + tabs('list');
    var inp = $('#lq');
    var run = function () {
      LQ = inp.value.trim().toLowerCase();
      var ref = S.pos, res = [];
      S.points.forEach(function (p) {
        if (!LQ) { if (p.village === village()) res.push(p); return; }
        var f = p.fields || {};
        var hay = [p.village, p.street, p.house, p.orig, p.note, f.fio, f.serial, f.devicePlace, f.phone, f.account].join(' ').toLowerCase();
        if (LQ.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) res.push(p);
      });
      if (ref) res.sort(function (a, b) { return dist(ref, a) - dist(ref, b); });
      else res.sort(function (a, b) { return (a.street || '').localeCompare(b.street || '', 'uk') || (parseInt(a.house) || 0) - (parseInt(b.house) || 0); });
      $('#lres').innerHTML = res.length ? res.slice(0, 120).map(function (p) {
        return '<a class="list-row" href="#card/' + p.id + '">' + dotHtml(p.status) + '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(addr(p)) + '</b><span class="small mute">' + esc(p.village || 'Без села') + ((p.fields || {}).fio ? ' · ' + esc(p.fields.fio) : '') + '</span></div>' + (ref ? '<span class="small">' + fdist(dist(ref, p)) + '</span>' : '') + '</a>';
      }).join('') : '<div class="list-row mute">Нічого не знайдено</div>';
    };
    inp.oninput = function () { clearTimeout(run._t); run._t = setTimeout(run, 150); };
    run(); startGps();
  }

  /* ---------- Налаштування ---------- */
  function renderSettings() {
    var persisted = S.meta._persist;
    app.innerHTML = '<div class="screen"><div class="row"><a class="iconbtn" href="#home" aria-label="Назад">' + icon('back', 20, 2.4) + '</a><h1 class="h1" style="font-size:24px">Дані</h1></div>' +
      '<div class="card"><div class="between"><span class="mute">Точок</span><b>' + fmt(S.points.size) + '</b></div><div class="between"><span class="mute">Візитів</span><b>' + fmt(S.visits.length) + '</b></div>' +
      '<div class="between"><span class="mute">Остання копія</span><b>' + (S.meta.lastBackup ? dt(S.meta.lastBackup) : 'ніколи') + '</b></div><div class="between"><span class="mute">Захист від очищення</span><b>' + (persisted ? 'увімкнено' : 'ні') + '</b></div></div>' +
      '<div class="card">' + sliderHtml('dl', routeCfg().limit) + '</div>' +
      '<button class="btn" data-act="backup">Зберегти резервну копію</button>' +
      '<button class="btn sec" data-act="kml">Експорт у KML (MAPS.ME, Google)</button>' +
      '<label class="btn sec" for="imp2">Відновити з файлу</label><input id="imp2" type="file" accept="application/json,application/octet-stream,text/plain,.json" hidden>' +
      '<div class="small mute" style="line-height:1.5">Усі дані зберігаються лише на цьому телефоні. Робіть резервну копію хоча б раз на кілька днів і зберігайте файл у Google Диск або Telegram «Збережене».</div>' +
      '<div class="small mute">Версія ' + VERSION + ' · карта © OpenStreetMap, супутник © Esri</div></div>';
    $('#imp2').onchange = importFile;
    bindSlider('dl', function (n) { setLimit(n).then(function () { toast('Маршрут: ' + limLabel(n) + ' адрес'); }); });
  }

  /* ---------- події ---------- */
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    switch (a) {
      case 'startRoute': S.filter = null; S.route = computeRoute(); S.sel = S.route && S.route.ids[0]; renderMap.fitNext = true; break;
      case 'filter': e.preventDefault(); var st = el.getAttribute('data-st'); S.filter = S.filter === st ? null : st; S.sel = null;
        if (location.hash !== '#map') go('#map'); else { updateMap(); renderMap.fitNext = false; render(); fitTo(villagePoints().filter(function (p) { return !S.filter || p.status === S.filter; })); } break;
      case 'locate': if (S.pos) { updateMe(); map.easeTo({ center: [S.pos.lon, S.pos.lat], zoom: Math.max(map.getZoom(), 16.5) }); } else toast('Шукаю GPS… Перевірте, чи дозволено геолокацію'); break;
      case 'layer': setLayer(el.getAttribute('data-l')); render(); break;
      case 'skip': S.skipped[S.sel] = 1; S.route = computeRoute(); S.sel = S.route && S.route.ids[0]; updateMap(); renderSheet(); toast('Адресу пропущено до кінця дня'); break;
      case 'saveCard': saveCard(id); break;
      case 'deletePoint': if (confirm('Видалити цю точку? Візити теж зникнуть з карти.')) { S.points.delete(id); S.route = null; del('points', id).then(function () { toast('Точку видалено'); go('#home'); }); } break;
      case 'toggleHist': var h = $('#hist'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; el.querySelector('svg').style.transform = h.style.display === 'none' ? '' : 'rotate(180deg)'; break;
      case 'saveReading': saveReading(id); break;
      case 'res': V.res = el.getAttribute('data-v'); if (V.res === 'empty') V.prof = 'n'; renderVisitKeep(); break;
      case 'prof': V.prof = el.getAttribute('data-v'); renderVisitKeep(); break;
      case 'vtag': var t = el.getAttribute('data-v'), i = V.tags.indexOf(t); if (i >= 0) V.tags.splice(i, 1); else V.tags.push(t); renderVisitKeep(); break;
      case 'saveVisit': saveVisit(id); break;
      case 'doBind': doBind(); break;
      case 'pickVillage': var v = el.getAttribute('data-v'); setMeta('village', v === 'Без села' ? null : v).then(function () { S.route = null; S.sel = null; S.filter = null; go('#home'); }); break;
      case 'pick': doPick(el); break;
      case 'routeCfg': routeCfgSheet(); break;
      case 'showOnMap': var sp = S.points.get(id); if (!sp) break;
        var goMap = function () { S.sel = id; S.filter = null; renderMap.fitNext = true; go('#map'); };
        if (sp.village && sp.village !== village()) setMeta('village', sp.village).then(function () { S.route = null; goMap(); }); else goMap();
        break;
      case 'callPhone': var num = ($('#f-phone').value || '').replace(/[^\d+]/g, ''); if (num.length < 5) { toast('Введіть номер телефону'); $('#f-phone').focus(); } else location.href = 'tel:' + num; break;
      case 'viewPhoto': viewPhoto(el); break;
      case 'addCancel': cancelAdd(); break;
      case 'addSt': S.adding.st = el.getAttribute('data-v'); renderSheet(); break;
      case 'addSave': saveAdd(); break;
      case 'allF': var F = Object.assign({ st: [], cy: [] }, S.meta.allF || {}), g = el.getAttribute('data-g'), vv = el.getAttribute('data-v');
        F[g] = F[g].indexOf(vv) >= 0 ? F[g].filter(function (x) { return x !== vv; }) : F[g].concat([vv]);
        setMeta('allF', F); render(); break;
      case 'allReset': setMeta('allF', { st: [], cy: [] }); render(); break;
      case 'toggleAll': setMeta('allMin', !S.meta.allMin); renderAll.fitNext = false; render(); break;
      case 'toggleSheet': setMeta('sheetMin', !S.meta.sheetMin); renderSheet(); break;
      case 'toggleTiles': setMeta('tilesMin', !S.meta.tilesMin); renderMap.fitNext = false; render(); break;
      case 'pickVillageSheet': pickVillage(); break;
      case 'qf': QF = el.getAttribute('data-v') || null; render(); break;
      case 'backup': exportBackup(); break;
      case 'kml': exportKml(); break;
    }
  }
  function renderVisitKeep() {
    var vr = $('#vr') ? $('#vr').value : '', vn = $('#vn') ? $('#vn').value : '', y = window.scrollY;
    renderVisit(V.id);
    if ($('#vr')) $('#vr').value = vr; if ($('#vn')) $('#vn').value = vn; window.scrollTo(0, y);
  }

  /* ---------- запуск ---------- */
  function load() {
    return Promise.all([all('points'), all('visits'), all('meta')]).then(function (r) {
      S.points = new Map(r[0].map(function (p) { return [p.id, p]; }));
      S.visits = r[1]; S.meta = {}; r[2].forEach(function (m) { S.meta[m.k] = m.v; }); invalidate(); S.route = null;
    });
  }
  function boot() {
    app = $('#app');
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', render);
    openDb().then(load).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (ok) { S.meta._persist = ok; });
      render();
    }).catch(function (e) { app.innerHTML = '<div class="screen"><h1 class="h1">Помилка сховища</h1><p>' + esc(e && e.message) + '</p></div>'; });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
  }
  window.__app = { S: S, computeRoute: computeRoute, map: function () { return map; } };
  boot();
})();

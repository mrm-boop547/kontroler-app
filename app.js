/* Карта контролера · MVP v0.1
   Усі дані зберігаються лише на цьому телефоні (IndexedDB). */
(function () {
  'use strict';
  var VERSION = '0.27.7';

  /* ---------- довідники ---------- */
  var ST = {
    g: { label: 'Доступ завжди', short: 'Завжди', color: '#16A34A' },
    y: { label: 'При власнику', short: 'Власник', color: '#F59E0B' },
    r: { label: 'Нема доступу', short: 'Нема', color: '#DC2626' },
    n: { label: 'Не живуть', short: 'Не живуть', color: '#FFFFFF' }
  };
  var ST_ORDER = ['g', 'y', 'r', 'n'];
  var TAGS = [['dog', 'Собака'], ['eve', 'Після 18:00'], ['wk', 'На вихідних'], ['cam', 'Камера'], ['facade', 'На фасаді'],
    ['call', 'Дзвонити'], ['jur', 'Юридичний'], ['summer', 'Лише влітку'], ['owner', 'Тільки з власником'], ['ruin', 'Аварійний будинок']];
  var TAGNAME = {}; TAGS.forEach(function (t) { TAGNAME[t[0]] = t[1]; });
  /* юридичні споживачі: фіолетові на карті, як у MAPS.ME; доступ (зелений/жовтий/червоний) лишається в картці */
  var JUR = '#7C3AED';
  function isJur(p) { return (p.tags || []).indexOf('jur') >= 0; }
  function stMatch(p, f) { return f === 'jur' ? isJur(p) : p.status === f; }
  /* «Нема доступу» об'єднує «не застав» і «не пустили» (старі записи 'blocked' рахуються сюди ж) */
  var RESULTS = [['ok', 'Зчитано', 'показник внесено'], ['none', 'Нема доступу', 'не застав або не пустили'],
    ['empty', 'Не живуть', 'прибрати з обходу'],
    ['note', 'Візит: записка', 'залишив записку передати показник по телефону']];
  /* «Візит» = залишена фізична записка з проханням передати показник. Рахується окремо і НЕ входить у зчитані:
     невідомо, чи спрацює записка. Адреса виходить з планового обходу, але лишається в «Списку 180», доки показник не надійде. */
  var RESNAME = {}; RESULTS.forEach(function (r) { RESNAME[r[0]] = r[1]; }); RESNAME.blocked = 'Нема доступу';
  var PLACEMENTS = ['', 'В середині житлового будинку', 'В підсобному приміщенні', 'В гаражі', 'В квартирі', 'В щиту сходових клітин',
    'В щитовій підвального приміщення', 'На опорі в ящику', 'На внутрішній стороні паркану', 'На фасаді будинку',
    'На тильній стороні будинку', 'На підсобному приміщенні'];
  var PH_NOTE = 'Показник із фотофіксацією';
  var NOTES = ['', PH_NOTE, 'Самовільне підключення', 'Відсутня/порушена пломба ДП на лічильнику', 'Відсутня/порушена пломба постачальника на клемній',
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
    ['av', 'Номінал автомата', 'select', ['', 'Відсутній', '6', '10', '16', '20', '25', '32', '40', '50', '63', '80', '100', '120']], ['feederOld', "Пофідерна прив'язка (старе значення)", 'text'],
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
  /* Норма: кожен абонент має бути зчитаний хоча б раз на 180 днів (рахується від дати останнього зчитування точки).
     Плановий обхід = села з маршрутних листів на місяць; адреса виходить з планового обходу після будь-якого візиту цього місяця.
     Хто не зчитаний понад 180 днів (або сьогодні не потрапили) → «Список 180» → друге коло після планових робіт. */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function NORM() { return Number(S.meta && S.meta.normDays) || 180; }
  function cycleName() { return 'норма ' + NORM() + ' днів'; }
  function monthKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  var MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  var MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  function monthName() { return MONTHS[new Date().getMonth()]; }
  /* робочі дні контролера — вівторок–субота */
  function isWorkDay(d) { var w = d.getDay(); return w >= 2 && w <= 6; }
  /* робочі дні (вт–сб) від сьогодні до кінця місяця включно */
  function workDaysLeft(from) {
    var d = new Date(from || Date.now()); d.setHours(12, 0, 0, 0); var m = d.getMonth(), n = 0;
    while (d.getMonth() === m) { if (isWorkDay(d)) n++; d.setDate(d.getDate() + 1); }
    return n;
  }
  function csvCell(v) { v = v == null ? '' : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function dayKey(ts) { var d = ts ? new Date(ts) : new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function today() { return dayKey(); }
  function dt(ts) { var d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }
  function tm(ts) { var d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200); }
  /* відключений лічильник: позначка вручну (редагування точки) або з даних обленерго — статус установки / примітка «Відключений…» */
  function isOff(p) { if (p.off != null) return !!p.off; var f = p.fields || {}; var is = f.instStatus || ''; return (/відключ/i.test(is) && !/не\s*відключ/i.test(is)) || /^Відключений/.test(f.noteSel || ''); }
  function addr0(p) { return [p.street, p.house].filter(Boolean).join(', ') || (p.note ? p.note.slice(0, 40) : 'Без адреси'); }
  function isRuin(p) { return (p.tags || []).indexOf('ruin') >= 0; }
  function addr(p) { return addr0(p) + (isOff(p) ? ' (відключено)' : ''); }
  function icon(name, size, sw) {
    size = size || 20; sw = sw || 2.2;
    var P = {
      back: '<path d="M15 18l-6-6 6-6"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>', streets: '<path d="M12 2v20"/><path d="M12 4h6l2.5 2.5L18 9h-6"/><path d="M12 12H6l-2.5 2.5L6 17h6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
      gear: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
      down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', go: '<path d="M7 17L17 7M9 7h8v8"/>',
      check: '<path d="M5 12l5 5 9-10"/>', nav: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
      phone: '<path d="M5 4h4l2 5-3 2a11 11 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z"/>',
      home: '<path d="M4 11l8-7 8 7v9H4z"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
      list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', village: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/>',
      skip: '<path d="M5 5l9 7-9 7zM19 5v14"/>', pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
      locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
      camera: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
      grid: '<path d="M12 3v18M3 12h18"/><rect x="3" y="3" width="18" height="18" rx="4"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
      chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', sync: '<path d="M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
      table: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10"/>', cloud: '<path d="M7 18a5 5 0 01-.6-10A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>'
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
  /* ALL — уся дільниця: усі села разом (маршрут — лише по селах плану, якщо план задано) */
  var ALL = '*';
  function village() { return S.meta.village || null; }
  function vLabel(v) { v = v === undefined ? village() : v; return v === ALL ? 'Уся дільниця' : v || 'Без села'; }
  function newVillage() { var v = village(); return v === ALL ? null : v; }
  function villagePoints(v) { var t = v || village(), out = []; S.points.forEach(function (p) { if (t === ALL || p.village === t) out.push(p); }); return out; }
  /* єдине сортування сіл і вулиць: за абеткою (українською), «Без села / Без вулиці» в кінці */
  function ukSort(a, b) { var na = /^Без /.test(a), nb = /^Без /.test(b); if (na !== nb) return na ? 1 : -1; return String(a).localeCompare(String(b), 'uk', { sensitivity: 'base' }); }
  /* заголовки-літери для довгих списків: А, Б, В… */
  function letterHeads(opts) { var last = ''; return opts.map(function (o) { var L = (o.l || '').charAt(0).toUpperCase(); if (/^Без /.test(o.l)) L = '—'; if (L !== last && !o.head) { last = L; return Object.assign({}, o, { head: L }); } last = L; return o; }); }
  function villages() {
    var c = {}; S.points.forEach(function (p) { var k = p.village || 'Без села'; c[k] = (c[k] || 0) + 1; });
    /* села, додані вручну, видно ще до першої точки в них */
    var dv = S.meta.deletedVillages || {};
    (S.meta.extraVillages || []).forEach(function (v) { if (!c[v] && !dv[v]) c[v] = 0; });
    return Object.keys(c).sort(ukSort).map(function (k) { return { name: k, n: c[k] }; });
  }
  function visitsOf(pid) { return S.visits.filter(function (v) { return v.pointId === pid; }).sort(function (a, b) { return b.ts - a.ts; }); }
  /* останній візит цього місяця + останнє успішне зчитування кожної точки (кеш, скидається при змінах) */
  var cycleCache = null, okCache = null;
  function cycleMap() {
    if (cycleCache) return cycleCache;
    var mk = monthKey(), m = {};
    S.visits.forEach(function (v) { if (monthKey(new Date(v.ts)) === mk) { if (!m[v.pointId] || m[v.pointId].ts < v.ts) m[v.pointId] = v; } });
    return (cycleCache = m);
  }
  function okMap() {
    if (okCache) return okCache;
    var m = {}; S.visits.forEach(function (v) { if ((v.result === 'ok' || v.result === 'empty') && (!m[v.pointId] || m[v.pointId].ts < v.ts)) m[v.pointId] = v; });
    return (okCache = m);
  }
  function invalidate() { cycleCache = null; okCache = null; }
  function daysSince(ts) { return Math.floor((Date.now() - ts) / 864e5); }
  /* відвідано в цьому місяці (будь-який результат) — з планового обходу виходить */
  /* адреса вже не потребує обходу: зчитана в межах норми (180 днів), навіть якщо минулого разу, або вже відвідана цього місяця.
     Так у село, куди їздять раз на 2–6 міс., ідемо лише туди, де не зчитали */
  function doneThisCycle(p) { return readThisCycle(p) || !!cycleMap()[p.id]; }
  /* стан на карті: 'ok' — зчитано в межах норми; 'v' — цього місяця був, але без показника */
  function vstate(p) { if (p.status !== 'n' && readThisCycle(p)) return 'ok'; var x = cycleMap()[p.id]; return x && x.result !== 'ok' ? 'v' : x ? 'ok' : null; }
  /* зчитано в межах норми (180 днів) */
  function readThisCycle(p) { var v = okMap()[p.id]; return !!(v && daysSince(v.ts) < NORM()); }
  /* «Список 180»: не зчитано понад норму — або старе зчитування, або цього місяця не потрапили, або позначка з маршрутного листа */
  function in180(p) {
    if (p.status === 'n' || readThisCycle(p)) return false;
    var ok = okMap()[p.id], mv = cycleMap()[p.id], f = p.fields || {};
    return !!(ok || (mv && (mv.result === 'none' || mv.result === 'blocked' || mv.result === 'note')) || f.d180);
  }
  function visitedToday(p) { var v = cycleMap()[p.id]; return !!(v && dayKey(v.ts) === today()); }
  function daysLabel(p) { var v = okMap()[p.id]; return v ? daysSince(v.ts) + ' дн. тому' : 'немає зчитувань'; }

  /* ---------- місячний план: села з маршрутних листів на поточний місяць ---------- */
  function plan() { var p = S.meta.plan; return p && p.month === monthKey() && p.villages && p.villages.length ? p : null; }
  function inPlan(v) { var p = plan(); return !p || p.villages.indexOf(v) >= 0; }
  function planStats() {
    var p = plan(); if (!p) return null;
    var act = 0, done = 0, read = 0, byV = {};
    S.points.forEach(function (q) {
      if (p.villages.indexOf(q.village) < 0 || q.status === 'n') return;
      var b = byV[q.village] = byV[q.village] || { act: 0, done: 0 };
      act++; b.act++; if (doneThisCycle(q)) { done++; b.done++; } if (readThisCycle(q)) read++;
    });
    var left = act - done, days = workDaysLeft();
    return { act: act, done: done, read: read, left: left, days: days, pace: days ? Math.ceil(left / days) : left, byV: byV };
  }
  /* наступне село плану з невиконаними адресами — найближче до мене */
  function nextPlanVillage(except) {
    var st = planStats(); if (!st) return null;
    var best = null, bd = Infinity;
    plan().villages.forEach(function (v) {
      var b = st.byV[v]; if (!b || b.done >= b.act || v === except) return;
      var d = S.pos ? dist(S.pos, centroid(villagePoints(v))) : 0;
      if (d < bd) { bd = d; best = v; }
    });
    return best;
  }

  /* ---------- хто я: ідентифікатор пристрою для синхронізації між контролерами ---------- */
  function me() { return S.meta.me || { id: 'local', name: '' }; }
  function peerName(id) { if (!id || id === me().id) return 'я'; var p = (S.meta.peers || {})[id]; return p && p.name ? p.name : 'колега'; }
  /* кожна зміна точки ставить час і автора — так злиття від кількох контролерів знає, яка версія новіша */
  /* id нової точки містить код пристрою — дві точки з різних телефонів ніколи не отримають однаковий id */
  function dev() { return S.meta.device || me().id; }
  /* код встановлення: живе лише в цьому браузері (не в базі й не в резервній копії) — розрізняє телефони, навіть якщо їх відновили з однієї копії */
  var INST = null;
  function inst() { if (INST) return INST; try { INST = localStorage.getItem('kc-inst'); if (!INST) { INST = Math.random().toString(36).slice(2, 10); localStorage.setItem('kc-inst', INST); } } catch (x) { INST = INST || Math.random().toString(36).slice(2, 10); } return INST; }
  function newPid() { return 'n' + dev() + Date.now().toString(36); }
  function normHouse(h) { return String(h || '').toLowerCase().replace(/[\s\-–]/g, '').replace(/[\\]/g, '/'); }
  function normStreet(st) { return String(st || '').toLowerCase().replace(/^(вул\.?|вулиця|пров\.?|провулок)\s+/, '').replace(/\s+/g, ' ').trim(); }
  /* можливий дубль: та сама адреса в тому ж селі, або точка ближче 10 м з тим самим номером чи без номера */
  function findDup(q) {
    var best = null, bd = Infinity, sh = normHouse(q.house), ss = normStreet(q.street);
    S.points.forEach(function (p) {
      if (p.id === q.id || p.status === 'n' && q.status !== 'n' || (q.notDup || []).indexOf(p.id) >= 0 || (p.notDup || []).indexOf(q.id) >= 0) return;
      var d = dist(p, q), same = sh && ss && p.village === q.village && normHouse(p.house) === sh && normStreet(p.street) === ss;
      var close = d < 10 && (!sh || !p.house || normHouse(p.house) === sh);
      if ((same || close) && d < bd) { bd = d; best = p; }
    });
    return best ? { p: best, d: bd } : null;
  }
  /* перед додаванням нової точки: якщо така вже є — пропонуємо відкрити наявну замість дубля */
  function dupGuard(p) {
    var d = findDup(p); if (!d) return true;
    if (confirm('Схоже, ця точка вже є: ' + addr(d.p) + ' (' + Math.round(d.d) + ' м' + (d.p.createdBy && d.p.createdBy !== me().id ? ', вніс ' + peerName(d.p.createdBy) : '') + ').\n\nВсе одно додати нову?')) return true;
    go('#card/' + d.p.id); return false;
  }
  function whoName(id) { return id === me().id ? (me().name || 'я') + ' (я)' : peerName(id) === 'колега' ? 'Контролер ' + id : peerName(id); }
  function authorOf(p) { return p.createdBy ? peerName(p.createdBy) === 'я' ? 'ви' : peerName(p.createdBy) : p.src === 'MAPS.ME' ? 'імпорт з MAPS.ME' : '—'; }
  /* об'єднати дубль: лишаємо картку keep, з другої переносимо поля, мітки, нотатки, візити, фото; друга видаляється з «надгробком» */
  function mergeDup(keepId, otherId) {
    var k = S.points.get(keepId), o = S.points.get(otherId); if (!k || !o) return;
    var f = Object.assign({}, o.fields || {}, k.fields || {});
    Object.keys(o.fields || {}).forEach(function (x) { if (!f[x]) f[x] = o.fields[x]; });
    k.fields = f; k.tags = (k.tags || []).concat((o.tags || []).filter(function (t) { return (k.tags || []).indexOf(t) < 0; }));
    if (o.note && (k.note || '').indexOf(o.note) < 0) k.note = k.note ? k.note + '; ' + o.note : o.note;
    if (!k.street && o.street) k.street = o.street; if (!k.house && o.house) k.house = o.house;
    if (/GPS|вручну/.test(o.src || '') && !/GPS|вручну/.test(k.src || '')) { k.lat = o.lat; k.lon = o.lon; k.src = o.src; k.acc = o.acc; }
    k.flags = (k.flags || []).filter(function (x) { return x !== 'dup'; }); delete k.dupOf;
    var mg = Object.assign({}, S.meta.merged || {}); mg[otherId] = keepId;
    Object.keys(mg).forEach(function (x) { if (mg[x] === otherId) mg[x] = keepId; });
    var tb = Object.assign({}, S.meta.deleted || {}); tb[otherId] = Date.now();
    S.visits.forEach(function (v) { if (v.pointId === otherId) v.pointId = keepId; });
    photosOf(otherId).then(function (ph) { ph.forEach(function (x) { x.pointId = keepId; put('photos', x); }); });
    S.points.delete(otherId); invalidate(); S.route = null;
    Promise.all([setMeta('merged', mg), setMeta('deleted', tb), del('points', otherId), savePoint(k)]).then(function () { toast('Об\'єднано в одну точку'); R = {}; go('#card/' + keepId); });
  }
  function notDup(id, otherId) {
    [[id, otherId], [otherId, id]].forEach(function (pr) {
      var p = S.points.get(pr[0]); if (!p) return;
      p.flags = (p.flags || []).filter(function (x) { return x !== 'dup'; }); p.notDup = (p.notDup || []).concat([pr[1]]); delete p.dupOf; savePoint(p);
    });
    toast('Позначено як різні точки'); render();
  }
  /* спільні налаштування дільниці (план, номери маршрутів, кількість абонентів, контролерів): синхронізуються між телефонами, перемагає новіша зміна */
  var SHARED = ['plan', 'routeNo', 'vTotals', 'totalSubs', 'crewN'];
  function shareSet(k, v) { var ts = Object.assign({}, S.meta.sharedTs || {}); ts[k] = Date.now(); return Promise.all([setMeta(k, v), setMeta('sharedTs', ts)]).then(function () { scheduleSync(); }); }
  /* аварійний будинок: ніхто не живе, може завалитись і обірвати проводи. Час позначки потрібен бригаді (нова задача),
     статус одразу «Не живуть» */
  function ruinMark(p) {
    var on = (p.tags || []).indexOf('ruin') >= 0;
    if (on && !p.ruinTs) { p.ruinTs = Date.now(); p.status = 'n'; } else if (!on && p.ruinTs) delete p.ruinTs;
  }
  function savePoint(p) { ruinMark(p); p.updated = Date.now(); p.by = me().id; scheduleSync(); return put('points', p); }
  function newVisit(o) { o.ts = o.ts || Date.now(); o.by = me().id; o.uid = dev() + '-' + o.ts.toString(36); scheduleSync(); return o; }

  /* ---------- GPS ---------- */
  var watchId = null, gpsListeners = [], gpsRetry = null;
  /* GPS без інтернету: на телефоні немає допоміжних даних (A-GPS), тому перше визначення займає 1–3 хв.
     1) одразу беремо останню відому телефону позицію (працює офлайн), 2) стежимо без тайм-ауту,
     3) при помилці перезапускаємо стеження, 4) зберігаємо останню позицію, щоб після перезапуску застосунку карта знала, де ви */
  function gpsSet(pos, stale) {
    var c = pos.coords, ts = pos.timestamp || Date.now();
    if (S.pos && !S.pos.stale && stale) return;
    S.pos = { lat: c.latitude, lon: c.longitude, acc: stale ? Math.max(c.accuracy || 0, 100) : c.accuracy, ts: ts, stale: !!stale };
    if (!stale) try { localStorage.setItem('lastPos', JSON.stringify(S.pos)); } catch (e) {}
    gpsListeners.forEach(function (f) { f(S.pos); });
  }
  function startGps() {
    if (!navigator.geolocation) return;
    if (!S.pos) try { var lp = JSON.parse(localStorage.getItem('lastPos') || 'null'); if (lp && Date.now() - lp.ts < 6 * 3600e3) { lp.stale = true; lp.acc = Math.max(lp.acc || 0, 100); S.pos = lp; } } catch (e) {}
    if (watchId !== null) return;
    navigator.geolocation.getCurrentPosition(function (pos) { gpsSet(pos, Date.now() - pos.timestamp > 60000); }, function () {}, { enableHighAccuracy: false, maximumAge: Infinity, timeout: 10000 });
    watchId = navigator.geolocation.watchPosition(function (pos) { gpsSet(pos, false); }, function (err) {
      /* доступ заборонено: знімаємо стеження, щоб наступний екран спробував знову (раптом дозволили в налаштуваннях) */
      if (err.code === 1) { navigator.geolocation.clearWatch(watchId); watchId = null; if (Date.now() - (startGps.warned || 0) > 60000) { startGps.warned = Date.now(); toast('Дозвольте доступ до геолокації'); } return; }
      /* немає сигналу або тайм-аут: перезапускаємо стеження, GPS-модуль продовжує шукати супутники */
      clearTimeout(gpsRetry); gpsRetry = setTimeout(restartGps, 3000);
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    S.gpsStart = Date.now();
  }
  /* сторож: Chrome на Android іноді «засинає» стеження без жодної помилки — тоді місце не оновлюється ніколи.
     Якщо 40 с немає жодного свіжого визначення — перезапускаємо стеження */
  setInterval(function () {
    if (watchId === null || document.visibilityState !== 'visible') return;
    var fresh = S.pos && !S.pos.stale && Date.now() - S.pos.ts < 40000;
    if (!fresh && Date.now() - (S.gpsStart || 0) > 40000) restartGps();
  }, 10000);
  /* кнопка «Моя позиція» без місця: пояснюємо точну причину і одразу пробуємо знову */
  function gpsWhy() {
    restartGps();
    var say = function (st) {
      if (st === 'denied') toast('Геолокацію заборонено для цього сайту. Chrome → ⋮ → Налаштування → Налаштування сайтів → Місцезнаходження → дозволити');
      else if (!navigator.onLine) toast('Шукаю супутники без інтернету, це до 1–3 хв. Краще на відкритому місці');
      else toast('Шукаю GPS… Якщо довго, перевірте, що на телефоні увімкнено «Місцезнаходження»');
    };
    if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(function (r) { say(r.state); }, function () { say(''); });
    else say('');
  }
  function restartGps() { if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; } startGps(); }
  function onGps(f) { gpsListeners.push(f); }
  function offGps() { gpsListeners = []; }

  /* ---------- маршрут ---------- */
  /* слайдер кількості адрес: 10…150, крайнє праве положення = «Усі» */
  var LIM_MAX = 160;
  function limLabel(n) { return n >= 9999 || n >= LIM_MAX ? 'Усі' : String(n); }
  function sliderHtml(id, n, label) {
    var v = n >= 9999 ? LIM_MAX : Math.min(LIM_MAX, n);
    return '<div class="sld"><div class="between"><span class="small mute">' + (label || 'Скільки адрес') + '</span><b class="sld-val" id="' + id + '-v">' + limLabel(n) + '</b></div>' +
      '<input type="range" class="range" id="' + id + '" min="10" max="' + LIM_MAX + '" step="5" value="' + v + '" style="--p:' + ((v - 10) / (LIM_MAX - 10) * 100) + '%">' +
      '<div class="between small mute"><span>10</span><span>50</span><span>100</span><span>Усі</span></div></div>';
  }
  function bindSlider(id, onSet) {
    var el = $('#' + id) || document.getElementById(id); if (!el) return;
    var upd = function () { var v = +el.value; el.style.setProperty('--p', ((v - 10) / (LIM_MAX - 10) * 100) + '%'); (document.getElementById(id + '-v') || {}).textContent = limLabel(v); return v >= LIM_MAX ? 9999 : v; };
    el.oninput = function () { upd(); };
    el.onchange = function () { onSet(upd()); };
  }
  /* ціль на день = довжина маршруту; прогрес — скільки показників я зняв сьогодні (різні точки) */
  function todayRead() { var me0 = me().id, t = today(), m = {}; S.visits.forEach(function (v) { if (v.result === 'ok' && (v.by || me0) === me0 && dayKey(v.ts) === t) m[v.pointId] = 1; }); return Object.keys(m).length; }
  /* скільки треба кожному на день, щоб закрити місячний план: залишок ÷ робочі дні ÷ контролери, кратне 5 */
  function goalHint() {
    var st = planStats(); if (!st || !st.left) return null;
    var n = Math.ceil(st.left / Math.max(1, st.days) / Math.max(1, crew()));
    return { n: Math.max(10, Math.min(150, Math.ceil(n / 5) * 5)), raw: n, days: st.days, crew: crew() };
  }
  function goalLine() {
    var g = routeCfg().limit, n = todayRead();
    if (g >= 9999) return '<div class="small mute">Сьогодні знято ' + n + '</div>';
    var ok = n >= g;
    return '<div class="progress"' + (ok ? ' style="background:rgba(22,163,74,.25)"' : '') + '><span style="width:' + Math.min(100, pct(n, g)) + '%' + (ok ? ';background:#22C55E' : '') + '"></span></div>' +
      '<div class="small' + (ok ? '' : ' mute') + '"' + (ok ? ' style="color:#4ADE80;font-weight:700"' : '') + '>' + (ok ? 'Ціль виконано · ' + n + ' з ' + g : 'Сьогодні: ' + n + ' з ' + g + ' · ціль на день') + '</div>';
  }
  function setLimit(n) {
    var nc = Object.assign({}, S.meta.routeCfg || {}); nc.limit = n;
    setMeta('dayLimit', n); return setMeta('routeCfg', nc).then(function () { S.route = null; });
  }

  /* ---------- налаштування маршруту ---------- */
  function routeCfg() {
    var c = S.meta.routeCfg || {};
    return { round: c.round === '180' ? '180' : 'plan', auto: c.auto !== false, limit: c.limit || Number(S.meta.dayLimit) || 40, types: c.types && c.types.length ? c.types : ['g', 'y', 'r'], streets: c.streets || {} };
  }
  /* «вартість» переходу: зміна вулиці дорожча — маршрут іде вздовж вулиці, а не зигзагом через квартал */
  function cost(a, b) { var d = dist(a, b); return a.street && b.street && a.street !== b.street ? d * 1.6 + 40 : d; }
  function computeRoute() {
    var v = village(); if (!v) return null;
    var cfg = routeCfg(), st = v === ALL ? [] : cfg.streets[v] || [];
    var r180 = cfg.round === '180';
    /* плановий обхід: ще не відвідані цього місяця; коло 180: не зчитані довше за норму */
    var all = villagePoints(v).filter(function (p) { return p.status !== 'n' && (r180 ? in180(p) && !visitedToday(p) : !doneThisCycle(p)) && (v !== ALL || inPlan(p.village)); });
    var cand = all.filter(function (p) { return !S.skipped[p.id] && cfg.types.indexOf(p.status) >= 0 && (!st.length || st.indexOf(p.street) >= 0) && inMySector(p); });
    if (!cfg.auto) return { village: v, ids: [], meters: 0, total: cand.length, off: true };
    if (!cand.length) return { village: v, ids: [], meters: 0, total: 0 };
    var start = S.pos && dist(S.pos, cand[0]) < 30000 ? S.pos : centroid(cand);
    var late = cand.filter(function (p) { return (p.tags || []).indexOf('eve') >= 0; });
    var early = cand.filter(function (p) { return (p.tags || []).indexOf('eve') < 0; });
    var limit = cfg.limit >= 9999 ? cand.length : cfg.limit;
    var lateN = Math.min(late.length, Math.round(limit * 0.25));
    var order = nn(start, early, cost, Math.max(1, limit - lateN));
    order = twoOpt(start, order, 300, cost);
    var last = order.length ? order[order.length - 1] : start;
    order = order.concat(nn(last, late, cost, Math.max(0, limit - order.length)));
    var m = 0, prev = start;
    order.forEach(function (p) { m += dist(prev, p); prev = p; });
    var r = { village: v, ids: order.map(function (p) { return p.id; }), meters: m, total: cand.length, fromGps: start === S.pos, start: { lat: start.lat, lon: start.lon } };
    r.key = routeKey(r);
    setTimeout(function () { improveRoute(r); }, 0);
    return r;
  }
  /* якщо в селі є розподіл вулиць і я в ньому — маршрут лише по моїх вулицях */
  function inMySector(p) { var s = splitOf(p.village), m = myIdx(s); if (m == null) return true; var a = s.assign[p.id]; return a == null || a === m; }
  function routeKey(r) { return r.start.lat.toFixed(4) + ',' + r.start.lon.toFixed(4) + ':' + r.ids.join(','); }
  function centroid(ps) { var a = 0, b = 0; ps.forEach(function (p) { a += p.lat; b += p.lon; }); return { lat: a / ps.length, lon: b / ps.length }; }
  function nn(start, pts, cf, max) {
    cf = cf || dist; max = max == null ? pts.length : max;
    var rest = pts.slice(), out = [], cur = start;
    while (rest.length && out.length < max) {
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
        if (location.hash === '#map') { updateMap(); renderSheetSoft(); }
      });
    }).catch(function () { if (!S.walkWarned && location.hash === '#map') { S.walkWarned = 1; toast('Пішохідний маршрут недоступний, показано напряму'); } });
  }
  function routeCfgSheet() {
    var c = routeCfg(), v = village(), T = { auto: c.auto, limit: c.limit, types: c.types.slice(), streets: (c.streets[v] || []).slice() };
    var streets = {}; if (v !== ALL) villagePoints(v).forEach(function (p) { if (p.status !== 'n' && p.street) streets[p.street] = (streets[p.street] || 0) + 1; });
    var names = Object.keys(streets).sort(ukSort);
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
        (v === ALL ? '<div class="small mute">Уся дільниця: маршрут іде через усі села' + (plan() ? ' плану' : '') + ', починаючи від вас</div>' : '') +
        (v === ALL ? '' : '<div class="col" style="gap:8px"><div class="small mute">Вулиці (сектор)</div><div class="tags">' + chip('street', '', 'Усі вулиці', !T.streets.length) +
          names.map(function (n) { return chip('street', n, esc(n) + ' <span style="opacity:.6">' + streets[n] + '</span>', T.streets.indexOf(n) >= 0); }).join('') + '</div></div>') +
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
      var y = ov.querySelector('.pk-list').scrollTop; draw(); ov.querySelector('.pk-list').scrollTop = y;
    });
    draw(); document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('show'); });
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
    var full = location.hash || '#home', st = S.nav = S.nav || [];
    if (st[st.length - 1] !== full) { if (st[st.length - 2] === full) st.pop(); else { st.push(full); if (st.length > 30) st.shift(); } }
    var h = full.slice(1).split('/');
    document.body.classList.remove('fopen');
    var name = h[0] || 'home', arg = h[1] ? decodeURIComponent(h[1]) : null;
    /* аналітика щоразу відкривається на «Сьогодні»; вибраний період тримається, лише поки ви на цьому екрані */
    if (name === 'report' && S.lastScreen !== 'report') RP = 'day';
    S.lastScreen = name;
    offGps();
    if (name !== 'bind' && S.layerBeforeBind) { var lb = S.layerBeforeBind; S.layerBeforeBind = null; if (map) setLayer(lb); else setMeta('layer', lb); }
    showMap(name === 'map' || name === 'bind' || name === 'all' || name === 'sectors');
    if (name !== 'map' && name !== 'all') cancelAdd(true);
    if (!S.points.size && name !== 'settings') return renderEmpty();
    /* без входу контролера працювати не можна: кожен візит і кожна точка записуються на когось */
    if (!me().login && name !== 'settings') return renderLogin();
    var f = { home: renderHome, map: renderMap, all: renderAll, card: renderRead, visit: function (id) { location.replace('#card/' + id); }, read: renderRead, village: renderVillage, brigade: renderBrigade, bind: renderBind, villages: renderVillages,
      list: function () { S.focusSearch = true; location.replace('#all'); }, profile: renderProfile, queue: renderQueue, settings: renderSettings, me: renderMe, login: renderLogin, plan: renderPlan, sectors: renderSectors, report: renderReport }[name] || renderHome;
    f(arg);
    window.scrollTo(0, 0);
    syncWake();
  }
  /* «Назад» — туди, звідки прийшли в застосунку (власна історія), а не вихід із застосунку */
  function goBack() { var st = S.nav || []; st.pop(); var prev = st[st.length - 1] || '#home'; if (prev === location.hash) prev = '#home'; location.hash = prev; }
  function tabs(active) {
    /* одна вкладка «Карта» замість «Обхід» і «Мітки»: всередині перемикач Маршрут / Усі точки */
    var mt = S.meta.mapTab === 'all' ? 'all' : 'map';
    var t = [['home', 'Головна', 'home'], ['villages', 'Огляд', 'chart'], [mt, 'Карта', 'map'], ['me', 'Я', 'user']];
    if (active === 'all') active = mt;
    return '<nav class="tabs">' + t.map(function (x) {
      var on = x[0] === active;
      return '<a href="#' + x[0] + '" class="' + (on ? 'on' : '') + '">' + icon(x[2], on ? 18 : 20) + x[1] + '</a>';
    }).join('') + '</nav>';
  }

  /* ---------- Вхід контролера ----------
     Умовний логін без пароля: ПІБ + табельний номер. Ідентифікатор контролера будується з табельного номера
     (або з ПІБ, якщо номера немає) — тому та сама людина на іншому телефоні отримує той самий ідентифікатор,
     і всі її візити й точки лишаються за нею. На одному телефоні можна перемикатися між контролерами. */
  function personId(name, tab) {
    var t = String(tab || '').replace(/\D/g, '');
    if (t) return 't' + t;
    var h = 0, n = String(name || '').toLowerCase().replace(/[^a-zа-яіїєґ']/g, '');
    for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return 'u' + h.toString(36);
  }
  function renderLogin() {
    var users = S.meta.users || [];
    app.innerHTML = '<div class="screen"><div class="empty" style="justify-content:flex-start;padding-top:32px">' +
      '<div class="col" style="gap:6px"><div class="small mute" style="font-size:13px">Карта контролера</div><h1 class="h1">Хто працює?</h1>' +
      '<div class="small mute" style="line-height:1.5">Усі візити, показники й нові точки записуються на контролера, який увійшов. Колеги бачитимуть, хто що вніс.</div></div>' +
      (users.length ? '<div class="col" style="gap:8px"><div class="small mute">Вже входили на цьому телефоні</div>' + users.map(function (u) {
        return '<button class="pk-row" data-act="loginAs" data-v="' + esc(u.id) + '"><span class="col" style="gap:2px"><span>' + esc(u.name) + '</span><span class="small" style="opacity:.6">' + (u.tab ? 'таб. № ' + esc(u.tab) : 'без табельного') + '</span></span>' + icon('right', 18, 2.4) + '</button>';
      }).join('') + '<div class="small mute" style="padding-top:6px">Або новий контролер</div></div>' : '') +
      '<div class="card" style="gap:12px"><div class="field"><label for="lg-n">Прізвище та ім\'я</label><input id="lg-n" class="input" autocomplete="name" placeholder="Прізвище Ім\'я"></div>' +
      '<div class="field"><label for="lg-t">Табельний номер</label><input id="lg-t" class="input" inputmode="numeric" placeholder="Напр. 10452"></div>' +
      '<div class="small mute" style="line-height:1.45">За табельним номером ваші дані впізнаються на будь-якому телефоні. Без нього — за прізвищем та ім\'ям.</div>' +
      '<button class="btn" data-act="login">Увійти</button></div></div></div>';
  }
  function doLogin(u) {
    var old = me(), wasAnon = !old.login && old.id && old.id !== u.id;
    var users = (S.meta.users || []).filter(function (x) { return x.id !== u.id; }); users.unshift({ id: u.id, name: u.name, tab: u.tab || '' });
    var next = { id: u.id, name: u.name, tab: u.tab || '', login: true, since: Date.now() };
    var jobs = [setMeta('me', next), setMeta('users', users.slice(0, 10))];
    /* усе, що було зроблено на телефоні до першого входу, переходить до першого контролера, який увійшов */
    if (wasAnon && !(S.meta.users || []).length) {
      var tx = db.transaction(['points', 'visits'], 'readwrite');
      S.visits.forEach(function (v) { if (!v.by || v.by === old.id) { v.by = u.id; if (v.id != null) tx.objectStore('visits').put(v); } });
      S.points.forEach(function (p) { var ch = false; if (p.by === old.id) { p.by = u.id; ch = true; } if (p.createdBy === old.id) { p.createdBy = u.id; ch = true; } if (ch) tx.objectStore('points').put(p); });
      jobs.push(new Promise(function (ok) { tx.oncomplete = ok; tx.onerror = ok; }));
    }
    /* інші контролери цього телефона стають «колегами» — їхні записи підписані їхніми іменами */
    var peers = Object.assign({}, S.meta.peers || {}); delete peers[u.id];
    (S.meta.users || []).forEach(function (x) { if (x.id !== u.id) peers[x.id] = Object.assign({ last: null, visits: 0 }, peers[x.id] || {}, { name: x.name, local: true }); });
    jobs.push(setMeta('peers', peers));
    Promise.all(jobs).then(function () { invalidate(); S.route = null; toast('Вітаю, ' + u.name.split(' ').slice(-1)[0]); go('#home'); setTimeout(function () { ghSync(false); }, 1500); });
  }
  function loginSubmit() {
    var n = ($('#lg-n').value || '').trim().replace(/\s+/g, ' '), t = ($('#lg-t').value || '').replace(/\D/g, '');
    if (n.split(' ').length < 2) { toast('Впишіть прізвище та ім\'я'); return $('#lg-n').focus(); }
    doLogin({ id: personId(n, t), name: n, tab: t });
  }
  /* редагування даних контролера. Якщо змінився табельний номер (а отже ID) — усі записи переводяться на новий ID,
     а відповідність старий→новий передається колегам під час обміну, щоб і в них записи лишились за тією ж людиною */
  function renderProfile() {
    var u = me();
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><h1 class="h1" style="font-size:24px">Дані контролера</h1></div>' +
      '<div class="card" style="gap:12px"><div class="field"><label for="pf-n">Прізвище та ім\'я</label><input id="pf-n" class="input" value="' + esc(u.name) + '"></div>' +
      '<div class="field"><label for="pf-t">Табельний номер</label><input id="pf-t" class="input" inputmode="numeric" value="' + esc(u.tab || '') + '"></div>' +
      '<div class="field"><label for="pf-d">Дільниця</label><input id="pf-d" class="input" value="' + esc(u.district || 'Здолбунівська') + '"></div>' +
      '<div class="small mute" style="line-height:1.5">Ваш ID: ' + esc(u.id) + '. Якщо змінити табельний номер, ID зміниться, а всі ваші відмітки й точки автоматично перейдуть на новий. Колеги отримають цю зміну під час обміну даними.</div>' +
      '<button class="btn" data-act="profileSave">Зберегти</button></div></div>';
  }
  function profileSave() {
    var u = me(), n = ($('#pf-n').value || '').trim().replace(/\s+/g, ' '), t = ($('#pf-t').value || '').replace(/\D/g, ''), d = ($('#pf-d').value || '').trim();
    if (n.split(' ').length < 2) { toast('Впишіть прізвище та ім\'я'); return $('#pf-n').focus(); }
    var nid = u.tab || t ? (t ? 't' + t : personId(n, '')) : u.id;
    if (!t && !u.tab) nid = u.id; /* без табельного ID лишається тим самим, навіть якщо виправили ім'я */
    var next = Object.assign({}, u, { name: n, tab: t, district: d, id: nid });
    var jobs = [];
    if (nid !== u.id) {
      if (!confirm('Табельний номер змінено. Ваш ID стане ' + nid + ', усі ваші записи перейдуть на нього. Продовжити?')) return;
      var tx = db.transaction(['points', 'visits'], 'readwrite');
      S.visits.forEach(function (v) { if (v.by === u.id) { v.by = nid; if (v.id != null) tx.objectStore('visits').put(v); } });
      S.points.forEach(function (p) { var ch = false; if (p.by === u.id) { p.by = nid; ch = true; } if (p.createdBy === u.id) { p.createdBy = nid; ch = true; } if (ch) tx.objectStore('points').put(p); });
      jobs.push(new Promise(function (ok) { tx.oncomplete = ok; tx.onerror = ok; }));
      var al = Object.assign({}, S.meta.idAlias || {}); al[u.id] = nid; jobs.push(setMeta('idAlias', al));
    }
    var users = (S.meta.users || []).filter(function (x) { return x.id !== u.id && x.id !== nid; }); users.unshift({ id: nid, name: n, tab: t });
    jobs.push(setMeta('me', next), setMeta('users', users));
    Promise.all(jobs).then(function () { invalidate(); toast('Дані збережено'); location.hash = '#me'; });
  }
  document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.getAttribute && d.getAttribute('data-fold')) { S.meFold = S.meFold || {}; S.meFold[d.getAttribute('data-fold')] = d.open; } }, true);
  function renderMe() {
    var u = me(), id = u.id, mk = monthKey();
    var vis = S.visits.filter(function (v) { return v.by === id; }), visM = vis.filter(function (v) { return monthKey(new Date(v.ts)) === mk; });
    var readM = visM.filter(function (v) { return v.result === 'ok'; }).length;
    var added = 0, addedM = 0, bound = 0;
    S.points.forEach(function (p) { if (p.createdBy === id) { added++; if ((p.created || '').slice(0, 7) === mk) addedM++; } if (p.by === id && p.bound && /GPS|вручну/.test(p.src || '')) bound++; });
    var ini = u.name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    app.innerHTML = '<div class="screen">' +
      '<div class="card big dark" style="gap:14px"><div class="row" style="gap:14px"><span style="width:56px;height:56px;border-radius:28px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;flex-shrink:0">' + esc(ini) + '</span>' +
        '<div class="col" style="gap:2px;min-width:0;flex-grow:1"><b style="font-size:20px">' + esc(u.name) + '</b><span class="small mute">' + (u.tab ? 'Табельний № ' + esc(u.tab) : 'Без табельного номера') + ' · ID ' + esc(id) + '</span></div>' +
        '<a class="iconbtn" href="#profile" aria-label="Редагувати дані контролера" style="background:#2A2A2E;color:#fff;box-shadow:none;flex-shrink:0;width:48px;height:48px">' + icon('edit', 18) + '</a>' +
        '<button class="iconbtn" data-act="logout" aria-label="Змінити контролера" title="Змінити контролера" style="background:#2A2A2E;color:#fff;box-shadow:none;flex-shrink:0;width:48px;height:48px">' + icon('sync', 20) + '</button></div>' +
        '<div class="small mute">' + esc((u.district || 'Здолбунівська') + ' дільниця') + ' · на цьому телефоні з ' + (u.since ? dt(u.since) : '—') + '</div></div>' +
      '<div class="card"><div class="h2" style="font-size:15px">Мої дані · ' + monthName().toLowerCase() + '</div>' +
        '<div class="grid3"><div class="col"><b style="font-size:24px">' + fmt(visM.length) + '</b><span class="small mute">адрес пройдено</span></div><div class="col"><b style="font-size:24px">' + fmt(readM) + '</b><span class="small mute">зчитано</span></div><div class="col"><b style="font-size:24px">' + fmt(addedM) + '</b><span class="small mute">нових точок</span></div></div>' +
        '<div class="small mute" style="line-height:1.5">За весь час: ' + fmt(vis.length) + ' адрес · ' + fmt(vis.filter(function (v) { return v.result === 'note'; }).length) + ' записок · внесено ' + fmt(added) + ' точок · прив\'язано ' + fmt(bound) + '</div>' +
        '<button class="btn sec" data-act="myPoints" style="height:46px">' + icon('pin', 18) + 'Мої точки на карті</button></div>' +
      routeCardHtml() +
      settingsBody(true) +

      '</div>' + tabs('me');
    bindSettings();
  }

  /* ---------- порожній стан / імпорт ---------- */
  function renderEmpty() {
    app.innerHTML = '<div class="screen"><div class="empty">' +
      '<h1 class="h1">Карта контролера</h1>' +
      '<p class="mute" style="margin:0;font-weight:600;line-height:1.5">Даних на цьому телефоні ще немає. Завантажте файл з точками (points.json) або резервну копію.</p>' +
      '<label class="btn sec" for="imp">Завантажити файл</label><input id="imp" type="file" accept="application/json,application/octet-stream,text/plain,.json" hidden>' +
      '<div class="card" style="gap:10px;text-align:left;width:100%"><div class="h2" style="font-size:16px">Новий контролер? Підключіться до спільної бази</div>' +
        '<div class="small mute" style="line-height:1.45">Токен дає старший контролер. Карта дільниці і відмітки колег завантажаться самі.</div>' +
        '<input id="gh-repo" class="input" value="mrm-boop547/kontroler-data" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Репозиторій">' +
        '<input id="gh-tok" class="input" type="password" placeholder="Токен github_pat_…" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Токен">' +
        '<button class="btn" data-act="ghJoin">Підключитися</button></div>' +
      '<div class="small mute">Версія ' + VERSION + '</div>' +
      '</div></div>';
    $('#imp').onchange = importFile;
  }
  function importFile(e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var data; try { data = JSON.parse(rd.result); } catch (x) { return toast('Файл пошкоджений'); }
      var pts = data.points || [], vis = data.visits || [], meta = data.meta || [];
      if (data.type === 'kontroler-sync') return mergeSync(data);
      if (data.merge) {
        var tx2 = db.transaction(['points', 'visits'], 'readwrite');
        pts.forEach(function (p) { tx2.objectStore('points').put(p); });
        vis.forEach(function (v) { delete v.id; tx2.objectStore('visits').put(v); });
        tx2.oncomplete = function () { load().then(function () { toast('Додано точок: ' + pts.length); if (pts[0]) go('#card/' + pts[0].id); }); };
        return;
      }
      if (!pts.length) return toast('У файлі немає точок');
      if (S.points.size && !confirm('Замінити всі дані на телефоні даними з файлу? (' + pts.length + ' точок)')) {
        if (!confirm('Тоді лише оновити назви з MAPS.ME, не чіпаючи ваших змін і візитів?')) return;
        var n = 0, tx = db.transaction('points', 'readwrite');
        pts.forEach(function (q) { var p = S.points.get(q.id); if (p && q.orig && p.orig !== q.orig) { p.orig = q.orig; tx.objectStore('points').put(p); n++; } });
        tx.oncomplete = function () { toast('Оновлено назв: ' + n); render(); };
        return;
      }
      /* копія з іншого телефона не повинна переносити його код пристрою і доступ до сервера */
      meta = meta.filter(function (m) { return ['gh', 'ghSeen', 'ghFiles', 'ghLast', 'ghErr', 'device'].indexOf(m.k) < 0; });
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
    var meta = Object.keys(S.meta).filter(function (k) { return ['gh', 'ghSeen', 'ghFiles', 'ghLast', 'ghErr', 'device'].indexOf(k) < 0; }).map(function (k) { return { k: k, v: S.meta[k] }; });
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

  /* ---------- експорт у таблицю (Excel відкриває CSV з «;» і BOM) ---------- */
  var CY_NAME = { ok: 'Зчитано вчасно', miss: 'Список 180', todo: 'Немає даних' };
  function exportCsv(kind, filter) {
    var rows = [], sep = ';';
    if (kind === 'points') {
      var off = OFFICIAL.filter(function (o) { return o[2] !== 'info' && o[0] !== 'address'; });
      rows.push(['ID', 'Село', 'Вулиця', 'Будинок', 'Доступ', 'Стан (норма ' + NORM() + ' дн.)', 'Днів від зчитування', 'Останній візит', 'Результат', 'Хто', 'Показник', 'Мітки', 'Нотатка',
        'Широта', 'Довгота', 'Прив\'язка', 'Маршрут №', 'Хто ходить'].concat(off.map(function (o) { return o[1]; })));
      S.points.forEach(function (p) {
        if (filter && !filter(p)) return;
        var vs = visitsOf(p.id), lv = vs[0], rd = lastReading(p.id)[0], f = p.fields || {};
        rows.push([p.id, p.village || '', p.street || '', p.house || '', ST[p.status].label, CY_NAME[cycleState(p)], okMap()[p.id] ? daysSince(okMap()[p.id].ts) : '', lv ? dt(lv.ts) + ' ' + tm(lv.ts) : '', lv ? RESNAME[lv.result] : '',
          lv ? peerName(lv.by) : '', rd ? rd.reading : (f.prevIndex || ''), (p.tags || []).map(function (t) { return TAGNAME[t] || t; }).join(', '), p.note || '',
          p.lat, p.lon, p.src || '', (S.meta.routeNo || {})[p.village] || '', splitIdx(p) != null ? sectorName(splitIdx(p), splitOf(p.village)) : '']
          .concat(off.map(function (o) {
            if (o[0] === 'sealStatuses') return sealList(p).map(function (x) { return x.n + ' ' + x.place + (x.st ? ' — ' + x.st : ''); }).join(' | ');
            return f[o[0]] || '';
          })));
      });
    } else {
      rows.push(['Дата', 'Час', 'Село', 'Вулиця', 'Будинок', 'Серійний (з даних)', 'Результат', 'Показник', 'У системі', 'Як отримано', 'Фото', 'Серійний звірено', 'Пломби', 'Пломби: статуси', 'ЗКО', 'Розміщення', 'Номінал автомата', 'Пофідерна прив\'язка', 'Сигнал тривоги', 'Доступ після візиту', 'Примітка', 'Хто', 'GPS точність, м']);
      S.visits.slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (v) {
        if (filter && !filter(v)) return;
        var p = S.points.get(v.pointId) || {};
        rows.push([dt(v.ts), tm(v.ts), p.village || '', p.street || '', p.house || '', (p.fields || {}).serial || '', RESNAME[v.result] || v.result, v.reading || '', v.sysReading != null ? v.sysReading : '', v.method || '', v.photo ? 'так' : '',
          v.serial || '', v.seals || '', (v.sealList || []).map(function (x) { return (x.n || 'без номера') + ' ' + x.place + ' — ' + x.st; }).join(' | '), (v.form || {}).zko || '', (v.form || {}).placement || '', (v.form || {}).av || '', (v.form || {}).feeder || '', (v.form || {}).alarm || '', ST[v.prof] ? ST[v.prof].label : '',
          v.note || '', peerName(v.by), v.pos ? v.pos.acc : '']);
      });
    }
    var txt = '﻿' + rows.map(function (r) { return r.map(csvCell).join(sep); }).join('\r\n');
    download('kontroler-' + (kind === 'points' ? 'abonenty' : 'vizyty') + '-' + today() + '.csv', txt, 'text/csv;charset=utf-8');
    toast('Таблицю збережено: ' + fmt(rows.length - 1) + ' рядків');
  }

  /* ---------- синхронізація між контролерами ----------
     Без сервера: кожен телефон віддає «пакет змін» (файл), інші його приймають.
     Правила злиття (ті самі будуть на сервері):
       • візити — журнал лише на додавання, кожен має унікальний uid → просто об'єднуємо, конфліктів немає;
       • точки — перемагає новіша версія (поле updated), автор у полі by;
       • видалення — «надгробки» з часом, щоб видалена точка не повернулась від колеги. */
  function syncPackage() {
    var pts = []; S.points.forEach(function (p) { if (p.updated || (p.src && p.src !== 'MAPS.ME')) pts.push(p); });
    return { type: 'kontroler-sync', v: 1, app: VERSION, from: Object.assign({}, me(), { device: dev(), inst: inst() }), exported: Date.now(), month: monthKey(),
      points: pts, visits: S.visits.map(function (v) { var c = Object.assign({}, v); delete c.id; return c; }), deleted: S.meta.deleted || {},
      idAlias: S.meta.idAlias || {}, extraVillages: S.meta.extraVillages || [], deletedVillages: S.meta.deletedVillages || {}, brigade: S.meta.brigade || {}, merged: S.meta.merged || {}, peers: S.meta.peers || {}, plan: S.meta.plan || null, splits: S.meta.splits || {}, shared: (function () { var o = {}; SHARED.forEach(function (k) { if (S.meta[k] != null) o[k] = S.meta[k]; }); return o; })(), sharedTs: S.meta.sharedTs || {} };
  }
  function exportSync() {
    if (!me().login) return go('#login');
    var d = syncPackage(), txt = JSON.stringify(d);
    var name = 'kontroler-sync-' + me().name.replace(/[^\wА-Яа-яІіЇїЄєҐґ]+/g, '_') + '-' + today() + '.json';
    var file = typeof File === 'function' ? new File([txt], name, { type: 'application/json' }) : null;
    var done = function () { setMeta('lastSyncOut', Date.now()); toast('Пакет змін: ' + fmt(d.visits.length) + ' візитів, ' + fmt(d.points.length) + ' точок'); if (location.hash === '#me' || location.hash === '#settings') bgRender(); };
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Карта контролера — дані ' + me().name }).then(done).catch(function () { download(name, txt, 'application/json'); done(); });
    } else { download(name, txt, 'application/json'); done(); }
  }
  function mergeSync(d) {
    if (d.from && (d.from.device ? d.from.device === dev() : d.from.id === me().id)) return toast('Це пакет з цього ж телефона');
    mergeData(d).then(function (R) {
      toast((d.from ? d.from.name + ': ' : '') + R.vis + ' візитів, ' + (R.newPts + R.updPts) + ' точок' + (R.del ? ', видалено ' + R.del : '') + (R.newPts ? ', нових на карті ' + R.newPts : '') + (R.dups ? ', можливих дублів ' + R.dups + ' — у «Уточнити в полі»' : ''));
      go('#me');
    }, function () { toast('Не вдалося об\'єднати дані'); });
  }
  function mergeData(d) { return new Promise(function (resolve, reject) {
    var R = { newPts: 0, updPts: 0, vis: 0, del: 0 }, tomb = Object.assign({}, S.meta.deleted || {});
    var have = {}; S.visits.forEach(function (v) { have[v.uid] = 1; });
    var tx = db.transaction(['points', 'visits'], 'readwrite'), P = tx.objectStore('points'), Vs = tx.objectStore('visits');
    Object.keys(d.deleted || {}).forEach(function (id) {
      var ts = d.deleted[id], p = S.points.get(id);
      if (!tomb[id] || tomb[id] < ts) tomb[id] = ts;
      if (p && (p.updated || 0) <= ts) { P.delete(id); S.points.delete(id); R.del++; }
    });
    (d.points || []).forEach(function (q) {
      if (tomb[q.id] && tomb[q.id] >= (q.updated || 0)) return;
      var p = S.points.get(q.id);
      if (!p) { var dup = findDup(q); if (dup) { q.flags = (q.flags || []).filter(function (f) { return f !== 'dup'; }).concat(['dup']); q.dupOf = dup.p.id; R.dups = (R.dups || 0) + 1; }
        P.put(q); S.points.set(q.id, q); R.newPts++; }
      else if ((q.updated || 0) > (p.updated || 0)) {
        /* з сервера точки приходять без даних абонента — свої поля (ПІБ, серійний…) не затираємо */
        if (q.lite && p.fields) q = Object.assign({}, q, { fields: p.fields });
        P.put(q); S.points.set(q.id, q); R.updPts++; }
    });
    /* перейменування ID колег (змінили табельний): старі записи переводимо на новий ID */
    var al = Object.assign({}, S.meta.idAlias || {}, d.idAlias || {}), fix = function (id) { var g = 0; while (id && al[id] && g++ < 5) id = al[id]; return id; };
    (d.visits || []).forEach(function (v) { v.by = fix(v.by); });
    (d.visits || []).forEach(function (v) {
      if (!v.uid || have[v.uid]) return; have[v.uid] = 1;
      var c = Object.assign({}, v); delete c.id; Vs.put(c); R.vis++;
    });
    if (d.idAlias) S.visits.forEach(function (v) { var nb = fix(v.by); if (nb !== v.by) { v.by = nb; if (v.id != null) Vs.put(v); } });
    if (d.idAlias) S.points.forEach(function (p) { var a1 = fix(p.by), a2 = fix(p.createdBy); if (a1 !== p.by || a2 !== p.createdBy) { p.by = a1; p.createdBy = a2; P.put(p); } });
    tx.oncomplete = function () {
      var peers = Object.assign({}, S.meta.peers || {}), jobs0 = [];
      Object.keys(al).forEach(function (o) { if (peers[o] && !peers[al[o]]) peers[al[o]] = peers[o]; delete peers[o]; });
      var hid = S.meta.peersHidden || {};
      Object.keys(d.peers || {}).forEach(function (k) { if (k !== me().id && !peers[k] && !hid[k]) peers[k] = { name: d.peers[k].name, last: null, visits: 0, via: d.from && d.from.name }; });
      if (d.from && d.from.id !== me().id && (!hid[d.from.id] || (d.exported || 0) > hid[d.from.id])) peers[d.from.id] = { name: d.from.name || 'колега', last: Date.now(), sent: d.exported, visits: (d.visits || []).filter(function (v) { return v.by === d.from.id; }).length };
      var dvs = Object.assign({}, S.meta.deletedVillages || {}); Object.keys(d.deletedVillages || {}).forEach(function (v) { if (!dvs[v] || dvs[v] < d.deletedVillages[v]) dvs[v] = d.deletedVillages[v]; }); jobs0.push(setMeta('deletedVillages', dvs));
      var exv = (S.meta.extraVillages || []).filter(function (v) { return !dvs[v]; }); (d.extraVillages || []).forEach(function (v) { if (exv.indexOf(v) < 0 && !dvs[v]) exv.push(v); });
      var brg = Object.assign({}, S.meta.brigade || {}); Object.keys(d.brigade || {}).forEach(function (k) { if (!brg[k] || (d.brigade[k].ts || 0) > (brg[k].ts || 0)) brg[k] = d.brigade[k]; }); jobs0.push(setMeta('brigade', brg));
      /* спільні налаштування: беремо новіші; план ще й за полем updated (для старих версій) */
      var sts = Object.assign({}, S.meta.sharedTs || {}), dts = d.sharedTs || {}, sh = d.shared || {}, shCh = false;
      if (d.plan && !sh.plan) { sh = Object.assign({}, sh, { plan: d.plan }); dts = Object.assign({}, dts, { plan: d.plan.updated || 0 }); }
      SHARED.forEach(function (k) { if (sh[k] == null) return; var their = dts[k] || 0, mine = sts[k] || (k === 'plan' && S.meta.plan ? S.meta.plan.updated || 0 : 0); if (their > mine) { jobs0.push(setMeta(k, sh[k])); sts[k] = their; shCh = true; } });
      if (shCh) { jobs0.push(setMeta('sharedTs', sts)); S.route = null; R.shared = true; }
      var jobs = jobs0.concat([setMeta('idAlias', al), setMeta('extraVillages', exv), setMeta('peers', peers), setMeta('deleted', tomb), setMeta('merged', Object.assign({}, S.meta.merged || {}, d.merged || {}))]);
      var sp = Object.assign({}, S.meta.splits || {}); Object.keys(d.splits || {}).forEach(function (v) { var x = d.splits[v]; if (!sp[v] || (x.made || 0) > (sp[v].made || 0)) sp[v] = x; }); jobs.push(setMeta('splits', sp));
      Promise.all(jobs).then(load).then(function () { resolve(R); }, reject);
    };
    tx.onerror = function () { reject(new Error('tx')); };
  }); }

  /* ---------- синхронізація через інтернет: приватний репозиторій GitHub ----------
     Кожен телефон пише лише свій файл sync/<контролер>-<пристрій>.json і читає файли колег — конфліктів запису немає.
     Злиття — ті самі правила, що й при обміні файлами. На сервер ідуть лише адреси, координати, доступ, орієнтир
     і факт візиту: без ПІБ, телефонів, серійних номерів, показників і фото. */
  function gh() { var g = S.meta.gh; return g && g.token && g.repo ? g : null; }
  function ghReq(path, opt) {
    var g = gh(); opt = opt || {};
    return fetch('https://api.github.com/repos/' + g.repo + path, { method: opt.method || 'GET', cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + g.token, Accept: opt.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.body ? { 'Content-Type': 'application/json' } : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined });
  }
  function b64(txt) { var b = new TextEncoder().encode(txt), s = ''; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function litePackage() {
    var d = syncPackage();
    d.lite = true;
    /* на сервер — лише власні зміни: точки, які востаннє змінив я, і мої відмітки. Зміни колег лежать у їхніх файлах,
       тож пересилати їх ще раз не треба. Раніше кожен телефон вивантажував дані всієї команди, файл ріс до мегабайтів,
       і GitHub міг відповідати помилкою 500 */
    var me0 = me().id;
    d.points = d.points.filter(function (p) { return !p.by || p.by === me0; });
    d.visits = d.visits.filter(function (v) { return !v.by || v.by === me0; });
    d.points = d.points.map(function (p) { var c = Object.assign({}, p); delete c.fields; c.lite = true; return c; });
    d.visits = d.visits.map(function (v) { var c = { uid: v.uid, pointId: v.pointId, result: v.result, ts: v.ts, by: v.by, prof: v.prof }; if (v.form || v.sealList || v.br) c.br = visitWhy(v); return c; });
    return d;
  }
  function ghFile() { return 'sync/' + (me().id || 'x') + '-' + dev() + '.json'; }
  var syncBusy = false, syncTimer = null;
  function scheduleSync() { if (!gh()) return; setTimeout(refreshSyncBadge, 300); clearTimeout(syncTimer); syncTimer = setTimeout(function () { ghSync(false); }, 15000); }
  /* фонове оновлення екрана (після синхронізації): поки людина друкує, не перемальовуємо, інакше поле пропадає з-під пальця
     і клавіатура закривається; перемалюємо, коли фокус піде з поля */
  function typingNow() { var ae = document.activeElement; return !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.type !== 'file' && ae.type !== 'checkbox'); }
  function bgRender() {
    if (typingNow()) { if (!bgRender.wait) { bgRender.wait = true; document.addEventListener('focusout', function f() { setTimeout(function () { if (typingNow()) return; document.removeEventListener('focusout', f); bgRender.wait = false; bgRender(); }, 300); }); } return; }
    var y = window.scrollY, h = location.hash; render(); if (location.hash === h) window.scrollTo(0, y);
  }
  function ghSync(manual) {
    if (!gh() || !me().login) return Promise.resolve();
    if (!navigator.onLine) { if (manual) toast('Немає інтернету. Синхронізую, коли з\'явиться'); return Promise.resolve(); }
    if (syncBusy) return Promise.resolve(); syncBusy = true;
    var seen = Object.assign({}, S.meta.ghSeen || {}), got = { vis: 0, pts: 0, from: 0 }, mine = ghFile(), st = $('#gh-st'), files = Object.assign({}, S.meta.ghFiles || {}), clash = false;
    if (st && manual) st.textContent = 'Синхронізую…';
    /* зрозуміла причина помилки: код відповіді сервера і що з ним робити */
    var fail = function (e) {
      syncBusy = false;
      var c = e && e.status, msg = !c ? (navigator.onLine ? 'сервер не відповів (слабкий інтернет?), повторю сам' : 'немає інтернету, синхронізую, коли з\'явиться')
        : c === 401 ? 'токен недійсний або прострочений (код 401)'
        : c === 403 ? 'немає доступу або забагато запитів, спробую пізніше (код 403)'
        : c === 404 ? 'репозиторій не знайдено або токен не має до нього доступу (код 404)'
        : c === 409 || c === 422 ? 'конфлікт версій файлу, повторю (код ' + c + ')'
        : c === 413 ? 'забагато даних за раз (код 413)'
        : c >= 500 ? 'збій на боці GitHub (код ' + c + ')' + (e.step ? ', ' + e.step : '') + '. Дані збережені на телефоні, повторю сам за хвилину'
        : 'сервер відповів помилкою (код ' + c + ')' + (e.detail ? ': ' + e.detail : '');
      setMeta('ghErr', msg); if (manual) toast('Синхронізація: ' + msg);
      if (st) { st.textContent = 'Помилка'; st.style.color = '#B91C1C'; }
      /* тимчасові збої — автоматичний повтор через 1 хв */
      if (!c || c === 403 || c === 409 || c === 422 || c >= 500) { clearTimeout(ghSync._rt); ghSync._rt = setTimeout(function () { ghSync(false); }, 60000); }
      if (/^#(me|settings)/.test(location.hash || '')) bgRender();
    };
    var ok = function (r) { if (!r.ok) { var e = new Error('http'); e.status = r.status; throw r.text().then(function (t) { try { e.detail = (JSON.parse(t).message || '').slice(0, 80); } catch (x) {} return e; }, function () { return e; }); } return r; };
    /* 1. забираємо файли колег, які змінились */
    var step = function (name) { return function (e) { return Promise.resolve(e).then(function (x) { if (x && !x.step) x.step = name; throw x; }); }; };
    return ghReq('/contents/sync').then(function (r) { return r.status === 404 ? [] : ok(r).json(); }).catch(step('читання списку файлів')).then(function (list) {
      var onSrv = {}; (Array.isArray(list) ? list : []).forEach(function (f) { onSrv[f.path] = 1; }); Object.keys(files).forEach(function (k) { if (!onSrv[k]) delete files[k]; });
      /* після зміни коду пристрою прибираємо свій старий файл, щоб колеги не бачили телефон двічі */
      var old = S.meta.ghOldFile; if (old && old.path !== mine) { (list || []).forEach(function (f) { if (f.path === old.path) ghReq('/contents/' + f.path, { method: 'DELETE', body: { message: 'move device', sha: f.sha } }); }); delete files[old.path]; setMeta('ghOldFile', null); list = (list || []).filter(function (f) { return f.path !== old.path; }); }
      var mySha = null, todo = (Array.isArray(list) ? list : []).filter(function (f) {
        if (f.path === mine) { mySha = f.sha; return false; }
        return /\.json$/.test(f.name) && seen[f.path] !== f.sha;
      });
      var chain = Promise.resolve();
      todo.forEach(function (f) {
        chain = chain.then(function () { return ghReq('/contents/' + f.path, { raw: true }).then(ok).then(function (r) { return r.json(); }).then(function (d) {
          var fr = d.from || {};
          files[f.path] = { name: fr.name || '?', id: fr.id || '', inst: fr.inst || '', dev: fr.device || '', app: d.app || '', ts: d.exported || 0, pts: (d.points || []).length, vis: (d.visits || []).length };
          /* свій файл — лише якщо той самий код встановлення; для старих версій — той самий пристрій і той самий контролер */
          var own = fr.inst ? fr.inst === inst() : (fr.device === dev() && fr.id === me().id);
          if (fr.device === dev() && fr.inst && fr.inst !== inst()) clash = true;
          if (own) { seen[f.path] = f.sha; files[f.path].own = true; return; }
          return mergeData(d).then(function (R) { got.vis += R.vis; got.pts += R.newPts + R.updPts; if (R.shared) got.sh = 1; got.from++; seen[f.path] = f.sha; });
        }).catch(function (e) { files[f.path] = Object.assign(files[f.path] || { name: f.name }, { err: (e && e.status) || 'помилка' }); }); });
      });
      /* 2. відправляємо свій файл */
      return chain.then(function () {
        var body = { message: 'sync ' + (me().name || '') + ' ' + new Date().toISOString(), content: b64(JSON.stringify(litePackage())) }, kb = Math.round(body.content.length * 0.75 / 1024);
        if (mySha) body.sha = mySha;
        var put = function () { return ghReq('/contents/' + mine, { method: 'PUT', body: body }); };
        return put().then(function (r) {
          if (r.status !== 409 && r.status !== 422) return r;
          /* файл на сервері змінився з іншого запиту — беремо його поточну версію і пишемо ще раз */
          return ghReq('/contents/' + mine).then(function (q) { return q.ok ? q.json() : null; }).then(function (j) { if (j && j.sha) body.sha = j.sha; else delete body.sha; return put(); });
        }).then(ok).then(function (r) { return r.json(); }).catch(step('запис файлу цього телефона, ' + kb + ' КБ'));
      }).then(function (res) {
        seen[mine] = res && res.content && res.content.sha;
        files[mine] = { name: me().name || '', id: me().id, inst: inst(), dev: dev(), app: VERSION, ts: Date.now(), own: true };
        syncBusy = false;
        var jobs = [setMeta('ghSeen', seen), setMeta('ghLast', Date.now()), setMeta('ghErr', null), setMeta('lastSyncOut', Date.now()), setMeta('ghFiles', files)];
        /* інший телефон має той самий код пристрою (відновлено з чужої копії) — беремо собі новий, наступна синхронізація піде в окремий файл */
        if (clash) { jobs.push(setMeta('ghOldFile', { path: mine, sha: seen[mine] }), setMeta('device', Math.random().toString(36).slice(2, 8))); toast('Цей телефон отримав власний код пристрою'); }
        return Promise.all(jobs).then(refreshSyncBadge);
      }).then(function () {
        var txt = got.vis || got.pts ? 'Отримано: ' + got.vis + ' відміток, ' + got.pts + ' точок' : 'Синхронізовано, нового від колег немає';
        if (manual || got.vis || got.pts) toast(txt);
        if (got.sh && !manual && !(got.vis || got.pts)) toast('Оновлено план і налаштування дільниці');
        if (got.vis || got.pts || got.sh || manual) { var h = location.hash || '#home'; if (/^#(map|all)/.test(h)) { updateMap(); renderSheetSoft(); } else if (!/^#(card|read|visit|bind)/.test(h)) bgRender(); }
      });
    }).catch(function (e) { return Promise.resolve(e).then(fail, fail); });
  }
  /* хто є на сервері: по файлу на кожен телефон — ім'я, версія, коли надсилав, скільки точок і відміток */
  function srvList() {
    var F = S.meta.ghFiles || {}, ks = Object.keys(F); if (!ks.length) return '<p class="mute">Список телефонів на сервері з\'явиться після першої синхронізації.</p>';
    var byName = {}; ks.forEach(function (k) { var n = (F[k].name || '?').trim(); (byName[n] = byName[n] || []).push(F[k]); });
    var dup = Object.keys(byName).filter(function (n) { var L = byName[n]; return L.length > 1 && L.some(function (x) { return x.inst && L.some(function (y) { return y.inst && y.inst !== x.inst; }); }); });
    return '<p style="margin-top:6px"><b>Телефони на сервері · ' + ks.length + '</b></p>' + ks.sort(function (a, b) { return (F[b].ts || 0) - (F[a].ts || 0); }).map(function (k) { var x = F[k];
        return '<div class="between" style="padding:6px 0;border-top:1px solid var(--bg);gap:8px"><span class="col" style="gap:0;min-width:0"><b>' + esc(x.name || '?') + (x.own ? ' (цей телефон)' : '') + '</b><span class="small mute">' + (x.app ? 'v' + esc(x.app) : 'стара версія') + (x.ts ? ' · ' + dt(x.ts) + ' ' + tm(x.ts) : '') + (x.err ? ' · не вдалося прочитати (' + esc(String(x.err)) + ')' : '') + '</span></span><span class="small" style="text-align:right;white-space:nowrap">' + (x.pts != null ? fmt(x.pts) + ' точок<br>' + fmt(x.vis) + ' відміток' : '') + '</span></div>';
      }).join('') + (dup.length ? '<p style="color:#B91C1C;margin-top:8px"><b>Кілька телефонів під одним іменем:</b> ' + esc(dup.join(', ')) + '. Найімовірніше, телефон налаштували з чужої резервної копії. На тому телефоні: «Я» → кнопка зі стрілками біля імені («Змінити контролера») → увійти під своїм ПІБ і табельним. Олівець для цього не підходить: він переносить усі записи старого імені.</p>' : '');
  }
  function showInfo(k) {
    if (k === 'ptflags') return infoSheet('Особливості точки', '<p><b>Юридичний споживач.</b> Точка фіолетова на карті; доступ (зелений, жовтий, червоний) лишається в картці.</p>' +
      '<p><b>Лічильник відключено.</b> На карті й у назві з\'являється «(відключено)». Знімати так само: фото лічильника і актуальний показник.</p>' +
      '<p><b>Аварійний будинок.</b> Ніхто не живе, загроза обриву проводів. Статус одразу «Не живуть», точка потрапляє в «Викликати бригаду», на карті червоний трикутник «!».</p>');
    if (k === 'sat') return infoSheet('Супутник без інтернету', '<p>Вибери село на головній і натисни «Зберегти супутник». Застосунок завантажить знімки навколо всіх точок села на всіх наближеннях, до окремих будинків. Одне село ≈10–20 МБ, 1–2 хв. Краще через Wi-Fi або перед виїздом.</p><p>Без інтернету карта показує збережене так само, як з інтернетом. Тримаємо до ' + SAT_MAX + ' сіл; найстаріші прибираються самі, або хрестиком.</p><p class="mute">Знімки © Esri. Для особистої роботи в полі; при впровадженні на все обленерго супутник для офлайну варто оформити ліцензією.</p>');
    if (k === 'sync') {
      var g = gh();
      return infoSheet('Синхронізація', '<p><b>Через інтернет.</b> Працює сама: при відкритті застосунку, коли з\'являється інтернет, через 15 с після кожної відмітки і кожні 5 хв. Без інтернету все зберігається на телефоні і піде пізніше.</p>' +
        '<p>На сервер ідуть лише адреси, координати, доступ, орієнтир і факт візиту. ПІБ, телефони, серійні номери, показники й фото лишаються тільки на телефоні.</p>' +
        '<p><b>Без інтернету.</b> «Надіслати» відкриває меню Android: вибери Quick Share (Обмін поблизу) або Bluetooth. Колега приймає файл кнопкою «Прийняти».</p>' +
        '<p>Обидва способи безпечно поєднуються: відмітки лише додаються, з двох версій точки лишається новіша, повтор нічого не дублює.</p>' +
        '<p><b>Новий контролер.</b> Достатньо токена: на першому екрані «Підключитися до спільної бази». Карта береться з бази точок на сервері; оновлюй її кнопкою нижче після великих змін (нові села, імпорт).</p>' +
        '<p><b>Колеги.</b> Хрестик прибирає контролера зі списку (звільнився, тестовий акаунт) і видаляє його файл із сервера. Його відмітки в історії лишаються. Якщо він знову надішле дані, повернеться в список.</p>' +
        (g ? '<p class="mute">Репозиторій: ' + esc(g.repo) + ' · відмічено ' + fmt(S.visits.filter(function (v) { return v.by === me().id; }).length) + ' моїх · надіслано ' + (S.meta.lastSyncOut ? dt(S.meta.lastSyncOut) + ' ' + tm(S.meta.lastSyncOut) : '—') + '</p>' : '') + (g ? srvList() : ''),
        g ? '<button class="btn sec" data-act="ghBase">Оновити базу точок для нових контролерів</button><button class="btn sec" data-act="ghOff" style="color:#B91C1C">Відключити цей телефон від сервера</button>' : '');
    }
  }
  /* прибрати контролера: зі списку колег і (якщо підключено) його файли з сервера; відмітки в історії лишаються */
  function peerDel(id) {
    var x = (S.meta.peers || {})[id]; if (!x) return;
    if (!confirm('Прибрати «' + x.name + '» зі списку колег?' + (gh() ? ' Його файл буде видалено з сервера.' : '') + ' Відмітки в історії лишаться.')) return;
    var peers = Object.assign({}, S.meta.peers); delete peers[id];
    var hid = Object.assign({}, S.meta.peersHidden || {}); hid[id] = Date.now();
    Promise.all([setMeta('peers', peers), setMeta('peersHidden', hid)]).then(function () {
      toast('Прибрано: ' + x.name); var y = window.scrollY; render(); window.scrollTo(0, y);
      if (!gh() || !navigator.onLine) return;
      ghReq('/contents/sync').then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
        (list || []).filter(function (f) { return f.name.indexOf(id + '-') === 0; }).forEach(function (f) {
          ghReq('/contents/' + f.path, { method: 'DELETE', body: { message: 'remove ' + x.name, sha: f.sha } }).then(function () {
            var sn = Object.assign({}, S.meta.ghSeen || {}); delete sn[f.path]; setMeta('ghSeen', sn);
          });
        });
      });
    });
  }
  /* база точок для нових контролерів: лише адреси й координати, без даних абонентів */
  function basePoints() { var out = []; S.points.forEach(function (p) { var c = Object.assign({}, p); delete c.fields; delete c.dupOf; c.lite = true; out.push(c); }); return out; }
  function ghBaseUpload() {
    if (!gh() || !navigator.onLine) return toast('Потрібні інтернет і підключення до сервера');
    if (!confirm('Оновити базу точок на сервері (' + fmt(S.points.size) + ' точок, без ПІБ і серійних)? Нові контролери почнуть з неї.')) return;
    toast('Відправляю базу…');
    var body = { message: 'base ' + new Date().toISOString(), content: b64(JSON.stringify({ type: 'kontroler-base', v: 1, exported: Date.now(), by: me().name, points: basePoints(), extraVillages: S.meta.extraVillages || [], vTotals: S.meta.vTotals || {}, totalSubs: S.meta.totalSubs || null })) };
    ghReq('/contents/base/points.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.sha) body.sha = j.sha;
      return ghReq('/contents/base/points.json', { method: 'PUT', body: body });
    }).then(function (r) { if (!r.ok) throw new Error(r.status); toast('Базу оновлено: ' + fmt(S.points.size) + ' точок'); setMeta('ghBase', Date.now()); })
      .catch(function (e) { toast('Не вдалося: ' + (e.message || 'помилка')); });
  }
  function ghJoin() {
    var repo = ($('#gh-repo').value || '').trim(), token = ($('#gh-tok').value || '').trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return toast('Репозиторій у форматі власник/назва');
    if (!/^(github_pat_|ghp_)/.test(token)) return toast('Токен має починатися з github_pat_');
    if (!navigator.onLine) return toast('Потрібен інтернет');
    toast('Завантажую карту дільниці…');
    fetch('https://api.github.com/repos/' + repo + '/contents/base/points.json', { cache: 'no-store', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } })
      .then(function (r) {
        if (r.status === 401) throw new Error('Токен не підходить');
        if (r.status === 404) throw new Error('На сервері ще немає бази точок. Попросіть старшого: «Я» → Синхронізація → ⓘ → «Оновити базу»');
        if (!r.ok) throw new Error('Помилка ' + r.status);
        return r.json();
      }).then(function (d) {
        var pts = d.points || []; if (!pts.length) throw new Error('База порожня');
        var meta = [{ k: 'gh', v: { repo: repo, token: token, since: Date.now() } }, { k: 'ghSeen', v: {} }];
        if (d.extraVillages) meta.push({ k: 'extraVillages', v: d.extraVillages });
        if (d.vTotals) meta.push({ k: 'vTotals', v: d.vTotals });
        if (d.totalSubs) meta.push({ k: 'totalSubs', v: d.totalSubs });
        return bulkReplace(pts, [], meta).then(load).then(function () { toast('Завантажено ' + fmt(pts.length) + ' точок. Тепер увійдіть'); go('#home'); });
      }).catch(function (e) { toast(e.message || 'Не вдалося підключитись'); });
  }
  function ghConnect() {
    var repo = ($('#gh-repo').value || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, ''), token = ($('#gh-tok').value || '').trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return toast('Репозиторій у форматі власник/назва');
    if (!/^(github_pat_|ghp_)/.test(token)) return toast('Токен має починатися з github_pat_');
    if (!navigator.onLine) return toast('Потрібен інтернет');
    toast('Перевіряю доступ…');
    fetch('https://api.github.com/repos/' + repo, { cache: 'no-store', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (r.status === 401) throw new Error('Токен не підходить');
      if (r.status === 404) throw new Error('Репозиторій не знайдено або токен не має до нього доступу');
      if (!r.ok) throw new Error('Помилка ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.private === false) toast('Увага: репозиторій публічний! Зробіть його приватним');
      return setMeta('gh', { repo: repo, token: token, since: Date.now() });
    }).then(function () { setMeta('ghSeen', {}); return ghSync(true); }).then(function () { var y = window.scrollY; render(); window.scrollTo(0, y); })
      .catch(function (e) { toast(e.message || 'Не вдалося підключитись'); });
  }
  function ghCard() {
    var g = gh();
    if (!g) return '<div class="sync-sub">' + icon('cloud', 18) + '<b>Через інтернет</b></div>' +
      '<input id="gh-repo" class="input" value="mrm-boop547/kontroler-data" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Репозиторій">' +
      '<input id="gh-tok" class="input" type="password" placeholder="Токен github_pat_…" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Токен">' +
      '<button class="btn" data-act="ghConnect">Підключити</button>';
    var err = S.meta.ghErr;
    return '<div class="between"><div class="sync-sub">' + icon('cloud', 18) + '<b>Через інтернет</b></div><span class="small" id="gh-st" style="font-weight:700;' + (err ? 'color:#B91C1C' : 'color:#16A34A') + '">' + (err ? 'помилка' : S.meta.ghLast ? '✓ ' + tm(S.meta.ghLast) + (dt(S.meta.ghLast) !== dt(Date.now()) ? ' ' + dt(S.meta.ghLast) : '') : 'ще не було') + '</span></div>' +
      (err ? '<div class="small" style="color:#B91C1C">' + esc(err) + '</div>' : '') +
      '<button class="btn" data-act="ghSync">' + icon('sync', 18) + 'Синхронізувати зараз</button>';
  }

  /* ---------- супутник офлайн: знімки Esri навколо точок вибраного села, всі наближення до будинків ----------
     Окреме сховище (не чиститься автоматично); з'являється без інтернету так само, як із ним. Тримаємо до 6 сіл. */
  var SAT = 'sat-v1', SAT_MAX = 6;
  function satUrl(z, x, y) { return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x; }
  function satTiles(v) {
    var ps = villagePoints(v); if (!ps.length) return [];
    var a = 90, b = -90, c = 180, d = -180;
    ps.forEach(function (p) { a = Math.min(a, p.lat); b = Math.max(b, p.lat); c = Math.min(c, p.lon); d = Math.max(d, p.lon); });
    var pad = 0.0025; a -= pad; b += pad; c -= pad * 1.5; d += pad * 1.5;
    var out = {}, add = function (z, x, y) { out[z + '/' + x + '/' + y] = 1; };
    for (var z = 13; z <= 19; z++) {
      if (z <= 16) { var t1 = tileXY(b, c, z), t2 = tileXY(a, d, z); for (var x = t1.x; x <= t2.x; x++) for (var y = t1.y; y <= t2.y; y++) add(z, x, y); }
      else { var r = z === 19 ? 0 : 1; ps.forEach(function (p) { var t = tileXY(p.lat, p.lon, z); for (var i = -r; i <= r; i++) for (var j = -r; j <= r; j++) add(z, t.x + i, t.y + j); }); }
    }
    return Object.keys(out).map(function (k) { var q = k.split('/'); return satUrl(+q[0], +q[1], +q[2]); });
  }
  var satBusy = false;
  function satDownload(v) {
    if (!v || v === ALL) return toast('Спершу виберіть село');
    if (!navigator.onLine) return toast('Потрібен інтернет');
    if (satBusy) return toast('Вже завантажую'); satBusy = true;
    var list = satTiles(v), total = list.length, ok = 0, fail = 0, bytes = 0, i = 0;
    var set = function (t) { var el = $('#sat-st'); if (el) el.textContent = t; };
    set('Завантажую ' + v + '… 0%');
    caches.open(SAT).then(function (cache) {
      var worker = function () {
        if (i >= total) return Promise.resolve();
        var u = list[i++];
        return cache.match(u).then(function (hit) {
          if (hit) { ok++; return; }
          /* «#kc-off» — щоб службовий кеш перегляду не дублював ці знімки; кеш порівнює адреси без «#» */
          return fetch(u + '#kc-off', { mode: 'cors' }).then(function (r) { if (!r.ok) throw 0; return r.clone().arrayBuffer().then(function (buf) { bytes += buf.byteLength; return cache.put(u, r); }); }).then(function () { ok++; }, function () { fail++; });
        }).then(function () { if ((ok + fail) % 10 === 0) set('Завантажую ' + v + '… ' + pct(ok + fail, total) + '% · ' + (bytes / 1048576).toFixed(1) + ' МБ'); return worker(); });
      };
      return Promise.all([worker(), worker(), worker(), worker()]);
    }).then(function () {
      satBusy = false;
      var m = Object.assign({}, S.meta.satOff || {}); m[v] = { ts: Date.now(), tiles: ok, fail: fail, mb: bytes ? +(bytes / 1048576).toFixed(1) : (m[v] ? m[v].mb : 0) };
      /* понад ліміт — прибираємо найстаріші села */
      var ks = Object.keys(m).sort(function (x, y) { return m[y].ts - m[x].ts; }), drop = ks.slice(SAT_MAX);
      drop.forEach(function (k) { delete m[k]; });
      return setMeta('satOff', m).then(function () { return Promise.all(drop.map(satPurge)); }).then(function () {
        toast(fail ? 'Супутник для «' + v + '» збережено частково: не вдалося ' + fail + ' з ' + total : 'Супутник для «' + v + '» збережено офлайн');
        if (/^#(me|settings)/.test(location.hash)) bgRender();
      });
    }).catch(function () { satBusy = false; toast('Не вдалося зберегти супутник'); });
  }
  /* видалити знімки села, крім тих, що потрібні іншим збереженим селам */
  function satPurge(v) {
    var keep = {}; Object.keys(S.meta.satOff || {}).forEach(function (k) { if (k !== v) satTiles(k).forEach(function (u) { keep[u] = 1; }); });
    return caches.open(SAT).then(function (c) { return Promise.all(satTiles(v).filter(function (u) { return !keep[u]; }).map(function (u) { return c.delete(u); })); });
  }
  function satRemove(v) {
    var m = Object.assign({}, S.meta.satOff || {}); delete m[v];
    satPurge(v).then(function () { return setMeta('satOff', m); }).then(function () { toast('Видалено супутник для «' + v + '»'); var y = window.scrollY; render(); window.scrollTo(0, y); });
  }
  function satCard() {
    var m = S.meta.satOff || {}, ks = Object.keys(m).sort(function (a, b) { return m[b].ts - m[a].ts; }), v = village() && village() !== ALL ? village() : null;
    var est = v ? satTiles(v).length : 0;
    return '<div class="prow2" style="align-items:flex-start"><span class="prow2-ic">' + icon('globe', 20) + '</span><span class="col" style="flex:1;min-width:0;gap:8px">' +
      '<span class="between" style="gap:8px"><b>Супутник по селах</b>' + infoBtn('sat') + '</span>' +
      (ks.length ? '<span class="tags">' + ks.map(function (k) { return '<span class="chip satc">' + icon('check', 13, 3) + esc(k) + ' <span class="mute" style="font-weight:600">' + dt(m[k].ts).slice(0, 5) + '</span><button class="satx" data-act="satDel" data-v="' + esc(k) + '" aria-label="Видалити ' + esc(k) + '">' + icon('close', 12, 2.6) + '</button></span>'; }).join('') + '</span>'
        : '<span class="small" style="color:#B45309;font-weight:700">жодного села не збережено</span>') +
      '<span class="small" id="sat-st" style="font-weight:700;min-height:0"></span>' +
      '<span class="row" style="gap:8px;flex-wrap:wrap">' +
        (v ? '<button class="chip pchip dark" data-act="satGet">' + icon('cloud', 15) + (m[v] ? 'Оновити ' : '') + esc(v) + (m[v] ? '' : ' · ≈' + Math.max(1, Math.round(est * 25 / 1024)) + ' МБ') + '</button>' : '') +
        '<button class="chip pchip" data-act="satPick">' + icon('plus', 14, 2.6) + (v ? 'Інше село' : 'Вибрати село') + '</button></span>' +
      '</span></div>';
  }

  /* ---------- офлайн-карта: векторні тайли всієї дільниці (OpenFreeMap дає їх до z14, далі карта збільшує сама) ---------- */
  var OFFLINE = 'offline-v1';
  function tileXY(lat, lon, z) {
    var n = Math.pow(2, z), x = Math.floor((lon + 180) / 360 * n), r = lat * Math.PI / 180;
    return { x: x, y: Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n) };
  }
  function offlineTiles(z0, z1) {
    var a = 90, b = -90, c = 180, d = -180;
    S.points.forEach(function (p) { a = Math.min(a, p.lat); b = Math.max(b, p.lat); c = Math.min(c, p.lon); d = Math.max(d, p.lon); });
    var pad = 0.01; a -= pad; b += pad; c -= pad * 1.5; d += pad * 1.5;
    /* лише тайли, біля яких є точки (у радіусі ~1 тайла) — без полів і лісів між селами */
    var out = [];
    for (var z = z0; z <= z1; z++) {
      var need = {};
      S.points.forEach(function (p) { var t = tileXY(p.lat, p.lon, z); for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) need[(t.x + i) + '/' + (t.y + j)] = 1; });
      if (z <= 11) { var t1 = tileXY(b, c, z), t2 = tileXY(a, d, z); for (var x = t1.x; x <= t2.x; x++) for (var y = t1.y; y <= t2.y; y++) need[x + '/' + y] = 1; }
      Object.keys(need).forEach(function (k) { out.push(z + '/' + k); });
    }
    return out;
  }
  function downloadOffline(btn) {
    if (!navigator.onLine) return toast('Потрібен інтернет (краще Wi-Fi)');
    if (S.offBusy) return; S.offBusy = true;
    var set = function (t) { var el = $('#off-st'); if (el) el.textContent = t; };
    var ok = 0, fail = 0, bytes = 0;
    caches.open(OFFLINE).then(function (c) {
      return fetch('https://tiles.openfreemap.org/planet', { cache: 'no-cache' }).then(function (r) { return r.clone().json().then(function (j) { c.put('https://tiles.openfreemap.org/planet', r); return j; }); })
        .then(function (tj) {
          var tpl = tj.tiles[0], list = offlineTiles(8, 14).map(function (t) { var s = t.split('/'); return tpl.replace('{z}', s[0]).replace('{x}', s[1]).replace('{y}', s[2]); });
          ['0-255', '1024-1279', '8192-8447'].forEach(function (rg) { list.push('https://tiles.openfreemap.org/fonts/Noto%20Sans%20Bold/' + rg + '.pbf'); });
          var i = 0, total = list.length;
          var worker = function () {
            if (i >= total) return Promise.resolve();
            var u = list[i++];
            return c.match(u).then(function (hit) {
              if (hit) { ok++; return; }
              return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.clone().arrayBuffer().then(function (b) { bytes += b.byteLength; return c.put(u, r); }); }).then(function () { ok++; }, function () { fail++; });
            }).then(function () { if ((ok + fail) % 8 === 0) set('Завантажую… ' + pct(ok + fail, total) + '% · ' + (bytes / 1048576).toFixed(1) + ' МБ'); return worker(); });
          };
          return Promise.all([worker(), worker(), worker(), worker()]).then(function () { return { total: total }; });
        });
    }).then(function (r) {
      S.offBusy = false;
      setMeta('offline', { ts: Date.now(), tiles: ok, fail: fail, mb: +(bytes / 1048576).toFixed(1) });
      toast(fail ? 'Збережено ' + ok + ' з ' + r.total + ', повторіть для решти' : 'Карту дільниці збережено офлайн');
      if (location.hash === '#me' || location.hash === '#settings') bgRender();
    }).catch(function () { S.offBusy = false; set('Помилка завантаження, спробуйте ще раз'); });
  }

  /* ---------- Головна ---------- */
  /* ---------- власне вікно вибору замість системного списку ---------- */
  /* extra: { btn: {v, l} — кнопка біля заголовка; pin: N — перші N варіантів закріплені над списком і не прокручуються } */
  /* підказка «і»: пояснення не займають місце на екрані, відкриваються по тапу */
  function infoSheet(title, html, actions) {
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov';
    ov.innerHTML = '<div class="pk-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="pk-grip"></div>' +
      '<div class="between" style="padding:0 4px;gap:8px"><div class="h2">' + esc(title) + '</div><button class="iconbtn" data-pk="close" aria-label="Закрити" style="box-shadow:none;background:#F1F1F3;width:40px;height:40px">' + icon('close', 18, 2.4) + '</button></div>' +
      '<div class="info-body">' + html + '</div>' + (actions || '') + '</div>';
    ov.addEventListener('click', function (e) { var b = e.target.closest('[data-pk]'); if (e.target === ov || (b && b.getAttribute('data-pk') === 'close')) closeSheet(); });
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('show'); });
  }
  function infoBtn(key) { return '<button class="info-i" data-act="info" data-v="' + key + '" aria-label="Пояснення">i</button>'; }
  function openSheet(title, opts, current, onPick, extra) {
    closeSheet(); extra = extra || {};
    var row = function (o, i) {
      var v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? (o || 'Не вибрано') : o.l, sub = typeof o === 'string' ? '' : (o.sub || '');
      var on = v === current, hot = typeof o !== 'string' && o.hot;
      var head = typeof o !== 'string' && o.head ? '<div class="small mute" style="padding:6px 4px 0">' + esc(o.head) + '</div>' : '';
      return head.replace('<div class="small mute"', '<div class="small mute pk-head"') + '<button class="pk-row' + (on ? ' on' : '') + (hot ? ' hot' : '') + '" data-pk="' + i + '" data-q="' + esc(String(l).toLowerCase()) + '"><span class="col" style="gap:2px;min-width:0"><span>' + esc(l) + '</span>' + (sub ? '<span class="small" style="opacity:.6">' + esc(sub) + '</span>' : '') + '</span>' +
        (on ? '<span class="pk-check">' + icon('check', 16, 3) + '</span>' : '<span class="pk-radio"></span>') + '</button>';
    };
    var pin = extra.pin || 0;
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov';
    ov.innerHTML = '<div class="pk-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="pk-grip"></div>' +
      '<div class="between" style="padding:0 4px;gap:8px"><div class="h2" style="flex-shrink:0' + (extra.search ? ';display:none' : '') + '">' + esc(title) + '</div>' +
      (extra.search ? '<label class="pk-search">' + icon('search', 18) + '<input id="pk-q" type="search" placeholder="' + esc(extra.search) + '" autocomplete="off" autocapitalize="sentences"></label>' : '') +
      '<div class="row" style="gap:8px">' + (extra.btn ? '<button class="chip" data-pk="btn" style="height:40px;padding:0 14px;background:#111;color:#fff;border-radius:20px">' + icon('plus', 16, 2.6) + esc(extra.btn.l) + '</button>' : '') +
      '<button class="iconbtn" data-pk="close" aria-label="Закрити" style="box-shadow:none;background:#F1F1F3;width:40px;height:40px">' + icon('close', 18, 2.4) + '</button></div></div>' +
      (pin ? '<div class="col" style="gap:6px">' + opts.slice(0, pin).map(row).join('') + '</div>' : '') +
      '<div class="pk-list">' + opts.slice(pin).map(function (o, i) { return row(o, i + pin); }).join('') + '</div></div>';
    if (extra.search) setTimeout(function () {
      var q = ov.querySelector('#pk-q'); if (!q) return;
      if (extra.focus !== false) q.focus();
      q.oninput = function () {
        var t = q.value.trim().toLowerCase(), list = ov.querySelector('.pk-list'), shown = 0;
        ov.querySelectorAll('.pk-head').forEach(function (h) { h.style.display = t ? 'none' : ''; });
        var rows = Array.prototype.slice.call(ov.querySelectorAll('.pk-row'));
        rows.forEach(function (r) {
          var l = r.getAttribute('data-q') || '', words = l.split(/[\s-]+/);
          var hit = !t || l.indexOf(t) === 0 ? 2 : words.some(function (w) { return w.indexOf(t) === 0; }) ? 1 : l.indexOf(t) >= 0 ? 0 : -1;
          r.style.display = hit < 0 ? 'none' : ''; r.style.order = t ? String(2 - hit) : ''; if (hit >= 0) shown++;
        });
        var em = ov.querySelector('.pk-empty'); if (em) em.remove();
        if (!shown) list.insertAdjacentHTML('beforeend', '<div class="pk-empty small mute" style="padding:14px 4px">Нічого не знайдено' + (extra.btn ? ' · натисніть «' + esc(extra.btn.l) + '», щоб додати' : '') + '</div>');
      };
    }, 50);
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pk]');
      if (e.target === ov || (b && b.getAttribute('data-pk') === 'close')) return closeSheet();
      if (b && b.getAttribute('data-pk') === 'btn') { closeSheet(); return onPick(extra.btn.v); }
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
  /* найчастіші примітки (≈80% випадків) — нагорі й контрастно */
  var HOT_NOTES = [PH_NOTE, 'Показник зі слів споживача', 'Показник повідомили по телефону', 'Показники повідомили сусіди'];
  PICK_OPTS.noteSel = HOT_NOTES.map(function (n, i) { return { v: n, l: n, hot: true, head: i === 0 ? 'Часті' : '' }; })
    .concat(NOTES.filter(function (n) { return HOT_NOTES.indexOf(n) < 0; }).map(function (n, i) { return { v: n, l: n || 'Без примітки', head: i === 0 ? 'Усі примітки' : '' }; }));
  var PICK_TITLE = { vm: 'Як отримано показник' };
  OFFICIAL.forEach(function (o) { PICK_TITLE[o[0]] = o[1]; });
  PICK_TITLE.placement2 = 'Розміщення';
  function doPick(el) {
    var f = el.getAttribute('data-f'), opts = PICK_OPTS[f];
    openSheet(PICK_TITLE[f] || 'Вибір', opts, el.getAttribute('data-val'), function (v) {
      el.setAttribute('data-val', v);
      var lab = v; opts.forEach(function (o) { if (typeof o !== 'string' && o.v === v) lab = o.l; });
      var sp = el.querySelector('.pv') || el.querySelector('span');
      sp.textContent = lab || 'Не вибрано'; sp.classList.toggle('mute', !v);
      if (R.id && $('#r-save') && el.closest('#app')) { readCollect(); readKeep(); }
    });
  }
  function villageSelect() {
    var v = village();
    return '<button type="button" class="vsel" data-act="pickVillageSheet" aria-label="Вибрати населений пункт"><span class="vsel-ic">' + icon('village', 18, 2.2) + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(vLabel(v)) + '</span>' + icon('down', 18, 2.6) + '</button>';
  }
  function pickVillage() {
    var p = plan(), st = planStats(), vs = villages(), opts;
    if (p) {
      var a = vs.filter(function (x) { return p.villages.indexOf(x.name) >= 0; }), b = vs.filter(function (x) { return p.villages.indexOf(x.name) < 0; });
      opts = a.map(function (x, i) { var s = st.byV[x.name] || { act: 0, done: 0 }; return { v: x.name, l: x.name, sub: 'залишилось ' + (s.act - s.done) + ' з ' + s.act, hot: true, head: i === 0 ? 'План на ' + monthName().toLowerCase() : '' }; })
        .concat(letterHeads(b.map(function (x) { return { v: x.name, l: x.name, sub: x.n + ' точок' }; })));
    } else opts = letterHeads(vs.map(function (x) { return { v: x.name, l: x.name, sub: x.n + ' точок' }; }));
    opts = [{ v: ALL, l: 'Уся дільниця', sub: fmt(S.points.size) + ' точок' + (p ? ' · маршрут по селах плану' : ' · усі села разом'), hot: true }].concat(opts);
    openSheet('Населений пункт', opts, village() || 'Без села', function (v) {
      if (v === '__newv') return addVillage(function (n) { setMeta('village', n).then(function () { S.route = null; S.filter = null; S.sel = null; render(); }); });
      setMeta('village', v === 'Без села' ? null : v).then(function () { S.route = null; S.filter = null; S.sel = null; render(); });
    }, { btn: { v: '__newv', l: 'Нове' }, pin: 1, search: 'Пошук села' });
  }
  function bindVillageSelect() {}
  /* статистика зняття по всій дільниці за поточний цикл (півріччя) */
  function districtCard() {
    var act = 0, rd = 0, miss = 0;
    S.points.forEach(function (p) {
      if (p.status === 'n') return; act++;
      if (readThisCycle(p)) rd++; else if (in180(p)) miss++;
    });
    var left = act - rd - miss, P = pct(rd, act);
    return '<a href="#report" class="card big" style="gap:12px">' +
      '<div class="between" style="align-items:flex-end"><div class="col" style="gap:2px"><span class="small mute" style="font-size:13px">Дільниця · зчитано за ' + NORM() + ' днів</span>' +
      '<span style="font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1">' + P + '%</span></div>' +
      '<span class="small mute" style="font-size:13px;text-align:right">' + fmt(rd) + ' з ' + fmt(act) + icon('right', 14, 2.4) + '</span></div>' +
      '<div class="bar" style="height:10px"><span style="flex:' + rd + ' 1 0;background:#16A34A"></span><span style="flex:' + miss + ' 1 0;background:#F59E0B"></span><span style="flex:' + Math.max(left, 0) + ' 1 0;background:#E4E4E7"></span></div>' +
      '<div class="grid3">' +
        '<div class="col"><span class="row small" style="gap:5px;color:#3F3F46"><span class="dot" style="background:#16A34A"></span>Знято</span><b style="font-size:20px">' + pct(rd, act) + '%</b><span class="small mute">' + fmt(rd) + '</span></div>' +
        '<div class="col"><span class="row small" style="gap:5px;color:#3F3F46"><span class="dot" style="background:#F59E0B"></span>Список ' + NORM() + '</span><b style="font-size:20px">' + pct(miss, act) + '%</b><span class="small mute">' + fmt(miss) + '</span></div>' +
        '<div class="col"><span class="row small" style="gap:5px;color:#3F3F46"><span class="dot" style="background:#fff;border:2px solid #A1A1AA"></span>Немає даних</span><b style="font-size:20px">' + pct(Math.max(left, 0), act) + '%</b><span class="small mute">' + fmt(Math.max(left, 0)) + '</span></div>' +
      '</div>' + (function () { var st = planStats(); if (!st) return '';
        return '<div class="between" style="border-top:1px solid var(--bg);padding-top:12px;gap:10px"><span class="col" style="gap:2px"><span class="small mute" style="font-size:13px">План · ' + monthName().toLowerCase() + ' · ' + plan().villages.length + ' ' + plural(plan().villages.length, 'село', 'села', 'сіл') + '</span><b style="font-size:20px">' + pct(st.done, st.act) + '% · залишилось ' + fmt(st.left) + '</b></span><span class="small mute" style="text-align:right">≈' + fmt(st.pace) + ' адрес<br>на день</span></div>'; })() + '<span class="btn" style="height:50px;gap:8px">' + icon('chart', 18) + 'Детальна аналітика' + icon('right', 16, 2.4) + '</span></a>';
  }
  function statusList() {
    var ps = villagePoints(), c = counts(ps);
    return '<div class="card" style="gap:8px;padding:14px 16px"><div class="between"><span class="small mute" style="font-size:13px">Доступ · ' + esc(vLabel()) + '</span>' +
      (village() && village() !== ALL ? '<a class="small" href="#village/' + encodeURIComponent(village()) + '" style="font-weight:700">Детально ' + icon('right', 12, 2.6) + '</a>' : '') + '</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap">' + ST_ORDER.map(function (s2) {
        return '<a class="chip" href="#map" data-act="filter" data-st="' + s2 + '" style="height:38px;font-size:15px;gap:6px">' + dotHtml(s2) + '<b>' + fmt(c[s2]) + '</b></a>';
      }).join('') + '</div></div>';
  }
  /* на головній: хто якою вулицею в обраному селі */
  function streetsCard() {
    var v = village(), ic = '<span class="hico">' + icon('streets', 22) + '</span>';
    var head = function (sub, title, right) { return '<div class="row" style="gap:12px;align-items:center">' + ic + '<div class="col" style="gap:2px;flex:1;min-width:0">' + (sub ? '<span class="small mute" style="font-size:13px">' + sub + '</span>' : '') + '<b style="font-size:17px">' + title + '</b></div>' + (right || icon('right', 18, 2.4)) + '</div>'; };
    if (!v || v === ALL) return '<a href="#sectors" class="card" style="gap:8px">' + head('', 'Хто якою вулицею') + '<span class="small mute">Оберіть село вгорі, щоб розділити вулиці між контролерами</span></a>';
    var sv = splitOf(v), mi = myIdx(sv);
    if (!sv) return '<a href="#sectors" class="card" style="gap:10px">' + head('Вулиці · ' + esc(v), 'Хто якою вулицею: ще не розподілено') + '<span class="small mute">Розділити вулиці між тими, хто сьогодні в селі, або сканувати QR колеги</span></a>';
    var st = splitStats(v, sv.crew.length, sv.assign);
    return '<a href="#sectors" class="card" style="gap:10px">' + head('Вулиці · ' + esc(v) + ' · ' + sv.crew.length + ' контролери', mi != null ? 'Ваші вулиці: ' + st[mi].streets + ' · ' + st[mi].left + ' адрес чекають' : 'Розподілено, оберіть «Це я»') +
      '<div class="tags">' + sv.crew.map(function (n, i) { return '<span class="chip" style="background:#fff;border:1.5px solid ' + SEC_COL[i % SEC_COL.length] + '"><span class="dot" style="background:' + SEC_COL[i % SEC_COL.length] + '"></span>' + esc(n) + (i === mi ? ' · я' : '') + ' <span style="opacity:.6">' + st[i].left + '</span></span>'; }).join('') + '</div></a>';
  }
  function counts(ps) { var c = { g: 0, y: 0, r: 0, n: 0 }; ps.forEach(function (p) { c[p.status]++; }); return c; }
  function renderHome() {
    var ps = villagePoints(), c = counts(ps);
    var active = ps.filter(function (p) { return p.status !== 'n'; });
    var read = active.filter(readThisCycle).length;
    var vis = function (p) { return village() !== ALL || inPlan(p.village); };
    var leftPlan = active.filter(function (p) { return vis(p) && !doneThisCycle(p); }).length, left180 = active.filter(function (p) { return vis(p) && in180(p) && !visitedToday(p); }).length;
    var r180 = routeCfg().round === '180', left = r180 ? left180 : leftPlan;
    var r = ensureRoute(); var first = r && r.ids.length ? S.points.get(r.ids[0]) : null;
    var km = r ? fdist(r.meters) : '—', hrs = r ? Math.max(1, Math.round((r.meters / 1.25 / 60 + r.ids.length * 3) / 60)) : 0;
    var needBackup = !S.meta.lastBackup || Date.now() - S.meta.lastBackup > 3 * 864e5;
    app.innerHTML = '<div class="screen">' +
      '<div class="between">' + villageSelect('vsel') + '<button class="iconbtn" data-act="search" aria-label="Пошук адреси">' + icon('search') + '</button></div>' +
      '<div class="col" style="gap:2px;padding:4px 2px 0"><div class="small mute" style="font-size:13px">' + monthName() + ' · сьогодні</div><h1 class="h1">' + left + ' адрес чекають</h1></div>' +
      '<div class="seg segw" style="background:#fff;box-shadow:none;height:48px"><button data-act="round" data-v="plan" class="' + (r180 ? '' : 'on') + '" style="height:40px">Плановий · ' + leftPlan + '</button>' +
        '<button data-act="round" data-v="180" class="' + (r180 ? 'on' : '') + '" style="height:40px">Коло ' + NORM() + ' · ' + left180 + '</button></div>' +
      planTile() +
      planCard() +
      streetsCard() +
      statusList() +
      '<a href="#map" data-act="startRoute" class="card big dark" style="gap:16px">' +
        '<div class="between" style="align-items:flex-start"><div class="col" style="gap:4px"><span style="font-size:22px;font-weight:800">Почати обхід</span>' +
        '<span class="small mute" style="font-size:13px">маршрут ' + (r ? r.ids.length : 0) + ' адрес · ' + km + (hrs ? ' · ≈ ' + hrs + ' год' : '') + '</span></div>' +
        '<span style="width:52px;height:52px;border-radius:26px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon('go', 22, 2.4) + '</span></div>' +
        '<div class="col" style="gap:8px">' + (first ? '<div class="between small" style="font-size:13px"><span class="mute">Перша адреса</span><span>' + esc(addr(first)) + (S.pos ? ' · ' + fdist(dist(S.pos, first)) : '') + '</span></div>' : '') +
        goalLine() + '</div></a>' +
      brigadeCard() +
      installCard(true) +
      (needBackup ? '<button class="btn sec" data-act="backup">' + icon('cloud', 18) + 'Зробити резервну копію даних</button>' : '') +
      '</div>' + tabs('home');
    bindVillageSelect('vsel');
    startGps();
    onGps(function () { if (S.route && !S.route.fromGps && (location.hash || '#home') === '#home') { S.route = null; offGps(); renderHome(); } });
  }

  /* ---------- Хід внесення локацій абонентів по дільниці ----------
     Внесено = точка на карті; точно = прив'язано GPS або вручну; з даними = заповнено ПІБ або серійний номер.
     Темп рахується за датою створення точок за останні 30 днів → прогноз, коли буде внесено всіх. */
  var TOTAL_DEFAULT = 23659;
  function coverage() {
    var byA = {}, total = Number(S.meta.totalSubs) || TOTAL_DEFAULT, placed = 0, exact = 0, data = 0, m30 = 0, wk = 0, byV = {}, first = null;
    var t30 = dayKey(Date.now() - 30 * 864e5), t7 = dayKey(Date.now() - 7 * 864e5);
    S.points.forEach(function (p) {
      placed++;
      if (/GPS|вручну/.test(p.src || '')) exact++;
      var f = p.fields || {}; if (f.fio || f.serial) data++;
      var k = p.village || 'Без села'; byV[k] = (byV[k] || 0) + 1;
      /* темп рахуємо лише по точках, внесених контролерами в полі; імпорт з MAPS.ME — разове завантаження, не темп */
      if (p.src === 'MAPS.ME' || !p.created) return;
      if (p.created >= t30) { m30++; var au = p.createdBy || '?'; byA[au] = (byA[au] || 0) + 1; if (!first || p.created < first) first = p.created; }
      if (p.created >= t7) wk++;
    });
    /* темп = точки з поля / робочі дні (вт–сб) від першої такої точки за 30 днів до сьогодні включно */
    var wd = 0; if (first) { var d0 = new Date(first + 'T12:00:00'), d1 = new Date(); d1.setHours(12, 0, 0, 0); for (var dd = new Date(d0); dd <= d1; dd.setDate(dd.getDate() + 1)) if (isWorkDay(dd)) wd++; }
    wd = Math.max(1, wd);
    var perDay = m30 / wd, left = Math.max(0, total - placed), days = perDay > 0 ? Math.ceil(left / perDay) : null;
    var eta = null; if (days != null && days < 22 * 12 * 5) { var d = new Date(); var n = days; while (n > 0) { d.setDate(d.getDate() + 1); if (isWorkDay(d)) n--; } eta = d; }
    var need = Math.ceil(left / (21 * 12));
    return { byA: byA, total: total, placed: placed, exact: exact, data: data, m30: m30, wk: wk, wd: wd, perDay: perDay, left: left, eta: eta, days: days, need: need, byV: byV };
  }
  /* «Уточнити в полі» — згорнутий рядок усередині блоку локацій: видно лише кількість, деталі по тапу */
  function queueFold() {
    var qp = queuePoints(), c = {};
    qp.forEach(function (p) { p.flags.forEach(function (f) { if (QUEUE_FLAGS.indexOf(f) >= 0) c[f] = (c[f] || 0) + 1; }); });
    return '<details class="fold"><summary><span class="row" style="gap:8px">' + icon('pin', 16) + '<b>Уточнити в полі</b></span><span class="row" style="gap:8px"><span class="numbadge" style="background:#F59E0B;color:#111">' + fmt(qp.length) + '</span>' + icon('down', 16, 2.4) + '</span></summary>' +
      '<div class="col" style="gap:8px;padding-top:12px">' + QUEUE_FLAGS.filter(function (f) { return c[f]; }).map(function (f) {
        return '<div class="between" style="font-size:14px"><span class="mute">' + FLAGNAME[f] + '</span><b>' + fmt(c[f]) + '</b></div>';
      }).join('') + '<a class="btn sec" href="#queue" style="height:44px;margin-top:4px">Відкрити список, найближчі першими</a></div></details>';
  }
  function coverageCard(full) {
    var c = coverage(), P = pct(c.placed, c.total), imp = Math.max(0, c.placed - c.exact);
    var etaTxt = c.eta ? MONTHS[c.eta.getMonth()].toLowerCase() + ' ' + c.eta.getFullYear() : c.days ? 'понад 5 років' : 'ще немає даних';
    var leg = function (col, label, n) { return '<div class="between"><span class="row" style="gap:8px"><span class="dot" style="background:' + col + '"></span>' + label + '</span><b>' + fmt(n) + '</b></div>'; };
    var head = '<div class="between" style="align-items:flex-end"><div class="col" style="gap:2px"><span class="small mute" style="font-size:13px">Локації абонентів на карті</span>' +
      '<b style="font-size:24px">' + fmt(c.placed) + ' <span class="mute" style="font-size:15px;font-weight:600">з ' + fmt(c.total) + '</span></b></div><b style="font-size:24px">' + P + '%</b></div>' +
      '<div class="bar" style="height:10px"><span style="flex:' + c.exact + ' 1 0;background:#111;min-width:' + (c.exact ? 4 : 0) + 'px"></span><span style="flex:' + imp + ' 1 0;background:#A1A1AA"></span><span style="flex:' + c.left + ' 1 0;background:#E4E4E7"></span></div>';
    if (!full) return '<a href="#villages" class="card" style="gap:10px">' + head + '<div class="small mute">+' + fmt(c.wk) + ' за тиждень · прогноз: ' + etaTxt + '</div></a>';
    var who = Object.keys(c.byA).sort(function (a, b) { return c.byA[b] - c.byA[a]; });
    var sec = function (t) { return '<div class="cv-sec">' + t + '</div>'; };
    return '<div class="card cv">' + head +
      '<div class="col" style="gap:8px;font-size:14px">' + leg('#111', 'Підтверджено в полі', c.exact) + leg('#A1A1AA', 'З MAPS.ME, не перевірено', imp) + leg('#E4E4E7', 'Ще не на карті', c.left) + '</div>' +

      sec('Темп внесення в полі') +
      '<div class="stgrid"><div class="sttile pace"><span>За 7 днів</span><b>+' + fmt(c.wk) + '</b></div>' +
        '<div class="sttile pace"><span>На робочий день</span><b>' + c.perDay.toFixed(1).replace('.', ',') + '</b><span style="font-size:12px">за ' + c.wd + ' ' + plural(c.wd, 'робочий день', 'робочі дні', 'робочих днів') + '</span></div></div>' +
      '<details class="fold"><summary><span class="mute" style="font-size:14px">Прогноз при такому темпі</span><span class="row" style="gap:8px"><b style="font-size:14px">' + etaTxt + '</b>' + icon('down', 16, 2.4) + '</span></summary>' +
        '<div class="col" style="gap:8px;font-size:14px;padding-top:12px">' +
        '<div class="between"><span class="mute">Щоб закрити за 12 міс.</span><b>≈' + fmt(c.need) + ' на день</b></div>' +
        '<div class="between"><span class="mute">Це на кожного з <button class="linkbtn" data-act="crewN" style="color:#111;font-weight:800">' + crew() + '</button> контролерів</span><b>≈' + fmt(Math.ceil(c.need / crew())) + ' на день</b></div>' +
        '<div class="small mute" style="line-height:1.45">Темп: точки з поля за 30 днів ÷ робочі дні (вт–сб) від першої з них. Прогноз відкладає потрібні робочі дні від сьогодні. 12 міс. = 252 робочі дні. Кількість контролерів можна змінити тапом.</div></div></details>' +

      (who.length ? sec('Хто вносив за 30 днів') + '<div class="col" style="gap:8px;font-size:14px">' + who.map(function (k) {
        var nm = k === '?' ? 'невідомо' : peerName(k) === 'я' ? (me().name || 'я') : peerName(k);
        return '<div class="between"><span class="row" style="gap:8px">' + icon('user', 16) + esc(nm) + '</span><b>' + fmt(c.byA[k]) + '</b></div>'; }).join('') + '</div>' : '') +

      queueFold() +
      '<button class="fold-row" data-act="vEdit"><span class="row" style="gap:8px">' + icon('edit', 16) + '<b>Кількість абонентів по селах</b></span>' + icon('right', 16, 2.4) + '</button></div>';
  }

  /* ---------- План на місяць ---------- */
  /* «План · села на місяць» — перший блок головної */
  function planTile() {
    var p = plan();
    return '<a href="#plan" class="tool dark" style="flex-direction:row;align-items:center;gap:14px;min-height:0;padding:16px 18px">' + icon('list', 22) +
      '<span class="col" style="gap:2px;flex:1;min-width:0;font-size:13px"><b style="margin:0;font-size:17px;color:#fff">План</b><span style="font-size:13px">' + (p ? 'села на ' + monthName().toLowerCase() + ': ' + esc(p.villages.slice().sort(ukSort).join(', ')) : 'задати села на ' + monthName().toLowerCase()) + '</span></span>' + icon('right', 18, 2.4) + '</a>';
  }
  function planCard() {
    var st = planStats();
    if (!st) return '';
    var p = plan();
    return '<a href="#plan" class="card" style="gap:10px"><div class="row" style="gap:12px;align-items:center"><span class="hico">' + icon('chart', 22) + '</span><div class="col" style="gap:2px;flex:1;min-width:0"><span class="small mute" style="font-size:13px">План · ' + monthName().toLowerCase() + ' · ' + p.villages.length + ' сіл</span>' +
      '<b style="font-size:20px">' + pct(st.done, st.act) + '% · залишилось ' + fmt(st.left) + '</b></div>' + icon('right', 18, 2.4) + '</div>' +
      '<div class="bar" style="height:8px"><span style="flex:' + st.done + ' 1 0;background:#111"></span><span style="flex:' + Math.max(st.left, 0) + ' 1 0;background:#E4E4E7"></span></div>' +
      '<div class="small mute">' + st.days + ' робочих днів до кінця місяця → ≈ <b style="color:#111">' + st.pace + ' адрес на день</b></div></a>';
  }
  function renderPlan() {
    var p = S.meta.plan && S.meta.plan.month === monthKey() ? S.meta.plan : { month: monthKey(), villages: [] };
    var vs = villages().filter(function (v) { return v.name !== 'Без села'; }), rn = S.meta.routeNo || {};
    var left = function (v) { var a = 0, d = 0; villagePoints(v).forEach(function (q) { if (q.status === 'n') return; a++; if (doneThisCycle(q)) d++; }); return { a: a, d: d }; };
    var st = planStats();
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col"><div class="small mute">Маршрутні листи</div><h1 class="h1" style="font-size:24px">План на ' + monthName().toLowerCase() + '</h1></div>' +
      (p.villages.length ? '<button class="pill-btn" data-act="planReset" style="margin-left:auto">' + icon('close', 16, 2.4) + 'Скинути</button>' : '') + '</div>' +
      '<div class="small mute" style="line-height:1.5;padding:0 4px">Відмітьте села, які дали на цей місяць. Денний маршрут, вибір села і темп рахуються лише по них. Після будь-якого візиту цього місяця адреса виходить з планового обходу; хто не зчитаний понад ' + NORM() + ' днів, іде в «Список ' + NORM() + '» на друге коло.</div>' +
      (st ? '<div class="card dark" style="gap:8px"><div class="between"><span class="small mute">Разом по плану</span><b>' + pct(st.done, st.act) + '%</b></div>' +
        '<div style="font-size:22px;font-weight:800">' + fmt(st.left) + ' адрес залишилось</div>' +
        '<div class="small mute">' + st.days + ' робочих днів → ≈ ' + st.pace + ' на день · зараз у маршруті ' + limLabel(routeCfg().limit) + '</div>' +
        '<button class="btn" data-act="applyPace" style="background:#fff;color:#111;height:46px;font-size:14px">Ставити ' + st.pace + ' адрес у денний маршрут</button></div>' : '') +
      /* відмічені в плані — нагорі (за абеткою), далі решта (теж за абеткою) */
      (function () {
        var onV = vs.filter(function (v) { return p.villages.indexOf(v.name) >= 0; }), offV = vs.filter(function (v) { return p.villages.indexOf(v.name) < 0; });
        var rowsOf = function (list) { return list.map(function (v) {
        var on = p.villages.indexOf(v.name) >= 0, l = left(v.name);
        return '<div class="list-row" style="gap:10px"><button class="pk-row' + (on ? ' on' : '') + '" data-act="planToggle" data-v="' + esc(v.name) + '" style="flex-grow:1;min-height:52px">' +
          '<span class="col" style="gap:2px;min-width:0"><span>' + esc(v.name) + '</span><span class="small" style="opacity:.6">залишилось ' + (l.a - l.d) + ' з ' + l.a + '</span></span><span class="sw' + (on ? ' on' : '') + '"></span></button>' +
          (on ? '<input class="input" data-act="none" data-rno="' + esc(v.name) + '" value="' + esc(rn[v.name] || '') + '" placeholder="Маршрут №" style="width:110px;height:48px;font-size:14px">' : '') + '</div>';
        }).join(''); };
        var hd = function (t) { return '<div class="small mute" style="padding:8px 4px 4px;font-size:13px;font-weight:700">' + t + '</div>'; };
        return (onV.length ? hd('У плані · ' + onV.length) + '<div class="card" style="gap:0;padding:6px 12px">' + rowsOf(onV) + '</div>' : '') +
          hd(onV.length ? 'Інші села' : 'Села') + '<div class="card" style="gap:0;padding:6px 12px">' + rowsOf(offV) + '</div>';
      })() + '</div>' + tabs('home');
    document.querySelectorAll('[data-rno]').forEach(function (el) {
      el.onchange = function () { var m = Object.assign({}, S.meta.routeNo || {}); m[el.getAttribute('data-rno')] = el.value.trim(); shareSet('routeNo', m); toast('Номер маршруту збережено'); };
    });
  }
  /* скидання плану: перший тап питає, другий (протягом 3 с) скидає села і номери маршрутів цього місяця */
  function planReset(el) {
    if (!el.classList.contains('warn')) { el.classList.add('warn'); el.lastChild.textContent = 'Точно?'; clearTimeout(planReset._t); planReset._t = setTimeout(function () { if (el.isConnected) { el.classList.remove('warn'); el.lastChild.textContent = 'Скинути'; } }, 3000); return; }
    var old = (S.meta.plan && S.meta.plan.villages) || [], rn = Object.assign({}, S.meta.routeNo || {});
    old.forEach(function (v) { delete rn[v]; });
    Promise.all([shareSet('plan', { month: monthKey(), villages: [], updated: Date.now() }), shareSet('routeNo', rn)]).then(function () { S.route = null; renderPlan(); toast('План скинуто'); });
  }
  function planToggle(v) {
    var p = S.meta.plan && S.meta.plan.month === monthKey() ? Object.assign({}, S.meta.plan) : { month: monthKey(), villages: [] };
    p.villages = p.villages.indexOf(v) >= 0 ? p.villages.filter(function (x) { return x !== v; }) : p.villages.concat([v]);
    p.updated = Date.now();
    shareSet('plan', p).then(function () {
      if (p.villages.length && p.villages.indexOf(village()) < 0) { var nv = nextPlanVillage() || p.villages[0]; setMeta('village', nv); S.route = null; }
      var y = window.scrollY; renderPlan(); window.scrollTo(0, y);
    });
  }

  /* ---------- Розподіл вулиць села між контролерами ----------
     У село привозять усіх разом, і контролери ділять вулиці між собою. Два режими:
       • автоматично — вулиці діляться так, щоб у кожного було порівну РОБОТИ (хвилини), а не адрес;
       • вручну — тап по вулиці → хто її бере (як домовились усно).
     Розподіл бачать усі: QR-код з телефона на телефон без інтернету, або файл обміну; далі — сервер у реальному часі.
     Хвилини на адресу: зелена 3, червона 5, жовта 7, +1 собака, +2 після 18:00, плюс пішки 75 м/хв.
     Рахуються лише адреси, що ще чекають цього місяця; вулиця ділиться на частини, тільки якщо вона більша за норму однієї людини. */
  var SEC_COL = ['#2563EB', '#DB2777', '#0D9488', '#7C3AED', '#EA580C', '#65A30D', '#0891B2', '#B45309', '#4F46E5', '#BE123C'];
  var SVC = { g: 3, y: 7, r: 5 }, WALK = 75;
  function ptMin(p) { var t = p.tags || [], m = SVC[p.status] || 5; if (t.indexOf('dog') >= 0) m += 1; if (t.indexOf('eve') >= 0) m += 2; return m; }
  var KX = 111320 * Math.cos(50.4 * Math.PI / 180), KY = 110570;
  function fd(a, b) { var x = (a.lon - b.lon) * KX, y = (a.lat - b.lat) * KY; return Math.sqrt(x * x + y * y); }
  function tourLen(ps) { if (ps.length < 2) return 0; var o = nn(ps[0], ps.slice(1), fd), m = 0, prev = ps[0]; o.forEach(function (p) { m += fd(prev, p); prev = p; }); return m; }
  function splitOf(v) { var s = (S.meta.splits || {})[v]; return s && !s.reset && s.month === monthKey() ? s : null; }
  function myIdx(s) { if (!s) return null; var n = me().name, i = n ? s.crew.indexOf(n) : -1; if (i < 0) { var m = (S.meta.splitMine || {})[s.v]; if (m != null) i = m; } return i >= 0 ? i : null; }
  function splitIdx(p) { var s = splitOf(p.village); if (!s) return null; var a = s.assign[p.id]; return a == null ? null : a; }
  function sectorName(i, s) { return (s && s.crew[i]) || 'Контролер ' + (i + 1); }
  function crew() { return Number(S.meta.crewN) || 7; }
  function streetKey(p) { return p.street || ''; }
  /* блоки: вулиця цілком; точки без вулиці — квадрати ~150 м; дуже довга вулиця — шматки вздовж ходу */
  function makeUnits(pts, target) {
    var g = {};
    pts.forEach(function (p) { var k = p.street ? p.street : '#' + Math.round(p.lat * KY / 150) + ':' + Math.round(p.lon * KX / 150); (g[k] = g[k] || []).push(p); });
    var units = [];
    Object.keys(g).forEach(function (k) {
      var ps = g[k], o = nn(ps[0], ps.slice(1), fd); o.unshift(ps[0]);
      var wOf = function (L) { var m = 0, live = L.filter(function (p) { return !doneThisCycle(p); }); live.forEach(function (p) { m += ptMin(p); }); return Math.max(0.5, m + tourLen(live) / WALK); };
      var w = wOf(o), parts = w > target * 0.6 ? Math.ceil(w / (target * 0.5)) : 1, size = Math.ceil(o.length / parts);
      for (var i = 0; i < o.length; i += size) {
        var ch = o.slice(i, i + size), c = centroid(ch);
        units.push({ key: k, street: ch[0].street || '', pts: ch, lat: c.lat, lon: c.lon, w: wOf(ch), left: ch.filter(function (p) { return !doneThisCycle(p); }).length });
      }
    });
    return units;
  }
  function partition(units, k) {
    var total = 0; units.forEach(function (u) { total += u.w; });
    var T = total / k, c0 = centroid(units);
    /* стартові центри: найдальші точки (детерміновано — однаковий результат на всіх телефонах) */
    var C = [], far = null, fdm = -1;
    units.forEach(function (u) { var d = fd(u, c0); if (d > fdm) { fdm = d; far = u; } });
    C.push({ lat: far.lat, lon: far.lon });
    while (C.length < k) {
      var best = null, bd = -1;
      units.forEach(function (u) { var m = Infinity; C.forEach(function (c) { m = Math.min(m, fd(u, c)); }); m *= Math.sqrt(u.w); if (m > bd) { bd = m; best = u; } });
      C.push({ lat: best.lat, lon: best.lon });
    }
    var A = new Array(units.length), L;
    for (var it = 0; it < 20; it++) {
      L = C.map(function () { return 0; });
      var D = units.map(function (u) { return C.map(function (c) { return fd(u, c); }); });
      var ord = units.map(function (_, i) { var s = D[i].slice().sort(function (a, b) { return a - b; }); return { i: i, r: (s[1] || s[0]) - s[0] }; })
        .sort(function (a, b) { return b.r - a.r; });
      ord.forEach(function (o) {
        var i = o.i, u = units[i], cs = C.map(function (_, j) { return j; }).sort(function (a, b) { return D[i][a] - D[i][b]; });
        var j = cs.filter(function (j) { return L[j] + u.w <= T * 1.08; })[0];
        if (j == null) j = cs.slice(0, 3).sort(function (a, b) { return L[a] - L[b]; })[0];
        A[i] = j; L[j] += u.w;
      });
      var moved = 0;
      C = C.map(function (c, j) {
        var a = 0, b = 0, w = 0; units.forEach(function (u, i) { if (A[i] === j) { a += u.lat * u.w; b += u.lon * u.w; w += u.w; } });
        if (!w) return c; var n = { lat: a / w, lon: b / w }; moved = Math.max(moved, fd(n, c)); return n;
      });
      if (moved < 5) break;
    }
    /* шліфування меж */
    for (var pass = 0; pass < 6; pass++) {
      var ch = 0;
      units.forEach(function (u, i) {
        var a = A[i], da = fd(u, C[a]);
        C.forEach(function (c, b) {
          if (b === a || L[b] + u.w >= L[a]) return;
          var db = fd(u, c);
          if (db > da * 1.35 + 250) return;
          var before = Math.max(Math.abs(L[a] - T), Math.abs(L[b] - T)), after = Math.max(Math.abs(L[a] - u.w - T), Math.abs(L[b] + u.w - T));
          if (after < before - 1) { L[a] -= u.w; L[b] += u.w; A[i] = b; a = b; da = db; ch++; }
        });
      });
      if (!ch) break;
    }
    /* догрузка найлегшого сектора найближчими блоками сусідів (з м'якшим обмеженням відстані) */
    for (var g = 0; g < 300; g++) {
      var j = 0; L.forEach(function (l, i) { if (l < L[j]) j = i; });
      var bi = -1, bs = Infinity;
      units.forEach(function (u, i) {
        var a = A[i]; if (a === j || L[a] - u.w <= L[j]) return;
        var dj = fd(u, C[j]), da = fd(u, C[a]); if (dj > da * 2 + 1500) return;
        var after = Math.max(Math.abs(L[a] - u.w - T), Math.abs(L[j] + u.w - T)), before = Math.max(Math.abs(L[a] - T), Math.abs(L[j] - T));
        if (after >= before - 1) return;
        if (dj - da < bs) { bs = dj - da; bi = i; }
      });
      if (bi < 0) break;
      L[A[bi]] -= units[bi].w; L[j] += units[bi].w; A[bi] = j;
    }
    return { A: A, C: C, T: T };
  }
  /* підсумок по людях з довільного розподілу (pid → індекс) */
  function splitStats(v, k, assign) {
    var out = []; for (var j = 0; j < k; j++) out.push({ i: j, n: 0, left: 0, min: 0, streets: {} });
    var by = {};
    villagePoints(v).forEach(function (p) { var j = assign[p.id]; if (j == null || p.status === 'n' || !out[j]) return; var o = out[j]; o.n++; if (p.street) o.streets[p.street] = 1;
      if (!doneThisCycle(p)) { o.left++; o.min += ptMin(p); (by[j] = by[j] || []).push(p); } });
    out.forEach(function (o) { o.min += tourLen(by[o.i] || []) / WALK; o.streets = Object.keys(o.streets).length; });
    return out;
  }
  /* точки без вулиці — до того, хто має найближчу точку з вулицею (однаково рахується на всіх телефонах) */
  function fillNoStreet(v, assign) {
    var withS = villagePoints(v).filter(function (p) { return p.street && assign[p.id] != null; });
    villagePoints(v).forEach(function (p) {
      if (p.street || assign[p.id] != null) return;
      var b = null, bd = Infinity; withS.forEach(function (q) { var d = fd(p, q); if (d < bd) { bd = d; b = q; } });
      if (b) assign[p.id] = assign[b.id];
    });
    return assign;
  }
  function autoSplit(v, k) {
    var pts = villagePoints(v).filter(function (p) { return p.status !== 'n'; }); if (pts.length < k) return null;
    var tot = 0; pts.forEach(function (p) { if (!doneThisCycle(p)) tot += ptMin(p) + 1; });
    var units = makeUnits(pts, Math.max(30, tot / k)), P = partition(units, k), assign = {};
    units.forEach(function (u, i) { u.pts.forEach(function (p) { assign[p.id] = P.A[i]; }); });
    return assign;
  }
  var SP = null; /* робочий стан екрана: { v, crew, assign, focus, mode, saved } */
  function crewSuggest() {
    var a = [];
    if (me().name) a.push(me().name);
    Object.keys(S.meta.peers || {}).forEach(function (k) { var n = S.meta.peers[k].name; if (n && a.indexOf(n) < 0) a.push(n); });
    (S.meta.crewNames || []).forEach(function (n) { if (a.indexOf(n) < 0) a.push(n); });
    return a;
  }
  function renderSectors() {
    mapMode = 'sectors';
    var v = village();
    if (!SP || SP.v !== v) {
      var sv = v && v !== ALL ? splitOf(v) : null;
      SP = sv ? { v: v, crew: sv.crew.slice(), assign: Object.assign({}, sv.assign), mode: 'auto', saved: true, focus: null }
        : { v: v, crew: crewSuggest().slice(0, 3), assign: null, mode: 'auto', saved: false, focus: null };
      while (SP.crew.length < 2) SP.crew.push('Контролер ' + (SP.crew.length + 1));
    }
    app.innerHTML = '<div class="mapui" style="top:18px"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button>' + villageSelect() + '</div></div>' +
      '<div class="sheet sec-sheet" id="sec-ui"></div>';
    if (!v || v === ALL) { $('#sec-ui').innerHTML = '<div class="h2">Оберіть село</div><div class="small mute">Вулиці діляться в межах одного села, куди вас привезли.</div>'; fitSectors(); return; }
    if (!SP.assign) SP.assign = autoSplit(v, SP.crew.length) || {};
    renderSectorsUi(); fitSectors();
  }
  function fitSectors() {
    var go2 = function () { updateMap(); var ps = villagePoints().filter(function (p) { return SP && (SP.focus == null || SP.assign[p.id] === SP.focus); }); if (ps.length) fitTo(ps, Math.round(window.innerHeight * 0.58)); };
    if (mapReady) go2(); else S.pendingFit = go2;
  }
  /* скидання розподілу вулиць у селі: два тапи; «надгробок» з часом, щоб скидання дійшло колегам */
  function spReset(el) {
    if (!el.classList.contains('warn')) { el.classList.add('warn'); el.lastChild.textContent = 'Точно?'; clearTimeout(spReset._t); spReset._t = setTimeout(function () { if (el.isConnected) { el.classList.remove('warn'); el.lastChild.textContent = 'Скинути'; } }, 3000); return; }
    var v = SP.v, all = Object.assign({}, S.meta.splits || {});
    all[v] = { month: monthKey(), reset: true, made: Date.now(), by: me().id };
    setMeta('splits', all).then(function () { scheduleSync(); SP = null; S.route = null; toast('Розподіл вулиць скинуто'); renderSectors(); });
  }
  function renderSectorsUi() {
    var el = $('#sec-ui'); if (!el || !SP) return;
    var st = splitStats(SP.v, SP.crew.length, SP.assign), sv = splitOf(SP.v), mine = myIdx(sv);
    var mins = st.map(function (o) { return o.min; }), avg = mins.reduce(function (a, b) { return a + b; }, 0) / (st.length || 1);
    var spread = avg ? (Math.max.apply(null, mins) - Math.min.apply(null, mins)) / avg : 0;
    var streets = {}; villagePoints(SP.v).forEach(function (p) { if (p.status === 'n') return; var k = streetKey(p); var o = streets[k] = streets[k] || { n: 0, left: 0, who: {} }; o.n++; if (!doneThisCycle(p)) o.left++; var j = SP.assign[p.id]; if (j != null) o.who[j] = (o.who[j] || 0) + 1; });
    var names = Object.keys(streets).filter(Boolean).sort(ukSort);
    var whoOf = function (o) { var ks = Object.keys(o.who); return ks.length === 1 ? +ks[0] : ks.length ? 'mix' : null; };
    el.innerHTML = '<div class="between"><div class="col" style="gap:2px"><b style="font-size:17px">Хто якою вулицею</b><span class="small mute">' + (SP.saved ? 'Збережено' + (sv && sv.by && sv.by !== me().id ? ' · від ' + esc(peerName(sv.by)) : '') : 'Не збережено') + ' · різниця навантаження ' + Math.round(spread * 100) + '%</span></div>' +
      (sv || SP.saved ? '<button class="pill-btn" data-act="spReset">' + icon('close', 14, 2.6) + '<span>Скинути</span></button>' : '') + '</div>' +
      '<div class="col" style="gap:6px"><div class="small mute">Хто сьогодні в селі</div><div class="tags">' + SP.crew.map(function (n, i) {
        return '<span class="chip" style="background:#fff;border:1.5px solid ' + SEC_COL[i % SEC_COL.length] + ';gap:6px"><span class="dot" style="background:' + SEC_COL[i % SEC_COL.length] + '"></span>' + esc(n) +
          (SP.crew.length > 2 ? '<button class="seal-x" data-act="crewDel" data-v="' + i + '" aria-label="Прибрати" style="width:20px;height:20px;background:transparent">' + icon('close', 12, 2.6) + '</button>' : '') + '</span>';
      }).join('') + '<button class="chip" data-act="crewAdd">' + icon('plus', 14, 2.6) + 'Додати</button></div></div>' +
      '<div class="seg segw"><button data-act="spMode" data-v="auto" class="' + (SP.mode === 'auto' ? 'on' : '') + '">Автоматично</button><button data-act="spMode" data-v="manual" class="' + (SP.mode === 'manual' ? 'on' : '') + '">Вручну по вулицях</button></div>' +
      (SP.mode === 'auto' ? '<button class="btn out" data-act="spAuto" style="height:46px">Розділити порівну на ' + SP.crew.length + '</button>' : '') +
      '<div class="sec-list">' + st.map(function (o) {
        var foc = SP.focus === o.i;
        return '<button class="sec-row' + (foc ? ' on' : '') + '" data-act="secPick" data-v="' + o.i + '"><span class="dot" style="background:' + SEC_COL[o.i % SEC_COL.length] + ';width:14px;height:14px"></span>' +
          '<span class="col" style="flex-grow:1;min-width:0;gap:1px"><b>' + esc(SP.crew[o.i]) + (mine === o.i ? ' · я' : '') + '</b><span class="small mute">' + o.streets + ' вулиць · ' + o.n + ' адрес</span></span>' +
          '<span class="col" style="align-items:flex-end;gap:1px;flex-shrink:0"><b>' + o.left + ' чекають</b><span class="small mute">≈ ' + (o.min / 60).toFixed(1).replace('.', ',') + ' год</span></span></button>' +
          (foc && SP.saved ? '<button class="btn sec" data-act="secMine" data-v="' + o.i + '" style="height:42px;font-size:13px">' + (mine === o.i ? 'Це я ✓ — мій маршрут лише по цих вулицях' : 'Це я') + '</button>' : '');
      }).join('') + '</div>' +
      (SP.mode === 'manual' ? '<div class="small mute">Торкніться вулиці, щоб вибрати, хто її бере</div><div class="col" style="gap:4px">' + names.map(function (n) {
        var o = streets[n], w = whoOf(o);
        return '<button class="sec-row" data-act="spStreet" data-v="' + esc(n) + '" style="padding:8px 12px"><span class="col" style="flex-grow:1;min-width:0;gap:0"><b>' + esc(n) + '</b><span class="small mute">' + o.left + ' з ' + o.n + ' чекають</span></span>' +
          (w === 'mix' ? '<span class="chip">кілька</span>' : w == null ? '<span class="chip">нікого</span>' : '<span class="chip" style="background:' + SEC_COL[w % SEC_COL.length] + ';color:#fff">' + esc(SP.crew[w]) + '</span>') + '</button>';
      }).join('') + (streets[''] ? '<div class="small mute" style="padding:4px">Без назви вулиці: ' + streets[''].n + ' — до найближчого сусіда</div>' : '') + '</div>' : '') +
      '<div class="row" style="gap:8px"><button class="btn" data-act="secSave" style="flex:1;height:50px">Зберегти</button><button class="btn sec" data-act="spQr" style="flex:1;height:50px">' + icon('grid', 18) + 'Показати QR</button></div>' +
      '<button class="btn sec" data-act="spScan" style="height:46px">' + icon('camera', 18) + 'Сканувати QR колеги</button>' +
      '<div class="small mute" style="line-height:1.45">QR передає розподіл з телефона на телефон без інтернету. Він також іде у файл обміну з колегами. З сервером розподіл з\'являтиметься в усіх одразу.</div>';
  }
  function spSave(from) {
    var sv = { v: SP.v, month: monthKey(), crew: SP.crew.slice(), assign: fillNoStreet(SP.v, Object.assign({}, SP.assign)), made: Date.now(), by: from || me().id };
    var all = Object.assign({}, S.meta.splits || {}); all[SP.v] = sv;
    var names = (S.meta.crewNames || []).slice(); SP.crew.forEach(function (n) { if (!/^Контролер \d+$/.test(n) && names.indexOf(n) < 0) names.push(n); });
    return Promise.all([setMeta('splits', all), setMeta('crewNames', names.slice(-20))]).then(function () { SP.saved = true; SP.assign = sv.assign; S.route = null; });
  }
  function saveSectors() { spSave().then(function () { toast('Розподіл збережено'); renderSectorsUi(); }); }
  function setMine(i) {
    var m = Object.assign({}, S.meta.splitMine || {}); m[SP.v] = m[SP.v] === i ? null : i;
    var p = me().name && SP.crew.indexOf(me().name) >= 0 && SP.crew.indexOf(me().name) !== i ? null : 1;
    setMeta('splitMine', m).then(function () { S.route = null; toast(m[SP.v] == null ? 'Маршрут — по всьому селу' : 'Ваш маршрут: лише вулиці ' + SP.crew[i]); renderSectorsUi(); });
  }
  /* QR: назви вулиць → індекс людини; змішані вулиці — по точках; точки без вулиці перераховує сам телефон */
  function spPayload() {
    var s = {}, x = {}, mix = {};
    villagePoints(SP.v).forEach(function (p) { if (!p.street) return; var j = SP.assign[p.id]; if (j == null) return; if (s[p.street] == null) s[p.street] = j; else if (s[p.street] !== j) mix[p.street] = 1; });
    villagePoints(SP.v).forEach(function (p) { if (p.street && mix[p.street]) x[p.id] = SP.assign[p.id]; });
    Object.keys(mix).forEach(function (k) { delete s[k]; });
    return JSON.stringify({ k: 'ks1', v: SP.v, m: monthKey(), c: SP.crew, s: s, x: x });
  }
  function spQr() {
    if (!SP.saved) { spSave().then(spQr); return; }
    var txt = spPayload(), qr;
    try { qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; qr = qrcode(0, 'L'); qr.addData(txt, 'Byte'); qr.make(); } catch (e) { return toast('Забагато даних для QR — надішліть файлом'); }
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov show';
    ov.innerHTML = '<div class="pk-sheet" style="align-items:center"><div class="h2">' + esc(SP.v) + ' · ' + SP.crew.length + ' контролери</div>' +
      '<div class="qrbox">' + qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) + '</div>' +
      '<div class="small mute" style="text-align:center">Колеги: «Вулиці» → «Сканувати QR колеги»</div><button class="btn" data-pk="close">Готово</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-pk]')) closeSheet(); });
    document.body.appendChild(ov);
  }
  function applySplitCode(txt) {
    var d; try { d = JSON.parse(txt); } catch (e) { return toast('Це не QR розподілу'); }
    if (d.k !== 'ks1') return toast('Це не QR розподілу');
    var assign = {};
    S.points.forEach(function (p) { if (p.village !== d.v) return; if (d.x[p.id] != null) assign[p.id] = d.x[p.id]; else if (p.street && d.s[p.street] != null) assign[p.id] = d.s[p.street]; });
    var go2 = function () {
      SP = { v: d.v, crew: d.c, assign: assign, mode: 'auto', saved: false, focus: null };
      spSave('qr').then(function () {
        toast('Розподіл отримано: ' + d.v);
        if (!me().name || d.c.indexOf(me().name) < 0) openSheet('Хто з них ви?', d.c.map(function (n, i) { return { v: String(i), l: n }; }), null, function (i) { setMine(+i); });
        render();
      });
    };
    if (d.v !== village()) setMeta('village', d.v).then(go2); else go2();
  }
  function spScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Камера недоступна');
    closeSheet();
    var ov = document.createElement('div'); ov.id = 'picker'; ov.className = 'pk-ov show scan';
    ov.innerHTML = '<video playsinline muted></video><div class="scan-frame"></div><button class="btn" data-pk="close" style="position:absolute;left:16px;right:16px;width:auto;bottom:calc(24px + var(--safe-b))">Скасувати</button>';
    document.body.appendChild(ov);
    var video = ov.querySelector('video'), stream = null, stop = false, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    var end = function () { stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); closeSheet(); };
    ov.addEventListener('click', function (e) { if (e.target.closest('[data-pk]')) end(); });
    var det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    var loadJsQR = function () { return window.jsQR ? Promise.resolve() : new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'lib/jsQR.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); }); };
    var found = function (t) { end(); applySplitCode(t); };
    var tick = function () {
      if (stop) return;
      if (video.readyState < 2) return requestAnimationFrame(tick);
      if (det) det.detect(video).then(function (r) { if (r.length) found(r[0].rawValue); else setTimeout(tick, 150); }).catch(function () { det = null; tick(); });
      else {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
        var im = ctx.getImageData(0, 0, canvas.width, canvas.height), r = window.jsQR(im.data, im.width, im.height);
        if (r && r.data) found(r.data); else setTimeout(tick, 200);
      }
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) { stream = s; video.srcObject = s; return video.play(); })
      .then(function () { return det ? null : loadJsQR(); }).then(tick).catch(function () { end(); toast('Немає доступу до камери'); });
  }

  /* ---------- Звіт ---------- */
  var RP = 'day';
  function periodStart(k) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    if (k === 'week') { var w = (d.getDay() + 5) % 7; d.setDate(d.getDate() - w); }
    if (k === 'month') d.setDate(1);
    if (k === 'cycle') return Date.now() - NORM() * 864e5;
    return d.getTime();
  }
  function reportData(k) {
    var from = periodStart(k), vs = S.visits.filter(function (v) { return v.ts >= from; }), byDay = {}, R = { total: vs.length, ok: 0, none: 0, blocked: 0, empty: 0, mine: 0, km: 0, hours: 0 };
    vs.forEach(function (v) { R[v.result] = (R[v.result] || 0) + 1; if (!v.by || v.by === me().id) R.mine++; (byDay[dayKey(v.ts)] = byDay[dayKey(v.ts)] || []).push(v); });
    /* робочий час дня = від першого до останнього візиту (+10 хв на перший), відстань — між послідовними візитами з GPS */
    Object.keys(byDay).forEach(function (d) {
      var L = byDay[d].sort(function (a, b) { return a.ts - b.ts; });
      R.hours += (L[L.length - 1].ts - L[0].ts) / 36e5 + 1 / 6;
    });
    R.none = (R.none || 0) + (R.blocked || 0); R.blocked = 0;
    R.days = Object.keys(byDay).length; R.byDay = byDay;
    /* дієвість записок: після скількох з них показник таки надійшов */
    R.noteOk = vs.filter(function (v) { return v.result === 'note' && S.visits.some(function (x) { return x.pointId === v.pointId && x.result === 'ok' && x.ts > v.ts; }); }).length;
    /* розбивка по контролерах: візити, зчитано, нові точки за період */
    var W = {}, wk = function (id) { id = id || me().id; return W[id] = W[id] || { id: id, v: 0, ok: 0, miss: 0, note: 0, pts: 0 }; };
    vs.forEach(function (v) { var w = wk(v.by); w.v++; if (v.result === 'ok') w.ok++; if (v.result === 'none' || v.result === 'blocked') w.miss++; if (v.result === 'note') w.note = (w.note || 0) + 1; });
    var fromDay = dayKey(from); S.points.forEach(function (p) { if (p.createdBy && (p.created || '') >= fromDay) wk(p.createdBy).pts++; });
    R.who = Object.keys(W).map(function (k) { return W[k]; }).sort(function (a, b) { return b.v - a.v || b.pts - a.pts; });
    return R;
  }
  /* графік за вибраний період: тиждень — 7 днів, місяць — дні місяця, 180 днів — по тижнях */
  function reportChart(k) {
    var B = [], now = new Date(), add = function (from, to, lab) {
      var L = S.visits.filter(function (v) { return v.ts >= from && v.ts < to; });
      B.push({ lab: lab, n: L.length, ok: L.filter(function (v) { return v.result === 'ok'; }).length });
    };
    var d0 = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }, today0 = d0(now), DAY = 864e5;
    if (k === 'week') { var WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], st0 = today0 - ((now.getDay() + 5) % 7) * DAY;
            /* усі 7 днів робочого тижня: вт ср чт пт сб нд пн; вихідні (нд, пн) підписані сірим */
      for (var i = 0; i < 7; i++) { var a = st0 + i * DAY, dw = new Date(a); add(a, a + DAY, isWorkDay(dw) ? WD[dw.getDay()] : '<span style="opacity:.45">' + WD[dw.getDay()] + '</span>'); } }
    else if (k === 'month') { var m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); for (var t = m0; t <= today0; t += DAY) { var t0 = d0(t + 3600e3 * 3), dn = new Date(t0).getDate(); add(t0, t0 + DAY, dn === 1 || dn % 5 === 0 ? dn : ''); } }
    else { var nW = Math.ceil(NORM() / 7); for (var w = nW - 1; w >= 0; w--) { var e = today0 + DAY - w * 7 * DAY, s0 = e - 7 * DAY; add(s0, e, (w % 6 === 0) ? dt(s0).slice(0, 5) : ''); } }
    var mx = Math.max(5, Math.max.apply(null, B.map(function (x) { return x.n; })));
    return '<div class="chart14" style="grid-template-columns:repeat(' + B.length + ',minmax(0,1fr));gap:' + (B.length > 20 ? 2 : 4) + 'px">' + B.map(function (x) {
      return '<div class="c14"><div class="c14b"><span style="height:' + (x.n / mx * 100) + '%;background:#D4D4D8"></span><span style="height:' + (x.ok / mx * 100) + '%;background:#111;position:absolute;bottom:0;left:0;right:0"></span></div><span class="c14l">' + x.lab + '</span></div>';
    }).join('') + '</div><div class="row small mute" style="gap:12px"><span class="row" style="gap:4px"><span class="dot" style="background:#111"></span>зчитано</span><span class="row" style="gap:4px"><span class="dot" style="background:#D4D4D8"></span>усі відмітки</span>' + (k === 'cycle' ? '<span>· стовпчик = тиждень</span>' : '') + '</div>';
  }
  function renderReport() {
    var R = reportData(RP);
    var others = R.who.filter(function (w) { return w.id !== me().id; });
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><h1 class="h1" style="font-size:24px">Детальна аналітика</h1></div>' +
      '<div class="seg" style="align-self:flex-start">' + [['day', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['cycle', NORM() + ' днів']].map(function (x) { return '<button data-act="rp" data-v="' + x[0] + '" class="' + (RP === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="card dark" style="gap:12px"><div class="small mute">' + ({ day: 'Сьогодні', week: 'Цей тиждень', month: monthName(), cycle: 'Останні ' + NORM() + ' днів' })[RP] + ' · днів з обходом: ' + R.days + '</div>' +
        '<div class="grid3"><div class="col"><b style="font-size:28px">' + fmt(R.total) + '</b><span class="small mute">адрес пройдено</span></div><div class="col"><b style="font-size:28px">' + fmt(R.ok) + '</b><span class="small mute">зчитано · ' + pct(R.ok, R.total) + '%</span></div>' +
        '<div class="col"><b style="font-size:28px">' + fmt(R.note || 0) + '</b><span class="small mute">візитів (записок)</span></div></div>' +
        '<div class="small mute">≈ ' + (R.days ? Math.round(R.total / R.days) : 0) + ' адрес на день обходу</div></div>' +
      '<div class="card"><div class="h2" style="font-size:15px">Результати обходу</div>' + RESULTS.map(function (r) {
        var n = R[r[0]] || 0; return '<div class="between"><span>' + r[1] + '</span><span class="row"><span style="width:110px;height:8px;border-radius:4px;background:#F1F1F3;overflow:hidden;display:flex"><span style="width:' + pct(n, R.total) + '%;background:' + (r[0] === 'ok' ? '#16A34A' : r[0] === 'empty' ? '#A1A1AA' : r[0] === 'note' ? '#111111' : '#F59E0B') + '"></span></span><b style="width:40px;text-align:right">' + n + '</b></span></div>';
      }).join('') + '</div>' +
      /* графік — лише для тижня, місяця і 180 днів; для «Сьогодні» окремого блоку немає */
      (RP === 'day' ? '' : '<div class="card"><div class="h2" style="font-size:15px">' + ({ week: 'По днях тижня', month: 'По днях місяця', cycle: 'По тижнях за ' + NORM() + ' днів' })[RP] + '</div>' + reportChart(RP) + '</div>') +
      (others.length ? '<div class="card" style="gap:4px"><div class="between"><div class="h2" style="font-size:15px">По контролерах</div><span class="small mute">адреси · зчитано · нові точки</span></div>' +
        /* мій рядок — першим і виділеним, з підписами чисел; навіть якщо відміток ще немає */
        (function () { var mid = me().id, mw = R.who.filter(function (w) { return w.id === mid; })[0] || { id: mid, v: 0, ok: 0, pts: 0, miss: 0, note: 0 };
          var stat = function (n, l) { return '<div class="col" style="gap:0"><b style="font-size:24px;line-height:1.1">' + fmt(n) + '</b><span style="font-size:12px;color:#A1A1AA">' + l + '</span></div>'; };
          return '<button class="me-row" data-act="whoMap" data-v="' + esc(mid) + '"><div class="between" style="width:100%"><span class="row" style="gap:8px">' + icon('user', 18) + '<b style="font-size:16px">' + esc(me().name || 'Я') + '</b><span class="me-tag">це ви</span></span>' + icon('right', 14, 2.4) + '</div>' +
            '<div class="grid3" style="width:100%">' + stat(mw.v, 'адрес') + stat(mw.ok, 'зчитано · ' + pct(mw.ok, mw.v) + '%') + stat(mw.pts, 'нові точки') + '</div>' +
            ((mw.miss || mw.note) ? '<span style="font-size:13px;color:#A1A1AA">' + [mw.miss ? 'нема доступу ' + mw.miss : '', mw.note ? 'записок ' + mw.note : ''].filter(Boolean).join(' · ') + '</span>' : '') + '</button>'; })() +
        (R.who.filter(function (w) { return w.id !== me().id; }).length ? R.who.filter(function (w) { return w.id !== me().id; }).map(function (w) {
          return '<button class="list-row" data-act="whoMap" data-v="' + esc(w.id) + '" style="border-left:0;border-right:0;border-bottom:0;background:none;width:100%;text-align:left;padding:10px 0">' + icon('user', 18) +
            '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(whoName(w.id)) + '</b><span class="small mute">' + pct(w.ok, w.v) + '% зчитано' + (w.note ? ' · візитів ' + w.note : '') + (w.miss ? ' · нема доступу ' + w.miss : '') + '</span></div>' +
            '<b style="width:36px;text-align:right">' + w.v + '</b><b style="width:36px;text-align:right">' + w.ok + '</b><b style="width:36px;text-align:right">' + w.pts + '</b>' + icon('right', 14, 2.4) + '</button>';
        }).join('') : '<div class="small mute" style="padding:8px 0">Відміток колег за цей період немає. Вони з\'являються після синхронізації («Я» → «Синхронізація»).</div>') + '</div>' : '') +
      '<div class="row" style="gap:8px"><button class="btn" data-act="shareReport" style="flex:1">Надіслати звіт</button><button class="btn sec" data-act="csvVisits" style="flex:1;height:56px">Журнал у Excel</button></div>' +
      '</div>' + tabs('villages');
  }
  function reportText() {
    var R = reportData(RP), st = planStats(), cv = coverage(), L = ({ day: 'сьогодні ' + dt(Date.now()), week: 'тиждень', month: monthName().toLowerCase(), cycle: 'останні ' + NORM() + ' днів' })[RP];
    return ['Звіт контролера' + (me().name ? ' ' + me().name : '') + ' · ' + L,
      'Адрес пройдено: ' + R.total + ', зчитано: ' + R.ok + ' (' + pct(R.ok, R.total) + '%)',
      'Візитів (залишено записок): ' + (R.note || 0) + (R.noteOk ? ', з них уже передали показник: ' + R.noteOk : ''),
      'Нема доступу: ' + ((R.none || 0) + (R.blocked || 0)) + ', не живуть: ' + (R.empty || 0),
      'Днів: ' + R.days + ', в середньому ' + (R.days ? Math.round(R.total / R.days) : 0) + ' адрес/день',
      st ? 'План ' + monthName().toLowerCase() + ': ' + pct(st.done, st.act) + '%, залишилось ' + st.left + ' адрес, ' + st.days + ' роб. днів' : '',
      'Локації на карті: ' + fmt(cv.placed) + ' з ' + fmt(cv.total) + ' (' + pct(cv.placed, cv.total) + '%)'].filter(Boolean).join('\n');
  }
  function shareReport() {
    var t = reportText();
    if (navigator.share) navigator.share({ text: t }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Звіт скопійовано'); });
    else toast(t);
  }

  /* ---------- Карта ---------- */
  var map = null, mapReady = false, mapMode = 'route';
  function showMap(on) {
    var el = $('#map');
    if (!el) { el = document.createElement('div'); el.id = 'map'; document.body.insertBefore(el, app); }
    el.style.display = on ? 'block' : 'none';
    if (on && !map) initMap();
    if (on && map) setTimeout(function () { map.resize(); }, 30);
    if (map && map.__syncComp) map.__syncComp();
  }
  function initMap() {
    var start = centroid(villagePoints().length ? villagePoints() : Array.from(S.points.values()));
    map = new maplibregl.Map({ container: 'map', style: MAP_STYLE(S.meta.layer || 'scheme'), center: [start.lon, start.lat], zoom: 15.5,
      attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: true, touchPitch: false, maxPitch: 0 });
    /* обертання двома пальцями (і правою кнопкою миші); нахил вимкнено. Коли карту повернуто — з'являється компас, тап повертає північ угору */
    var comp = document.createElement('button'); comp.className = 'compass'; comp.setAttribute('aria-label', 'Північ угору');
    comp.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2l4 10h-8z" fill="#DC2626"/><path d="M12 22l-4-10h8z" fill="#A1A1AA"/></svg>';
    comp.onclick = function () { map.easeTo({ bearing: 0, duration: 400 }); };
    document.body.appendChild(comp);
    var syncComp = function () {
      var bng = map.getBearing(), vis = Math.abs(bng) > 1 && document.getElementById('map').style.display !== 'none';
      comp.style.display = vis ? 'flex' : 'none'; comp.firstChild.style.transform = 'rotate(' + (-bng) + 'deg)';
    };
    map.on('rotate', syncComp); map.on('moveend', syncComp); syncComp(); map.__syncComp = syncComp;
    map.on('style.load', addLayers);
    /* супутник «відвалювався» після згортання: запити тайлів, що впали у фоні, карта більше не повторює,
       а Android може скинути графіку (WebGL). Перезавантажуємо тайли супутника при поверненні, появі мережі,
       відновленні графіки та після помилок тайлів */
    map.on('error', function (e) { if (e && e.sourceId === 'esri') refreshSat(false, 8000); });
    map.on('webglcontextrestored', function () { refreshSat(true); });
    map.getCanvas().addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); }, false);
    /* підстраховка: якщо після зміни шару наші точки зникли, повертаємо їх */
    map.on('styledata', function () { if (map.isStyleLoaded() && !map.getLayer('pts')) addLayers(); });
    map.on('click', function (e) {
      if (mapMode !== 'route' && mapMode !== 'all') return;
      var x = e.point.x, y = e.point.y;
      var hit = map.getLayer('pts') ? map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers: ['pts'] }) : [];
      if (S.adding) { startAdd(e.lngLat, e.point); return; }
      if (hit.length) { selPoint(hit[0].properties.id); return; }
      if (allOpen()) { setMeta('allMin', true); renderAll.fitNext = false; render(); return; }
      startAdd(e.lngLat, e.point);
    });
    map.on('movestart', function (e) { if (e.originalEvent) S.moved = true; });
    map.on('moveend', function () { if (mapMode === 'bind' && S.moved && $('#bindBtn')) $('#bindBtn').disabled = false; });
    map.on('error', function (e) { if (e && e.error && !/Failed to fetch|NetworkError|AJAXError/.test(e.error.message)) console.warn('map', e.error.message); });
  }
  var satT = 0, satTimer = null;
  function refreshSat(force, delay) {
    if (!map || (S.meta.layer || 'scheme') !== 'sat' || !navigator.onLine) return;
    clearTimeout(satTimer);
    satTimer = setTimeout(function () {
      if (!force && Date.now() - satT < 10000) return; satT = Date.now();
      try { var src = map.getSource('esri'); if (src && src.setTiles) src.setTiles(MAP_STYLE('sat').sources.esri.tiles.slice()); map.triggerRepaint(); }
      catch (x) { try { map.setStyle(MAP_STYLE('sat')); } catch (y) {} }
    }, delay || 300);
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
      'circle-radius': ['case', ['has', 'vr'], 0, ['==', ['get', 'sel'], true], 14, ['>', ['get', 'num'], 0], 10, 6],
      /* коло — ще не був; відвідані малює шар pts-v квадратами, коло під ними ховаємо */
      'circle-color': ['case', ['has', 'col'], ['get', 'col'], ['==', ['get', 'jur'], true], '#7C3AED', ['match', ['get', 'st'], 'g', '#16A34A', 'y', '#F59E0B', 'r', '#DC2626', '#FFFFFF']],
      'circle-stroke-color': ['case', ['==', ['get', 'sel'], true], '#111111', ['has', 'vr'], '#FFFFFF', ['==', ['get', 'st'], 'n'], '#A1A1AA', '#FFFFFF'],
      'circle-stroke-width': ['case', ['==', ['get', 'sel'], true], 3, 2],
      'circle-opacity': ['case', ['==', ['get', 'dim'], true], 0.12, ['==', ['get', 'fa'], true], 0.35, 1], 'circle-stroke-opacity': ['case', ['==', ['get', 'dim'], true], 0.12, ['==', ['get', 'fa'], true], 0.35, 1] } });
    /* відвідані цього місяця — квадрат замість кола: синій з ✓ — показник знято; білий із синьою рамкою — був без показника.
       Малюємо самі (canvas), щоб не залежати від шрифтів карти без інтернету */
    var mk = function (name, fill, border, check) {
      if (map.hasImage(name)) return;
      var n = 60, c = document.createElement('canvas'); c.width = c.height = n; var g = c.getContext('2d');
      var rr = function (x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      rr(4, 4, n - 8, n - 8, 12); g.fillStyle = '#FFFFFF'; g.fill();
      rr(9, 9, n - 18, n - 18, 8); g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = border; g.stroke();
      if (check) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(19, 31); g.lineTo(27, 39); g.lineTo(42, 22); g.stroke(); }
      map.addImage(name, g.getImageData(0, 0, n, n), { pixelRatio: 3 });
    };
    if (!map.hasImage('v-off')) { var oc = document.createElement('canvas'); oc.width = oc.height = 33; var og = oc.getContext('2d');
      og.beginPath(); og.arc(16.5, 16.5, 14, 0, Math.PI * 2); og.fillStyle = '#111'; og.fill(); og.lineWidth = 3; og.strokeStyle = '#fff'; og.stroke();
      og.strokeStyle = '#fff'; og.lineWidth = 3.5; og.lineCap = 'round'; og.beginPath(); og.arc(16.5, 17.5, 6.5, -Math.PI * 0.3, Math.PI * 1.3); og.stroke(); og.beginPath(); og.moveTo(16.5, 8); og.lineTo(16.5, 15); og.stroke();
      map.addImage('v-off', og.getImageData(0, 0, 33, 33), { pixelRatio: 3 }); }
    map.addLayer({ id: 'pts-off', type: 'symbol', source: 'pts', filter: ['==', ['get', 'off'], true], layout: {
      'icon-image': 'v-off', 'icon-offset': [11, -11], 'icon-size': ['case', ['==', ['get', 'sel'], true], 1.9, 1.5], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': ['case', ['==', ['get', 'dim'], true], 0.12, ['==', ['get', 'fa'], true], 0.35, 1] } });
    /* аварійний будинок: червоний трикутник «!» зліва над точкою (значок відключення — справа) */
    if (!map.hasImage('v-ruin')) { var rc = document.createElement('canvas'); rc.width = rc.height = 36; var rg = rc.getContext('2d');
      rg.lineJoin = 'round'; rg.beginPath(); rg.moveTo(18, 3); rg.lineTo(33.5, 31); rg.lineTo(2.5, 31); rg.closePath(); rg.fillStyle = '#DC2626'; rg.fill(); rg.lineWidth = 3; rg.strokeStyle = '#fff'; rg.stroke();
      rg.strokeStyle = '#fff'; rg.lineWidth = 3.5; rg.lineCap = 'round'; rg.beginPath(); rg.moveTo(18, 12); rg.lineTo(18, 20); rg.stroke(); rg.beginPath(); rg.arc(18, 25.5, 1.8, 0, Math.PI * 2); rg.fillStyle = '#fff'; rg.fill();
      map.addImage('v-ruin', rg.getImageData(0, 0, 36, 36), { pixelRatio: 3 }); }
    map.addLayer({ id: 'pts-ruin', type: 'symbol', source: 'pts', filter: ['==', ['get', 'ruin'], true], layout: {
      'icon-image': 'v-ruin', 'icon-offset': [-11, -11], 'icon-size': ['case', ['==', ['get', 'sel'], true], 1.9, 1.5], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': ['case', ['==', ['get', 'dim'], true], 0.12, ['==', ['get', 'fa'], true], 0.35, 1] } });
    mk('v-ok', '#2563EB', '#2563EB', true);
    mk('v-no', '#FFFFFF', '#2563EB', false);
    map.addLayer({ id: 'pts-v', type: 'symbol', source: 'pts', filter: ['has', 'vr'], layout: {
      'icon-image': ['match', ['get', 'vr'], 'ok', 'v-ok', 'v-no'], 'icon-size': ['case', ['==', ['get', 'sel'], true], 1.7, 1.25],
      'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-opacity': ['case', ['==', ['get', 'dim'], true], 0.12, ['==', ['get', 'fa'], true], 0.35, 1] } });
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
    meMarker.setLngLat([S.pos.lon, S.pos.lat]); meMarker.getElement().classList.toggle('stale', !!S.pos.stale); sizeAcc();
  }
  function sizeAcc() {
    if (!meMarker || !S.pos) return;
    var mpp = 156543.03 * Math.cos(S.pos.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    var d = Math.max(28, Math.min(400, 2 * (S.pos.acc || 10) / mpp));
    var a = meMarker.getElement().querySelector('.me-acc'); a.style.width = a.style.height = d + 'px';
  }
  function updateMap() {
    if (!map || !mapReady || !map.getSource('pts')) return;
    if (mapMode === 'sectors') {
      (S.markers || []).forEach(function (mk) { mk.remove(); }); S.markers = [];
      var sf = [], asg = SP && SP.assign ? SP.assign : {};
      villagePoints().forEach(function (p) {
        var j = asg[p.id], col = j == null ? '#A1A1AA' : SEC_COL[j % SEC_COL.length];
        sf.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { id: p.id, st: p.status, col: col, num: 0, sel: false, dim: SP && SP.focus != null && SP.focus !== j } });
      });
      map.getSource('pts').setData({ type: 'FeatureCollection', features: sf });
      map.getSource('lbl').setData({ type: 'FeatureCollection', features: [] });
      map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
      updateMe(); return;
    }
    var r = mapMode === 'route' ? ensureRoute() : null, order = {};
    if (r) r.ids.forEach(function (id, i) { order[id] = i + 1; });
    var feats = [], lbl = [];
    var list = mapMode === 'all' ? allFiltered() : villagePoints(), cm = cycleMap();
    var TT = mapMode === 'route' && trailOn() && !S.filter ? todayTouched() : null; if (TT && !TT.__n) TT = null;
    /* коло 180: на карті маршруту лише точки, не зчитані довше за норму (+ відвідані сьогодні, щоб бачити пройдене) */
    if (mapMode === 'route') list = routePts(list);
    list.forEach(function (p) {
      var num = order[p.id] || 0;
      var dim = p.id === S.sel ? false : mapMode === 'route' ? (S.filter ? !stMatch(p, S.filter) : (r && r.off ? false : !num)) : mapMode === 'all' ? false : true;
      var g = { type: 'Point', coordinates: [p.lon, p.lat] };
      var cvv = vstate(p); if (cvv && mapMode === 'route' && !S.filter) dim = false; /* відвідані не гасимо: видно, де вже був */
      var fa = !!TT && !TT[p.id] && p.id !== S.sel && !num;
      var pr = { fa: fa, id: p.id, off: isOff(p), ruin: isRuin(p), jur: isJur(p), st: p.status, num: S.filter ? 0 : num, sel: p.id === S.sel, dim: dim || (!!cvv && !!S.meta.hideDone && p.id !== S.sel) };
      var vs0 = vstate(p); if (vs0) pr.vr = vs0;
      feats.push({ type: 'Feature', geometry: g, properties: pr });
      if (!dim || (mapMode === 'route' && !S.filter)) lbl.push({ type: 'Feature', geometry: g, properties: { h: (p.house || '') + (isOff(p) ? ' · відкл.' : ''), a: addr(p) } });
    });
    map.getSource('pts').setData({ type: 'FeatureCollection', features: feats });
    if (map.getSource('lbl')) map.getSource('lbl').setData({ type: 'FeatureCollection', features: lbl });
    var tcp = document.querySelector('[data-act=trail]'); if (tcp) tcp.outerHTML = trailChip();
    /* номери маршруту — HTML-мітки: не залежать від шрифтів карти і працюють без інтернету */
    (S.markers || []).forEach(function (mk) { mk.remove(); });
    S.markers = [];
    if (r && !S.filter && mapMode === 'route') {
      r.ids.forEach(function (id, i) {
        var p = S.points.get(id), sel = id === S.sel, el = document.createElement('button');
        el.type = 'button'; el.className = 'rnum' + (sel ? ' sel' : '') + ' st-' + p.status; el.textContent = i + 1;
        el.setAttribute('aria-label', '№' + (i + 1) + ' ' + addr(p));
        el.onclick = function (e) { e.stopPropagation(); selPoint(id); };
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
  function fitTo(ps, bottom) {
    if (!map || !ps.length) return;
    map.resize();
    if (ps.length === 1) return map.easeTo({ center: [ps[0].lon, ps[0].lat], zoom: 17.5 });
    /* точки, віднесені до села помилково (за десятки км), не мають віддаляти карту: беремо ядро в радіусі 4 км від медіани */
    if (ps.length > 20) {
      var med = function (arr) { arr = arr.slice().sort(function (x, y) { return x - y; }); return arr[arr.length >> 1]; };
      var c0 = { lat: med(ps.map(function (p) { return p.lat; })), lon: med(ps.map(function (p) { return p.lon; })) };
      var core = ps.filter(function (p) { return dist(c0, p) < 4000; });
      if (core.length >= ps.length * 0.6) ps = core;
    }
    var b = new maplibregl.LngLatBounds();
    ps.forEach(function (p) { b.extend([p.lon, p.lat]); });
    map.fitBounds(b, { padding: { top: bottom ? 90 : 190, bottom: bottom || 280, left: 40, right: 40 }, maxZoom: 17.5, duration: 0 });
  }
  function setLayer(l) {
    setMeta('layer', l); mapReady = false;
    map.setStyle(MAP_STYLE(l), { diff: false });
    if (l === 'sat' && !navigator.onLine) toast('Супутник доступний лише з інтернетом');
  }
  /* точки, які показує карта «Маршрут»: у колі 180 лише не зчитані довше за норму (+ обрана і відвідані сьогодні) */
  function routePts(list) {
    if (routeCfg().round !== '180') return list;
    return list.filter(function (p) { return p.id === S.sel || (p.status !== 'n' && in180(p)) || visitedToday(p); });
  }
  function renderMap() {
    mapMode = 'route';
    var r = ensureRoute();
    if (!S.sel || routeIndex(S.sel) < 0 && !S.points.get(S.sel)) S.sel = r && r.ids[0];
    if (r && r.off && !S.sel && S.pos) { var bp = null, bd = Infinity; routePts(villagePoints()).forEach(function (p) { var d = dist(S.pos, p); if (d < bd && p.status !== 'n') { bd = d; bp = p; } }); S.sel = bp && bp.id; }
    var c = counts(routePts(villagePoints())), lay = S.meta.layer || 'scheme';
    /* Обхід: зверху лише село і тонкий рядок статусів; кнопки карти — праворуч унизу під пальцем; налаштування маршруту — у панелі */
    setMeta('mapTab', 'map');
    app.innerHTML = '<div class="mapui" style="top:18px;display:flex;flex-direction:column;gap:10px">' +
      searchBar() + '<div id="apanel" style="display:flex;flex-direction:column;gap:10px;align-items:flex-start' + (AQ ? ';display:none' : '') + '">' +
      '<div class="between" style="width:100%;gap:8px">' + villageSelect('vsel').replace('class="vsel"', 'class="vsel mrow-l"') + mapSeg('map') + '</div>' +
      '<div class="pill tilebar" style="padding:0 6px;gap:0;max-width:100%;overflow-x:auto">' + ST_ORDER.map(function (s) {
        return '<button class="tb-item' + (S.filter === s ? ' on' : '') + (S.filter && S.filter !== s ? ' off' : '') + '" data-act="filter" data-st="' + s + '" aria-label="' + ST[s].label + '">' + dotHtml(s) + '<b>' + c[s] + '</b></button>';
      }).join('') + (function () { var nj = villagePoints().filter(isJur).length; return nj ? '<button class="tb-item' + (S.filter === 'jur' ? ' on' : '') + (S.filter && S.filter !== 'jur' ? ' off' : '') + '" data-act="filter" data-st="jur" aria-label="Юридичні"><span class="dot" style="background:#7C3AED"></span><b>' + nj + '</b></button>' : ''; })() + '<span class="tb-sep"></span>' + doneChip() + '<span class="tb-sep"></span>' + trailChip() + '</div>' +
      '</div></div>' +
      fabsHtml(true) +
      '<div id="sheet"></div>' + tabs('map');
    bindVillageSelect('vsel');
    renderSheet(); bindSearch();
    var doFit = function () { updateMap(); var sel = S.points.get(S.sel); if (renderMap.fitNext !== false) { var vp = villagePoints(), c180 = routeCfg().round === '180' ? vp.filter(function (p) { return p.status !== 'n' && in180(p); }) : []; fitTo(sel ? [sel] : c180.length ? c180 : vp); } renderMap.fitNext = true; };
    if (mapReady) doFit(); else S.pendingFit = doFit;
    startGps();
    var lastRecalc = 0;
    onGps(function () {
      updateMe(); renderSheetSoft();
      if (!S.adding && !typingInSheet() && S.route && !S.route.fromGps && Date.now() - lastRecalc > 20000) { lastRecalc = Date.now(); S.route = computeRoute(); S.sel = S.route.ids[0]; updateMap(); renderSheet(); }
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
  /* швидкий результат прямо з карти — без відкриття картки; «Інше…» відкриває повний екран */
  /* скільки адрес у селі вже відвідано цього місяця; тап — приглушити відвідані на карті */
  /* «пройдене за період»: точки, де за вибраний період був будь-хто з контролерів — будь-яка відмітка
     (показник, записка, нема доступу), нова точка, редагування, прив'язка. Решта точок на карті тьмяніша */
  var TRAIL_OPTS = [['0', 'Вимкнено', 'усі точки однаково яскраві'], ['1', 'Сьогодні', ''], ['3', '3 дні', ''], ['7', 'Тиждень', ''], ['14', '2 тижні', ''], ['m', 'Цей місяць', 'з 1 числа']];
  function trailMode() { var t = S.meta.trail; return t === false ? '0' : t == null || t === true ? '1' : String(t); }
  function trailOn() { return trailMode() !== '0'; }
  function trailFrom() {
    var t = trailMode(), d = new Date(); d.setHours(0, 0, 0, 0);
    if (t === 'm') d.setDate(1); else d.setDate(d.getDate() - (Number(t) - 1));
    return d.getTime();
  }
  function todayTouched() {
    var from = trailFrom(), m = {}, n = 0;
    S.visits.forEach(function (v) { if (v.ts >= from && !m[v.pointId]) { m[v.pointId] = 1; n++; } });
    S.points.forEach(function (p) { if (m[p.id]) return; var cr = p.created ? new Date(p.created + 'T12:00:00').getTime() : 0; if ((p.updated && p.updated >= from) || cr >= from) { m[p.id] = 1; n++; } });
    m.__n = n; return m;
  }
  function trailChip() {
    var on = trailOn(), n = 0; if (on) { var tt = todayTouched(); villagePoints().forEach(function (p) { if (tt[p.id]) n++; }); }
    var lab = { '1': 'сьогодні', '3': '3 дні', '7': 'тиждень', '14': '2 тижні', 'm': 'місяць' }[trailMode()];
    return '<button class="tb-item' + (on && n ? ' on' : '') + '" data-act="trail" aria-label="Пройдене за період"><span class="row" style="gap:3px">' + icon('nav', 13, 2.6) + '</span><b>' + (on ? n : '—') + '</b>' + (on ? '<span class="small" style="margin-left:3px;opacity:.75">' + lab + '</span>' : '') + '</button>';
  }
  function refreshDone() { document.querySelectorAll('[data-act=hideDone]').forEach(function (el) { el.outerHTML = doneChip(el.textContent.indexOf('зчитано') >= 0); }); }
  function doneChip(full) {
    var cm = cycleMap(), ok = 0, v = 0;
    villagePoints().forEach(function (p) { var x = vstate(p); if (x === 'ok') ok++; else if (x === 'v') v++; });
    return '<button class="tb-item' + (S.meta.hideDone ? ' on' : '') + '" data-act="hideDone" aria-label="Приглушити відвідані"><span class="vsq ok">' + icon('check', 11, 4) + '</span><b>' + ok + '</b>' + (full ? '<span class="small mute" style="margin-left:2px">зчитано за ' + NORM() + ' дн.</span>' : '') +
      '<span class="vsq" style="margin-left:8px"></span><b>' + v + '</b>' + (full ? '<span class="small mute" style="margin-left:2px">без показника цього міс.</span>' : '') + '</button>';
  }
  /* № лічильника і ПІБ (з даних обленерго; після синхронізації заповнюються самі) */
  function shortName(fio) { var w = String(fio || '').trim().split(/\s+/); if (!w[0]) return ''; return w[0] + (w[1] ? ' ' + w[1].charAt(0) + '.' : '') + (w[2] ? ' ' + w[2].charAt(0) + '.' : ''); }
  function sheetIds(p) {
    var f = p.fields || {};
    return '<div class="ids"><span class="ids-n">№ ' + (f.serial ? '<b>' + esc(f.serial) + '</b>' : '<span class="mute">—</span>') + '</span><span class="ids-f">' + (f.fio ? esc(shortName(f.fio)) : '<span class="mute">ПІБ —</span>') + '</span></div>';
  }
  function quickHtml(p, idx) {
    var cv = cycleMap()[p.id];
    if (S.quickOk === p.id) return '<div class="row" style="gap:8px"><input id="q-r" class="input" inputmode="numeric" placeholder="Показник (можна пропустити)" style="height:52px;min-width:0">' +
      '<button class="btn" data-act="quickSave" data-id="' + p.id + '" style="width:auto;padding:0 18px;height:52px;flex-shrink:0">' + icon('check', 18, 2.6) + '</button>' +
      '<button class="iconbtn" data-act="quickCancel" aria-label="Скасувати" style="width:52px;height:52px;background:#F1F1F3;box-shadow:none;flex-shrink:0">' + icon('close', 18, 2.4) + '</button></div>';
    var b = function (v, l, dark) { return '<button class="qbtn' + (dark ? ' dark' : '') + '" data-act="quick" data-v="' + v + '" data-id="' + p.id + '">' + l + '</button>'; };
    var lq = S.lastQuick && Date.now() - S.lastQuick.ts < 60000 ? S.lastQuick : null, undo = lq && lq.pid === p.id;
    var lqp = lq && !undo && S.points.get(lq.pid);
    return (cv ? '<div class="vdone' + (cv.result === 'ok' ? ' ok' : '') + '">' + icon('check', 16, 3) + '<span>' + monthName() + ': <b>' + esc(RESNAME[cv.result].toLowerCase()) + '</b> ' + dt(cv.ts) + (cv.reading ? ' · ' + fmt(cv.reading) : '') + (cv.by && cv.by !== me().id ? ' · ' + esc(peerName(cv.by)) : '') + '</span>' +
        (undo ? '<button class="chip" data-act="quickUndo" data-id="' + p.id + '">Скасувати</button>' : '') + '</div>' : '') +
      (lqp ? '<div class="vdone">' + icon('check', 16, 3) + '<span>' + esc(addr(lqp)) + ': <b>' + esc(RESNAME[lq.res].toLowerCase()) + '</b></span><button class="chip" data-act="quickUndo" data-id="' + lqp.id + '">Скасувати</button></div>' : '') +
      '';
  }
  function quickVisit(id, res) {
    var p = S.points.get(id); if (!p) return;
    var wasRoute = routeIndex(id) >= 0;
    var reading = res === 'ok' && $('#q-r') ? $('#q-r').value.replace(/\s/g, '') : '';
    if (reading && !/^\d+(\.\d+)?$/.test(reading)) return toast('Показник: лише цифри');
    if (res === 'empty' && p.status !== 'n') { p.status = 'n'; savePoint(p); }
    var v = newVisit({ pointId: id, result: res, prof: p.status, reading: reading || null, method: reading ? 'зчитано' : null, note: null,
      pos: S.pos && !S.pos.stale ? { lat: S.pos.lat, lon: S.pos.lon, acc: Math.round(S.pos.acc) } : null });
    /* «Повідомлення про візит»: до лічильника не потрапили, залишили записку — усі пломби отримують статус «Немає доступу» */
    if (res === 'note') {
      var L0 = (R && R.id === id && R.L && R.L.length ? R.L : sealList(p)).filter(function (x) { return x.n; });
      v.sealList = L0.map(function (x) { return { n: x.n, place: x.place, st: 'Немає доступу' }; });
      v.seals = 'немає доступу';
    }
    S.quickOk = null;
    put('visits', v).then(function (k) {
      v.id = k; S.visits.push(v); invalidate(); S.lastQuick = { pid: id, key: k, uid: v.uid, ts: Date.now(), res: res }; refreshDone();
      S.route = computeRoute(); var nx = S.route && S.route.ids[0]; S.sel = (S.route && !S.route.off && nx) || id;
      updateMap(); renderSheet();
      var np = nx && S.points.get(nx);
      toast(RESNAME[res] + (reading ? ' · ' + fmt(reading) : '') + (np ? ' → далі: ' + addr(np) : ''));
      if (/^#(read|card)\//.test(location.hash)) { R = {}; S.sel = nx || id; renderMap.fitNext = false; go('#map'); var sp = S.points.get(S.sel); setTimeout(function () { if (map && sp) map.easeTo({ center: [sp.lon, sp.lat], zoom: Math.max(map.getZoom(), 17) }); }, 300); return; }
      if (np && map) map.easeTo({ center: [np.lon, np.lat], zoom: Math.max(map.getZoom(), 16.5) });
    });
  }
  /* фонове оновлення панелі (GPS, синхронізація, пішохідний маршрут): не перемальовуємо, поки людина друкує в полі панелі,
     інакше поле зникає і клавіатура закривається щоразу, як приходить нова GPS-позиція */
  function typingInSheet() { var ae = document.activeElement; return !!(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.closest && ae.closest('#sheet')); }
  function renderSheetSoft() { if (S.adding || typingInSheet()) return; renderSheet(); }
  function renderSheet() {
    renderSheetInner(); sheetSwipe($('#sheet') || document.createElement('div'));
    placeFabs();
  }
  /* кнопки карти (шар, моя позиція) і компас тримаємо над нижньою панеллю */
  /* однакові кнопки карти праворуч унизу: [налаштування маршруту] · шар · моя позиція */
  /* скільки моїх змін ще не на сервері; тап — синхронізувати */
  function pendingSync() {
    if (!gh()) return 0; var t = S.meta.ghLast || 0, me0 = me().id, n = 0;
    S.visits.forEach(function (v) { if (v.by === me0 && v.ts > t) n++; });
    S.points.forEach(function (p) { if (p.by === me0 && (p.updated || 0) > t) n++; });
    return n;
  }
  function syncBadge() {
    if (!gh()) return '';
    var n = pendingSync(), off = !navigator.onLine;
    if (!n && !off) return '';
    return '<button class="iconbtn sync-badge' + (off ? ' off' : '') + '" data-act="ghSync" aria-label="' + (off ? 'Офлайн' : 'Синхронізувати') + '">' + icon('cloud', 18) + (n ? '<span>' + n + '</span>' : '') + '</button>';
  }
  function refreshSyncBadge() { var f = $('#fabs'); if (!f) return; var old = f.querySelector('.sync-badge'); if (old) old.remove(); var h = syncBadge(); if (h) f.insertAdjacentHTML('afterbegin', h); placeFabs(); }
  function searchBar() {
    return '<div class="row" style="width:100%"><label class="pill" for="aq" style="flex-grow:1;box-shadow:0 6px 20px rgba(0,0,0,.06);min-width:0">' + icon('search', 18) + '<input id="aq" autocomplete="off" placeholder="Село, адреса, ПІБ, № лічильника" value="' + esc(AQ) + '" style="border:0;outline:0;background:transparent;width:100%;font-weight:600;min-width:0"></label>' +
      (AQ ? '<button class="iconbtn" data-act="aqClear" aria-label="Очистити пошук">' + icon('close', 18, 2.4) + '</button>' : '') + '</div><div id="aqres" style="width:100%"></div>';
  }
  function bindSearch() {
    var aq = $('#aq'); if (!aq) return;
    aq.oninput = function () { clearTimeout(aq._t); aq._t = setTimeout(function () { AQ = aq.value.trim(); drawAq(); }, 150); };
    drawAq();
    if (S.focusSearch) { S.focusSearch = false; aq.focus(); }
  }
  function mapSeg(cur) {
    return '<div class="mseg" role="tablist"><a href="#map" class="' + (cur === 'map' ? 'on' : '') + '" data-act="mapTab" data-v="map">' + icon('nav', 16) + 'Маршрут</a><a href="#all" class="' + (cur === 'all' ? 'on' : '') + '" data-act="mapTab" data-v="all">' + icon('pin', 16) + 'Усі</a></div>';
  }
  function fabsHtml(route) {
    var lay = S.meta.layer || 'scheme';
    return '<div class="fabs" id="fabs">' + syncBadge() + (route ? '<button class="iconbtn" data-act="routeCfg" aria-label="Налаштування маршруту"' + (routeCfg().auto ? '' : ' style="color:#A1A1AA"') + '>' + icon('gear', 20) + '</button>' : '') +
      '<button class="iconbtn" data-act="layer" data-l="' + (lay === 'sat' ? 'scheme' : 'sat') + '" aria-label="' + (lay === 'sat' ? 'Схема' : 'Супутник') + '"' + (lay === 'sat' ? ' style="background:#111;color:#fff"' : '') + '>' + icon('globe', 20) + '</button>' +
      '<button class="iconbtn" data-act="locate" aria-label="Моя позиція">' + icon('locate') + '</button></div>';
  }
  function placeFabs() {
    var f = $('#fabs'), sh = $('#sheet'); if (!f) return;
    var inner = sh && sh.firstElementChild, top = inner ? inner.getBoundingClientRect().top : window.innerHeight - 120;
    var b = Math.max(110, window.innerHeight - top + 12); f.style.bottom = b + 'px';
    var cp = document.querySelector('.compass'); if (cp) { cp.style.top = 'auto'; cp.style.bottom = (b + f.offsetHeight + 10) + 'px'; }
  }
  function renderSheetInner() {
    var el = $('#sheet'); if (!el) return;
    if (S.adding) return renderAddSheet(el);
    var r = mapMode === 'route' ? S.route : null, p = S.points.get(S.sel);
    if (!p && mapMode === 'all') { el.innerHTML = '<div class="sheet mini"><div class="between" style="gap:10px"><div class="small mute" style="padding:4px">Торкніться точки, щоб відкрити, або порожнього місця, щоб додати нову</div>' +
      '<a class="btn" href="#bind/new" style="width:auto;flex-shrink:0;height:44px;padding:0 14px;font-size:13px">' + icon('pin', 16) + 'За GPS</a></div></div>'; return; }
    if (!p) {
      var nv = r && !r.ids.length && village() !== ALL ? nextPlanVillage(village()) : null;
      if (r && r.off) { el.innerHTML = '<div class="sheet mini"><div class="between" style="gap:10px"><div class="small mute" style="padding:4px">Торкніться точки на карті. Маршрут вимкнено: увімкнути — шестерня праворуч</div></div></div>'; return; }
      el.innerHTML = r && !r.ids.length ? '<div class="sheet"><div class="h2">Усі адреси в цьому селі пройдено</div><div class="small mute">' + (routeCfg().round === '180' ? 'Список ' + NORM() + ' тут порожній.' : 'Планові адреси пройдено. Далі — друге коло по «Списку ' + NORM() + '».') + '</div>' + (routeCfg().round !== '180' && villagePoints().some(in180) ? '<button class="btn out" data-act="round" data-v="180">Почати коло ' + NORM() + ' · ' + villagePoints().filter(in180).length + ' адрес</button>' : '') +
        (nv ? '<button class="btn" data-act="pickVillage" data-v="' + esc(nv) + '" data-stay="1">Наступне село плану: ' + esc(nv) + icon('arrow', 18, 2.4) + '</button>' : '') + '</div>' : ''; return;
    }
    var rkey = village() === ALL ? p.village : village(), idx = routeIndex(p.id), rn = (S.meta.routeNo || {})[rkey] || '';
    var d = S.pos ? fdist(dist(S.pos, p)) : '';
    if (S.meta.sheetMin) {
      el.innerHTML = '<div class="sheet mini"><button class="grip" data-act="toggleSheet" aria-label="Розгорнути панель"></button>' +
        '<div class="row"><button class="row" data-act="toggleSheet" style="flex-grow:1;min-width:0;border:0;background:transparent;padding:0;font-size:16px;font-weight:800;color:#111;text-align:left">' +
        (idx >= 0 ? '<span class="numbadge">' + (idx + 1) + '</span>' : dotHtml(p.status)) +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(addr(p)) + '</span>' + (d ? '<span class="small mute" style="flex-shrink:0">' + d + '</span>' : '') + '</button>' +
        '<button class="iconbtn" data-act="editPoint" data-id="' + p.id + '" aria-label="Редагувати точку" style="width:44px;height:44px;border:1.5px solid #E4E4E7;box-shadow:none;flex-shrink:0">' + icon('edit', 16) + '</button>' +
        '<a class="iconbtn" href="#card/' + p.id + '" aria-label="Відкрити картку" style="background:#111;color:#fff;box-shadow:none;width:44px;height:44px">' + icon('arrow', 18, 2.4) + '</a></div></div>';
      return;
    }
    el.innerHTML = '<div class="sheet"><button class="grip" data-act="toggleSheet" aria-label="Згорнути панель"></button>' +
      '<div class="between" style="align-items:flex-start"><div class="col" style="gap:4px;min-width:0">' +
      '<div class="row small mute" style="flex-wrap:wrap"><label class="chip" style="height:26px;color:#111">Маршрут №<input id="rno" value="' + esc(rn) + '" placeholder="внести" style="width:84px;border:0;outline:0;background:transparent;font-weight:800"></label>' +
      (r ? (r.off ? 'Авто-маршрут вимкнено' : r.ids.length + ' з ' + r.total + ' адрес · ' + fdist(r.meters) + (r.walk ? ' пішки' : '')) : '') + '</div>' +
      '<div class="row" style="font-size:18px;font-weight:800">' + (idx >= 0 ? '<span class="numbadge">' + (idx + 1) + '</span>' : '') + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(addr(p)) + '</span></div>' +
      sheetIds(p) +
      '<div class="small mute">' + (idx === 0 ? 'Наступна' : idx > 0 ? 'У маршруті' : 'Поза маршрутом') + (d ? ' · ' + d : '') + ' · ' + ST[p.status].label.toLowerCase() + '</div>' +
      '</div>' + dotHtml(p.status) + '</div>' +
      quickHtml(p, idx) +
      '<div class="row"><a class="btn" href="#card/' + p.id + '" style="flex-grow:1;height:52px">Відкрити картку ' + icon('arrow', 18, 2.4) + '</a>' +
      '<button class="iconbtn" data-act="editPoint" data-id="' + p.id + '" aria-label="Редагувати точку" style="width:52px;height:52px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('edit', 18) + '</button>' +
      (idx >= 0 ? '<button class="iconbtn" data-act="skip" aria-label="Пропустити адресу" style="width:46px;height:46px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('skip') + '</button>' : '') + '</div></div>';
    var qr = $('#q-r'); if (qr) { qr.focus(); qr.onkeydown = function (e) { if (e.key === 'Enter') quickVisit(p.id, 'ok'); }; }
    var rno = $('#rno');
    if (rno) rno.onchange = function () { var m = Object.assign({}, S.meta.routeNo || {}); m[rkey] = rno.value.trim(); shareSet('routeNo', m); toast('Номер маршруту збережено'); };
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
  /* село для нової точки: більшість серед 7 найближчих точок у радіусі 1,5 км; поруч нікого — вибране зараз село */
  /* село для нової точки: якщо на головній/карті вибрано конкретне село — завжди воно (ти ходиш саме по ньому);
     вгадування за сусідніми точками — лише коли вибрано «Уся дільниця» */
  function guessVillage(pos) {
    var sel = newVillage(); if (sel) return { v: sel, how: 'вибране село' };
    var near = [];
    S.points.forEach(function (q) { if (!q.village) return; var d = dist(pos, q); if (d < 1500) near.push({ v: q.village, d: d }); });
    near.sort(function (a, b) { return a.d - b.d; }); near = near.slice(0, 7);
    if (!near.length) return { v: newVillage(), how: newVillage() ? 'вибране село' : 'поруч немає точок' };
    var c = {}; near.forEach(function (x) { c[x.v] = (c[x.v] || 0) + 1; });
    var v = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
    return { v: v, how: 'за сусідніми точками, найближча ' + Math.round(near[0].d) + ' м' };
  }
  /* номер будинку: цифрова клавіатура + кнопки для літер і дробу (6а, 2/1), клавіатура не ховається */
  function houseKeys(id) { return '<div class="hkeys" data-for="' + id + '">' + ['а', 'б', 'в', 'г', 'д', '/'].map(function (t) { return '<button type="button" class="hk" data-t="' + t + '">' + t + '</button>'; }).join('') + '<button type="button" class="hk hk-abc" data-t="abc">' + ((document.getElementById(id) || {}).getAttribute && document.getElementById(id).getAttribute('inputmode') === 'text' ? 'Цифри' : 'Букви') + '</button></div>'; }
  function villageRow(cur, how, act) {
    return '<button type="button" class="input selbtn" data-act="' + act + '" style="height:56px"><span class="col" style="gap:1px;align-items:flex-start;min-width:0"><span class="small mute" style="font-size:11px">Село' + (how ? ' · ' + esc(how) : '') + '</span>' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + esc(cur || 'Без села') + '</span></span>' + icon('down', 18, 2.4) + '</button>';
  }
  /* нове село: назва з великої літери, без зайвих пробілів; якщо таке вже є (без урахування регістру) — беремо наявне */
  function addVillage(cb) {
    var n = (prompt('Назва нового населеного пункту') || '').trim().replace(/\s+/g, ' ');
    if (!n) return;
    n = n.charAt(0).toUpperCase() + n.slice(1);
    var key = function (t) { return t.toLowerCase().replace(/[^а-яіїєґa-z' ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' '); };
    var same = villages().filter(function (x) { return key(x.name) === key(n); })[0];
    if (same) { toast('Таке село вже є: ' + same.name); return cb(same.name); }
    var ex = (S.meta.extraVillages || []).concat([n]);
    setMeta('extraVillages', ex).then(function () { toast('Додано село: ' + n); cb(n); });
  }
  var NEW_V = { v: '__newv', l: '+ Додати нове село', sub: 'якого ще немає в списку', hot: true };
  function pickVillageFor(cur, cb) {
    var vs = villages().filter(function (x) { return x.name !== 'Без села'; });
    var hv = village() && village() !== ALL ? village() : null, list = vs.map(function (x) { return { v: x.name, l: x.name, sub: x.n + ' точок' }; });
    var pinned = hv ? list.filter(function (o) { return o.v === hv; }).map(function (o) { return Object.assign({}, o, { head: 'Обране на головній', hot: true }); }) : [];
    var rest = letterHeads(list.filter(function (o) { return o.v !== hv; }));
    openSheet('У яке село', pinned.concat(rest, [{ v: '', l: 'Без села', sub: 'уточнити пізніше' }]), cur || '', function (v) { if (v === '__newv') addVillage(cb); else cb(v); }, { btn: { v: '__newv', l: 'Нове' }, pin: pinned.length, search: 'Пошук села' });
  }
  /* «вулиця, якою йду»: після збереження точки її вулиця підставляється в наступні нові точки цього села,
     поки не скинеш або не почнеш іншу вулицю; щодня обнуляється */
  function stickyStreet(v) { var x = S.meta.stickyStreet; return x && x.day === today() && x.street && (x.village || null) === (v || null) ? x.street : ''; }
  function startAdd(ll, pt) {
    var street = '', house = '';
    try {
      var box = [[pt.x - 70, pt.y - 70], [pt.x + 70, pt.y + 70]];
      var hn = map.getLayer('housenumber') ? map.queryRenderedFeatures(box, { layers: ['housenumber'] }) : [];
      var nh = nearestFeature(hn, pt); if (nh) house = nh.properties.housenumber || '';
      var sn = map.getLayer('street-name') ? map.queryRenderedFeatures([[pt.x - 160, pt.y - 160], [pt.x + 160, pt.y + 160]], { layers: ['street-name'] }) : [];
      var ns = nearestFeature(sn, pt); if (ns) street = cleanStreet(ns.properties.name);
    } catch (x) { /* карта без даних — поля порожні */ }
    var gv = guessVillage({ lat: ll.lat, lon: ll.lng });
    var ss = stickyStreet(gv.v);
    S.adding = { lat: ll.lat, lon: ll.lng, street: ss || street, house: house, st: 'y', auto: !!(street || house) && !ss, sticky: !!ss, village: gv.v, how: gv.how, vSet: false };
    if (!addMarker) {
      var el = document.createElement('div'); el.className = 'addpin';
      el.innerHTML = '<svg width="34" height="44" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 50s-17-15-17-29A17 17 0 0137 21c0 14-17 29-17 29z" fill="#111" stroke="#fff" stroke-width="3"/><circle cx="20" cy="21" r="7" fill="#fff"/></svg>';
      addMarker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true }).setLngLat(ll).addTo(map);
      addMarker.on('dragend', function () { var c = addMarker.getLngLat(); if (S.adding) { S.adding.lat = c.lat; S.adding.lon = c.lng; if (!S.adding.vSet) { var g = guessVillage({ lat: c.lat, lon: c.lng }); S.adding.village = g.v; S.adding.how = g.how; renderSheet(); } } });
    } else addMarker.setLngLat(ll);
    if (S.meta.sheetMin) setMeta('sheetMin', false);
    renderSheet();
  }
  function cancelAdd(quiet) { S.adding = null; if (addMarker) { addMarker.remove(); addMarker = null; } if (!quiet) renderSheet(); }
  function renderAddSheet(el) {
    var a = S.adding;
    el.innerHTML = '<div class="sheet add-sheet"><div class="between"><div class="h2">Нова точка тут</div><button class="iconbtn" data-act="addCancel" aria-label="Скасувати" style="box-shadow:none;background:#F1F1F3;width:40px;height:40px">' + icon('close', 18, 2.4) + '</button></div>' +
      '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><input id="ad-s" class="input" placeholder="Вулиця" value="' + esc(a.street) + '"><input id="ad-h" class="input" inputmode="numeric" data-house="1" autocomplete="off" placeholder="Будинок" value="' + esc(a.house) + '"></div>' +
      (a.sticky && stickyStreet(a.village) ? '<div class="sticky-row add-extra">' + icon('pin', 14) + '<span>Вулиця тримається до кінця дня</span><button class="chip" data-act="stickyOff">Інша вулиця</button></div>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">' + ST_ORDER.map(function (s) {
        return '<button class="opt' + (a.st === s ? ' on' : '') + '" data-act="addSt" data-v="' + s + '" style="min-height:44px;align-items:center;padding:6px 4px">' + dotHtml(s) + '<small style="opacity:1;font-weight:700">' + ST[s].short + '</small></button>';
      }).join('') + '</div>' +
      villageRow(a.village, a.vSet ? 'вибрано вручну' : a.how, 'addVillage').replace('class="input selbtn"', 'class="input selbtn add-extra"') +
      '<div class="small mute add-extra">' + (a.auto ? 'Адресу підставлено з карти, перевірте. ' : '') + 'Мітку можна перетягнути.</div>' +
      '<button class="btn" data-act="addSave">' + icon('pin') + 'Зберегти точку</button></div>';
    $('#ad-s').oninput = function () { a.street = this.value; };
    $('#ad-h').oninput = function () { a.house = this.value; };
    /* «→ / Готово» на клавіатурі зберігає точку: не треба ховати клавіатуру і шукати кнопку */
    ['#ad-s', '#ad-h'].forEach(function (sel) { var i = $(sel); if (i) { i.setAttribute('enterkeyhint', sel === '#ad-h' ? 'done' : 'next'); i.onkeydown = function (e) { if (e.key !== 'Enter') return; e.preventDefault(); if (sel === '#ad-s') { var h = $('#ad-h'); if (h) h.focus(); return; } this.blur(); saveAdd(); }; } });
  }
  function saveAdd() {
    var a = S.adding; if (!a) return;
    var s = a.street.trim(), h = a.house.trim(), near = null, bd = Infinity;
    S.points.forEach(function (q) { var d = dist(a, q); if (d < bd && q.village) { bd = d; near = q; } });
    var p = { id: newPid(), lat: +a.lat.toFixed(6), lon: +a.lon.toFixed(6), village: a.village || null,
      street: s, house: h, status: a.st, tags: a.jur ? ['jur'] : [], note: '', src: 'вручну (карта)', created: today(), createdBy: me().id,
      flags: [].concat(s ? [] : ['no_street'], h ? [] : ['no_house']) };
    if (!dupGuard(p)) { cancelAdd(true); return; }
    S.points.set(p.id, p); S.route = null; cancelAdd(true); S.sel = p.id;
    if (s) setMeta('stickyStreet', { street: s, village: p.village || null, day: today() });
    savePoint(p).then(function () { toast('Точку додано: ' + addr(p) + ' · ' + (p.village || 'без села')); updateMap(); renderSheet(); });
  }

  /* ---------- Усі мітки з фільтрами ---------- */
  function CY() { return [['ok', 'Зчитано вчасно'], ['miss', 'Список ' + NORM()], ['todo', 'Немає даних']]; }
  function cycleState(p) { return readThisCycle(p) ? 'ok' : in180(p) ? 'miss' : 'todo'; }
  function allF() { return S.meta.allF || { st: [], cy: [] }; }
  var vbCache = {};
  function visitedBy(who) { var key = who + ':' + S.visits.length; if (vbCache.k === key) return vbCache.m; var m = {}; S.visits.forEach(function (v) { if ((v.by || me().id) === who) m[v.pointId] = 1; }); vbCache = { k: key, m: m }; return m; }
  function authors() { var a = {}; a[me().id] = 1; S.visits.forEach(function (v) { if (v.by) a[v.by] = 1; }); S.points.forEach(function (p) { if (p.createdBy) a[p.createdBy] = 1; }); return Object.keys(a); }
  /* skip: група фільтра, яку не враховуємо (для лічильників на чипах цієї ж групи) */
  function allPass(p, F, skip) {
    if (skip !== 'st' && F.st.length && !F.st.some(function (f) { return stMatch(p, f); })) return false;
    if (skip !== 'cy' && F.cy.length && F.cy.indexOf(cycleState(p)) < 0) return false;
    var who = F.who || (F.mine ? me().id : null);
    if (skip !== 'who' && who && p.createdBy !== who && !visitedBy(who)[p.id]) return false;
    return true;
  }
  function allFiltered() {
    var F = allF(), out = [];
    S.points.forEach(function (p) { if (allPass(p, F)) out.push(p); });
    return out;
  }
  function allActive(F) { return F.st.length + F.cy.length + (F.mine || F.who ? 1 : 0); }
  function allOpen() { return mapMode === 'all' && S.meta.allMin === false; }
  /* фільтри і картка точки не відкриті одночасно */
  function selPoint(id) {
    S.sel = id;
    if (allOpen()) { setMeta('allMin', true); renderAll.fitNext = false; render(); return; }
    updateMap(); renderSheet();
  }
  /* пошук прямо на карті «Мітки»: адреса, ПІБ, серійний, номер прилада, телефон; найближчі — першими */
  var AQ = '';
  function searchPoints(q, max) {
    q = q.toLowerCase(); var res = [];
    S.points.forEach(function (p) {
      var f = p.fields || {};
      var hay = [p.village, p.street, p.house, p.orig, p.note, f.fio, f.serial, f.devicePlace, f.phone, f.account].join(' ').toLowerCase();
      if (q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) res.push(p);
    });
    var ref = S.pos || centroid(villagePoints().length ? villagePoints() : res.length ? res : [{ lat: 50.4, lon: 26.2 }]);
    /* точний збіг номера будинку — першим: «Шосова 4» ставить буд. 4 вище за 40 і 48 */
    var words = q.split(/\s+/), exact = function (p) { return words.indexOf(String(p.house || '').toLowerCase()) >= 0 ? 0 : 1; };
    res.sort(function (a, b) { return exact(a) - exact(b) || dist(ref, a) - dist(ref, b); });
    return { list: res.slice(0, max || 8), total: res.length, ref: ref };
  }
  function drawAq() {
    var box = $('#aqres'); if (!box) return;
    var sh = $('#sheet'); if (sh) sh.style.display = AQ ? 'none' : '';
    var ap = $('#apanel'); if (ap) ap.style.display = AQ ? 'none' : 'flex';
    if (!AQ) { box.innerHTML = ''; return; }
    var r = searchPoints(AQ, 8), ql = AQ.toLowerCase();
    var vs = villages().filter(function (v) { return v.name !== 'Без села' && v.name.toLowerCase().split(/[\s-]+/).concat([v.name.toLowerCase()]).some(function (w) { return w.indexOf(ql) === 0; }); }).slice(0, 4);
    var vh = vs.map(function (v) { return '<button class="list-row" data-act="aqVillage" data-v="' + esc(v.name) + '" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left">' + icon('village', 18) + '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(v.name) + '</b><span class="small mute">село · ' + v.n + ' точок · відкрити маршрут</span></div>' + icon('right', 16, 2.4) + '</button>'; }).join('');
    box.innerHTML = '<div class="card" style="padding:6px 14px;gap:0;box-shadow:0 6px 20px rgba(0,0,0,.08);max-height:46vh;overflow-y:auto">' + vh +
      (r.list.length || vs.length ? r.list.map(function (p) {
        return '<button class="list-row" data-act="aqPick" data-id="' + p.id + '" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left">' + dotHtml(p.status) + '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(addr(p)) + '</b><span class="small mute">' + esc(p.village || 'Без села') + ((p.fields || {}).fio ? ' · ' + esc(p.fields.fio) : '') + '</span></div><span class="small">' + fdist(dist(r.ref, p)) + '</span></button>';
      }).join('') + (r.total > 8 ? '<div class="small mute" style="padding:8px 0">Ще ' + (r.total - 8) + ' — уточніть запит</div>' : '')
        : '<div class="small mute" style="padding:12px 0">Нічого не знайдено. Торкніться карти там, де лічильник, щоб додати точку.</div>') + '</div>';
  }
  function renderAll() {
    mapMode = 'all';
    var F = allF(), shown = allFiltered(), cs = { g: 0, y: 0, r: 0, n: 0, jur: 0 }, cc = { ok: 0, miss: 0, todo: 0 };
    S.points.forEach(function (p) {
      if (allPass(p, F, 'st')) { cs[p.status]++; if (isJur(p)) cs.jur++; }
      if (allPass(p, F, 'cy')) cc[cycleState(p)]++;
    });
    var chip = function (grp, v, label, n, dot) {
      var on = F[grp].indexOf(v) >= 0;
      return '<button class="chip fchip' + (on ? ' on' : '') + '" data-act="allF" data-g="' + grp + '" data-v="' + v + '">' + (dot ? dotHtml(v) : '') + label + ' <span style="opacity:.6">' + fmt(n) + '</span></button>';
    };
    var open = S.meta.allMin === false;
    var panel = '<div class="between" style="gap:8px"><button class="pill tilebar mrow-l" data-act="toggleAll">' + icon('grid', 16) + 'Фільтри' + (allActive(F) ? ' (' + allActive(F) + ')' : '') + '<span class="mute" style="font-weight:600;margin-left:4px">· ' + fmt(shown.length) + '</span><span style="display:flex' + (open ? ';transform:rotate(180deg)' : '') + '">' + icon('down', 16, 2.6) + '</span></button>' + mapSeg('all') + '</div>' + (!open ? ''
      : '<div class="card" style="padding:12px;gap:10px;box-shadow:0 6px 20px rgba(0,0,0,.06)">' +
        '<div class="small mute">Доступ</div><div class="tags">' + ST_ORDER.map(function (s) { return chip('st', s, ST[s].short, cs[s], true); }).join('') + chip('st', 'jur', 'Юридичні', cs.jur, true) + '</div>' +
        '<div class="small mute">Норма ' + NORM() + ' днів</div><div class="tags">' + CY().map(function (c) { return chip('cy', c[0], c[1], cc[c[0]]); }).join('') + '</div>' +
        '<div class="small mute">Контролер: внесені або відвідані ним точки</div><div class="tags"><button class="chip fchip' + (!F.who && !F.mine ? ' on' : '') + '" data-act="allWho" data-v="">Усі</button>' + authors().map(function (id) {
          var on = (F.who || (F.mine ? me().id : '')) === id;
          return '<button class="chip fchip' + (on ? ' on' : '') + '" data-act="allWho" data-v="' + esc(id) + '">' + icon('user', 14, 2.4) + esc(whoName(id)) + '</button>'; }).join('') + '</div>' +
        '<div class="between"><span class="small">Показано ' + fmt(shown.length) + ' з ' + fmt(S.points.size) + '</span><span class="row">' +
        (allActive(F) ? '<button class="chip" data-act="allReset">Скинути</button>' : '') +
        '</span></div></div>');
    var lay = S.meta.layer || 'scheme';
    setMeta('mapTab', 'all');
    app.innerHTML = '<div class="mapui" style="top:18px;display:flex;flex-direction:column;gap:10px">' +
      searchBar() + '<div id="apanel" style="display:flex;flex-direction:column;gap:10px' + (AQ ? ';display:none' : '') + '">' + panel +
      '</div></div>' + fabsHtml(false) + '<div id="sheet"></div>' + tabs('all');
    if (S.sel && shown.indexOf(S.points.get(S.sel)) < 0) S.sel = null;
    if (open) S.sel = null;
    document.body.classList.toggle('fopen', open);
    renderSheet();
    var fit = function () { updateMap(); if (renderAll.fitNext !== false) fitTo(shown.length ? shown : Array.from(S.points.values())); renderAll.fitNext = true; };
    if (mapReady) fit(); else S.pendingFit = fit;
    startGps(); onGps(function () { updateMe(); });
    bindSearch();
  }

  /* ---------- Картка ---------- */
  function lastReading(pid) { var v = visitsOf(pid).filter(function (x) { return x.reading != null && x.reading !== ''; }); return v; }
  function renderCard(id) {
    var p = S.points.get(id); if (!p) return go('#home');
    var idx = routeIndex(p.id), cv = cycleMap()[p.id], rd = lastReading(p.id), f = p.fields || {};
    var last = rd[0], prev = rd[1];
    var prevIdx = (p.fields || {}).prevIndex;
    if (!last && prevIdx) last = { reading: prevIdx, ts: null, fromList: true };
    var delta = last && prev ? Number(last.reading) - Number(prev.reading) : null;
    var flags = (p.flags || []).filter(function (x) { return FLAGNAME[x]; });
    var phone = (f.phone || '').replace(/[^\d+]/g, '');
    var navUrl = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + p.lat + ',' + p.lon;
    /* після записки картка відкривається одразу на «Показниках»: чекаємо показник по телефону */
    if (S.cardId !== id) { S.cardTab = cv && cv.result === 'note' ? 'read' : 'find'; S.cardId = id; }
    var tab = S.cardTab || 'find';
    app.innerHTML = '<div class="screen" style="padding-bottom:40px">' +
      '<div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="small mute" style="font-size:13px">' + esc(p.village || 'Без села') + (idx >= 0 ? ' · №' + (idx + 1) + ' у маршруті' : '') + '</div></div>' +
      '<div class="card big" style="gap:14px">' +
        '<h1 class="h1" style="font-size:26px">' + esc(addr(p)) + '</h1>' +
        (p.orig && p.orig.replace(/\s/g, '').toLowerCase() !== addr(p).replace(/\s/g, '').toLowerCase() ? '<div class="small mute" style="margin-top:-8px">У MAPS.ME: ' + esc(p.orig) + '</div>' : '') +
        '<div class="tags">' + (isJur(p) ? '<span class="chip" style="background:#7C3AED;color:#fff">Юридичний</span>' : '') + (isRuin(p) ? '<span class="chip" style="background:#DC2626;color:#fff">Аварійний будинок</span>' : '') + (isOff(p) ? '<span class="chip" style="background:#111;color:#fff">Лічильник відключено</span>' : '') + '<span class="chip">' + dotHtml(p.status) + ST[p.status].label + '</span>' + (in180(p) ? '<span class="chip" style="background:#FEF3C7;color:#92400E">Список ' + NORM() + ' · ' + daysLabel(p) + '</span>' : okMap()[p.id] ? '<span class="chip mute">Зчитано ' + daysLabel(p) + '</span>' : '') + '<span class="chip mute">' + monthName() + ': ' + (cv ? RESNAME[cv.result].toLowerCase() + ' ' + dt(cv.ts) + (cv.by && cv.by !== me().id ? ' · ' + esc(peerName(cv.by)) : '') : 'не відвідано') + '</span>' +
          (splitIdx(p) != null ? '<span class="chip mute"><span class="dot" style="background:' + SEC_COL[splitIdx(p) % SEC_COL.length] + '"></span>' + esc(sectorName(splitIdx(p), splitOf(p.village))) + '</span>' : '') + '</div>' +
        (cv && cv.result === 'note' ? '<div class="small" style="background:#F6F6F7;border-radius:14px;padding:10px 12px;font-weight:700;line-height:1.4">Записку залишено ' + dt(cv.ts) + '. Коли передадуть показник, внесіть його у вкладці «Показники»: він зарахується як «по телефону».</div>' : '') +
        (flags.length ? '<div class="tags">' + flags.map(function (x) { return '<span class="chip" style="background:#FEF3C7;color:#92400E">' + FLAGNAME[x] + '</span>'; }).join('') + '</div>' : '') +
        '<a class="btn" href="#visit/' + p.id + '">' + icon('check', 20, 2.6) + 'Відмітити результат</a>' +
        '<div class="row" style="gap:8px"><button class="btn sec" data-act="showOnMap" data-id="' + p.id + '" style="flex:1">' + icon('map', 18) + 'На карті</button>' +
        '<a class="iconbtn" href="' + navUrl + '" target="_blank" rel="noopener" aria-label="Навігація в Google Maps" style="width:48px;height:48px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('nav', 18) + '</a>' +
        (phone ? '<a class="iconbtn" href="tel:' + esc(phone) + '" aria-label="Подзвонити" style="width:48px;height:48px;background:#111;color:#fff;box-shadow:none">' + icon('phone', 18) + '</a>' : '') + '</div>' +
      '</div>' +
      dupBox(p) +
      '<div class="seg segw ctabs" style="background:#fff;box-shadow:none;height:48px">' + [['find', 'Як знайти'], ['read', 'Показники'], ['data', 'Дані абонента']].map(function (t) { return '<button data-act="ctab" data-v="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '" style="height:40px">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="cpane col" data-pane="find" style="gap:20px' + (tab === 'find' ? '' : ';display:none') + '">' +
      '<div class="card"><div class="h2" style="font-size:15px">Як знайти</div>' +
        ((p.tags || []).length ? '<div class="tags">' + p.tags.map(function (t) { return '<span class="chip on">' + esc(TAGNAME[t] || t) + '</span>'; }).join('') + '</div>' : '') +
        '<div id="photos" class="photos"></div>' +
        '<div class="grid2" style="gap:8px"><label class="btn sec" for="ph-m" style="height:46px">' + icon('camera', 18) + 'Лічильник</label><label class="btn sec" for="ph-h" style="height:46px">' + icon('camera', 18) + 'Будинок, хвіртка</label></div>' +
        '<input id="ph-m" type="file" accept="image/*" capture="environment" hidden data-kind="Лічильник"><input id="ph-h" type="file" accept="image/*" capture="environment" hidden data-kind="Будинок">' +
        '<textarea id="note" class="input" placeholder="Орієнтир: колір хвіртки, де лічильник, коли вдома">' + esc(p.note || '') + '</textarea></div>' +
      '<div class="card"><div class="between"><div class="h2">Адреса на карті</div><span class="small mute">вніс: ' + esc(authorOf(p)) + (p.created ? ' · ' + esc(p.created.split('-').reverse().join('.')) : '') + '</span></div>' +
        '<div class="field"><label for="a-v">Село</label><input id="a-v" class="input" list="vlist" value="' + esc(p.village || '') + '"><datalist id="vlist">' + villages().map(function (v) { return '<option value="' + esc(v.name) + '">'; }).join('') + '</datalist></div>' +
        '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><div class="field"><label for="a-s">Вулиця</label><input id="a-s" class="input" value="' + esc(p.street || '') + '"></div><div class="field"><label for="a-h">Будинок</label><input id="a-h" class="input" inputmode="numeric" data-house="1" autocomplete="off" value="' + esc(p.house || '') + '"></div></div>' +
        '<a class="btn sec" href="#bind/' + p.id + '" style="justify-content:space-between;padding:0 14px"><span class="row" style="gap:8px">' + icon('pin', 18) + 'Уточнити розташування</span><span class="small mute">' + (p.acc ? '±' + Math.round(p.acc) + ' м · ' : '') + esc(p.src || '') + '</span></a>' +
      '</div>' +
      '<button class="btn" data-act="saveCard" data-id="' + p.id + '">Зберегти</button>' +
      '</div>' +
      '<div class="cpane col" data-pane="read" style="gap:20px' + (tab === 'read' ? '' : ';display:none') + '">' +
      '<div class="card"><div class="h2">Показники</div>' +
        '<div class="grid2" style="gap:8px"><div class="card dark" style="padding:12px 14px;gap:2px;border-radius:18px"><span class="small mute">Останній</span><span style="font-size:24px;font-weight:800">' + (last ? fmt(last.reading) : '—') + '</span><span class="small mute">' + (last ? (last.fromList ? 'з маршрутного листа' : dt(last.ts) + ' · ' + tm(last.ts)) : 'ще немає') + '</span></div>' +
        '<div class="card" style="background:#F6F6F7;padding:12px 14px;gap:2px;border-radius:18px"><span class="small mute">З попереднього</span><span style="font-size:24px;font-weight:800">' + (delta != null ? (delta >= 0 ? '+' : '') + fmt(delta) : '—') + '</span><span class="small mute">кВт·год</span></div></div>' +
        '<a class="btn" href="#read/' + p.id + '">' + icon('check', 20, 2.6) + 'Зняти показник на місці</a>' +
        '<div class="field" style="margin-top:6px"><label for="rdg">Передали по телефону</label><input id="rdg" class="input" inputmode="decimal" placeholder="Показник зі слів"></div>' +
        '<button class="btn out" data-act="saveReading" data-id="' + p.id + '">Зберегти як «по телефону»</button>' +
        (rd.length ? '<button class="btn sec" data-act="toggleHist" style="justify-content:space-between;padding:0 14px;border:0;background:#F6F6F7">Історія показників · ' + rd.length + icon('down', 18, 2.4) + '</button>' +
          '<div id="hist" style="display:none">' + rd.map(function (v, i) {
            var nx = rd[i + 1], dd = nx ? Number(v.reading) - Number(nx.reading) : null;
            return '<div class="list-row" style="justify-content:space-between"><div class="col"><b>' + dt(v.ts) + '</b><span class="small mute">' + tm(v.ts) + (v.method ? ' · ' + esc(v.method) : '') + '</span></div><div class="col" style="align-items:flex-end"><b style="font-size:16px">' + fmt(v.reading) + '</b><span class="small mute">' + (dd != null ? (dd >= 0 ? '+' : '') + fmt(dd) : '—') + '</span></div></div>';
          }).join('') + '</div>' : '') +
      '</div>' +
      visitsCard(p) +
      '</div>' +
      '<div class="cpane col" data-pane="data" style="gap:20px' + (tab === 'data' ? '' : ';display:none') + '">' +
      '<div class="card"><div class="col" style="gap:2px"><div class="h2">Дані абонента</div><div class="small mute">Усі поля офіційного застосунку, в тому ж порядку</div></div>' +
        OFFICIAL.map(function (o, i) {
          var val = f[o[0]] || '', inp;
          if (o[2] === 'info') inp = '<div style="font-weight:700">' + (last ? fmt(last.reading) + (last.fromList ? ' · з маршрутного листа' : ' · ' + dt(last.ts)) : 'Вкладка «Показники»') + '</div>';
          else if (o[2] === 'select') inp = pickBtn(o[0], val, 'Вибрати');
          else if (o[2] === 'textarea') inp = '<div id="seals" class="seals"></div>';
          else if (o[2] === 'tel') inp = '<div class="row" style="gap:8px"><input class="input" data-f="phone" id="f-phone" type="tel" inputmode="tel" value="' + esc(val) + '" placeholder="Номер телефону">' +
            '<button type="button" class="iconbtn" data-act="callPhone" aria-label="Подзвонити" style="width:52px;height:52px;border-radius:16px;background:#111;color:#fff;box-shadow:none">' + icon('phone', 20) + '</button></div>';
          else inp = '<input class="input" data-f="' + o[0] + '" type="text" value="' + esc(val) + '">';
          return '<div class="field"><label><span style="color:#A1A1AA;margin-right:6px">' + (i + 1) + '</span>' + esc(o[1]) + '</label>' + inp + '</div>';
        }).join('') +
        '<button class="btn" data-act="saveCard" data-id="' + p.id + '">Зберегти</button>' +
      '</div>' +
      '<button class="btn sec" data-act="deletePoint" data-id="' + p.id + '" style="color:#B91C1C">Видалити точку (дубль)</button>' +
      '</div></div>';
    loadPhotos(p.id); bindPhotoInputs(p.id); renderSeals(p.id);
  }
  /* усі відмітки по точці: хто, коли, що */
  function visitsCard(p) {
    var L = visitsOf(p.id);
    return '<div class="card" style="gap:4px"><div class="h2" style="font-size:15px">Відмітки · ' + L.length + '</div>' +
      (L.length ? L.slice(0, 30).map(function (v) {
        return '<div class="list-row" style="justify-content:space-between"><div class="col" style="min-width:0"><b>' + esc(RESNAME[v.result] || v.result) + (v.reading ? ' · ' + fmt(v.reading) : '') + '</b><span class="small mute">' + dt(v.ts) + ' ' + tm(v.ts) + ' · ' + esc(whoName(v.by || me().id)) + (v.method && v.method !== 'зчитано' ? ' · ' + esc(v.method) : '') + '</span></div></div>';
      }).join('') : '<div class="small mute" style="padding:6px 0">Ще не відмічали</div>') + '</div>';
  }
  function dupBox(p) {
    if ((p.flags || []).indexOf('dup') < 0) return '';
    var o = p.dupOf && S.points.get(p.dupOf) ? { p: S.points.get(p.dupOf), d: dist(p, S.points.get(p.dupOf)) } : findDup(p);
    if (!o) return '';
    return '<div class="card" style="background:#FEF3C7;gap:10px"><div class="h2" style="font-size:15px;color:#92400E">Можливий дубль</div>' +
      '<a class="list-row" href="#card/' + o.p.id + '" style="border:0;padding:0">' + dotHtml(o.p.status) + '<div class="col" style="flex-grow:1"><b>' + esc(addr(o.p)) + '</b><span class="small mute">' + Math.round(o.d) + ' м · вніс: ' + esc(authorOf(o.p)) + '</span></div>' + icon('right', 16, 2.4) + '</a>' +
      '<div class="row" style="gap:8px"><button class="btn" data-act="dupMerge" data-id="' + p.id + '" data-o="' + o.p.id + '" style="flex:1;height:46px;font-size:14px">Об\'єднати в цю</button>' +
      '<button class="btn sec" data-act="dupNo" data-id="' + p.id + '" data-o="' + o.p.id + '" style="flex:1;height:46px">Це різні</button></div></div>';
  }
  function loadPhotos(pid, boxSel) {
    var box = $(boxSel || '#photos'); if (!box) return;
    (S.phUrls || []).forEach(function (u) { URL.revokeObjectURL(u); }); S.phUrls = [];
    photosOf(pid).then(function (ph) {
      box.innerHTML = ph.map(function (x) {
        var u = URL.createObjectURL(x.blob); S.phUrls.push(u);
        return '<button class="ph" data-act="viewPhoto" data-pid="' + x.id + '" data-url="' + u + '" data-kind="' + esc(x.kind || '') + '" data-ts="' + x.ts + '"><img src="' + u + '" alt="' + esc(x.kind || 'Фото') + '"><span>' + esc(x.kind || '') + '</span></button>';
      }).join('');
      box.style.display = ph.length ? '' : 'none';
    });
  }
  function bindPhotoInputs(pid, sels, boxSel) {
    (sels || ['#ph-m', '#ph-h']).forEach(function (sel) {
      var inp = $(sel); if (!inp) return;
      inp.onchange = function () {
        var file = inp.files[0]; if (!file) return;
        toast('Зберігаю фото…');
        compress(file).then(function (b) { return put('photos', { pointId: pid, ts: Date.now(), kind: inp.getAttribute('data-kind'), blob: b }); })
          .then(function () { inp.value = ''; toast('Фото збережено'); loadPhotos(pid, boxSel); if (boxSel && $('#photos')) loadPhotos(pid); })
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
  /* ---------- статуси пломб: список пломб, у кожної місце і статус ---------- */
  var SEAL_PLACES = ['ЛІЧИЛЬНИК', 'КОРПУС ЛІЧИЛЬНИКА', 'КЛЕМНА КРИШКА', 'ВВІДНИЙ АВТОМАТ', 'ШАФА ОБЛІКУ', 'ТРАНСФОРМАТОР СТРУМУ', 'ІНШЕ'];
  var SEAL_ST = ['Наявна', 'Відсутня', 'Пошкоджена', 'В шафі обліку', 'Немає доступу'];
  function sealList(p) {
    var f = p.fields || {};
    if (f.sealList) return f.sealList;
    /* перенесення старого текстового формату «НОМЕР: місце» */
    return String(f.sealStatuses || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = l.split(':'); return { n: m[0].trim(), place: (m[1] || 'ЛІЧИЛЬНИК').trim().toUpperCase(), st: '' };
    });
  }
  function saveSeals(pid, list) {
    var p = S.points.get(pid); p.fields = Object.assign({}, p.fields || {}, { sealList: list });
    return savePoint(p);
  }
  function renderSeals(pid) {
    var box = $('#seals'); if (!box) return;
    var p = S.points.get(pid), L = sealList(p);
    var done = L.filter(function (x) { return x.st; }).length;
    box.innerHTML = (L.length ? '<div class="small mute" style="padding:0 2px">Відмічено ' + done + ' з ' + L.length + '</div>' : '') +
      L.map(function (x, i) {
        var bad = x.st === 'Відсутня' || x.st === 'Пошкоджена';
        return '<div class="seal' + (bad ? ' bad' : '') + '"><div class="col" style="min-width:0;flex-grow:1"><b style="font-size:15px">' + esc(x.n) + '</b><span class="small mute">' + esc(x.place) + '</span></div>' +
          '<button class="seal-st' + (x.st ? ' on' : '') + '" data-act="sealSt" data-i="' + i + '" data-id="' + pid + '">' + esc(x.st || 'Статус') + icon('down', 14, 2.6) + '</button>' +
          '<button class="seal-x" data-act="sealDel" data-i="' + i + '" data-id="' + pid + '" aria-label="Видалити пломбу">' + icon('close', 14, 2.4) + '</button></div>';
      }).join('') +
      '<div class="seal add"><input id="seal-n" class="input" placeholder="Номер пломби" style="height:44px;font-size:15px;flex-grow:1;min-width:0">' +
      '<button class="seal-st" data-act="sealPlace" id="seal-p" data-v="ЛІЧИЛЬНИК">ЛІЧИЛЬНИК' + icon('down', 14, 2.6) + '</button>' +
      '<button class="seal-x" data-act="sealAdd" data-id="' + pid + '" aria-label="Додати пломбу" style="background:#111;color:#fff">' + icon('plus', 16, 2.6) + '</button></div>';
  }
  function sealAction(a, el) {
    var pid = el.getAttribute('data-id'), i = +el.getAttribute('data-i');
    if (a === 'sealPlace') return openSheet('Місце пломби', SEAL_PLACES, el.getAttribute('data-v'), function (v) { el.setAttribute('data-v', v); el.firstChild.textContent = v; });
    var L = sealList(S.points.get(pid)).map(function (x) { return Object.assign({}, x); });
    if (a === 'sealSt') return openSheet('Пломба ' + L[i].n, SEAL_ST, L[i].st, function (v) { L[i].st = v; saveSeals(pid, L).then(function () { renderSeals(pid); }); });
    if (a === 'sealDel') { if (!confirm('Видалити пломбу ' + L[i].n + '?')) return; L.splice(i, 1); return saveSeals(pid, L).then(function () { renderSeals(pid); }); }
    if (a === 'sealAdd') {
      var n = ($('#seal-n').value || '').trim().toUpperCase(); if (!n) { toast('Введіть номер пломби'); return $('#seal-n').focus(); }
      L.push({ n: n, place: $('#seal-p').getAttribute('data-v'), st: '' });
      return saveSeals(pid, L).then(function () { renderSeals(pid); toast('Пломбу додано'); });
    }
  }
  function saveCard(id) {
    var p = S.points.get(id); if (!p) return;
    /* показник, вписаний у поле, але не збережений окремою кнопкою — зберігаємо разом з карткою, щоб не загубився */
    var pend = ($('#rdg') && $('#rdg').value || '').replace(/\s/g, '');
    if (pend) { if (!/^\d+(\.\d+)?$/.test(pend)) return toast('Показник: лише цифри'); var keep = {}; document.querySelectorAll('[data-f]').forEach(function (el) { keep[el.getAttribute('data-f')] = el.tagName === 'BUTTON' ? el.getAttribute('data-val') : el.value; }); var nt = $('#note').value, av = [$('#a-v').value, $('#a-s').value, $('#a-h').value];
      return saveReading(id).then(function () {
        document.querySelectorAll('[data-f]').forEach(function (el) { var k = el.getAttribute('data-f'); if (keep[k] == null) return; if (el.tagName === 'BUTTON') el.setAttribute('data-val', keep[k]); else el.value = keep[k]; });
        $('#note').value = nt; $('#a-v').value = av[0]; $('#a-s').value = av[1]; $('#a-h').value = av[2]; return saveCard(id);
      }); }
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
    return savePoint(p).then(function () { toast('Збережено'); });
  }

  /* ---------- Зчитування на місці: лічильник → показник → пломби ----------
     1. Звірити серійний номер лічильника з даними (і адресу з маршрутом).
     2. Внести фактичний показник. Якщо він менший, ніж у системі (нарахування за середнім), потрібне фото
        лічильника, а в примітку йде «Показ з фотофіксацією»: це фіксується у вивантаженні для обленерго.
     3. Пломби: одна кнопка «Усі на місці» або статус кожної. Без стану пломб показник не зберігається:
        показник може бути правильний, а пломби зірвані, і тоді після вивантаження викликають бригаду. */
  var R = {};
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }
  function sysReading(p) {
    var rd = lastReading(p.id)[0], f = p.fields || {};
    if (rd) return { v: Number(rd.reading), src: 'останній ' + dt(rd.ts) };
    if (f.prevIndex) return { v: Number(f.prevIndex), src: 'з маршрутного листа' };
    return null;
  }
  function sealsFlat(L) {
    var c = {}; L.forEach(function (x) { if (x.st && x.st !== 'Наявна') c[x.st] = (c[x.st] || 0) + 1; });
    return Object.keys(c).map(function (k) { return k.toLowerCase() + ' ' + c[k]; }).join(', ');
  }
  /* підсумок «Пломби», як у старому застосунку: зі статусів кожної пломби, а якщо пломб у даних немає — вибір вручну */
  function sealSum() {
    if (!R.L.length) return R.sealsSel || null;
    if (!R.L.every(function (x) { return x.st; })) return null;
    return R.L.some(function (x) { return x.st === 'Відсутня'; }) ? 'Відсутня' : R.L.some(function (x) { return x.st === 'Пошкоджена'; }) ? 'Пошкоджена' : 'all';
  }
  function readState(p) {
    var sys = sysReading(p), v = Number(R.val), has = R.val !== '' && /^\d+(\.\d+)?$/.test(R.val);
    var lower = has && sys && v < sys.v, big = has && sys && v - sys.v > 3000;
    var serialOk = R.serial === 'ok' || (R.serial === 'diff' && R.serialFact) || R.serial === 'skip';
    if (R.L.length) R.sealsSel = sealSum();
    var sealsOk = !!R.sealsSel && R.L.every(function (x) { return x.st; });
    var miss = [], at = [];
    var add = function (t, sel) { miss.push(t); at.push(sel); };
    if (!has) add('внесіть показник', '#r-val');
    var off = isOff(p);
    if (off && !R.photo) add('зробіть фото лічильника (лічильник відключено)', '.photo-btn');
    else if (lower && !R.photo) add('зробіть фото лічильника (показник менший за попередній)', '.photo-btn');
    if (R.photo && !off && (R.form || {}).noteSel !== PH_NOTE) add('у примітці виберіть «' + PH_NOTE + '»', '#r-note');
    if (R.L.length && !R.L.every(function (x) { return x.st; })) add('відмітьте статус кожної пломби', '#r-seals');
    else if (!R.sealsSel) add('виберіть стан пломб', '#r-seals');
    if (R.serial === 'diff' && !R.serialFact) add('впишіть номер з лічильника', '#r-sf');
    var need = miss.length ? miss[0] : null;
    return { sys: sys, has: has, lower: lower, big: big, serialOk: serialOk, sealsOk: sealsOk, need: need, miss: miss, at: at };
  }
  function stepHead(n, t, done, sub) {
    return '<div class="rstep"><span class="rnum' + (done ? ' done' : '') + '">' + (done ? icon('check', 16, 3) : n) + '</span><div class="col" style="gap:1px;min-width:0"><div class="h2" style="font-size:17px">' + t + '</div>' + (sub ? '<span class="small mute">' + sub + '</span>' : '') + '</div></div>';
  }
  var R_OPTS = {
    serial: [{ v: 'ok', l: 'Збігається' }, { v: 'diff', l: 'Інший номер' }, { v: 'skip', l: 'Не видно номера' }],
    seals: [{ v: 'all', l: 'Без зауважень' }, { v: 'Відсутня', l: 'Відсутня пломба' }, { v: 'Пошкоджена', l: 'Пошкоджена пломба' }]
  };
  function rSel(k, val, ph, id) {
    var lab = ''; R_OPTS[k].forEach(function (o) { if (o.v === val) lab = o.l; });
    if (k === 'serial' && val === 'diff' && !((S.points.get(id) || {}).fields || {}).serial) lab = 'Переписати з лічильника';
    return '<button type="button" class="input selbtn" data-act="rPick" data-k="' + k + '" data-id="' + id + '"><span class="' + (lab ? '' : 'mute') + '">' + esc(lab || ph) + '</span>' + icon('down', 18, 2.4) + '</button>';
  }
  function renderRead(id) {
    var p = S.points.get(id); if (!p) return go('#home');
    var f = p.fields || {};
    if (R.id !== id) {
      var L0 = sealList(p).map(function (x) { return Object.assign({}, x, { st: '' }); });
      R = { id: id, serial: null, serialFact: '', val: '', photo: null, photoUrl: null, seals: null, L: L0, sealsSel: L0.length ? null : 'all', note: S.readNote || '',
        form: { alarm: f.alarm || 'Ні', placement2: f.placement2 || f.placement || '', noteSel: '', zko: f.zko || 'Без зауважень', av: 'Відсутній', feeder: f.feeder || f.feederOld || '' } };
      S.readNote = null;
    }
    var st = readState(p), idx = routeIndex(id), rn = (S.meta.routeNo || {})[p.village] || '', F = R.form;
    var serial = (f.serial || '').trim(), nL = R.L.length, phone = (f.phone || '').replace(/[^\d+]/g, '');
    var b = function (act, v, l, on) { return '<button class="opt' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + v + '" data-id="' + id + '"><b style="font-size:15px">' + l + '</b></button>'; };
    var row = function (k, v) { return v ? '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>' : ''; };
    var fld = function (label, inner) { return '<div class="field"><label>' + label + '</label>' + inner + '</div>'; };
    var old = function (label, v) { return v ? '<div class="kv old"><span>' + label + '</span><b>' + esc(v) + '</b></div>' : ''; };
    /* пофідерна прив'язка: як у старому застосунку, змінюються лише номер ТП і фідера */
    var fm = /^(.*TS)(\d+)(.*F)(\d+)$/.exec(F.feeder);
    var feederHtml = fm ? '<div class="feeder">' + esc(fm[1]) + '<input data-fd="1" inputmode="numeric" value="' + esc(fm[2]) + '" style="width:' + (fm[2].length + 1) + 'ch">' + esc(fm[3]) + '<input data-fd="2" inputmode="numeric" value="' + esc(fm[4]) + '" style="width:' + (fm[4].length + 1) + 'ch"></div>'
      : '<input class="input" data-fd="all" value="' + esc(F.feeder) + '" placeholder="R07-TS0000-R000-S1-K00-F00">';
    var isCard = location.hash.indexOf('#card/') === 0;
    var done = R.L.filter(function (x) { return x.st; }).length;
    var sealsLabel = R.sealsSel === 'all' ? 'Без зауважень' : R.sealsSel ? R.sealsSel + ' пломба' : '';
    if (nL && done === nL) { var bad0 = sealsFlat(R.L); sealsLabel = bad0 ? bad0 : 'Без зауважень · ' + nL + '/' + nL; }
    var sealsBad = !!R.sealsSel && R.sealsSel !== 'all';
    /* рядок вибору: назва зліва, значення справа; вибір відкривається вікном поверх екрана. «змінено» — якщо відрізняється від бази */
    var prow = function (label, field, val, ph, changed, rid) {
      return '<button type="button" class="prow' + (field === 'alarm' && val === 'Так' ? ' badv' : '') + '" data-act="pick" data-f="' + field + '" data-val="' + esc(val || '') + '"' + (rid ? ' id="' + rid + '"' : '') + '><span class="pl">' + label + (changed ? ' <i class="chg">змінено</i>' : '') + '</span><span class="pv' + (val ? '' : ' mute') + '">' + esc(val || ph) + '</span>' + icon('right', 16, 2.4) + '</button>';
    };
    var b2 = function (act, v, l, on, kind) { return '<button type="button" class="s2' + (on ? ' on ' + kind : '') + '" data-act="' + act + '" data-v="' + v + '" data-id="' + id + '">' + l + '</button>'; };
    /* порядок і склад полів — точно як «Візит контролера» в старому застосунку */
    app.innerHTML = '<div class="screen" style="padding-bottom:40px">' +
      (isCard ? cardTop(p, cardFind(p)) + cardPhotos() : '<div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col" style="min-width:0"><div class="small mute">' + esc(p.village || '') + (idx >= 0 ? ' · №' + (idx + 1) + ' у маршруті' : '') + (rn ? ' · маршрут ' + esc(rn) : '') + '</div><div style="font-size:20px;font-weight:800">Візит контролера</div></div></div>') +
      '<div class="card visit">' +
        /* дані абонента згорнуті в один рядок: ПІБ і № лічильника видно одразу, решта по тапу */
        /* дані абонента завжди розгорнуті, як у старому застосунку */
        '<div class="subj">' +
        '<div class="kvs">' + row('Абонент', esc(f.fio || '—')) + row('Адреса', esc(f.address || addr(p))) +
          (phone ? '<div class="kv"><span>Телефон</span><a href="tel:' + esc(phone) + '" style="font-weight:700">' + esc(f.phone) + '</a></div>' : row('Телефон', '—')) +
          row('Серійний номер', '<span class="mono">' + esc(serial || '—') + '</span>') + row('Тип', esc(f.mtype || '—')) + row('Статус установки', esc(f.instStatus || '—')) +
          row('Розміщення', esc(f.placement || '—')) + row('Місце прилада', esc(f.devicePlace || '—')) + '</div>' +
          '<button class="btn sec" data-act="subjEdit" data-id="' + id + '" style="height:46px;margin-top:6px">' + icon('edit', 18) + 'Редагувати дані абонента</button></div>' +
        /* звірка номера лічильника з базою — у тому ж рядку, без окремого кроку */
        '<div class="sercheck" id="r-serial"><div class="between" style="gap:8px"><span class="pl">Номер на лічильнику</span><b class="mono">' + esc(serial || 'немає в базі') + '</b></div>' +
          '<div class="seg2">' + (serial ? b2('rSerial', 'ok', icon('check', 16, 3) + 'Збігається', R.serial === 'ok', 'ok') + b2('rSerial', 'diff', 'Інший', R.serial === 'diff', 'bad') : b2('rSerial', 'diff', 'Переписати', R.serial === 'diff', '')) + b2('rSerial', 'skip', 'Не видно', R.serial === 'skip', '') + '</div>' +
          (R.serial === 'diff' ? '<input id="r-sf" class="input mono" autocapitalize="characters" autocomplete="off" placeholder="Номер з лічильника" value="' + esc(R.serialFact) + '">' : '') + '</div>' +
        prow('Сигнал тривоги на лічильнику', 'alarm', F.alarm, 'Вибрати', false, 'r-alarm') +

        '<div class="v-sec">Показники</div>' +
        '<label for="r-val" class="v-lab">Загальний (попередній: ' + (st.sys ? fmt(st.sys.v) : '—') + ')</label>' +
        '<div class="row" style="gap:8px"><input id="r-val" class="input" inputmode="decimal" value="' + esc(R.val) + '" style="height:56px;font-size:22px;font-weight:800;min-width:0;flex:1">' +
          '<label for="r-cam" class="photo-btn">' + icon('camera', 20) + '<span>Зробити фото</span></label></div>' +
        '<div id="r-cmp"></div><div id="r-ph"></div>' +
        '<input id="r-cam" type="file" accept="image/*" capture="environment" hidden>' +
        '<div class="prows">' +
        prow('Розміщення', 'placement2', F.placement2, 'Вибрати', !!f.placement && F.placement2 !== f.placement) +
        prow('Примітка', 'noteSel', F.noteSel, 'Без примітки', false, 'r-note') +
        prow('ЗКО', 'zko', F.zko, 'Вибрати', F.zko !== (f.zko || 'Без зауважень')) +
        /* пломби: якщо вони є в базі — підсумок рахується зі статусів кожної, тап відкриває «Статуси пломб» */
        (nL ? '<button type="button" class="prow' + (sealsBad ? ' badv' : '') + '" data-act="rSealsOpen" data-id="' + id + '" id="r-seals"><span class="pl">Пломби</span><span class="pv' + (done < nL ? ' mute' : '') + '">' +
            (done < nL ? 'Відмітьте · ' + done + '/' + nL : esc(sealsLabel)) + '</span>' + icon('right', 16, 2.4) + '</button>'
          : '<button type="button" class="prow" data-act="rPick" data-k="seals" data-id="' + id + '" id="r-seals"><span class="pl">Пломби</span><span class="pv' + (R.sealsSel ? '' : ' mute') + '">' + esc(sealsLabel || 'Вибрати') + '</span>' + icon('right', 16, 2.4) + '</button>') +
        '<div class="prow ro"><span class="pl">Номінал автомата (старе значення)</span><span class="pv">' + esc(f.avOld || '—') + '</span></div>' +
        prow('Номінал автомата', 'av', F.av, 'Вибрати', F.av !== 'Відсутній') +
        '<div class="prow ro"><span class="pl">Пофідерна прив\'язка (старе значення)</span><span class="pv mono" style="font-size:13px">' + esc(f.feederOld || '—') + '</span></div>' +
        '<div class="prow ro" style="flex-direction:column;align-items:stretch;gap:6px"><span class="pl">Пофідерна прив\'язка</span>' + feederHtml + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="r-miss" class="miss" style="display:none"></div>' +
      /* три кнопки як у старому застосунку: Повідомлення про візит · Зберегти · Пломби */
      '<button class="btn vbtn note-btn" data-act="quick" data-v="note" data-id="' + id + '">Повідомлення про візит</button>' +
      '<button id="r-save" class="btn vbtn save-btn" data-act="rSave" data-id="' + id + '">Зберегти</button>' +
      '<button class="btn vbtn seals-btn' + (nL && done === nL ? ' done' : '') + '" data-act="rSealsOpen" data-id="' + id + '">Пломби' + (nL ? ' · ' + done + ' з ' + nL : '') + '</button>' +
      (isCard ? cardBottom(p) : '') +
      '</div>';
    var sf = $('#r-sf'); if (sf) sf.oninput = function () { R.serialFact = sf.value.trim().toUpperCase(); readUi(); };
    $('#r-val').oninput = function () { R.val = this.value.replace(/\s/g, '').replace(',', '.'); readUi(); };
    if ($('#r-note')) $('#r-note').oninput = function () { R.note = this.value; };
    $('#r-cam').onchange = function () {
      var file = this.files[0]; if (!file) return; toast('Обробляю фото…');
      compress(file).then(function (bl) {
        if (R.photoUrl) URL.revokeObjectURL(R.photoUrl); R.photo = bl; R.photoUrl = URL.createObjectURL(bl);
        /* фото → у примітці одразу «Показник із фотофіксацією» */
        var nb = document.querySelector('#app [data-f="noteSel"]'); if (nb && !isOff(S.points.get(R.id))) { nb.setAttribute('data-val', PH_NOTE); var nsp = nb.querySelector('.pv') || nb.querySelector('span'); nsp.textContent = PH_NOTE; nsp.classList.remove('mute'); }
        readCollect(); readUi();
      });
    };
    if (isCard) { loadPhotos(id); bindPhotoInputs(id); }
    readUi();
  }
  /* картка абонента = сторінка «Візит контролера» як у старому застосунку; зверху статус і навігація, знизу «Як знайти» та історія */
  function cardTop(p, inner) {
    var idx = routeIndex(p.id), cv = cycleMap()[p.id], f = p.fields || {}, phone = (f.phone || '').replace(/[^\d+]/g, '');
    var flags = (p.flags || []).filter(function (x) { return FLAGNAME[x]; });
    var navUrl = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + p.lat + ',' + p.lon;
    return '<div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col" style="min-width:0;align-items:flex-start;gap:4px"><button class="vchip" data-act="pointVillage" data-id="' + p.id + '" aria-label="Змінити село">' + icon('village', 14) + esc(p.village || 'Без села') + icon('down', 14, 2.6) + '</button>' + (idx >= 0 ? '<div class="small mute">№' + (idx + 1) + ' у маршруті</div>' : '') + '<div style="font-size:22px;font-weight:800;line-height:1.2">' + esc(addr(p)) + '</div></div></div>' +
      '<div class="card" style="gap:12px">' +
        '<div class="tags">' + (isJur(p) ? '<span class="chip" style="background:#7C3AED;color:#fff">Юридичний</span>' : '') + (isRuin(p) ? '<span class="chip" style="background:#DC2626;color:#fff">Аварійний будинок</span>' : '') + (isOff(p) ? '<span class="chip" style="background:#111;color:#fff">Лічильник відключено</span>' : '') + '<span class="chip">' + dotHtml(p.status) + ST[p.status].label + '</span>' + (in180(p) ? '<span class="chip" style="background:#FEF3C7;color:#92400E">Список ' + NORM() + ' · ' + daysLabel(p) + '</span>' : okMap()[p.id] ? '<span class="chip mute">Зчитано ' + daysLabel(p) + '</span>' : '') +
          '<span class="chip mute">' + monthName() + ': ' + (cv ? RESNAME[cv.result].toLowerCase() + ' ' + dt(cv.ts) + (cv.by && cv.by !== me().id ? ' · ' + esc(peerName(cv.by)) : '') : 'не відвідано') + '</span>' +
          flags.map(function (x) { return '<span class="chip" style="background:#FEF3C7;color:#92400E">' + FLAGNAME[x] + '</span>'; }).join('') + '</div>' +
        (cv && cv.result === 'note' ? '<div class="small" style="background:#F6F6F7;border-radius:14px;padding:10px 12px;font-weight:700;line-height:1.4">Записку залишено ' + dt(cv.ts) + '. Показник, переданий по телефону, внесіть в «Історії» нижче.</div>' : '') +
        '<div class="row" style="gap:8px"><button class="btn sec" data-act="showOnMap" data-id="' + p.id + '" style="flex:1;height:46px">' + icon('map', 18) + 'На карті</button>' +
        '<button class="iconbtn" data-act="editPoint" data-id="' + p.id + '" aria-label="Редагувати точку" style="width:46px;height:46px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('edit', 18) + '</button>' +
        '<a class="iconbtn" href="' + navUrl + '" target="_blank" rel="noopener" aria-label="Навігація" style="width:46px;height:46px;border:1.5px solid #E4E4E7;box-shadow:none">' + icon('nav', 18) + '</a>' +
        (phone ? '<a class="iconbtn" href="tel:' + esc(phone) + '" aria-label="Подзвонити" style="width:46px;height:46px;background:#111;color:#fff;box-shadow:none">' + icon('phone', 18) + '</a>' : '') + '</div>' +
      (inner || '') + '</div>' + dupBox(p);
  }
  /* фото в картку абонента — окремо від зчитування: зберігається одразу, без показника і пломб */
  function cardPhotos() {
    return '<div class="card" style="gap:10px"><div class="between"><b>Фото</b><span class="small mute">зберігається одразу, без показника</span></div>' +
      '<div id="photos" class="photos"></div>' +
      '<div class="grid2" style="gap:8px"><label class="btn sec" for="ph-m" style="height:46px">' + icon('camera', 18) + 'Лічильник</label><label class="btn sec" for="ph-h" style="height:46px">' + icon('camera', 18) + 'Будинок, хвіртка</label></div>' +
      '<input id="ph-m" type="file" accept="image/*" capture="environment" hidden data-kind="Лічильник"><input id="ph-h" type="file" accept="image/*" capture="environment" hidden data-kind="Будинок"></div>';
  }
  function cardFind(p) {
    return '<details class="fold-card fold-in"><summary><span class="row" style="gap:10px">' + icon('pin', 18) + '<b>Як знайти адресата</b></span>' + icon('down', 18, 2.4) + '</summary><div class="fold-body">' +
        ((p.tags || []).length ? '<div class="tags">' + p.tags.map(function (t) { return '<span class="chip on">' + esc(TAGNAME[t] || t) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="field"><label for="note">Орієнтир</label><textarea id="note" class="input" placeholder="Колір хвіртки, де лічильник, коли вдома">' + esc(p.note || '') + '</textarea></div>' +
        '<div class="v-sec" style="text-align:left;font-size:15px">Адреса на карті</div>' +
        '<div class="field"><label for="a-v">Село</label><input id="a-v" class="input" list="vlist" value="' + esc(p.village || '') + '"><datalist id="vlist">' + villages().map(function (v) { return '<option value="' + esc(v.name) + '">'; }).join('') + '</datalist></div>' +
        '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><div class="field"><label for="a-s">Вулиця</label><input id="a-s" class="input" value="' + esc(p.street || '') + '"></div><div class="field"><label for="a-h">Будинок</label><input id="a-h" class="input" inputmode="numeric" data-house="1" autocomplete="off" value="' + esc(p.house || '') + '"></div></div>' +
        '<a class="btn sec" href="#bind/' + p.id + '" style="justify-content:space-between;padding:0 14px;gap:10px"><span class="row" style="gap:8px;white-space:nowrap">' + icon('pin', 18) + 'Уточнити розташування</span><span class="small mute" style="text-align:right">' + (p.acc ? '±' + Math.round(p.acc) + ' м · ' : '') + esc(p.src || '') + '</span></a>' +
        '<div class="small mute">Вніс: ' + esc(authorOf(p)) + (p.created ? ' · ' + esc(p.created.split('-').reverse().join('.')) : '') + '</div>' +
        '<button class="btn" data-act="saveFind" data-id="' + p.id + '">Зберегти орієнтир і адресу</button></div></details>';
  }
  function cardBottom(p) {
    var rd = lastReading(p.id);
    return '<details class="card fold-card"' + ((cycleMap()[p.id] || {}).result === 'note' ? ' open' : '') + '><summary><span class="row" style="gap:10px">' + icon('list', 18) + '<b>Історія · ' + visitsOf(p.id).length + '</b></span>' + icon('down', 18, 2.4) + '</summary><div class="fold-body">' +
        '<div class="field"><label for="rdg">Показник передали по телефону</label><div class="row" style="gap:8px"><input id="rdg" class="input" inputmode="decimal" placeholder="Показник зі слів" style="min-width:0;flex:1"><button class="btn out" data-act="saveReading" data-id="' + p.id + '" style="width:auto;padding:0 16px">Зберегти</button></div></div>' +
        (rd.length ? '<div class="col" style="gap:0">' + rd.map(function (v, i) {
          var nx = rd[i + 1], dd = nx ? Number(v.reading) - Number(nx.reading) : null;
          return '<div class="list-row" style="justify-content:space-between"><div class="col"><b>' + dt(v.ts) + '</b><span class="small mute">' + tm(v.ts) + (v.method ? ' · ' + esc(v.method) : '') + '</span></div><div class="col" style="align-items:flex-end"><b style="font-size:16px">' + fmt(v.reading) + '</b><span class="small mute">' + (dd != null ? (dd >= 0 ? '+' : '') + fmt(dd) : '—') + '</span></div></div>';
        }).join('') + '</div>' : '') +
        visitsCard(p).replace('class="card"', 'class="col"') + '</div></details>' +
      '';
  }
  function saveFind(id) {
    var p = S.points.get(id); if (!p) return;
    p.note = $('#note').value.trim();
    return applyAddr(p, $('#a-v').value.trim(), $('#a-s').value.trim(), $('#a-h').value.trim()).then(function () { toast('Збережено'); });
  }
  function applyAddr(p, v, s, h) {
    if (v !== (p.village || '')) { p.village = v || null; S.route = null; }
    p.street = s; p.house = h;
    var same = 0;
    S.points.forEach(function (q) { if (q.id !== p.id && s && h && q.village === p.village && (q.street || '').toLowerCase() === s.toLowerCase() && (q.house || '').toLowerCase() === h.toLowerCase()) same++; });
    p.flags = (p.flags || []).filter(function (x) {
      if (x === 'no_street') return !s; if (x === 'no_house') return !h;
      if (x === 'no_village' || x === 'village_guess' || x === 'village_check') return !v;
      if (x === 'dup') return same > 0; return true;
    });
    return savePoint(p);
  }
  /* редагування точки з карти (Обхід, Мітки) і з картки: адреса, доступ, орієнтир, розташування */
  /* ручне введення даних абонента (поступово, для орієнтації). Зберігається лише на цьому телефоні:
     на сервер синхронізації дані абонентів не йдуть */
  var SUBJ_F = [['fio', 'Прізвище, ім\'я, по батькові', 'text'], ['phone', 'Телефон', 'tel'], ['serial', 'Номер лічильника', 'text'], ['mtype', 'Тип лічильника', 'text'],
    ['instStatus', 'Статус установки', 'text'], ['placement', 'Розміщення', 'text'], ['devicePlace', 'Місце прилада (код)', 'numeric'], ['prevIndex', 'Попередній показник', 'decimal'], ['account', 'Особовий рахунок', 'numeric']];
  function openSubjEditor(id) {
    var p = S.points.get(id); if (!p) return;
    var f = p.fields || {}, ov = document.createElement('div'); ov.className = 'seals-ov';
    ov.innerHTML = '<div class="seals-head"><button class="iconbtn" data-se="close" aria-label="Закрити">' + icon('close', 20, 2.4) + '</button><div class="col"><div class="small mute">' + esc(addr(p)) + '</div><div style="font-size:20px;font-weight:800">Дані абонента</div></div></div>' +
      '<div class="seals-body"><div class="card" style="gap:12px">' + SUBJ_F.map(function (x) {
        return '<div class="field"><label for="se-' + x[0] + '">' + x[1] + '</label><input id="se-' + x[0] + '" class="input"' + (x[2] === 'tel' ? ' type="tel"' : x[2] !== 'text' ? ' inputmode="' + x[2] + '"' : '') + ' autocomplete="off" value="' + esc(f[x[0]] || '') + '"' + (x[0] === 'fio' ? ' autocapitalize="words"' : x[0] === 'serial' ? ' autocapitalize="characters" spellcheck="false"' : '') + '></div>';
      }).join('') + '</div><div class="small mute" style="line-height:1.5;padding:0 4px">Заповнюйте поступово, що відомо. Дані абонента зберігаються лише на цьому телефоні і в резервній копії; на сервер синхронізації вони не йдуть.</div></div>' +
      '<div class="seals-foot"><button class="btn" data-se="save" style="height:58px">Зберегти</button></div>';
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-se]'); if (!b) return;
      if (b.getAttribute('data-se') === 'close') return ov.remove();
      var nf = Object.assign({}, p.fields || {});
      SUBJ_F.forEach(function (x) { var v = ov.querySelector('#se-' + x[0]).value.trim(); if (x[0] === 'serial') v = v.toUpperCase(); if (v) nf[x[0]] = v; else delete nf[x[0]]; });
      p.fields = nf;
      savePoint(p).then(function () { ov.remove(); toast('Дані абонента збережено'); if (R && R.id === id) R.subjOpen = true; var y = window.scrollY; render(); window.scrollTo(0, y); });
    });
    document.body.appendChild(ov);
    setTimeout(function () { var i = ov.querySelector('#se-fio'); if (i && !i.value) i.focus(); }, 60);
  }
  function openPointEditor(id) {
    var p = S.points.get(id); if (!p) return;
    var E = { st: p.status, v: p.village || '', off: isOff(p), tags: (p.tags || []).slice() };
    var ov = document.createElement('div'); ov.id = 'pe-ov'; ov.className = 'seals-ov';
    var draw = function () {
      var keep = ov.querySelector('#pe-s') ? { s: ov.querySelector('#pe-s').value, h: ov.querySelector('#pe-h').value, n: ov.querySelector('#pe-n').value } : { s: p.street || '', h: p.house || '', n: p.note || '' };
      ov.innerHTML = '<div class="seals-head"><button class="iconbtn" data-pe="close" aria-label="Закрити">' + icon('close', 20, 2.4) + '</button><div class="col"><div class="small mute">Редагування точки</div><div style="font-size:20px;font-weight:800">' + esc(addr(p)) + '</div></div></div>' +
        '<div class="seals-body">' +
        '<div class="card"><div class="h2" style="font-size:16px">Доступ до лічильника</div><div class="grid2" style="gap:8px">' + ST_ORDER.map(function (k) {
          return '<button class="opt' + (E.st === k ? ' on' : '') + '" data-pe="st" data-v="' + k + '" style="flex-direction:row;align-items:center;justify-content:flex-start;gap:10px;min-height:52px">' + dotHtml(k) + '<b style="font-size:15px">' + ST[k].label + '</b></button>';
        }).join('') + '</div></div>' +
        '<div class="card"><div class="between"><div class="h2" style="font-size:16px">Особливості точки</div>' + infoBtn('ptflags') + '</div><button class="opt' + (E.tags.indexOf('jur') >= 0 ? ' on jur' : '') + '" data-pe="tag" data-v="jur" style="flex-direction:row;align-items:center;justify-content:space-between;min-height:56px"><span class="row" style="gap:8px"><span class="dot" style="background:' + JUR + '"></span><b style="font-size:15px">Юридичний споживач</b></span><span class="sw' + (E.tags.indexOf('jur') >= 0 ? ' on' : '') + '"></span></button>' +
          '<button class="opt' + (E.off ? ' on' : '') + '" data-pe="off" style="flex-direction:row;align-items:center;justify-content:space-between;min-height:56px"><span class="row" style="gap:8px"><svg width="18" height="18" viewBox="0 0 33 33" aria-hidden="true" style="flex-shrink:0"><circle cx="16.5" cy="16.5" r="14.5" fill="#111" stroke="#fff" stroke-width="2.5"/><path d="M11.3 12.9A6.5 6.5 0 1 0 21.7 12.9" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M16.5 8v7" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg><b style="font-size:15px">Лічильник відключено</b></span><span class="sw' + (E.off ? ' on' : '') + '"></span></button>' +
          /* аварійний будинок — такий самий перемикач, як юридичний і відключений */
          '<button class="opt' + (E.tags.indexOf('ruin') >= 0 ? ' on ruin' : '') + '" data-pe="tag" data-v="ruin" style="flex-direction:row;align-items:center;justify-content:space-between;min-height:56px"><span class="row" style="gap:8px"><span style="color:#DC2626;display:flex">' + icon('alert', 16, 2.6) + '</span><b style="font-size:15px">Аварійний будинок</b></span><span class="sw' + (E.tags.indexOf('ruin') >= 0 ? ' on ruin' : '') + '"></span></button>' +
          '</div>' +
        '<div class="card"><div class="h2" style="font-size:16px">Адреса</div>' +
          '<div class="field"><label>Село</label><button type="button" class="input selbtn" data-pe="v"><span class="' + (E.v ? '' : 'mute') + '">' + esc(E.v || 'Без села') + '</span>' + icon('down', 18, 2.4) + '</button></div>' +
          '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><div class="field"><label for="pe-s">Вулиця</label><input id="pe-s" class="input" value="' + esc(keep.s) + '"></div><div class="field"><label for="pe-h">Будинок</label><input id="pe-h" class="input" inputmode="numeric" data-house="1" autocomplete="off" value="' + esc(keep.h) + '"></div></div></div>' +
        '<div class="card"><div class="h2" style="font-size:16px">Мітки</div><div class="tags">' + TAGS.filter(function (t) { return t[0] !== 'jur' && t[0] !== 'ruin'; }).map(function (t) { return '<button class="tag' + (E.tags.indexOf(t[0]) >= 0 ? ' on' : '') + '" data-pe="tag" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="card"><div class="h2" style="font-size:16px">Як знайти</div><textarea id="pe-n" class="input" placeholder="Орієнтир: колір хвіртки, де лічильник, коли вдома">' + esc(keep.n) + '</textarea>' +
          '<button class="btn sec" data-pe="bind" style="justify-content:space-between;padding:0 14px"><span class="row" style="gap:8px">' + icon('pin', 18) + 'Пересунути точку на карті</span><span class="small mute">' + esc(p.src || '') + '</span></button></div>' +
        '<div class="card"><div class="h2" style="font-size:16px">Фото</div><div class="small mute" style="margin-top:-6px">Де захований лічильник, хвіртка, будинок. Зберігається одразу, без показника.</div>' +
          '<div id="pe-photos" class="photos"></div>' +
          '<div class="grid2" style="gap:8px"><label class="btn sec" for="pe-ph-m" style="height:50px">' + icon('camera', 18) + 'Лічильник</label><label class="btn sec" for="pe-ph-h" style="height:50px">' + icon('camera', 18) + 'Хвіртка, будинок</label></div>' +
          '<input id="pe-ph-m" type="file" accept="image/*" capture="environment" hidden data-kind="Лічильник"><input id="pe-ph-h" type="file" accept="image/*" capture="environment" hidden data-kind="Будинок"></div>' +
        '<button class="btn sec" data-pe="del" style="color:#B91C1C;height:46px">Видалити точку (дубль)</button>' +
        '</div><div class="seals-foot"><button class="btn" data-pe="save" style="height:58px">Зберегти</button></div>';
    };
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pe]'); if (!b) return;
      var k = b.getAttribute('data-pe');
      if (k === 'close') return ov.remove();
      if (k === 'st') { E.st = b.getAttribute('data-v'); return draw(); }
      if (k === 'off') { E.off = !E.off; return draw(); }
      if (k === 'tag') { var tv = b.getAttribute('data-v'), ti = E.tags.indexOf(tv); if (ti >= 0) E.tags.splice(ti, 1); else { E.tags.push(tv); if (tv === 'ruin') E.st = 'n'; } return draw(); }
      if (k === 'del') { ov.remove(); var db = document.createElement('button'); db.setAttribute('data-act', 'deletePoint'); db.setAttribute('data-id', id); document.body.appendChild(db); db.click(); db.remove(); return; }
      if (k === 'v') return pickVillageFor(E.v, function (v) { E.v = v || ''; draw(); });
      if (k === 'bind') { ov.remove(); return go('#bind/' + id); }
      if (k === 'save') {
        var st0 = p.status; p.status = E.st; p.off = E.off; p.tags = E.tags.slice(); p.note = ov.querySelector('#pe-n').value.trim();
        applyAddr(p, E.v, ov.querySelector('#pe-s').value.trim(), ov.querySelector('#pe-h').value.trim()).then(function () {
          ov.remove(); toast('Точку збережено' + (st0 !== E.st ? ' · ' + ST[E.st].label.toLowerCase() : ''));
          S.route = null; if (/^#(map|all)/.test(location.hash || '#home')) { updateMap(); renderSheet(); } else { var y = window.scrollY; render(); window.scrollTo(0, y); }
        });
      }
    });
    /* перемальовування (мітка, доступ, село) не скидає прокрутку: лишаємось там, де натиснули */
    var draw0 = draw; draw = function () { var sb = ov.querySelector('.seals-body'), y = sb ? sb.scrollTop : 0, oy = ov.scrollTop; draw0(); var sb2 = ov.querySelector('.seals-body'); if (sb2) sb2.scrollTop = y; ov.scrollTop = oy;
      ['#pe-s', '#pe-h'].forEach(function (sel) { var i = ov.querySelector(sel); if (!i) return; i.setAttribute('enterkeyhint', 'done'); i.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); var b = ov.querySelector('[data-pe=save]'); if (b) b.click(); } }; }); loadPhotos(id, '#pe-photos'); bindPhotoInputs(id, ['#pe-ph-m', '#pe-ph-h'], '#pe-photos'); };
    document.body.appendChild(ov); draw();
  }
  /* значення полів-виборів і пофідерної прив'язки зберігаємо в R.form перед перемальовуванням */
  function readCollect() {
    if (!R.form) return;
    ['alarm', 'placement2', 'noteSel', 'zko', 'av'].forEach(function (k) { var el = document.querySelector('#app [data-f="' + k + '"]'); if (el) R.form[k] = el.getAttribute('data-val') || ''; });
    var a = document.querySelector('[data-fd="all"]'), f1 = document.querySelector('[data-fd="1"]'), f2 = document.querySelector('[data-fd="2"]');
    if (a) R.form.feeder = a.value.trim();
    else if (f1 && f2) { var m = /^(.*TS)(\d+)(.*F)(\d+)$/.exec(R.form.feeder); if (m) R.form.feeder = m[1] + f1.value.trim() + m[3] + f2.value.trim(); }
  }
  function readPhotoHtml(st) {
    if (R.photo) return '<div class="row" style="gap:10px"><img src="' + R.photoUrl + '" alt="Фото лічильника" style="width:64px;height:64px;object-fit:cover;border-radius:14px"><div class="col" style="flex-grow:1;gap:2px"><b>Показ з фотофіксацією</b><span class="small mute">Так і піде в примітку</span></div><label for="r-cam" class="chip">Перезняти</label></div>';
    return '';
  }
  function readUi() {
    var p = S.points.get(R.id); if (!p) return;
    var st = readState(p), c = $('#r-cmp'), v = Number(R.val);
    if (c) c.innerHTML = !st.has || !st.sys ? '' : st.lower
      ? '<div class="cmp bad"><b>Менше, ніж у системі, на ' + fmt(Math.round((st.sys.v - v) * 100) / 100) + '</b><span>Схоже, нараховано за середнім. Внесіть фактичний показник і зробіть фото лічильника.</span></div>'
      : st.big ? '<div class="cmp warn"><b>+' + fmt(Math.round((v - st.sys.v) * 100) / 100) + ' від системи</b><span>Велика різниця. Перевірте цифри.</span></div>'
      : '<div class="cmp ok"><b>+' + fmt(Math.round((v - st.sys.v) * 100) / 100) + ' від системи</b></div>';
    var ph = $('#r-ph'); if (ph) ph.innerHTML = readPhotoHtml(st);
    var pb = $('.photo-btn'); if (pb) { pb.classList.toggle('done', !!R.photo); pb.classList.toggle('need', (!!st.lower || isOff(p)) && !R.photo); pb.lastChild.textContent = R.photo ? 'Фото є' : 'Зробити фото'; }
    var s = $('#r-save'); if (!s) return;
    var next = S.route && routeIndex(R.id) >= 0;
    s.disabled = false; s.classList.remove('wait');
    s.innerHTML = 'Зберегти';
    var h = $('#r-miss'); if (h) {
      h.className = 'miss' + (R.tried ? '' : ' soft');
      h.innerHTML = !st.need ? '' : R.tried ? '<b>Щоб зберегти:</b><ul>' + st.miss.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : 'Бракує: ' + esc(st.miss.join(', '));
      h.style.display = st.need ? '' : 'none'; }
    document.querySelectorAll('#app .need-f').forEach(function (x) { x.classList.remove('need-f'); });
    if (R.tried) st.at.forEach(function (sel) { var e = document.querySelector('#app ' + sel); if (e) e.classList.add('need-f'); });
    /* галочки в заголовках кроків */
    var nums = document.querySelectorAll('.rnum');
    [st.serialOk, st.has && (!st.lower || !!R.photo), st.sealsOk].forEach(function (d, i) { if (nums[i]) { nums[i].classList.toggle('done', d); nums[i].innerHTML = d ? icon('check', 16, 3) : i + 1; } });
  }
  function readKeep() { var sj = document.querySelector('.subj'); if (sj) R.subjOpen = sj.open; readCollect(); var y = window.scrollY; renderRead(R.id); window.scrollTo(0, y); }
  function readAction(a, el) {
    var i = +el.getAttribute('data-i');
    if (a === 'rSerial') { var v = el.getAttribute('data-v'); R.serial = R.serial === v ? null : v; return readKeep(); }
    if (a === 'rSealsOpen') return openSealsScreen();
    if (a === 'rPick') {
      var k = el.getAttribute('data-k'), opts = R_OPTS[k];
      if (el.getAttribute('data-nodata')) opts = [{ v: 'diff', l: 'Переписати з лічильника' }, { v: 'skip', l: 'Не видно номера' }];
      readCollect();
      return openSheet(k === 'serial' ? 'Серійний номер' : 'Пломби', opts, k === 'serial' ? R.serial : R.sealsSel, function (v) {
        if (k === 'serial') { R.serial = v; return readKeep(); }
        R.sealsSel = v; readKeep();
      });
    }
    if (a === 'rSave') { readCollect(); var stt = readState(S.points.get(R.id)); if (stt.need) { R.tried = true; readUi(); var hh = document.querySelector(stt.at[0]) || $('#r-miss'); if (hh) hh.scrollIntoView({ block: 'center', behavior: 'smooth' }); return toast('Не все заповнено: ' + stt.need); } return saveRead(R.id); }
  }
  /* «Статуси пломб» — окремий екран, як у старому застосунку, плюс кнопка «Наявні всі» */
  function openSealsScreen() {
    readCollect();
    var T = R.L.map(function (x) { return Object.assign({}, x); });
    var ov = document.createElement('div'); ov.id = 'seals-ov'; ov.className = 'seals-ov';
    var draw = function () {
      var done = T.filter(function (x) { return x.st; }).length;
      ov.innerHTML = '<div class="seals-head"><button class="iconbtn" data-so="close" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col"><div class="small mute">Відмічено ' + done + ' з ' + T.length + '</div><div style="font-size:20px;font-weight:800">Статуси пломб</div></div></div>' +
        '<div class="seals-body"><button class="btn" data-so="all" style="height:56px">' + icon('check', 20, 2.8) + 'Наявні всі</button>' +
        T.map(function (x, i) {
          var bad = x.st && x.st !== 'Наявна';
          return '<div class="card seal-card' + (bad ? ' bad' : '') + '"><div class="between"><div class="col" style="gap:2px"><b style="font-size:17px">' + esc(x.n || 'Без номера') + '</b><span class="small mute">' + esc(x.place) + '</span></div>' +
            (x.added ? '<button class="seal-x" data-so="del" data-i="' + i + '" aria-label="Прибрати">' + icon('close', 14, 2.4) + '</button>' : '') + '</div>' +
            '<button type="button" class="input selbtn" data-so="st" data-i="' + i + '"><span class="' + (x.st ? '' : 'mute') + '">' + esc(x.st || 'Виберіть статус') + '</span>' + icon('down', 18, 2.4) + '</button></div>';
        }).join('') +
        '<button class="btn sec" data-so="add" style="height:46px">' + icon('plus', 16, 2.6) + 'Пломба, якої немає в списку</button></div>' +
        '<div class="seals-foot"><button class="btn" data-so="save" style="height:58px">Зберегти</button></div>';
    };
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-so]'); if (!b) return;
      var k = b.getAttribute('data-so'), i = +b.getAttribute('data-i');
      if (k === 'close') return ov.remove();
      if (k === 'all') { T.forEach(function (x) { x.st = 'Наявна'; }); return draw(); }
      if (k === 'st') return openSheet(T[i].n || 'Пломба', SEAL_ST, T[i].st, function (v) { T[i].st = v; draw(); });
      if (k === 'del') { T.splice(i, 1); return draw(); }
      if (k === 'add') {
        var n = (prompt('Номер пломби') || '').trim().toUpperCase(); if (!n) return;
        return openSheet('Де пломба ' + n, SEAL_PLACES, 'ЛІЧИЛЬНИК', function (pl) { T.push({ n: n, place: pl, st: '', added: true }); draw(); });
      }
      if (k === 'save') { R.L = T; var sm = sealSum(); if (sm) R.sealsSel = sm; ov.remove(); var y = window.scrollY; renderRead(R.id); window.scrollTo(0, y); }
    });
    var draw0 = draw; draw = function () { var sb = ov.querySelector('.seals-body'), y = sb ? sb.scrollTop : 0; draw0(); var sb2 = ov.querySelector('.seals-body'); if (sb2) sb2.scrollTop = y; };
    draw(); document.body.appendChild(ov);
  }
  function saveRead(id) {
    readCollect();
    var p = S.points.get(id), st = readState(p); if (st.need) return toast(st.need);
    var f = Object.assign({}, p.fields || {}), F = R.form;
    ['alarm', 'placement2', 'zko', 'av', 'feeder'].forEach(function (k) { if (F[k]) f[k] = F[k]; });
    var L = R.L.map(function (x) { return { n: x.n, place: x.place, st: x.st }; }), sum = R.sealsSel;
    var issues = sealsFlat(L) || (sum !== 'all' ? sum.toLowerCase() + ' пломба' : '');
    var notes = [];
    if (F.noteSel) notes.push(F.noteSel);
    if (issues) notes.push('Пломби: ' + issues);
    if (R.note.trim()) notes.push(R.note.trim());
    var v = newVisit({ pointId: id, result: 'ok', prof: p.status, reading: R.val, method: R.photo ? 'зчитано, фотофіксація' : 'зчитано', note: notes.join('; ') || null,
      serial: f.serial || '',
      seals: sum === 'all' ? 'без зауважень' : sum.toLowerCase() + ' пломба', form: { alarm: F.alarm, placement: F.placement2, noteSel: F.noteSel, zko: F.zko, av: F.av, feeder: F.feeder }, sealList: L.filter(function (x) { return x.n || x.st; }), photo: !!R.photo, sysReading: st.sys ? st.sys.v : null,
      pos: S.pos && !S.pos.stale ? { lat: S.pos.lat, lon: S.pos.lon, acc: Math.round(S.pos.acc) } : null });
    /* у картку: статуси пломб, підсумок «Пломби», серійний (якщо його не було) */
    if (L.some(function (x) { return x.n; })) f.sealList = L.filter(function (x) { return x.n; });
    f.seals = sum === 'all' ? 'Без зауважень' : sum + ' пломба';
    if (!f.serial && R.serialFact) f.serial = R.serialFact;
    p.fields = f;
    var ph = R.photo;
    put('visits', v).then(function (k) { v.id = k; S.visits.push(v); invalidate(); return savePoint(p); })
      .then(function () { return ph ? put('photos', { pointId: id, ts: v.ts, kind: 'Показник ' + fmt(v.reading), visit: v.uid, blob: ph }) : null; })
      .then(function () {
        if (R.photoUrl) URL.revokeObjectURL(R.photoUrl); R = {};
        S.route = computeRoute(); toast('Зчитано · ' + fmt(v.reading) + (issues ? ' · пломби: ' + issues : ''));
        /* одразу назад в «Обхід»: наступна адреса маршруту, а без маршруту — ця ж точка з результатом */
        var nx = S.route && S.route.ids[0], sel = nx || id, sp = S.points.get(sel);
        S.sel = sel; renderMap.fitNext = false; go('#map');
        setTimeout(function () { if (map && sp) map.easeTo({ center: [sp.lon, sp.lat], zoom: Math.max(map.getZoom(), 17) }); }, 300);
      });
  }

  /* ---------- Візит ---------- */
  var V = {};
  function renderVisit(id) {
    var p = S.points.get(id); if (!p) return go('#home');
    if (V.id !== id) V = { id: id, res: null, prof: p.status, tags: (p.tags || []).slice() };
    var idx = routeIndex(id), next = S.route && S.route.ids[idx >= 0 ? idx + 1 : 0];
    app.innerHTML = '<div class="screen" style="padding-bottom:120px">' +
      '<div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col"><div class="small mute">' + (idx >= 0 ? '№' + (idx + 1) + ' · ' : '') + monthName().toLowerCase() + '</div><div style="font-size:18px;font-weight:800">' + esc(addr(p)) + '</div></div></div>' +
      '<div class="card"><div class="h2">1. Що сьогодні?</div><div class="grid2" style="gap:8px">' + RESULTS.map(function (r) {
        return '<button class="opt' + (V.res === r[0] ? ' on' : '') + '" data-act="res" data-v="' + r[0] + '"' + (r[0] === 'note' ? ' style="grid-column:1/-1"' : '') + '><b style="font-size:15px">' + r[1] + '</b><small>' + r[2] + '</small></button>';
      }).join('') + '</div>' +
      (V.res === 'ok' ? '<div class="small" style="background:#F6F6F7;border-radius:14px;padding:10px 12px;line-height:1.4">Далі: звірка лічильника, показник і пломби.</div>' : '') +
      '</div>' +
      '<div class="card"><div class="col" style="gap:2px"><div class="h2">2. Доступ до лічильника</div><div class="small mute">Зберігається на наступні місяці</div></div><div class="grid2" style="gap:8px">' + ST_ORDER.map(function (s) {
        return '<button class="opt' + (V.prof === s ? ' on' : '') + '" data-act="prof" data-v="' + s + '" style="flex-direction:row;align-items:center;justify-content:flex-start;gap:10px;min-height:48px">' + dotHtml(s) + '<b style="font-size:14px">' + ST[s].label + '</b></button>';
      }).join('') + '</div></div>' +
      '<div class="card"><div class="h2">3. Мітки</div><div class="tags">' + TAGS.map(function (t) {
        return '<button class="tag' + (V.tags.indexOf(t[0]) >= 0 ? ' on' : '') + '" data-act="vtag" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><textarea id="vn" class="input" placeholder="Нотатка (необов\'язково)"></textarea></div>' +
      '</div>' +
      '<div style="position:fixed;left:16px;right:16px;bottom:calc(16px + var(--safe-b))"><button class="btn" data-act="saveVisit" data-id="' + id + '" ' + (V.res ? '' : 'disabled') + ' style="height:58px">' +
      (V.res === 'ok' ? 'Далі: показник і пломби' : next ? 'Зберегти · до наступної' : 'Зберегти') + icon('arrow', 20, 2.4) + '</button></div>';
  }
  function saveVisit(id) {
    var p = S.points.get(id); if (!p || !V.res) return;
    var reading = $('#vr') ? $('#vr').value.replace(/\s/g, '').replace(',', '.') : '';
    if (reading && !/^\d+(\.\d+)?$/.test(reading)) return toast('Показник: лише цифри');
    var note = $('#vn').value.trim();
    /* «Зчитано» — без візиту тут: доступ і мітки зберігаємо в точку, далі крок зчитування з пломбами */
    if (V.res === 'ok') { p.status = V.prof; p.tags = V.tags.slice(); S.readNote = note; return savePoint(p).then(function () { V = {}; R = {}; location.replace('#read/' + id); }); }
    var v = newVisit({ pointId: id, result: V.res, prof: V.prof, reading: reading || null, method: reading ? (($('#vmw [data-f]') || {}).getAttribute ? $('#vmw [data-f]').getAttribute('data-val') : 'зчитано') : null, note: note || null,
      pos: S.pos && !S.pos.stale ? { lat: S.pos.lat, lon: S.pos.lon, acc: Math.round(S.pos.acc) } : null });
    if (V.res === 'empty') V.prof = 'n';
    p.status = V.prof; p.tags = V.tags.slice();
    if (note) p.note = p.note ? p.note + '; ' + note : note;
    var inRoute = routeIndex(id) >= 0;
    put('visits', v).then(function (k) { v.id = k; S.visits.push(v); invalidate(); return savePoint(p); }).then(function () {
      V = {}; S.route = computeRoute(); toast('Збережено: ' + RESNAME[v.result]);
      /* з маршруту — далі до наступної адреси; відкрито окремо (пошук, мітки) — повертаємось у картку */
      if (inRoute) { S.sel = S.route && S.route.ids[0]; renderMap.fitNext = true; go('#map'); } else go('#card/' + id);
    });
  }
  function saveReading(id) {
    var val = ($('#rdg').value || '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(val)) return toast('Введіть показник цифрами');
    var lastM = cycleMap()[id], afterNote = lastM && lastM.result === 'note';
    var v = newVisit({ pointId: id, result: 'ok', prof: S.points.get(id).status, reading: val, method: afterNote ? 'по телефону (після записки)' : 'по телефону', note: null,
      pos: S.pos && !S.pos.stale ? { lat: S.pos.lat, lon: S.pos.lon, acc: Math.round(S.pos.acc) } : null });
    return put('visits', v).then(function (k) { v.id = k; S.visits.push(v); invalidate(); S.route = null; toast('Показник збережено: ' + fmt(val)); var y = window.scrollY; R = {}; renderRead(id); window.scrollTo(0, y); });
  }

  /* ---------- Прив'язка: GPS або вручну по карті/супутнику ----------
     GPS — коли точність ±15 м або краща. Вручну — посуваєте карту (краще супутник), поки мітка не стане на дах/лічильник;
     зберігається центр карти, джерело «вручну». Стара позиція показана сірим колом для порівняння. */
  var B = {};
  function renderBind(id) {
    mapMode = 'bind'; S.moved = false;
    var p = id && id !== 'new' ? S.points.get(id) : null;
    B = { id: id, p: p, mode: p ? 'manual' : 'gps' };
    /* для ручного уточнення одразу вмикаємо супутник, після виходу повертаємо попередній шар */
    if (p && navigator.onLine && (S.meta.layer || 'scheme') !== 'sat') { S.layerBeforeBind = S.meta.layer || 'scheme'; if (map) setLayer('sat'); else S.meta.layer = 'sat'; }
    app.innerHTML = '<svg class="crosshair" width="40" height="52" viewBox="0 0 40 52" role="img" aria-label="Точка лічильника"><path d="M20 50s-17-15-17-29A17 17 0 0137 21c0 14-17 29-17 29z" fill="#111" stroke="#fff" stroke-width="3"/><circle cx="20" cy="21" r="7" fill="' + (p ? ST[p.status].color : '#F59E0B') + '"/></svg>' +
      '<div class="mapui" style="top:18px;display:flex;flex-direction:column;gap:10px"><div class="row"><button class="iconbtn" data-act="back" aria-label="Скасувати">' + icon('close', 20, 2.4) + '</button>' +
      '<div class="pill" style="flex-grow:1;height:48px;flex-direction:column;align-items:flex-start;justify-content:center;gap:0;box-shadow:0 6px 20px rgba(0,0,0,.06);min-width:0"><span class="small mute" style="font-size:11px">' + (p ? 'Розташування точки' : 'Нова точка') + '</span><span style="font-size:14px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + esc(p ? addr(p) : 'Стань біля лічильника') + '</span></div></div>' +
      '<div class="between"><button class="iconbtn" data-act="locate" aria-label="Моя позиція">' + icon('locate') + '</button><div class="seg" id="bind-lay"></div></div></div>' +
      '<div class="sheet" style="bottom:calc(16px + var(--safe-b))" id="bind-sheet"></div>';
    renderBindUi();
    var c = p ? [p.lon, p.lat] : S.pos ? [S.pos.lon, S.pos.lat] : null;
    var setup = function () { updateMap(); if (c) pinJump(c, 18.5); };
    if (mapReady) setup(); else S.pendingFit = setup;
    var first = !p;
    startGps();
    onGps(function (pos) {
      B.acc = Math.round(pos.acc); renderBindAcc();
      if (B.mode === 'gps' && !S.moved && first) { pinJump([pos.lon, pos.lat], Math.max(map.getZoom(), 18)); first = false; }
      updateMe();
    });
    if (S.pos) { B.acc = Math.round(S.pos.acc); renderBindAcc(); }
  }
  function renderBindUi() {
    var lay = S.meta.layer || 'scheme', p = B.p, el = $('#bind-sheet'); if (!el) return;
    $('#bind-lay').innerHTML = '<button data-act="bindLayer" data-l="scheme" class="' + (lay === 'scheme' ? 'on' : '') + '">Схема</button><button data-act="bindLayer" data-l="sat" class="' + (lay === 'sat' ? 'on' : '') + '">Супутник</button>';
    var keep = { s: $('#nb-s') ? $('#nb-s').value : '', h: $('#nb-h') ? $('#nb-h').value : '' };
    el.innerHTML = '<div class="seg" style="width:100%;box-shadow:none;background:#F1F1F3;height:44px"><button data-act="bindMode" data-v="gps" class="' + (B.mode === 'gps' ? 'on' : '') + '" style="flex:1;height:36px;font-size:13px">' + 'За GPS</button>' +
        '<button data-act="bindMode" data-v="manual" class="' + (B.mode === 'manual' ? 'on' : '') + '" style="flex:1;height:36px;font-size:13px">Вручну на карті</button></div>' +
      (B.mode === 'gps'
        ? '<div class="row" style="gap:14px"><div class="acc"><b id="accv">—</b><span class="small mute">метри</span></div><div class="col" style="gap:6px;flex-grow:1"><div id="acct" style="font-size:16px;font-weight:800">Шукаю GPS…</div>' +
          '<div class="row" style="gap:4px" id="accbar">' + [1, 2, 3, 4].map(function () { return '<span style="height:6px;flex-grow:1;border-radius:3px;background:#E4E4E7"></span>'; }).join('') + '</div>' +
          '<div class="small mute">Стань біля лічильника. Кнопка активна при ±15 м</div></div></div>'
        : '<div class="small" style="line-height:1.5;font-weight:600">Посуньте карту так, щоб чорна мітка стала на будинок або місце лічильника. На супутнику видно дахи й хвіртки.' +
          (p && p.src ? '<br><span class="mute">Зараз: ' + esc(p.src === 'MAPS.ME' ? 'мітка з MAPS.ME' : p.src) + (p.acc ? ' ±' + Math.round(p.acc) + ' м' : '') + '</span>' : '') + '</div>') +
      (p ? '' : villageRow(bindVillage().v, B.vSet ? 'вибрано вручну' : bindVillage().how, 'bindVillage')) +
      (p ? '' : '<div class="grid2" style="grid-template-columns:2fr 1fr;gap:8px"><input id="nb-s" class="input" placeholder="Вулиця" value="' + esc(keep.s) + '"><input id="nb-h" class="input" inputmode="numeric" data-house="1" autocomplete="off" placeholder="Будинок" value="' + esc(keep.h) + '"></div>') +
      '<button class="btn" id="bindBtn" data-act="doBind">' + icon('pin') + (B.mode === 'gps' ? 'Прив\'язати за GPS' : 'Зберегти тут') + '</button>';
    renderBindAcc();
  }
  function bindVillage() { if (B.vSet) return { v: B.village, how: 'вибрано вручну' }; var c = map ? pinLngLat() : null, pos = B.mode === 'gps' && S.pos ? S.pos : c ? { lat: c.lat, lon: c.lng } : S.pos; return pos ? guessVillage(pos) : { v: newVillage(), how: '' }; }
  function renderBindAcc() {
    var btn = $('#bindBtn'); if (!btn) return;
    if (B.mode !== 'gps') { btn.disabled = false; return; }
    var a = B.acc; btn.disabled = !(a != null && a <= 15);
    if (a == null || !$('#accv')) return;
    var lvl = a <= 5 ? 4 : a <= 10 ? 3 : a <= 15 ? 2 : a <= 40 ? 1 : 0;
    $('#accv').textContent = '±' + a;
    $('#acct').innerHTML = (lvl >= 2 ? dotHtml('g') + ' Точність добра' : lvl === 1 ? dotHtml('y') + ' Слабка — краще вручну' : dotHtml('r') + ' Погана — прив\'яжіть вручну');
    document.querySelectorAll('#accbar span').forEach(function (s, i) { s.style.background = i < lvl ? '#111' : '#E4E4E7'; });
  }
  /* вістря чорної мітки на екрані: мітка стоїть не в центрі карти (42% висоти, вістря внизу),
     тому координати беремо саме з-під вістря, а не центр карти, інакше точка зсувалась нижче */
  function pinPx() {
    var el = document.querySelector('.crosshair'), box = map.getContainer().getBoundingClientRect();
    if (!el) return { x: box.width / 2, y: box.height / 2 };
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height * (50 / 52) - box.top };
  }
  function pinLngLat() { var p = pinPx(); return map.unproject([p.x, p.y]); }
  /* поставити карту так, щоб координата c опинилась під вістрям мітки */
  function pinJump(c, zoom) {
    map.jumpTo({ center: c, zoom: zoom });
    var p = pinPx(), box = map.getContainer().getBoundingClientRect();
    map.panBy([box.width / 2 - p.x, box.height / 2 - p.y], { animate: false });
  }
  function doBind() {
    var c = pinLngLat(), useGps = B.mode === 'gps' && S.pos;
    var lat = useGps ? S.pos.lat : c.lat, lon = useGps ? S.pos.lon : c.lng, acc = useGps ? S.pos.acc : null;
    var src = useGps ? 'GPS' : (S.meta.layer === 'sat' ? 'вручну (супутник)' : 'вручну (карта)');
    var p = B.p;
    if (!p) {
      var s = $('#nb-s').value.trim(), h = $('#nb-h').value.trim();
      var bv = B.vSet ? { v: B.village } : guessVillage({ lat: lat, lon: lon });
      p = { id: newPid(), createdBy: me().id, village: bv.v || null, street: s, house: h, status: 'y', tags: [], note: '',
        created: today(), flags: [].concat(s ? [] : ['no_street'], h ? [] : ['no_house']) };
      p.lat = lat; p.lon = lon;
      if (!dupGuard(p)) return;
      S.points.set(p.id, p);
    } else if (p.lat != null) {
      p.prevPos = { lat: p.lat, lon: p.lon, src: p.src || '', ts: p.bound || null };
    }
    p.lat = +lat.toFixed(6); p.lon = +lon.toFixed(6); p.acc = acc ? Math.round(acc) : null; p.src = src; p.bound = Date.now();
    S.route = null;
    savePoint(p).then(function () { toast('Розташування збережено · ' + src); go('#card/' + p.id); });
  }

  /* ---------- Села ---------- */
  function renderVillages() {
    var vs = villages(), allActive = 0, allRead = 0, vt = S.meta.vTotals || {};
    if (S.vEdit) return renderVillageTotals(vs, vt);
    /* спершу села плану, потім решта за абеткою; «Без села» в кінці */
    var pl = (plan() || {}).villages || [];
    vs = vs.slice().sort(function (a, b) {
      if ((a.name === 'Без села') !== (b.name === 'Без села')) return a.name === 'Без села' ? 1 : -1;
      /* села плану — першими, далі решта; всередині кожної групи за абеткою */
      var pa = pl.indexOf(a.name) >= 0, pb = pl.indexOf(b.name) >= 0; if (pa !== pb) return pa ? -1 : 1;
      return a.name.localeCompare(b.name, 'uk');
    });
    var rows = []; rows = vs.map(function (v) {
      var head = '';
      var ps = villagePoints(v.name === 'Без села' ? null : v.name);
      if (v.name === 'Без села') ps = Array.from(S.points.values()).filter(function (p) { return !p.village; });
      var c = counts(ps), act = ps.filter(function (p) { return p.status !== 'n'; }), rd = act.filter(readThisCycle).length;
      allActive += act.length; allRead += rd;
      var seg = function (s) { return '<span style="flex:' + c[s] + ' 1 0;min-width:' + (c[s] ? 3 : 0) + 'px;background:' + (s === 'n' ? '#fff;box-sizing:border-box;border:1.5px solid #A1A1AA' : ST[s].color) + '"></span>'; };
      var inP = pl.indexOf(v.name) >= 0, R0 = pct(rd, act.length);
      /* заголовки груп: «План місяця» → «Інші села» */
      if (pl.length && inP && !rows.planHead) { rows.planHead = 1; head = '<div class="vgrp">План · ' + monthName().toLowerCase() + '</div>'; }
      if (pl.length && !inP && !rows.restHead) { rows.restHead = 1; head = '<div class="vgrp">Інші села</div>'; }
      return head + '<a class="vrow" href="#village/' + encodeURIComponent(v.name) + '">' +
        '<span class="col" style="flex:1;min-width:0;gap:4px"><span class="row" style="gap:6px;min-width:0"><b class="vname">' + esc(v.name) + '</b>' + '<span class="small mute" style="margin-left:auto;white-space:nowrap">' + fmt(v.n) + ' т.</span></span>' +
        '<span class="bar vbar">' + ST_ORDER.map(seg).join('') + '</span></span>' +
        '<b class="vpct">' + R0 + '%</b>' + icon('right', 16, 2.4) + '</a>';
    });
    var q = queuePoints().length;
    var needBackup = !S.meta.lastBackup || Date.now() - S.meta.lastBackup > 3 * 864e5;
    app.innerHTML = '<div class="screen"><div class="col" style="gap:2px;padding:6px 4px 0"><div class="small mute" style="font-size:13px">Здолбунівська дільниця</div><h1 class="h1">Огляд</h1></div>' +
      /* 1. зведення дільниці: зчитано за норму + план місяця */
      districtCard() +
      /* 2. звіт і бригада поруч; бригада — світло-червона, як на головній */
      brigadeCard() +

      /* наповнення карти — перед списком сіл, темний згорнутий рядок */
      (function () { var c = coverage(); return foldBlock('cov', 'Локації на карті', '<span class="small" style="color:#A1A1AA">' + fmt(c.placed) + ' з ' + fmt(c.total) + ' · ' + pct(c.placed, c.total) + '%</span>', coverageCard(true), 'card fold-card dark-fold'); })() +
      '<div class="small mute" style="padding:8px 4px 0;font-size:13px">Села · смуга — доступ, % — зчитано за ' + NORM() + ' днів</div>' +
      '<div class="card vlist">' + rows.join('') + '</div>' +
      '<button class="btn sec" data-act="newVillage">' + icon('plus', 18) + 'Додати нове село</button></div>' + tabs('villages');
  }
  /* сторінка села з «Огляду»: стан доступу, зчитування, вулиці, хто працював */
  function renderVillage(name) {
    var none = name === 'Без села', ps = none ? Array.from(S.points.values()).filter(function (p) { return !p.village; }) : villagePoints(name);
    var c = counts(ps), act = ps.filter(function (p) { return p.status !== 'n'; }), cm = cycleMap();
    var rd = act.filter(readThisCycle).length, l180 = act.filter(in180).length, vt = (S.meta.vTotals || {})[name];
    var mOk = 0, mNo = 0, by = {}; ps.forEach(function (p) { var x = cm[p.id]; if (!x) return; if (x.result === 'ok') mOk++; else mNo++; var w = x.by || me().id; by[w] = (by[w] || 0) + 1; });
    var q = ps.filter(function (p) { return (p.flags || []).some(function (f) { return QUEUE_FLAGS.indexOf(f) >= 0; }); }).length;
    var st = {}; ps.forEach(function (p) { var k = p.street || 'Без вулиці'; var o = st[k] = st[k] || { n: 0, rd: 0, v: 0, c: { g: 0, y: 0, r: 0, n: 0 } }; o.n++; o.c[p.status]++; if (p.status !== 'n' && readThisCycle(p)) o.rd++; if (cm[p.id]) o.v++; });
    var streets = Object.keys(st).sort(function (a, b) { if ((a === 'Без вулиці') !== (b === 'Без вулиці')) return a === 'Без вулиці' ? 1 : -1; return a.localeCompare(b, 'uk'); });
    var inPl = ((plan() || {}).villages || []).indexOf(name) >= 0, rn = (S.meta.routeNo || {})[name];
    var seg = function (cc, s) { return '<span style="flex:' + cc[s] + ' 1 0;min-width:' + (cc[s] ? 3 : 0) + 'px;background:' + (s === 'n' ? '#fff;box-sizing:border-box;border:1.5px solid #A1A1AA' : ST[s].color) + '"></span>'; };
    var kv = function (k, v) { return '<div class="between" style="font-size:15px"><span class="mute">' + k + '</span><b>' + v + '</b></div>'; };
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col"><div class="small mute">Огляд' + (inPl ? ' · у плані на ' + monthName().toLowerCase() : '') + (rn ? ' · маршрут ' + esc(rn) : '') + '</div><h1 class="h1" style="font-size:26px">' + esc(name) + '</h1></div></div>' +
      '<div class="card" style="gap:12px"><div class="between" style="align-items:flex-end"><div class="col"><span class="small mute">Точок на карті</span><b style="font-size:26px">' + fmt(ps.length) + (vt ? ' <span class="mute" style="font-size:15px;font-weight:600">з ' + fmt(vt) + '</span>' : '') + '</b></div>' + (vt ? '<b style="font-size:22px">' + pct(ps.length, vt) + '%</b>' : '') + '</div>' +
        '<div class="bar" style="height:10px">' + ST_ORDER.map(function (s2) { return seg(c, s2); }).join('') + '</div>' +
        '<div class="col" style="gap:8px">' + ST_ORDER.map(function (s2) { return '<div class="between" style="font-size:15px"><span class="row" style="gap:8px">' + dotHtml(s2) + ST[s2].label + '</span><b>' + c[s2] + ' <span class="mute" style="font-weight:600;margin-left:4px">· ' + pct(c[s2], ps.length) + '%</span></b></div>'; }).join('') + '</div></div>' +
      '<div class="card" style="gap:10px"><div class="h2" style="font-size:16px">Зчитування</div>' +
        kv('Зчитано за ' + NORM() + ' днів', fmt(rd) + ' з ' + fmt(act.length) + ' · ' + pct(rd, act.length) + '%') +
        kv('У «Списку ' + NORM() + '»', fmt(l180)) +
        kv(monthName() + ': зчитано', fmt(mOk)) + kv(monthName() + ': без показника', fmt(mNo)) +
        (Object.keys(by).length ? '<div class="small mute" style="padding-top:4px">Хто працював у ' + monthName().toLowerCase() + '</div>' + Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) { return kv(esc(whoName(k)), fmt(by[k])); }).join('') : '') + '</div>' +
      (q ? '<a class="card" href="#queue" style="gap:4px"><div class="between"><b>Уточнити в полі</b><span class="numbadge" style="background:#F59E0B;color:#111">' + q + '</span></div><span class="small mute">Без вулиці, номера, можливі дублі</span></a>' : '') +
      '<div class="card" style="gap:0;padding:8px 16px"><div class="between" style="padding:6px 0 8px"><div class="h2" style="font-size:16px">Вулиці · ' + streets.length + '</div><span class="small mute">зчитано</span></div>' + streets.map(function (k) { var o = st[k], a2 = o.n - o.c.n;
        return '<div class="list-row" style="flex-direction:column;align-items:stretch;gap:6px"><div class="between"><b style="font-size:15px">' + esc(k) + '</b><span class="small"><b>' + pct(o.rd, a2) + '%</b> <span class="mute">· ' + o.n + ' точок</span></span></div><div class="bar" style="height:6px">' + ST_ORDER.map(function (s2) { return seg(o.c, s2); }).join('') + '</div></div>'; }).join('') + '</div>' +
      (none ? '' : '<button class="btn" data-act="pickVillage" data-v="' + esc(name) + '" data-stay="1">' + icon('map', 18) + 'Відкрити на карті</button>' +
        '<button class="btn sec" data-act="delVillage" data-v="' + esc(name) + '" style="color:#B91C1C">Видалити населений пункт</button>') +
      '</div>' + tabs('villages');
  }
  /* видалення села: 1) вибір, що робити з точками; 2) підтвердження введенням назви */
  function delVillage(name) {
    var ps = villagePoints(name), n = ps.length;
    var step2 = function (mode) {
      var typed = prompt('Друге підтвердження.\n' + (mode === 'all' ? 'Буде видалено село «' + name + '» і ' + n + ' точок разом з ним. Це не можна скасувати.' : 'Село «' + name + '» буде видалено, ' + n + ' точок перейдуть у «Без села».') + '\n\nВведіть назву села, щоб підтвердити:');
      if (typed == null) return;
      if (typed.trim().toLowerCase() !== name.toLowerCase()) return toast('Назва не збігається, нічого не видалено');
      var jobs = [], tb = Object.assign({}, S.meta.deleted || {}), now = Date.now();
      ps.forEach(function (p) {
        if (mode === 'all') { tb[p.id] = now; S.points.delete(p.id); jobs.push(del('points', p.id)); }
        else { p.village = null; p.flags = (p.flags || []).filter(function (f) { return f !== 'no_village'; }).concat(['no_village']); jobs.push(savePoint(p)); }
      });
      var dv = Object.assign({}, S.meta.deletedVillages || {}); dv[name] = now;
      var pl = S.meta.plan ? Object.assign({}, S.meta.plan, { villages: (S.meta.plan.villages || []).filter(function (v) { return v !== name; }), updated: now }) : null;
      var strip = function (k) { var o = Object.assign({}, S.meta[k] || {}); delete o[name]; return setMeta(k, o); };
      jobs.push(setMeta('deleted', tb), setMeta('deletedVillages', dv), setMeta('extraVillages', (S.meta.extraVillages || []).filter(function (v) { return v !== name; })),
        strip('vTotals'), strip('routeNo'), strip('splits'));
      if (pl) jobs.push(shareSet('plan', pl));
      if (S.meta.village === name) jobs.push(setMeta('village', null));
      Promise.all(jobs).then(function () { S.route = null; invalidate(); scheduleSync(); toast('Село «' + name + '» видалено' + (n ? mode === 'all' ? ' разом з ' + n + ' точками' : ', точки в «Без села»' : '')); go('#villages'); });
    };
    if (!n) return step2('empty');
    openSheet('Видалити «' + name + '»', [
      { v: 'move', l: 'Видалити село, точки залишити', sub: n + ' точок перейдуть у «Без села», їх можна буде перенести в інше село' },
      { v: 'all', l: 'Видалити село разом з ' + n + ' точками', sub: 'точки зникнуть з карти в усіх після синхронізації' }
    ], null, function (v) { step2(v); });
  }
  function renderVillageTotals(vs, vt) {
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="vEdit" aria-label="Готово">' + icon('back', 20, 2.4) + '</button><h1 class="h1" style="font-size:24px">Абонентів по селах</h1></div>' +
      '<div class="small mute" style="line-height:1.5;padding:0 4px">Скільки абонентів є за даними обленерго. Від цього рахується відсоток внесених локацій. Порожнє — не враховується по селу.</div>' +
      '<div class="card"><div class="field"><label for="tot">Уся дільниця</label><input id="tot" class="input" inputmode="numeric" value="' + (Number(S.meta.totalSubs) || TOTAL_DEFAULT) + '"></div></div>' +
      '<div class="card" style="gap:0;padding:6px 16px">' + vs.filter(function (v) { return v.name !== 'Без села'; }).map(function (v) {
        return '<div class="list-row"><div class="col" style="flex-grow:1"><b>' + esc(v.name) + '</b><span class="small mute">на карті ' + v.n + '</span></div>' +
          '<input class="input" data-vt="' + esc(v.name) + '" inputmode="numeric" value="' + (vt[v.name] || '') + '" placeholder="—" style="width:110px;height:46px"></div>';
      }).join('') + '</div><button class="btn" data-act="vEditSave">Зберегти</button></div>' + tabs('villages');
  }
  function queuePoints() { var out = []; S.points.forEach(function (p) { if ((p.flags || []).some(function (f) { return QUEUE_FLAGS.indexOf(f) >= 0; })) out.push(p); }); return out; }
  var QF = null;
  function renderQueue() {
    var qp = queuePoints(), c = {}, cur = village() && village() !== ALL ? village() : null;
    qp.forEach(function (p) { p.flags.forEach(function (f) { if (QUEUE_FLAGS.indexOf(f) >= 0) c[f] = (c[f] || 0) + 1; }); });
    var list = qp.filter(function (p) { return !QF || p.flags.indexOf(QF) >= 0; });
    var ref = S.pos || centroid(villagePoints().length ? villagePoints() : qp);
    /* групи за селами: вибране село першим, далі за абеткою; всередині — за відстанню */
    var g = {}; list.forEach(function (p) { var k = p.village || 'Без села'; (g[k] = g[k] || []).push(p); });
    var keys = Object.keys(g).sort(function (a2, b2) { if (a2 === cur) return -1; if (b2 === cur) return 1; return ukSort(a2, b2); });
    var row = function (p) { return '<a class="list-row" href="#card/' + p.id + '">' + dotHtml(p.status) + '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(addr(p)) + '</b><span class="small mute">' + p.flags.filter(function (f) { return QUEUE_FLAGS.indexOf(f) >= 0; }).map(function (f) { return FLAGNAME[f]; }).join(', ') + '</span></div>' + (S.pos ? '<span class="small">' + fdist(dist(ref, p)) + '</span>' : '') + '</a>'; };
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><h1 class="h1" style="font-size:24px">Уточнити в полі</h1></div>' +
      '<div class="tags"><button class="chip' + (!QF ? ' on' : '') + '" data-act="qf" data-v="">Усі · ' + qp.length + '</button>' + QUEUE_FLAGS.filter(function (f) { return c[f]; }).map(function (f) {
        return '<button class="chip' + (QF === f ? ' on' : '') + '" data-act="qf" data-v="' + f + '">' + FLAGNAME[f] + ' · ' + c[f] + '</button>';
      }).join('') + '</div>' +
      keys.map(function (k, i) {
        var ps = g[k].sort(function (a2, b2) { return dist(ref, a2) - dist(ref, b2); }), open = k === cur || (i === 0 && !cur);
        return '<details class="card fold-card"' + (open ? ' open' : '') + '><summary><span class="row" style="gap:10px"><b>' + esc(k) + '</b>' + (k === cur ? '<span class="chip" style="height:22px;font-size:11px;padding:0 8px">вибране</span>' : '') + '</span><span class="row" style="gap:8px"><span class="numbadge" style="background:#F59E0B;color:#111">' + ps.length + '</span>' + icon('down', 18, 2.4) + '</span></summary>' +
          '<div class="fold-body" style="gap:0">' + ps.slice(0, 100).map(row).join('') + (ps.length > 100 ? '<div class="small mute" style="padding-top:8px">Показано 100 з ' + ps.length + '</div>' : '') + '</div></details>';
      }).join('') + '</div>' + tabs('villages');
  }

  /* ---------- Бригада: проблемні точки після обходу ----------
     Причини беруться з останньої відмітки з показником (пломби, ЗКО, сигнал тривоги, примітка) і з даних точки.
     Стан задачі: нова → передано бригаді → виконано. Якщо після «виконано» знову знайшли проблему — задача повертається як нова. */
  var BR_NOTES = ['Самовільне підключення', 'Не працює 1-ф лічильник', 'Не працює 3-ф лічильник', 'Відсутня/порушена пломба ДП на лічильнику', 'Відсутня/порушена пломба постачальника на клемній', 'Відсутня/порушена пломба постачальника на ввідному'];
  /* причини з однієї відмітки (і для синхронізації: йдуть на сервер без ПІБ і показників) */
  function visitWhy(v) {
    if (!v) return []; if (v.br) return v.br.slice();
    var why = []; (v.sealList || []).forEach(function (x) { if (x.st === 'Відсутня' || x.st === 'Пошкоджена') why.push('Пломба ' + x.st.toLowerCase() + (x.n ? ' ' + x.n : '') + (x.place ? ' (' + x.place.toLowerCase() + ')' : '')); });
    var fm = v.form || {}; if (fm.zko && fm.zko !== 'Без зауважень') why.push('ЗКО: ' + fm.zko.toLowerCase()); if (fm.alarm === 'Так') why.push('Сигнал тривоги на лічильнику');
    var nt = (fm.noteSel || '') + ' ' + (v.note || ''); BR_NOTES.forEach(function (n) { if (nt.indexOf(n) >= 0 && why.indexOf(n) < 0) why.push(n); });
    return why;
  }
  var RUIN_WHY = 'Аварійний будинок: ніхто не живе, загроза обриву проводів';
  function brigadeIssue(p) {
    var f = p.fields || {}, vs = visitsOf(p.id).filter(function (v) { return (v.form || v.sealList || v.br) && v.result !== 'note'; }), v = vs[0], why = [];
    var ruin = (p.tags || []).indexOf('ruin') >= 0 ? RUIN_WHY : null;
    if (v) { why = visitWhy(v); if (ruin) why.unshift(ruin); return why.length ? { p: p, why: why, ts: Math.max(v.ts, ruin ? p.ruinTs || 0 : 0), by: v.by } : null; }
    if (ruin) why.push(ruin);
    var L = v && v.sealList ? v.sealList : (f.sealList || []);
    L.forEach(function (x) { if (x.st === 'Відсутня' || x.st === 'Пошкоджена') why.push('Пломба ' + x.st.toLowerCase() + (x.n ? ' ' + x.n : '') + (x.place ? ' (' + x.place.toLowerCase() + ')' : '')); });
    if (!why.length && /Відсутня|Пошкоджена/.test(f.seals || '')) why.push(f.seals);
    var zko = (v && v.form && v.form.zko) || f.zko; if (zko && zko !== 'Без зауважень') why.push('ЗКО: ' + zko.toLowerCase());
    var al = (v && v.form && v.form.alarm) || f.alarm; if (al === 'Так') why.push('Сигнал тривоги на лічильнику');
    var nt = ((v && v.form && v.form.noteSel) || '') + ' ' + ((v && v.note) || ''); BR_NOTES.forEach(function (n) { if (nt.indexOf(n) >= 0 && why.indexOf(n) < 0) why.push(n); });
    if (!why.length) return null;
    return { p: p, why: why, ts: v ? v.ts : (ruin && p.ruinTs) || p.updated || 0, by: v ? v.by : p.by };
  }
  function brigadeList() {
    var st = S.meta.brigade || {}, out = { new: [], sent: [], done: [] };
    S.points.forEach(function (p) {
      var it = brigadeIssue(p); if (!it) return;
      var s = st[p.id];
      if (!s || it.ts > s.ts) out.new.push(it); else { it.state = s; (s.st === 'done' ? out.done : out.sent).push(it); }
    });
    ['new', 'sent', 'done'].forEach(function (k) { out[k].sort(function (a, b) { return ukSort(a.p.village || 'Без села', b.p.village || 'Без села') || (b.ts - a.ts); }); });
    return out;
  }
  var BRT = 'new';
  function renderBrigade() {
    var L = brigadeList(), list = L[BRT], seg = [['new', 'Нові'], ['sent', 'Передано'], ['done', 'Виконано']];
    var g = {}; list.forEach(function (it) { var k = it.p.village || 'Без села'; (g[k] = g[k] || []).push(it); });
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><div class="col"><div class="small mute">Пломби, ЗКО, аварійні будинки</div><h1 class="h1" style="font-size:24px">Викликати бригаду</h1></div></div>' +
      '<div class="seg segw" style="background:#fff;box-shadow:none;height:48px">' + seg.map(function (t) { return '<button data-act="brT" data-v="' + t[0] + '" class="' + (BRT === t[0] ? 'on' : '') + '" style="height:40px">' + t[1] + ' · ' + L[t[0]].length + '</button>'; }).join('') + '</div>' +
      (list.length ? Object.keys(g).sort(ukSort).map(function (k) {
        return '<div class="small mute" style="padding:6px 4px 0;font-size:13px;font-weight:700">' + esc(k) + ' · ' + g[k].length + '</div><div class="card" style="gap:0;padding:4px 16px">' + g[k].map(function (it) {
          var p = it.p;
          return '<div class="list-row" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px 0">' +
            '<a class="between" href="#card/' + p.id + '" style="color:inherit;text-decoration:none"><div class="col" style="min-width:0;gap:2px"><b style="font-size:16px">' + esc(addr(p)) + '</b><span class="small mute">' + (p.fields && p.fields.serial ? '№ ' + esc(p.fields.serial) + ' · ' : '') + (it.ts ? dt(it.ts) : '') + (it.by ? ' · ' + esc(whoName(it.by)) : '') + '</span></div>' + icon('right', 16, 2.4) + '</a>' +
            '<div class="tags">' + it.why.map(function (w) { return '<span class="chip" style="background:#FEE2E2;color:#991B1B;height:auto;min-height:28px;white-space:normal;padding:4px 10px">' + esc(w) + '</span>'; }).join('') + '</div>' +
            (BRT === 'new' ? '<button class="btn sec" data-act="brSet" data-v="sent" data-id="' + p.id + '" style="height:44px">Передано бригаді</button>' :
             BRT === 'sent' ? '<div class="grid2" style="gap:8px"><button class="btn" data-act="brSet" data-v="done" data-id="' + p.id + '" style="height:44px">Виконано</button><button class="btn sec" data-act="brSet" data-v="" data-id="' + p.id + '" style="height:44px">Повернути в нові</button></div>' :
             '<div class="small mute">Виконано ' + dt(it.state.ts) + (it.state.by ? ' · ' + esc(whoName(it.state.by)) : '') + '</div>') + '</div>';
        }).join('') + '</div>';
      }).join('') : '<div class="card"><div class="small mute" style="padding:8px 0">' + (BRT === 'new' ? 'Нових проблемних точок немає. Вони з\'являються самі, коли під час зчитування відмічено відсутню чи пошкоджену пломбу, зауваження до ЗКО, сигнал тривоги, несправність лічильника, або точку позначено міткою «Аварійний будинок».' : 'Порожньо') + '</div></div>') +
      (list.length && BRT !== 'done' ? '<div class="grid2" style="gap:8px"><button class="btn sec" data-act="brShare">Надіслати список</button><button class="btn sec" data-act="brCsv">Таблиця Excel</button></div>' : '') +
      '</div>' + tabs('villages');
  }
  function brSet(id, st) {
    var m = Object.assign({}, S.meta.brigade || {});
    if (!st) delete m[id]; else m[id] = { st: st, ts: Date.now(), by: me().id };
    setMeta('brigade', m).then(function () { scheduleSync(); toast(st === 'sent' ? 'Позначено: передано бригаді' : st === 'done' ? 'Позначено: виконано' : 'Повернуто в нові'); var y = window.scrollY; render(); window.scrollTo(0, y); });
  }
  function brText() {
    var L = brigadeList()[BRT];
    return 'Викликати бригаду · ' + dt(Date.now()) + ' · ' + L.length + ' адрес\n\n' + L.map(function (it, i) {
      var f = it.p.fields || {};
      return (i + 1) + '. ' + (it.p.village || 'Без села') + ', ' + addr(it.p) + (f.serial ? ' · № ' + f.serial : '') + '\n   ' + it.why.join('; ');
    }).join('\n');
  }
  function brShare() {
    var t = brText();
    if (navigator.share) navigator.share({ title: 'Викликати бригаду', text: t }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Список скопійовано'); });
  }
  function brCsv() {
    var rows = [['Село', 'Адреса', '№ лічильника', 'ПІБ', 'Причини', 'Дата', 'Хто', 'Стан']];
    brigadeList()[BRT].forEach(function (it) { var f = it.p.fields || {}; rows.push([it.p.village || '', addr(it.p), f.serial || '', f.fio || '', it.why.join('; '), it.ts ? dt(it.ts) : '', it.by ? whoName(it.by) : '', BRT === 'new' ? 'нова' : BRT === 'sent' ? 'передано' : 'виконано']); });
    download('kontroler-bryhada-' + today() + '.csv', '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n'), 'text/csv;charset=utf-8');
  }
  function brigadeCard() {
    /* картка завжди на головній і завжди в червоному стилі: одразу видно, що це про проблеми */
    var L = brigadeList(), n = L.new.length, sent = L.sent.length;
    return '<a href="#brigade" class="card" style="gap:6px;background:#FEF2F2"><div class="row" style="gap:12px;align-items:center"><span class="hico" style="background:#FEE2E2;color:#B91C1C">' + icon('alert', 22) + '</span><div class="col" style="flex:1;gap:2px"><span class="small mute" style="font-size:13px">Пломби, ЗКО, аварійні будинки</span><b style="font-size:17px">Викликати бригаду' + (n ? ' · ' + n : '') + '</b>' +
      (!n ? '<span class="small mute">нових немає' + (sent ? ' · передано бригаді ' + sent : '') + '</span>' : sent ? '<span class="small mute">ще передано бригаді ' + sent + '</span>' : '') + '</div>' + icon('right', 18, 2.4) + '</div></a>';
  }

  /* ---------- екран не гасне під час обходу (Wake Lock) ---------- */
  var wakeLock = null;
  function wantAwake() { return document.visibilityState === 'visible' && /^#(map|all|card|read|bind)/.test(location.hash || '') && S.meta.keepAwake !== false; }
  function syncWake() {
    if (!('wakeLock' in navigator)) return;
    if (wantAwake()) { if (!wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {}); }
    else if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
  }

  /* ---------- встановлення як застосунок ---------- */
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (/^#(home|me)?$/.test(location.hash || '')) bgRender(); });
  window.addEventListener('appinstalled', function () { installEvt = null; setMeta('installed', Date.now()); toast('Застосунок встановлено'); });
  function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function installCard(compact) {
    if (isStandalone()) return '';
    if (compact && S.meta.installHide) return '';
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!installEvt && !ios && compact) return '';
    return '<div class="card" style="gap:10px"><div class="row" style="gap:12px;align-items:center"><span class="hico">' + icon('home', 22) + '</span><div class="col" style="flex:1;gap:2px"><b style="font-size:16px">Встановити на телефон</b><span class="small mute">Іконка на головному екрані, на весь екран, без браузера</span></div>' +
      (compact ? '<button class="seal-x" data-act="installHide" aria-label="Сховати">' + icon('close', 14, 2.4) + '</button>' : '') + '</div>' +
      (installEvt ? '<button class="btn" data-act="install">Встановити</button>' : ios ? '<div class="small" style="line-height:1.5">У Safari: кнопка «Поділитися» ⬆️ → «На початковий екран».</div>' : '<div class="small" style="line-height:1.5">У Chrome: меню ⋮ → «Додати на головний екран» або «Встановити застосунок».</div>') + '</div>';
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
        if (!LQ) { if (village() === ALL || p.village === village()) res.push(p); return; }
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
  /* «Я»: спершу те, чим користуються щодня (мої дані, обмін), далі налаштування обходу, внизу — рідкісне (таблиці, офлайн-карта, копія) */
  /* норма зчитування — налаштування всієї дільниці, окремо від щоденної цілі */
  function normHtml() {
    var nd = NORM();
    return '<div class="col" style="gap:8px"><div class="small mute">Норма зчитування: хто не зчитаний довше, іде в «Список ' + nd + '»</div>' +
      '<div class="tags">' + [90, 180, 365].map(function (c) { return '<button class="chip fchip' + (nd === c ? ' on' : '') + '" data-act="cycle" data-v="' + c + '">' + c + ' днів</button>'; }).join('') + '</div></div>';
  }
  /* згортаний блок; стан (відкрито/закрито) пам'ятаємо, поки застосунок відкритий */
  function foldBlock(key, title, side, body, cls) {
    var o = (S.meFold || {})[key];
    return '<details class="' + (cls || 'card fold-card') + '" data-fold="' + key + '"' + (o ? ' open' : '') + '><summary><span class="row" style="gap:10px;min-width:0"><b>' + title + '</b>' + (side || '') + '</span>' + icon('down', 18, 2.4) + '</summary><div class="fold-body">' + body + '</div></details>';
  }
  function routeCardHtml() {
    var nd = NORM();
    var gh = goalHint(), g = routeCfg().limit;
    return '<div class="card"><div class="h2">Ціль на день</div>' + sliderHtml('dl', g, 'Адрес зі знятим показником') +
      '<div class="small mute">Стільки найближчих адрес у маршруті на карті. Прогрес видно на картці «Почати обхід».</div>' +
      (gh ? '<div class="between" style="background:#F6F6F7;border-radius:14px;padding:10px 12px;gap:10px"><span class="small">Щоб закрити план за ' + gh.days + ' роб. дн.: ≈ <b>' + gh.raw + '</b> на кожного з ' + gh.crew + '</span>' +
        (g === gh.n ? '<span class="small mute">стоїть</span>' : '<button class="chip" data-act="goalSet" data-v="' + gh.n + '">Поставити ' + gh.n + '</button>') + '</div>' : '') +
      '</div>';
  }
  function settingsBody(inMe) {
    var persisted = S.meta._persist, peers = S.meta.peers || {}, off = S.meta.offline, nd = NORM();
    var mine = S.visits.filter(function (v) { return v.by === me().id || !v.by; }).length;
    var sec = function (t) { return '<div class="small mute" style="padding:8px 4px 0;font-size:13px">' + t + '</div>'; };
    var exchange = '<div class="sync-sub" style="border-top:1px solid var(--bg);padding-top:14px">' + icon('user', 18) + '<b>Без інтернету</b></div>' +
        '<div class="grid2" style="gap:8px"><button class="btn sec" data-act="syncOut" style="height:50px">Надіслати</button>' +
        '<label class="btn sec" for="imp3" style="height:50px">Прийняти</label></div><input id="imp3" type="file" accept="application/json,application/octet-stream,text/plain,.json" hidden>';
    var pk = Object.keys(peers).filter(function (k) { return !peers[k].local; });
    var team = pk.length ? '<div class="sync-sub" style="border-top:1px solid var(--bg);padding-top:14px"><b>Колеги · ' + pk.length + '</b></div><div class="col" style="gap:0">' + pk.map(function (k) { var x = peers[k];
          return '<div class="list-row" style="padding:8px 0">' + icon('user', 18) + '<div class="col" style="flex-grow:1;min-width:0"><b>' + esc(x.name) + '</b><span class="small mute">' + (x.last ? fmt(x.visits || 0) + ' відміток · ' + dt(x.last) : 'ще не надсилав сам') + '</span></div>' +
            '<button class="seal-x" data-act="peerDel" data-v="' + esc(k) + '" aria-label="Прибрати ' + esc(x.name) + '">' + icon('close', 14, 2.4) + '</button></div>'; }).join('') + '</div>' : '';
    var syncCard = '<div class="card" style="gap:12px"><div class="between"><div class="row" style="gap:10px">' + icon('sync', 22) + '<div class="h2">Синхронізація</div></div>' + infoBtn('sync') + '</div>' + ghCard() + foldBlock('xch', 'Обмін без інтернету' + (pk.length ? ' · колеги (' + pk.length + ')' : ''), '', exchange + team, 'fold-card fold-in') + '</div>';
    var route = routeCardHtml();
    var tables = '<div class="card"><div class="row" style="gap:10px">' + icon('table', 22) + '<div class="h2">Таблиці для Excel</div></div>' +
        '<button class="btn sec" data-act="csvPoints">Абоненти: адреси, статуси, показники</button>' +
        '<button class="btn sec" data-act="csvVisits">Журнал відміток</button>' +
        '<button class="btn sec" data-act="kml">Карта в KML (MAPS.ME, Google)</button></div>';
    /* підготовка до виїзду: два рядки — схема дільниці і супутник по селах; стан — зеленим/жовтим, дія — праворуч */
    var offline = '<div class="prow2"><span class="prow2-ic">' + icon('map', 20) + '</span><span class="col" style="flex:1;min-width:0;gap:2px"><b>Схема вулиць</b>' +
        '<span class="small" id="off-st" style="' + (off ? 'color:#15803D' : 'color:#B45309') + ';font-weight:700">' + (off ? '✓ уся дільниця · ' + dt(off.ts) + (off.fail ? ' · не вдалося ' + off.fail : '') : 'не збережено') + '</span></span>' +
        '<button class="chip pchip" data-act="offline">' + (off ? 'Оновити' : 'Зберегти') + '</button></div>';
    offline += satCard();
    var backup = '<div class="card"><div class="between"><div class="h2">Резервна копія</div><span class="small ' + (S.meta.lastBackup ? 'mute' : '') + '" style="' + (S.meta.lastBackup ? '' : 'color:#B45309') + '">' + (S.meta.lastBackup ? 'остання ' + dt(S.meta.lastBackup) : 'ще не робили') + '</span></div>' +
        '<button class="btn" data-act="backup">Зберегти копію (з фото)</button>' +
        '<label class="btn sec" for="imp2">Відновити з файлу</label><input id="imp2" type="file" accept="application/json,application/octet-stream,text/plain,.json" hidden>' +
        '<div class="small mute" style="line-height:1.5">На телефоні ' + fmt(S.points.size) + ' точок і ' + fmt(S.visits.length) + ' відміток. Вони зберігаються лише тут' + (persisted ? ', захист від автоочищення браузером увімкнено' : '') + '. Робіть копію хоча б раз на кілька днів.</div></div>';
    var phone = installCard(false) + '<div class="col" style="gap:8px"><button class="opt' + (S.meta.keepAwake !== false ? ' on' : '') + '" data-act="keepAwake" style="flex-direction:row;align-items:center;justify-content:space-between;min-height:56px"><span class="col" style="gap:2px;text-align:left"><b style="font-size:15px">Екран не гасне під час обходу</b><small>на карті і в картці абонента</small></span><span class="sw' + (S.meta.keepAwake !== false ? ' on' : '') + '"></span></button></div>';
    /* «Я»: щоденне розгорнуте (синхронізація, підготовка до виїзду), рідкісне — у згорнутих «Налаштування» і «Дані та копія» */
    var prep = '<div class="card" style="gap:4px"><div class="col" style="gap:2px;padding-bottom:6px"><div class="h2">Підготовка до виїзду</div><span class="small mute">щоб карта працювала в селі без інтернету, краще через Wi-Fi</span></div>' + offline + '</div>';
    var oldBk = !S.meta.lastBackup || Date.now() - S.meta.lastBackup > 3 * 864e5;
    var bkSide = '<span class="small" style="' + (oldBk ? 'color:#B45309;font-weight:700' : 'color:#71717A') + '">' + (S.meta.lastBackup ? 'копія ' + dt(S.meta.lastBackup) : 'копії ще немає') + '</span>';
    return syncCard + prep +
      foldBlock('set', 'Налаштування', '', (inMe ? '' : route) + normHtml() + phone) +
      foldBlock('data', 'Дані та копія', bkSide, '<div class="prep">' + backup + tables + '</div>' +
        '<button class="btn sec" data-act="chkUpd">' + icon('sync', 18) + 'Перевірити оновлення · v' + VERSION + '</button>' +
        '<div class="small mute">Версія ' + VERSION + ' · пристрій ' + esc(dev()) + ' · карта © OpenStreetMap, супутник © Esri</div>');
  }
  function bindSettings() {
    if ($('#imp2')) $('#imp2').onchange = importFile; if ($('#imp3')) $('#imp3').onchange = importFile;
    bindSlider('dl', function (n) { setLimit(n).then(function () { toast('Ціль на день: ' + limLabel(n) + ' адрес'); var y = window.scrollY; render(); window.scrollTo(0, y); }); });
  }
  function renderSettings() {
    if (S.points.size && me().login) return location.replace('#me');
    app.innerHTML = '<div class="screen"><div class="row"><button class="iconbtn" data-act="back" aria-label="Назад">' + icon('back', 20, 2.4) + '</button><h1 class="h1" style="font-size:24px">Дані й налаштування</h1></div>' + settingsBody(false) + '</div>';
    bindSettings();
  }

  /* ---------- події ---------- */
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    switch (a) {
      case 'goalSet': var gn = +el.getAttribute('data-v'); setLimit(gn).then(function () { toast('Ціль: ' + gn + ' адрес на день'); var y = window.scrollY; render(); window.scrollTo(0, y); }); break;
      case 'startRoute': S.filter = null; S.route = computeRoute(); S.sel = S.route && S.route.ids[0]; renderMap.fitNext = true; if (S.route && !S.route.ids.length && !S.route.off) toast(routeCfg().round === '180' ? 'Немає адрес кола ' + NORM() + ' на сьогодні в цьому селі' : 'Усі адреси цього місяця вже пройдені'); break;
      case 'filter': e.preventDefault(); var st = el.getAttribute('data-st'); S.filter = S.filter === st ? null : st; S.sel = null;
        if (location.hash !== '#map') go('#map'); else { updateMap(); renderMap.fitNext = false; render(); fitTo(villagePoints().filter(function (p) { return !S.filter || stMatch(p, S.filter); })); } break;
      case 'locate': if (S.pos) { updateMe(); if (mapMode === 'bind') { S.moved = true; pinJump([S.pos.lon, S.pos.lat], Math.max(map.getZoom(), 18)); } else map.easeTo({ center: [S.pos.lon, S.pos.lat], zoom: Math.max(map.getZoom(), 16.5) }); if (S.pos.stale) toast('Остання відома позиція (сіра). GPS ще шукає супутники'); } else gpsWhy(); break;
      case 'layer': setLayer(el.getAttribute('data-l')); render(); break;
      case 'skip': S.skipped[S.sel] = 1; S.route = computeRoute(); S.sel = S.route && S.route.ids[0]; updateMap(); renderSheet(); toast('Адресу пропущено до кінця дня'); break;
      case 'saveCard': saveCard(id); break;
      case 'deletePoint': if (confirm('Видалити цю точку? Візити теж зникнуть з карти.')) { S.points.delete(id); S.route = null; var tb = Object.assign({}, S.meta.deleted || {}); tb[id] = Date.now(); setMeta('deleted', tb); del('points', id).then(function () {
          toast('Точку видалено'); if (S.sel === id) S.sel = null; S.lastQuick = null;
          /* лишаємось там, звідки відкрили картку: Обхід, Мітки, Огляд села… */
          var st = S.nav || []; while (st.length && st[st.length - 1].indexOf(id) >= 0) st.pop();
          var prev = st[st.length - 1] || '#map'; renderMap.fitNext = false; if (location.hash === prev) render(); else location.hash = prev;
        }); } break;
      case 'toggleHist': var h = $('#hist'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; el.querySelector('svg').style.transform = h.style.display === 'none' ? '' : 'rotate(180deg)'; break;
      case 'saveReading': saveReading(id); break;
      case 'res': V.res = el.getAttribute('data-v'); if (V.res === 'empty') V.prof = 'n'; renderVisitKeep(); break;
      case 'prof': V.prof = el.getAttribute('data-v'); renderVisitKeep(); break;
      case 'vtag': var t = el.getAttribute('data-v'), i = V.tags.indexOf(t); if (i >= 0) V.tags.splice(i, 1); else V.tags.push(t); renderVisitKeep(); break;
      case 'saveVisit': saveVisit(id); break;
      case 'doBind': doBind(); break;
      case 'pickVillage': var v = el.getAttribute('data-v'), stay = el.getAttribute('data-stay'); setMeta('village', v === 'Без села' ? null : v).then(function () { S.route = null; S.sel = null; S.filter = null; renderMap.fitNext = true; go(stay ? '#map' : '#home'); }); break;
      case 'vEdit': S.vEdit = !S.vEdit; render(); break;
      case 'vEditSave': var vt2 = {}; document.querySelectorAll('[data-vt]').forEach(function (x) { var n = parseInt(x.value, 10); if (n > 0) vt2[x.getAttribute('data-vt')] = n; });
        var tot = parseInt($('#tot').value, 10); Promise.all([shareSet('vTotals', vt2), shareSet('totalSubs', tot > 0 ? tot : TOTAL_DEFAULT)]).then(function () { S.vEdit = false; toast('Збережено'); render(); }); break;
      case 'round': var rc = Object.assign({}, S.meta.routeCfg || {}); rc.round = el.getAttribute('data-v'); setMeta('routeCfg', rc).then(function () { S.route = null; S.sel = null; renderMap.fitNext = true; render(); }); break;
      case 'dupMerge': if (confirm('Об\'єднати дві точки в одну? Візити, фото й дані перейдуть у цю картку.')) mergeDup(id, el.getAttribute('data-o')); break;
      case 'dupNo': notDup(id, el.getAttribute('data-o')); break;
      case 'login': loginSubmit(); break;
      case 'loginAs': var lu = (S.meta.users || []).filter(function (x) { return x.id === el.getAttribute('data-v'); })[0]; if (lu) doLogin(lu); break;
      case 'logout': setMeta('me', Object.assign({}, me(), { login: false })).then(function () { go('#login'); }); break;
      case 'myPoints': setMeta('allF', { st: [], cy: [], mine: true }).then(function () { go('#all'); }); break;
      case 'allWho': var nf = Object.assign({ st: [], cy: [] }, S.meta.allF || {}); nf.mine = false; nf.who = el.getAttribute('data-v') || null; setMeta('allF', nf); renderAll.fitNext = true; render(); break;
      case 'whoMap': setMeta('allF', { st: [], cy: [], who: el.getAttribute('data-v') }).then(function () { setMeta('allMin', true); renderAll.fitNext = true; go('#all'); }); break;
      case 'allMine': setMeta('allF', Object.assign({ st: [], cy: [] }, S.meta.allF || {}, { mine: !(S.meta.allF || {}).mine })); render(); break;
      case 'addVillage': pickVillageFor(S.adding.village, function (v) { S.adding.village = v || null; S.adding.vSet = true; renderSheet(); }); break;
      case 'bindVillage': pickVillageFor(bindVillage().v, function (v) { B.village = v || null; B.vSet = true; renderBindUi(); }); break;
      case 'newVillage': addVillage(function () { render(); }); break;
      case 'ctab': S.cardTab = el.getAttribute('data-v');
        document.querySelectorAll('.cpane').forEach(function (x) { x.style.display = x.getAttribute('data-pane') === S.cardTab ? '' : 'none'; });
        document.querySelectorAll('.ctabs button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-v') === S.cardTab); }); break;
      case 'back': goBack(); break;
      case 'aqPick': var ap = S.points.get(id); AQ = '';
        if (mapMode === 'route' && ap && village() !== ALL && ap.village !== village()) { S.meta.village = ap.village || null; setMeta('village', ap.village || null); S.route = null; }
        if (mapMode !== 'route') { setMeta('allF', { st: [], cy: [] }); setMeta('allMin', true); }
        S.sel = id; renderAll.fitNext = false; renderMap.fitNext = false; render(); if (ap) fitTo([ap]); break;
      case 'aqClear': AQ = ''; render(); break;
      case 'search': S.focusSearch = true; go('#all'); break;
      case 'quick': if (el.getAttribute('data-v') === 'ok') go('#read/' + id); else quickVisit(id, el.getAttribute('data-v')); break;
      case 'quickSave': quickVisit(id, 'ok'); break;
      case 'quickCancel': S.quickOk = null; renderSheet(); break;
      case 'profileSave': profileSave(); break;
      case 'planToggle': planToggle(el.getAttribute('data-v')); break;
      case 'planReset': planReset(el); break;
      case 'satGet': satDownload(village()); break;
      case 'satPick': (function () {
        var m0 = S.meta.satOff || {}, pl = (plan() || {}).villages || [];
        var list = villages().filter(function (x) { return x.name !== 'Без села'; }).map(function (x) { return { v: x.name, l: x.name, sub: x.n + ' точок' + (m0[x.name] ? ' · збережено ' + dt(m0[x.name].ts) : '') }; });
        var inPl = list.filter(function (o) { return pl.indexOf(o.v) >= 0; }).map(function (o, i) { return Object.assign({}, o, { head: i ? '' : 'Села плану', hot: true }); });
        openSheet('Супутник офлайн: яке село', inPl.concat(letterHeads(list.filter(function (o) { return pl.indexOf(o.v) < 0; }))), '', function (v) { if (v) satDownload(v); }, { search: 'Пошук села' });
      })(); break;
      case 'satDel': if (confirm('Видалити збережений супутник для «' + el.getAttribute('data-v') + '»?')) satRemove(el.getAttribute('data-v')); break;
      case 'stickyOff': setMeta('stickyStreet', null); if (S.adding) { S.adding.street = ''; S.adding.sticky = false; } renderSheet(); setTimeout(function () { var i = $('#ad-s'); if (i) i.focus(); }, 50); break;
      case 'addJur': S.adding.jur = !S.adding.jur; renderSheet(); break;
      case 'pointVillage': (function (pid) { var pt = S.points.get(pid); if (!pt) return; pickVillageFor(pt.village, function (v) {
          var old = pt.village; if ((v || null) === (old || null)) return;
          applyAddr(pt, v || '', pt.street || '', pt.house || '').then(function () { invalidate(); S.route = null; toast('Перенесено: ' + (old || 'без села') + ' → ' + (v || 'без села')); var y = window.scrollY; render(); window.scrollTo(0, y); });
        }); })(id); break;
      case 'subjEdit': readCollect(); openSubjEditor(id); break;
      case 'spReset': spReset(el); break;
      case 'brT': BRT = el.getAttribute('data-v'); render(); break;
      case 'brSet': brSet(id, el.getAttribute('data-v')); break;
      case 'brShare': brShare(); break;
      case 'brCsv': brCsv(); break;
      case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(); }); } break;
      case 'installHide': setMeta('installHide', true).then(render); break;
      case 'keepAwake': setMeta('keepAwake', S.meta.keepAwake === false).then(function () { syncWake(); var y = window.scrollY; render(); window.scrollTo(0, y); }); break;
      case 'aqVillage': AQ = ''; setMeta('village', el.getAttribute('data-v')).then(function () { S.route = null; S.sel = null; S.filter = null; renderMap.fitNext = true; go('#map'); }); break;
      case 'mapTab': e.preventDefault(); S.sel = null; renderMap.fitNext = false; renderAll.fitNext = false; go('#' + el.getAttribute('data-v')); break;
      case 'crewN': var cn = parseInt(prompt('Скільки контролерів працює на дільниці?', crew()), 10); if (cn > 0 && cn < 100) shareSet('crewN', cn).then(function () { var y = window.scrollY; render(); window.scrollTo(0, y); var f = document.querySelector('.cv details'); if (f) f.open = true; }); break;
      case 'delVillage': delVillage(el.getAttribute('data-v')); break;
      case 'info': showInfo(el.getAttribute('data-v')); break;
      case 'peerDel': peerDel(el.getAttribute('data-v')); break;
      case 'ghConnect': ghConnect(); break;
      case 'ghJoin': ghJoin(); break;
      case 'ghBase': closeSheet(); ghBaseUpload(); break;
      case 'ghSync': ghSync(true); break;
      case 'ghOff': closeSheet(); if (confirm('Відключити синхронізацію на цьому телефоні? Дані на телефоні лишаться.')) Promise.all([setMeta('gh', null), setMeta('ghSeen', {}), setMeta('ghLast', null), setMeta('ghErr', null)]).then(function () { render(); }); break;
      case 'noRead': openSheet('Чому не знято', [{ v: 'none', l: 'Нема доступу', sub: 'нікого немає, закрито, собака' }, { v: 'empty', l: 'Не живуть', sub: 'прибрати з обходу' }], null, function (v) { quickVisit(id, v); }); break;
      case 'editPoint': openPointEditor(id); break;
      case 'trail': openSheet('Пройдене: яскраві точки, де був будь-хто з контролерів', TRAIL_OPTS.map(function (o) { return { v: o[0], l: o[1], sub: o[2] }; }), trailMode(), function (v) {
          setMeta('trail', v); renderMap.fitNext = false; render(); toast(v === '0' ? 'Усі точки однаково яскраві' : 'Решта точок тьмяніша');
        }); break;
      case 'hideDone': setMeta('hideDone', !S.meta.hideDone); renderMap.fitNext = false; render(); break;
      case 'quickUndo': if (S.lastQuick && S.lastQuick.pid === id) { var lq = S.lastQuick; S.lastQuick = null; del('visits', lq.key).then(function () { S.visits = S.visits.filter(function (x) { return x.uid !== lq.uid; }); invalidate(); S.route = computeRoute(); S.sel = id; updateMap(); renderSheet(); refreshDone(); toast('Відмітку скасовано'); }); } break;
      case 'saveFind': saveFind(id); break;
      case 'rSerial': case 'rSealsOpen': case 'rPick': case 'rSealSt': case 'rSealDel': case 'rSealAdd': case 'rSave': readAction(a, el); break;
      case 'applyPace': var ps0 = planStats(); if (ps0) setLimit(Math.max(10, Math.min(150, Math.ceil(ps0.pace / 5) * 5))).then(function () { toast('У денному маршруті: ' + limLabel(routeCfg().limit) + ' адрес'); renderPlan(); }); break;
      case 'bindMode': B.mode = el.getAttribute('data-v'); if (B.mode === 'manual' && (S.meta.layer || 'scheme') !== 'sat' && navigator.onLine) setLayer('sat'); renderBindUi(); break;
      case 'bindLayer': setLayer(el.getAttribute('data-l')); renderBindUi(); break;
      case 'csvPoints': exportCsv('points'); break;
      case 'csvVisits': exportCsv('visits'); break;
      case 'syncOut': exportSync(); break;
      case 'offline': downloadOffline(el); break;
      case 'cycle': setMeta('normDays', +el.getAttribute('data-v')).then(function () { invalidate(); S.route = null; var y1 = window.scrollY; render(); window.scrollTo(0, y1); }); break;
      case 'secPick': SP.focus = SP.focus === +el.getAttribute('data-v') ? null : +el.getAttribute('data-v'); renderSectorsUi(); fitSectors(); break;
      case 'secSave': saveSectors(); break;
      case 'secMine': setMine(+el.getAttribute('data-v')); break;
      case 'spMode': SP.mode = el.getAttribute('data-v'); renderSectorsUi(); break;
      case 'spAuto': SP.assign = autoSplit(SP.v, SP.crew.length) || {}; SP.saved = false; SP.focus = null; renderSectorsUi(); updateMap(); break;
      case 'crewDel': SP.crew.splice(+el.getAttribute('data-v'), 1); SP.assign = autoSplit(SP.v, SP.crew.length) || {}; SP.saved = false; SP.focus = null; renderSectorsUi(); updateMap(); break;
      case 'crewAdd': var sug = crewSuggest().filter(function (n) { return SP.crew.indexOf(n) < 0; });
        openSheet('Хто ще в селі', sug.map(function (n) { return { v: n, l: n }; }).concat([{ v: '__new', l: 'Інше ім\'я…', head: sug.length ? 'Або' : '' }]), null, function (n) {
          if (n === '__new') { n = (prompt('Ім\'я контролера') || '').trim(); if (!n) return; }
          SP.crew.push(n); SP.assign = autoSplit(SP.v, SP.crew.length) || {}; SP.saved = false; renderSectorsUi(); updateMap();
        }); break;
      case 'spStreet': var stn = el.getAttribute('data-v');
        openSheet(stn, SP.crew.map(function (n, i) { return { v: String(i), l: n }; }), null, function (i) {
          villagePoints(SP.v).forEach(function (p) { if (p.street === stn) SP.assign[p.id] = +i; }); SP.saved = false; renderSectorsUi(); updateMap();
        }); break;
      case 'spQr': spQr(); break;
      case 'spScan': spScan(); break;
      case 'rp': RP = el.getAttribute('data-v'); renderReport(); break;
      case 'shareReport': shareReport(); break;
      case 'pick': doPick(el); break;
      case 'routeCfg': routeCfgSheet(); break;
      case 'showOnMap': var sp = S.points.get(id); if (!sp) break;
        var goMap = function () { S.sel = id; S.filter = null; renderMap.fitNext = true; go('#map'); };
        if (sp.village && village() !== ALL && sp.village !== village()) setMeta('village', sp.village).then(function () { S.route = null; goMap(); }); else goMap();
        break;
      case 'callPhone': var num = ($('#f-phone').value || '').replace(/[^\d+]/g, ''); if (num.length < 5) { toast('Введіть номер телефону'); $('#f-phone').focus(); } else location.href = 'tel:' + num; break;
      case 'viewPhoto': viewPhoto(el); break;
      case 'sealSt': case 'sealDel': case 'sealAdd': case 'sealPlace': sealAction(a, el); break;
      case 'addCancel': cancelAdd(); break;
      case 'addSt': S.adding.st = el.getAttribute('data-v'); renderSheet(); break;
      case 'addSave': saveAdd(); break;
      case 'allF': var F = Object.assign({ st: [], cy: [] }, S.meta.allF || {}), g = el.getAttribute('data-g'), vv = el.getAttribute('data-v');
        F[g] = F[g].indexOf(vv) >= 0 ? F[g].filter(function (x) { return x !== vv; }) : F[g].concat([vv]);
        setMeta('allF', F); render(); break;
      case 'allReset': setMeta('allF', { st: [], cy: [] }); render(); break;
      case 'toggleAll': setMeta('allMin', !(S.meta.allMin !== false)); renderAll.fitNext = false; render(); break;
      case 'toggleSheet': setMeta('sheetMin', !S.meta.sheetMin); renderSheet(); break;
      case 'toggleTiles': setMeta('tilesMin', !S.meta.tilesMin); renderMap.fitNext = false; render(); break;
      case 'pickVillageSheet': pickVillage(); break;
      case 'qf': QF = el.getAttribute('data-v') || null; render(); break;
      case 'backup': exportBackup(); break;
      case 'chkUpd': checkUpdate(true); break;
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
      /* старі візити без коду: детермінований код, однаковий на всіх телефонах з тією ж копією */
      S.visits.forEach(function (v) { if (!v.uid) v.uid = 'x-' + v.pointId + '-' + v.ts; });
      var mg = S.meta.merged || {}; S.visits.forEach(function (v) { if (mg[v.pointId]) v.pointId = mg[v.pointId]; });
      if (!S.meta.device) setMeta('device', (S.meta.me && S.meta.me.id && !S.meta.me.login ? S.meta.me.id : Math.random().toString(36).slice(2, 8)));
      if (!S.meta.me) return setMeta('me', { id: Math.random().toString(36).slice(2, 8), name: '' });
    });
  }
  function boot() {
    app = $('#app');
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', render);
    openDb().then(load).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (ok) { S.meta._persist = ok; });
      render();
      setTimeout(function () { ghSync(false); }, 2500);
    }).catch(function (e) { app.innerHTML = '<div class="screen"><h1 class="h1">Помилка сховища</h1><p>' + esc(e && e.message) + '</p></div>'; });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').then(function (r) { swReg = r; r.update(); }).catch(function () {});
    checkUpdate(false, true);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') S.hiddenAt = Date.now(); syncWake(); if (document.visibilityState === 'visible') { var awayMs = Date.now() - (S.hiddenAt || Date.now()); if (awayMs > 5000) refreshSat(true, 400); if (awayMs > 60000 && watchId !== null) restartGps(); checkUpdate(); if (!S.meta.ghLast || Date.now() - S.meta.ghLast > 120000) ghSync(false); } });
    window.addEventListener('online', function () { refreshSyncBadge(); refreshSat(true, 800); ghSync(false); });
    window.addEventListener('offline', function () { refreshSyncBadge(); });
    window.addEventListener('resize', function () { placeFabs(); });
    /* відкрита клавіатура: повноекранні вікна (редагування точки, дані абонента, пломби) стискаються до видимої частини,
       щоб кнопка «Зберегти» лишалась над клавіатурою; нижня панель вкладок ховається */
    if (window.visualViewport) {
      var kb = function () {
        var vv = window.visualViewport, h = vv.height; if (!kb.max || Math.abs(window.innerWidth - (kb.w || 0)) > 50) { kb.max = h; kb.w = window.innerWidth; } kb.max = Math.max(kb.max, h); var open = h < kb.max * 0.8;
        document.documentElement.style.setProperty('--vvh', h + 'px'); document.documentElement.style.setProperty('--vvt', (vv.offsetTop || 0) + 'px');
        var ae = document.activeElement || {};
        document.body.classList.toggle('kb-open', !!open && /^(INPUT|TEXTAREA)$/.test(ae.tagName || ''));
        /* фокус у верхній панелі карти (пошук): її не ховаємо, інакше поле зникає, клавіатура закривається і все повторюється по колу */
        document.body.classList.toggle('kb-ui', !!(ae.closest && ae.closest('.mapui')));
      };
      window.visualViewport.addEventListener('resize', kb); window.visualViewport.addEventListener('scroll', kb);
      document.addEventListener('focusin', function () { setTimeout(kb, 300); }); document.addEventListener('focusout', function () { setTimeout(kb, 300); });
    }
    /* поле «Будинок»: під рядком з'являються кнопки а б в г д / (поки поле у фокусі); «абв» — звичайна клавіатура */
    document.addEventListener('focusin', function (e) {
      var inp = e.target; if (!inp.matches || !inp.matches('[data-house]')) return;
      var row = inp.closest('.grid2'); if (!row) return;
      var nx = row.nextElementSibling; if (!nx || !nx.classList.contains('hkeys')) row.insertAdjacentHTML('afterend', houseKeys(inp.id));
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.hk-abc'); if (!b) return;
      var inp = document.getElementById(b.parentNode.getAttribute('data-for')); if (!inp) return;
      var txt = inp.getAttribute('inputmode') !== 'text';
      /* Gboard та інші клавіатури не перечитують тип поля, поки воно у фокусі. Тому підміняємо поле новим
         (те саме значення й обробники) і фокусуємо його в тому ж дотику: телефон відкриває нову клавіатуру */
      var nw = inp.cloneNode(true); nw.value = inp.value; nw.oninput = inp.oninput; nw.onchange = inp.onchange;
      nw.setAttribute('inputmode', txt ? 'text' : 'numeric');
      inp.parentNode.replaceChild(nw, inp);
      nw.focus(); try { var n = nw.value.length; nw.setSelectionRange(n, n); } catch (x) {}
      b.textContent = txt ? 'Цифри' : 'Букви';
    });
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.hk'); if (!b) return;
      e.preventDefault();
      var inp = document.getElementById(b.parentNode.getAttribute('data-for')); if (!inp) return;
      var t = b.getAttribute('data-t');
      if (t === 'abc') return; /* перемикання клавіатури — у click: Android відкриває клавіатуру лише у відповідь на дотик */
      inp.value = inp.value + t; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus();
    });
    setInterval(function () { if (document.visibilityState === 'visible') ghSync(false); }, 5 * 60 * 1000);
    setInterval(function () { if (document.visibilityState === 'visible') checkUpdate(); }, 5 * 60 * 1000);
    /* нова версія вже знайдена, але людина була зайнята — пробуємо оновитись, щойно звільниться */
    setInterval(function () { if (S.updPending) autoUpdate(); }, 15000);
    window.addEventListener('hashchange', function () { if (S.updPending) setTimeout(autoUpdate, 800); });
  }
  /* оновлення: version.json завжди з мережі, без кешу; якщо там новіша версія — плашка «Оновити» */
  var swReg = null;
  function verNum(v) { return String(v || '0').split('.').reduce(function (a, x) { return a * 1000 + (+x || 0); }, 0); }
  function checkUpdate(manual, onBoot) {
    if (!navigator.onLine) { if (manual) toast('Немає інтернету'); return Promise.resolve(); }
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (verNum(j.v) > verNum(VERSION)) {
        /* автооновлення: щойно нічого не вводиться і не зберігається — перезапускаємось у новій версії самі.
           Один раз на версію (щоб не зациклитись, якщо GitHub Pages ще кілька хвилин віддає старий код) */
        S.updPending = j.v;
        if (autoUpdate()) return;
        showUpdate(j.v);
      }
      else if (manual) toast('У вас остання версія ' + VERSION);
    }).catch(function () { if (manual) toast('Не вдалося перевірити'); });
  }
  function showUpdate(v) {
    var b = $('#upd');
    if (!b) { b = document.createElement('button'); b.id = 'upd'; b.className = 'upd'; document.body.appendChild(b); b.addEventListener('click', applyUpdate); }
    b.innerHTML = icon('sync', 18) + '<span>Є нова версія ' + esc(v) + '</span><b>Оновити</b>';
  }
  /* чи можна зараз непомітно перезапуститись: не друкуємо, не додаємо точку, немає відкритих вікон, не почато зчитування, не йде синхронізація чи завантаження */
  function updSafe() {
    if (typingNow() || S.adding || syncBusy || S.offBusy || satBusy) return false;
    if (document.querySelector('#picker, .seals-ov, .pk-ov, .ov-full, #pe-ov, .sheet-ov')) return false;
    if (/^#(read|bind|visit)/.test(location.hash || '')) return false;
    if (/^#card/.test(location.hash || '') && R && (R.val || R.photo || (R.L || []).some(function (x) { return x.st; }) || R.serial)) return false;
    return true;
  }
  function autoUpdate() {
    var v = S.updPending; if (!v || verNum(v) <= verNum(VERSION) || !updSafe()) return false;
    var k = 'kc-upd-' + v, tried = false; try { tried = sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); } catch (e) { tried = true; }
    if (tried) return false;
    applyUpdate(); return true;
  }
  function applyUpdate() {
    var b = $('#upd'); if (b) b.querySelector('b').textContent = '…';
    var go = function () { location.replace(location.pathname + '?u=' + Date.now() + location.hash); };
    var jobs = [];
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return /^shell-/.test(k); }).map(function (k) { return caches.delete(k); })); }));
    if (swReg) jobs.push(swReg.update().catch(function () {}));
    Promise.all(jobs).then(go, go); setTimeout(go, 4000);
  }
  window.__app = { S: S, invalidate: function () { invalidate(); }, computeRoute: computeRoute, autoSplit: autoSplit, applySplitCode: applySplitCode, spPayload: function () { return spPayload(); }, map: function () { return map; }, selPoint: function (id) { selPoint(id); } };
  boot();
})();

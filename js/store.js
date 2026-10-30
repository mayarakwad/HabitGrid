'use strict';
/* Storage, dates and habit statistics.
   Everything lives in localStorage under the "hg." prefix. Check-ins are stored as one
   31-bit mask per habit per month, so a full year of 10 habits is only a few KB. */

const Store = (() => {
  const P = 'hg.';
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(P + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(P + key, JSON.stringify(value)); return true; }
    catch (err) { console.error('Could not save', key, err); return false; }
  }
  function remove(key) { try { localStorage.removeItem(P + key); } catch { /* ignore */ } }
  // localStorage keeps UTF-16 strings, so each character costs two bytes.
  function size(key) {
    try { const v = localStorage.getItem(P + key); return v == null ? 0 : (P.length + key.length + v.length) * 2; }
    catch { return 0; }
  }
  function bytesUsed() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(P)) n += (k.length + localStorage.getItem(k).length) * 2;
      }
    } catch { /* ignore */ }
    return n;
  }
  return { read, write, remove, size, bytesUsed };
})();

const Dates = {
  pad: n => String(n).padStart(2, '0'),
  key: d => `${d.getFullYear()}-${Dates.pad(d.getMonth() + 1)}-${Dates.pad(d.getDate())}`,
  monthKey: d => `${d.getFullYear()}-${Dates.pad(d.getMonth() + 1)}`,
  parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  today() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; },
  daysIn: (y, m) => new Date(y, m + 1, 0).getDate(),
};

const Habits = (() => {
  const blank = () => ({ v: 1, habits: [], log: {}, settings: {}, badges: [] });
  const newId = () => 'h' + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);

  function popcount(n) {
    n -= (n >>> 1) & 0x55555555;
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }

  function isDone(data, id, date) {
    const row = data.log[Dates.monthKey(date)];
    return !!(row && (row[id] >>> (date.getDate() - 1)) & 1);
  }

  function setDone(data, id, date, on) {
    const mk = Dates.monthKey(date);
    const row = data.log[mk] || (data.log[mk] = {});
    const bit = 1 << (date.getDate() - 1);
    const next = on ? (row[id] | 0) | bit : (row[id] | 0) & ~bit;
    if (next) row[id] = next; else delete row[id];
    if (!Object.keys(row).length) delete data.log[mk];
  }

  // Drops a deleted habit's history so it doesn't keep taking space.
  function purge(data, id) {
    for (const [mk, row] of Object.entries(data.log)) {
      delete row[id];
      if (!Object.keys(row).length) delete data.log[mk];
    }
  }

  function compact(data) {
    const ids = new Set(data.habits.map(h => h.id));
    for (const [mk, row] of Object.entries(data.log)) {
      for (const [id, mask] of Object.entries(row)) if (!ids.has(id) || !mask) delete row[id];
      if (!Object.keys(row).length) delete data.log[mk];
    }
  }

  // A habit only counts from the day it was created (backfilling moves that day earlier).
  function habitMonth(data, h, y, m) {
    const today = Dates.today(), n = Dates.daysIn(y, m);
    let done = 0, possible = 0;
    for (let d = 1; d <= n; d++) {
      const dt = new Date(y, m, d);
      if (dt > today) break;
      if (Dates.key(dt) < h.created) continue;
      possible++;
      if (isDone(data, h.id, dt)) done++;
    }
    return { done, possible, pct: possible ? done / possible : 0 };
  }

  function dayStats(data, date) {
    const key = Dates.key(date);
    const hs = data.habits.filter(h => h.created <= key);
    const done = hs.filter(h => isDone(data, h.id, date)).length;
    return { done, total: hs.length, pct: hs.length ? done / hs.length : null };
  }

  function streaks(data, h) {
    const today = Dates.today();
    let best = 0, run = 0;
    for (let d = Dates.parse(h.created); d <= today; d.setDate(d.getDate() + 1)) {
      if (isDone(data, h.id, d)) { run++; if (run > best) best = run; } else run = 0;
    }
    // Today still counts as "in progress", so an unticked today doesn't break the streak.
    let current = 0;
    const d = new Date(today);
    if (!isDone(data, h.id, d)) d.setDate(d.getDate() - 1);
    while (Dates.key(d) >= h.created && isDone(data, h.id, d)) { current++; d.setDate(d.getDate() - 1); }
    return { current, best };
  }

  function overall(data) {
    const today = Dates.today(), ids = new Set(data.habits.map(h => h.id));
    let total = 0, best = 0, current = 0, perfect = 0;
    for (const row of Object.values(data.log)) {
      for (const [id, mask] of Object.entries(row)) if (ids.has(id)) total += popcount(mask);
    }
    for (const h of data.habits) {
      const s = streaks(data, h);
      best = Math.max(best, s.best);
      current = Math.max(current, s.current);
    }
    if (data.habits.length) {
      const first = data.habits.reduce((a, h) => (h.created < a ? h.created : a), Dates.key(today));
      for (let d = Dates.parse(first); d <= today; d.setDate(d.getDate() + 1)) {
        const s = dayStats(data, d);
        if (s.total && s.done === s.total) perfect++;
      }
    }
    return { total, best, current, perfect, habits: data.habits.length };
  }

  return { blank, newId, isDone, setDone, purge, compact, habitMonth, dayStats, streaks, overall };
})();

'use strict';
/* HabitGrid UI: sign-in screens, tracker grid, today (focus) view, monthly analytics,
   profile and personalization. Plain DOM + template strings, no dependencies. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = x => Math.round((x || 0) * 100);
const HEX = /^#[0-9a-f]{6}$/i;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- icons ---------- */
const ic = p => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  grid: ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  target: ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
  user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
  sliders: ic('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  left: ic('<path d="M15 18l-6-6 6-6"/>'),
  right: ic('<path d="M9 18l6-6-6-6"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  logout: ic('<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9"/>'),
  eye: ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  download: ic('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: ic('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>'),
  trash: ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  key: ic('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'),
  shield: ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  edit: ic('<path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/>'),
  pie: ic('<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'),
  calendar: ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  table: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
  up: ic('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: ic('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  copy: ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  lock: ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  broom: ic('<path d="M14 4l6 6M17 7l-7 7M4 20l5-1 5-5-4-4-5 5z"/>'),
  week: ic('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>'),
  year: ic('<rect x="3" y="3" width="4" height="4" rx="1"/><rect x="10" y="3" width="4" height="4" rx="1"/><rect x="17" y="3" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><rect x="3" y="17" width="4" height="4" rx="1"/><rect x="10" y="17" width="4" height="4" rx="1"/>'),
};
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const LOGO = `<span class="logo">${CHECK}</span>`;

/* ---------- options ---------- */
const THEMES = [
  { id: 'system', name: 'System', bg: 'linear-gradient(135deg,#191919 50%,#f7f7f5 50%)', surface: '#2a2a2a', text: '#9b9a97' },
  { id: 'midnight', name: 'Midnight', bg: '#191919', surface: '#262626', text: '#ebebea' },
  { id: 'paper', name: 'Paper', bg: '#ffffff', surface: '#f1f1ef', text: '#37352f' },
  { id: 'ocean', name: 'Ocean', bg: '#0d1522', surface: '#1b2b44', text: '#e3ecf8' },
  { id: 'forest', name: 'Forest', bg: '#0f1712', surface: '#1d2e23', text: '#e2eee6' },
  { id: 'dusk', name: 'Dusk', bg: '#1a1120', surface: '#301f38', text: '#f6e9f1' },
  { id: 'sand', name: 'Sand', bg: '#f5f0e6', surface: '#e9e0cd', text: '#3a3125' },
  { id: 'rose', name: 'Rose', bg: '#fff4f6', surface: '#fbe1e8', text: '#3d2930' },
  { id: 'oled', name: 'OLED', bg: '#000000', surface: '#171717', text: '#ffffff' },
];
const ACCENTS = ['#2383e2', '#7c5cff', '#d6409f', '#e5484d', '#f76b15', '#e0a100', '#30a46c', '#12a594', '#64748b'];
const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐙', '🦄', '🐝', '🐧', '🌵', '🌙', '⭐', '🔥', '🎧', '🚀'];
const HABIT_ICONS = ['✅', '🏋️', '🏃', '🧘', '📚', '📖', '💼', '💧', '🚿', '😴', '🍎', '🥗', '✍️', '🎸', '🧹', '💊', '📵', '🙏', '🧠', '💰', '🌱', '🐶', '☀️', '🎯'];
const STARTERS = [['Exercise', '🏋️', '#e5484d'], ['Study', '📚', '#2383e2'], ['Read', '📖', '#7c5cff'], ['Drink water', '💧', '#12a594'], ['Meditate', '🧘', '#30a46c']];
const QUOTES = ['Small steps every day add up.', 'Progress, not perfection.', "Don't break the chain.", 'Consistency beats intensity.',
  'Show up for yourself today.', 'One check at a time.', 'Make it easy, make it daily.'];
/* First-run questions: asked before signing up; the answers become the new profile's plan
   (its first habits, its "why", and how hard to push). */
const HABIT_CHOICES = [
  ['workout', '🏋️', 'Work out', '#e5484d'], ['walk', '🚶', 'Walk 8,000 steps', '#30a46c'],
  ['water', '💧', 'Drink 2 liters of water', '#12a594'], ['read', '📖', 'Read 10 pages', '#7c5cff'],
  ['study', '📚', 'Study for 30 minutes', '#2383e2'], ['meditate', '🧘', 'Meditate for 10 minutes', '#30a46c'],
  ['journal', '✍️', 'Journal', '#d6409f'], ['sleep', '😴', 'In bed by 11 pm', '#64748b'],
  ['phone', '📵', 'No phone for the first hour', '#f76b15'], ['social', '📱', 'Under 1 hour of social media', '#e0a100'],
  ['cold', '🚿', 'Cold shower', '#0090ff'], ['bed', '🛏️', 'Make your bed', '#12a594'],
  ['deep', '🎯', '1 hour of deep work', '#e5484d'], ['plan', '🗓️', 'Plan tomorrow', '#7c5cff'],
  ['sugar', '🍎', 'No added sugar', '#30a46c'], ['screens', '🌙', 'No screens after 10 pm', '#64748b'],
];
const GOAL_HABITS = {
  discipline: ['bed', 'phone', 'cold'], fit: ['workout', 'walk', 'water'], focus: ['deep', 'phone', 'meditate'],
  sleep: ['sleep', 'screens'], learn: ['read', 'study'], screen: ['phone', 'social'], calm: ['meditate', 'journal', 'walk'],
  productive: ['plan', 'deep', 'bed'],
};
const QUESTIONS = [
  { id: 'goals', title: 'What do you want to change?', sub: 'Pick up to 3.', max: 3, options: [
    ['discipline', '🔥', 'Build discipline'], ['fit', '💪', 'Get in shape'], ['focus', '🎯', 'Focus better'],
    ['sleep', '😴', 'Sleep better'], ['learn', '📚', 'Read and learn more'], ['screen', '📵', 'Spend less time on my phone'],
    ['calm', '🧘', 'Feel calmer'], ['productive', '⚡', 'Get more done']] },
  { id: 'why', title: 'Why now?', sub: "Be honest. You'll see this on the days it's hard.", options: [
    ['restart', '🔁', "I'm tired of starting over"], ['prove', '🏆', 'I want to prove it to myself'],
    ['others', '🤝', 'Someone is counting on me'], ['stuck', '🧱', 'I feel stuck'],
    ['goal', '🎯', 'I have a big goal coming up'], ['better', '🌱', 'I just want to feel better']] },
  { id: 'history', title: 'How long do your habits usually last?', sub: 'No judgment. This sets your starting pace.', options: [
    ['days', '⏳', 'A few days'], ['week', '📅', 'About a week'], ['month', '🗓️', 'A month or so'],
    ['most', '✅', 'I stick with most of them'], ['first', '✨', 'This is my first time tracking habits']] },
  { id: 'blockers', title: 'What pulls you off track?', sub: 'Pick up to 3.', max: 3, options: [
    ['phone', '📱', 'My phone and social media'], ['energy', '🪫', 'Low energy'], ['routine', '🌀', 'No routine'],
    ['motivation', '📉', 'Motivation fades'], ['busy', '⏰', "I'm too busy"], ['stress', '😮‍💨', 'Stress']] },
  { id: 'peak', title: 'When are you most locked in?', sub: 'Plan your hardest habits for this time.', options: [
    ['dawn', '🌅', 'Early morning, before 7'], ['morning', '☀️', 'Morning'], ['afternoon', '🌤️', 'Afternoon'],
    ['evening', '🌆', 'Evening'], ['night', '🌙', 'Late at night']] },
  { id: 'habits', title: 'Pick your first habits', sub: 'We picked a few from your answers. 2 to 4 is a strong start; up to 6.', max: 6,
    options: HABIT_CHOICES.map(([v, icon, label]) => [v, icon, label]) },
  { id: 'mode', title: 'How hard do you want to push?', sub: 'You can change your habits anytime.', options: [
    ['steady', '🌱', 'Steady', 'Build slowly. Missing a day is OK.'],
    ['locked', '🔒', 'Locked in', 'Show up every day. No zero days.'],
    ['extreme', '⚔️', 'No excuses', 'Every habit, every day. Perfect days only.']] },
];
const answerLabel = (qid, v) => {
  const option = QUESTIONS.find(q => q.id === qid).options.find(o => o[0] === v);
  return option ? option[2] : '';
};
// Keeps only answers that are real choices (they also come back from saved data and backups).
function cleanPlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const plan = {};
  for (const q of QUESTIONS) {
    const allowed = new Set(q.options.map(o => o[0])), v = raw[q.id];
    if (q.max) plan[q.id] = Array.isArray(v) ? [...new Set(v.filter(x => allowed.has(x)))].slice(0, q.max) : [];
    else plan[q.id] = allowed.has(v) ? v : null;
  }
  plan.committed = /^\d{4}-\d{2}-\d{2}$/.test(raw.committed) ? raw.committed : null;
  return plan;
}

const NAV = [['tracker', I.grid, 'Tracker'], ['week', I.week, 'Week'], ['year', I.year, 'Year'], ['today', I.target, 'Today'],
  ['profile', I.user, 'Profile'], ['settings', I.sliders, 'Personalize']];

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS = {
  theme: 'system', accent: '#2383e2', font: 'system', size: 'm', density: 'comfortable', radius: 'rounded', cb: 'square',
  habitColors: false, showRings: true, labels: true, weekStart: 1, startView: 'tracker',
  motion: REDUCED ? 'reduced' : 'full', celebrate: true, hideDone: false,
};
const CHOICES = {
  theme: THEMES.map(t => t.id), font: ['system', 'rounded', 'serif', 'mono'], size: ['s', 'm', 'l'],
  density: ['compact', 'comfortable'], radius: ['sharp', 'rounded', 'round'], cb: ['square', 'circle'],
  weekStart: [0, 1], startView: ['tracker', 'week', 'year', 'today'], motion: ['full', 'reduced', 'off'],
};
const LOOK_KEYS = ['theme', 'accent', 'font', 'size', 'density', 'radius', 'cb', 'motion'];

const BADGES = [
  { id: 'first', icon: '🌱', name: 'First step', desc: 'Complete a habit', test: s => s.total >= 1 },
  { id: 'ten', icon: '✨', name: 'Warming up', desc: '10 check-ins', test: s => s.total >= 10 },
  { id: 'perfect', icon: '🌟', name: 'Perfect day', desc: 'Finish every habit in a day', test: s => s.perfect >= 1 },
  { id: 'week', icon: '🔥', name: 'On fire', desc: 'A 7-day streak', test: s => s.best >= 7 },
  { id: 'five', icon: '🧩', name: 'Collector', desc: 'Track 5 habits', test: s => s.habits >= 5 },
  { id: 'hundred', icon: '💯', name: 'Centurion', desc: '100 check-ins', test: s => s.total >= 100 },
  { id: 'month', icon: '🏆', name: 'Unstoppable', desc: 'A 30-day streak', test: s => s.best >= 30 },
  { id: 'style', icon: '🎨', name: 'Stylist', desc: 'Personalize your look', test: s => s.styled },
];

/* ---------- state ---------- */
const App = { user: null, data: null, view: 'tracker', y: 0, m: 0, tab: 'chart', flash: null, confirm: null, newBadges: new Set(), modalSeq: 0,
  weekOffset: 0, year: 0, yearHabit: null }; // week: 0 = this week, -1 = last week; yearHabit: one habit on the Year page, or all
const AuthUI = { mode: null, pick: null, code: null, next: null, remember: true, reset: false, identity: null,
  quiz: null, plan: null, lastMode: null }; // quiz: {step, answers} while answering; plan: the answers, until signed up

function cleanSettings(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!(k in DEFAULTS)) continue;
    const ok = CHOICES[k] ? CHOICES[k].includes(v) : typeof v === typeof DEFAULTS[k] && (k !== 'accent' || HEX.test(v));
    if (ok) out[k] = v;
  }
  return out;
}
const settings = () => ({ ...DEFAULTS, ...(App.data ? App.data.settings : {}) });
const lookBeforeLogin = () => ({ ...DEFAULTS, ...cleanSettings(Store.read('look', {})) });
const habitById = id => App.data.habits.find(h => h.id === id);

/* Habits live in grids (like "Morning" or "Work"); every profile has at least one. The Tracker,
   Week and Year pages show the current grid; Today and Profile show every habit. */
const MAX_GRIDS = 20;
const GRID_ICONS = ['✅', '🌅', '💼', '💪', '🧠', '🏠', '📚', '🌙', '🎯', '💰', '🎨', '❤️', '🌱', '⚡', '🧘', '🗂️'];
function cleanGrids(d) {
  const seen = new Set();
  d.grids = (Array.isArray(d.grids) ? d.grids : []).slice(0, MAX_GRIDS)
    .filter(g => g && typeof g.id === 'string' && /^[\w-]{1,24}$/.test(g.id) && !seen.has(g.id) && seen.add(g.id))
    .map(g => ({ id: g.id, name: String(g.name || '').trim().slice(0, 30) || 'Grid', icon: String(g.icon || '').trim().slice(0, 8) || '✅' }));
  if (!d.grids.length) d.grids.push({ id: 'main', name: 'My habits', icon: '✅' });
  const ids = new Set(d.grids.map(g => g.id));
  for (const h of d.habits) if (!ids.has(h.grid)) h.grid = d.grids[0].id; // habits from before grids join the first one
  if (!ids.has(d.gridId)) d.gridId = d.grids[0].id;
  return d;
}
const currentGrid = () => App.data.grids.find(g => g.id === App.data.gridId) || App.data.grids[0];
const gridHabits = (g = currentGrid()) => App.data.habits.filter(h => h.grid === g.id);
// The stats helpers in store.js only read data.habits and data.log, so one grid is a shallow view.
const gridData = () => ({ ...App.data, habits: gridHabits() });

function onColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}
const habitVars = (h, s = settings()) => `--hc:${h.color};--rc:${h.color};--hc-on:${onColor(h.color)}`
  + (s.habitColors ? `;--ck:${h.color};--ck-on:${onColor(h.color)}` : '');

const systemTheme = () => (matchMedia('(prefers-color-scheme: light)').matches ? 'paper' : 'midnight');
function applyLook(s) {
  const root = document.documentElement;
  root.dataset.theme = s.theme === 'system' ? systemTheme() : s.theme;
  for (const k of ['font', 'size', 'density', 'radius', 'cb', 'motion']) root.dataset[k] = s[k];
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--on-accent', onColor(s.accent));
}
function applySettings() {
  const s = settings();
  applyLook(s);
  Store.write('look', Object.fromEntries(LOOK_KEYS.map(k => [k, s[k]])));
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyLook(App.data ? settings() : lookBeforeLogin()));

function loadData(id) {
  const d = Store.read('data.' + id, null) || Habits.blank();
  d.habits = Array.isArray(d.habits) ? d.habits : [];
  d.log = d.log && typeof d.log === 'object' ? d.log : {};
  d.settings = cleanSettings(d.settings);
  d.badges = Array.isArray(d.badges) ? d.badges : [];
  d.plan = cleanPlan(d.plan);
  return cleanGrids(d);
}
function save() {
  if (!Store.write('data.' + App.user.id, App.data)) toast('Could not save — browser storage is full');
}

/* ---------- small UI helpers ---------- */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toast-root').append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the CSS animation
  el.classList.add(cls);
}

function celebrate(big = false) {
  const s = App.data ? settings() : lookBeforeLogin(); // before sign-in, the motion setting comes from the saved look
  if (!s.celebrate || s.motion !== 'full') return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = [s.accent, '#f5c542', '#30a46c', '#d6409f', '#0090ff', '#f76b15'];
  for (let i = 0; i < (big ? 90 : 36); i++) {
    const p = document.createElement('i');
    p.style.cssText = `--x:${Math.random() * 100}vw;--dx:${(Math.random() - 0.5) * 220}px;--r:${Math.random() * 900 - 450}deg;`
      + `--d:${(1 + Math.random()).toFixed(2)}s;--delay:${(Math.random() * 0.3).toFixed(2)}s;background:${colors[i % colors.length]}`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2600);
}

function openModal(html, { wide = false } = {}) {
  closeModal(true);
  const root = $('#modal-root');
  App.lastFocus = document.activeElement;
  root.innerHTML = `<div class="backdrop" data-action="closeModal"></div><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  root.hidden = false;
  root.classList.remove('closing');
  $('#app').inert = true; // the page behind a dialog can't be clicked or reached with the keyboard
  const first = $('[autofocus]', root) || $('.modal input, .modal button:not([data-action="closeModal"])', root);
  if (first) first.focus();
}

function closeModal(immediate) {
  const root = $('#modal-root');
  if (App.confirm) { const r = App.confirm; App.confirm = null; r(false); }
  if (App.googleWait) { // the "Continue in your browser" dialog was dismissed
    const wait = App.googleWait;
    App.googleWait = null;
    Store.api.google_cancel();
    wait.cancel();
  }
  if (root.hidden) return;
  const seq = ++App.modalSeq;
  const finish = () => {
    if (seq !== App.modalSeq) return;
    $('#app').inert = false;
    root.hidden = true;
    root.innerHTML = '';
    root.classList.remove('closing');
    if (!immediate && App.lastFocus && document.contains(App.lastFocus)) App.lastFocus.focus();
  };
  if (immediate || settings().motion === 'off') return finish();
  root.classList.add('closing');
  setTimeout(finish, 180);
}

function confirmBox(title, body, okLabel = 'Confirm', danger = true) {
  return new Promise(resolve => {
    openModal(`<div class="modal-head"><h2>${esc(title)}</h2></div><p class="muted">${esc(body)}</p>
      <div class="modal-foot"><span class="grow"></span><button class="btn ghost" data-action="closeModal">Cancel</button>
      <button class="btn ${danger ? 'danger solid' : 'primary'}" data-action="confirmYes" autofocus>${esc(okLabel)}</button></div>`);
    App.confirm = resolve;
  });
}

const closeBtn = `<button type="button" class="icon-btn" data-action="closeModal" aria-label="Close">${I.x}</button>`;

function pwField(name, label, auto, extra = '') {
  return `<label class="field"><span>${label}</span><span class="pw"><input class="input" type="password" name="${name}" autocomplete="${auto}" required ${extra}>`
    + `<button type="button" class="icon-btn" data-action="peek" aria-label="Show password" aria-pressed="false">${I.eye}</button></span></label>`;
}
const strengthMeter = '<div class="strength" aria-hidden="true"><i></i></div><small class="strength-label muted"></small>';

function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
function updateStrength(input) {
  const form = input.form, s = strengthOf(input.value);
  const bar = $('.strength i', form), label = $('.strength-label', form);
  if (!bar) return;
  bar.style.width = input.value ? `${Math.max(10, s * 25)}%` : '0';
  bar.style.background = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--ok)', 'var(--ok)'][s];
  label.textContent = input.value ? ['Too weak', 'Weak', 'Okay', 'Strong', 'Very strong'][s] : '';
}

const avatarPicker = cur => `<div class="avatars">${AVATARS.map(a => `<label class="av-opt"><input type="radio" name="avatar" value="${a}" ${a === cur ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>`;
const colorRadios = (name, cur) => `<div class="swatches">${ACCENTS.map(c => `<label class="sw" style="--c:${c}" title="${c}"><input type="radio" name="${name}" value="${c}" ${c === cur ? 'checked' : ''}><i></i></label>`).join('')}</div>`;
const pickAvatar = a => (AVATARS.includes(a) ? a : AVATARS[0]);
const pickColor = c => (HEX.test(c) ? c : ACCENTS[0]);

function setErr(form, msg) {
  const p = $('.form-err', form);
  if (p) p.textContent = msg;
  if (msg) replay(form.closest('.auth-card, .modal'), 'shake');
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

/* ---------- auth screens ---------- */
// Google's "G", as its sign-in buttons use.
const GOOGLE_G = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const googleOn = () => !!Store.info.google; // only when this copy has a Google OAuth client
const googleBtn = text => `<button type="button" class="btn google block" data-action="googleSignIn">${GOOGLE_G}<span>${text}</span></button>`;
const orLine = '<div class="or"><span>or</span></div>';
const pickRandom = list => list[Math.floor(Math.random() * list.length)];
const who = (u, title) => `<div class="who"><span class="avatar lg" style="--c:${u.color}">${esc(u.avatar)}</span><div><h1>${title}</h1><p class="muted">${esc(Auth.label(u))}</p></div></div>`;

const AUTH_VIEWS = {
  pick: accounts => `<h1>Welcome back</h1><p class="auth-sub">Choose your profile to continue.</p>
    <div class="profiles">${accounts.map((u, i) => `<button class="profile-tile" style="--c:${u.color};--i:${i}" data-action="pickProfile" data-u="${esc(Auth.label(u))}">
      <span class="avatar lg" style="--c:${u.color}">${esc(u.avatar)}</span><b>${esc(u.displayName)}</b><small>${esc(Auth.label(u))}</small></button>`).join('')}
      <button class="profile-tile add" style="--i:${accounts.length}" data-action="authMode" data-m="intro">
      <span class="avatar lg">${I.plus}</span><b>New profile</b><small>Create account</small></button></div>
    <div class="auth-links"><button class="link-btn" data-action="authMode" data-m="login">${googleOn() ? 'Sign in with email or Google' : 'Sign in with email'}</button></div>`,

  login: accounts => {
    const u = AuthUI.pick && Auth.byLogin(AuthUI.pick);
    const back = accounts.length
      ? '<button type="button" class="link-btn" data-action="authMode" data-m="pick">← All profiles</button>'
      : '<button type="button" class="link-btn" data-action="authMode" data-m="intro">Create an account</button>';
    if (u && !Auth.hasPassword(u)) {
      return `${who(u, `Hi, ${esc(u.displayName)}`)}<p class="auth-sub">This profile signs in with Google.</p>
        ${googleOn() ? `<label class="check"><input type="checkbox" name="remember" checked> Keep me signed in</label>${googleBtn('Continue with Google')}`
          : `<p class="form-err">Google sign-in isn't available in this copy of HabitGrid.</p>`}
        <div class="auth-links">${back}</div>`;
    }
    return `<form data-form="login">
      ${u ? `${who(u, `Hi, ${esc(u.displayName)}`)}<input type="hidden" name="login" value="${esc(Auth.label(u))}">`
      : `<h1>Sign in</h1><p class="auth-sub">Welcome back! Enter your details.</p>
        ${googleOn() ? googleBtn('Continue with Google') + orLine : ''}
        <label class="field"><span>Email</span><input class="input" name="login" inputmode="email" autocomplete="username" required autofocus autocapitalize="none" spellcheck="false" placeholder="you@example.com"></label>`}
      ${pwField('password', 'Password', 'current-password', u ? 'autofocus' : '')}
      <label class="check"><input type="checkbox" name="remember" checked> Keep me signed in</label>
      <p class="form-err" role="alert"></p>
      <button class="btn primary block">Sign in</button>
      ${u && u.google && googleOn() ? orLine + googleBtn('Continue with Google') : ''}
      <div class="auth-links">${back}<button type="button" class="link-btn" data-action="authMode" data-m="recover">Forgot password?</button></div>
    </form>`;
  },

  register: accounts => `<form data-form="register">
    <h1>Create your account</h1><p class="auth-sub">${AuthUI.plan
      ? `Your plan is ready: ${AuthUI.plan.habits.length} habit${AuthUI.plan.habits.length === 1 ? '' : 's'}, ${esc(answerLabel('mode', AuthUI.plan.mode) || 'your pace')} mode. Create your account to start.`
      : 'Your habits, themes and stats are saved to your profile.'}</p>
    ${googleOn() ? googleBtn('Sign up with Google') + '<div class="or"><span>or sign up with email</span></div>' : ''}
    <div class="two">
      <label class="field"><span>Display name</span><input class="input" name="displayName" maxlength="30" required autofocus placeholder="Alex"></label>
      <label class="field"><span>Email</span><input class="input" name="email" type="email" maxlength="254" required autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="alex@example.com"></label>
    </div>
    <div class="two">
      ${pwField('password', 'Password', 'new-password', 'minlength="6" data-strength')}
      ${pwField('confirm', 'Confirm password', 'new-password', 'minlength="6"')}
    </div>
    ${strengthMeter}
    <div class="field"><span>Avatar</span>${avatarPicker(pickRandom(AVATARS))}</div>
    <div class="field"><span>Profile color</span>${colorRadios('color', pickRandom(ACCENTS))}</div>
    <label class="check"><input type="checkbox" name="remember" checked> Keep me signed in</label>
    <p class="form-err" role="alert"></p>
    <button class="btn primary block">Create account</button>
    <div class="auth-links"><button type="button" class="link-btn" data-action="authMode" data-m="${AuthUI.plan ? 'commit' : 'intro'}">← Back to the questions</button>
      ${accounts.length ? '<button type="button" class="link-btn" data-action="authMode" data-m="login">I already have an account</button>' : ''}</div>
  </form>`,

  intro: accounts => `<div class="quiz-intro"><div class="big-emoji">🔥</div>
    <h1>Let's lock in.</h1>
    <p class="auth-sub">Answer ${QUESTIONS.length} quick questions and HabitGrid builds your starting plan. Then you'll create your account.</p>
    <button class="btn primary block" data-action="quizStart" autofocus>Start</button>
    <div class="auth-links">${accounts.length ? '<button class="link-btn" data-action="authMode" data-m="pick">← All profiles</button>' : '<span></span>'}
      <button class="link-btn" data-action="authMode" data-m="register" data-skip="1">Skip the questions</button></div></div>`,

  quiz: () => {
    const { step, answers } = AuthUI.quiz, q = QUESTIONS[step];
    const chosen = [].concat(answers[q.id] || []);
    const focusOn = chosen.length ? chosen[0] : q.options[0][0]; // keyboard focus lands on the answer, or the first choice
    return `<div class="quiz">${quizTop(step + 1)}
      <div class="quiz-step"><h1 id="quiz-q">${q.title}</h1><p class="auth-sub" id="quiz-sub">${q.sub}</p>
      <div class="quiz-options${q.options[0][3] ? ' one' : ''}" role="${q.max ? 'group' : 'radiogroup'}" aria-labelledby="quiz-q" aria-describedby="quiz-sub">${q.options.map(([v, icon, label, desc], i) =>
        `<button class="quiz-opt" style="--i:${i}" role="${q.max ? 'checkbox' : 'radio'}" aria-checked="${chosen.includes(v)}" data-action="quizPick" data-v="${v}"${v === focusOn ? ' autofocus' : ''}>
          <span class="qo-icon">${icon}</span><span><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span></button>`).join('')}</div>
      ${q.max ? `<button class="btn primary block" data-action="quizNext" ${chosen.length ? '' : 'disabled'}>Continue</button>` : ''}</div></div>`;
  },

  commit: () => {
    const a = AuthUI.quiz.answers;
    const habits = HABIT_CHOICES.filter(h => a.habits.includes(h[0]));
    return `<div class="quiz">${quizTop(QUESTIONS.length + 1)}
      <div class="quiz-step"><h1>Your plan is ready</h1><p class="auth-sub">Here's how you'll start. You can change any of it later.</p>
      <div class="plan-card">
        <div><small>Your why</small><b>${answerLabel('why', a.why)}</b></div>
        <div><small>Mode</small><b>${answerLabel('mode', a.mode)}</b></div>
        <div><small>Most locked in</small><b>${answerLabel('peak', a.peak)}</b></div>
        <div><small>Watch out for</small><b>${a.blockers.map(b => answerLabel('blockers', b)).join(', ')}</b></div>
        <div class="plan-habits"><small>Your first habits</small><ul>${habits.map(([, icon, label]) => `<li>${icon} ${label}</li>`).join('')}</ul></div>
      </div>
      <p class="commit-text">“I'll show up every day, even when I don't feel like it.”</p>
      <button class="btn primary block hold-btn" data-hold="commit" autofocus><i class="hold-fill"></i><span>Hold to commit</span></button>
      <p class="muted center hold-hint">Press and hold the button</p></div></div>`;
  },

  recover: () => `<form data-form="recover">
    <h1>Reset password</h1><p class="auth-sub">Use the recovery code you saved when you created your account.</p>
    <label class="field"><span>Email</span><input class="input" name="login" inputmode="email" required autocapitalize="none" spellcheck="false" value="${esc(AuthUI.pick || '')}" ${AuthUI.pick ? '' : 'autofocus'}></label>
    <label class="field"><span>Recovery code</span><input class="input mono" name="code" required placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" autocomplete="off" ${AuthUI.pick ? 'autofocus' : ''}></label>
    ${pwField('password', 'New password', 'new-password', 'minlength="6" data-strength')}
    ${strengthMeter}
    <p class="form-err" role="alert"></p>
    <button class="btn primary block">Reset password</button>
    <div class="auth-links"><button type="button" class="link-btn" data-action="authMode" data-m="login">← Back to sign in</button></div>
  </form>`,

  // Google sign-in found a password profile with the same email: its owner connects them once.
  linkGoogle: () => {
    const u = Auth.byLogin(AuthUI.pick);
    return `<form data-form="linkGoogle">${who(u, 'Connect Google?')}
      <p class="auth-sub">A HabitGrid profile already uses ${esc(AuthUI.identity.email)}. Enter its password once to connect your Google account. After that you can sign in either way.</p>
      ${pwField('password', 'Password', 'current-password', 'autofocus')}
      <p class="form-err" role="alert"></p>
      <button class="btn primary block">Connect and sign in</button>
      <div class="auth-links"><button type="button" class="link-btn" data-action="authMode" data-m="pick">Cancel</button>
        <button type="button" class="link-btn" data-action="authMode" data-m="recover">Forgot password?</button></div>
    </form>`;
  },

  code: () => `<h1>${AuthUI.reset ? 'Password updated 🔒' : 'Account created 🎉'}</h1>
    <p class="auth-sub">Save this recovery code somewhere safe. It's the only way to reset your password, and it won't be shown again.</p>
    <div class="code-box">${esc(AuthUI.code)}</div>
    <div class="row-btns"><button class="btn" data-action="copyCode" data-code="${esc(AuthUI.code)}">${I.copy} Copy code</button></div>
    <button class="btn primary block" data-action="enter" autofocus>Continue</button>`,
};

function renderAuth() {
  applyLook(lookBeforeLogin());
  document.title = 'Sign in · HabitGrid';
  const accounts = Auth.list();
  if (AuthUI.mode === 'linkGoogle' && !(AuthUI.identity && Auth.byLogin(AuthUI.pick))) AuthUI.mode = null;
  if ((AuthUI.mode === 'quiz' || AuthUI.mode === 'commit') && !AuthUI.quiz) AuthUI.mode = 'intro';
  // Questions come first: a computer with no profiles starts with them, and so does "New profile".
  const mode = AuthUI.mode || (accounts.length ? 'pick' : 'intro');
  const flow = ['intro', 'quiz', 'commit', 'register'];
  const steady = flow.includes(mode) && flow.includes(AuthUI.lastMode); // moving through the questions: no card bounce
  AuthUI.lastMode = mode;
  $('#app').innerHTML = `<main class="auth">
    <div class="auth-card${flow.includes(mode) ? ' wide' : ''}${steady ? ' steady' : ''}"><div class="auth-brand">${LOGO}<span>HabitGrid</span></div>${AUTH_VIEWS[mode](accounts)}</div>
    <p class="auth-foot">${I.lock} Profiles and habits are stored only on this computer, and passwords are salted and hashed (PBKDF2).
      ${googleOn() ? 'Google sign-in only tells HabitGrid your name and email.' : 'Nothing is sent anywhere.'}</p>
  </main>`;
  const f = $('.auth [autofocus]');
  if (f) f.focus();
}

const quizTop = n => `<div class="quiz-top"><button class="icon-btn" data-action="quizBack" aria-label="Back">${I.left}</button>
  <div class="quiz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${QUESTIONS.length + 1}" aria-valuenow="${n}"><i style="width:${(n / (QUESTIONS.length + 1)) * 100}%"></i></div>
  <span class="muted quiz-count">${Math.min(n, QUESTIONS.length)}/${QUESTIONS.length}</span></div>`;

function quizGo(step) {
  const q = QUESTIONS[step];
  // The habits question starts with suggestions from the goals.
  if (q && q.id === 'habits' && !AuthUI.quiz.answers.habits) {
    const picks = [];
    for (const g of AuthUI.quiz.answers.goals || []) for (const h of GOAL_HABITS[g] || []) if (!picks.includes(h)) picks.push(h);
    AuthUI.quiz.answers.habits = picks.slice(0, 4);
  }
  AuthUI.quiz.step = step;
  AuthUI.mode = step >= QUESTIONS.length ? 'commit' : 'quiz';
  renderAuth();
}

function commitPlan() {
  AuthUI.plan = cleanPlan({ ...AuthUI.quiz.answers, committed: Dates.key(Dates.today()) });
  AuthUI.mode = 'register';
  celebrate();
  renderAuth();
}

// A new profile starts from its answers: the chosen habits, and the plan shown on Today and Profile.
function planInto(d, plan) {
  d.plan = plan;
  if (d.habits.length) return;
  const key = Dates.key(Dates.today());
  for (const [id, icon, name, color] of HABIT_CHOICES) {
    if (plan.habits.includes(id)) d.habits.push({ id: Habits.newId(), name, icon, color, created: key });
  }
  cleanGrids(d); // puts them in the first grid
}
function applyPlan(plan) {
  if (!plan || !App.data) return;
  planInto(App.data, plan);
  save();
  renderView(true);
  checkBadges();
}

// "Hold to commit": the button fills while pressed (mouse, touch, or Space/Enter) and commits when full.
let holdTimer = null, holdKey = null, keyHoldAt = -Infinity;
const isActivateKey = e => e.key === ' ' || e.key === 'Enter';
function finishHold(el) {
  if (!el.isConnected || el.classList.contains('held')) return;
  el.classList.remove('holding');
  el.classList.add('held');
  if (el.dataset.hold === 'commit') commitPlan();
}
function startHold(el) {
  if (holdTimer || el.classList.contains('held')) return;
  el.classList.add('holding');
  holdTimer = setTimeout(() => { holdTimer = null; finishHold(el); }, 1200);
}
function stopHold() {
  if (!holdTimer) return;
  clearTimeout(holdTimer);
  holdTimer = null;
  for (const el of $$('[data-hold].holding')) el.classList.remove('holding');
}
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-hold]');
  if (el && e.button === 0) { e.preventDefault(); startHold(el); }
});
document.addEventListener('pointerup', stopHold);
document.addEventListener('pointercancel', stopHold);
document.addEventListener('pointerout', e => {
  const el = e.target.closest('[data-hold]');
  if (el && !el.contains(e.relatedTarget)) stopHold();
});
document.addEventListener('keydown', e => {
  if (!isActivateKey(e)) return;
  // A key that's still held after its screen changed must not act on the next one
  // (type into the sign-up form, or answer the next question).
  if (e.repeat && (e.key === holdKey || (e.target.closest && e.target.closest('.quiz, .quiz-intro')))) return e.preventDefault();
  const el = e.target.closest && e.target.closest('[data-hold]');
  if (el) { e.preventDefault(); holdKey = e.key; keyHoldAt = performance.now(); startHold(el); }
});
document.addEventListener('keyup', e => {
  if (!isActivateKey(e)) return;
  if (e.key === holdKey) holdKey = null;
  stopHold(); // wherever focus went meanwhile
});
document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('[data-hold]')) stopHold(); });
window.addEventListener('blur', stopHold);
// Screen readers and voice control send a single click with no press to hold: commit on that.
// A real key press also ends in such a click, so ignore one that follows a keyboard hold.
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-hold]');
  if (el && e.detail === 0 && !holdTimer && performance.now() - keyHoldAt > 1500) finishHold(el);
});

/* ---------- app shell ---------- */
function enterApp(user) {
  App.user = user;
  App.data = loadData(user.id);
  App.newBadges = new Set();
  const t = Dates.today();
  App.y = App.year = t.getFullYear();
  App.m = t.getMonth();
  App.weekOffset = 0;
  App.yearHabit = null;
  Object.assign(AuthUI, { mode: null, pick: null, code: null, next: null, reset: false, identity: null, quiz: null, plan: null, lastMode: null });
  applySettings();
  App.view = viewFromHash() || settings().startView;
  history.replaceState(null, '', '#/' + App.view);
  mountShell();
  renderView(true);
  checkBadges(true);
}

function mountShell() {
  $('#app').innerHTML = `<div class="shell">
    <nav class="nav" aria-label="Main">
      <div class="brand">${LOGO}<span>HabitGrid</span></div>
      ${NAV.map(([v, icon, label]) => `<a class="nav-link" href="#/${v}" data-v="${v}">${icon}<span>${label}</span></a>`).join('')}
      <div class="nav-foot"><a class="me" href="#/profile" id="me"></a>
        <button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${I.logout}</button></div>
    </nav>
    <main class="main"><div class="view" id="view"></div></main>
  </div>`;
  updateMe();
}

function updateMe() {
  const u = App.user, me = $('#me');
  if (me) me.innerHTML = `<span class="avatar" style="--c:${u.color}">${esc(u.avatar)}</span><span class="me-txt"><b>${esc(u.displayName)}</b><small>${esc(Auth.label(u))}</small></span>`;
}

const VIEWS = { tracker: viewTracker, week: viewWeek, year: viewYear, today: viewToday, profile: viewProfile, settings: viewSettings };
const TITLES = { tracker: 'Tracker', week: 'Week', year: 'Year', today: 'Today', profile: 'Profile', settings: 'Personalize' };
const AFTER = { tracker: scrollToToday, year: scrollToTodaySquare, profile: animateCounts };
const viewFromHash = () => { const v = location.hash.replace(/^#\/?/, ''); return VIEWS[v] ? v : null; };

function renderView(animate = true) {
  const view = $('#view');
  if (!view) return;
  view.innerHTML = VIEWS[App.view]();
  view.classList.remove('enter');
  if (animate && settings().motion !== 'off') {
    void view.offsetWidth;
    view.classList.add('enter');
    clearTimeout(App.enterTimer);
    App.enterTimer = setTimeout(() => view.classList.remove('enter'), 1700);
  }
  $$('.nav-link').forEach(a => (a.dataset.v === App.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = `${TITLES[App.view]} · HabitGrid`;
  App.flash = null;
  if (AFTER[App.view]) AFTER[App.view](view);
}

window.addEventListener('hashchange', () => {
  if (!App.user) return;
  const v = viewFromHash();
  if (v && v !== App.view) {
    App.view = v;
    closeModal(true);
    renderView(true);
    window.scrollTo(0, 0);
  }
});

/* ---------- tracker ---------- */
function summaryText() {
  const ds = Habits.dayStats(gridData(), Dates.today());
  const hi = `${greeting()}, ${esc(App.user.displayName)}`;
  return ds.total ? `${hi} · ${ds.done} of ${ds.total} done today` : `${hi}. Add a habit to get started.`;
}

const emptyState = (title = 'Start your first habit', text = 'Track anything you want to do daily. Tick a box each day and watch your charts fill in.') =>
  `<section class="card empty"><div class="big-emoji">🌱</div><h2>${title}</h2>
  <p class="muted">${text}</p>
  <div class="row-btns center"><button class="btn primary" data-action="newHabit">${I.plus} New habit</button>
  <button class="btn" data-action="starter">✨ Add starter habits</button></div></section>`;
// An empty grid when the profile has others: say so, so it doesn't look like habits were lost.
const gridEmpty = () => (App.data.habits.length
  ? emptyState(`${esc(currentGrid().name)} has no habits yet`, 'Add habits here, or move a habit into this grid from its Edit habit window.')
  : emptyState());

function gridBar() {
  const cur = currentGrid();
  return `<div class="grid-bar"><div class="grid-tabs" role="group" aria-label="Grids">${App.data.grids.map(g => {
    const n = App.data.habits.filter(h => h.grid === g.id).length;
    return `<button class="grid-tab" aria-pressed="${g === cur}" data-action="pickGrid" data-g="${g.id}" aria-label="${esc(g.name)}, ${n} habit${n === 1 ? '' : 's'}">`
      + `<span aria-hidden="true">${esc(g.icon)}</span><span class="gt-name">${esc(g.name)}</span><small aria-hidden="true">${n}</small></button>`;
  }).join('')}</div>
    <button class="icon-btn" data-action="editGrid" title="Edit this grid" aria-label="Edit grid ${esc(cur.name)}">${I.edit}</button>
    <button class="btn sm ghost" data-action="newGrid" aria-label="New grid">${I.plus}<span>New grid</span></button></div>`;
}

function gridModal(g) {
  const isNew = !g, many = App.data.grids.length > 1;
  g = g || { name: '', icon: GRID_ICONS[App.data.grids.length % GRID_ICONS.length] };
  openModal(`<form data-form="grid" data-g="${isNew ? '' : g.id}">
    <div class="modal-head"><h2>${isNew ? 'New grid' : 'Edit grid'}</h2>${closeBtn}</div>
    ${isNew ? '<p class="muted">A grid is its own set of habits, like Morning, Work or Health. Switch grids with the tabs on the Tracker, Week and Year pages.</p><br>' : ''}
    <label class="field"><span>Name</span><input class="input" name="name" maxlength="30" required value="${esc(g.name)}" placeholder="e.g. Morning routine" autofocus></label>
    <div class="field"><span>Icon</span><div class="emoji-grid">${GRID_ICONS.map(e => `<button type="button" class="emo" aria-pressed="${e === g.icon}" data-action="pickEmoji" data-v="${e}">${e}</button>`).join('')}
      <input class="emo-custom" name="icon" value="${esc(g.icon)}" maxlength="8" aria-label="Or type any emoji" title="Or type any emoji"></div></div>
    ${!isNew && many ? `<div class="row-btns"><button type="button" class="btn ghost sm" data-action="moveGrid" data-g="${g.id}" data-d="-1">${I.left} Move left</button>
      <button type="button" class="btn ghost sm" data-action="moveGrid" data-g="${g.id}" data-d="1">Move right ${I.right}</button></div>` : ''}
    <p class="form-err" role="alert"></p>
    <div class="modal-foot">${!isNew && many ? `<button type="button" class="btn ghost danger" data-action="deleteGrid" data-g="${g.id}">${I.trash} Delete</button>` : ''}
      <span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">${isNew ? 'Create grid' : 'Save'}</button></div>
  </form>`);
}

const tabBtn = (id, icon, label) => `<button role="tab" aria-selected="${App.tab === id}" data-action="tab" data-t="${id}">${icon}<span>${label}</span></button>`;

function viewTracker() {
  const { y, m } = App, s = settings(), today = Dates.today(), n = Dates.daysIn(y, m);
  const isCur = y === today.getFullYear() && m === today.getMonth();
  const head = `<header class="page-head">
    <div><h1>Habit Tracker</h1><p class="muted" id="summary">${summaryText()}</p></div>
    <div class="month-nav">
      ${isCur ? '' : '<button class="btn sm ghost" data-action="month" data-d="0">Today</button>'}
      <button class="icon-btn" data-action="month" data-d="-1" aria-label="Previous month">${I.left}</button>
      <span class="month-title">${MONTHS[m]} ${y}</span>
      <button class="icon-btn" data-action="month" data-d="1" aria-label="Next month" ${isCur ? 'disabled' : ''}>${I.right}</button>
      <button class="btn sm primary" data-action="newHabit">${I.plus}<span>New habit</span></button>
    </div></header>` + gridBar();
  const hs = gridHabits();
  if (!hs.length) return head + gridEmpty();

  let cols = '';
  for (let d = 1; d <= n; d++) {
    const wd = new Date(y, m, d).getDay(), isT = isCur && d === today.getDate();
    cols += `<th class="day${isT ? ' today' : ''}${wd === 0 || wd === 6 ? ' we' : ''}" scope="col"${isT ? ' id="today-col"' : ''}><span>${WEEKDAYS[wd][0]}</span><b>${d}</b></th>`;
  }
  const rows = hs.map(h => {
    let cells = '';
    for (let d = 1; d <= n; d++) {
      const dt = new Date(y, m, d), isT = isCur && d === today.getDate();
      cells += `<td${isT ? ' class="today"' : ''}><button class="cb${Dates.key(dt) < h.created ? ' pre' : ''}" data-action="toggle" data-h="${h.id}" data-d="${d}" `
        + `aria-pressed="${Habits.isDone(App.data, h.id, dt)}" aria-label="${esc(h.name)}, ${MONTHS[m]} ${d}"${dt > today ? ' disabled' : ''}>${CHECK}</button></td>`;
    }
    const st = Habits.habitMonth(App.data, h, y, m);
    return `<tr data-h="${h.id}" style="${habitVars(h, s)}"${App.flash === h.id ? ' class="flash"' : ''}>
      <th class="hcell" scope="row"><button class="habit-name" data-action="editHabit" data-h="${h.id}" title="Edit habit"><span class="hi">${esc(h.icon)}</span><span class="hn">${esc(h.name)}</span></button></th>
      ${cells}<td class="pcell"><div class="pwrap"><span class="pct">${pct(st.pct)}%</span>${s.showRings ? Charts.ring(st.pct, { size: 20, stroke: 3.5 }) : ''}</div></td></tr>`;
  }).join('');

  return head + `<div class="grid-wrap"><table class="grid"><thead><tr><th class="hcell" scope="col">Habit</th>${cols}<th class="pcell" scope="col">Month</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <section class="card progress">
      <div class="sec-head"><h2>Monthly progress</h2><div class="tabs" role="tablist">${tabBtn('chart', I.pie, 'Chart')}${tabBtn('calendar', I.calendar, 'Calendar')}${tabBtn('table', I.table, 'Table')}</div></div>
      <div id="progress-body">${progressHTML(false)}</div>
    </section>`;
}

function scrollToToday(view) {
  const wrap = $('.grid-wrap', view), col = $('#today-col', view);
  if (wrap && col && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = col.offsetLeft - wrap.clientWidth / 2;
}

function monthSummary(y, m) {
  const today = Dates.today(), n = Dates.daysIn(y, m), days = [], data = gridData();
  for (let d = 1; d <= n; d++) {
    const dt = new Date(y, m, d);
    days.push(dt > today ? { d, pct: null } : { d, ...Habits.dayStats(data, dt) });
  }
  const habits = data.habits.map(h => ({ h, ...Habits.habitMonth(data, h, y, m), ...Habits.streaks(data, h) }));
  const done = habits.reduce((a, x) => a + x.done, 0), possible = habits.reduce((a, x) => a + x.possible, 0);
  return { days, habits, done, possible, pct: possible ? done / possible : 0 };
}

const PROGRESS = {
  chart(ms) {
    const s = settings(), today = Dates.today();
    const isCur = App.y === today.getFullYear() && App.m === today.getMonth();
    // Size the chart to the space it will get (card padding 42px, donut column 224px).
    const inner = ($('#view') || document.body).clientWidth - 42, stack = inner < 600;
    const width = Math.max(260, stack ? inner : inner - 224);
    return `<div class="chart-grid${stack ? ' stack' : ''}">
      <div class="donut"><div class="donut-ring">${Charts.ring(ms.pct, { size: 140, stroke: 12 })}<div class="donut-txt"><b>${pct(ms.pct)}%</b><span>month total</span></div></div>
        <ul class="legend"><li><i class="dot acc"></i>Done <b>${ms.done}</b></li><li><i class="dot"></i>Missed <b>${ms.possible - ms.done}</b></li></ul></div>
      <div class="area">${Charts.area(ms.days.map(d => d.pct), { labels: s.labels && width >= 480, today: isCur ? today.getDate() - 1 : -1, width })}</div>
    </div>
    <h3 class="sub">By habit</h3>
    <div class="bars">${ms.habits.map((x, i) => `<div class="bar-row" style="--i:${i}"><span class="bar-name">${esc(x.h.icon)} ${esc(x.h.name)}</span>
      <span class="bar"><i style="width:${pct(x.pct)}%;background:${x.h.color}"></i></span><b>${pct(x.pct)}%</b></div>`).join('')}</div>`;
  },

  calendar(ms) {
    const ws = settings().weekStart, todayKey = Dates.key(Dates.today());
    const offset = (new Date(App.y, App.m, 1).getDay() - ws + 7) % 7;
    let html = '';
    for (let i = 0; i < 7; i++) html += `<div class="cal-h">${WEEKDAYS[(i + ws) % 7].slice(0, 3)}</div>`;
    html += '<div></div>'.repeat(offset);
    ms.days.forEach((x, i) => {
      const key = Dates.key(new Date(App.y, App.m, x.d)), p = x.pct, has = p != null;
      html += `<button class="cal-d${has && p >= 0.6 ? ' hot' : ''}${key === todayKey ? ' is-today' : ''}" style="--i:${i}${has ? `;--mix:${Math.round(p * 85)}%` : ''}" `
        + `data-action="day" data-date="${key}" ${key > todayKey ? 'disabled' : ''} aria-label="${MONTHS[App.m]} ${x.d}${has ? `, ${pct(p)}% done` : ''}">`
        + `<b>${x.d}</b><span>${has ? pct(p) + '%' : ''}</span></button>`;
    });
    return `<div class="cal">${html}</div><p class="muted note">Tap a day to tick off habits for it.</p>`;
  },

  table(ms) {
    return `<div class="table-wrap"><table class="stats-table"><thead><tr><th>Habit</th><th class="num">Done</th><th class="num">Rate</th><th class="num">Streak</th><th class="num">Best</th></tr></thead>
      <tbody>${ms.habits.map((x, i) => `<tr style="--i:${i}"><td>${esc(x.h.icon)} ${esc(x.h.name)}</td><td class="num">${x.done}/${x.possible}</td>
      <td class="num">${pct(x.pct)}%</td><td class="num">${x.current ? `🔥 ${x.current}` : '–'}</td><td class="num">${x.best}</td></tr>`).join('')}</tbody></table></div>`;
  },
};

const progressHTML = anim => `<div class="tab-body${anim ? ' anim' : ''}">${PROGRESS[App.tab](monthSummary(App.y, App.m))}</div>`;

function refreshTracker() {
  if (App.view !== 'tracker' || !$('.grid')) return;
  for (const tr of $$('.grid tr[data-h]')) {
    const h = habitById(tr.dataset.h);
    if (!h) continue;
    for (const cb of $$('.cb', tr)) {
      const dt = new Date(App.y, App.m, +cb.dataset.d);
      cb.setAttribute('aria-pressed', Habits.isDone(App.data, h.id, dt));
      cb.classList.toggle('pre', Dates.key(dt) < h.created);
    }
    const st = Habits.habitMonth(App.data, h, App.y, App.m);
    $('.pct', tr).textContent = pct(st.pct) + '%';
    Charts.setRing($('.ring', tr), st.pct);
  }
  $('#progress-body').innerHTML = progressHTML(false);
  $('#summary').innerHTML = summaryText();
}

/* ---------- week ---------- */
function weekDays() {
  const t = Dates.today(), back = (t.getDay() - settings().weekStart + 7) % 7 - 7 * App.weekOffset;
  return Array.from({ length: 7 }, (_, i) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - back + i));
}
const shortDate = d => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

// Per habit: done / possible days this week (a habit counts from the day it was created).
function weekStats(days) {
  const today = Dates.today(), data = gridData();
  const rows = data.habits.map(h => {
    let done = 0, possible = 0;
    for (const d of days) {
      if (d > today || Dates.key(d) < h.created) continue;
      possible++;
      if (Habits.isDone(data, h.id, d)) done++;
    }
    return { h, done, possible };
  });
  const perDay = days.map(d => (d > today ? null : Habits.dayStats(data, d)));
  return { rows, perDay, done: rows.reduce((a, r) => a + r.done, 0), possible: rows.reduce((a, r) => a + r.possible, 0) };
}
const dayPct = s => (s && s.pct != null ? pct(s.pct) + '%' : '–');
const weekTotal = ws => (ws.possible ? pct(ws.done / ws.possible) + '%' : '–');
const weekSummary = ws => (ws.possible ? `${ws.done} of ${ws.possible} check-ins done · ${weekTotal(ws)}` : 'Nothing to track this week yet');

function viewWeek() {
  const days = weekDays(), today = Dates.today(), todayKey = Dates.key(today), s = settings();
  const head = `<header class="page-head">
    <div><h1>Week</h1><p class="muted" id="week-summary">${weekSummary(weekStats(days))}</p></div>
    <div class="month-nav">
      ${App.weekOffset ? '<button class="btn sm ghost" data-action="week" data-d="0">This week</button>' : ''}
      <button class="icon-btn" data-action="week" data-d="-1" aria-label="Previous week">${I.left}</button>
      <span class="month-title">${shortDate(days[0])} – ${shortDate(days[6])}, ${days[6].getFullYear()}</span>
      <button class="icon-btn" data-action="week" data-d="1" aria-label="Next week" ${App.weekOffset >= 0 ? 'disabled' : ''}>${I.right}</button>
      <button class="btn sm primary" data-action="newHabit">${I.plus}<span>New habit</span></button>
    </div></header>` + gridBar();
  if (!gridHabits().length) return head + gridEmpty();
  const ws = weekStats(days);
  const cols = days.map(d => {
    const wd = d.getDay(), isT = Dates.key(d) === todayKey;
    return `<th class="day${isT ? ' today' : ''}${wd === 0 || wd === 6 ? ' we' : ''}" scope="col"><span>${WEEKDAYS[wd].slice(0, 3)}</span><b>${d.getDate()}</b></th>`;
  }).join('');
  const rows = ws.rows.map(({ h, done, possible }) => `<tr data-h="${h.id}" style="${habitVars(h, s)}">
      <th class="hcell" scope="row"><button class="habit-name" data-action="editHabit" data-h="${h.id}" title="Edit habit"><span class="hi">${esc(h.icon)}</span><span class="hn">${esc(h.name)}</span></button></th>
      ${days.map(d => {
        const k = Dates.key(d);
        return `<td${k === todayKey ? ' class="today"' : ''}><button class="cb${k < h.created ? ' pre' : ''}" data-action="toggleItem" data-h="${h.id}" data-date="${k}" `
          + `aria-pressed="${Habits.isDone(App.data, h.id, d)}" aria-label="${esc(h.name)}, ${WEEKDAYS[d.getDay()]} ${shortDate(d)}"${d > today ? ' disabled' : ''}>${CHECK}</button></td>`;
      }).join('')}
      <td class="pcell"><span class="wk-count">${done}/${possible}</span></td></tr>`).join('');
  const foot = `<tr><th class="hcell" scope="row">Done</th>${ws.perDay.map((x, i) =>
    `<td${Dates.key(days[i]) === todayKey ? ' class="today"' : ''}><span data-day="${i}">${dayPct(x)}</span></td>`).join('')}<td class="pcell"><b id="week-total">${weekTotal(ws)}</b></td></tr>`;
  return head + `<div class="grid-wrap"><table class="grid week-grid"><thead><tr><th class="hcell" scope="col">Habit</th>${cols}<th class="pcell" scope="col">Week</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>`;
}

function refreshWeek() {
  if (App.view !== 'week' || !$('.week-grid')) return;
  const ws = weekStats(weekDays());
  for (const cb of $$('.week-grid .cb')) {
    const h = habitById(cb.dataset.h);
    if (!h) continue;
    cb.setAttribute('aria-pressed', Habits.isDone(App.data, h.id, Dates.parse(cb.dataset.date)));
    cb.classList.toggle('pre', cb.dataset.date < h.created);
  }
  for (const r of ws.rows) {
    const el = $(`.week-grid tr[data-h="${r.h.id}"] .wk-count`);
    if (el) el.textContent = `${r.done}/${r.possible}`;
  }
  ws.perDay.forEach((x, i) => { const el = $(`.week-grid [data-day="${i}"]`); if (el) el.textContent = dayPct(x); });
  $('#week-total').textContent = weekTotal(ws);
  $('#week-summary').textContent = weekSummary(ws);
}

/* ---------- year ---------- */
// Every day of the year for the current grid (or one of its habits): how much was done,
// plus totals. A day is "complete" when every habit that existed that day was done.
function yearInfo() {
  const y = App.year, today = Dates.today(), base = gridData();
  const one = App.yearHabit ? base.habits.find(h => h.id === App.yearHabit) : null;
  const data = one ? { ...base, habits: [one] } : base;
  const days = [];
  let checkins = 0, complete = 0, run = 0, best = 0;
  for (let i = 0; ; i++) {
    const dt = new Date(y, 0, 1 + i);
    if (dt.getFullYear() !== y) break;
    if (dt > today) { days.push({ dt, future: true }); continue; }
    const s = Habits.dayStats(data, dt);
    checkins += s.done;
    if (s.total && s.done === s.total) { complete++; best = Math.max(best, ++run); } else run = 0;
    days.push({ dt, ...s });
  }
  const months = [];
  let done = 0, possible = 0;
  for (let m = 0; m < 12 && new Date(y, m, 1) <= today; m++) {
    const sums = data.habits.map(h => Habits.habitMonth(data, h, y, m));
    const d = sums.reduce((a, x) => a + x.done, 0), p = sums.reduce((a, x) => a + x.possible, 0);
    done += d; possible += p;
    months.push({ m, pct: p ? d / p : 0, any: p > 0 });
  }
  return { one, days, checkins, complete, best, months, rate: possible ? done / possible : 0 };
}

function heatHTML(info) {
  const ws = settings().weekStart, todayKey = Dates.key(Dates.today());
  // The squares run down each week, one column per week, like a contributions graph.
  const slots = Array(((info.days[0].dt.getDay() - ws) + 7) % 7).fill(null).concat(info.days);
  while (slots.length % 7) slots.push(null);
  const past = info.days.filter(x => !x.future);
  const focusKey = past.length ? Dates.key(past[past.length - 1].dt) : '';
  let html = '<span></span>' + Array.from({ length: 7 }, (_, i) => `<span class="hl">${i % 2 ? '' : WEEKDAYS[(i + ws) % 7].slice(0, 3)}</span>`).join('');
  for (let w = 0; w < slots.length; w += 7) {
    const week = slots.slice(w, w + 7), first = week.find(x => x && x.dt.getDate() === 1);
    html += `<span class="ml">${first ? MONTHS[first.dt.getMonth()].slice(0, 3) : ''}</span>`;
    for (const x of week) {
      if (!x) { html += '<i class="yd off"></i>'; continue; }
      if (x.future) { html += '<i class="yd future"></i>'; continue; }
      const k = Dates.key(x.dt), label = `${WEEKDAYS[x.dt.getDay()]}, ${MONTHS[x.dt.getMonth()]} ${x.dt.getDate()}: `
        + (x.total ? (info.one ? (x.done ? 'done' : 'not done') : `${x.done} of ${x.total} done`) : 'nothing to track');
      html += `<button class="yd${k === todayKey ? ' today' : ''}" style="--mix:${x.total ? Math.round((x.done / x.total) * 85) : 0}%" data-action="day" data-date="${k}" `
        + `tabindex="${k === focusKey ? 0 : -1}" aria-label="${label}" title="${label}"></button>`;
    }
  }
  return `<div class="heat-wrap"><div class="heat" role="group" aria-label="Days of ${App.year}. Use the arrow keys to move between days."${info.one ? ` style="${habitVars(info.one)};--heat:var(--hc)"` : ''}>${html}</div></div>
    <div class="heat-legend" aria-hidden="true">Less ${[0, 25, 50, 70, 85].map(m => `<i class="yd" style="--mix:${m}%"></i>`).join('')} More</div>`;
}

function yearBody() {
  const info = yearInfo(), tile = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  const color = info.one ? info.one.color : 'var(--accent)';
  return `<div class="stats year-stats">${tile(info.checkins, 'Check-ins')}${tile(info.complete, info.one ? 'Days done' : 'Perfect days')}
      ${tile(info.best, info.one ? 'Longest streak' : 'Longest perfect run')}${tile(pct(info.rate) + '%', 'Year rate')}</div>
    ${heatHTML(info)}
    <h3 class="sub">By month</h3>
    <div class="bars">${info.months.map((x, i) => `<div class="bar-row" style="--i:${i}"><span class="bar-name">${MONTHS[x.m]}</span>
      <span class="bar"><i style="width:${pct(x.pct)}%;background:${color}"></i></span><b>${x.any ? pct(x.pct) + '%' : '–'}</b></div>`).join('')}</div>`;
}

function viewYear() {
  const today = Dates.today(), isCur = App.year >= today.getFullYear(), hs = gridHabits();
  const first = App.data.habits.reduce((a, h) => Math.min(a, +h.created.slice(0, 4)), today.getFullYear());
  if (App.yearHabit && !hs.some(h => h.id === App.yearHabit)) App.yearHabit = null;
  const head = `<header class="page-head">
    <div><h1>Year</h1><p class="muted">Every day of ${App.year} at a glance. Darker squares mean more habits done.</p></div>
    <div class="month-nav">
      ${isCur ? '' : '<button class="btn sm ghost" data-action="year" data-d="0">This year</button>'}
      <button class="icon-btn" data-action="year" data-d="-1" aria-label="Previous year" ${App.year <= first ? 'disabled' : ''}>${I.left}</button>
      <span class="month-title">${App.year}</span>
      <button class="icon-btn" data-action="year" data-d="1" aria-label="Next year" ${isCur ? 'disabled' : ''}>${I.right}</button>
    </div></header>` + gridBar();
  if (!hs.length) return head + gridEmpty();
  const chip = (id, label, on) => `<button class="chip" aria-pressed="${on}" data-action="yearHabit" data-h="${id}">${label}</button>`;
  return head + `<section class="card">
    <div class="chips" role="group" aria-label="Show">${chip('', 'All habits', !App.yearHabit)}${hs.map(h => chip(h.id, `${esc(h.icon)} ${esc(h.name)}`, h.id === App.yearHabit)).join('')}</div>
    <div id="year-body">${yearBody()}</div></section>`;
}

// Rebuilt after every change, keeping the scroll position, the day with the tab stop and the
// day to return focus to (the square that opened a day's window).
function refreshYear() {
  const body = App.view === 'year' && $('#year-body');
  if (!body) return;
  const wrap = $('.heat-wrap', body), left = wrap ? wrap.scrollLeft : 0;
  const dayOf = el => (el && el.matches && el.matches('.heat .yd[data-date]') && body.contains(el) ? el.dataset.date : null);
  const stop = dayOf($('.heat .yd[tabindex="0"]', body)), active = dayOf(document.activeElement), back = dayOf(App.lastFocus);
  body.innerHTML = yearBody();
  const cell = k => k && $(`.heat .yd[data-date="${k}"]`, body);
  if ($('.heat-wrap', body)) $('.heat-wrap', body).scrollLeft = left;
  if (cell(stop)) { for (const c of $$('.heat .yd[tabindex="0"]', body)) c.tabIndex = -1; cell(stop).tabIndex = 0; }
  if (cell(back)) App.lastFocus = cell(back);
  if (cell(active)) cell(active).focus();
}

// After a page re-render, put focus back on the same arrow button (or "previous" when that one
// is gone or disabled), so keyboard users can keep pressing it.
function refocusNav(action, d) {
  const same = $(`[data-action="${action}"][data-d="${d}"]`);
  const el = same && !same.disabled ? same : $(`[data-action="${action}"][data-d="-1"]`);
  if (el) el.focus();
}

function scrollToTodaySquare(view) {
  const wrap = $('.heat-wrap', view), cell = $('.yd.today', view);
  if (wrap && cell && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = cell.offsetLeft - wrap.clientWidth / 2;
}

// Arrow keys move between days (one tab stop for the whole year).
document.addEventListener('keydown', e => {
  const cell = e.target.closest && e.target.closest('.heat .yd[data-date]');
  const step = cell && { ArrowDown: 1, ArrowUp: -1, ArrowRight: 7, ArrowLeft: -7, Home: -Infinity, End: Infinity }[e.key];
  if (!step) return;
  e.preventDefault();
  const cells = $$('.heat .yd[data-date]'), i = cells.indexOf(cell);
  const next = cells[Math.max(0, Math.min(cells.length - 1, i + step))];
  cell.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
});

/* ---------- today / focus ---------- */
const streakText = st => (st.current ? `🔥 ${st.current}-day streak` : st.best ? `Best streak: ${st.best} day${st.best > 1 ? 's' : ''}` : 'Start a streak today');

function focusItem(h, date, i, hide) {
  const on = Habits.isDone(App.data, h.id, date);
  return `<li style="--i:${i}"${hide && on ? ' class="gone"' : ''}><button class="focus-item${on ? ' done' : ''}" style="${habitVars(h)}" data-action="toggleItem" data-h="${h.id}" data-date="${Dates.key(date)}" aria-pressed="${on}">
    <span class="fi-icon">${esc(h.icon)}</span><span class="fi-text"><b>${esc(h.name)}</b><small>${streakText(Habits.streaks(App.data, h))}</small></span>
    <span class="fi-check">${CHECK}</span></button></li>`;
}

function todayMsg(ds) {
  if (!ds.total) return 'Nothing scheduled yet';
  if (ds.done === ds.total) return 'Perfect day! Everything is done 🎉';
  if (!ds.done) return "Let's get started";
  return ds.done / ds.total >= 0.5 ? 'More than halfway there' : 'Good start, keep going';
}

const switchBtn = (k, on, label) => `<button class="switch" role="switch" aria-checked="${!!on}" data-action="flip" data-k="${k}" aria-label="${label}"><i></i></button>`;

function viewToday() {
  const t = Dates.today(), s = settings(), hs = App.data.habits;
  const head = `<header class="page-head"><div><h1>Today</h1><p class="muted">${WEEKDAYS[t.getDay()]}, ${MONTHS[t.getMonth()]} ${t.getDate()} · focus on what's left</p></div>
    ${hs.length ? `<div class="inline-switch"><span>Hide completed</span>${switchBtn('hideDone', s.hideDone, 'Hide completed habits')}</div>` : ''}</header>`;
  if (!hs.length) return head + emptyState();
  const ds = Habits.dayStats(App.data, t);
  const why = App.data.plan && answerLabel('why', App.data.plan.why);
  const quote = why ? `<span class="your-why">Your why</span> ${esc(why)}` : QUOTES[Math.floor(t / 864e5) % QUOTES.length];
  return head + `<section class="card today-hero">
      <div class="donut-ring">${Charts.ring(ds.pct || 0, { size: 132, stroke: 11 })}<div class="donut-txt"><b id="t-pct">${pct(ds.pct)}%</b><span id="t-count">${ds.done} of ${ds.total}</span></div></div>
      <div class="hero-text"><h2 id="t-msg">${todayMsg(ds)}</h2><p class="muted">${quote}</p></div>
    </section>
    <ul class="focus-list" id="focus">${todayItems(t, s.hideDone)}</ul>
    <p class="muted center" id="all-done" ${s.hideDone && ds.done === ds.total ? '' : 'hidden'}>All done for today. Enjoy the rest of your day ✨</p>`;
}

// Today shows every grid's habits, under a heading per grid when there's more than one.
function todayItems(t, hide) {
  const groups = App.data.grids.length > 1;
  let i = 0;
  return App.data.grids.map(g => {
    const list = gridHabits(g);
    if (!list.length) return '';
    const allHidden = hide && list.every(h => Habits.isDone(App.data, h.id, t));
    return (groups ? `<li class="focus-group${allHidden ? ' gone' : ''}" style="--i:${i}"><span aria-hidden="true">${esc(g.icon)}</span>${esc(g.name)}</li>` : '')
      + list.map(h => focusItem(h, t, i++, hide)).join('');
  }).join('');
}
// With "Hide completed", a grid's heading goes once all of its habits are hidden.
function syncGroupHeads() {
  for (const head of $$('#focus .focus-group')) {
    let li = head.nextElementSibling, any = false;
    for (; li && !li.classList.contains('focus-group'); li = li.nextElementSibling) if (!li.classList.contains('gone')) any = true;
    head.classList.toggle('gone', !any);
  }
}

function refreshFocusItems() {
  for (const el of $$('.focus-item[data-date]')) {
    const h = habitById(el.dataset.h);
    if (!h) continue;
    const on = Habits.isDone(App.data, h.id, Dates.parse(el.dataset.date));
    el.classList.toggle('done', on);
    el.setAttribute('aria-pressed', on);
    $('small', el).textContent = streakText(Habits.streaks(App.data, h));
  }
}

function refreshToday() {
  if (App.view !== 'today' || !$('.today-hero')) return;
  const ds = Habits.dayStats(App.data, Dates.today()), s = settings();
  Charts.setRing($('.today-hero .ring'), ds.pct || 0);
  $('#t-pct').textContent = pct(ds.pct) + '%';
  $('#t-count').textContent = `${ds.done} of ${ds.total}`;
  $('#t-msg').textContent = todayMsg(ds);
  if (s.hideDone) {
    const delay = s.motion === 'off' ? 0 : 500;
    for (const li of $$('#focus li:not(.gone):not(.vanish)')) {
      if (!$('.focus-item.done', li)) continue;
      setTimeout(() => {
        if (!$('.focus-item.done', li)) return;
        li.classList.add('vanish');
        setTimeout(() => { li.classList.add('gone'); syncGroupHeads(); }, delay ? 350 : 0);
      }, delay);
    }
  }
  $('#all-done').hidden = !(s.hideDone && ds.total && ds.done === ds.total);
}

/* ---------- day editing ---------- */
const STREAK_MILESTONES = [7, 14, 21, 30, 50, 100, 150, 200, 365];

function setDone(id, date, on) {
  const h = habitById(id);
  if (!h) return;
  const today = Dates.today(), before = Habits.dayStats(App.data, today);
  const key = Dates.key(date), streakBefore = Habits.streaks(App.data, h).current;
  if (on && key < h.created) h.created = key; // backfilling extends the habit's start
  Habits.setDone(App.data, id, date, on);
  save();
  refreshFocusItems();
  refreshTracker();
  refreshWeek();
  refreshYear();
  refreshToday();
  const after = Habits.dayStats(App.data, today);
  const perfect = on && key === Dates.key(today) && after.total && after.done === after.total && before.done < before.total;
  // A tick that grows the habit's current streak to 2+ days gets confetti; milestones get more.
  const streak = on ? Habits.streaks(App.data, h).current : 0, streakUp = streak >= 2 && streak > streakBefore;
  const milestone = streakUp && STREAK_MILESTONES.includes(streak);
  if (streakUp || perfect) celebrate(milestone || perfect);
  if (streakUp) toast(milestone ? `🏆 ${streak}-day streak on ${h.name}! Keep it going` : `🔥 ${streak}-day streak: ${h.name}`);
  if (perfect) toast('Perfect day! Every habit done 🎉');
  checkBadges();
}

function openDay(key) {
  const date = Dates.parse(key);
  openModal(`<div class="modal-head"><h2>${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}</h2>${closeBtn}</div>
    <ul class="focus-list one">${gridHabits().map((h, i) => focusItem(h, date, i, false)).join('')}</ul>
    <div class="modal-foot"><span class="grow"></span><button class="btn primary" data-action="closeModal">Done</button></div>`);
}

/* ---------- habit editor ---------- */
function habitModal(h) {
  const isNew = !h;
  h = h || { name: '', icon: '✅', color: ACCENTS[App.data.habits.length % ACCENTS.length] };
  openModal(`<form data-form="habit" data-h="${isNew ? '' : h.id}">
    <div class="modal-head"><h2>${isNew ? 'New habit' : 'Edit habit'}</h2>${closeBtn}</div>
    <label class="field"><span>Name</span><input class="input" name="name" maxlength="40" required value="${esc(h.name)}" placeholder="e.g. Morning walk" autofocus></label>
    <div class="field"><span>Icon</span><div class="emoji-grid">${HABIT_ICONS.map(e => `<button type="button" class="emo" aria-pressed="${e === h.icon}" data-action="pickEmoji" data-v="${e}">${e}</button>`).join('')}
      <input class="emo-custom" name="icon" value="${esc(h.icon)}" maxlength="8" aria-label="Or type any emoji" title="Or type any emoji"></div></div>
    <div class="field"><span>Color</span>${colorRadios('color', h.color)}</div>
    ${App.data.grids.length > 1 ? `<label class="field"><span>Grid</span><select class="input" name="grid">${App.data.grids.map(g =>
      `<option value="${g.id}"${g.id === (h.grid || currentGrid().id) ? ' selected' : ''}>${esc(g.icon)} ${esc(g.name)}</option>`).join('')}</select></label>` : ''}
    ${isNew ? '' : `<div class="row-btns"><button type="button" class="btn ghost sm" data-action="moveHabit" data-h="${h.id}" data-d="-1">${I.up} Move up</button>
      <button type="button" class="btn ghost sm" data-action="moveHabit" data-h="${h.id}" data-d="1">${I.down} Move down</button></div>`}
    <p class="form-err" role="alert"></p>
    <div class="modal-foot">${isNew ? '' : `<button type="button" class="btn ghost danger" data-action="deleteHabit" data-h="${h.id}">${I.trash} Delete</button>`}
      <span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">${isNew ? 'Add habit' : 'Save'}</button></div>
  </form>`);
}

/* ---------- profile ---------- */
function stats() {
  const s = Habits.overall(App.data);
  const cur = App.data.settings;
  s.styled = ['theme', 'accent', 'font'].some(k => k in cur && cur[k] !== DEFAULTS[k]);
  return s;
}

function checkBadges(silent) {
  const st = stats(), have = new Set(App.data.badges);
  const fresh = BADGES.filter(b => !have.has(b.id) && b.test(st));
  if (!fresh.length) return;
  for (const b of fresh) {
    App.data.badges.push(b.id);
    App.newBadges.add(b.id);
    if (!silent) toast(`${b.icon} Achievement unlocked: ${b.name}`);
  }
  save();
}

const menuItem = (action, icon, title, sub, cls = '') => `<button class="menu-item ${cls}" data-action="${action}">${icon}<span><b>${title}</b><small>${sub}</small></span></button>`;

function viewProfile() {
  const u = App.user, st = stats(), have = new Set(App.data.badges);
  const since = new Date(u.created);
  const tile = (n, label) => `<div class="stat"><b data-count="${n}">${n}</b><span>${label}</span></div>`;
  return `<header class="page-head"><div><h1>Profile</h1><p class="muted">Your account, progress and achievements</p></div></header>
    <section class="card profile-card">
      <span class="avatar xl" style="--c:${u.color}">${esc(u.avatar)}</span>
      <div class="pc-info"><h2>${esc(u.displayName)}</h2><p class="muted">${esc(Auth.label(u))} · Member since ${MONTHS[since.getMonth()]} ${since.getFullYear()}</p>
        ${u.google ? `<p class="google-status">${GOOGLE_G}Connected to Google as ${esc(u.google.email)}</p>` : ''}
        ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ''}
        ${App.data.plan && App.data.plan.mode ? `<p class="plan-tags"><span>${answerLabel('mode', App.data.plan.mode)} mode</span>${App.data.plan.peak
          ? `<span>Most locked in: ${answerLabel('peak', App.data.plan.peak)}</span>` : ''}</p>` : ''}</div>
      <button class="btn" data-action="editProfile">${I.edit} Edit profile</button>
    </section>
    <section class="stats">${tile(st.total, 'Total check-ins')}${tile(st.current, 'Current streak')}${tile(st.best, 'Best streak')}${tile(st.perfect, 'Perfect days')}</section>
    <section class="card"><div class="sec-head"><h2>Achievements</h2><span class="muted">${have.size} of ${BADGES.length}</span></div>
      <div class="badges">${BADGES.map((b, i) => `<div class="badge${have.has(b.id) ? '' : ' locked'}${App.newBadges.has(b.id) ? ' new' : ''}" style="--i:${i}">
        <span class="be">${b.icon}</span><span><b>${b.name}</b><small>${b.desc}</small></span></div>`).join('')}</div></section>
    <section class="card"><h2>Account</h2><div class="menu">
      ${menuItem('editProfile', I.edit, 'Edit profile', 'Name, email, bio, avatar and color')}
      ${Auth.hasPassword(u)
        ? menuItem('changePassword', I.key, 'Change password', 'Pick a new password for this profile')
        : menuItem('setPassword', I.key, 'Set a password', 'Also sign in with your email and a password')}
      ${u.google
        ? menuItem('disconnectGoogle', GOOGLE_G, 'Disconnect Google', 'Sign in with your email and password only')
        : googleOn() ? menuItem('connectGoogle', GOOGLE_G, 'Connect Google', 'Sign in with your Google account too') : ''}
      ${Auth.hasPassword(u) ? menuItem('newCode', I.shield, 'New recovery code', 'Lets you reset a forgotten password') : ''}
      ${menuItem('exportData', I.download, 'Export backup', 'Download your habits as a small JSON file')}
      ${menuItem('importData', I.upload, 'Import backup', 'Restore habits from a HabitGrid backup')}
      ${menuItem('logout', I.logout, 'Sign out', 'Switch to another profile on this computer')}
      ${menuItem('deleteAccount', I.trash, 'Delete account', 'Permanently remove this profile and its data', 'danger')}
    </div></section>`;
}

function animateCounts(root) {
  const els = $$('[data-count]', root);
  if (!els.length || settings().motion !== 'full') return;
  const t0 = performance.now(), dur = 800;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3;
    for (const el of els) el.textContent = Math.round(+el.dataset.count * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function exportData() {
  const u = App.user;
  const payload = { app: 'HabitGrid', version: 1, exported: new Date().toISOString(),
    profile: { email: u.email, displayName: u.displayName, avatar: u.avatar, color: u.color, bio: u.bio }, data: App.data };
  const slug = Auth.label(u).split('@')[0].replace(/[^a-z0-9]+/gi, '-').slice(0, 30) || 'profile';
  const name = `habitgrid-${slug}-${Dates.key(new Date())}.json`, text = JSON.stringify(payload);
  if (Store.backend === 'desktop') {
    try {
      if (await Store.api.export_backup(name, text)) toast('Backup saved');
    } catch (err) {
      toast('Could not save the backup');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

function sanitizeData(d) {
  const seen = new Set();
  const habits = d.habits.slice(0, 200)
    .filter(h => h && typeof h.id === 'string' && /^[\w-]{1,24}$/.test(h.id) && !seen.has(h.id) && seen.add(h.id))
    .map(h => ({ id: h.id, name: String(h.name || 'Habit').slice(0, 40), icon: String(h.icon || '✅').slice(0, 8),
      color: pickColor(h.color), created: /^\d{4}-\d{2}-\d{2}$/.test(h.created) ? h.created : Dates.key(Dates.today()),
      grid: typeof h.grid === 'string' ? h.grid : '' }));
  const log = {};
  for (const [mk, row] of Object.entries(d.log || {})) {
    if (!/^\d{4}-\d{2}$/.test(mk) || !row || typeof row !== 'object') continue;
    for (const [id, mask] of Object.entries(row)) if (seen.has(id) && Number.isInteger(mask) && mask) (log[mk] ||= {})[id] = mask | 0;
  }
  const badges = Array.isArray(d.badges) ? d.badges.filter(b => BADGES.some(x => x.id === b)) : [];
  return cleanGrids({ v: 1, habits, log, settings: cleanSettings(d.settings), badges, plan: cleanPlan(d.plan), grids: d.grids, gridId: d.gridId });
}

async function importBackup() {
  if (Store.backend !== 'desktop') return $('#import-file').click(); // continues in importFile
  let text;
  try { text = await Store.api.import_backup(); } catch (err) { return toast(String(err && err.message || err)); }
  if (text != null) await importText(text);
}

async function importFile(file) {
  if (file.size > 2e6) return toast('That file is too large to be a HabitGrid backup');
  await importText(await file.text());
}

async function importText(text) {
  let json;
  try { json = JSON.parse(text); } catch { return toast("That file isn't valid JSON"); }
  const d = json && (json.data || json);
  if (!d || !Array.isArray(d.habits) || typeof d.log !== 'object') return toast("That doesn't look like a HabitGrid backup");
  const ok = await confirmBox('Replace your data?', `This replaces your ${App.data.habits.length} habit(s) and their history with ${d.habits.length} habit(s) from the backup.`, 'Replace');
  if (!ok) return;
  App.data = sanitizeData(d);
  save();
  applySettings();
  renderView(true);
  toast('Backup restored ✅');
}

/* ---------- personalize ---------- */
const seg = (k, opts, cur) => `<div class="seg" role="radiogroup">${opts.map(([v, label]) => `<button role="radio" aria-checked="${String(v) === String(cur)}" data-action="set" data-k="${k}" data-v="${v}">${label}</button>`).join('')}</div>`;
const setRow = (label, hint, control) => `<div class="set-row"><div><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div>${control}</div>`;

function storageHTML() {
  const used = Store.bytesUsed(), mine = Store.size('data.' + App.user.id), cap = 5 * 1048576;
  const where = Store.backend === 'desktop' ? `Saved in <code>${esc(Store.info.dataFile)}</code>, with the previous version kept as a backup.` : 'Saved in this browser.';
  return `<div class="meter"><i style="width:${Math.max(0.5, (used / cap) * 100).toFixed(2)}%"></i></div>
    <p class="muted">Your data: <b>${fmtBytes(mine)}</b> · All profiles: <b>${fmtBytes(used)}</b> of the 5 MB limit.
    Check-ins are packed into bitmasks, so years of history stay tiny.</p><p class="muted">${where}</p>`;
}

function viewSettings() {
  const s = settings();
  return `<header class="page-head"><div><h1>Personalize</h1><p class="muted">Make HabitGrid yours. Settings are saved to your profile.</p></div></header>
    <section class="card"><h2>Theme</h2><div class="themes">${THEMES.map(t => `<button class="theme-card" aria-pressed="${s.theme === t.id}" data-action="set" data-k="theme" data-v="${t.id}">
      <span class="tc-prev" style="--tb:${t.bg};--ts:${t.surface};--tt:${t.text}"><i class="s"></i><i class="l1"></i><i class="l2"></i><i class="a"></i></span>${t.name}</button>`).join('')}</div></section>
    <section class="card"><h2>Accent color</h2><div class="swatches big">${ACCENTS.map(c => `<button class="sw" style="--c:${c}" aria-pressed="${c === s.accent}" data-action="set" data-k="accent" data-v="${c}" aria-label="Accent ${c}"><i></i></button>`).join('')}
      <label class="sw custom" title="Custom color" data-on="${!ACCENTS.includes(s.accent)}"><input type="color" value="${s.accent}" data-setting="accent" aria-label="Custom accent color"><i></i></label></div></section>
    <section class="card"><h2>Look &amp; feel</h2>
      ${setRow('Font', '', seg('font', [['system', 'System'], ['rounded', 'Rounded'], ['serif', 'Serif'], ['mono', 'Mono']], s.font))}
      ${setRow('Text size', '', seg('size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], s.size))}
      ${setRow('Density', 'Compact fits more days on screen', seg('density', [['compact', 'Compact'], ['comfortable', 'Comfortable']], s.density))}
      ${setRow('Corners', '', seg('radius', [['sharp', 'Sharp'], ['rounded', 'Rounded'], ['round', 'Round']], s.radius))}
      ${setRow('Checkbox style', '', seg('cb', [['square', 'Square'], ['circle', 'Circle']], s.cb))}
      ${setRow('Color checkboxes by habit', 'Use each habit\'s own color instead of the accent', switchBtn('habitColors', s.habitColors, 'Color checkboxes by habit'))}
      ${setRow('Progress rings', 'Show a ring next to each habit\'s monthly %', switchBtn('showRings', s.showRings, 'Progress rings'))}
      ${setRow('Chart labels', 'Show % above points on the chart', switchBtn('labels', s.labels, 'Chart labels'))}
    </section>
    <section class="card"><h2>Behavior</h2>
      ${setRow('Animations', 'Reduced keeps fades but drops movement', seg('motion', [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']], s.motion))}
      ${setRow('Confetti', 'For streaks and perfect days (needs Animations set to Full)', switchBtn('celebrate', s.celebrate, 'Confetti for streaks and perfect days'))}
      ${setRow('Week starts on', 'Used by the calendar, Week and Year', seg('weekStart', [[1, 'Monday'], [0, 'Sunday']], s.weekStart))}
      ${setRow('Open the app on', '', seg('startView', [['tracker', 'Tracker'], ['week', 'Week'], ['year', 'Year'], ['today', 'Today']], s.startView))}
    </section>
    <section class="card"><h2>Storage</h2><div id="storage">${storageHTML()}</div>
      <div class="row-btns"><button class="btn sm" data-action="cleanup">${I.broom} Clean up</button><button class="btn sm" data-action="exportData">${I.download} Export backup</button></div></section>
    <div class="row-btns center"><button class="btn ghost" data-action="resetLook">Reset personalization</button></div>
    ${Store.info.version ? `<p class="muted center version">HabitGrid ${esc(Store.info.version)}</p>` : ''}`;
}

function syncControls() {
  const s = settings();
  for (const el of $$('[data-action="set"]')) {
    el.setAttribute(el.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed', String(s[el.dataset.k]) === el.dataset.v);
  }
  for (const el of $$('[data-action="flip"]')) el.setAttribute('aria-checked', !!s[el.dataset.k]);
  const custom = $('.sw.custom');
  if (custom) {
    custom.dataset.on = !ACCENTS.includes(s.accent);
    $('input', custom).value = s.accent;
  }
}

function updateSetting(k, v) {
  App.data.settings = cleanSettings({ ...App.data.settings, [k]: v });
  save();
  applySettings();
  syncControls();
  checkBadges();
  if (k === 'hideDone' && App.view === 'today') renderView(false);
}

/* ---------- actions ---------- */
const ACTIONS = {
  authMode(el) {
    AuthUI.mode = el.dataset.m;
    if (el.dataset.m === 'pick' || el.dataset.m === 'register') AuthUI.pick = null;
    // Answers belong to the sign-up they were made for: leaving that flow drops them.
    if (el.dataset.skip || !['intro', 'quiz', 'commit', 'register'].includes(el.dataset.m)) AuthUI.plan = AuthUI.quiz = null;
    renderAuth();
  },
  pickProfile(el) { AuthUI.mode = 'login'; AuthUI.pick = el.dataset.u; renderAuth(); },
  peek(el) {
    const input = $('input', el.parentElement), show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    el.setAttribute('aria-pressed', show);
    el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  },
  copyCode(el) {
    if (!navigator.clipboard) return toast('Copy the code by selecting it');
    navigator.clipboard.writeText(el.dataset.code).then(() => toast('Recovery code copied'), () => toast('Copy the code by selecting it'));
  },
  enter() {
    Auth.startSession(AuthUI.next, AuthUI.remember);
    const u = Auth.current();
    if (!u) return renderAuth();
    const reset = AuthUI.reset, plan = AuthUI.plan;
    enterApp(u);
    if (!reset) applyPlan(plan);
    toast(reset ? 'Password updated' : `Welcome, ${u.displayName}! 👋`);
  },
  quizStart() {
    AuthUI.quiz = { step: 0, answers: {} };
    AuthUI.plan = null;
    quizGo(0);
  },
  quizPick(el) {
    const q = QUESTIONS[AuthUI.quiz.step], answers = AuthUI.quiz.answers, v = el.dataset.v;
    if (q.max) {
      const list = answers[q.id] || (answers[q.id] = []);
      if (list.includes(v)) list.splice(list.indexOf(v), 1);
      else if (list.length >= q.max) return toast(`Pick up to ${q.max}`);
      else list.push(v);
      el.setAttribute('aria-checked', list.includes(v));
      $('[data-action="quizNext"]').disabled = !list.length;
      return;
    }
    answers[q.id] = v; // one answer: show it picked, then move on
    for (const b of $$('.quiz-opt')) b.setAttribute('aria-checked', b === el);
    setTimeout(() => { if (AuthUI.mode === 'quiz' && QUESTIONS[AuthUI.quiz.step] === q) quizGo(AuthUI.quiz.step + 1); }, 260);
  },
  quizNext() { quizGo(AuthUI.quiz.step + 1); },
  quizBack() {
    if (AuthUI.mode === 'quiz' && AuthUI.quiz.step === 0) { AuthUI.mode = 'intro'; return renderAuth(); }
    quizGo(AuthUI.quiz.step - 1);
  },
  logout() {
    Auth.logout();
    App.user = App.data = null;
    closeModal(true);
    Object.assign(AuthUI, { mode: null, pick: null });
    history.replaceState(null, '', location.pathname + location.search);
    renderAuth();
  },
  async googleSignIn(el) {
    // The "Keep me signed in" box on the same screen (every sign-in screen with a Google button has one).
    const screen = el.closest('form') || el.closest('.auth-card');
    const box = screen && screen.querySelector('input[name="remember"]');
    const remember = box ? box.checked : true;
    // On a chosen profile's screen ("Hi, Mom"), only that profile's Google account signs in:
    // picking another account in Google's chooser mustn't open or create a different profile.
    const picked = AuthUI.mode === 'login' && AuthUI.pick ? Auth.byLogin(AuthUI.pick) : null;
    const screenBefore = { mode: AuthUI.mode, pick: AuthUI.pick };
    const identity = await googleIdentity(picked && picked.google ? picked.google.email : null);
    if (!identity) return;
    // The answer belongs to the screen it was asked from (the dialog blocks the page meanwhile).
    if (App.user || AuthUI.mode !== screenBefore.mode || AuthUI.pick !== screenBefore.pick) return;
    if (picked && picked.google && !Auth.verifyGoogle(picked.id, identity)) {
      return showMessage("That's a different Google account",
        `${Auth.label(picked)} signs in with ${picked.google.email}. Choose that account in Google, or go back to all profiles to use another one.`);
    }
    let result;
    try {
      result = Auth.googleSignIn(identity, { avatar: pickRandom(AVATARS), color: pickRandom(ACCENTS) }, remember);
    } catch (err) {
      return showMessage("Couldn't sign in with Google", err.message);
    }
    if (result.link) {
      Object.assign(AuthUI, { mode: 'linkGoogle', pick: Auth.label(result.link), identity, remember });
      return renderAuth();
    }
    const plan = screenBefore.mode === 'register' ? AuthUI.plan : null; // only "Sign up with Google" after the questions
    enterApp(result.user);
    if (result.created) applyPlan(plan);
    toast(result.created ? `Welcome, ${result.user.displayName}! 👋` : `Welcome back, ${result.user.displayName} 👋`);
  },
  connectGoogle() {
    openModal(`<form data-form="connectGoogle"><div class="modal-head"><h2>Connect Google</h2>${closeBtn}</div>
      <p class="muted">Enter your HabitGrid password, then choose your Google account in your browser.</p><br>
      ${pwField('password', 'Password', 'current-password', 'autofocus')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">Continue with Google</button></div></form>`);
  },
  disconnectGoogle() {
    if (!Auth.hasPassword(App.user)) return toast('Set a password first, or you could no longer sign in.');
    openModal(`<form data-form="disconnectGoogle"><div class="modal-head"><h2>Disconnect Google?</h2>${closeBtn}</div>
      <p class="muted">You will sign in with your email and password only. Enter your password to confirm.</p><br>
      ${pwField('password', 'Password', 'current-password', 'autofocus')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn danger solid">Disconnect</button></div></form>`);
  },
  async deleteWithGoogle() {
    const identity = await googleIdentity(App.user.google && App.user.google.email);
    if (!identity) return;
    if (!Auth.verifyGoogle(App.user.id, identity)) return showMessage("That's a different Google account", `Confirm with ${App.user.google.email}.`);
    deleteCurrentAccount();
  },

  month(el) {
    const d = +el.dataset.d, t = Dates.today();
    const next = d === 0 ? new Date(t.getFullYear(), t.getMonth(), 1) : new Date(App.y, App.m + d, 1);
    if (next > t) return;
    App.y = next.getFullYear();
    App.m = next.getMonth();
    renderView(true);
  },
  toggle(el) {
    replay(el, 'pop');
    setDone(el.dataset.h, new Date(App.y, App.m, +el.dataset.d), el.getAttribute('aria-pressed') !== 'true');
  },
  toggleItem(el) {
    replay(el, 'pop');
    setDone(el.dataset.h, Dates.parse(el.dataset.date), el.getAttribute('aria-pressed') !== 'true');
  },
  tab(el) {
    App.tab = el.dataset.t;
    for (const b of $$('.tabs [role="tab"]')) b.setAttribute('aria-selected', b.dataset.t === App.tab);
    $('#progress-body').innerHTML = progressHTML(settings().motion !== 'off');
  },
  day(el) { openDay(el.dataset.date); },
  week(el) {
    const d = +el.dataset.d;
    App.weekOffset = d === 0 ? 0 : Math.min(0, App.weekOffset + d);
    renderView(true);
    refocusNav('week', el.dataset.d);
  },
  year(el) {
    const d = +el.dataset.d, now = Dates.today().getFullYear();
    App.year = d === 0 ? now : Math.min(now, App.year + d);
    renderView(true);
    refocusNav('year', el.dataset.d);
  },
  yearHabit(el) {
    App.yearHabit = el.dataset.h || null;
    for (const b of $$('.chips .chip')) b.setAttribute('aria-pressed', b === el);
    refreshYear();
  },

  pickGrid(el) {
    App.data.gridId = el.dataset.g;
    App.yearHabit = null;
    save();
    renderView(false);
    const tab = $(`.grid-tab[data-g="${el.dataset.g}"]`);
    if (tab) tab.focus(); // keyboard users stay on the tabs
  },
  newGrid() { gridModal(null); },
  editGrid() { gridModal(currentGrid()); },
  moveGrid(el) {
    const list = App.data.grids, i = list.findIndex(g => g.id === el.dataset.g), j = i + +el.dataset.d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    renderView(false);
    toast(`Moved ${+el.dataset.d < 0 ? 'left' : 'right'}`);
  },
  async deleteGrid(el) {
    const g = App.data.grids.find(x => x.id === el.dataset.g);
    if (!g || App.data.grids.length < 2) return;
    const form = el.closest('form'), typed = form && { id: g.id, name: form.elements.name.value, icon: form.elements.icon.value };
    const hs = gridHabits(g), n = hs.length;
    const ok = await confirmBox(`Delete “${g.name}”?`, n
      ? `Its ${n} habit${n === 1 ? '' : 's'} and their history are deleted too. To keep a habit, move it to another grid first (Edit habit → Grid). This can't be undone.`
      : 'This grid has no habits.', 'Delete');
    if (!ok) { if (typed) gridModal(typed); return; } // back to Edit grid, with what was typed
    App.data.habits = App.data.habits.filter(h => h.grid !== g.id);
    for (const h of hs) Habits.purge(App.data, h.id);
    App.data.grids = App.data.grids.filter(x => x !== g);
    cleanGrids(App.data);
    App.yearHabit = null;
    save();
    renderView(false);
    const tab = $('.grid-tab[aria-pressed="true"]');
    if (tab) tab.focus(); // the dialog's opener is gone; land on the grid that's now shown
    toast('Grid deleted');
  },

  newHabit() { habitModal(null); },
  editHabit(el) { habitModal(habitById(el.dataset.h)); },
  pickEmoji(el) {
    const form = el.closest('form');
    form.elements.icon.value = el.dataset.v;
    for (const b of $$('.emo', form)) b.setAttribute('aria-pressed', b === el);
  },
  moveHabit(el) {
    const list = App.data.habits, i = list.findIndex(h => h.id === el.dataset.h), d = +el.dataset.d;
    if (i < 0) return;
    let j = i + d; // the next habit in the same grid
    while (j >= 0 && j < list.length && list[j].grid !== list[i].grid) j += d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    renderView(false);
    toast(`Moved ${+el.dataset.d < 0 ? 'up' : 'down'}`);
  },
  async deleteHabit(el) {
    const h = habitById(el.dataset.h);
    if (!h || !(await confirmBox(`Delete “${h.name}”?`, "Its history is removed too. This can't be undone.", 'Delete'))) return;
    App.data.habits = App.data.habits.filter(x => x !== h);
    Habits.purge(App.data, h.id);
    save();
    renderView(false);
    toast('Habit deleted');
  },
  starter() {
    const key = Dates.key(Dates.today()), grid = currentGrid().id;
    for (const [name, icon, color] of STARTERS) App.data.habits.push({ id: Habits.newId(), name, icon, color, created: key, grid });
    save();
    renderView(true);
    checkBadges();
    toast('Starter habits added — edit or delete any of them');
  },

  set(el) { updateSetting(el.dataset.k, el.dataset.k === 'weekStart' ? +el.dataset.v : el.dataset.v); },
  flip(el) { updateSetting(el.dataset.k, !settings()[el.dataset.k]); },
  async resetLook() {
    if (!(await confirmBox('Reset personalization?', 'Theme, colors, fonts and behavior go back to their defaults. Your habits are not touched.', 'Reset', false))) return;
    App.data.settings = {};
    save();
    applySettings();
    renderView(false);
    toast('Personalization reset');
  },
  cleanup() {
    const before = Store.size('data.' + App.user.id);
    Habits.compact(App.data);
    save();
    $('#storage').innerHTML = storageHTML();
    toast(`Cleaned up · freed ${fmtBytes(Math.max(0, before - Store.size('data.' + App.user.id)))}`);
  },

  editProfile() {
    const u = App.user;
    openModal(`<form data-form="profile"><div class="modal-head"><h2>Edit profile</h2>${closeBtn}</div>
      <label class="field"><span>Display name</span><input class="input" name="displayName" maxlength="30" required value="${esc(u.displayName)}" autofocus></label>
      <label class="field"><span>Email</span><input class="input" name="email" type="email" maxlength="254" ${u.email ? 'required' : ''} autocomplete="email"
        value="${esc(u.email || '')}" data-orig="${esc(u.email || '')}" placeholder="${u.email ? 'you@example.com' : 'Optional: add an email to sign in with it'}"></label>
      ${Auth.hasPassword(u) ? `<div class="email-pw" hidden>${pwField('password', 'Password (to change your email)', 'current-password', 'disabled')}</div>` : ''}
      <label class="field"><span>Bio</span><input class="input" name="bio" maxlength="80" value="${esc(u.bio || '')}" placeholder="A short motto or goal"></label>
      <div class="field"><span>Avatar</span>${avatarPicker(u.avatar)}</div>
      <div class="field"><span>Profile color</span>${colorRadios('color', u.color)}</div>
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">Save</button></div></form>`);
  },
  changePassword() {
    openModal(`<form data-form="password"><div class="modal-head"><h2>Change password</h2>${closeBtn}</div>
      ${pwField('current', 'Current password', 'current-password', 'autofocus')}
      ${pwField('next', 'New password', 'new-password', 'minlength="6" data-strength')}${strengthMeter}
      ${pwField('confirm', 'Confirm new password', 'new-password', 'minlength="6"')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">Change password</button></div></form>`);
  },
  setPassword() {
    openModal(`<form data-form="setPassword"><div class="modal-head"><h2>Set a password</h2>${closeBtn}</div>
      <p class="muted">Then you can also sign in with ${esc(App.user.email)} and this password. To make sure it's you, you'll confirm with Google first.</p><br>
      ${pwField('next', 'New password', 'new-password', 'minlength="6" data-strength autofocus')}${strengthMeter}
      ${pwField('confirm', 'Confirm password', 'new-password', 'minlength="6"')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">Confirm with Google</button></div></form>`);
  },
  newCode() {
    openModal(`<form data-form="newCode"><div class="modal-head"><h2>New recovery code</h2>${closeBtn}</div>
      <p class="muted">Your old code stops working. Enter your password to continue.</p><br>
      ${pwField('password', 'Password', 'current-password', 'autofocus')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">Create code</button></div></form>`);
  },
  exportData,
  importData() { importBackup(); },
  deleteAccount() {
    const warning = `<p class="muted">This permanently removes <b>${esc(Auth.label(App.user))}</b>, its habits and history from this computer. Export a backup first if you might want it back.</p>`;
    if (!Auth.hasPassword(App.user)) {
      return openModal(`<div class="modal-head"><h2>Delete account?</h2>${closeBtn}</div>${warning}
        <div class="modal-foot"><span class="grow"></span><button class="btn ghost" data-action="closeModal">Cancel</button>
        <button class="btn danger solid" data-action="deleteWithGoogle">Confirm with Google and delete</button></div>`);
    }
    openModal(`<form data-form="deleteAccount"><div class="modal-head"><h2>Delete account?</h2>${closeBtn}</div>${warning}<br>
      ${pwField('password', 'Password', 'current-password', 'autofocus')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn danger solid">Delete forever</button></div></form>`);
  },

  closeModal() { closeModal(); },
  confirmYes() {
    const r = App.confirm;
    App.confirm = null;
    closeModal();
    if (r) r(true);
  },
};

/* ---------- forms ---------- */
const FORMS = {
  async login(f, fd) {
    const u = await Auth.login(fd.get('login'), fd.get('password'), fd.has('remember'));
    enterApp(u);
    toast(`Welcome back, ${u.displayName} 👋`);
  },
  async register(f, fd) {
    if (fd.get('password') !== fd.get('confirm')) throw new Error("Passwords don't match.");
    const { user, code } = await Auth.register({ email: fd.get('email'), displayName: fd.get('displayName'),
      password: fd.get('password'), avatar: pickAvatar(fd.get('avatar')), color: pickColor(fd.get('color')) });
    if (AuthUI.plan) { // save the answers with the account now, in case the app closes on the code screen
      const d = loadData(user.id);
      planInto(d, AuthUI.plan);
      Store.write('data.' + user.id, d);
    }
    Object.assign(AuthUI, { mode: 'code', code, next: user.id, remember: fd.has('remember'), reset: false });
    renderAuth();
  },
  async recover(f, fd) {
    const { user, code } = await Auth.resetWithCode(fd.get('login'), fd.get('code'), fd.get('password'));
    Object.assign(AuthUI, { mode: 'code', code, next: user.id, remember: true, reset: true });
    renderAuth();
  },
  async linkGoogle(f, fd) {
    const u = Auth.byLogin(AuthUI.pick);
    const user = await Auth.linkGoogle(u.id, fd.get('password'), AuthUI.identity, AuthUI.remember);
    enterApp(user);
    toast('Google connected: you can now sign in either way');
  },
  async connectGoogle(f, fd) {
    const password = fd.get('password');
    await Auth.confirmPassword(App.user.id, password); // a wrong one shows here, before the browser
    const identity = await googleIdentity(); // replaces this dialog while it waits
    if (!identity) return;
    try {
      App.user = await Auth.connectGoogle(App.user.id, identity, password);
    } catch (err) {
      return showMessage("Couldn't connect Google", err.message);
    }
    renderView(false);
    toast('Google connected: you can now sign in with it too');
  },
  async setPassword(f, fd) {
    if (fd.get('next') !== fd.get('confirm')) throw new Error("Passwords don't match.");
    if (String(fd.get('next')).length < 6) throw new Error('Password must be at least 6 characters.');
    const identity = await googleIdentity(App.user.google && App.user.google.email); // replaces this dialog while it waits
    if (!identity) return;
    if (!Auth.verifyGoogle(App.user.id, identity)) return showMessage("That's a different Google account", `Confirm with ${App.user.google.email}.`);
    const code = await Auth.addPassword(App.user.id, fd.get('next'));
    App.user = Auth.current();
    renderView(false);
    showRecoveryCode(code, 'Password set 🔒');
  },
  habit(f, fd) {
    const name = String(fd.get('name') || '').trim().slice(0, 40);
    if (!name) throw new Error('Give your habit a name.');
    const icon = String(fd.get('icon') || '').trim().slice(0, 8) || '✅', color = pickColor(fd.get('color'));
    const grid = App.data.grids.find(g => g.id === fd.get('grid')) || currentGrid();
    const id = f.dataset.h, h = id && habitById(id), moved = h && h.grid !== grid.id;
    if (h) Object.assign(h, { name, icon, color, grid: grid.id });
    else {
      App.flash = Habits.newId();
      App.data.habits.push({ id: App.flash, name, icon, color, created: Dates.key(Dates.today()), grid: grid.id });
      App.data.gridId = grid.id; // show the grid it went into
    }
    save();
    closeModal();
    renderView(false);
    checkBadges();
    toast(moved ? `Moved to ${grid.icon} ${grid.name}` : h ? 'Habit updated' : `${icon} ${name} added`);
  },
  grid(f, fd) {
    const name = String(fd.get('name') || '').trim().slice(0, 30);
    if (!name) throw new Error('Give your grid a name.');
    const icon = String(fd.get('icon') || '').trim().slice(0, 8) || '✅';
    const g = App.data.grids.find(x => x.id === f.dataset.g);
    if (g) Object.assign(g, { name, icon });
    else {
      if (App.data.grids.length >= MAX_GRIDS) throw new Error(`You can have up to ${MAX_GRIDS} grids.`);
      const id = 'g' + Habits.newId().slice(1);
      App.data.grids.push({ id, name, icon });
      App.data.gridId = id;
      App.yearHabit = null;
    }
    save();
    closeModal();
    renderView(!g);
    toast(g ? 'Grid updated' : `${icon} ${name} created`);
  },
  async profile(f, fd) {
    const displayName = String(fd.get('displayName') || '').trim().slice(0, 30);
    if (!displayName) throw new Error('Display name is required.');
    // A profile from before emails may leave it empty; changing an email needs the password.
    const email = String(fd.get('email') || '').trim();
    if (email || App.user.email) await Auth.setEmail(App.user.id, email, fd.get('password'));
    App.user = Auth.update(App.user.id, { displayName, bio: String(fd.get('bio') || '').trim().slice(0, 80),
      avatar: pickAvatar(fd.get('avatar')), color: pickColor(fd.get('color')) });
    closeModal();
    updateMe();
    renderView(false);
    toast('Profile saved');
  },
  async password(f, fd) {
    if (fd.get('next') !== fd.get('confirm')) throw new Error("New passwords don't match.");
    await Auth.changePassword(App.user.id, fd.get('current'), fd.get('next'));
    closeModal();
    toast('Password changed 🔒');
  },
  async newCode(f, fd) {
    showRecoveryCode(await Auth.newRecoveryCode(App.user.id, fd.get('password')), 'Your new recovery code');
  },
  async deleteAccount(f, fd) {
    await Auth.confirmPassword(App.user.id, fd.get('password'));
    deleteCurrentAccount();
  },
  async disconnectGoogle(f, fd) {
    App.user = await Auth.disconnectGoogle(App.user.id, fd.get('password'));
    closeModal();
    renderView(false);
    toast('Google disconnected');
  },
};

function showRecoveryCode(code, title) {
  openModal(`<div class="modal-head"><h2>${title}</h2>${closeBtn}</div>
    <p class="muted">Save this recovery code somewhere safe. It's the only way to reset a forgotten password, and it won't be shown again.</p><div class="code-box">${esc(code)}</div>
    <div class="modal-foot"><button class="btn" data-action="copyCode" data-code="${esc(code)}">${I.copy} Copy</button><span class="grow"></span><button class="btn primary" data-action="closeModal">Done</button></div>`);
}

function deleteCurrentAccount() {
  const name = App.user.displayName;
  Auth.remove(App.user.id);
  App.user = App.data = null;
  closeModal(true);
  Object.assign(AuthUI, { mode: null, pick: null });
  history.replaceState(null, '', location.pathname + location.search);
  renderAuth();
  toast(`Account “${name}” deleted`);
}

// A dialog that stays until dismissed (a toast is easy to miss after coming back from the browser).
function showMessage(title, text) {
  openModal(`<div class="modal-head"><h2>${esc(title)}</h2>${closeBtn}</div><p class="muted">${esc(text)}</p>
    <div class="modal-foot"><span class="grow"></span><button class="btn primary" data-action="closeModal" autofocus>OK</button></div>`);
}

/* Google sign-in runs in the system browser (main.py); this shows a waiting dialog meanwhile.
   hint, an email, makes Google preselect that account.
   Resolves to {sub, email, name}, or null if it was cancelled or failed (after saying why). */
async function googleIdentity(hint) {
  if (!googleOn() || !Store.api) {
    toast("Google sign-in isn't available in this copy of HabitGrid");
    return null;
  }
  if (App.googleWait) return null;
  openModal(`<div class="modal-head"><h2>Continue in your browser</h2></div>
    <p class="muted">Google's sign-in page opened in your web browser. Choose your account there, then come back to HabitGrid.</p>
    <div class="waiting"><span class="spinner"></span>Waiting for Google…</div>
    <div class="modal-foot"><span class="grow"></span><button class="btn ghost" data-action="closeModal">Cancel</button></div>`);
  // Set after openModal: from now on closing this dialog cancels (see closeModal). Cancelling
  // ends the wait at once; whatever Google answers later for this attempt is ignored.
  const wait = App.googleWait = {};
  const cancelled = new Promise(resolve => { wait.cancel = resolve; });
  const call = Store.api.google_sign_in(hint || null);
  call.catch(() => {}); // a late failure after a cancel is expected, not an error
  let error = null;
  try {
    const result = await Promise.race([call.then(identity => ({ identity })), cancelled.then(() => ({ cancelled: true }))]);
    return result.cancelled ? null : result.identity;
  } catch (err) {
    if (!(err && err.name === 'Cancelled')) error = String((err && err.message) || err);
    return null;
  } finally {
    if (App.googleWait === wait) { // still this attempt's dialog
      App.googleWait = null;
      closeModal(true);
      if (error) showMessage("Google sign-in didn't finish", error);
    }
  }
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el, e);
});

document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const btn = $('button:not([type="button"])', f);
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.classList.add('busy'); }
  setErr(f, '');
  try { await FORMS[f.dataset.form](f, new FormData(f)); }
  catch (err) { setErr(f, err.message || String(err)); }
  finally { if (btn) { btn.disabled = false; btn.classList.remove('busy'); } }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-strength]')) updateStrength(t);
  if (t.matches('input[type="color"][data-setting]')) applyLook({ ...settings(), accent: t.value });
  if (t.matches('.emo-custom')) for (const b of $$('.emo', t.form)) b.setAttribute('aria-pressed', b.dataset.v === t.value.trim());
  if (t.matches('[data-form="profile"] input[name="email"]')) { // the password is needed only for a new email
    const box = $('.email-pw', t.form);
    if (box) {
      // Disabled while hidden: a hidden required field would silently block saving.
      box.hidden = $('input', box).disabled = t.value.trim().toLowerCase() === t.dataset.orig;
    }
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[type="color"][data-setting]') && HEX.test(t.value)) updateSetting('accent', t.value);
  if (t.id === 'import-file' && t.files[0]) importFile(t.files[0]).finally(() => { t.value = ''; });
});

// Without these, dropping a file or link on the window navigates away from the app.
// A dropped backup file is imported instead.
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file && App.user) importFile(file);
});

// Redraw the chart when the width changes (not on mobile toolbar height changes).
let lastWidth = innerWidth, resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    const body = $('#progress-body');
    if (App.user && App.view === 'tracker' && body) body.innerHTML = progressHTML(false);
  }, 200);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal-root').hidden) closeModal();
});

/* ---------- boot ---------- */
(async function boot() {
  try {
    await Store.init();
  } catch (err) {
    // Without the app's storage nothing could be saved, so don't let anyone start.
    $('#app').innerHTML = `<main class="auth"><div class="auth-card"><div class="auth-brand">${LOGO}<span>HabitGrid</span></div>
      <h1>HabitGrid couldn't open its data</h1><p class="auth-sub">${esc(err.message || err)} Close HabitGrid and open it again.</p></div></main>`;
    document.documentElement.classList.remove('booting');
    return;
  }
  let lastSaveError = 0;
  Store.onError = () => {
    if (Date.now() - lastSaveError < 5000) return; // one message per burst of failed saves
    lastSaveError = Date.now();
    toast("Couldn't save your changes. Check that HabitGrid's data folder is writable.");
  };
  const u = Auth.current();
  if (u) enterApp(u); else renderAuth();
  // Not requestAnimationFrame: that never runs while the window is hidden or minimized.
  void document.body.offsetWidth; // apply the hidden state first, so removing it fades in
  document.documentElement.classList.remove('booting');
})();

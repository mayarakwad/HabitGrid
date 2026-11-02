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
const NAV = [['tracker', I.grid, 'Tracker'], ['today', I.target, 'Today'], ['profile', I.user, 'Profile'], ['settings', I.sliders, 'Personalize']];

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS = {
  theme: 'system', accent: '#2383e2', font: 'system', size: 'm', density: 'comfortable', radius: 'rounded', cb: 'square',
  habitColors: false, showRings: true, labels: true, weekStart: 1, startView: 'tracker',
  motion: REDUCED ? 'reduced' : 'full', celebrate: true, hideDone: false,
};
const CHOICES = {
  theme: THEMES.map(t => t.id), font: ['system', 'rounded', 'serif', 'mono'], size: ['s', 'm', 'l'],
  density: ['compact', 'comfortable'], radius: ['sharp', 'rounded', 'round'], cb: ['square', 'circle'],
  weekStart: [0, 1], startView: ['tracker', 'today'], motion: ['full', 'reduced', 'off'],
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
const App = { user: null, data: null, view: 'tracker', y: 0, m: 0, tab: 'chart', flash: null, confirm: null, newBadges: new Set(), modalSeq: 0 };
const AuthUI = { mode: null, pick: null, code: null, next: null, remember: true, reset: false };

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
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#191919';
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
  return d;
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

function celebrate() {
  const s = settings();
  if (!s.celebrate || s.motion !== 'full') return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = [s.accent, '#f5c542', '#30a46c', '#d6409f', '#0090ff', '#f76b15'];
  for (let i = 0; i < 36; i++) {
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
  const first = $('[autofocus]', root) || $('.modal input, .modal button:not([data-action="closeModal"])', root);
  if (first) first.focus();
}

function closeModal(immediate) {
  const root = $('#modal-root');
  if (App.confirm) { const r = App.confirm; App.confirm = null; r(false); }
  if (root.hidden) return;
  const seq = ++App.modalSeq;
  const finish = () => {
    if (seq !== App.modalSeq) return;
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
const AUTH_VIEWS = {
  pick: accounts => `<h1>Welcome back</h1><p class="auth-sub">Choose your profile to continue.</p>
    <div class="profiles">${accounts.map((u, i) => `<button class="profile-tile" style="--c:${u.color};--i:${i}" data-action="pickProfile" data-u="${esc(u.username)}">
      <span class="avatar lg" style="--c:${u.color}">${esc(u.avatar)}</span><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></button>`).join('')}
      <button class="profile-tile add" style="--i:${accounts.length}" data-action="authMode" data-m="register">
      <span class="avatar lg">${I.plus}</span><b>New profile</b><small>Create account</small></button></div>
    <div class="auth-links"><button class="link-btn" data-action="authMode" data-m="login">Sign in with username</button></div>`,

  login: accounts => {
    const u = AuthUI.pick && Auth.byName(AuthUI.pick);
    return `<form data-form="login">
      ${u ? `<div class="who"><span class="avatar lg" style="--c:${u.color}">${esc(u.avatar)}</span><div><h1>Hi, ${esc(u.displayName)}</h1><p class="muted">@${esc(u.username)}</p></div></div>
        <input type="hidden" name="username" value="${esc(u.username)}">`
      : `<h1>Sign in</h1><p class="auth-sub">Welcome back! Enter your details.</p>
        <label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" required autofocus autocapitalize="none" spellcheck="false"></label>`}
      ${pwField('password', 'Password', 'current-password', u ? 'autofocus' : '')}
      <label class="check"><input type="checkbox" name="remember" checked> Keep me signed in</label>
      <p class="form-err" role="alert"></p>
      <button class="btn primary block">Sign in</button>
      <div class="auth-links">${accounts.length
        ? '<button type="button" class="link-btn" data-action="authMode" data-m="pick">← All profiles</button>'
        : '<button type="button" class="link-btn" data-action="authMode" data-m="register">Create an account</button>'}
        <button type="button" class="link-btn" data-action="authMode" data-m="recover">Forgot password?</button></div>
    </form>`;
  },

  register: accounts => `<form data-form="register">
    <h1>Create your account</h1><p class="auth-sub">Your habits, themes and stats are saved to your profile.</p>
    <div class="two">
      <label class="field"><span>Display name</span><input class="input" name="displayName" maxlength="30" required autofocus placeholder="Alex"></label>
      <label class="field"><span>Username</span><input class="input" name="username" minlength="3" maxlength="24" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="alex"></label>
    </div>
    <div class="two">
      ${pwField('password', 'Password', 'new-password', 'minlength="6" data-strength')}
      ${pwField('confirm', 'Confirm password', 'new-password', 'minlength="6"')}
    </div>
    ${strengthMeter}
    <div class="field"><span>Avatar</span>${avatarPicker(AVATARS[Math.floor(Math.random() * AVATARS.length)])}</div>
    <div class="field"><span>Profile color</span>${colorRadios('color', ACCENTS[Math.floor(Math.random() * ACCENTS.length)])}</div>
    <label class="check"><input type="checkbox" name="remember" checked> Keep me signed in</label>
    <p class="form-err" role="alert"></p>
    <button class="btn primary block">Create account</button>
    ${accounts.length ? `<div class="auth-links"><button type="button" class="link-btn" data-action="authMode" data-m="pick">← All profiles</button>
      <button type="button" class="link-btn" data-action="authMode" data-m="login">I already have an account</button></div>` : ''}
  </form>`,

  recover: () => `<form data-form="recover">
    <h1>Reset password</h1><p class="auth-sub">Use the recovery code you saved when you created your account.</p>
    <label class="field"><span>Username</span><input class="input" name="username" required autocapitalize="none" spellcheck="false" value="${esc(AuthUI.pick || '')}" ${AuthUI.pick ? '' : 'autofocus'}></label>
    <label class="field"><span>Recovery code</span><input class="input mono" name="code" required placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" autocomplete="off" ${AuthUI.pick ? 'autofocus' : ''}></label>
    ${pwField('password', 'New password', 'new-password', 'minlength="6" data-strength')}
    ${strengthMeter}
    <p class="form-err" role="alert"></p>
    <button class="btn primary block">Reset password</button>
    <div class="auth-links"><button type="button" class="link-btn" data-action="authMode" data-m="login">← Back to sign in</button></div>
  </form>`,

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
  const mode = AuthUI.mode || (accounts.length ? 'pick' : 'register');
  $('#app').innerHTML = `<main class="auth">
    <div class="auth-card${mode === 'register' ? ' wide' : ''}"><div class="auth-brand">${LOGO}<span>HabitGrid</span></div>${AUTH_VIEWS[mode](accounts)}</div>
    <p class="auth-foot">${I.lock} Profiles are stored only on this device. Passwords are salted and hashed (PBKDF2) and never leave your browser.</p>
  </main>`;
  const f = $('.auth [autofocus]');
  if (f) f.focus();
}

/* ---------- app shell ---------- */
function enterApp(user) {
  App.user = user;
  App.data = loadData(user.id);
  App.newBadges = new Set();
  const t = Dates.today();
  App.y = t.getFullYear();
  App.m = t.getMonth();
  Object.assign(AuthUI, { mode: null, pick: null, code: null, next: null, reset: false });
  applySettings();
  App.view = viewFromHash() || settings().startView;
  history.replaceState(null, '', '#/' + App.view);
  mountShell();
  renderView(true);
  checkBadges(true);
  Chat.mount();
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
  if (me) me.innerHTML = `<span class="avatar" style="--c:${u.color}">${esc(u.avatar)}</span><span class="me-txt"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span>`;
}

const VIEWS = { tracker: viewTracker, today: viewToday, profile: viewProfile, settings: viewSettings };
const TITLES = { tracker: 'Tracker', today: 'Today', profile: 'Profile', settings: 'Personalize' };
const AFTER = { tracker: scrollToToday, profile: animateCounts };
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
  const ds = Habits.dayStats(App.data, Dates.today());
  const hi = `${greeting()}, ${esc(App.user.displayName)}`;
  return ds.total ? `${hi} · ${ds.done} of ${ds.total} done today` : `${hi}. Add a habit to get started.`;
}

const emptyState = () => `<section class="card empty"><div class="big-emoji">🌱</div><h2>Start your first habit</h2>
  <p class="muted">Track anything you want to do daily. Tick a box each day and watch your charts fill in.</p>
  <div class="row-btns center"><button class="btn primary" data-action="newHabit">${I.plus} New habit</button>
  <button class="btn" data-action="starter">✨ Add starter habits</button></div></section>`;

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
    </div></header>`;
  if (!App.data.habits.length) return head + emptyState();

  let cols = '';
  for (let d = 1; d <= n; d++) {
    const wd = new Date(y, m, d).getDay(), isT = isCur && d === today.getDate();
    cols += `<th class="day${isT ? ' today' : ''}${wd === 0 || wd === 6 ? ' we' : ''}" scope="col"${isT ? ' id="today-col"' : ''}><span>${WEEKDAYS[wd][0]}</span><b>${d}</b></th>`;
  }
  const rows = App.data.habits.map(h => {
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
  const today = Dates.today(), n = Dates.daysIn(y, m), days = [];
  for (let d = 1; d <= n; d++) {
    const dt = new Date(y, m, d);
    days.push(dt > today ? { d, pct: null } : { d, ...Habits.dayStats(App.data, dt) });
  }
  const habits = App.data.habits.map(h => ({ h, ...Habits.habitMonth(App.data, h, y, m), ...Habits.streaks(App.data, h) }));
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
  const quote = QUOTES[Math.floor(t / 864e5) % QUOTES.length];
  return head + `<section class="card today-hero">
      <div class="donut-ring">${Charts.ring(ds.pct || 0, { size: 132, stroke: 11 })}<div class="donut-txt"><b id="t-pct">${pct(ds.pct)}%</b><span id="t-count">${ds.done} of ${ds.total}</span></div></div>
      <div class="hero-text"><h2 id="t-msg">${todayMsg(ds)}</h2><p class="muted">${quote}</p></div>
    </section>
    <ul class="focus-list" id="focus">${hs.map((h, i) => focusItem(h, t, i, s.hideDone)).join('')}</ul>
    <p class="muted center" id="all-done" ${s.hideDone && ds.done === ds.total ? '' : 'hidden'}>All done for today. Enjoy the rest of your day ✨</p>`;
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
        setTimeout(() => li.classList.add('gone'), delay ? 350 : 0);
      }, delay);
    }
  }
  $('#all-done').hidden = !(s.hideDone && ds.total && ds.done === ds.total);
}

/* ---------- day editing ---------- */
function setDone(id, date, on) {
  const h = habitById(id);
  if (!h) return;
  const today = Dates.today(), before = Habits.dayStats(App.data, today);
  const key = Dates.key(date);
  if (on && key < h.created) h.created = key; // backfilling extends the habit's start
  Habits.setDone(App.data, id, date, on);
  save();
  refreshFocusItems();
  refreshTracker();
  refreshToday();
  const after = Habits.dayStats(App.data, today);
  if (on && key === Dates.key(today) && after.total && after.done === after.total && before.done < before.total) {
    celebrate();
    toast('Perfect day! Every habit done 🎉');
  }
  checkBadges();
}

function openDay(key) {
  const date = Dates.parse(key);
  openModal(`<div class="modal-head"><h2>${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}</h2>${closeBtn}</div>
    <ul class="focus-list one">${App.data.habits.map((h, i) => focusItem(h, date, i, false)).join('')}</ul>
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
      <div class="pc-info"><h2>${esc(u.displayName)}</h2><p class="muted">@${esc(u.username)} · Member since ${MONTHS[since.getMonth()]} ${since.getFullYear()}</p>
        ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ''}</div>
      <button class="btn" data-action="editProfile">${I.edit} Edit profile</button>
    </section>
    <section class="stats">${tile(st.total, 'Total check-ins')}${tile(st.current, 'Current streak')}${tile(st.best, 'Best streak')}${tile(st.perfect, 'Perfect days')}</section>
    <section class="card"><div class="sec-head"><h2>Achievements</h2><span class="muted">${have.size} of ${BADGES.length}</span></div>
      <div class="badges">${BADGES.map((b, i) => `<div class="badge${have.has(b.id) ? '' : ' locked'}${App.newBadges.has(b.id) ? ' new' : ''}" style="--i:${i}">
        <span class="be">${b.icon}</span><span><b>${b.name}</b><small>${b.desc}</small></span></div>`).join('')}</div></section>
    <section class="card"><h2>Account</h2><div class="menu">
      ${menuItem('editProfile', I.edit, 'Edit profile', 'Name, bio, avatar and color')}
      ${menuItem('changePassword', I.key, 'Change password', 'Pick a new password for this profile')}
      ${menuItem('newCode', I.shield, 'New recovery code', 'Lets you reset a forgotten password')}
      ${menuItem('exportData', I.download, 'Export backup', 'Download your habits as a small JSON file')}
      ${menuItem('importData', I.upload, 'Import backup', 'Restore habits from a HabitGrid backup')}
      ${menuItem('logout', I.logout, 'Sign out', 'Switch to another profile on this device')}
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

function exportData() {
  const u = App.user;
  const payload = { app: 'HabitGrid', version: 1, exported: new Date().toISOString(),
    profile: { username: u.username, displayName: u.displayName, avatar: u.avatar, color: u.color, bio: u.bio }, data: App.data };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  a.download = `habitgrid-${u.username}-${Dates.key(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

function sanitizeData(d) {
  const seen = new Set();
  const habits = d.habits.slice(0, 200)
    .filter(h => h && typeof h.id === 'string' && /^[\w-]{1,24}$/.test(h.id) && !seen.has(h.id) && seen.add(h.id))
    .map(h => ({ id: h.id, name: String(h.name || 'Habit').slice(0, 40), icon: String(h.icon || '✅').slice(0, 8),
      color: pickColor(h.color), created: /^\d{4}-\d{2}-\d{2}$/.test(h.created) ? h.created : Dates.key(Dates.today()) }));
  const log = {};
  for (const [mk, row] of Object.entries(d.log || {})) {
    if (!/^\d{4}-\d{2}$/.test(mk) || !row || typeof row !== 'object') continue;
    for (const [id, mask] of Object.entries(row)) if (seen.has(id) && Number.isInteger(mask) && mask) (log[mk] ||= {})[id] = mask | 0;
  }
  const badges = Array.isArray(d.badges) ? d.badges.filter(b => BADGES.some(x => x.id === b)) : [];
  return { v: 1, habits, log, settings: cleanSettings(d.settings), badges };
}

async function importFile(file) {
  if (file.size > 2e6) return toast('That file is too large to be a HabitGrid backup');
  let json;
  try { json = JSON.parse(await file.text()); } catch { return toast("That file isn't valid JSON"); }
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
  return `<div class="meter"><i style="width:${Math.max(0.5, (used / cap) * 100).toFixed(2)}%"></i></div>
    <p class="muted">Your data: <b>${fmtBytes(mine)}</b> · All profiles on this device: <b>${fmtBytes(used)}</b> of about 5 MB browser storage.
    Check-ins are packed into bitmasks, and the whole app is about 180 KB (around 52 KB compressed) with no libraries, fonts or images.</p>`;
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
      ${setRow('Celebrate perfect days', 'Confetti when every habit is done', switchBtn('celebrate', s.celebrate, 'Celebrate perfect days'))}
      ${setRow('Week starts on', 'Used by the calendar', seg('weekStart', [[1, 'Monday'], [0, 'Sunday']], s.weekStart))}
      ${setRow('Open the app on', '', seg('startView', [['tracker', 'Tracker'], ['today', 'Today']], s.startView))}
    </section>
    <section class="card"><h2>Assistant</h2>
      <p class="muted">Chat with HabitGrid to add and check habits, ask about your progress or change these settings. It works offline with built-in commands, or connect your own Claude or GPT API key.</p>
      <div class="row-btns"><button class="btn sm" data-action="chatSettings">${I.sliders} Assistant settings</button></div></section>
    <section class="card"><h2>Storage</h2><div id="storage">${storageHTML()}</div>
      <div class="row-btns"><button class="btn sm" data-action="cleanup">${I.broom} Clean up</button><button class="btn sm" data-action="exportData">${I.download} Export backup</button></div></section>
    <div class="row-btns center"><button class="btn ghost" data-action="resetLook">Reset personalization</button></div>`;
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
    const reset = AuthUI.reset;
    enterApp(u);
    toast(reset ? 'Password updated' : `Welcome, ${u.displayName}! 👋`);
  },
  logout() {
    Auth.logout();
    Chat.unmount();
    App.user = App.data = null;
    closeModal(true);
    Object.assign(AuthUI, { mode: null, pick: null });
    history.replaceState(null, '', location.pathname + location.search);
    renderAuth();
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

  newHabit() { habitModal(null); },
  editHabit(el) { habitModal(habitById(el.dataset.h)); },
  pickEmoji(el) {
    const form = el.closest('form');
    form.elements.icon.value = el.dataset.v;
    for (const b of $$('.emo', form)) b.setAttribute('aria-pressed', b === el);
  },
  moveHabit(el) {
    const list = App.data.habits, i = list.findIndex(h => h.id === el.dataset.h), j = i + +el.dataset.d;
    if (i < 0 || j < 0 || j >= list.length) return;
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
    const key = Dates.key(Dates.today());
    for (const [name, icon, color] of STARTERS) App.data.habits.push({ id: Habits.newId(), name, icon, color, created: key });
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
  newCode() {
    openModal(`<form data-form="newCode"><div class="modal-head"><h2>New recovery code</h2>${closeBtn}</div>
      <p class="muted">Your old code stops working. Enter your password to continue.</p><br>
      ${pwField('password', 'Password', 'current-password', 'autofocus')}
      <p class="form-err" role="alert"></p>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-action="closeModal">Cancel</button><button class="btn primary">Create code</button></div></form>`);
  },
  exportData,
  importData() { $('#import-file').click(); },
  deleteAccount() {
    openModal(`<form data-form="deleteAccount"><div class="modal-head"><h2>Delete account?</h2>${closeBtn}</div>
      <p class="muted">This permanently removes <b>@${esc(App.user.username)}</b>, its habits and history from this device. Export a backup first if you might want it back.</p><br>
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
  ...Chat.actions,
};

/* ---------- forms ---------- */
const FORMS = {
  async login(f, fd) {
    const u = await Auth.login(fd.get('username'), fd.get('password'), fd.has('remember'));
    enterApp(u);
    toast(`Welcome back, ${u.displayName} 👋`);
  },
  async register(f, fd) {
    if (fd.get('password') !== fd.get('confirm')) throw new Error("Passwords don't match.");
    const { user, code } = await Auth.register({ username: fd.get('username'), displayName: fd.get('displayName'),
      password: fd.get('password'), avatar: pickAvatar(fd.get('avatar')), color: pickColor(fd.get('color')) });
    Object.assign(AuthUI, { mode: 'code', code, next: user.id, remember: fd.has('remember'), reset: false });
    renderAuth();
  },
  async recover(f, fd) {
    const { user, code } = await Auth.resetWithCode(fd.get('username'), fd.get('code'), fd.get('password'));
    Object.assign(AuthUI, { mode: 'code', code, next: user.id, remember: true, reset: true });
    renderAuth();
  },
  habit(f, fd) {
    const name = String(fd.get('name') || '').trim().slice(0, 40);
    if (!name) throw new Error('Give your habit a name.');
    const icon = String(fd.get('icon') || '').trim().slice(0, 8) || '✅', color = pickColor(fd.get('color'));
    const id = f.dataset.h;
    if (id) Object.assign(habitById(id), { name, icon, color });
    else {
      App.flash = Habits.newId();
      App.data.habits.push({ id: App.flash, name, icon, color, created: Dates.key(Dates.today()) });
    }
    save();
    closeModal();
    renderView(false);
    checkBadges();
    toast(id ? 'Habit updated' : `${icon} ${name} added`);
  },
  profile(f, fd) {
    const displayName = String(fd.get('displayName') || '').trim().slice(0, 30);
    if (!displayName) throw new Error('Display name is required.');
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
    const code = await Auth.newRecoveryCode(App.user.id, fd.get('password'));
    openModal(`<div class="modal-head"><h2>Your new recovery code</h2>${closeBtn}</div>
      <p class="muted">Save it somewhere safe. It won't be shown again.</p><div class="code-box">${esc(code)}</div>
      <div class="modal-foot"><button class="btn" data-action="copyCode" data-code="${esc(code)}">${I.copy} Copy</button><span class="grow"></span><button class="btn primary" data-action="closeModal">Done</button></div>`);
  },
  async deleteAccount(f, fd) {
    if (!(await Auth.verify(App.user.id, fd.get('password')))) throw new Error('Wrong password.');
    const name = App.user.displayName;
    Chat.unmount();
    Auth.remove(App.user.id);
    App.user = App.data = null;
    closeModal(true);
    Object.assign(AuthUI, { mode: null, pick: null });
    history.replaceState(null, '', location.pathname + location.search);
    renderAuth();
    toast(`Account “${name}” deleted`);
  },
  ...Chat.forms,
};

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
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[type="color"][data-setting]') && HEX.test(t.value)) updateSetting('accent', t.value);
  if (t.id === 'import-file' && t.files[0]) importFile(t.files[0]).finally(() => { t.value = ''; });
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
(function boot() {
  const u = Auth.current();
  if (u) enterApp(u); else renderAuth();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
})();

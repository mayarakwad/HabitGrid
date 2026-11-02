'use strict';
/* HabitGrid Assistant: a chat panel that can add, check, edit and delete habits, answer
   questions about progress and change settings.
   - "Built-in" mode understands simple commands and works offline with no API key.
   - "Claude" (Anthropic) and "GPT" (OpenAI) modes use your own API key for free-form chat.
     The model gets the same set of tools (TOOLS below) and the app runs them locally.
   This file loads before app.js; it only touches app.js globals (App, $, esc, setDone, ...)
   inside functions, which run after app.js has loaded. */

const Chat = (() => {
  /* ---------- providers ---------- */
  const PROVIDERS = {
    local: { name: 'Built-in', label: 'Built-in commands (offline)' },
    anthropic: {
      name: 'Claude', label: 'Claude', def: 'claude-opus-5-5',
      models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
      url: 'https://api.anthropic.com/v1/messages', keys: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-...',
    },
    openai: {
      name: 'GPT', label: 'GPT', def: 'gpt-5',
      models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
      url: 'https://api.openai.com/v1/chat/completions', keys: 'https://platform.openai.com/api-keys', keyHint: 'sk-...',
    },
  };
  const ANTHROPIC_VERSION = '2026-10-21';
  const MAX_STEPS = 10;      // tool round-trips per message
  const MAX_HISTORY = 80;    // API messages before a fresh conversation starts

  const blankCfg = () => ({ provider: 'local', keys: {}, models: {}, urls: {} });
  const cfgKey = () => 'ai.' + App.user.id;
  function cfg() {
    const c = { ...blankCfg(), ...Store.read(cfgKey(), {}) };
    if (!PROVIDERS[c.provider]) c.provider = 'local';
    for (const k of ['keys', 'models', 'urls']) if (!c[k] || typeof c[k] !== 'object') c[k] = {};
    return c;
  }
  const modelOf = (c, p = c.provider) => (c.models[p] || '').trim() || PROVIDERS[p].def;

  /* ---------- state ---------- */
  const S = { uid: null, open: false, busy: false, view: 'chat', msgs: [], api: null, abort: null, note: '' };
  const resetApi = () => { S.api = null; };

  /* ---------- helpers ---------- */
  const today = () => Dates.today();
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const normName = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const list = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  const bold = names => list(names.map(n => `**${n}**`));
  const dayWord = d => {
    const k = Dates.key(d), t = today();
    if (k === Dates.key(t)) return 'today';
    if (k === Dates.key(addDays(t, -1))) return 'yesterday';
    return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  };

  const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // Accepts YYYY-MM-DD plus everyday words ("yesterday", "monday", "3 days ago", "nov 1").
  // Returns null when the text isn't a date at all (lenient mode), throws for future days.
  function parseDate(s, lenient = false) {
    const t0 = today();
    if (s == null || String(s).trim() === '') return t0;
    const t = String(s).trim().toLowerCase().replace(/^(on|for)\s+/, '').replace(/\.$/, '');
    let d = null, m;
    const mk = (y, mo, day) => { const x = new Date(y, mo, day); return x.getMonth() === ((mo % 12) + 12) % 12 && x.getDate() === day ? x : null; };
    if (/^(today|now|tonight|this (morning|afternoon|evening))$/.test(t)) d = t0;
    else if (t === 'yesterday') d = addDays(t0, -1);
    else if (t === 'tomorrow') d = addDays(t0, 1);
    else if (/^(the )?day before yesterday$/.test(t)) d = addDays(t0, -2);
    else if ((m = t.match(/^(\d{1,3}) days? ago$/))) d = addDays(t0, -m[1]);
    else if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) d = mk(+m[1], m[2] - 1, +m[3]);
    else if ((m = t.match(/^(last |this |past )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/))) {
      let back = (t0.getDay() - WD.indexOf(m[2]) + 7) % 7;
      if (m[1] === 'last ' && back === 0) back = 7;
      d = addDays(t0, -back);
    } else if ((m = t.match(/^([a-z]{3})[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/)) || (m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]{3})[a-z]*(?: (\d{4}))?$/))) {
      const [mon, day] = /^\d/.test(m[1]) ? [m[2], +m[1]] : [m[1], +m[2]];
      const mi = MON.indexOf(mon);
      if (mi >= 0) {
        d = mk(m[3] ? +m[3] : t0.getFullYear(), mi, day);
        if (d && !m[3] && d > t0) d = mk(t0.getFullYear() - 1, mi, day);
      }
    }
    if (!d) {
      if (lenient) return null;
      throw new Error(`I couldn't read the date "${s}". Use YYYY-MM-DD, "today" or "yesterday".`);
    }
    if (d > t0) throw new Error(`${Dates.key(d)} is in the future. Only today and earlier days can be checked.`);
    return d;
  }

  function findHabit(ref) {
    const raw = String(ref ?? '').trim(), q = normName(raw), hs = App.data.habits;
    if (!raw) throw new Error('Which habit?');
    if (!hs.length) throw new Error('There are no habits yet.');
    const names = hs.map(h => h.name).join(', ');
    const hit = hs.find(h => h.id === raw) || hs.find(h => normName(h.name) === q) || (!q && hs.find(h => h.icon === raw));
    if (hit) return hit;
    if (!q) throw new Error(`No habit matches "${raw}". Habits: ${names}.`);
    const pick = (cands, why) => {
      if (cands.length === 1) return cands[0];
      if (cands.length > 1) throw new Error(`"${raw}" could be ${list(cands.map(h => h.name))}. Which one?`);
      return why;
    };
    let r = pick(hs.filter(h => normName(h.name).includes(q) || (q.length >= 3 && q.includes(normName(h.name)))));
    if (r) return r;
    const words = q.split(' ').filter(w => w.length > 2);
    const stem = w => w.replace(/(ing|ed|es|s)$/, '');
    r = pick(hs.filter(h => normName(h.name).split(' ').some(x => words.some(w => stem(x) === stem(w) || (stem(w).length > 3 && x.startsWith(stem(w)))))));
    if (r) return r;
    throw new Error(`No habit matches "${raw}". Habits: ${names}.`);
  }

  const ICON_GUESS = [
    [/water|drink|hydrat/, '💧'], [/read|book/, '📖'], [/study|learn|homework|course/, '📚'], [/run|jog/, '🏃'],
    [/gym|exercise|workout|lift|push.?up|train/, '🏋️'], [/yoga|meditat|breath|mindful/, '🧘'], [/sleep|bed/, '😴'],
    [/walk|steps/, '🚶'], [/journal|write|diary/, '✍️'], [/guitar|piano|music|practice/, '🎸'], [/clean|tidy|chore/, '🧹'],
    [/vitamin|pill|medic/, '💊'], [/phone|screen|social/, '📵'], [/pray|quran|salah|gratitude/, '🙏'], [/sav|money|budget|spend/, '💰'],
    [/plant|garden/, '🌱'], [/dog|pet/, '🐶'], [/fruit|veg|eat|salad|diet|cook/, '🥗'], [/shower|skin|teeth|floss/, '🚿'],
    [/work|job|email/, '💼'], [/code|program/, '💻'], [/sun|outside|morning/, '☀️'], [/goal|focus/, '🎯'], [/brain|puzzle|language/, '🧠'],
  ];
  const guessIcon = name => (ICON_GUESS.find(([re]) => re.test(name.toLowerCase())) || [0, '✅'])[1];
  const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/u;
  const COLOR_WORDS = { blue: 0, purple: 1, violet: 1, pink: 2, red: 3, orange: 4, yellow: 5, gold: 5, green: 6, teal: 7, cyan: 7, gray: 8, grey: 8, slate: 8 };
  function toColor(c) {
    if (c == null || c === '') return null;
    const s = String(c).trim().toLowerCase();
    if (HEX.test(s)) return s;
    if (/^[0-9a-f]{6}$/.test(s)) return '#' + s;
    if (s in COLOR_WORDS) return ACCENTS[COLOR_WORDS[s]];
    throw new Error(`"${c}" isn't a color I know. Use a hex color like #30a46c or: ${Object.keys(COLOR_WORDS).slice(0, 9).join(', ')}.`);
  }

  function habitInfo(h) {
    const t = today(), st = Habits.streaks(App.data, h), mo = Habits.habitMonth(App.data, h, t.getFullYear(), t.getMonth());
    return { id: h.id, name: h.name, icon: h.icon, color: h.color, started: h.created,
      doneToday: Habits.isDone(App.data, h.id, t), currentStreak: st.current, bestStreak: st.best, thisMonthPct: pct(mo.pct) };
  }
  function dayInfo(d) {
    const key = Dates.key(d), hs = App.data.habits.filter(h => h.created <= key);
    const done = hs.filter(h => Habits.isDone(App.data, h.id, d)).map(h => h.name);
    return { date: key, weekday: WEEKDAYS[d.getDay()], done, left: hs.filter(h => !done.includes(h.name)).map(h => h.name), total: hs.length };
  }
  const refresh = () => { renderView(false); updateMe(); };

  /* ---------- tools: shared by Built-in, Claude and GPT ---------- */
  const habitRef = { type: 'string', description: 'Habit name (or id from list_habits). Partial names are fine.' };
  const dateArg = { type: 'string', description: 'Day as YYYY-MM-DD. Defaults to today. Future days are not allowed.' };
  function TOOLS() {
    return [
      { name: 'list_habits', description: "List every habit with id, name, emoji icon, color, start date, whether it's done today, current and best streak, and this month's completion %.",
        props: {} },
      { name: 'add_habit', description: 'Create a new daily habit (a new row in the grid).',
        props: { name: { type: 'string', description: 'Short name, max 40 characters' }, icon: { type: 'string', description: 'One emoji. Optional; a fitting one is picked if omitted.' },
          color: { type: 'string', description: `Optional hex color like #30a46c, or one of: ${Object.keys(COLOR_WORDS).slice(0, 9).join(', ')}` } }, required: ['name'] },
      { name: 'update_habit', description: "Rename a habit or change its emoji icon or color. History is kept.",
        props: { habit: habitRef, name: { type: 'string', description: 'New name' }, icon: { type: 'string', description: 'New emoji' }, color: { type: 'string', description: 'New hex color or color word' } }, required: ['habit'] },
      { name: 'delete_habit', description: 'Delete a habit and all of its history. The app asks the user to confirm first and returns whether they did.',
        props: { habit: habitRef }, required: ['habit'] },
      { name: 'move_habit', description: 'Move a habit one row up or down in the grid.',
        props: { habit: habitRef, direction: { type: 'string', enum: ['up', 'down'] } }, required: ['habit', 'direction'] },
      { name: 'set_check', description: 'Check (tick) or uncheck habits for one day, exactly like clicking the grid checkbox. Returns what changed and the day summary.',
        props: { habits: { type: 'array', items: { type: 'string' }, description: 'Habit names or ids. Use ["all"] for every habit.' }, date: dateArg,
          done: { type: 'boolean', description: 'true = check (default), false = uncheck' } }, required: ['habits'] },
      { name: 'get_day', description: 'Which habits are done and which are still left on a given day.', props: { date: dateArg } },
      { name: 'get_stats', description: 'Progress for a month: overall %, per-habit done/possible/% and streaks, plus all-time totals (check-ins, best streak, perfect days).',
        props: { month: { type: 'string', description: 'YYYY-MM. Defaults to the current month.' } } },
      { name: 'add_starter_habits', description: 'Add the 5 starter habits: Exercise, Study, Read, Drink water, Meditate.', props: {} },
      { name: 'change_settings', description: 'Change how the app looks or behaves. Only pass the settings to change.',
        props: {
          theme: { type: 'string', enum: CHOICES.theme, description: "'system' follows the device; midnight/ocean/forest/dusk/oled are dark, paper/sand/rose are light" },
          accent: { type: 'string', description: 'Accent color as hex (#rrggbb) or a color word' },
          font: { type: 'string', enum: CHOICES.font }, size: { type: 'string', enum: CHOICES.size, description: 'Text size: s, m or l' },
          density: { type: 'string', enum: CHOICES.density }, radius: { type: 'string', enum: CHOICES.radius, description: 'Corner style' },
          cb: { type: 'string', enum: CHOICES.cb, description: 'Checkbox shape' }, motion: { type: 'string', enum: CHOICES.motion, description: 'Animations' },
          habitColors: { type: 'boolean', description: "Color checkboxes with each habit's own color" }, showRings: { type: 'boolean', description: 'Progress rings in the grid' },
          labels: { type: 'boolean', description: 'Percent labels on the chart' }, celebrate: { type: 'boolean', description: 'Confetti on perfect days' },
          hideDone: { type: 'boolean', description: 'Hide completed habits on the Today page' }, weekStart: { type: 'integer', enum: [0, 1], description: '0 = Sunday, 1 = Monday' },
          startView: { type: 'string', enum: CHOICES.startView, description: 'Page the app opens on' },
        } },
      { name: 'open_view', description: 'Switch the app to a page, optionally showing a given month on the tracker.',
        props: { view: { type: 'string', enum: ['tracker', 'today', 'profile', 'settings'], description: 'settings = Personalize page' },
          month: { type: 'string', description: 'YYYY-MM for the tracker (optional)' } }, required: ['view'] },
    ];
  }

  const HANDLERS = {
    list_habits() {
      return { today: Dates.key(today()), habits: App.data.habits.map(habitInfo) };
    },

    add_habit({ name, icon, color }) {
      let n = String(name || '').trim();
      const em = n.match(EMOJI);
      if (em && !icon) { icon = em[0]; n = n.replace(em[0], '').trim(); }
      n = n.replace(/^["'“”]+|["'“”]+$/g, '').slice(0, 40).trim();
      if (!n) throw new Error('The habit needs a name.');
      if (App.data.habits.some(h => normName(h.name) === normName(n))) throw new Error(`A habit called "${n}" already exists.`);
      const h = { id: Habits.newId(), name: n[0].toUpperCase() + n.slice(1), icon: String(icon || '').trim().slice(0, 8) || guessIcon(n),
        color: toColor(color) || ACCENTS[App.data.habits.length % ACCENTS.length], created: Dates.key(today()) };
      App.data.habits.push(h);
      App.flash = h.id;
      save();
      refresh();
      checkBadges();
      return { result: { added: habitInfo(h) }, note: `${h.icon} Added habit “${h.name}”` };
    },

    update_habit({ habit, name, icon, color }) {
      const h = findHabit(habit), before = h.name, changes = [];
      if (name != null && String(name).trim()) {
        const n = String(name).trim().slice(0, 40);
        if (App.data.habits.some(x => x !== h && normName(x.name) === normName(n))) throw new Error(`Another habit is already called "${n}".`);
        h.name = n; changes.push(`renamed to “${n}”`);
      }
      if (icon != null && String(icon).trim()) { h.icon = String(icon).trim().slice(0, 8); changes.push(`icon ${h.icon}`); }
      const c = toColor(color);
      if (c) { h.color = c; changes.push('new color'); }
      if (!changes.length) throw new Error('Nothing to change. Give a new name, icon or color.');
      save();
      refresh();
      return { result: { updated: habitInfo(h) }, note: `✏️ “${before}”: ${changes.join(', ')}` };
    },

    async delete_habit({ habit }) {
      const h = findHabit(habit);
      const ok = await confirmBox(`Delete “${h.name}”?`, "The assistant wants to delete this habit. Its history is removed too. This can't be undone.", 'Delete');
      if (!ok) return { result: { deleted: false, reason: 'The user cancelled.' }, note: `Kept “${h.name}” (cancelled)` };
      App.data.habits = App.data.habits.filter(x => x !== h);
      Habits.purge(App.data, h.id);
      save();
      refresh();
      return { result: { deleted: true, name: h.name }, note: `🗑️ Deleted “${h.name}”` };
    },

    move_habit({ habit, direction }) {
      const hs = App.data.habits, h = findHabit(habit), i = hs.indexOf(h), j = i + (direction === 'up' ? -1 : 1);
      if (j < 0 || j >= hs.length) throw new Error(`“${h.name}” is already at the ${direction === 'up' ? 'top' : 'bottom'}.`);
      [hs[i], hs[j]] = [hs[j], hs[i]];
      save();
      refresh();
      return { result: { order: hs.map(x => x.name) }, note: `↕️ Moved “${h.name}” ${direction}` };
    },

    set_check({ habits, date, done = true }) {
      const d = parseDate(date), on = done !== false;
      const refs = (Array.isArray(habits) ? habits : [habits]).map(x => String(x ?? '').trim()).filter(Boolean);
      if (!refs.length) throw new Error('Which habits?');
      const all = refs.some(r => /^(all|every(thing| habit)?|all habits)$/i.test(r));
      const targets = [...new Set(all ? App.data.habits : refs.map(findHabit))];
      const changed = [], already = [];
      for (const h of targets) {
        if (Habits.isDone(App.data, h.id, d) === on) already.push(h.name);
        else { setDone(h.id, d, on); changed.push(h.name); }
      }
      const verb = on ? 'Checked' : 'Unchecked';
      return { result: { date: Dates.key(d), done: on, changed, unchanged: already, day: dayInfo(d) },
        note: changed.length ? `${on ? '✅' : '↩️'} ${verb} ${list(changed)} · ${dayWord(d)}` : null };
    },

    get_day({ date }) {
      return dayInfo(parseDate(date));
    },

    get_stats({ month }) {
      const t = today();
      let y = t.getFullYear(), m = t.getMonth();
      if (month) {
        const mm = String(month).match(/^(\d{4})-(\d{1,2})$/);
        if (!mm || mm[2] < 1 || mm[2] > 12) throw new Error('Month must look like YYYY-MM.');
        y = +mm[1]; m = mm[2] - 1;
      }
      const ms = monthSummary(y, m);
      const best = ms.days.filter(x => x.pct != null && x.total).sort((a, b) => b.pct - a.pct)[0];
      return {
        month: `${y}-${Dates.pad(m + 1)}`, monthName: `${MONTHS[m]} ${y}`, overallPct: pct(ms.pct), checkIns: ms.done, possible: ms.possible,
        perfectDaysThisMonth: ms.days.filter(x => x.total && x.done === x.total).length,
        bestDay: best ? { day: best.d, pct: pct(best.pct) } : null,
        habits: ms.habits.map(x => ({ name: x.h.name, icon: x.h.icon, done: x.done, possible: x.possible, pct: pct(x.pct), currentStreak: x.current, bestStreak: x.best })),
        allTime: Habits.overall(App.data),
      };
    },

    add_starter_habits() {
      const key = Dates.key(today()), have = new Set(App.data.habits.map(h => normName(h.name))), added = [];
      for (const [name, icon, color] of STARTERS) {
        if (have.has(normName(name))) continue;
        App.data.habits.push({ id: Habits.newId(), name, icon, color, created: key });
        added.push(name);
      }
      if (!added.length) throw new Error('All the starter habits are already there.');
      save();
      refresh();
      checkBadges();
      return { result: { added }, note: `✨ Added ${list(added)}` };
    },

    change_settings(input) {
      const applied = {}, rejected = [];
      for (let [k, v] of Object.entries(input || {})) {
        if (!(k in DEFAULTS)) { rejected.push(k); continue; }
        if (k === 'accent') { try { v = toColor(v); } catch { rejected.push(k); continue; } }
        if (k === 'weekStart') v = +v;
        if (cleanSettings({ [k]: v })[k] === undefined) { rejected.push(`${k}=${v}`); continue; }
        updateSetting(k, v);
        applied[k] = v;
      }
      if (!Object.keys(applied).length) throw new Error(`No valid settings given${rejected.length ? ` (rejected: ${rejected.join(', ')})` : ''}.`);
      if (App.view !== 'settings') renderView(false);
      return { result: { applied, rejected }, note: `🎨 Updated ${Object.entries(applied).map(([k, v]) => `${k}: ${v}`).join(', ')}` };
    },

    open_view({ view, month }) {
      if (!VIEWS[view]) throw new Error(`Unknown page "${view}".`);
      if (month) {
        const mm = String(month).match(/^(\d{4})-(\d{1,2})$/), t = today();
        const first = mm && new Date(+mm[1], mm[2] - 1, 1);
        if (!first || first > t) throw new Error('Month must be YYYY-MM and not in the future.');
        App.y = first.getFullYear(); App.m = first.getMonth();
      }
      if (App.view === view) renderView(true); else location.hash = '#/' + view;
      return { result: { view, month: `${App.y}-${Dates.pad(App.m + 1)}` }, note: `📍 Opened ${TITLES[view]}${month && view === 'tracker' ? ` · ${MONTHS[App.m]} ${App.y}` : ''}` };
    },
  };

  // Runs one tool. Always resolves to { result, note } so callers can show a chip and
  // send the result (or error) back to the model.
  async function runTool(name, input) {
    const fn = HANDLERS[name];
    if (!fn) return { result: { error: `Unknown tool ${name}` }, note: null, error: true };
    try {
      const out = await fn(input && typeof input === 'object' ? input : {});
      return out && 'result' in out ? out : { result: out, note: null };
    } catch (err) {
      return { result: { error: err.message || String(err) }, note: null, error: true };
    }
  }

  /* ---------- built-in (offline) commands ---------- */
  const HELP = `Here's what I can do:
- **Add a habit**: "add habit Drink water 💧"
- **Check off**: "check exercise and read", "check read yesterday", "check all"
- **Uncheck**: "uncheck meditate on monday"
- **Edit**: "rename read to Read 20 pages", "change read icon to 📚", "make exercise green"
- **Delete or reorder**: "delete habit study", "move read up"
- **Progress**: "how am I doing?", "what's left today?", "streaks", "stats for last month"
- **Look & pages**: "ocean theme", "dark mode", "go to today"
Connect Claude or GPT in settings (⚙) to talk to me in your own words.`;

  const DATE_TAIL = /\s+((?:on |for )?(?:today|yesterday|tomorrow|tonight|(?:the )?day before yesterday|\d{1,3} days? ago|(?:last |this |past )?(?:sun|mon|tues|wednes|thurs|fri|satur)day|\d{4}-\d{1,2}-\d{1,2}|[a-z]{3,9}\.? \d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)? (?:of )?[a-z]{3,9}))$/;
  function splitDate(s) {
    const m = s.match(DATE_TAIL);
    if (m && parseDate(m[1], true)) return { rest: s.slice(0, m.index).trim(), date: m[1] };
    return { rest: s, date: '' };
  }
  const cleanRef = s => s.replace(/^(?:off |my |the )+/, '').replace(/\s+(?:habits?|as done|as complete|done|off|box|for)$/, '').trim();
  function habitRefs(s) {
    s = cleanRef(s);
    if (/^(all|everything|every habit|all habits|all of them)$/.test(s)) return ['all'];
    try { findHabit(s); return [s]; } catch { /* try a list */ }
    return s.split(/\s*(?:,|&|\+|\band\b)\s*/).map(cleanRef).filter(Boolean);
  }

  function describeDay(day) {
    if (!day.total) return '';
    if (!day.left.length) return `Every habit is done for ${day.date === Dates.key(today()) ? 'today' : 'that day'}. 🎉`;
    return `${day.done.length} of ${day.total} done. Still left: ${list(day.left)}.`;
  }

  async function local(text) {
    const low = text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').replace(/^(please |can you |could you |pls )/, '');
    let m;
    const tool = async (name, input) => {
      const r = await runTool(name, input);
      if (r.error) throw new Error(r.result.error);
      return r.result;
    };

    if (!low) return HELP;
    if (/^(hi|hello|hey|salam|salaam|yo|good (morning|afternoon|evening))\b/.test(low) && low.split(' ').length <= 4) {
      const d = dayInfo(today());
      return `${greeting()}, ${App.user.displayName}! ${d.total ? describeDay(d) : 'You have no habits yet. Try "add starter habits".'}\nType **help** to see what I can do.`;
    }
    if (/^(help|\?|commands|what can you do|how does this work)/.test(low)) return HELP;
    if (/\b(starter|sample|example|default) habits?\b/.test(low)) {
      const r = await tool('add_starter_habits', {});
      return `✨ Added ${bold(r.added)}. Edit or delete any of them whenever you like.`;
    }

    // Progress questions come before "check" so "check my progress" isn't read as a habit.
    if (/\b(what'?s|what is|whats|anything) (left|remaining)|\b(still|left) to do\b|\bremaining\b|what do i (still )?(need|have) to do/.test(low)) {
      const { date } = splitDate(low);
      const d = await tool('get_day', { date });
      if (!d.total) return 'No habits yet. Add one with "add habit ...".';
      return d.left.length ? `Still left ${dayWord(parseDate(d.date))}: ${bold(d.left)}.` : `Nothing left. Every habit is done ${dayWord(parseDate(d.date))}! 🎉`;
    }
    if (/\bstreaks?\b/.test(low)) {
      const s = await tool('list_habits', {});
      if (!s.habits.length) return 'No habits yet, so no streaks yet.';
      const rest = low.replace(/.*\bstreaks?\b\s*(for|on|of)?\s*/, '').replace(/^(my|the)\s+/, '').trim();
      let only = null;
      if (rest) try { only = findHabit(rest); } catch { /* show all */ }
      const rows = s.habits.filter(h => !only || h.id === only.id)
        .map(h => `- ${h.icon} **${h.name}**: ${h.currentStreak ? `🔥 ${h.currentStreak} day${h.currentStreak > 1 ? 's' : ''}` : 'no current streak'} (best ${h.bestStreak})`);
      return `Your streaks:\n${rows.join('\n')}`;
    }
    if (/\b(stats?|statistics|progress|summary|report|how am i doing|how'?s it going|how did i do|percent|%)\b/.test(low) || /^(this|last) month$/.test(low)) {
      const t = today(), last = /\blast month\b/.test(low);
      const ref = last ? new Date(t.getFullYear(), t.getMonth() - 1, 1) : t;
      const s = await tool('get_stats', { month: `${ref.getFullYear()}-${Dates.pad(ref.getMonth() + 1)}` });
      if (!s.habits.length) return 'No habits yet. Add one and I can track your progress.';
      const rows = s.habits.map(h => `- ${h.icon} ${h.name}: **${h.pct}%** (${h.done}/${h.possible})${h.currentStreak ? ` · 🔥 ${h.currentStreak}` : ''}`);
      return `**${s.monthName}**: ${s.overallPct}% overall, ${s.checkIns} check-ins, ${s.perfectDaysThisMonth} perfect day${s.perfectDaysThisMonth === 1 ? '' : 's'}.\n${rows.join('\n')}`;
    }
    if ((m = low.match(/^(?:how (?:was|did i do|about)|what did i do|show(?: me)?) (?:on )?(.+)$/)) && parseDate(m[1], true)) {
      const d = await tool('get_day', { date: m[1] });
      return `${dayWord(parseDate(d.date))[0].toUpperCase() + dayWord(parseDate(d.date)).slice(1)}: ${d.done.length ? `done ${bold(d.done)}` : 'nothing checked'}.${d.left.length ? ` Not done: ${list(d.left)}.` : ''}`;
    }

    // "Did I read yesterday?" is a question, not a request to tick the box.
    if (/\?\s*$/.test(text) && (m = low.match(/^(?:did i|have i)\s+(?:already\s+)?(?:do(?:ne)?\s+|finish(?:ed)?\s+|complete(?:d)?\s+|check(?:ed)?\s+)?(.+)$/))) {
      const { rest, date } = splitDate(m[1]);
      const h = findHabit(cleanRef(rest)), d = parseDate(date);
      return Habits.isDone(App.data, h.id, d) ? `Yes! **${h.name}** is checked for ${dayWord(d)}. ✔️` : `Not yet. **${h.name}** isn't checked for ${dayWord(d)}.`;
    }
    if ((m = low.match(/^(?:un-?check|un-?tick|un-?mark|undo|clear|remove (?:the )?(?:check|tick) (?:from|for|on)?)\s+(.+)$/))) {
      const { rest, date } = splitDate(m[1]);
      const r = await tool('set_check', { habits: habitRefs(rest), date, done: false });
      const when = dayWord(parseDate(r.date));
      return r.changed.length ? `↩️ Unchecked ${bold(r.changed)} for ${when}.${r.unchanged.length ? ` (${list(r.unchanged)} wasn't checked.)` : ''}`
        : `${list(r.unchanged)} ${r.unchanged.length > 1 ? "weren't" : "wasn't"} checked for ${when}.`;
    }
    if ((m = low.match(/^(?:i\s+)?(?:check(?:ed)?(?: off)?|tick(?:ed)?(?: off)?|mark(?:ed)?|complete[ds]?|finish(?:ed)?|did|done(?: with)?|log(?:ged)?)\s+(.+)$/))) {
      const { rest, date } = splitDate(m[1]);
      const r = await tool('set_check', { habits: habitRefs(rest), date, done: true });
      const when = dayWord(parseDate(r.date));
      if (!r.changed.length) return `${list(r.unchanged)} ${r.unchanged.length > 1 ? 'were' : 'was'} already checked for ${when}. ✔️`;
      return `✅ Checked ${bold(r.changed)} for ${when}.${r.unchanged.length ? ` (${list(r.unchanged)} already was.)` : ''} ${describeDay(r.day)}`.trim();
    }

    if ((m = low.match(/^(?:delete|remove)\s+(?:the\s+)?(?:habit\s+)?(.+?)(?:\s+habit)?$/))) {
      const r = await tool('delete_habit', { habit: m[1] });
      return r.deleted ? `🗑️ Deleted **${r.name}** and its history.` : 'Okay, nothing was deleted.';
    }
    if ((m = text.trim().match(/^rename\s+(?:the\s+)?(?:habit\s+)?(.+?)\s+(?:to|as|into)\s+(.+)$/i))) {
      const r = await tool('update_habit', { habit: m[1], name: m[2].replace(/[.!]+$/, '') });
      return `✏️ Renamed to **${r.updated.name}**.`;
    }
    if ((m = text.trim().match(/^(?:change|set|make|use)\s+(?:the\s+)?(.+?)(?:'s)?\s+(?:icon|emoji)\s+(?:to\s+|=\s*)?(.+)$/i))) {
      const r = await tool('update_habit', { habit: m[1], icon: m[2].trim() });
      return `✏️ ${r.updated.name} now uses ${r.updated.icon}.`;
    }
    if ((m = low.match(/^(?:change|set|make|color|colour)\s+(?:the\s+)?(.+?)(?:'s)?\s+(?:colou?r\s+)?(?:to\s+)?(#?[0-9a-f]{6}|[a-z]+)$/)) && (HEX.test(m[2]) || /^[0-9a-f]{6}$/.test(m[2]) || m[2] in COLOR_WORDS)) {
      const r = await tool('update_habit', { habit: m[1].replace(/\s+colou?r$/, ''), color: m[2] });
      return `🎨 ${r.updated.name} is now ${m[2]}.`;
    }
    if ((m = low.match(/^move\s+(?:the\s+)?(?:habit\s+)?(.+?)\s+(up|down)$/))) {
      await tool('move_habit', { habit: m[1], direction: m[2] });
      return `↕️ Moved it ${m[2]}.`;
    }

    if (/^(?:(?:list|show)(?: me)?(?: all)?(?: of)? (?:my |the )?habits|(?:my )?habits|what (?:are )?my habits(?: are)?)$/.test(low)) {
      const s = await tool('list_habits', {});
      if (!s.habits.length) return 'You have no habits yet. Try "add habit Read" or "add starter habits".';
      return `Your habits:\n${s.habits.map(h => `- ${h.icon} **${h.name}** ${h.doneToday ? '✔️ done today' : '· not done today'}${h.currentStreak ? ` · 🔥 ${h.currentStreak}` : ''}`).join('\n')}`;
    }

    const theme = low.match(/^(?:(?:use|switch to|change to|set|turn on|enable|go)\s+)?(dark|light)(?: mode| theme)?$/)
      || low.match(/^(?:(?:use|switch to|change to|set|try)\s+)?(?:the )?([a-z]+) theme$/) || low.match(/\btheme (?:to )?([a-z]+)$/);
    if (theme) {
      const id = { dark: 'midnight', light: 'paper', black: 'oled', white: 'paper', auto: 'system', default: 'system' }[theme[1]] || theme[1];
      if (!CHOICES.theme.includes(id)) return `I don't know a "${theme[1]}" theme. Pick one of: ${CHOICES.theme.join(', ')}.`;
      await tool('change_settings', { theme: id });
      return `🎨 Switched to the ${THEMES.find(t => t.id === id).name} theme.`;
    }
    if ((m = low.match(/^(?:go to|open|show(?: me)?|switch to)\s+(?:the\s+)?(tracker|grid|today|profile|settings|personali[sz]e|personalization)(?: page| view)?$/))) {
      const view = { grid: 'tracker', personalize: 'settings', personalise: 'settings', personalization: 'settings' }[m[1]] || m[1];
      await tool('open_view', { view });
      return `📍 Opened ${TITLES[view]}.`;
    }

    if ((m = text.trim().match(/^(?:add|create|new|start(?: tracking)?|track|begin)\s+(?:a\s+)?(?:new\s+)?(?:daily\s+)?(?:habit\s*)?(?:called|named|:)?\s*(.+)$/i))) {
      const r = await tool('add_habit', { name: m[1].replace(/\s+(?:as a |every day|daily|habit)$/i, '').replace(/[.!]+$/, '') });
      return `${r.added.icon} Added **${r.added.name}**. Say "check ${r.added.name.toLowerCase()}" when you've done it.`;
    }

    return `I didn't catch that. In Built-in mode I understand short commands like "check read" or "add habit Walk". Type **help** for the full list, or connect Claude or GPT in settings (⚙) to chat freely.`;
  }

  /* ---------- AI providers ---------- */
  function systemPrompt() {
    return `You are the assistant inside HabitGrid, a private habit-tracker web app. You're chatting with ${App.user.displayName}. The app shows a monthly grid with one row per habit and one checkbox per day, plus a Today page, charts, a profile with streaks and achievements, and a Personalize page.

Use the tools to read and change their data. Every change must go through a tool, and every number you report (percentages, streaks, counts) must come from a tool result, never a guess.

Each user message starts with an [App context] note giving today's date and the current habits. Dates are YYYY-MM-DD in the user's local time; resolve words like "yesterday" or "Monday" against that date. Future days can't be checked.

When the user says they did something ("I went for a run"), check the matching habit for today. If no habit matches, ask whether to create one, unless they clearly asked to add it. Several actions in one message are fine. Do them all, then reply once.

Deleting a habit shows the user a confirmation dialog. If the result says they cancelled, accept that.

Keep replies short and warm: one or two sentences after an action, a short list for stats. Use plain text with **bold** for emphasis. Don't use headings or tables. You can only see and change HabitGrid data and settings. For general questions about building habits or motivation, give brief, practical advice.`;
  }

  function contextNote() {
    const t = new Date(), d = today();
    const hs = App.data.habits.map(h => `${h.icon} ${h.name} (${Habits.isDone(App.data, h.id, d) ? 'done' : 'not done'} today)`);
    return `[App context: today is ${WEEKDAYS[d.getDay()]} ${Dates.key(d)}, local time ${Dates.pad(t.getHours())}:${Dates.pad(t.getMinutes())}. `
      + `Page: ${TITLES[App.view]}. Habits: ${hs.length ? hs.join('; ') : 'none yet'}.]`;
  }

  const anthropicTools = () => TOOLS().map(t => ({ name: t.name, description: t.description,
    input_schema: { type: 'object', properties: t.props, ...(t.required ? { required: t.required } : {}) } }));
  const openaiTools = () => TOOLS().map(t => ({ type: 'function', function: { name: t.name, description: t.description,
    parameters: { type: 'object', properties: t.props, ...(t.required ? { required: t.required } : {}) } } }));

  // Effort is supported by recent Claude models only; older ones reject the field.
  const supportsEffort = model => /claude-(opus-(4-[5-9]|5)|sonnet-(4-6|5)|haiku-5|fable|mythos)/.test(model);
  // Server-side fallback when the model's safety classifier declines a request.
  const supportsFallback = model => /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model);

  async function apiError(res, provider) {
    let detail = '';
    try { const j = await res.json(); detail = (j.error && (j.error.message || j.error)) || ''; } catch { /* not JSON */ }
    const who = PROVIDERS[provider].name;
    const hint = {
      400: 'The request was rejected.', 401: `${who} rejected the API key. Check it in assistant settings (⚙).`,
      403: `This API key isn't allowed to use that model.`, 404: 'Model or endpoint not found. Check the model name in settings.',
      413: 'The conversation is too long. Clear the chat and try again.', 429: 'Rate limit hit, or the account has no credit left.',
    }[res.status] || (res.status >= 500 ? `${who} is busy or having trouble right now. Try again in a moment.` : `Request failed (${res.status}).`);
    const e = new Error(detail && typeof detail === 'string' ? `${hint} (${detail})` : hint);
    e.status = res.status;
    return e;
  }

  async function post(provider, url, headers, body) {
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: S.abort && S.abort.signal });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new Error(`Couldn't reach ${PROVIDERS[provider].name}. Check your internet connection${cfg().urls[provider] ? ' and the custom endpoint' : ''}.`);
      }
      if (res.ok) return res.json();
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) { await new Promise(r => setTimeout(r, 1500)); continue; }
      throw await apiError(res, provider);
    }
  }

  // After a server-side fallback, model-internal blocks before the last "fallback" marker
  // must not be sent back; everything after it is echoed normally.
  function echoable(content) {
    const cut = content.map(b => b.type).lastIndexOf('fallback');
    if (cut < 0) return content;
    return content.filter((b, i) => i > cut || !['thinking', 'redacted_thinking', 'tool_use', 'server_tool_use'].includes(b.type));
  }

  const ADAPTERS = {
    anthropic: {
      userMsg: text => ({ role: 'user', content: text }),
      async call(c) {
        const model = modelOf(c), key = (c.keys.anthropic || '').trim();
        const headers = { 'content-type': 'application/json', 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' };
        if (key) headers['x-api-key'] = key;
        const body = { model, max_tokens: 16000, system: S.api.system, tools: anthropicTools(), messages: S.api.history };
        if (supportsEffort(model)) body.output_config = { effort: 'low' };
        if (supportsFallback(model)) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
        const data = await post('anthropic', (c.urls.anthropic || '').trim() || PROVIDERS.anthropic.url, headers, body);
        if (data.stop_reason === 'refusal') return { refused: true };
        const content = echoable(Array.isArray(data.content) ? data.content : []);
        S.api.history.push({ role: 'assistant', content });
        return {
          texts: content.filter(b => b.type === 'text' && b.text.trim()).map(b => b.text),
          calls: content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input || {} })),
          truncated: data.stop_reason === 'max_tokens',
        };
      },
      results: rs => [{ role: 'user', content: rs.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.error ? { is_error: true } : {}) })) }],
    },

    openai: {
      userMsg: text => ({ role: 'user', content: text }),
      async call(c) {
        const model = modelOf(c), key = (c.keys.openai || '').trim();
        const headers = { 'content-type': 'application/json' };
        if (key) headers.authorization = 'Bearer ' + key;
        const body = { model, messages: [{ role: 'system', content: S.api.system }, ...S.api.history], tools: openaiTools(), max_completion_tokens: 16000 };
        const data = await post('openai', (c.urls.openai || '').trim() || PROVIDERS.openai.url, headers, body);
        const choice = (data.choices || [])[0] || {}, msg = choice.message || {};
        if (msg.refusal) return { refused: true, text: msg.refusal };
        const calls = (msg.tool_calls || []).filter(tc => tc.type === 'function');
        S.api.history.push(calls.length ? { role: 'assistant', content: msg.content || null, tool_calls: calls } : { role: 'assistant', content: msg.content || '' });
        return {
          texts: msg.content && msg.content.trim() ? [msg.content] : [],
          calls: calls.map(tc => { let input = {}; try { input = JSON.parse(tc.function.arguments || '{}'); } catch { /* bad JSON */ } return { id: tc.id, name: tc.function.name, input }; }),
          truncated: choice.finish_reason === 'length',
        };
      },
      results: rs => rs.map(r => ({ role: 'tool', tool_call_id: r.id, content: r.content })),
    },
  };

  async function askAI(c, text) {
    const p = c.provider, model = modelOf(c), ad = ADAPTERS[p];
    if (!(c.keys[p] || '').trim() && !(c.urls[p] || '').trim()) {
      add('err', `Add your ${PROVIDERS[p].name} API key in assistant settings first.`, { action: 'chatSettings', label: 'Open settings' });
      return;
    }
    if (!S.api || S.api.provider !== p || S.api.model !== model || S.api.history.length > MAX_HISTORY) {
      if (S.api && S.api.history.length > MAX_HISTORY) add('act', '🧹 Started a fresh conversation to keep things quick');
      // The system prompt stays fixed for the whole conversation; live state goes in each message.
      S.api = { provider: p, model, system: systemPrompt(), history: [] };
    }
    S.api.history.push(ad.userMsg(`${contextNote()}\n\n${text}`));
    for (let step = 0; step < MAX_STEPS; step++) {
      const r = await ad.call(c);
      if (r.refused) {
        resetApi();
        add('err', r.text || `${PROVIDERS[p].name} declined that request. I've started a fresh conversation.`);
        return;
      }
      for (const t of r.texts) add('bot', t);
      if (!r.calls.length) {
        if (r.truncated) add('err', 'The reply was cut off because it hit the length limit.');
        else if (!r.texts.length) add('bot', 'Done.');
        return;
      }
      const results = [];
      for (const call of r.calls) {
        const out = await runTool(call.name, call.input);
        if (out.note) add('act', out.note);
        if (out.error) add('act', `⚠️ ${out.result.error}`, { warn: true });
        results.push({ id: call.id, content: JSON.stringify(out.result), error: !!out.error });
      }
      S.api.history.push(...ad.results(results));
    }
    add('err', 'I stopped after too many steps. Try asking for one thing at a time.');
  }

  // Validates the key and model without spending tokens (GET /models/{id}).
  async function testConnection(p, c) {
    const model = modelOf(c, p), key = (c.keys[p] || '').trim(), custom = (c.urls[p] || '').trim();
    if (!key && !custom) throw new Error('Paste an API key first.');
    if (custom) return 'A custom endpoint is set, so the test was skipped. Send a message to try it.';
    const url = p === 'anthropic' ? `https://api.anthropic.com/v1/models/${encodeURIComponent(model)}` : `https://api.openai.com/v1/models/${encodeURIComponent(model)}`;
    const headers = p === 'anthropic'
      ? { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' }
      : { authorization: 'Bearer ' + key };
    let res;
    try { res = await fetch(url, { headers }); } catch { throw new Error(`Couldn't reach ${PROVIDERS[p].name}. Check your internet connection.`); }
    if (!res.ok) throw await apiError(res, p);
    return `Connected to ${PROVIDERS[p].name} ✓. The key works and ${model} is available.`;
  }

  /* ---------- rendering ---------- */
  const CHAT_IC = () => ic('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>');
  const SEND_IC = () => ic('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const STOP_IC = () => ic('<rect x="7" y="7" width="10" height="10" rx="1.5"/>');
  const SUGGEST = () => (App.data.habits.length
    ? ['What\'s left today?', `Check ${App.data.habits[0].name.toLowerCase()}`, 'How am I doing this month?', 'Show my streaks', 'Add habit Walk 20 minutes']
    : ['Add starter habits', 'Add habit Drink water', 'What can you do?']);

  // Escapes first, then adds a small, safe subset of Markdown (bold, italics, code, lists).
  function md(s) {
    const inline = t => esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
    const out = [];
    let ul = null;
    for (const line of String(s).replace(/\r/g, '').split('\n')) {
      const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { (ul ||= []).push(`<li>${inline(li[1])}</li>`); continue; }
      if (ul) { out.push(`<ul>${ul.join('')}</ul>`); ul = null; }
      const h = line.replace(/^#{1,6}\s+/, '');
      if (h.trim()) out.push(`<p>${inline(h)}</p>`);
    }
    if (ul) out.push(`<ul>${ul.join('')}</ul>`);
    return out.join('');
  }

  function add(role, text, extra = {}) {
    S.msgs.push({ role, text, ...extra });
    if (S.msgs.length > 200) S.msgs.splice(0, S.msgs.length - 200);
    renderBody(true);
  }

  function msgHTML(m) {
    if (m.role === 'user') return `<div class="cm user"><div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`;
    if (m.role === 'act') return `<div class="cm act${m.warn ? ' warn' : ''}">${esc(m.text)}</div>`;
    const btn = m.action ? `<button class="btn sm" data-action="${m.action}">${esc(m.label)}</button>` : '';
    return `<div class="cm ${m.role === 'err' ? 'err' : 'bot'}"><div class="bubble">${md(m.text)}${btn}</div></div>`;
  }

  function emptyHTML() {
    const c = cfg(), p = PROVIDERS[c.provider];
    return `<div class="chat-empty"><div class="chat-hello">${CHAT_IC()}</div>
      <h3>Hi ${esc(App.user.displayName)}! What would you like to do?</h3>
      <p class="muted">${c.provider === 'local' ? 'Built-in mode understands short commands and works offline. Connect Claude or GPT in ⚙ to chat in your own words.'
        : `Chatting with ${esc(p.name)} (${esc(modelOf(c))}). I can add, check and edit habits, answer questions about your progress, and change settings.`}</p>
      <div class="chips">${SUGGEST().map(q => `<button class="chip" data-action="chatSuggest" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
  }

  function renderBody(scroll) {
    const body = $('#chat-body');
    if (!body || S.view !== 'chat') return;
    body.innerHTML = (S.msgs.length ? S.msgs.map(msgHTML).join('') : emptyHTML())
      + (S.busy ? '<div class="cm bot"><div class="bubble typing" aria-label="Thinking"><i></i><i></i><i></i></div></div>' : '');
    if (scroll) body.scrollTop = body.scrollHeight;
    const send = $('#chat .chat-send'), stop = $('#chat .chat-stop');
    if (send) send.hidden = S.busy;
    if (stop) stop.hidden = !S.busy;
  }

  function settingsHTML() {
    const c = cfg();
    const section = p => {
      const P = PROVIDERS[p];
      return `<fieldset class="ai-prov" data-p="${p}" ${c.provider === p ? '' : 'hidden'}>
        <label class="field"><span>${P.name} API key</span><span class="pw"><input class="input mono" type="password" name="key_${p}" value="${esc(c.keys[p] || '')}" placeholder="${P.keyHint}" autocomplete="off" spellcheck="false">
          <button type="button" class="icon-btn" data-action="peek" aria-label="Show key" aria-pressed="false">${I.eye}</button></span>
          <small class="muted">Get a key at <a href="${P.keys}" target="_blank" rel="noopener">${P.keys.replace('https://', '')}</a></small></label>
        <label class="field"><span>Model</span><input class="input mono" name="model_${p}" list="models_${p}" value="${esc(c.models[p] || '')}" placeholder="${P.def}" spellcheck="false" autocomplete="off">
          <datalist id="models_${p}">${P.models.map(x => `<option value="${x}">`).join('')}</datalist></label>
        <details class="adv"><summary>Advanced: custom endpoint</summary>
          <label class="field"><span>Endpoint URL</span><input class="input mono" name="url_${p}" value="${esc(c.urls[p] || '')}" placeholder="${P.url}" spellcheck="false" autocomplete="off">
          <small class="muted">Use your own proxy server here so the key stays on the server. You can leave the key empty if your proxy adds it.</small></label></details>
        <div class="row-btns"><button type="button" class="btn sm" data-action="chatTest" data-p="${p}">Test connection</button></div>
      </fieldset>`;
    };
    return `<form class="chat-settings" data-form="chatSettings">
      <div class="field"><span>Assistant brain</span><div class="ai-seg" role="radiogroup">
        ${Object.entries(PROVIDERS).map(([id, P]) => `<label><input type="radio" name="provider" value="${id}" ${c.provider === id ? 'checked' : ''}><span>${P.name}</span></label>`).join('')}
      </div></div>
      <p class="muted small ai-local" ${c.provider === 'local' ? '' : 'hidden'}>Built-in mode needs no key and works offline. It understands short commands like “check read yesterday” or “add habit Walk”.</p>
      ${section('anthropic')}${section('openai')}
      <p class="ai-status small" role="status">${esc(S.note)}</p>
      <p class="muted small">${I.lock} Keys are saved only in this browser, for this profile, and are sent only to the provider you choose. Anyone using this browser profile could read them, so set a monthly spending limit on the key.</p>
      <div class="modal-foot"><button type="button" class="btn ghost" data-action="chatBack">Cancel</button><span class="grow"></span><button class="btn primary">Save</button></div>
    </form>`;
  }

  function modeLabel() {
    const c = cfg();
    return c.provider === 'local' ? PROVIDERS.local.label : `${PROVIDERS[c.provider].name} · ${modelOf(c)}`;
  }

  function renderPanel() {
    const panel = $('#chat');
    if (!panel) return;
    const settingsView = S.view === 'settings';
    panel.innerHTML = `<header class="chat-head">
        <span class="chat-badge">${CHAT_IC()}</span>
        <span class="chat-title"><b>${settingsView ? 'Assistant settings' : 'Assistant'}</b><small>${esc(modeLabel())}</small></span>
        ${settingsView ? '' : `<button class="icon-btn" data-action="chatSettings" title="Assistant settings" aria-label="Assistant settings">${I.sliders}</button>
          <button class="icon-btn" data-action="chatClear" title="Clear chat" aria-label="Clear chat">${I.broom}</button>`}
        <button class="icon-btn" data-action="chatToggle" title="Close" aria-label="Close assistant">${I.x}</button>
      </header>
      ${settingsView ? `<div class="chat-body pad">${settingsHTML()}</div>` : `<div class="chat-body" id="chat-body" aria-live="polite"></div>
      <form class="chat-input" data-form="chat">
        <textarea name="q" rows="1" maxlength="2000" placeholder="Ask me or tell me what to do…" aria-label="Message the assistant" autocomplete="off"></textarea>
        <button class="btn primary chat-send" aria-label="Send">${SEND_IC()}</button>
        <button type="button" class="btn chat-stop" data-action="chatStop" aria-label="Stop" hidden>${STOP_IC()}</button>
      </form>`}`;
    renderBody(true);
    const f = settingsView ? $('input[name="provider"]:checked', panel) : $('textarea', panel);
    if (f && S.open) f.focus();
  }

  function setOpen(open) {
    const was = S.open;
    S.open = open;
    const panel = $('#chat'), fab = $('.chat-fab');
    if (!panel) return;
    panel.hidden = !open;
    fab.hidden = open;
    fab.setAttribute('aria-expanded', open);
    document.body.classList.toggle('chat-open', open);
    if (open) renderPanel();
    else { S.view = 'chat'; if (was) fab.focus(); }
  }

  function mount() {
    if (S.uid !== App.user.id) {
      if (S.abort) S.abort.abort();
      Object.assign(S, { uid: App.user.id, open: false, busy: false, view: 'chat', msgs: [], api: null, abort: null, note: '' });
    }
    let root = $('#chat-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'chat-root';
      document.body.append(root);
    }
    root.innerHTML = `<button class="chat-fab" data-action="chatToggle" aria-label="Open assistant" aria-expanded="false" title="Assistant">${CHAT_IC()}<span>Ask</span></button>
      <aside class="chat" id="chat" role="dialog" aria-label="HabitGrid assistant" hidden></aside>`;
    setOpen(S.open);
  }

  function unmount() {
    if (S.abort) S.abort.abort();
    Object.assign(S, { uid: null, open: false, busy: false, view: 'chat', msgs: [], api: null, abort: null, note: '' });
    document.body.classList.remove('chat-open');
    const root = $('#chat-root');
    if (root) root.remove();
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || S.busy) return;
    add('user', text);
    S.busy = true;
    S.abort = new AbortController();
    renderBody(true);
    const c = cfg();
    try {
      if (c.provider === 'local') {
        const reply = await local(text);
        if (reply) add('bot', reply);
      } else {
        await askAI(c, text);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        add('act', 'Stopped');
        resetApi(); // the last turn has no reply, so start the API conversation fresh
      } else {
        add('err', err.message || String(err));
        if (c.provider !== 'local') resetApi();
      }
    } finally {
      S.busy = false;
      S.abort = null;
      renderBody(true);
      const ta = $('#chat textarea');
      if (ta && S.open) ta.focus();
    }
  }

  function readSettingsForm(form) {
    const fd = new FormData(form), c = cfg();
    c.provider = PROVIDERS[fd.get('provider')] ? fd.get('provider') : 'local';
    for (const p of ['anthropic', 'openai']) {
      c.keys[p] = String(fd.get('key_' + p) || '').trim();
      c.models[p] = String(fd.get('model_' + p) || '').trim();
      const url = String(fd.get('url_' + p) || '').trim();
      if (url && !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) throw new Error('The endpoint must start with https:// (or http://localhost for testing).');
      c.urls[p] = url;
    }
    return c;
  }

  /* ---------- events (wired into app.js's ACTIONS and FORMS) ---------- */
  const actions = {
    chatToggle() { setOpen(!S.open); },
    chatSettings() {
      S.view = 'settings';
      S.note = '';
      if (!S.open) setOpen(true); else renderPanel();
    },
    chatBack() { S.view = 'chat'; renderPanel(); },
    chatClear() {
      if (S.abort) S.abort.abort();
      S.msgs = [];
      resetApi();
      renderBody(true);
      toast('Chat cleared');
    },
    chatStop() { if (S.abort) S.abort.abort(); },
    chatSuggest(el) { send(el.dataset.q); },
    async chatTest(el) {
      const form = el.closest('form'), status = $('.ai-status', form);
      el.disabled = true;
      el.classList.add('busy');
      status.className = 'ai-status small';
      status.textContent = 'Testing…';
      try {
        status.textContent = await testConnection(el.dataset.p, readSettingsForm(form));
        status.classList.add('ok');
      } catch (err) {
        status.textContent = err.message;
        status.classList.add('bad');
      } finally {
        el.disabled = false;
        el.classList.remove('busy');
      }
    },
  };

  const forms = {
    async chat(f, fd) {
      const ta = f.elements.q;
      const text = String(fd.get('q') || '');
      ta.value = '';
      ta.style.height = '';
      await send(text);
    },
    chatSettings(f) {
      const status = $('.ai-status', f);
      try {
        const c = readSettingsForm(f);
        if (c.provider !== 'local' && !c.keys[c.provider] && !c.urls[c.provider]) throw new Error(`Paste your ${PROVIDERS[c.provider].name} API key, or pick Built-in.`);
        Store.write(cfgKey(), c);
        S.view = 'chat';
        renderPanel();
        toast(c.provider === 'local' ? 'Assistant: built-in commands' : `Assistant: ${PROVIDERS[c.provider].name} connected`);
      } catch (err) {
        status.className = 'ai-status small bad';
        status.textContent = err.message;
      }
    },
  };

  // Enter sends, Shift+Enter adds a line; the box grows with its text.
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t.matches && t.matches('.chat-input textarea') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      t.form.requestSubmit();
    } else if (e.key === 'Escape' && S.open && $('#modal-root').hidden) {
      setOpen(false);
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.matches && t.matches('.chat-input textarea')) {
      t.style.height = 'auto';
      t.style.height = Math.min(t.scrollHeight, 140) + 'px';
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'provider' && t.closest('.chat-settings')) {
      const form = t.form;
      for (const fs of $$('.ai-prov', form)) fs.hidden = fs.dataset.p !== t.value;
      $('.ai-local', form).hidden = t.value !== 'local';
      $('.ai-status', form).textContent = '';
    }
  });

  return { mount, unmount, actions, forms, open: () => setOpen(true), _local: local, _runTool: runTool, _parseDate: parseDate };
})();

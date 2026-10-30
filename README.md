# HabitGrid

A tiny, private habit tracker that runs in the browser and installs like an app on phone or desktop.
It is inspired by the popular "Habit Tracker Pro" Notion template (daily checkbox grid, completion
rings, monthly chart / calendar / table, and a focus view for today), rebuilt as a standalone app with
profiles, themes and animations.

**Live app:** https://mayarakwad.github.io/HabitGrid/

## Features

**Tracking**
- Monthly grid: one row per habit, one checkbox per day, today highlighted, past days can be backfilled.
- Completion % and progress ring for each habit; month navigation.
- **Monthly progress** with three views:
  - **Chart:** month-total donut, a smooth daily completion chart, and per-habit bars.
  - **Calendar:** heat-map of each day; tap a day to tick habits for that date.
  - **Table:** done / rate / current streak / best streak per habit.
- **Today** focus view: big tap targets, today's ring, streaks, and an optional "hide completed".
- Starter habits, emoji icons, per-habit colors, reorder, edit and delete.

**Profiles**
- Create account, sign in, sign out, and switch between several profiles on one device.
- "Keep me signed in", show/hide password, password-strength meter, and a short lockout after 5 wrong tries.
- Recovery code for forgotten passwords. Change your password or generate a new recovery code at any time.
- Edit display name, bio, avatar and profile color.
- Stats (check-ins, current/best streak, perfect days) and 8 achievements.
- Export and import a JSON backup. Delete an account (password required).

**Personalization**
- 9 themes: System, Midnight, Paper, Ocean, Forest, Dusk, Sand, Rose and OLED.
- Accent color presets plus a custom color picker.
- Font (System / Rounded / Serif / Mono), text size, density, corner style and checkbox shape.
- Color checkboxes by habit, progress rings, chart labels, week start, start screen.
- Animations: Full, Reduced (fades only) or Off. The default follows the OS "reduce motion" setting.

**Animations**
- Page and card entrances, checkbox pop with an animated tick, rings and charts that draw in,
  calendar and badge pop-ins, modal and toast transitions, and confetti on a perfect day.

## Small on purpose

- No frameworks, libraries, web fonts or images. The whole app is about 120 KB (around 32 KB gzipped).
- Check-ins are stored as one 31-bit mask per habit per month. A month of 6 habits plus the
  account is about 3 KB of browser storage.
- "Clean up" in Personalize removes leftovers, and deleting a habit deletes its history.
- Works offline after the first visit (service worker).

## Privacy & security

Everything stays in your browser's `localStorage`. Nothing is sent to a server.
Passwords and recovery codes are salted and hashed with PBKDF2-SHA-256 (150,000 iterations, Web Crypto),
and only the hashes are stored. Because accounts are local, they don't sync between devices.
Use **Export backup** / **Import backup** to move your data.

## Run it locally

Any static file server works. With Python:

```bash
python -m http.server 8765
```

Then open http://localhost:8765. Accounts need a secure page (`https://` or `localhost`) for Web Crypto.

## Project layout

```
index.html            page shell
css/style.css         themes (color tokens), layout, components, animations
js/store.js           storage, dates, habit stats (bitmasks, streaks)
js/auth.js            local accounts (PBKDF2), sessions, recovery codes
js/charts.js          SVG ring and area chart
js/app.js             UI: auth screens, tracker, today, profile, personalize
sw.js                 offline cache
manifest.webmanifest  install as an app
```

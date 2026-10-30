# HabitGrid

A small, private habit tracker for Windows and macOS. It is inspired by the popular "Habit Tracker Pro"
Notion template (daily checkbox grid, completion rings, monthly chart / calendar / table, and a focus view
for today), rebuilt as a desktop app with profiles, themes and animations.

**Download:** [latest release](https://github.com/mayarakwad/HabitGrid/releases/latest)
(`HabitGrid.exe` for Windows, `HabitGrid-mac.zip` for macOS).

## Features

**Tracking**
- Monthly grid: one row per habit, one checkbox per day, today highlighted, past days can be backfilled.
- Completion % and progress ring for each habit; month navigation.
- **Monthly progress** with three views:
  - **Chart:** month-total donut, a smooth daily completion chart, and per-habit bars.
  - **Calendar:** heat-map of each day; click a day to tick habits for that date.
  - **Table:** done / rate / current streak / best streak per habit.
- **Today** focus view: big tap targets, today's ring, streaks, and an optional "hide completed".
- Starter habits, emoji icons, per-habit colors, reorder, edit and delete.

**Profiles**
- Create account, sign in, sign out, and switch between several profiles on one computer.
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
- Animations: Full, Reduced (fades only) or Off. The default follows the system "reduce motion" setting.

**Animations**
- Page and card entrances, checkbox pop with an animated tick, rings and charts that draw in,
  calendar and badge pop-ins, dialog and toast transitions, and confetti on a perfect day.

## Small on purpose

- `HabitGrid.exe` is about 11 MB, one file, nothing to install. It uses the WebView2 browser engine that
  comes with Windows 10 and 11 (and WebKit on macOS) instead of shipping its own.
- The interface uses no libraries, web fonts or images.
- Check-ins are stored as one 31-bit mask per habit per month. A month of 6 habits plus the
  account is about 3 KB.
- "Clean up" in Personalize removes leftovers, and deleting a habit deletes its history.

## Your data

Everything is saved in one file on your computer. Nothing is sent anywhere.

- Windows: `%APPDATA%\HabitGrid\data.json`
- macOS: `~/Library/Application Support/HabitGrid/data.json`

The previous version is kept next to it as `data.json.bak`. Passwords and recovery codes are salted and
hashed with PBKDF2-SHA-256 (150,000 iterations), and only the hashes are stored. Use **Export backup** /
**Import backup** (Profile page) to move your data to another computer.

## Smart App Control

`HabitGrid.exe` isn't code-signed yet. Windows SmartScreen may warn about it ("More info" > "Run anyway"),
and Smart App Control, when it is on, can block it completely. On such a PC, run HabitGrid from the source
through Python, which is signed:

1. Install [Python 3.12](https://www.python.org/downloads/) and download this repository.
2. Double-click `build.bat` (it sets up `.venv` and also builds `dist\HabitGrid.exe`).
3. Double-click `make_shortcut.bat` to get a HabitGrid shortcut on your Desktop.

## Build

Both need Python 3.11 or newer (3.12 from python.org recommended).

- **Windows:** `build.bat` makes `dist\HabitGrid.exe`.
- **macOS:** `bash build_mac.sh` makes `dist/HabitGrid.app` and `dist/HabitGrid-mac.zip`.
  macOS's own `python3` is too old; set `PYTHON=/path/to/python3.12` if `python3.12` isn't on your PATH.
- **GitHub:** every push builds both on GitHub's machines (see the Actions tab). Pushing a version tag
  publishes a release:

  ```bash
  git tag v1.0.1 && git push origin v1.0.1
  ```

Update the version in `main.py` and `version_info.txt` first.

## Development

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python main.py
```

- Unit tests: `.venv\Scripts\python -m unittest -v`
- End-to-end check (opens the real window twice against a temporary data folder):
  `.venv\Scripts\python tests\smoke_desktop.py`
- The interface also opens in a normal browser for quick styling work (it then saves to the browser):
  serve `web/` with `python -m http.server -d web` and open http://localhost:8000.
- `make_icon.py` redraws `assets/icon.png` and `assets/icon.ico`.

## Project layout

```
main.py              desktop window, single-instance check, file dialogs
storage.py           the data file: atomic saves with a backup copy
web/index.html       the interface
web/css/style.css    themes (color tokens), layout, components, animations
web/js/store.js      data access: the app's file, or the browser for development
web/js/auth.js       local accounts (PBKDF2), sessions, recovery codes
web/js/charts.js     SVG ring and area chart
web/js/app.js        screens: sign-in, tracker, today, profile, personalize
tests/               unit tests and the end-to-end smoke test
build.bat            Windows build      build_mac.sh   macOS build
make_shortcut.bat    run-from-source shortcut for Smart App Control
```

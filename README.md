# HabitGrid

A small, private habit tracker for Windows and macOS. It is inspired by the popular "Habit Tracker Pro"
Notion template (daily checkbox grid, completion rings, monthly chart / calendar / table, and a focus view
for today), rebuilt as a desktop app with accounts, themes and animations.

## Download

Get the [latest release](https://github.com/mayarakwad/HabitGrid/releases/latest):

- **Windows:** `HabitGrid-Setup.exe` is a setup wizard. It adds Start menu and Desktop shortcuts and an
  uninstaller (Settings > Apps), and needs no administrator rights. `HabitGrid.exe` is the same app as a
  single file that runs without installing.
- **macOS** (Apple Silicon): open `HabitGrid.dmg` and drag HabitGrid to Applications.

Neither is code-signed yet; see [Smart App Control](#smart-app-control) and the release notes for the
one-time "open anyway" step.

## Features

**Accounts**
- **Questions first:** a new profile starts with 7 quick questions (goals, your why, what pulls you off
  track, when you're most locked in, first habits, how hard to push) and a "hold to commit" step. The
  answers become the profile's starting habits, and "your why" shows on the Today view. They can be skipped.
- Sign up and sign in with your **email and password**, or **continue with Google**.
- Connect Google to an email profile (or set a password on a Google profile) to sign in either way.
- Several profiles on one computer, "Keep me signed in", show/hide password, a password-strength meter,
  and a short lockout after 5 wrong passwords.
- Recovery code for forgotten passwords; change your password or make a new code at any time.
- Edit display name, email, bio, avatar and profile color. Stats, 8 achievements, JSON backup
  export/import, and account deletion.

**Tracking**
- Monthly grid: one row per habit, one checkbox per day, today highlighted, past days can be backfilled.
- Completion % and progress ring for each habit; month navigation.
- **Monthly progress** with three views:
  - **Chart:** month-total donut, a smooth daily completion chart, and per-habit bars.
  - **Calendar:** heat-map of each day; click a day to tick habits for that date.
  - **Table:** done / rate / current streak / best streak per habit.
- **Today** focus view: big tap targets, today's ring, streaks, and an optional "hide completed".
- Starter habits, emoji icons, per-habit colors, reorder, edit and delete.

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

- `HabitGrid.exe` is about 12 MB (the Mac app about 10 MB zipped). It uses the WebView2 browser engine
  that comes with Windows 10 and 11 (and WebKit on macOS) instead of shipping its own.
- The interface uses no libraries, web fonts or images.
- Check-ins are stored as one 31-bit mask per habit per month. A month of 6 habits plus the
  account is about 3 KB.
- "Clean up" in Personalize removes leftovers, and deleting a habit deletes its history.

## Your data

Profiles and habits are saved in one file on your computer:

- Windows: `%APPDATA%\HabitGrid\data.json`
- macOS: `~/Library/Application Support/HabitGrid/data.json`

The previous version is kept next to it as `data.json.bak`, and uninstalling leaves both in place.
Passwords and recovery codes are salted and hashed with PBKDF2-SHA-256 (150,000 iterations); only the
hashes are stored. Use **Export backup** / **Import backup** (Profile page) to move your data to
another computer.

HabitGrid only goes online when you use **Continue with Google**: your browser shows Google's sign-in
page, and Google tells HabitGrid your name, email and a Google account ID. Nothing else is sent anywhere.
Emails aren't verified by HabitGrid, and a forgotten password is reset with the recovery code, not by email.

## Turn on Google sign-in

Google only lets apps use its sign-in with their own OAuth client, made once in Google Cloud (free).
Until a build has one, HabitGrid simply doesn't show the Google buttons.

1. Go to [Google Cloud Console](https://console.cloud.google.com/), sign in, and create a project
   named **HabitGrid**.
2. Open **Google Auth Platform** (APIs & Services > OAuth consent screen) and click **Get started**:
   app name **HabitGrid**, your email as the support email, audience **External**, then finish.
3. Under **Audience**, either add yourself (and anyone else) as a **test user**, or click
   **Publish app** so any Google account can sign in. HabitGrid only asks for name and email, which
   don't need Google's review.
4. Under **Clients**, click **Create client**, choose **Desktop app**, name it HabitGrid, and create it.
   Click **Download JSON**.
5. To build it into the GitHub releases: in this repository's **Settings > Secrets and variables >
   Actions**, add a **New repository secret** named `GOOGLE_CLIENT_JSON` and paste the whole content
   of that file. The next build and release include Google sign-in.

   To build it yourself instead, rename the file to `google_client.json` and put it next to `main.py`
   (it's in `.gitignore`, so it won't be committed), then run `build.bat`.

For a desktop app Google doesn't treat the client secret as a real secret (it ships inside the app),
but keep the file out of the repository anyway.

## Smart App Control

The app isn't code-signed yet. Windows SmartScreen may warn about it ("More info" > "Run anyway"),
and Smart App Control, when it is on, can block it completely. On such a PC, run HabitGrid from the source
through Python, which is signed:

1. Install [Python 3.12](https://www.python.org/downloads/) and download this repository.
2. Double-click `build.bat` (it sets up `.venv` and also builds `dist\HabitGrid.exe`).
3. Double-click `make_shortcut.bat` to get a HabitGrid shortcut on your Desktop.

## Build

Both need Python 3.11 or newer (3.12 from python.org recommended).

- **Windows:** `build.bat` makes `dist\HabitGrid.exe`, and `dist\HabitGrid-Setup.exe` too when
  [Inno Setup 6](https://jrsoftware.org/isdl.php) is installed.
- **macOS:** `bash build_mac.sh` makes `dist/HabitGrid.app`, `dist/HabitGrid.dmg` and `dist/HabitGrid-mac.zip`.
  macOS's own `python3` is too old; set `PYTHON=/path/to/python3.12` if `python3.12` isn't on your PATH.
- **GitHub:** every push builds both on GitHub's machines (see the Actions tab), and on Windows installs
  and uninstalls the setup wizard to check it. Pushing a version tag publishes a release:

  ```bash
  git tag v1.1.1 && git push origin v1.1.1
  ```

Update the version in `main.py` and `version_info.txt` first.

## Development

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python main.py
```

- Unit tests: `.venv\Scripts\python -m unittest -v`
- End-to-end check (opens the real window off-screen twice, against a temporary data folder, and goes
  through email and Google accounts with stand-in Google identities): `.venv\Scripts\python tests\smoke_desktop.py`
- To try Google sign-in from source, put `google_client.json` next to `main.py`, or set
  `HABITGRID_GOOGLE_CLIENT_ID` and `HABITGRID_GOOGLE_CLIENT_SECRET`.
- The interface also opens in a normal browser for quick styling work (it then saves to the browser and
  has no Google sign-in): serve `web/` with `python -m http.server -d web` and open http://localhost:8000.
- `make_icon.py` redraws `assets/icon.png` and `assets/icon.ico`.

## Project layout

```
main.py              desktop window, single-instance check, file dialogs, Google sign-in calls
storage.py           the data file: atomic saves with a backup copy
google_auth.py       Sign in with Google: system browser, loopback redirect, PKCE
web/index.html       the interface
web/css/style.css    themes (color tokens), layout, components, animations
web/js/store.js      data access: the app's file, or the browser for development
web/js/auth.js       local accounts: email + password (PBKDF2), Google, recovery codes
web/js/charts.js     SVG ring and area chart
web/js/app.js        screens: sign-in, tracker, today, profile, personalize
tests/               unit tests and the end-to-end smoke test
installer.iss        Windows setup wizard (Inno Setup)
build.bat            Windows build      build_mac.sh   macOS build (app, .dmg, .zip)
make_shortcut.bat    run-from-source shortcut for Smart App Control
```

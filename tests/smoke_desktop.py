"""Opens the real HabitGrid window twice against a temporary data folder and drives it.

First run: creates an email account, adds habits, ticks one, changes the theme, then goes
through the Google account cases with stand-in Google identities (real Google sign-in needs
the browser and an OAuth client). Checks data.json. Second run: checks everything came back
from the file and the screens show the right sign-in options. The window opens off-screen.
Run from the project folder:
    .venv\\Scripts\\python tests\\smoke_desktop.py [screenshot.png]
"""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

FIRST = """
window.__smoke = null;
(async () => {
  const r = {};
  const fails = async (fn, text) => { try { await fn(); return 'did not fail'; } catch (e) { return e.message.includes(text) ? true : e.message; } };
  try {
    if (Store.backend !== 'desktop') throw new Error('storage backend is ' + Store.backend);
    r.googleButtonOnSignUp = !!document.querySelector('[data-form="register"] .btn.google');
    r.badEmail = await fails(() => Auth.register({ email: 'not-an-email', displayName: 'X', password: 'smoke-pass-1' }), 'valid email');

    const { user, code } = await Auth.register({ email: 'Smoke@Example.com', displayName: 'Smoke Test',
      password: 'smoke-pass-1', avatar: '🦊', color: '#2383e2' });
    r.codeLength = code.length;
    r.duplicateEmail = await fails(() => Auth.register({ email: 'smoke@example.com', displayName: 'Y', password: 'another-1' }), 'already has a profile');
    Auth.startSession(user.id, true);
    enterApp(Auth.current());
    ACTIONS.starter();
    setDone(App.data.habits[0].id, Dates.today(), true);
    updateSetting('theme', 'forest');
    r.loginByEmail = (await Auth.login('SMOKE@example.com', 'smoke-pass-1', true)).id === user.id;
    r.wrongPassword = await fails(() => Auth.login('smoke@example.com', 'nope'), 'Wrong password');

    // Google: a new account signs up, the same account signs in again.
    const gia = { sub: 'g-1', email: 'gia@gmail.com', name: 'Gia' };
    const made = Auth.googleSignIn(gia, { avatar: '🐼', color: '#30a46c' });
    r.googleCreates = made.created === true && made.user.email === 'gia@gmail.com' && !Auth.hasPassword(made.user);
    r.googleSignsInAgain = Auth.googleSignIn(gia, {}).user.id === made.user.id;
    r.googleOnlyNoPassword = await fails(() => Auth.login('gia@gmail.com', 'whatever'), 'signs in with Google');
    // Adding a password to a Google-only profile gives a recovery code and lets it sign in with email too.
    const giaCode = await Auth.addPassword(made.user.id, 'gia-pass-123');
    r.addPassword = giaCode.length === 14 && (await Auth.login('gia@gmail.com', 'gia-pass-123', false)).id === made.user.id;

    // Google with an email a password profile already uses: link needs that profile's password.
    const smokeGoogle = { sub: 'g-2', email: 'smoke@example.com', name: 'Smoke' };
    const link = Auth.googleSignIn(smokeGoogle, {});
    r.linkAsked = !!link.link && link.link.id === user.id;
    r.linkWrongPassword = await fails(() => Auth.linkGoogle(user.id, 'nope', smokeGoogle), 'Wrong password');
    await Auth.linkGoogle(user.id, 'smoke-pass-1', smokeGoogle);
    r.linkedSignIn = Auth.googleSignIn(smokeGoogle, {}).user.id === user.id;
    r.connectTaken = await fails(() => Auth.connectGoogle(user.id, gia, 'smoke-pass-1'), 'already connected');
    // Another Google account with the same email can't replace the one already connected.
    r.linkKeepsExistingGoogle = await fails(() => Auth.googleSignIn({ sub: 'g-3', email: 'smoke@example.com', name: 'X' }, {}), 'different Google account')
      && Auth.byLogin('smoke@example.com').google.sub === 'g-2';
    r.disconnectNeedsPassword = await fails(() => Auth.disconnectGoogle(user.id, 'nope'), 'Wrong password');
    r.disconnect = !(await Auth.disconnectGoogle(user.id, 'smoke-pass-1')).google && !!Auth.googleSignIn(smokeGoogle, {}).link;
    r.rightPasswordResetsCount = (Auth.byLogin('smoke@example.com').fails || 0) === 0;
    // Changing the email needs the password.
    r.emailNeedsPassword = await fails(() => Auth.setEmail(user.id, 'smoke2@example.com', 'nope'), 'Wrong password');
    r.emailChanges = (await Auth.setEmail(user.id, 'smoke2@example.com', 'smoke-pass-1')).email === 'smoke2@example.com'
      && (await Auth.setEmail(user.id, 'smoke@example.com', 'smoke-pass-1')).email === 'smoke@example.com';
    // Connecting Google from the profile page needs the profile's password.
    r.connectNeedsPassword = await fails(() => Auth.connectGoogle(user.id, smokeGoogle, 'nope'), 'Wrong password')
      && !Auth.byLogin('smoke@example.com').google;
    r.verifyGoogle = Auth.verifyGoogle(made.user.id, gia) && !Auth.verifyGoogle(made.user.id, smokeGoogle);
    // An unticked "Keep me signed in" also applies to Google sign-in.
    Auth.googleSignIn(gia, {}, false);
    r.googleRespectsKeepSignedIn = Store.read('session', '') !== made.user.id && Auth.current().id === made.user.id;

    // A profile from before emails (username only) still signs in with its username.
    const old = await Auth.register({ email: 'legacy@example.com', displayName: 'Old Timer', password: 'legacy-pass-1' });
    Auth.update(old.user.id, { email: undefined, username: 'oldtimer' });
    r.legacyLogin = (await Auth.login('OldTimer', 'legacy-pass-1', false)).id === old.user.id && Auth.label(Auth.byLogin('oldtimer')) === 'oldtimer';
    // ...and can still save Edit profile without adding an email.
    const submitProfile = async (fields) => {
      ACTIONS.editProfile();
      const form = document.querySelector('[data-form="profile"]');
      for (const [name, value] of Object.entries(fields)) {
        form.elements[name].value = value;
        form.elements[name].dispatchEvent(new Event('input', { bubbles: true }));
      }
      form.requestSubmit();
      await new Promise(res => setTimeout(res, 600));
      const err = document.querySelector('[data-form="profile"] .form-err');
      return err ? err.textContent || 'still open' : '';
    };
    enterApp(Auth.byLogin('oldtimer'));
    r.legacyEditSaved = await submitProfile({ bio: 'Still here' }) === '' && Auth.byLogin('oldtimer').bio === 'Still here' && !Auth.byLogin('oldtimer').email;
    // A password profile: saving without touching the email works; a new email needs the password.
    enterApp(Auth.byLogin('smoke@example.com'));
    r.editSavesWithoutPassword = await submitProfile({ bio: 'Daily' }) === '' && Auth.byLogin('smoke@example.com').bio === 'Daily';
    r.newEmailAsksPassword = (await submitProfile({ email: 'other@example.com', password: 'nope' })).includes('Wrong password')
      && !!Auth.byLogin('smoke@example.com');
    closeModal(true);

    // A Google-only profile left for the second run's screens.
    Auth.googleSignIn({ sub: 'g-4', email: 'solo@gmail.com', name: 'Solo' }, { avatar: '🐙', color: '#7c5cff' });

    Auth.startSession(user.id, true); // leave Smoke signed in for the second run
    enterApp(Auth.current()); // and its theme as the window's look
    await Store.flush();
    r.ok = true;
    window.__smoke = JSON.stringify(r);
  } catch (e) { window.__smoke = JSON.stringify({ ...r, ok: false, error: String(e && e.stack || e) }); }
})();
'started'
"""

SECOND = """
window.__smoke = null;
(async () => {
  const r = { backend: Store.backend, user: App.user && App.user.email, label: App.user && Auth.label(App.user),
    habits: App.data && App.data.habits.length, done: App.data && Habits.dayStats(App.data, Dates.today()).done,
    theme: document.documentElement.dataset.theme, booted: !document.documentElement.classList.contains('booting'),
    version: Store.info.version, google: Store.info.google };
  location.hash = '#/profile';
  await new Promise(res => setTimeout(res, 300));
  r.profileOffersConnectGoogle = !!document.querySelector('[data-action="connectGoogle"]');
  r.profileShowsEmail = document.querySelector('.pc-info').textContent.includes('smoke@example.com');
  ACTIONS.logout();
  r.pickTiles = document.querySelectorAll('.profile-tile:not(.add)').length;
  r.pickOffersGoogle = document.querySelector('.auth-links [data-m="login"]').textContent.includes('Google');
  AuthUI.pick = 'gia@gmail.com'; AuthUI.mode = 'login'; renderAuth();
  r.googleOnlyGetsPasswordForm = !!document.querySelector('[data-form="login"]'); // Gia added a password
  AuthUI.pick = 'solo@gmail.com'; AuthUI.mode = 'login'; renderAuth();
  r.googleOnlyHasKeepSignedIn = !!document.querySelector('.auth-card input[name="remember"]') && !!document.querySelector('.btn.google')
    && !document.querySelector('[data-form="login"]');
  // "Continue with Google" on Solo's screen, with Google's answer faked (no browser): another
  // account must not open or create a profile; Solo's own account signs in.
  const realSignIn = Store.api.google_sign_in;
  let hint = 'unset', answer = { sub: 'g-99', email: 'dad@gmail.com', name: 'Dad' };
  Store.api.google_sign_in = h => { hint = h; return Promise.resolve(answer); };
  const tapGoogle = async () => { document.querySelector('.btn.google').click(); await new Promise(res => setTimeout(res, 400)); };
  AuthUI.pick = 'solo@gmail.com'; AuthUI.mode = 'login'; renderAuth();
  await tapGoogle();
  r.pickedPreselectsAccount = hint === 'solo@gmail.com';
  r.pickedRejectsOtherAccount = !App.user && !Auth.byLogin('dad@gmail.com')
    && document.querySelector('#modal-root h2').textContent.includes('different Google account');
  closeModal(true);
  answer = { sub: 'g-4', email: 'solo@gmail.com', name: 'Solo' };
  await tapGoogle();
  r.pickedSignsInWithOwnAccount = !!App.user && App.user.email === 'solo@gmail.com';
  Store.api.google_sign_in = realSignIn;
  ACTIONS.logout();
  AuthUI.pick = null; AuthUI.mode = 'login'; renderAuth();
  r.loginHasGoogleAndEmail = !!document.querySelector('.btn.google') && !!document.querySelector('input[name="login"]');
  r.ok = true;
  window.__smoke = JSON.stringify(r);
})();
'started'
"""


def capture(path):
    """Saves the HabitGrid window's own pixels (works while it's off-screen). Windows only."""
    import ctypes
    from ctypes import wintypes
    from PIL import Image
    import main as app
    hwnd = app._find_app_window()
    user32, gdi32 = ctypes.WinDLL("user32"), ctypes.WinDLL("gdi32")
    for f in (user32.GetWindowDC, gdi32.CreateCompatibleDC, gdi32.CreateCompatibleBitmap):
        f.restype = ctypes.c_void_p
    V = ctypes.c_void_p
    r = wintypes.RECT()
    user32.GetWindowRect(V(hwnd), ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    dc = user32.GetWindowDC(V(hwnd))
    mem = gdi32.CreateCompatibleDC(V(dc))
    bmp = gdi32.CreateCompatibleBitmap(V(dc), w, h)
    gdi32.SelectObject(V(mem), V(bmp))
    user32.PrintWindow(V(hwnd), V(mem), 2)  # PW_RENDERFULLCONTENT includes WebView2's content
    header = (ctypes.c_uint32 * 10)(40, w, ctypes.c_uint32(-h).value, 1 | (32 << 16), 0, 0, 0, 0, 0, 0)
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(V(mem), V(bmp), 0, h, buf, header, 0)
    Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB").save(path)
    gdi32.DeleteObject(V(bmp))
    gdi32.DeleteDC(V(mem))
    user32.ReleaseDC(V(hwnd), V(dc))


def drive(window, script, screenshot):
    """Runs in pywebview's worker thread: waits for the app, runs the script, closes the window."""
    result = {"ok": False, "error": "timed out"}
    try:
        deadline = time.time() + 40
        while time.time() < deadline:
            try:
                if window.evaluate_js("typeof App !== 'undefined' && Store.backend === 'desktop' && !!$('#app').firstElementChild"):
                    break
            except Exception:
                pass
            time.sleep(0.25)
        window.evaluate_js(script)
        while time.time() < deadline:
            raw = window.evaluate_js("window.__smoke")
            if raw:
                result = json.loads(raw)
                break
            time.sleep(0.25)
        if screenshot and sys.platform == "win32":
            time.sleep(1.5)  # let the entrance animations finish
            capture(screenshot)  # works off-screen; no window.on_top (it can deadlock from this thread)
    except Exception as e:  # report instead of hanging the window open
        result = {"ok": False, "error": repr(e)}
    finally:
        print("RESULT " + json.dumps(result), flush=True)
        window.destroy()


def run_phase(phase, screenshot):
    import webview
    import main as app
    # Off-screen, so the test doesn't pop up in front of whatever you're doing.
    window, store = app.create_main_window(app.data_folder(), x=-4000, y=60)
    webview.start(drive, (window, FIRST if phase == "first" else SECOND, screenshot), private_mode=True)
    store.wait()


def run(phase, folder, screenshot=""):
    # A stand-in OAuth client makes the app show its Google buttons.
    env = dict(os.environ, HABITGRID_DATA_DIR=str(folder),
               HABITGRID_GOOGLE_CLIENT_ID="smoke-test.apps.googleusercontent.com", HABITGRID_GOOGLE_CLIENT_SECRET="smoke")
    out = subprocess.run([sys.executable, __file__, "--phase", phase, screenshot], env=env,
                         capture_output=True, text=True, timeout=150, encoding="utf-8")
    lines = [line for line in out.stdout.splitlines() if line.startswith("RESULT ")]
    if not lines:
        raise SystemExit(f"{phase} run printed no result.\nstdout:\n{out.stdout}\nstderr:\n{out.stderr}")
    return json.loads(lines[-1][7:])


def main():
    shot = sys.argv[1] if len(sys.argv) > 1 else ""
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp) / "HabitGrid"
        first = run("first", folder)
        print("first run:", first)
        for key, value in first.items():
            if key == "codeLength":
                ok = value == 14
            elif key == "error":
                ok = False
            else:
                ok = value is True
            if not ok:
                failures.append(f"first run {key} = {value!r}")

        data = json.loads((folder / "data.json").read_text("utf-8"))
        users = {(u.get("email") or u.get("username")): u for u in data.get("hg.users", {}).values()}
        if sorted(users) != ["gia@gmail.com", "oldtimer", "smoke@example.com", "solo@gmail.com"]:
            failures.append(f"data.json profiles: {sorted(users)}")
        else:
            if any(p in json.dumps(data) for p in ("smoke-pass-1", "gia-pass-123", "legacy-pass-1")):
                failures.append("a password was saved in plain text")
            if users["smoke@example.com"].get("google") or "hash" not in users["smoke@example.com"]:
                failures.append("smoke profile: expected a password and no Google link")
            if (users["gia@gmail.com"].get("google") or {}).get("sub") != "g-1" or "hash" not in users["gia@gmail.com"]:
                failures.append("Google profile: expected Google link g-1 and an added password")
            habits = data.get("hg.data." + users["smoke@example.com"]["id"], {}).get("habits", [])
            if len(habits) != 5:
                failures.append(f"data.json has {len(habits)} habits")
        if data.get("hg.look", {}).get("theme") != "forest":
            failures.append("theme not saved")

        second = run("second", folder, shot)
        print("second run:", second)
        expected = {"ok": True, "backend": "desktop", "user": "smoke@example.com", "label": "smoke@example.com",
                    "habits": 5, "done": 1, "theme": "forest", "booted": True, "google": True,
                    "profileOffersConnectGoogle": True, "profileShowsEmail": True, "pickTiles": 4, "pickOffersGoogle": True,
                    "googleOnlyGetsPasswordForm": True, "googleOnlyHasKeepSignedIn": True, "loginHasGoogleAndEmail": True,
                    "pickedPreselectsAccount": True, "pickedRejectsOtherAccount": True, "pickedSignsInWithOwnAccount": True,
                    "version": "1.1.1"}
        for key, value in expected.items():
            if second.get(key) != value:
                failures.append(f"second run {key} = {second.get(key)!r}, expected {value!r}")

    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        sys.exit(1)
    print("PASSED")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--phase":
        run_phase(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    else:
        main()

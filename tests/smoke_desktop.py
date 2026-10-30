"""Opens the real HabitGrid window twice against a temporary data folder and drives it.

First run: creates an account, adds habits, ticks one, changes the theme, and checks
data.json. Second run: checks the account, habits and theme came back from the file.
Each run opens a window for a few seconds. Run from the project folder:
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
  try {
    if (Store.backend !== 'desktop') throw new Error('storage backend is ' + Store.backend);
    const { user, code } = await Auth.register({ username: 'smoke', displayName: 'Smoke Test',
      password: 'smoke-pass-1', avatar: '🦊', color: '#2383e2' });
    Auth.startSession(user.id, true);
    enterApp(Auth.current());
    ACTIONS.starter();
    setDone(App.data.habits[0].id, Dates.today(), true);
    updateSetting('theme', 'forest');
    await Store.flush();
    window.__smoke = JSON.stringify({ ok: true, habits: App.data.habits.length, codeLength: code.length });
  } catch (e) { window.__smoke = JSON.stringify({ ok: false, error: String(e && e.stack || e) }); }
})();
'started'
"""

SECOND = """
window.__smoke = JSON.stringify({
  ok: true, backend: Store.backend, user: App.user && App.user.username,
  habits: App.data && App.data.habits.length, done: App.data && Habits.dayStats(App.data, Dates.today()).done,
  theme: document.documentElement.dataset.theme, view: App.view,
  booted: !document.documentElement.classList.contains('booting'),
  version: Store.info.version,
});
'started'
"""


def drive(window, script, screenshot):
    """Runs in pywebview's worker thread: waits for the app, runs the script, closes the window."""
    import webview  # noqa: F401 (already imported by main)
    result = {"ok": False, "error": "timed out"}
    try:
        deadline = time.time() + 30
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
        if screenshot:
            # Setting this while WebView2 is still starting hangs it, so only now.
            window.on_top = True  # so the screenshot shows HabitGrid, not whatever is in front
            time.sleep(1.5)  # let the entrance animations finish
            from PIL import ImageGrab
            ImageGrab.grab(bbox=(window.x, window.y, window.x + window.width, window.y + window.height)).save(screenshot)
    except Exception as e:  # report instead of hanging the window open
        result = {"ok": False, "error": repr(e)}
    finally:
        print("RESULT " + json.dumps(result), flush=True)
        window.destroy()


def run_phase(phase, screenshot):
    import webview
    import main as app
    window, store = app.create_main_window(app.data_folder())
    webview.start(drive, (window, FIRST if phase == "first" else SECOND, screenshot), private_mode=True)
    store.wait()


def run(phase, folder, screenshot=""):
    env = dict(os.environ, HABITGRID_DATA_DIR=str(folder))
    out = subprocess.run([sys.executable, __file__, "--phase", phase, screenshot], env=env,
                         capture_output=True, text=True, timeout=120, encoding="utf-8")
    lines = [l for l in out.stdout.splitlines() if l.startswith("RESULT ")]
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
        if not (first.get("ok") and first.get("habits") == 5 and first.get("codeLength") == 14):
            failures.append("first run did not complete")

        data = json.loads((folder / "data.json").read_text("utf-8"))
        users = list(data.get("hg.users", {}).values())
        if [u["username"] for u in users] != ["smoke"]:
            failures.append(f"data.json users: {users}")
        elif "hash" not in users[0] or "smoke-pass-1" in json.dumps(data):
            failures.append("password not hashed")
        else:
            habits = data.get("hg.data." + users[0]["id"], {}).get("habits", [])
            if len(habits) != 5:
                failures.append(f"data.json has {len(habits)} habits")
        if data.get("hg.look", {}).get("theme") != "forest":
            failures.append("theme not saved")

        second = run("second", folder, shot)
        print("second run:", second)
        expected = {"ok": True, "backend": "desktop", "user": "smoke", "habits": 5, "done": 1, "theme": "forest", "booted": True}
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

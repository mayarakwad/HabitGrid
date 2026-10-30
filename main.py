"""HabitGrid desktop app: the HabitGrid UI (web/) in a native window, with data kept in a file."""
import hashlib
import os
import sys
import time
from pathlib import Path

import webview

from storage import DataFile

APP = "HabitGrid"
VERSION = "1.0.0"

# Bundled files live next to this script, or in PyInstaller's unpack folder.
WEB = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "web"

# Window color shown before the page draws, per theme (the --bg values in web/css/style.css).
BACKGROUNDS = {
    "midnight": "#191919", "paper": "#ffffff", "ocean": "#0d1522", "forest": "#0f1712",
    "dusk": "#1a1120", "sand": "#f5f0e6", "rose": "#fff4f6", "oled": "#000000",
}
MAX_IMPORT_BYTES = 2_000_000
_instance_mutex = None  # held for the life of the process


def data_folder():
    if os.environ.get("HABITGRID_DATA_DIR"):  # set by the tests
        return Path(os.environ["HABITGRID_DATA_DIR"])
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming") / APP
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / APP


def _windows_prefers_light():
    try:
        import winreg
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            return winreg.QueryValueEx(key, "AppsUseLightTheme")[0] == 1
    except OSError:
        return False


def background_for(look):
    theme = look.get("theme", "system") if isinstance(look, dict) else "system"
    if theme == "system":
        theme = "paper" if sys.platform == "win32" and _windows_prefers_light() else "midnight"
    return BACKGROUNDS.get(theme, "#191919")


def claim_single_instance(folder, wait=5.0):
    """Whether this copy may run: two copies saving the same file would overwrite each
    other's changes.

    Returns True if no other HabitGrid uses this data folder, False after bringing the
    other copy's window forward, or None if another copy holds the folder but shows no
    window within `wait` seconds (it may still be starting or closing, which this waits
    out). macOS already opens only one copy of an app, so this is Windows-only.
    """
    global _instance_mutex
    if sys.platform != "win32":
        return True
    import ctypes
    from ctypes import wintypes
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateMutexW.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
    name = "Local\\HabitGrid." + hashlib.sha1(str(folder).lower().encode()).hexdigest()[:16]
    deadline = time.monotonic() + wait
    while True:
        handle = kernel32.CreateMutexW(None, False, name)
        error = ctypes.get_last_error()
        # No handle means the mutex exists but we may not open it: a copy started with
        # "Run as administrator" holds it. ERROR_ALREADY_EXISTS (183): an ordinary copy.
        if handle and error != 183:
            _instance_mutex = handle
            return True
        if handle:
            kernel32.CloseHandle(handle)
        hwnd = _find_app_window()
        if hwnd:
            user32 = ctypes.WinDLL("user32")
            user32.IsIconic.argtypes = (wintypes.HWND,)
            user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
            user32.SetForegroundWindow.argtypes = (wintypes.HWND,)
            if user32.IsIconic(hwnd):  # only un-minimize: SW_RESTORE would un-maximize too
                user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            user32.SetForegroundWindow(hwnd)
            return False
        if time.monotonic() >= deadline:
            return None
        time.sleep(0.2)


def _show_message(text):
    if sys.platform == "win32":
        import ctypes
        ctypes.WinDLL("user32").MessageBoxW(None, text, APP, 0x40)  # MB_ICONINFORMATION


def _find_app_window():
    """The visible HabitGrid window (pywebview's WinForms form), or None.

    Matching the window class too skips, say, an Explorer window on a folder named HabitGrid.
    """
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.WinDLL("user32")
    found = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def check(hwnd, _):
        title, cls = ctypes.create_unicode_buffer(64), ctypes.create_unicode_buffer(128)
        user32.GetWindowTextW(hwnd, title, 64)
        user32.GetClassNameW(hwnd, cls, 128)
        if title.value == APP and cls.value.startswith("WindowsForms") and user32.IsWindowVisible(hwnd):
            found.append(hwnd)
            return False  # stop
        return True

    user32.EnumWindows(check, 0)
    return found[0] if found else None


class Api:
    """Called from the page as window.pywebview.api.<name>(); each returns a Promise there."""

    def __init__(self, store):
        self._store = store
        self._window = None

    def load(self):
        return self._store.load()

    def save(self, seq, text):
        return self._store.save(int(seq), str(text))

    def info(self):
        return {"version": VERSION, "dataFile": str(self._store.path)}

    def export_backup(self, filename, text):
        """Asks where to save a backup and writes it. Returns the path, or None if cancelled."""
        chosen = self._window.create_file_dialog(
            webview.FileDialog.SAVE, save_filename=str(filename), file_types=("HabitGrid backup (*.json)",))
        if not chosen:
            return None
        path = Path(chosen if isinstance(chosen, str) else chosen[0])
        path.write_text(str(text), encoding="utf-8")
        return str(path)

    def import_backup(self):
        """Asks for a backup file and returns its text, or None if cancelled."""
        chosen = self._window.create_file_dialog(
            webview.FileDialog.OPEN, file_types=("HabitGrid backup (*.json)", "All files (*.*)"))
        if not chosen:
            return None
        path = Path(chosen if isinstance(chosen, str) else chosen[0])
        if path.stat().st_size > MAX_IMPORT_BYTES:
            raise ValueError("That file is too large to be a HabitGrid backup.")
        try:
            return path.read_text(encoding="utf-8-sig")  # also accepts a byte order mark
        except UnicodeDecodeError:
            raise ValueError("That file isn't a HabitGrid backup.") from None


def create_main_window(folder):
    store = DataFile(folder)
    api = Api(store)
    window = webview.create_window(
        APP,
        # ?app=desktop tells the page to keep its data through the Api, not browser storage.
        url=str(WEB / "index.html") + "?app=desktop",
        js_api=api,
        width=1240,
        height=820,
        min_size=(400, 560),
        background_color=background_for(store.load().get("hg.look")),
        text_select=True,  # lets people select their recovery code
    )
    api._window = window
    return window, store


def main():
    folder = data_folder()
    claimed = claim_single_instance(folder)
    if claimed is None:
        _show_message("HabitGrid is already open, maybe as administrator. Close it there, then try again.")
    if not claimed:
        return
    _, store = create_main_window(folder)
    webview.start(private_mode=True)  # no browser storage needed: data goes to the file
    store.wait()


if __name__ == "__main__":
    main()

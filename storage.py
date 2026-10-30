"""HabitGrid's data file: one small JSON object, replaced atomically on every save."""
import json
import os
import threading
import time
from pathlib import Path

MAX_BYTES = 5 * 1024 * 1024  # years of habits for many profiles fit in a few hundred KB


class DataFile:
    """All profiles and habits, kept in data.json with the previous version in data.json.bak."""

    def __init__(self, folder):
        self.folder = Path(folder)
        self.path = self.folder / "data.json"
        self.backup = self.folder / "data.json.bak"
        self._lock = threading.Lock()
        self._last_seq = 0

    def load(self):
        """The saved data, or the backup if data.json is missing or damaged, or {}.

        Any other read error (say the file is locked) is raised: treating that file as
        missing would let the next saves replace both it and the backup.
        """
        with self._lock:
            # A reloaded page numbers its saves afresh, so forget the old page's numbering.
            self._last_seq = 0
            for path in (self.path, self.backup):
                try:
                    data = json.loads(_read(path))
                except FileNotFoundError:
                    continue
                except ValueError:  # damaged, e.g. cut off mid-write (includes bad UTF-8)
                    continue
                if isinstance(data, dict):
                    return data
            return {}

    def save(self, seq, text):
        """Writes a full snapshot of the data.

        Saves run on separate threads and can finish out of order; each one is a complete
        snapshot, so one numbered lower than the last write is older and is skipped.
        Returns True if written, False if skipped.
        """
        if len(text.encode("utf-8")) > MAX_BYTES:
            raise ValueError("HabitGrid's data is larger than 5 MB.")
        if not isinstance(json.loads(text), dict):
            raise ValueError("HabitGrid's data must be a JSON object.")
        with self._lock:
            if seq <= self._last_seq:
                return False
            self.folder.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_name("data.json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(text)
                f.flush()
                os.fsync(f.fileno())
            if self.path.exists():
                _replace(self.path, self.backup)
            _replace(tmp, self.path)
            self._last_seq = seq
            return True

    def wait(self):
        """Returns once no save is in progress (call before the process exits)."""
        with self._lock:
            pass


# On Windows a virus scanner or backup tool can hold the file open for a moment, so both
# reading and replacing retry briefly before giving up.

def _read(path, attempts=5):
    for attempt in range(attempts):
        try:
            return path.read_text(encoding="utf-8")
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.05 * (attempt + 1))


def _replace(src, dst, attempts=5):
    for attempt in range(attempts):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.05 * (attempt + 1))

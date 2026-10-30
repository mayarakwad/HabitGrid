import json
import random
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from storage import MAX_BYTES, DataFile


class DataFileTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name) / "HabitGrid"
        self.store = DataFile(self.folder)

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing_file_loads_empty(self):
        self.assertEqual(self.store.load(), {})

    def test_save_then_load(self):
        self.assertTrue(self.store.save(1, json.dumps({"hg.users": {"u1": {"username": "amy"}}})))
        self.assertEqual(DataFile(self.folder).load(), {"hg.users": {"u1": {"username": "amy"}}})

    def test_previous_version_kept_as_backup(self):
        self.store.save(1, '{"v": 1}')
        self.store.save(2, '{"v": 2}')
        self.assertEqual(json.loads(self.store.backup.read_text("utf-8")), {"v": 1})
        self.assertFalse((self.folder / "data.json.tmp").exists())

    def test_older_snapshot_is_skipped(self):
        self.store.save(5, '{"v": 5}')
        self.assertFalse(self.store.save(4, '{"v": 4}'))
        self.assertEqual(self.store.load(), {"v": 5})

    def test_reloaded_page_can_save_again(self):
        self.store.save(500, '{"v": "old page"}')
        self.store.load()  # what a reloaded page does first
        self.assertTrue(self.store.save(1, '{"v": "new page"}'))
        self.assertEqual(self.store.load(), {"v": "new page"})

    def test_damaged_file_falls_back_to_backup(self):
        self.store.save(1, '{"v": 1}')
        self.store.save(2, '{"v": 2}')
        self.store.path.write_text('{"v": 2', "utf-8")  # cut off mid-write
        self.assertEqual(self.store.load(), {"v": 1})

    def test_unreadable_file_is_an_error_not_empty(self):
        self.store.save(1, '{"v": 1}')
        self.store.save(2, '{"v": 2}')
        with mock.patch.object(Path, "read_text", side_effect=PermissionError("locked")):
            with self.assertRaises(PermissionError):
                self.store.load()
        self.assertEqual(self.store.load(), {"v": 2})

    def test_briefly_locked_file_is_read_after_a_retry(self):
        self.store.save(1, '{"v": 1}')
        real = Path.read_text
        calls = []

        def flaky(path, *args, **kwargs):
            calls.append(path)
            if len(calls) == 1:
                raise PermissionError("locked for a moment")
            return real(path, *args, **kwargs)

        with mock.patch.object(Path, "read_text", flaky):
            self.assertEqual(self.store.load(), {"v": 1})

    def test_rejects_non_objects_and_oversized_data(self):
        with self.assertRaises(ValueError):
            self.store.save(1, "[1, 2]")
        with self.assertRaises(ValueError):
            self.store.save(2, "not json")
        with self.assertRaises(ValueError):
            self.store.save(3, json.dumps({"x": "a" * MAX_BYTES}))
        self.assertFalse(self.store.path.exists())

    def test_keeps_non_ascii_text(self):
        self.store.save(1, json.dumps({"name": "Café 🏃"}, ensure_ascii=False))
        self.assertEqual(self.store.load(), {"name": "Café 🏃"})

    def test_concurrent_saves_keep_the_newest(self):
        seqs = list(range(1, 41))
        random.Random(7).shuffle(seqs)
        threads = [threading.Thread(target=self.store.save, args=(n, json.dumps({"v": n}))) for n in seqs]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.store.wait()
        self.assertEqual(json.loads(self.store.path.read_text("utf-8")), {"v": 40})


if __name__ == "__main__":
    unittest.main()

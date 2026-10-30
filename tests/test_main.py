import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import main
from storage import DataFile


class MainTest(unittest.TestCase):
    def test_data_folder_override(self):
        with mock.patch.dict(os.environ, {"HABITGRID_DATA_DIR": "/tmp/hg-test"}):
            self.assertEqual(main.data_folder(), Path("/tmp/hg-test"))

    def test_data_folder_is_per_user(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("HABITGRID_DATA_DIR", None)
            folder = main.data_folder()
        self.assertEqual(folder.name, "HabitGrid")

    def test_background_follows_saved_theme(self):
        self.assertEqual(main.background_for({"theme": "sand"}), "#f5f0e6")
        self.assertEqual(main.background_for({"theme": "unknown"}), "#191919")
        self.assertIn(main.background_for(None), ("#191919", "#ffffff"))

    def test_bundled_ui_exists(self):
        self.assertTrue((main.WEB / "index.html").is_file())

    def test_api_info_and_save(self):
        with tempfile.TemporaryDirectory() as tmp:
            api = main.Api(DataFile(tmp))
            self.assertEqual(api.info()["version"], main.VERSION)
            self.assertTrue(api.save(1, '{"a": 1}'))
            self.assertEqual(api.load(), {"a": 1})

    def test_api_exposes_no_private_state(self):
        # pywebview shares every public attribute of the Api with the page.
        public = [name for name in vars(main.Api(DataFile("."))) if not name.startswith("_")]
        self.assertEqual(public, [])

    @unittest.skipUnless(sys.platform == "win32", "Windows only")
    def test_single_instance_per_data_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = Path(tmp) / "a"
            self.assertIs(main.claim_single_instance(first, wait=0), True)
            held = main._instance_mutex
            started = time.monotonic()
            self.assertIsNone(main.claim_single_instance(first, wait=0.5))  # taken, no window to hand over to
            self.assertGreaterEqual(time.monotonic() - started, 0.5)
            self.assertIs(main.claim_single_instance(Path(tmp) / "b", wait=0), True)
            del held

    @unittest.skipUnless(sys.platform == "win32", "Windows only")
    def test_mutex_we_may_not_open_counts_as_taken(self):
        # A copy run as administrator owns a mutex this copy may not open: CreateMutexW
        # returns no handle (ERROR_ACCESS_DENIED), which must not read as "we're alone".
        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch("ctypes.WinDLL") as windll, mock.patch("ctypes.get_last_error", return_value=5), \
                mock.patch.object(main, "_find_app_window", return_value=None):
            windll.return_value.CreateMutexW.return_value = None
            self.assertIsNone(main.claim_single_instance(Path(tmp), wait=0))

    def test_import_backup_accepts_a_byte_order_mark(self):
        with tempfile.TemporaryDirectory() as tmp:
            backup = Path(tmp) / "backup.json"
            backup.write_bytes(b"\xef\xbb\xbf" + b'{"habits": []}')
            api = main.Api(DataFile(tmp))
            api._window = mock.Mock(create_file_dialog=mock.Mock(return_value=(str(backup),)))
            self.assertEqual(api.import_backup(), '{"habits": []}')
            backup.write_bytes('{"habits": []}'.encode("utf-16"))
            with self.assertRaisesRegex(ValueError, "isn't a HabitGrid backup"):
                api.import_backup()


if __name__ == "__main__":
    unittest.main()

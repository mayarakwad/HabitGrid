import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import google_auth
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

    def test_google_sign_in_off_without_a_client(self):
        with tempfile.TemporaryDirectory() as tmp:
            api = main.Api(DataFile(tmp))
            self.assertFalse(api.info()["google"])
            with self.assertRaisesRegex(google_auth.GoogleSignInError, "isn't set up"):
                api.google_sign_in()
            api.google_cancel()  # nothing to cancel: no error

    def test_google_client_file_turns_it_on(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("HABITGRID_GOOGLE_CLIENT_ID", None)
            client_file = Path(tmp) / "google_client.json"
            client_file.write_text('{"installed": {"client_id": "id.apps.googleusercontent.com", "client_secret": "s"}}')
            with mock.patch.object(main, "GOOGLE_CLIENT_FILE", client_file), mock.patch.object(main.webview, "create_window") as create:
                main.create_main_window(Path(tmp) / "data")
            api = create.call_args.kwargs["js_api"]
            self.assertTrue(api.info()["google"])

    def test_coming_back_from_google_on_windows_uses_win32_only(self):
        # pywebview's restore() un-maximizes, and its on_top setter can deadlock from a call thread.
        class Window:
            def __init__(self):
                self.calls = []

            def restore(self):
                self.calls.append("restore")

            @property
            def on_top(self):
                return False

            @on_top.setter
            def on_top(self, value):
                self.calls.append(f"on_top={value}")

        api = main.Api(DataFile("."))
        api._window = Window()
        with mock.patch.object(main.sys, "platform", "win32"), mock.patch.object(main, "_find_app_window", return_value=42), \
                mock.patch.object(main, "_focus_window") as focus, mock.patch.object(main, "_raise_window") as raise_:
            api._bring_to_front()
        focus.assert_called_once_with(42)
        raise_.assert_called_once_with(42)
        self.assertEqual(api._window.calls, [])
        with mock.patch.object(main.sys, "platform", "darwin"):
            api._bring_to_front()
        self.assertEqual(api._window.calls, ["restore", "on_top=True", "on_top=False"])

    def test_google_failure_still_brings_the_app_forward(self):
        class FailingSignIn:
            def __init__(self, client):
                pass

            def run(self):
                raise google_auth.GoogleSignInError("This Google account has no verified email address.")

        api = main.Api(DataFile("."), {"client_id": "x", "client_secret": "y"})
        with mock.patch.object(google_auth, "SignIn", FailingSignIn), mock.patch.object(api, "_bring_to_front") as front:
            with self.assertRaises(google_auth.GoogleSignInError):
                api.google_sign_in()
        front.assert_called_once()

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

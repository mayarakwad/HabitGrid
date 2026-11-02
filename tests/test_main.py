import io
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
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
            cancelled = False

            def __init__(self, client, login_hint=None):
                pass

            def run(self):
                raise google_auth.GoogleSignInError("This Google account has no verified email address.")

        api = main.Api(DataFile("."), {"client_id": "x", "client_secret": "y"})
        with mock.patch.object(google_auth, "SignIn", FailingSignIn), mock.patch.object(api, "_bring_to_front") as front:
            with self.assertRaises(google_auth.GoogleSignInError):
                api.google_sign_in()
        front.assert_called_once()

    def test_cancelled_or_replaced_sign_in_stays_in_the_background(self):
        # Such an attempt can finish late (a slow exchange); coming forward then would cover
        # whatever the person is using now, such as the browser of a newer attempt.
        class SlowSignIn:
            def __init__(self, client, login_hint=None):
                self.cancelled = False
                self.started, self.finish = threading.Event(), threading.Event()

            def cancel(self):
                self.cancelled = True
                self.finish.set()

            def run(self):
                self.started.set()
                self.finish.wait(5)
                raise google_auth.Cancelled("Google sign-in was cancelled.")

        api = main.Api(DataFile("."), {"client_id": "x", "client_secret": "y"})
        outcomes = []

        def attempt():  # one pywebview call thread
            try:
                api.google_sign_in()
            except google_auth.Cancelled:
                outcomes.append("cancelled")

        def start_attempt():
            before = api._signin
            thread = threading.Thread(target=attempt)
            thread.start()
            deadline = time.monotonic() + 5
            while (api._signin is None or api._signin is before) and time.monotonic() < deadline:
                time.sleep(0.01)
            api._signin.started.wait(5)
            return thread, api._signin

        with mock.patch.object(google_auth, "SignIn", SlowSignIn), mock.patch.object(api, "_bring_to_front") as front:
            first, _ = start_attempt()
            api.google_cancel()  # Cancel in HabitGrid's dialog
            first.join(5)
            old, old_signin = start_attempt()
            new, _ = start_attempt()  # "Continue with Google" again replaces the old attempt
            old.join(5)
            self.assertTrue(old_signin.cancelled)
            api.google_cancel()
            new.join(5)
        self.assertEqual(outcomes, ["cancelled"] * 3)
        front.assert_not_called()

    def test_google_sign_in_passes_the_preselected_account(self):
        seen = {}

        class RecordingSignIn:
            cancelled = False

            def __init__(self, client, login_hint=None):
                seen["hint"] = login_hint

            def run(self):
                return {"sub": "1", "email": "mom@gmail.com", "name": "Mom"}

        api = main.Api(DataFile("."), {"client_id": "x", "client_secret": "y"})
        with mock.patch.object(google_auth, "SignIn", RecordingSignIn), mock.patch.object(api, "_bring_to_front"):
            api.google_sign_in("mom@gmail.com")
            self.assertEqual(seen["hint"], "mom@gmail.com")
            api.google_sign_in(None)  # what the page sends when no account is preselected
            self.assertIsNone(seen["hint"])

    @unittest.skipUnless(sys.platform == "win32", "Windows only")
    def test_find_app_window_can_be_limited_to_one_process(self):
        self.assertIsNone(main._find_app_window(pid=0xFFFFFFF0))  # no such process

    def test_api_exposes_no_private_state(self):
        # pywebview shares every public attribute of the Api with the page.
        public = [name for name in vars(main.Api(DataFile("."))) if not name.startswith("_")]
        self.assertEqual(public, [])

    @unittest.skipUnless(sys.platform == "win32", "Windows only")
    def test_single_instance_per_data_folder(self):
        # No real windows: a HabitGrid that happens to be open on this PC must not be found or focused.
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(main, "_find_app_window", return_value=None):
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



class FakeResponse(io.BytesIO):
    def __init__(self, body, status=200):
        super().__init__(body)
        self.status = status


class AiRequestTest(unittest.TestCase):
    """Api.ai_request: the Assistant's requests to an AI provider, sent from Python."""

    def setUp(self):
        self.api = main.Api(DataFile("."))

    def test_posts_and_returns_status_and_text(self):
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(b'{"ok": true}')) as urlopen:
            r = self.api.ai_request("post", "https://api.anthropic.com/v1/messages", {"x-api-key": "k"}, '{"a": 1}')
        self.assertEqual(r, {"status": 200, "text": '{"ok": true}'})
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.data, b'{"a": 1}')
        self.assertEqual(request.get_header("X-api-key"), "k")
        self.assertTrue(request.get_header("User-agent").startswith("HabitGrid/"))
        self.assertEqual(urlopen.call_args.kwargs["timeout"], main.AI_TIMEOUT)

    def test_get_sends_no_body(self):
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(b"{}")) as urlopen:
            self.api.ai_request("GET", "https://api.openai.com/v1/models/gpt-5", {"authorization": "Bearer k"}, None)
        self.assertIsNone(urlopen.call_args.args[0].data)
        self.assertEqual(urlopen.call_args.args[0].get_method(), "GET")

    def test_error_status_is_returned_not_raised(self):
        err = urllib.error.HTTPError("https://api.anthropic.com/v1/messages", 401, "Unauthorized", {},
                                     io.BytesIO(b'{"error": {"message": "invalid x-api-key"}}'))
        with mock.patch("urllib.request.urlopen", side_effect=err):
            r = self.api.ai_request("POST", "https://api.anthropic.com/v1/messages", {}, "{}")
        self.assertEqual(r["status"], 401)
        self.assertIn("invalid x-api-key", r["text"])

    def test_network_failure_raises_connection_error(self):
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("no route")):
            with self.assertRaisesRegex(ConnectionError, "no route"):
                self.api.ai_request("POST", "https://api.anthropic.com/v1/messages", {}, "{}")

    def test_only_https_or_this_computer(self):
        for url in ("http://example.com/v1", "file:///etc/passwd", "ftp://x/y", "https:///nohost", "javascript:alert(1)"):
            with self.subTest(url=url), mock.patch("urllib.request.urlopen") as urlopen:
                with self.assertRaises(ValueError):
                    self.api.ai_request("POST", url, {}, "{}")
                urlopen.assert_not_called()
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(b"{}")):
            self.assertEqual(self.api.ai_request("POST", "http://localhost:8787/v1", {}, "{}")["status"], 200)

    def test_only_get_and_post(self):
        with self.assertRaises(ValueError):
            self.api.ai_request("DELETE", "https://api.openai.com/v1/files/x", {}, None)

    def test_huge_reply_is_refused(self):
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(b"x" * (main.MAX_AI_BYTES + 1))):
            with self.assertRaisesRegex(ValueError, "too large"):
                self.api.ai_request("POST", "https://api.anthropic.com/v1/messages", {}, "{}")


if __name__ == "__main__":
    unittest.main()

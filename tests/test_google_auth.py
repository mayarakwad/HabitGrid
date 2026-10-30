import base64
import hashlib
import io
import json
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import google_auth
from google_auth import Cancelled, GoogleSignInError, SignIn, identity_from_id_token, load_client

CLIENT = {"client_id": "123.apps.googleusercontent.com", "client_secret": "shh"}


def b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()


def id_token(**overrides):
    claims = {"iss": "https://accounts.google.com", "aud": CLIENT["client_id"], "exp": time.time() + 600,
              "sub": "1098", "email": "Amy@Example.com", "email_verified": True, "name": "Amy"}
    claims.update(overrides)
    return f"{b64({'alg': 'RS256'})}.{b64(claims)}.signature"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def visit(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, ""


class LoadClientTest(unittest.TestCase):
    def test_desktop_client_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "google_client.json"
            path.write_bytes(b"\xef\xbb\xbf" + json.dumps({"installed": dict(CLIENT, project_id="x")}).encode())
            self.assertEqual(load_client(path, env={}), CLIENT)

    def test_environment_wins(self):
        env = {"HABITGRID_GOOGLE_CLIENT_ID": "env-id", "HABITGRID_GOOGLE_CLIENT_SECRET": "env-secret"}
        self.assertEqual(load_client("missing.json", env=env), {"client_id": "env-id", "client_secret": "env-secret"})

    def test_not_set_up(self):
        self.assertIsNone(load_client("missing.json", env={}))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "google_client.json"
            path.write_text('{"installed": {"client_id": "only-id"}}')
            self.assertIsNone(load_client(path, env={}))
            path.write_text("[]")
            self.assertIsNone(load_client(path, env={}))


class IdTokenTest(unittest.TestCase):
    def test_identity(self):
        self.assertEqual(identity_from_id_token(id_token(), CLIENT["client_id"]),
                         {"sub": "1098", "email": "amy@example.com", "name": "Amy"})

    def test_rejects_tokens_not_for_us(self):
        for bad in (id_token(aud="someone-else"), id_token(iss="https://evil.example"), id_token(exp=time.time() - 5)):
            with self.assertRaises(GoogleSignInError):
                identity_from_id_token(bad, CLIENT["client_id"])

    def test_requires_a_verified_email(self):
        for bad in (id_token(email_verified=False), id_token(email=""), id_token(email_verified="true")):
            with self.assertRaisesRegex(GoogleSignInError, "verified email"):
                identity_from_id_token(bad, CLIENT["client_id"])

    def test_unreadable_token(self):
        with self.assertRaises(GoogleSignInError):
            identity_from_id_token("not-a-jwt", CLIENT["client_id"])


class SignInTest(unittest.TestCase):
    def make(self, on_open, token_response=None, token_error=None, timeout=10):
        self.token_requests = []

        def fake_urlopen(request, timeout=None, context=None):
            self.token_requests.append(dict(urllib.parse.parse_qsl(request.data.decode())))
            if token_error:
                raise token_error
            return FakeResponse(json.dumps(token_response or {"id_token": id_token()}).encode())

        def fake_browser(url):
            self.auth_url = url
            threading.Thread(target=on_open, args=(dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query)),)).start()
            return True

        return SignIn(CLIENT, open_browser=fake_browser, urlopen=fake_urlopen, timeout=timeout)

    def test_full_sign_in(self):
        seen = {}

        def google(params):  # what the browser does after the person picks an account
            seen["params"] = params
            base = params["redirect_uri"]
            seen["wrong_state"] = visit(base + "?code=stolen&state=guess")[0]
            seen["favicon"] = visit(base + "favicon.ico")[0]
            seen["done"] = visit(base + "?" + urllib.parse.urlencode({"code": "the-code", "state": params["state"]}))

        identity = self.make(google).run()
        self.assertEqual(identity, {"sub": "1098", "email": "amy@example.com", "name": "Amy"})
        p = seen["params"]
        self.assertEqual(p["client_id"], CLIENT["client_id"])
        self.assertTrue(p["redirect_uri"].startswith("http://127.0.0.1:"))
        self.assertEqual((p["response_type"], p["scope"], p["code_challenge_method"]), ("code", "openid email profile", "S256"))
        self.assertEqual((seen["wrong_state"], seen["favicon"]), (404, 404))
        self.assertEqual(seen["done"][0], 200)
        # Sent before anything is checked, so it must not claim the sign-in worked.
        self.assertIn("HabitGrid finishes signing you in", seen["done"][1])
        self.assertNotIn("signed in<", seen["done"][1])
        # The token request proves we hold the verifier behind the challenge we sent.
        sent = self.token_requests[0]
        self.assertEqual(sent["code"], "the-code")
        self.assertEqual(sent["client_secret"], "shh")
        self.assertEqual(sent["redirect_uri"], p["redirect_uri"])
        challenge = base64.urlsafe_b64encode(hashlib.sha256(sent["code_verifier"].encode()).digest()).rstrip(b"=").decode()
        self.assertEqual(challenge, p["code_challenge"])

    def test_declined_in_browser(self):
        signin = self.make(lambda p: visit(p["redirect_uri"] + "?" + urllib.parse.urlencode({"error": "access_denied", "state": p["state"]})))
        with self.assertRaises(Cancelled):
            signin.run()
        self.assertEqual(self.token_requests, [])

    def test_cancel_from_the_app(self):
        signin = self.make(lambda p: None)
        threading.Timer(0.3, signin.cancel).start()
        started = time.monotonic()
        with self.assertRaises(Cancelled):
            signin.run()
        self.assertLess(time.monotonic() - started, 3)

    def test_idle_connection_doesnt_block_the_redirect(self):
        idle = []

        def google(params):
            port = int(urllib.parse.urlsplit(params["redirect_uri"]).port)
            idle.append(socket.create_connection(("127.0.0.1", port)))  # connects, never sends anything
            time.sleep(0.2)
            visit(params["redirect_uri"] + "?" + urllib.parse.urlencode({"code": "c", "state": params["state"]}))

        started = time.monotonic()
        self.assertEqual(self.make(google).run()["sub"], "1098")
        self.assertLess(time.monotonic() - started, 4)
        idle[0].close()

    def test_cancel_works_with_an_idle_connection_open(self):
        idle = []
        signin = self.make(lambda p: idle.append(socket.create_connection(("127.0.0.1", urllib.parse.urlsplit(p["redirect_uri"]).port))))
        threading.Timer(0.5, signin.cancel).start()
        started = time.monotonic()
        with self.assertRaises(Cancelled):
            signin.run()
        self.assertLess(time.monotonic() - started, 4)
        idle[0].close()

    def test_cancel_during_the_token_exchange(self):
        signin = None

        def slow_urlopen(request, timeout=None, context=None):
            signin.cancel()  # the person clicks Cancel while Google is being asked
            return FakeResponse(json.dumps({"id_token": id_token()}).encode())

        signin = SignIn(CLIENT, open_browser=lambda url: threading.Thread(target=visit, args=(
            dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))["redirect_uri"] + "?" + urllib.parse.urlencode(
                {"code": "c", "state": dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))["state"]}),)).start() or True,
            urlopen=slow_urlopen, timeout=10)
        with self.assertRaises(Cancelled):
            signin.run()

    def test_exchange_failing_after_cancel_counts_as_cancelled(self):
        signin = None

        def failing_urlopen(request, timeout=None, context=None):
            signin.cancel()
            raise urllib.error.URLError("network went away")

        signin = self.make(lambda p: visit(p["redirect_uri"] + "?" + urllib.parse.urlencode({"code": "c", "state": p["state"]})))
        signin._urlopen = failing_urlopen
        with self.assertRaises(Cancelled):
            signin.run()

    def test_times_out(self):
        with self.assertRaisesRegex(GoogleSignInError, "timed out"):
            self.make(lambda p: None, timeout=0.3).run()

    def test_browser_wont_open(self):
        signin = SignIn(CLIENT, open_browser=lambda url: False, timeout=5)
        with self.assertRaisesRegex(GoogleSignInError, "couldn't open your web browser"):
            signin.run()

    def test_google_rejects_the_code(self):
        error = urllib.error.HTTPError(google_auth.TOKEN_URL, 400, "Bad Request", {},
                                       io.BytesIO(b'{"error": "invalid_grant", "error_description": "Bad code"}'))
        signin = self.make(lambda p: visit(p["redirect_uri"] + "?" + urllib.parse.urlencode({"code": "c", "state": p["state"]})),
                           token_error=error)
        with self.assertRaisesRegex(GoogleSignInError, "Bad code"):
            signin.run()

    def test_offline(self):
        signin = self.make(lambda p: visit(p["redirect_uri"] + "?" + urllib.parse.urlencode({"code": "c", "state": p["state"]})),
                           token_error=urllib.error.URLError("no network"))
        with self.assertRaisesRegex(GoogleSignInError, "internet connection"):
            signin.run()


if __name__ == "__main__":
    unittest.main()

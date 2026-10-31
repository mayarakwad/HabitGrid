"""Sign in with Google from a desktop app: OAuth 2.0 for installed apps (loopback redirect + PKCE).

Google doesn't allow its sign-in page inside an app's embedded browser, so the page opens in
the system browser and Google redirects back to a one-time server on 127.0.0.1. The code it
brings back is exchanged for an ID token, which says who signed in.
See https://developers.google.com/identity/protocols/oauth2/native-app
"""
import base64
import hashlib
import http.server
import json
import os
import secrets
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ISSUERS = ("https://accounts.google.com", "accounts.google.com")

DONE_PAGE = """<!doctype html><meta charset="utf-8"><title>HabitGrid</title>
<body style="font:16px system-ui,sans-serif;display:grid;place-items:center;height:90vh;margin:0;text-align:center">
<div><h2>{title}</h2><p>{text}</p></div>"""


class GoogleSignInError(Exception):
    """A message that can be shown to the person signing in."""


class Cancelled(GoogleSignInError):
    pass


def load_client(path, env=None):
    """The OAuth client (client_id, client_secret), or None if Google sign-in isn't set up.

    Takes the JSON file Google Cloud gives for a "Desktop app" client, or the environment
    variables HABITGRID_GOOGLE_CLIENT_ID and HABITGRID_GOOGLE_CLIENT_SECRET.
    """
    env = os.environ if env is None else env
    if env.get("HABITGRID_GOOGLE_CLIENT_ID") and env.get("HABITGRID_GOOGLE_CLIENT_SECRET"):
        return {"client_id": env["HABITGRID_GOOGLE_CLIENT_ID"], "client_secret": env["HABITGRID_GOOGLE_CLIENT_SECRET"]}
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None
    client = data.get("installed", data) if isinstance(data, dict) else None
    if isinstance(client, dict) and client.get("client_id") and client.get("client_secret"):
        return {"client_id": client["client_id"], "client_secret": client["client_secret"]}
    return None


def _b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _ssl_context():
    try:
        import certifi  # bundled certificates: a frozen macOS app can't find the system's
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def identity_from_id_token(id_token, client_id, now=None):
    """Who signed in, from an ID token received straight from Google's token endpoint.

    Received that way over HTTPS, the token's signature needn't be checked (OpenID Connect
    Core 3.1.3.7); its issuer, audience and expiry still are.
    """
    try:
        payload_b64 = id_token.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4)))
    except (IndexError, ValueError):
        raise GoogleSignInError("Google sent an answer HabitGrid couldn't read.") from None
    now = time.time() if now is None else now
    if payload.get("iss") not in ISSUERS or payload.get("aud") != client_id or payload.get("exp", 0) < now:
        raise GoogleSignInError("Google's answer wasn't meant for HabitGrid.")
    if not payload.get("sub") or not payload.get("email") or payload.get("email_verified") is not True:
        raise GoogleSignInError("This Google account has no verified email address.")
    email = str(payload["email"]).lower()
    return {"sub": str(payload["sub"]), "email": email, "name": str(payload.get("name") or email.split("@")[0])}


class SignIn:
    """One sign-in attempt. run() blocks until it finishes; cancel() ends it from another thread."""

    def __init__(self, client, open_browser=webbrowser.open, urlopen=urllib.request.urlopen, timeout=300, login_hint=None):
        self.client = client
        self.login_hint = login_hint  # an email: Google preselects that account
        self._open_browser = open_browser
        self._urlopen = urlopen
        self._timeout = timeout
        self._finished = threading.Event()
        self._cancelled = False
        self._params = None
        self._lock = threading.Lock()

    def cancel(self):
        self._cancelled = True
        self._finished.set()

    @property
    def cancelled(self):
        """True if cancel() was called (by the app), not if Google's page was declined."""
        return self._cancelled

    def run(self):
        verifier = secrets.token_urlsafe(64)
        state = secrets.token_urlsafe(24)
        # One thread per connection, so a connection that sends nothing (a browser's
        # preconnect, another program) can't hold up Google's redirect or the shutdown.
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), self._handler(state))
        server.daemon_threads = True
        redirect_uri = f"http://127.0.0.1:{server.server_port}/"
        params = {
            "client_id": self.client["client_id"],
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": _b64url(hashlib.sha256(verifier.encode("ascii")).digest()),
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
        if self.login_hint:
            params["login_hint"] = self.login_hint
        url = AUTH_URL + "?" + urllib.parse.urlencode(params)
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.2}, daemon=True)
        thread.start()
        try:
            if not self._open_browser(url):
                raise GoogleSignInError("HabitGrid couldn't open your web browser.")
            if not self._finished.wait(self._timeout):
                raise GoogleSignInError("Google sign-in timed out. Try again.")
        finally:
            server.shutdown()
            server.server_close()
        if self._cancelled:
            raise Cancelled("Google sign-in was cancelled.")
        params = self._params
        if params.get("error"):
            if params["error"] == "access_denied":
                raise Cancelled("Google sign-in was cancelled.")
            raise GoogleSignInError(f"Google sign-in failed ({params['error']}).")
        try:
            token = self._exchange(params["code"], verifier, redirect_uri)
        except GoogleSignInError:
            if self._cancelled:  # the exchange failed after the person cancelled: just cancelled
                raise Cancelled("Google sign-in was cancelled.") from None
            raise
        if self._cancelled:  # cancelled while the code was being exchanged
            raise Cancelled("Google sign-in was cancelled.")
        return identity_from_id_token(token.get("id_token", ""), self.client["client_id"])

    def _handler(self, state):
        signin = self

        class Handler(http.server.BaseHTTPRequestHandler):
            timeout = 5  # seconds an idle connection may stay open

            def do_GET(self):
                params = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).items()}
                # Only Google's redirect for this attempt counts; anything else (a favicon
                # request, another page guessing the port) gets a 404.
                if params.get("state") != state or not (params.get("code") or params.get("error")):
                    self.send_error(404)
                    return
                # Nothing is checked yet at this point (that happens after this page is sent),
                # so the page doesn't claim success: HabitGrid itself says how it went.
                ok = bool(params.get("code"))
                body = DONE_PAGE.format(
                    title="Back to HabitGrid" if ok else "Sign-in didn't finish",
                    text="You can close this tab. HabitGrid finishes signing you in." if ok else "Go back to HabitGrid to try again.",
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                with signin._lock:
                    if signin._params is None:
                        signin._params = params
                        signin._finished.set()

            def log_message(self, *args):  # no console output
                pass

        return Handler

    def _exchange(self, code, verifier, redirect_uri):
        data = urllib.parse.urlencode({
            "code": code,
            "client_id": self.client["client_id"],
            "client_secret": self.client["client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        }).encode("ascii")
        request = urllib.request.Request(TOKEN_URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with self._urlopen(request, timeout=20, context=_ssl_context()) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                detail = json.loads(e.read().decode("utf-8")).get("error_description") or e.reason
            except ValueError:
                detail = e.reason
            raise GoogleSignInError(f"Google didn't accept the sign-in: {detail}") from None
        except (urllib.error.URLError, OSError):
            raise GoogleSignInError("HabitGrid couldn't reach Google. Check your internet connection.") from None

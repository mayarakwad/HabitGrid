'use strict';
/* Local profiles. Accounts live only on this computer: passwords and recovery codes are
   salted and stretched with PBKDF2-SHA-256 (Web Crypto) and only the hashes are stored.
   A profile signs in with its email and password, with Google (main.py runs the Google
   sign-in in the browser and hands back who signed in), or both. Profiles made before
   emails were added sign in with their username. */

const Auth = (() => {
  const ITERATIONS = 150000;
  const enc = new TextEncoder();
  const toHex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const randomHex = n => toHex(crypto.getRandomValues(new Uint8Array(n)));
  const norm = s => String(s || '').trim().toLowerCase();
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const GOOGLE_ONLY = 'This profile signs in with Google. Use "Continue with Google".';

  async function derive(secret, salt) {
    if (!crypto.subtle) throw new Error('Accounts need a secure page (https:// or localhost).');
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
    return toHex(bits);
  }

  const users = () => Store.read('users', {});
  const saveUsers = all => Store.write('users', all);
  const list = () => Object.values(users()).sort((a, b) => (b.lastLogin || '').localeCompare(a.lastLogin || ''));
  // Email for new profiles; the username for ones made before emails were added.
  const byLogin = login => { const n = norm(login); return n ? list().find(u => u.email === n || u.username === n) || null : null; };
  const byGoogle = sub => list().find(u => u.google && u.google.sub === sub) || null;
  const label = u => u.email || u.username;
  const hasPassword = u => !!(u && u.hash);

  function checkEmail(email, exceptId) {
    const e = norm(email);
    if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Enter a valid email address.');
    const other = byLogin(e);
    if (other && other.id !== exceptId) throw new Error('That email already has a profile on this computer.');
    return e;
  }

  function makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => A[b % A.length])
      .join('').replace(/(.{4})(?!$)/g, '$1-');
  }

  function checkPassword(pw) {
    if (String(pw || '').length < 6) throw new Error('Password must be at least 6 characters.');
  }

  function create(fields) {
    const id = 'u' + randomHex(6);
    const user = { id, bio: '', created: new Date().toISOString(), lastLogin: '', ...fields };
    const all = users();
    all[id] = user;
    saveUsers(all);
    Store.write('data.' + id, Habits.blank());
    return user;
  }

  async function register({ email, displayName, password, avatar, color }) {
    const e = checkEmail(email);
    checkPassword(password);
    const salt = randomHex(16), rsalt = randomHex(16), code = makeCode();
    const user = create({
      email: e, displayName: String(displayName || '').trim().slice(0, 30) || e.split('@')[0], avatar, color,
      salt, hash: await derive(password, salt), rsalt, rhash: await derive(normCode(code), rsalt),
    });
    return { user, code };
  }

  function startSession(id, remember) {
    const all = users();
    if (!all[id]) return;
    Object.assign(all[id], { lastLogin: new Date().toISOString(), fails: 0, lockUntil: 0 });
    saveUsers(all);
    try { sessionStorage.setItem('hg.session', id); } catch { /* ignore */ }
    if (remember) Store.write('session', id); else Store.remove('session');
  }

  function current() {
    let id = null;
    try { id = sessionStorage.getItem('hg.session'); } catch { /* ignore */ }
    return users()[id || Store.read('session', '')] || null;
  }

  // Every password check goes through here: five wrong in a row lock the profile for 30
  // seconds, wherever they were typed, and a right one starts the count again.
  async function checkAttempt(u, password) {
    if (u.lockUntil && Date.now() < u.lockUntil) {
      throw new Error(`Too many attempts. Try again in ${Math.ceil((u.lockUntil - Date.now()) / 1000)}s.`);
    }
    const all = users(), rec = all[u.id];
    if (await derive(String(password || ''), u.salt) === u.hash) {
      if (rec.fails || rec.lockUntil) { rec.fails = 0; rec.lockUntil = 0; saveUsers(all); }
      return;
    }
    rec.fails = (rec.fails || 0) + 1;
    if (rec.fails >= 5) { rec.fails = 0; rec.lockUntil = Date.now() + 30000; }
    saveUsers(all);
    throw new Error('Wrong password.');
  }

  async function login(login, password, remember) {
    const u = byLogin(login);
    if (!u) throw new Error('No profile with that email on this computer.');
    if (!hasPassword(u)) throw new Error(GOOGLE_ONLY);
    await checkAttempt(u, password);
    startSession(u.id, remember);
    return users()[u.id];
  }

  /* Google. identity is {sub, email, name} for a verified Google account. Returns
     {user} when signed in (created marks a new profile), or {link: user} when a password
     profile already uses that email: its owner must enter the password to connect Google.
     remember is the "Keep me signed in" choice, as for a password sign-in. */
  function googleSignIn(identity, newProfile, remember = true) {
    let u = byGoogle(identity.sub);
    if (!u) {
      const sameEmail = byLogin(identity.email);
      // Linking never replaces a Google account a profile already has.
      if (sameEmail && (!hasPassword(sameEmail) || sameEmail.google)) {
        throw new Error('The profile with that email is connected to a different Google account.');
      }
      if (sameEmail) return { link: sameEmail };
      u = create({ email: norm(identity.email), displayName: String(identity.name || '').slice(0, 30) || identity.email.split('@')[0],
        google: { sub: identity.sub, email: norm(identity.email) }, ...newProfile });
      startSession(u.id, remember);
      return { user: users()[u.id], created: true };
    }
    startSession(u.id, remember);
    return { user: users()[u.id] };
  }

  async function linkGoogle(id, password, identity, remember = true) {
    const u = users()[id];
    if (!u) throw new Error('That profile no longer exists.');
    if (byGoogle(identity.sub)) throw new Error('That Google account is already connected to another profile.');
    if (u.google) throw new Error('That profile is already connected to a different Google account.');
    await checkAttempt(u, password);
    update(id, { google: { sub: identity.sub, email: norm(identity.email) } });
    startSession(id, remember);
    return users()[id];
  }

  // From the profile page. Connecting a new way in needs the profile's password, so
  // someone at a signed-in computer can't add their own Google account to it.
  async function connectGoogle(id, identity, password) {
    const other = byGoogle(identity.sub);
    if (other && other.id !== id) throw new Error('That Google account is already connected to another profile.');
    const u = users()[id];
    if (hasPassword(u)) await checkAttempt(u, password);
    return update(id, { google: { sub: identity.sub, email: norm(identity.email) } });
  }

  // Throws "Wrong password." (counting toward the lockout) unless the password is right.
  async function confirmPassword(id, password) {
    const u = users()[id];
    if (!hasPassword(u)) throw new Error('This profile has no password.');
    await checkAttempt(u, password);
  }

  async function disconnectGoogle(id, password) {
    const u = users()[id];
    if (!hasPassword(u)) throw new Error('Set a password first, or you could no longer sign in.');
    await checkAttempt(u, password);
    const all = users();
    delete all[id].google;
    saveUsers(all);
    return all[id];
  }

  // Changing the email needs the password (when the profile has one): an email decides which
  // profile a Google sign-in offers to connect to.
  async function setEmail(id, email, password) {
    const u = users()[id];
    const e = checkEmail(email, id);
    if (e === u.email) return u;
    if (hasPassword(u)) await checkAttempt(u, password);
    return update(id, { email: e });
  }

  // Re-confirming who you are with Google, for profiles without a password.
  const verifyGoogle = (id, identity) => { const u = users()[id]; return !!(u && u.google && identity && u.google.sub === identity.sub); };

  async function setPassword(id, password) {
    const all = users(), salt = randomHex(16);
    Object.assign(all[id], { salt, hash: await derive(password, salt), fails: 0, lockUntil: 0 });
    saveUsers(all);
  }

  async function changePassword(id, oldPw, newPw) {
    checkPassword(newPw);
    try {
      await confirmPassword(id, oldPw);
    } catch (err) {
      throw new Error(err.message === 'Wrong password.' ? 'Current password is wrong.' : err.message);
    }
    await setPassword(id, newPw);
  }

  // For a Google-only profile (the caller has just re-confirmed with Google). Returns its first recovery code.
  async function addPassword(id, newPw) {
    if (hasPassword(users()[id])) throw new Error('This profile already has a password.');
    checkPassword(newPw);
    await setPassword(id, newPw);
    return storeRecoveryCode(id);
  }

  async function storeRecoveryCode(id) {
    const all = users(), code = makeCode(), rsalt = randomHex(16);
    Object.assign(all[id], { rsalt, rhash: await derive(normCode(code), rsalt) });
    saveUsers(all);
    return code;
  }

  async function newRecoveryCode(id, password) {
    await confirmPassword(id, password);
    return storeRecoveryCode(id);
  }

  // Forgot password: the recovery code proves ownership, then a fresh code replaces it.
  async function resetWithCode(login, code, newPw) {
    const u = byLogin(login);
    if (u && !u.rhash) throw new Error(GOOGLE_ONLY);
    if (!u || await derive(normCode(code), u.rsalt) !== u.rhash) throw new Error('Email or recovery code is wrong.');
    checkPassword(newPw);
    await setPassword(u.id, newPw);
    const fresh = await storeRecoveryCode(u.id);
    return { user: users()[u.id], code: fresh };
  }

  function update(id, fields) {
    const all = users();
    Object.assign(all[id], fields);
    saveUsers(all);
    return all[id];
  }

  function remove(id) {
    const all = users();
    delete all[id];
    saveUsers(all);
    Store.remove('data.' + id);
    logout();
  }

  function logout() {
    try { sessionStorage.removeItem('hg.session'); } catch { /* ignore */ }
    Store.remove('session');
  }

  return { list, byLogin, label, hasPassword, checkEmail, register, startSession, current, login, logout,
    googleSignIn, linkGoogle, connectGoogle, confirmPassword, disconnectGoogle, setEmail, verifyGoogle, changePassword, addPassword,
    newRecoveryCode, resetWithCode, update, remove };
})();

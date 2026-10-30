'use strict';
/* Local profiles. Accounts live only in this browser: passwords and recovery codes are
   salted and stretched with PBKDF2-SHA-256 (Web Crypto) and only the hashes are stored. */

const Auth = (() => {
  const ITERATIONS = 150000;
  const enc = new TextEncoder();
  const toHex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const randomHex = n => toHex(crypto.getRandomValues(new Uint8Array(n)));
  const norm = s => String(s || '').trim().toLowerCase();
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

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
  const byName = username => list().find(u => u.username === norm(username)) || null;

  function makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => A[b % A.length])
      .join('').replace(/(.{4})(?!$)/g, '$1-');
  }

  function checkPassword(pw) {
    if (String(pw || '').length < 6) throw new Error('Password must be at least 6 characters.');
  }

  async function register({ username, displayName, password, avatar, color }) {
    const name = norm(username);
    if (!/^[a-z0-9_.-]{3,24}$/.test(name)) throw new Error('Username must be 3–24 letters, numbers, dots, dashes or underscores.');
    if (byName(name)) throw new Error('That username is already used on this device.');
    checkPassword(password);
    const id = 'u' + randomHex(6), salt = randomHex(16), rsalt = randomHex(16), code = makeCode();
    const user = {
      id, username: name, displayName: String(displayName || '').trim().slice(0, 30) || name,
      avatar, color, bio: '', salt, hash: await derive(password, salt),
      rsalt, rhash: await derive(normCode(code), rsalt), created: new Date().toISOString(), lastLogin: '',
    };
    const all = users();
    all[id] = user;
    saveUsers(all);
    Store.write('data.' + id, Habits.blank());
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

  async function login(username, password, remember) {
    const u = byName(username);
    if (!u) throw new Error('No account with that username on this device.');
    if (u.lockUntil && Date.now() < u.lockUntil) {
      throw new Error(`Too many attempts. Try again in ${Math.ceil((u.lockUntil - Date.now()) / 1000)}s.`);
    }
    if (await derive(password, u.salt) !== u.hash) {
      const all = users(), rec = all[u.id];
      rec.fails = (rec.fails || 0) + 1;
      if (rec.fails >= 5) { rec.fails = 0; rec.lockUntil = Date.now() + 30000; }
      saveUsers(all);
      throw new Error('Wrong password.');
    }
    startSession(u.id, remember);
    return users()[u.id];
  }

  function logout() {
    try { sessionStorage.removeItem('hg.session'); } catch { /* ignore */ }
    Store.remove('session');
  }

  async function verify(id, password) {
    const u = users()[id];
    return !!u && await derive(password, u.salt) === u.hash;
  }

  async function setPassword(id, password) {
    const all = users(), salt = randomHex(16);
    Object.assign(all[id], { salt, hash: await derive(password, salt), fails: 0, lockUntil: 0 });
    saveUsers(all);
  }

  async function changePassword(id, oldPw, newPw) {
    if (!(await verify(id, oldPw))) throw new Error('Current password is wrong.');
    checkPassword(newPw);
    await setPassword(id, newPw);
  }

  async function newRecoveryCode(id, password) {
    if (!(await verify(id, password))) throw new Error('Wrong password.');
    const all = users(), code = makeCode(), rsalt = randomHex(16);
    Object.assign(all[id], { rsalt, rhash: await derive(normCode(code), rsalt) });
    saveUsers(all);
    return code;
  }

  // Forgot password: the recovery code proves ownership, then a fresh code replaces it.
  async function resetWithCode(username, code, newPw) {
    const u = byName(username);
    if (!u || await derive(normCode(code), u.rsalt) !== u.rhash) throw new Error('Username or recovery code is wrong.');
    checkPassword(newPw);
    await setPassword(u.id, newPw);
    const fresh = await newRecoveryCode(u.id, newPw);
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

  return { list, byName, register, startSession, current, login, logout, verify, changePassword,
    newRecoveryCode, resetWithCode, update, remove };
})();

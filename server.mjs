import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
// Local development skips authentication by default; production and AUTH_BYPASS=false keep it enabled.
const AUTH_BYPASS = process.env.NODE_ENV !== 'production' && process.env.AUTH_BYPASS !== 'false';
const DEVELOPMENT_USER = { email: 'developpement@fiscale.local', name: 'Développement local' };
const SESSION_TTL = 8 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const participantsPath = process.env.PARTICIPANTS_FILE || path.join(ROOT, 'config', 'participants.json');
const exampleParticipantsPath = path.join(ROOT, 'config', 'participants.example.json');
const dossierPath = path.join(ROOT, 'private', 'dossier-data.json');
const sessions = new Map();
const loginAttempts = new Map();
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const json = (res, status, payload, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

async function getParticipants() {
  try { return (await readJson(participantsPath)).participants || []; }
  catch { try { return (await readJson(exampleParticipantsPath)).participants || []; } catch { return []; } }
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key));
}

function passwordParts(stored) {
  const [algorithm, iterations, keylen, salt, digest] = String(stored || '').split('$');
  if (algorithm !== 'pbkdf2' || !iterations || !keylen || !salt || !digest) return null;
  return { iterations: Number(iterations), keylen: Number(keylen), salt, digest: Buffer.from(digest, 'hex') };
}

function verifyPassword(password, stored) {
  const parts = passwordParts(stored);
  if (!parts || !Number.isSafeInteger(parts.iterations) || !Number.isSafeInteger(parts.keylen)) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, Buffer.from(parts.salt, 'hex'), parts.iterations, parts.keylen, 'sha512', (error, derived) => {
      if (error) return reject(error);
      resolve(derived.length === parts.digest.length && crypto.timingSafeEqual(derived, parts.digest));
    });
  });
}

const dummyHash = await new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16);
  crypto.pbkdf2('not-a-real-password', salt, 100000, 64, 'sha512', (error, derived) => error ? reject(error) : resolve(`pbkdf2$100000$64$${salt.toString('hex')}$${derived.toString('hex')}`));
});

function clientKey(req, email) { return `${req.socket.remoteAddress || 'unknown'}:${email}`; }
function isRateLimited(key) {
  const item = loginAttempts.get(key);
  if (!item) return false;
  if (Date.now() - item.firstAt > ATTEMPT_WINDOW) { loginAttempts.delete(key); return false; }
  return item.blockedUntil > Date.now();
}
function recordFailedAttempt(key) {
  const item = loginAttempts.get(key) || { count: 0, firstAt: Date.now(), blockedUntil: 0 };
  if (Date.now() - item.firstAt > ATTEMPT_WINDOW) { item.count = 0; item.firstAt = Date.now(); }
  item.count += 1;
  if (item.count >= MAX_LOGIN_ATTEMPTS) item.blockedUntil = Date.now() + ATTEMPT_WINDOW;
  loginAttempts.set(key, item);
}
function clearAttempts(key) { loginAttempts.delete(key); }

function sessionFrom(req) {
  const token = parseCookies(req.headers.cookie).fiscale_session;
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return null; }
  session.expiresAt = Date.now() + SESSION_TTL;
  return { token, ...session };
}
function cookieHeader(token, maxAge = SESSION_TTL / 1000) {
  return `fiscale_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${COOKIE_SECURE ? '; Secure' : ''}`;
}
async function requestBody(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 64 * 1024) throw new Error('payload_too_large'); }
  return body ? JSON.parse(body) : {};
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/session') {
    if (AUTH_BYPASS) return json(res, 200, { authenticated: true, developmentBypass: true, user: DEVELOPMENT_USER });
    const session = sessionFrom(req);
    return session ? json(res, 200, { authenticated: true, user: { email: session.email, name: session.name } }) : json(res, 401, { authenticated: false });
  }
  if (req.method === 'POST' && pathname === '/api/login') {
    if (AUTH_BYPASS) return json(res, 200, { authenticated: true, developmentBypass: true, user: DEVELOPMENT_USER });
    const { email = '', password = '' } = await requestBody(req);
    const normalizedEmail = String(email).trim().toLowerCase();
    const key = clientKey(req, normalizedEmail);
    if (isRateLimited(key)) return json(res, 429, { error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    const participants = await getParticipants();
    if (!participants.length) return json(res, 503, { error: 'Aucun participant n’est encore configuré. Ajoutez un participant dans config/participants.json.' });
    const participant = participants.find((item) => String(item.email || '').toLowerCase() === normalizedEmail);
    const valid = await verifyPassword(String(password), participant?.passwordHash || dummyHash);
    if (!participant || !valid) { recordFailedAttempt(key); return json(res, 401, { error: 'Email ou mot de passe incorrect.' }); }
    clearAttempts(key);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { email: normalizedEmail, name: participant.name || normalizedEmail, expiresAt: Date.now() + SESSION_TTL });
    return json(res, 200, { authenticated: true, user: { email: normalizedEmail, name: participant.name || normalizedEmail } }, { 'Set-Cookie': cookieHeader(token) });
  }
  if (req.method === 'POST' && pathname === '/api/logout') {
    const token = parseCookies(req.headers.cookie).fiscale_session;
    if (token) sessions.delete(token);
    return json(res, 200, { authenticated: false }, { 'Set-Cookie': cookieHeader('', 0) });
  }
  if (req.method === 'GET' && pathname === '/api/dossier') {
    if (!AUTH_BYPASS && !sessionFrom(req)) return json(res, 401, { error: 'Authentification requise.' });
    return json(res, 200, await readJson(dossierPath));
  }
  return json(res, 404, { error: 'Route inconnue.' });
}

async function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/api/') || pathname.startsWith('/private/') || pathname.startsWith('/config/')) return json(res, 404, { error: 'Ressource non disponible.' });
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\/+/, ''));
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep)) return json(res, 403, { error: 'Accès interdit.' });
  try {
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': pathname === '/classeur.html' ? 'no-store' : 'no-cache' });
    res.end(content);
  } catch { json(res, 404, { error: 'Page introuvable.' }); }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url.pathname);
    else await serveStatic(req, res, url.pathname);
  } catch (error) {
    json(res, error.message === 'payload_too_large' ? 413 : 400, { error: 'Requête invalide.' });
  }
});
server.listen(PORT, HOST, () => console.log(`Fiscale secure server running on http://${HOST}:${PORT}${AUTH_BYPASS ? ' (mode développement : authentification désactivée)' : ''}`));

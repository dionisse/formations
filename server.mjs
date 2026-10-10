import http from 'node:http';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
try {
  const localEnvironment = readFileSync(path.join(ROOT, '.env'), 'utf8');
  localEnvironment.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) return;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '').trim();
    process.env[match[1]] = value;
  });
} catch (error) { /* Le déploiement peut fournir ses variables d’environnement directement. */ }

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
// Bypass is opt-in for the local dev script only and is always refused in production.
const AUTH_BYPASS = process.env.NODE_ENV !== 'production' && process.env.AUTH_BYPASS === 'true';
const DEVELOPMENT_USER = { id: 'local-development-user', email: 'developpement@fiscale.local', name: 'Développement local', picture: '', isAdmin: true, emailVerified: true, developmentBypass: true };
const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = 'godwingobex@gmail.com';
const COURSE_VERSIONS = new Set((process.env.COURSE_VERSIONS || 'formation-fiscale-v1').split(',').map((version) => version.trim()).filter(Boolean));
const CLASSEUR_COURSE_VERSION = 'formation-fiscale-v1';
const dossierPath = path.join(ROOT, 'private', 'dossier-data.json');
const fileStoragePath = path.join(ROOT, 'storage', 'dossier-files');
const fileIndexPath = path.join(ROOT, 'storage', 'file-index.json');
const certificatesPath = path.join(ROOT, 'storage', 'certificates.json');
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SAFE_INLINE_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain']);
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const json = (res, status, payload, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
};
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

async function getFileIndex() {
  try {
    const index = await readJson(fileIndexPath);
    return { files: Array.isArray(index.files) ? index.files : [] };
  } catch { return { files: [] }; }
}
async function saveFileIndex(index) {
  await fs.mkdir(path.dirname(fileIndexPath), { recursive: true });
  await fs.writeFile(fileIndexPath, JSON.stringify(index, null, 2));
}
async function getCertificates() {
  try {
    const certificates = await readJson(certificatesPath);
    return { certificates: Array.isArray(certificates.certificates) ? certificates.certificates : [] };
  } catch { return { certificates: [] }; }
}
async function saveCertificates(certificates) {
  await fs.mkdir(path.dirname(certificatesPath), { recursive: true });
  await fs.writeFile(certificatesPath, JSON.stringify(certificates, null, 2));
}
function certificateReference(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '').slice(0, 100);
}
function publicCertificate(certificate, includePrivate = false) {
  const base = {
    reference: certificate.reference,
    participantName: certificate.participantName,
    profile: certificate.profile,
    status: certificate.status,
    createdAt: certificate.createdAt,
    validatedAt: certificate.validatedAt || null,
    updatedAt: certificate.updatedAt
  };
  return includePrivate ? { ...base, birthDate: certificate.birthDate || '', birthPlace: certificate.birthPlace || '', nationality: certificate.nationality || '' } : base;
}
async function readUpload(req) {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > MAX_FILE_SIZE) throw new Error('file_too_large');
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_FILE_SIZE) throw new Error('file_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function safeFileName(value) {
  let decoded = String(value || '');
  try { decoded = decodeURIComponent(decoded); } catch {}
  const name = path.basename(decoded.replace(/[\\/]/g, ''));
  return [...name].filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').trim().slice(0, 180) || 'document-sans-nom';
}
function localFilePath(file) {
  return path.relative(ROOT, storedFilePath(file)).split(path.sep).join('/');
}
function publicFile(file) {
  return { id: file.id, folderId: file.folderId, name: file.name, mimeType: file.mimeType, size: file.size, localPath: localFilePath(file), createdAt: file.createdAt, updatedAt: file.updatedAt };
}
function bearerToken(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function verifySupabaseUser(req) {
  const token = bearerToken(req);
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const user = await response.json().catch(() => null);
    if (!user?.id || !user?.email) return null;
    const email = String(user.email).trim().toLowerCase();
    const emailVerified = Boolean(user.email_confirmed_at || user.confirmed_at);
    const metadata = user.user_metadata || {};
    return {
      id: user.id,
      email,
      name: String(metadata.full_name || metadata.name || email),
      picture: String(metadata.avatar_url || metadata.picture || ''),
      emailVerified,
      isAdmin: emailVerified && email === ADMIN_EMAIL,
      developmentBypass: false,
      accessToken: token
    };
  } catch (error) {
    console.error('Supabase access-token verification failed:', error.message);
    return null;
  }
}
async function currentUser(req) {
  if (AUTH_BYPASS) return DEVELOPMENT_USER;
  return verifySupabaseUser(req);
}
async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) {
    json(res, 401, { error: 'Connectez-vous avec votre compte Google.' });
    return null;
  }
  return user;
}
async function requireAdministrator(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!user.isAdmin && !user.developmentBypass) {
    json(res, 403, { error: 'Accès administrateur requis.' });
    return null;
  }
  return user;
}
async function supabaseRest(user, resource, { method = 'GET', body, prefer } = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !user?.accessToken) throw new Error('Supabase n’est pas configuré pour cette opération.');
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${user.accessToken}`, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}
async function getEntitlement(user, courseVersion) {
  if (user?.developmentBypass) return { status: 'paid', course_version: courseVersion, developmentBypass: true };
  const query = new URLSearchParams({
    select: 'id,user_id,course_version,status,payment_method,payment_reference,requested_at,paid_at,approved_by',
    user_id: `eq.${user.id}`,
    course_version: `eq.${courseVersion}`,
    limit: '1'
  });
  const { response, payload } = await supabaseRest(user, `participant_entitlements?${query}`);
  if (!response.ok) throw new Error(payload?.message || 'La vérification du règlement a échoué.');
  return Array.isArray(payload) ? payload[0] || null : null;
}
async function requireCourseEntitlement(req, res, courseVersion) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.isAdmin || user.developmentBypass) return user;
  try {
    const entitlement = await getEntitlement(user, courseVersion);
    if (entitlement?.status !== 'paid') {
      json(res, 402, {
        error: 'Le règlement de cette formation doit être confirmé avant l’accès au classeur et aux livrables.',
        code: 'payment_required',
        courseVersion,
        status: entitlement?.status || 'not_requested'
      });
      return null;
    }
    return { ...user, entitlement };
  } catch (error) {
    console.error('Course entitlement check failed:', error.message);
    json(res, 503, { error: 'La vérification de votre accès est momentanément indisponible. Réessayez plus tard.', code: 'entitlement_check_unavailable' });
    return null;
  }
}
async function requestBody(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 64 * 1024) throw new Error('payload_too_large'); }
  return body ? JSON.parse(body) : {};
}

function hasFolder(folderId, dossier) {
  return dossier.folders.some((folder) => folder.id === folderId || (folder.children || []).some((child) => child.id === folderId));
}
function fileIdFromPath(pathname) {
  if (!pathname.startsWith('/api/files/')) return '';
  const value = decodeURIComponent(pathname.slice('/api/files/'.length));
  return value.includes('/') ? '' : value;
}
function storedFilePath(file) { return path.join(fileStoragePath, file.storedName); }
async function saveUploadedContent(req, file) {
  const content = await readUpload(req);
  if (!content.length) throw new Error('empty_file');
  await fs.mkdir(fileStoragePath, { recursive: true });
  await fs.writeFile(storedFilePath(file), content);
  return content.length;
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  if (req.method === 'GET' && pathname === '/api/public-config') {
    return json(res, 200, { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
  }

  if (req.method === 'GET' && pathname === '/api/certificates/verify') {
    const reference = certificateReference(url.searchParams.get('reference'));
    if (!reference) return json(res, 400, { error: 'Code de certificat manquant.' });
    const { certificates } = await getCertificates();
    const certificate = certificates.find((item) => item.reference === reference);
    if (!certificate) return json(res, 200, { valid: false, status: 'not_found', reference });
    return json(res, 200, {
      valid: certificate.status === 'validated',
      status: certificate.status,
      reference: certificate.reference,
      participantName: certificate.status === 'validated' ? certificate.participantName : '',
      profile: certificate.status === 'validated' ? certificate.profile : '',
      validatedAt: certificate.validatedAt || null
    });
  }

  if (req.method === 'GET' && pathname === '/api/session') {
    const user = await currentUser(req);
    if (!user) return json(res, 401, { authenticated: false });
    let entitlement = null;
    let entitlementCheckError = false;
    if (user.developmentBypass) entitlement = { status: 'paid', course_version: CLASSEUR_COURSE_VERSION };
    else if (!user.isAdmin) {
      try { entitlement = await getEntitlement(user, CLASSEUR_COURSE_VERSION); }
      catch (error) { entitlementCheckError = true; console.error('Session entitlement lookup failed:', error.message); }
    }
    return json(res, 200, {
      authenticated: true,
      isAdmin: Boolean(user.isAdmin),
      developmentBypass: Boolean(user.developmentBypass),
      user: { id: user.id, email: user.email, name: user.name, ...(user.picture ? { picture: user.picture } : {}) },
      courseVersion: CLASSEUR_COURSE_VERSION,
      entitlement: entitlement ? { id: entitlement.id || null, courseVersion: entitlement.course_version || CLASSEUR_COURSE_VERSION, status: entitlement.status, requestedAt: entitlement.requested_at || null, paidAt: entitlement.paid_at || null } : null,
      entitlementCheckError
    });
  }

  if (req.method === 'GET' && pathname === '/api/entitlements') {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const entitlement = await getEntitlement(user, CLASSEUR_COURSE_VERSION);
      return json(res, 200, { entitlement: entitlement ? { id: entitlement.id, courseVersion: entitlement.course_version, status: entitlement.status, requestedAt: entitlement.requested_at, paidAt: entitlement.paid_at } : null });
    } catch (error) {
      console.error('Participant entitlement lookup failed:', error.message);
      return json(res, 503, { error: 'Le statut du règlement est momentanément indisponible.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/entitlements/request') {
    const user = await requireUser(req, res);
    if (!user) return;
    const body = await requestBody(req);
    const courseVersion = String(body.courseVersion || '');
    if (!COURSE_VERSIONS.has(courseVersion)) return json(res, 400, { error: 'Formation inconnue.' });
    if (user.developmentBypass) return json(res, 200, { entitlement: { course_version: courseVersion, status: 'paid' } });
    try {
      const existing = await getEntitlement(user, courseVersion);
      if (existing) return json(res, 200, { entitlement: existing });
      const { response, payload } = await supabaseRest(user, 'participant_entitlements?select=id,user_id,course_version,status,payment_method,payment_reference,requested_at,paid_at', {
        method: 'POST',
        body: { user_id: user.id, course_version: courseVersion, status: 'pending', payment_method: 'manual_whatsapp' },
        prefer: 'return=representation'
      });
      if (response.ok) return json(res, 201, { entitlement: Array.isArray(payload) ? payload[0] || null : payload });
      if (response.status === 409) {
        const raced = await getEntitlement(user, courseVersion);
        if (raced) return json(res, 200, { entitlement: raced });
      }
      console.error('Entitlement request insert failed:', payload?.message || response.status);
      return json(res, response.status === 401 ? 401 : 503, { error: 'La demande d’accès n’a pas pu être enregistrée. Réessayez plus tard.' });
    } catch (error) {
      console.error('Entitlement request failed:', error.message);
      return json(res, 503, { error: 'Le service de demande d’accès est momentanément indisponible.' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/admin/entitlements') {
    const admin = await requireAdministrator(req, res);
    if (!admin) return;
    if (admin.developmentBypass) return json(res, 200, { entitlements: [], auditAvailable: false });
    try {
      const query = new URLSearchParams({
        select: 'id,user_id,course_version,status,payment_method,payment_reference,requested_at,paid_at,approved_by,created_at,updated_at,participant:participant_profiles!participant_entitlements_user_id_fkey(email,full_name)',
        order: 'requested_at.desc'
      });
      const { response, payload } = await supabaseRest(admin, `participant_entitlements?${query}`);
      if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
      return json(res, 200, { entitlements: Array.isArray(payload) ? payload : [], auditAvailable: true });
    } catch (error) {
      console.error('Administrator entitlement list failed:', error.message);
      return json(res, 503, { error: 'Impossible de charger les demandes de règlement.' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/admin/entitlement-events') {
    const admin = await requireAdministrator(req, res);
    if (!admin) return;
    if (admin.developmentBypass) return json(res, 200, { events: [] });
    try {
      const query = new URLSearchParams({
        select: 'id,entitlement_id,user_id,course_version,previous_status,new_status,actor_id,payment_reference,created_at',
        order: 'created_at.desc',
        limit: '200'
      });
      const { response, payload } = await supabaseRest(admin, `participant_entitlement_events?${query}`);
      if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
      return json(res, 200, { events: Array.isArray(payload) ? payload : [] });
    } catch (error) {
      console.error('Administrator entitlement audit lookup failed:', error.message);
      return json(res, 503, { error: 'Impossible de charger le journal des règlements.' });
    }
  }

  if (pathname.startsWith('/api/admin/entitlements/') && req.method === 'PATCH') {
    const admin = await requireAdministrator(req, res);
    if (!admin) return;
    const id = decodeURIComponent(pathname.slice('/api/admin/entitlements/'.length));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json(res, 400, { error: 'Référence de demande invalide.' });
    const body = await requestBody(req);
    if (!['pending', 'paid', 'revoked'].includes(body.status)) return json(res, 400, { error: 'Statut de règlement invalide.' });
    if (admin.developmentBypass) return json(res, 503, { error: 'La gestion des accès nécessite une configuration Supabase.' });
    const paymentReference = String(body.paymentReference || '').trim().slice(0, 180) || null;
    try {
      const query = new URLSearchParams({ id: `eq.${id}`, select: 'id,user_id,course_version,status,payment_method,payment_reference,requested_at,paid_at,approved_by,updated_at' });
      const { response, payload } = await supabaseRest(admin, `participant_entitlements?${query}`, {
        method: 'PATCH',
        body: {
          status: body.status,
          payment_reference: paymentReference,
          paid_at: body.status === 'paid' ? new Date().toISOString() : null,
          approved_by: body.status === 'paid' ? admin.id : null
        },
        prefer: 'return=representation'
      });
      if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
      const updated = Array.isArray(payload) ? payload[0] : null;
      if (!updated) return json(res, 404, { error: 'Demande de règlement introuvable.' });
      return json(res, 200, { entitlement: updated });
    } catch (error) {
      console.error('Administrator entitlement update failed:', error.message);
      return json(res, 503, { error: 'La décision n’a pas pu être enregistrée.' });
    }
  }

  if (pathname === '/api/certificates' && req.method === 'GET') {
    if (!await requireAdministrator(req, res)) return;
    const { certificates } = await getCertificates();
    return json(res, 200, { certificates: certificates.map((certificate) => publicCertificate(certificate, true)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
  }
  if (pathname === '/api/certificates' && req.method === 'POST') {
    if (!await requireAdministrator(req, res)) return;
    const body = await requestBody(req);
    const reference = certificateReference(body.reference);
    const participantName = String(body.participantName || '').trim().slice(0, 180);
    const profile = String(body.profile || '').trim().slice(0, 80);
    if (!reference || !participantName) return json(res, 400, { error: 'Le code et le nom du participant sont obligatoires.' });
    const status = ['pending', 'validated', 'revoked'].includes(body.status) ? body.status : 'pending';
    const now = new Date().toISOString();
    const certificates = await getCertificates();
    const existing = certificates.certificates.find((certificate) => certificate.reference === reference);
    if (existing) {
      existing.participantName = participantName;
      existing.profile = profile;
      existing.birthDate = String(body.birthDate || '').slice(0, 30);
      existing.birthPlace = String(body.birthPlace || '').trim().slice(0, 120);
      existing.nationality = String(body.nationality || '').trim().slice(0, 80);
      existing.status = status;
      existing.validatedAt = status === 'validated' ? (existing.validatedAt || now) : null;
      existing.updatedAt = now;
    } else {
      certificates.certificates.push({ reference, participantName, profile, birthDate: String(body.birthDate || '').slice(0, 30), birthPlace: String(body.birthPlace || '').trim().slice(0, 120), nationality: String(body.nationality || '').trim().slice(0, 80), status, createdAt: now, validatedAt: status === 'validated' ? now : null, updatedAt: now });
    }
    await saveCertificates(certificates);
    const saved = certificates.certificates.find((certificate) => certificate.reference === reference);
    return json(res, existing ? 200 : 201, { certificate: publicCertificate(saved, true) });
  }
  if (pathname.startsWith('/api/certificates/') && req.method === 'PATCH') {
    if (!await requireAdministrator(req, res)) return;
    const reference = certificateReference(pathname.slice('/api/certificates/'.length));
    const body = await requestBody(req);
    if (!['pending', 'validated', 'revoked'].includes(body.status)) return json(res, 400, { error: 'Statut de certificat invalide.' });
    const certificates = await getCertificates();
    const certificate = certificates.certificates.find((item) => item.reference === reference);
    if (!certificate) return json(res, 404, { error: 'Certificat introuvable.' });
    certificate.status = body.status;
    certificate.validatedAt = body.status === 'validated' ? (certificate.validatedAt || new Date().toISOString()) : null;
    certificate.updatedAt = new Date().toISOString();
    await saveCertificates(certificates);
    return json(res, 200, { certificate: publicCertificate(certificate, true) });
  }

  if (req.method === 'POST' && ['/api/login', '/api/logout'].includes(pathname)) {
    return json(res, 410, { error: 'La session est gérée par Supabase Auth.' });
  }

  if (req.method === 'GET' && pathname === '/api/dossier') {
    if (!await requireCourseEntitlement(req, res, CLASSEUR_COURSE_VERSION)) return;
    const dossier = await readJson(dossierPath);
    const index = await getFileIndex();
    return json(res, 200, { ...dossier, files: index.files.map(publicFile) });
  }
  if (req.method === 'POST' && pathname === '/api/files') {
    const user = await requireCourseEntitlement(req, res, CLASSEUR_COURSE_VERSION);
    if (!user) return;
    const folderId = String(url.searchParams.get('folderId') || '');
    const dossier = await readJson(dossierPath);
    if (!hasFolder(folderId, dossier)) return json(res, 400, { error: 'Rubrique de classement inconnue.' });
    const name = safeFileName(req.headers['x-file-name']);
    const file = { id: crypto.randomUUID(), folderId, name, mimeType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0], size: 0, storedName: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), owner: user.email };
    const extension = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 15);
    file.storedName = `${file.id}${extension}`;
    try { file.size = await saveUploadedContent(req, file); }
    catch (error) {
      if (error.message === 'file_too_large') return json(res, 413, { error: 'Fichier trop volumineux. La limite est de 25 Mo.' });
      if (error.message === 'empty_file') return json(res, 400, { error: 'Le fichier est vide.' });
      throw error;
    }
    const index = await getFileIndex();
    index.files.push(file);
    await saveFileIndex(index);
    return json(res, 201, { file: publicFile(file) });
  }
  const fileId = fileIdFromPath(pathname);
  if (fileId) {
    const user = await requireCourseEntitlement(req, res, CLASSEUR_COURSE_VERSION);
    if (!user) return;
    const index = await getFileIndex();
    const file = index.files.find((item) => item.id === fileId);
    if (!file) return json(res, 404, { error: 'Fichier introuvable.' });
    if (req.method === 'GET') {
      const content = await fs.readFile(storedFilePath(file)).catch(() => null);
      if (!content) return json(res, 404, { error: 'Le contenu du fichier est introuvable.' });
      const encodedName = encodeURIComponent(file.name).replace(/'/g, '%27');
      const storedMimeType = String(file.mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
      const canRenderInline = SAFE_INLINE_FILE_TYPES.has(storedMimeType);
      res.writeHead(200, {
        'Content-Type': canRenderInline ? storedMimeType : 'application/octet-stream',
        'Content-Length': content.length,
        'Content-Disposition': `${canRenderInline ? 'inline' : 'attachment'}; filename="document"; filename*=UTF-8''${encodedName}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      return res.end(content);
    }
    if (req.method === 'PATCH') {
      const changes = await requestBody(req);
      if (changes.name !== undefined) file.name = safeFileName(changes.name);
      if (changes.folderId !== undefined) {
        const dossier = await readJson(dossierPath);
        if (!hasFolder(String(changes.folderId), dossier)) return json(res, 400, { error: 'Rubrique de classement inconnue.' });
        file.folderId = String(changes.folderId);
      }
      file.updatedAt = new Date().toISOString();
      await saveFileIndex(index);
      return json(res, 200, { file: publicFile(file) });
    }
    if (req.method === 'PUT') {
      const oldStoredName = file.storedName;
      file.name = safeFileName(req.headers['x-file-name'] || file.name);
      file.mimeType = String(req.headers['content-type'] || file.mimeType || 'application/octet-stream').split(';')[0];
      const extension = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 15);
      file.storedName = `${file.id}-${Date.now()}${extension}`;
      try { file.size = await saveUploadedContent(req, file); }
      catch (error) {
        file.storedName = oldStoredName;
        if (error.message === 'file_too_large') return json(res, 413, { error: 'Fichier trop volumineux. La limite est de 25 Mo.' });
        if (error.message === 'empty_file') return json(res, 400, { error: 'Le fichier est vide.' });
        throw error;
      }
      await fs.unlink(path.join(fileStoragePath, oldStoredName)).catch(() => {});
      file.updatedAt = new Date().toISOString();
      await saveFileIndex(index);
      return json(res, 200, { file: publicFile(file) });
    }
    if (req.method === 'DELETE') {
      await fs.unlink(storedFilePath(file)).catch(() => {});
      index.files = index.files.filter((item) => item.id !== fileId);
      await saveFileIndex(index);
      return json(res, 200, { deleted: true });
    }
  }
  return json(res, 404, { error: 'Route inconnue.' });
}

async function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/api/') || pathname.startsWith('/private/') || pathname.startsWith('/config/') || pathname.startsWith('/storage/')) return json(res, 404, { error: 'Ressource non disponible.' });
  if (pathname === '/vendor/supabase.js') {
    const preparedVendor = path.join(ROOT, 'public', 'vendor', 'supabase.js');
    const packageVendor = path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
    const content = await fs.readFile(preparedVendor).catch(() => fs.readFile(packageVendor).catch(() => null));
    if (!content) return json(res, 404, { error: 'SDK Supabase indisponible.' });
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.end(content);
    return;
  }
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\/+/, ''));
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep)) return json(res, 403, { error: 'Accès interdit.' });
  try {
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': pathname === '/classeur.html' || pathname === '/admin.html' ? 'no-store' : 'no-cache' });
    res.end(content);
  } catch { json(res, 404, { error: 'Page introuvable.' }); }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/auth/google') {
      res.writeHead(302, { Location: '/classeur.html', 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url.pathname);
  } catch (error) {
    const status = error.message === 'payload_too_large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    if (!res.headersSent) json(res, status, { error: status === 500 ? 'Une erreur serveur est survenue.' : 'Requête invalide.' });
    else res.end();
    if (status === 500) console.error('Unhandled server request error:', error);
  }
});
server.listen(PORT, HOST, () => console.log(`Fiscale secure server running on http://${HOST}:${PORT}${AUTH_BYPASS ? ' (mode développement : accès administrateur simulé)' : ''}`));

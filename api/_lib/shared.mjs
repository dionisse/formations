/* Socle commun des fonctions serverless (Vercel) : vérification du jeton Supabase,
   contrôle des droits par formation et accès REST. Même logique que server.mjs,
   réécrite pour les fonctions Node de Vercel. */

export const ADMIN_EMAIL = 'godwingobex@gmail.com';
export const CLASSEUR_COURSE_VERSION = 'formation-fiscale-v1';
export const COURSE_VERSIONS = new Set(
  (process.env.COURSE_VERSIONS || 'formation-fiscale-v1').split(',').map((version) => version.trim()).filter(Boolean)
);
export const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
/* Le contournement d’authentification reste réservé au développement local. */
export const AUTH_BYPASS = process.env.NODE_ENV !== 'production' && process.env.AUTH_BYPASS === 'true';
export const DEVELOPMENT_USER = {
  id: 'local-development-user',
  email: 'developpement@fiscale.local',
  name: 'Développement local',
  picture: '',
  isAdmin: true,
  emailVerified: true,
  developmentBypass: true
};

export function json(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    return req.body;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 64 * 1024) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function bearerToken(req) {
  const match = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function verifySupabaseUser(req) {
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

export async function currentUser(req) {
  if (AUTH_BYPASS) return DEVELOPMENT_USER;
  return verifySupabaseUser(req);
}

export async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) {
    json(res, 401, { error: 'Connectez-vous avec votre compte Google.' });
    return null;
  }
  return user;
}

export async function requireAdministrator(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!user.isAdmin && !user.developmentBypass) {
    json(res, 403, { error: 'Accès administrateur requis.' });
    return null;
  }
  return user;
}

export async function supabaseRest(user, resource, { method = 'GET', body, prefer } = {}) {
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

export async function getEntitlement(user, courseVersion) {
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

export async function requireCourseEntitlement(req, res, courseVersion) {
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

/* Vercel peut fournir la méthode dans req.method ; on la normalise par sécurité. */
export function method(req) {
  return String(req.method || 'GET').toUpperCase();
}

export function urlOf(req) {
  const host = req.headers?.host || 'localhost';
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
  return new URL(req.url || '/', `${protocol}://${host}`);
}

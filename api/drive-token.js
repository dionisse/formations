/* api/drive-token — échange le jeton Google hors ligne du participant contre un accès
   temporaire (1 heure) à son Google Drive. Le secret client ne quitte jamais le serveur.
   GET   : état de la liaison (sans exposer le jeton).
   POST  : enregistre un jeton fraîchement accordé ({ refreshToken }) et/ou renvoie un
           accès temporaire. Sans jeton enregistré, la réponse est 409 drive_not_connected.
   DELETE: retire la liaison (le participant peut toujours révoquer côté Google). */

import { json, method, readBody, requireUser, supabaseRest } from './_lib/shared.mjs';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const isConfigured = () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

async function storedToken(user) {
  const query = new URLSearchParams({
    select: 'user_id,refresh_token,google_email,granted_scopes,updated_at',
    user_id: `eq.${user.id}`,
    limit: '1'
  });
  const { response, payload } = await supabaseRest(user, `participant_drive_tokens?${query}`);
  if (!response.ok) throw new Error(payload?.message || 'La lecture de votre liaison Google Drive a échoué.');
  return Array.isArray(payload) ? payload[0] || null : null;
}

async function storeToken(user, { refreshToken, googleEmail, scope }) {
  const { response, payload } = await supabaseRest(user, 'participant_drive_tokens', {
    method: 'POST',
    body: {
      user_id: user.id,
      refresh_token: refreshToken,
      google_email: googleEmail || user.email || null,
      granted_scopes: scope || DRIVE_SCOPE,
      updated_at: new Date().toISOString()
    },
    prefer: 'resolution=merge-duplicates,return=minimal'
  });
  if (!response.ok) throw new Error(payload?.message || 'L’enregistrement de votre liaison Google Drive a échoué.');
}

async function forgetToken(user) {
  const { response, payload } = await supabaseRest(user, `participant_drive_tokens?user_id=eq.${user.id}`, {
    method: 'DELETE',
    prefer: 'return=minimal'
  });
  if (!response.ok) throw new Error(payload?.message || 'La suppression de votre liaison Google Drive a échoué.');
}

async function exchange(refreshToken) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }),
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const reason = String(payload.error || payload.error_description || '').toLowerCase();
    const expired = reason.includes('invalid_grant') || reason.includes('expired') || reason.includes('revoked');
    const error = new Error(expired
      ? 'L’autorisation Google Drive a expiré. Reconnectez-vous avec Google pour la renouveler.'
      : 'Google a refusé la demande d’accès à votre Drive. Réessayez dans un instant.');
    error.status = expired ? 401 : 502;
    error.code = expired ? 'drive_authorization_expired' : 'drive_token_failed';
    throw error;
  }
  return payload;
}

export default async function handler(req, res) {
  const httpMethod = method(req);
  if (!['GET', 'POST', 'DELETE'].includes(httpMethod)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return json(res, 405, { error: 'Méthode non autorisée.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  /* Le contournement de développement n'a pas de compte Supabase : on annonce simplement
     que la liaison n'est pas disponible dans ce mode. */
  if (user.developmentBypass) {
    if (httpMethod === 'GET') return json(res, 200, { configured: isConfigured(), connected: false, developmentBypass: true });
    return json(res, 409, { error: 'La liaison Google Drive n’est pas active en mode développement.', code: 'drive_not_connected' });
  }

  if (httpMethod === 'GET') {
    if (!isConfigured()) return json(res, 200, { configured: false, connected: false });
    try {
      const token = await storedToken(user);
      return json(res, 200, { configured: true, connected: Boolean(token), googleEmail: token?.google_email || '', connectedAt: token?.updated_at || null });
    } catch (error) {
      console.error('Drive link status failed:', error.message);
      return json(res, 200, { configured: true, connected: false, error: error.message });
    }
  }

  if (httpMethod === 'DELETE') {
    try {
      await forgetToken(user);
      return json(res, 200, { connected: false });
    } catch (error) {
      console.error('Drive link removal failed:', error.message);
      return json(res, 500, { error: error.message });
    }
  }

  const body = await readBody(req).catch(() => ({}));
  const providedRefreshToken = String(body.refreshToken || '').trim();

  if (!isConfigured()) {
    return json(res, 503, {
      error: 'La liaison Google Drive n’est pas encore configurée sur le serveur.',
      code: 'drive_not_configured'
    });
  }

  try {
    if (providedRefreshToken) {
      await storeToken(user, {
        refreshToken: providedRefreshToken,
        googleEmail: body.googleEmail || user.email,
        scope: body.scope
      });
    }
    const stored = providedRefreshToken ? { refresh_token: providedRefreshToken, google_email: body.googleEmail || user.email } : await storedToken(user);
    if (!stored?.refresh_token) {
      return json(res, 409, {
        error: 'Votre Google Drive n’est pas encore relié à votre compte. Reconnectez-vous avec Google pour l’autoriser.',
        code: 'drive_not_connected'
      });
    }
    const granted = await exchange(stored.refresh_token);
    return json(res, 200, {
      accessToken: granted.access_token,
      expiresIn: Number(granted.expires_in) || 3600,
      scope: granted.scope || DRIVE_SCOPE,
      googleEmail: stored.google_email || user.email || ''
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500 && status !== 502) console.error('Drive token exchange failed:', error.message);
    return json(res, status, { error: error.message, code: error.code || 'drive_token_error' });
  }
}

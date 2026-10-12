/* PATCH /api/certificates/:reference — changement de statut réservé à l’administrateur. */
import { json, method, readBody, requireAdministrator, urlOf } from '../_lib/shared.mjs';
import { certificateReference, updateCertificateStatus } from '../_lib/certificates.mjs';

const VALID_STATUSES = new Set(['pending', 'validated', 'revoked']);

function routeReference(req) {
  const value = req.query?.reference;
  if (Array.isArray(value)) return value[0] || '';
  if (value) return String(value);
  const match = urlOf(req).pathname.match(/^\/api\/certificates\/([^/]+)$/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}

export default async function handler(req, res) {
  if (method(req) !== 'PATCH') return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'PATCH' });
  const admin = await requireAdministrator(req, res);
  if (!admin) return;
  if (admin.developmentBypass) {
    return json(res, 503, { error: 'La gestion des certificats nécessite la migration Supabase en production.' });
  }

  const reference = certificateReference(routeReference(req));
  if (!reference) return json(res, 400, { error: 'Code de certificat invalide.' });
  let body;
  try { body = await readBody(req); }
  catch (error) {
    const status = error.message === 'payload_too_large' ? 413 : 400;
    return json(res, status, { error: status === 413 ? 'Données trop volumineuses.' : 'Les données reçues sont invalides.' });
  }
  if (!VALID_STATUSES.has(body.status)) return json(res, 400, { error: 'Statut de certificat invalide.' });

  try {
    const certificate = await updateCertificateStatus(admin, reference, body.status);
    if (!certificate) return json(res, 404, { error: 'Certificat introuvable.' });
    return json(res, 200, { certificate });
  } catch (error) {
    console.error('Administrator certificate status update failed:', error.message);
    return json(res, 503, { error: 'Le statut du certificat n’a pas pu être modifié. Vérifiez la migration Supabase.' });
  }
}

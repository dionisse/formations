/* API compacte /api/certificates — toutes les actions partagent une fonction Vercel.
   GET ?verify=1 reste public ; les autres lectures/ecritures sont admin seulement. */
import { json, method, readBody, requireAdministrator, urlOf } from './_lib/shared.mjs';
import { certificateReference, listCertificates, normalizeCertificate, saveCertificate, updateCertificateStatus, verifyPublicCertificate } from './_lib/certificates.mjs';

const VALID_STATUSES = new Set(['pending', 'validated', 'revoked']);

export default async function handler(req, res) {
  const httpMethod = method(req);
  const requestUrl = urlOf(req);
  const publicVerification = requestUrl.searchParams.get('verify') === '1';

  if (publicVerification && httpMethod !== 'GET') {
    return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  }
  if (!publicVerification && !['GET', 'POST', 'PATCH'].includes(httpMethod)) {
    return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET, POST, PATCH' });
  }

  if (publicVerification) {
    const reference = certificateReference(requestUrl.searchParams.get('reference'));
    if (!reference) return json(res, 400, { error: 'Code de certificat manquant.' });
    try {
      return json(res, 200, await verifyPublicCertificate(reference));
    } catch (error) {
      console.error('Public certificate verification failed:', error.message);
      return json(res, 503, { error: 'La vérification des certificats est momentanément indisponible.' });
    }
  }

  const admin = await requireAdministrator(req, res);
  if (!admin) return;
  if (admin.developmentBypass) {
    return json(res, 503, { error: 'La gestion des certificats nécessite la migration Supabase en production.' });
  }

  if (httpMethod === 'GET') {
    try {
      return json(res, 200, { certificates: await listCertificates(admin) });
    } catch (error) {
      console.error('Administrator certificate list failed:', error.message);
      return json(res, 503, { error: 'Impossible de charger les certificats. Vérifiez la migration Supabase des certificats.' });
    }
  }

  if (httpMethod === 'PATCH') {
    const reference = certificateReference(requestUrl.searchParams.get('reference'));
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

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    const status = error.message === 'payload_too_large' ? 413 : 400;
    return json(res, status, { error: status === 413 ? 'Données trop volumineuses.' : 'Les données reçues sont invalides.' });
  }

  const normalized = normalizeCertificate(body);
  if (normalized.error) return json(res, 400, { error: normalized.error });
  try {
    const certificate = await saveCertificate(admin, normalized.certificate);
    return json(res, 200, { certificate });
  } catch (error) {
    console.error('Administrator certificate save failed:', error.message);
    return json(res, 503, { error: 'Le certificat n’a pas pu être enregistré. Vérifiez la configuration et la migration Supabase.' });
  }
}

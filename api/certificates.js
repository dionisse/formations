/* GET/POST /api/certificates — gestion privee des dossiers de certificat. */
import { json, method, readBody, requireAdministrator } from './_lib/shared.mjs';
import { listCertificates, normalizeCertificate, saveCertificate } from './_lib/certificates.mjs';

export default async function handler(req, res) {
  const httpMethod = method(req);
  if (!['GET', 'POST'].includes(httpMethod)) {
    return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET, POST' });
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

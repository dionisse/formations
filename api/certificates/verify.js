/* GET /api/certificates/verify?reference=... — validation publique sans divulguer les champs privés. */
import { json, method, urlOf } from '../_lib/shared.mjs';
import { certificateReference, verifyPublicCertificate } from '../_lib/certificates.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  const reference = certificateReference(urlOf(req).searchParams.get('reference'));
  if (!reference) return json(res, 400, { error: 'Code de certificat manquant.' });

  try {
    return json(res, 200, await verifyPublicCertificate(reference));
  } catch (error) {
    console.error('Public certificate verification failed:', error.message);
    return json(res, 503, { error: 'La vérification des certificats est momentanément indisponible.' });
  }
}

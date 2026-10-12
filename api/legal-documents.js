/* GET /api/legal-documents — version publique des documents juridiques.
   En l'absence de configuration Supabase, les textes de référence sont servis depuis le code. */
import { json, method } from './_lib/shared.mjs';
import { readLegalDocuments } from './_lib/legal-documents.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });

  try {
    const result = await readLegalDocuments();
    return json(res, 200, result);
  } catch (error) {
    console.error('Public legal documents lookup failed:', error.message);
    return json(res, 503, { error: 'Les documents juridiques ne peuvent pas être chargés pour le moment.' });
  }
}

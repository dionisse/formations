/* GET/PUT /api/admin/legal-documents — édition en texte brut réservée à l'administrateur vérifié. */
import { LEGAL_DOCUMENT_MAX_LENGTH } from '../../legal-documents-data.js';
import { json, method, readBody, requireAdministrator, supabaseRest } from '../_lib/shared.mjs';
import { readLegalDocuments } from '../_lib/legal-documents.mjs';

const SELECT = 'slug,title,content,updated_at';

function normalizeDocument(body) {
  const slug = String(body?.slug || '').trim();
  const title = typeof body?.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '';
  const content = typeof body?.content === 'string'
    ? body.content.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim()
    : '';

  if (!['confidentialite', 'conditions-utilisation'].includes(slug)) {
    return { error: 'Document juridique inconnu.' };
  }
  if (!title || title.length > 180) return { error: 'Le titre est obligatoire et doit contenir au plus 180 caractères.' };
  if (!content) return { error: 'Le texte du document ne peut pas être vide.' };
  if (content.length > LEGAL_DOCUMENT_MAX_LENGTH) {
    return { error: `Le texte dépasse la limite de ${LEGAL_DOCUMENT_MAX_LENGTH} caractères.` , status: 413 };
  }
  return { document: { slug, title, content } };
}

export default async function handler(req, res) {
  const httpMethod = method(req);
  if (!['GET', 'PUT'].includes(httpMethod)) {
    return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET, PUT' });
  }

  const admin = await requireAdministrator(req, res);
  if (!admin) return;

  if (httpMethod === 'GET') {
    try {
      const result = await readLegalDocuments(admin.developmentBypass ? null : admin);
      return json(res, 200, result);
    } catch (error) {
      console.error('Administrator legal documents lookup failed:', error.message);
      return json(res, 503, { error: 'Impossible de charger les documents. Vérifiez la migration Supabase des documents juridiques.' });
    }
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    const status = error.message === 'payload_too_large' ? 413 : 400;
    return json(res, status, { error: status === 413 ? 'Texte trop volumineux.' : 'Le contenu reçu est invalide.' });
  }

  const normalized = normalizeDocument(body);
  if (normalized.error) return json(res, normalized.status || 400, { error: normalized.error });
  if (admin.developmentBypass) {
    return json(res, 503, { error: 'Le stockage local est géré par le serveur de développement.' });
  }

  try {
    const query = new URLSearchParams({ on_conflict: 'slug', select: SELECT });
    const { response, payload } = await supabaseRest(admin, `legal_documents?${query}`, {
      method: 'POST',
      body: normalized.document,
      prefer: 'resolution=merge-duplicates,return=representation'
    });
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    const saved = Array.isArray(payload) ? payload[0] : null;
    if (!saved) throw new Error('Supabase n’a pas retourné le document enregistré.');
    return json(res, 200, { document: {
      slug: saved.slug,
      title: saved.title,
      content: saved.content,
      updatedAt: saved.updated_at || null
    } });
  } catch (error) {
    console.error('Administrator legal document update failed:', error.message);
    return json(res, 503, { error: 'Le document n’a pas pu être enregistré. Vérifiez la configuration et la migration Supabase.' });
  }
}

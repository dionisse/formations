import { LEGAL_DOCUMENTS, mergeLegalDocuments } from '../../legal-documents-data.js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseRest } from './shared.mjs';

const SELECT = 'slug,title,content,updated_at';

export async function readLegalDocuments(user = null) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { documents: mergeLegalDocuments(), source: 'defaults' };
  }

  const query = new URLSearchParams({ select: SELECT, order: 'slug.asc' });
  let response;
  let payload;

  if (user) {
    ({ response, payload } = await supabaseRest(user, `legal_documents?${query}`));
  } else {
    response = await fetch(`${SUPABASE_URL}/rest/v1/legal_documents?${query}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    });
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  return {
    documents: mergeLegalDocuments(Array.isArray(payload) ? payload : []),
    source: 'supabase'
  };
}

export { LEGAL_DOCUMENTS };

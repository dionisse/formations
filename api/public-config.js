/* GET /api/public-config — transmet uniquement l’URL Supabase et la clé publique.
   Le classeur s’en sert comme secours lorsque les valeurs ne sont pas injectées au build. */
import { SUPABASE_ANON_KEY, SUPABASE_URL, json, method } from './_lib/shared.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' });
  return json(res, 200, { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
}

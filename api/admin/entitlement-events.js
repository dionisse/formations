/* GET /api/admin/entitlement-events — journal des décisions de règlement.
   Lecture réservée à l’administrateur ; chaque décision est écrite par le
   déclencheur Supabase, jamais par cette route. */
import { json, method, requireAdministrator, supabaseRest } from '../_lib/shared.mjs';

const SELECT = [
  'id',
  'entitlement_id',
  'user_id',
  'course_version',
  'previous_status',
  'new_status',
  'actor_id',
  'payment_reference',
  'created_at'
].join(',');

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });

  const admin = await requireAdministrator(req, res);
  if (!admin) return;
  if (admin.developmentBypass) return json(res, 200, { events: [] });

  try {
    const query = new URLSearchParams({ select: SELECT, order: 'created_at.desc', limit: '200' });
    const { response, payload } = await supabaseRest(admin, `participant_entitlement_events?${query}`);
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    return json(res, 200, { events: Array.isArray(payload) ? payload : [] });
  } catch (error) {
    console.error('Administrator entitlement audit lookup failed:', error.message);
    return json(res, 503, { error: 'Impossible de charger le journal des règlements.' });
  }
}

/* GET /api/admin/entitlements — liste des demandes de règlement.
   Réservée à l’administrateur : les coordonnées du participant ne sont lisibles
   que par lui (règles RLS), et la réponse reste vide en mode développement. */
import { json, method, requireAdministrator, supabaseRest } from '../_lib/shared.mjs';

const SELECT = [
  'id',
  'user_id',
  'course_version',
  'status',
  'payment_method',
  'payment_reference',
  'requested_at',
  'paid_at',
  'approved_by',
  'created_at',
  'updated_at',
  'participant:participant_profiles!participant_entitlements_user_id_fkey(email,full_name)'
].join(',');

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });

  const admin = await requireAdministrator(req, res);
  if (!admin) return;
  if (admin.developmentBypass) return json(res, 200, { entitlements: [], auditAvailable: false });

  try {
    const query = new URLSearchParams({ select: SELECT, order: 'requested_at.desc' });
    const { response, payload } = await supabaseRest(admin, `participant_entitlements?${query}`);
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    return json(res, 200, { entitlements: Array.isArray(payload) ? payload : [], auditAvailable: true });
  } catch (error) {
    console.error('Administrator entitlement list failed:', error.message);
    return json(res, 503, { error: 'Impossible de charger les demandes de règlement.' });
  }
}

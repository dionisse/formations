/* POST /api/entitlements/request — ouvre une demande d’accès en attente de confirmation. */
import { COURSE_VERSIONS, getEntitlement, json, method, readBody, requireUser, supabaseRest } from '../_lib/shared.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'POST') return json(res, 405, { error: 'Méthode non autorisée.' });

  const user = await requireUser(req, res);
  if (!user) return;

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return json(res, error.message === 'payload_too_large' ? 413 : 400, { error: 'Requête invalide.' });
  }

  const courseVersion = String(body.courseVersion || '');
  if (!COURSE_VERSIONS.has(courseVersion)) return json(res, 400, { error: 'Formation inconnue.' });
  if (user.developmentBypass) return json(res, 200, { entitlement: { course_version: courseVersion, status: 'paid' } });

  try {
    const existing = await getEntitlement(user, courseVersion);
    if (existing) return json(res, 200, { entitlement: existing });

    const { response, payload } = await supabaseRest(
      user,
      'participant_entitlements?select=id,user_id,course_version,status,payment_method,payment_reference,requested_at,paid_at',
      {
        method: 'POST',
        body: { user_id: user.id, course_version: courseVersion, status: 'pending', payment_method: 'manual_whatsapp' },
        prefer: 'return=representation'
      }
    );
    if (response.ok) return json(res, 201, { entitlement: Array.isArray(payload) ? payload[0] || null : payload });
    if (response.status === 409) {
      const raced = await getEntitlement(user, courseVersion);
      if (raced) return json(res, 200, { entitlement: raced });
    }
    console.error('Entitlement request insert failed:', payload?.message || response.status);
    return json(res, response.status === 401 ? 401 : 503, { error: 'La demande d’accès n’a pas pu être enregistrée. Réessayez plus tard.' });
  } catch (error) {
    console.error('Entitlement request failed:', error.message);
    return json(res, 503, { error: 'Le service de demande d’accès est momentanément indisponible.' });
  }
}

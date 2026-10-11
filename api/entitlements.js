/* GET /api/entitlements — statut de règlement du participant pour le classeur. */
import { CLASSEUR_COURSE_VERSION, getEntitlement, json, method, requireUser } from './_lib/shared.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' });

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const entitlement = await getEntitlement(user, CLASSEUR_COURSE_VERSION);
    return json(res, 200, {
      entitlement: entitlement
        ? {
            id: entitlement.id || null,
            courseVersion: entitlement.course_version || CLASSEUR_COURSE_VERSION,
            status: entitlement.status,
            requestedAt: entitlement.requested_at || null,
            paidAt: entitlement.paid_at || null
          }
        : null
    });
  } catch (error) {
    console.error('Participant entitlement lookup failed:', error.message);
    return json(res, 503, { error: 'Le statut du règlement est momentanément indisponible.' });
  }
}

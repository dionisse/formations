/* GET /api/session — compte connecté, statut d’accès au classeur et version de formation. */
import {
  CLASSEUR_COURSE_VERSION,
  currentUser,
  getEntitlement,
  json,
  method
} from './_lib/shared.mjs';

export default async function handler(req, res) {
  if (method(req) !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' });

  const user = await currentUser(req);
  if (!user) return json(res, 401, { authenticated: false });

  let entitlement = null;
  let entitlementCheckError = false;
  if (user.developmentBypass) entitlement = { status: 'paid', course_version: CLASSEUR_COURSE_VERSION };
  else if (!user.isAdmin) {
    try {
      entitlement = await getEntitlement(user, CLASSEUR_COURSE_VERSION);
    } catch (error) {
      entitlementCheckError = true;
      console.error('Session entitlement lookup failed:', error.message);
    }
  }

  return json(res, 200, {
    authenticated: true,
    isAdmin: Boolean(user.isAdmin),
    developmentBypass: Boolean(user.developmentBypass),
    user: { id: user.id, email: user.email, name: user.name, ...(user.picture ? { picture: user.picture } : {}) },
    courseVersion: CLASSEUR_COURSE_VERSION,
    entitlement: entitlement
      ? {
          id: entitlement.id || null,
          courseVersion: entitlement.course_version || CLASSEUR_COURSE_VERSION,
          status: entitlement.status,
          requestedAt: entitlement.requested_at || null,
          paidAt: entitlement.paid_at || null
        }
      : null,
    entitlementCheckError
  });
}

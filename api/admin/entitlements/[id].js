/* PATCH /api/admin/entitlements/:id — décision de l’administrateur sur une demande.
   Confirmer, remettre en attente ou révoquer la formation concernée. L’écriture
   du journal est assurée par le déclencheur Supabase « audit_participant_entitlement_change ». */
import { json, method, readBody, requireAdministrator, supabaseRest } from '../../_lib/shared.mjs';

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* Vercel expose l’identifiant de route dans req.query.id ; on retombe sur l’URL si besoin. */
function requestedId(req) {
  const fromQuery = req.query?.id;
  const value = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  if (typeof value === 'string' && value.trim()) return decodeURIComponent(value.trim());
  const match = String(req.url || '').split('?')[0].match(/\/api\/admin\/entitlements\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default async function handler(req, res) {
  if (method(req) !== 'PATCH') return json(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'PATCH' });

  const admin = await requireAdministrator(req, res);
  if (!admin) return;

  const id = requestedId(req);
  if (!ID_PATTERN.test(id)) return json(res, 400, { error: 'Référence de demande invalide.' });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return json(res, error.message === 'payload_too_large' ? 413 : 400, { error: 'Requête invalide.' });
  }
  if (!['pending', 'paid', 'revoked'].includes(body.status)) return json(res, 400, { error: 'Statut de règlement invalide.' });
  if (admin.developmentBypass) return json(res, 503, { error: 'La gestion des accès nécessite une configuration Supabase.' });

  const paymentReference = String(body.paymentReference || '').trim().slice(0, 180) || null;
  try {
    const query = new URLSearchParams({
      id: `eq.${id}`,
      select: 'id,user_id,course_version,status,payment_method,payment_reference,requested_at,paid_at,approved_by,updated_at'
    });
    const { response, payload } = await supabaseRest(admin, `participant_entitlements?${query}`, {
      method: 'PATCH',
      body: {
        status: body.status,
        payment_reference: paymentReference,
        paid_at: body.status === 'paid' ? new Date().toISOString() : null,
        approved_by: body.status === 'paid' ? admin.id : null
      },
      prefer: 'return=representation'
    });
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    const updated = Array.isArray(payload) ? payload[0] || null : null;
    if (!updated) return json(res, 404, { error: 'Demande de règlement introuvable.' });
    return json(res, 200, { entitlement: updated });
  } catch (error) {
    console.error('Administrator entitlement update failed:', error.message);
    return json(res, 503, { error: 'La décision n’a pas pu être enregistrée.' });
  }
}

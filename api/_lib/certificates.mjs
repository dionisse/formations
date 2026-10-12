import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseRest } from './shared.mjs';

const SELECT = 'reference,participant_name,profile,birth_date,birth_place,nationality,payment_reference,status,created_at,validated_at,updated_at';
const CERTIFICATE_STATUSES = new Set(['pending', 'validated', 'revoked']);

export function certificateReference(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '').slice(0, 100);
}

export function normalizeCertificate(body) {
  const values = body && typeof body === 'object' ? body : {};
  const reference = certificateReference(values.reference);
  const participantName = String(values.participantName || '').trim().slice(0, 180);
  const status = values.status == null || values.status === '' ? 'pending' : String(values.status);

  if (!reference || !participantName) return { error: 'Le code et le nom du participant sont obligatoires.' };
  if (!CERTIFICATE_STATUSES.has(status)) return { error: 'Statut de certificat invalide.' };
  const certificate = { reference, participantName, status };
  for (const [input, output, maximum] of [
    ['profile', 'profile', 80],
    ['birthDate', 'birthDate', 30],
    ['birthPlace', 'birthPlace', 120],
    ['nationality', 'nationality', 80],
    ['paymentReference', 'paymentReference', 180]
  ]) {
    if (!Object.hasOwn(values, input)) continue;
    const value = String(values[input] || '').trim().slice(0, maximum);
    certificate[output] = output === 'paymentReference' ? value || null : value;
  }
  return { certificate };
}

export function certificateFromRow(row) {
  return {
    reference: row.reference,
    participantName: row.participant_name,
    profile: row.profile || '',
    birthDate: row.birth_date || '',
    birthPlace: row.birth_place || '',
    nationality: row.nationality || '',
    paymentReference: row.payment_reference || '',
    status: row.status,
    createdAt: row.created_at,
    validatedAt: row.validated_at || null,
    updatedAt: row.updated_at
  };
}

function requireSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase n’est pas configuré pour gérer les certificats.');
}

export async function listCertificates(admin) {
  requireSupabase();
  const query = new URLSearchParams({ select: SELECT, order: 'updated_at.desc', limit: '1000' });
  const { response, payload } = await supabaseRest(admin, `certificates?${query}`);
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  return (Array.isArray(payload) ? payload : []).map(certificateFromRow);
}

export async function saveCertificate(admin, certificate) {
  requireSupabase();
  const now = new Date().toISOString();
  const body = {
    reference: certificate.reference,
    participant_name: certificate.participantName,
    status: certificate.status,
    validated_at: certificate.status === 'validated' ? now : null,
    updated_by: admin.id
  };
  for (const [input, column] of [
    ['profile', 'profile'],
    ['birthDate', 'birth_date'],
    ['birthPlace', 'birth_place'],
    ['nationality', 'nationality'],
    ['paymentReference', 'payment_reference']
  ]) {
    if (Object.hasOwn(certificate, input)) body[column] = certificate[input];
  }
  const query = new URLSearchParams({ on_conflict: 'reference', select: SELECT });
  const { response, payload } = await supabaseRest(admin, `certificates?${query}`, {
    method: 'POST',
    body,
    prefer: 'resolution=merge-duplicates,return=representation'
  });
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  const row = Array.isArray(payload) ? payload[0] : null;
  if (!row) throw new Error('Supabase n’a pas retourné le certificat enregistré.');
  return certificateFromRow(row);
}

export async function updateCertificateStatus(admin, reference, status) {
  requireSupabase();
  const query = new URLSearchParams({ reference: `eq.${reference}`, select: SELECT });
  const { response, payload } = await supabaseRest(admin, `certificates?${query}`, {
    method: 'PATCH',
    body: {
      status,
      validated_at: status === 'validated' ? new Date().toISOString() : null,
      updated_by: admin.id
    },
    prefer: 'return=representation'
  });
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  const row = Array.isArray(payload) ? payload[0] : null;
  return row ? certificateFromRow(row) : null;
}

export async function verifyPublicCertificate(reference) {
  requireSupabase();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_certificate`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ p_reference: reference }),
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  const row = Array.isArray(payload) ? payload[0] : null;
  if (!row) return { valid: false, status: 'not_found', reference };
  return {
    valid: row.status === 'validated',
    status: row.status,
    reference: row.reference,
    participantName: row.status === 'validated' ? row.participant_name : '',
    profile: row.status === 'validated' ? row.profile : '',
    validatedAt: row.validated_at || null
  };
}

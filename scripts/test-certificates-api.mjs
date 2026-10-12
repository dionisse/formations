/* Verifie l'API des certificats, ses contrôles d'accès et l'absence de fuite publique. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const childScript = `
  import assert from 'node:assert/strict';
  import certificatesHandler from '${new URL('../api/certificates.js', import.meta.url).pathname}';

  const adminId = '6f1e0c2a-9b3d-4f57-8a10-2c9c4e5b7d31';
  const requests = [];
  let verificationStatus = 'pending';
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/auth/v1/user') {
      const token = String(init.headers?.Authorization || '');
      const isAdmin = token.includes('admin-token');
      return new Response(JSON.stringify({
        id: isAdmin ? adminId : '37d547b5-29f3-4ebf-8e4e-4ce532f0b501',
        email: isAdmin ? 'godwingobex@gmail.com' : 'participant@example.com',
        email_confirmed_at: '2026-10-12T10:00:00.000Z',
        user_metadata: { full_name: isAdmin ? 'Admin GOBEX' : 'Participant' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    requests.push({ method: init.method || 'GET', url: url.toString(), headers: init.headers, body: init.body });
    if (url.pathname === '/rest/v1/certificates' && (init.method || 'GET') === 'GET') {
      return new Response(JSON.stringify([{
        reference: 'CERT-01', participant_name: 'Alice Test', profile: 'Fiscaliste', birth_date: '1990-05-10',
        birth_place: 'Cotonou', nationality: 'Béninoise', payment_reference: 'RECU-AB12', status: 'pending',
        created_at: '2026-10-10T12:00:00.000Z', validated_at: null, updated_at: '2026-10-12T12:00:00.000Z'
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/rest/v1/certificates' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify([{
        ...body, participant_name: body.participant_name, created_at: '2026-10-12T12:00:00.000Z',
        updated_at: '2026-10-12T12:00:00.000Z'
      }]), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/rest/v1/certificates' && init.method === 'PATCH') {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify([{
        reference: 'CERT-01', participant_name: 'Alice Test', profile: 'Fiscaliste', birth_date: '1990-05-10',
        birth_place: 'Cotonou', nationality: 'Béninoise', payment_reference: 'RECU-AB12', status: body.status,
        created_at: '2026-10-10T12:00:00.000Z', validated_at: body.validated_at, updated_at: '2026-10-12T13:00:00.000Z'
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/rest/v1/rpc/verify_certificate') {
      const body = JSON.parse(init.body);
      assert.equal(body.p_reference, 'CERT-01');
      return new Response(JSON.stringify([{
        reference: 'CERT-01', status: verificationStatus,
        participant_name: verificationStatus === 'validated' ? 'Alice Test' : 'SECRET PRIVATE NAME',
        profile: verificationStatus === 'validated' ? 'Fiscaliste' : 'SECRET PRIVATE PROFILE',
        validated_at: verificationStatus === 'validated' ? '2026-10-12T12:30:00.000Z' : null
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('Unexpected URL: ' + url.toString());
  };

  const makeResponse = () => ({ statusCode: 0, headers: {}, payload: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(value) { this.payload = value ? JSON.parse(value) : null; }
  });
  const makeRequest = (method, url, body, token = 'admin-token', query = {}) => ({
    method, url, query, body,
    headers: { host: 'localhost:3000', authorization: token ? 'Bearer ' + token : '' }
  });
  const call = async (handler, req) => { const res = makeResponse(); await handler(req, res); return res; };

  const list = await call(certificatesHandler, makeRequest('GET', '/api/certificates'));
  assert.equal(list.statusCode, 200);
  assert.equal(list.payload.certificates[0].birthDate, '1990-05-10');
  assert.equal(list.payload.certificates[0].paymentReference, 'RECU-AB12');
  assert.equal(requests.at(-1).headers.Authorization, 'Bearer admin-token');

  const save = await call(certificatesHandler, makeRequest('POST', '/api/certificates', {
    reference: 'CERT-02', participantName: '  Bob Exemple ', profile: 'Auditeur', birthDate: '1992-11-02',
    birthPlace: 'Porto-Novo', nationality: 'Béninoise', paymentReference: 'TX-99001', status: 'pending'
  }));
  assert.equal(save.statusCode, 200);
  assert.equal(save.payload.certificate.participantName, 'Bob Exemple');
  assert.equal(save.payload.certificate.paymentReference, 'TX-99001');
  const savedBody = JSON.parse(requests.at(-1).body);
  assert.equal(savedBody.reference, 'CERT-02');
  assert.equal(savedBody.payment_reference, 'TX-99001');
  assert.equal(savedBody.updated_by, adminId);
  assert.match(requests.at(-1).headers.Prefer, /resolution=merge-duplicates/);

  const patch = await call(certificatesHandler, makeRequest('PATCH', '/api/certificates?reference=CERT-01', { status: 'validated' }));
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.payload.certificate.status, 'validated');
  assert.ok(patch.payload.certificate.validatedAt);

  const denied = await call(certificatesHandler, makeRequest('GET', '/api/certificates', undefined, 'participant-token'));
  assert.equal(denied.statusCode, 403);
  const unauthorized = await call(certificatesHandler, makeRequest('POST', '/api/certificates', { reference: 'X', participantName: 'Personne' }, ''));
  assert.equal(unauthorized.statusCode, 401);
  const invalidStatus = await call(certificatesHandler, makeRequest('PATCH', '/api/certificates?reference=CERT-01', { status: 'unknown' }));
  assert.equal(invalidStatus.statusCode, 400);

  const publicVerification = await call(certificatesHandler, makeRequest('GET', '/api/certificates?verify=1&reference=CERT-01', undefined, ''));
  assert.equal(publicVerification.statusCode, 200);
  assert.equal(publicVerification.payload.valid, false);
  assert.equal(publicVerification.payload.participantName, '');
  assert.equal(publicVerification.payload.profile, '');
  assert.deepEqual(Object.keys(publicVerification.payload).sort(), ['profile', 'participantName', 'reference', 'status', 'valid', 'validatedAt'].sort());
  verificationStatus = 'validated';
  const verified = await call(certificatesHandler, makeRequest('GET', '/api/certificates?verify=1&reference=CERT-01', undefined, ''));
  assert.equal(verified.payload.valid, true);
  assert.equal(verified.payload.participantName, 'Alice Test');
  assert.equal(verified.payload.profile, 'Fiscaliste');
  const wrongMethod = await call(certificatesHandler, makeRequest('POST', '/api/certificates?verify=1&reference=CERT-01', {}, ''));
  assert.equal(wrongMethod.statusCode, 405);
  const missingReference = await call(certificatesHandler, makeRequest('GET', '/api/certificates?verify=1', undefined, ''));
  assert.equal(missingReference.statusCode, 400);

  console.log('Vérifications des API de certificats, de l’accès administrateur et de la confidentialité réussies.');
`;

const output = execFileSync(process.execPath, ['--input-type=module', '-e', childScript], {
  env: {
    ...process.env,
    AUTH_BYPASS: 'false',
    NODE_ENV: 'test',
    SUPABASE_URL: 'https://supabase.test',
    SUPABASE_ANON_KEY: 'anon-test'
  },
  encoding: 'utf8'
});
assert.match(output, /Vérifications des API de certificats, de l’accès administrateur et de la confidentialité réussies/);
console.log(output.trim());

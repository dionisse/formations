/* Banc d’essai des fonctions serverless : exécute chaque handler avec de vraies
   requêtes simulées et vérifie les contrôles d’accès (401 / 402 / 200).
   Usage : node scripts/test-api-functions.mjs */
import assert from 'node:assert/strict';
import sessionHandler from '../api/session.js';
import entitlementsHandler from '../api/entitlements.js';
import entitlementRequestHandler from '../api/entitlements/request.js';
import dossierHandler from '../api/dossier.js';
import publicConfigHandler from '../api/public-config.js';
import driveTokenHandler from '../api/drive-token.js';
import adminEntitlementsHandler from '../api/admin/entitlements.js';
import adminEntitlementEventsHandler from '../api/admin/entitlement-events.js';
import adminEntitlementUpdateHandler from '../api/admin/entitlements/[id].js';
import legalDocumentsHandler from '../api/legal-documents.js';
import adminLegalDocumentsHandler from '../api/admin/legal-documents.js';

const results = [];
let failures = 0;

function mockRequest({ method = 'GET', url = '/', headers = {}, body } = {}) {
  const request = {
    method,
    url,
    headers: { host: 'localhost:3000', 'x-forwarded-proto': 'https', ...headers },
    body
  };
  /* Le socle lit le corps en flux lorsqu’il n’est pas déjà fourni. */
  request[Symbol.asyncIterator] = async function* iterate() {
    if (body !== undefined && !Buffer.isBuffer(body) && typeof body !== 'string') yield Buffer.from(JSON.stringify(body));
  };
  return request;
}

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    payload: undefined,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(value) { this.payload = value === undefined ? undefined : JSON.parse(value); }
  };
}

async function run(name, handler, request, expectation) {
  const response = mockResponse();
  try {
    await handler(request, response);
    expectation({ response });
    results.push(`OK    ${name} → ${response.statusCode}`);
  } catch (error) {
    failures += 1;
    results.push(`ECHEC ${name} → ${error.message}`);
  }
}

const bearer = (token) => ({ authorization: `Bearer ${token}` });

/* Sans jeton : refus attendu sur toutes les routes protégées. */
await run('GET /api/session sans jeton', sessionHandler, mockRequest({ url: '/api/session' }), ({ response }) => {
  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.authenticated, false);
});

await run('GET /api/entitlements sans jeton', entitlementsHandler, mockRequest({ url: '/api/entitlements' }), ({ response }) => {
  assert.equal(response.statusCode, 401);
});

await run('GET /api/dossier sans jeton', dossierHandler, mockRequest({ url: '/api/dossier' }), ({ response }) => {
  assert.equal(response.statusCode, 401);
});

await run('POST /api/entitlements/request sans jeton', entitlementRequestHandler,
  mockRequest({ method: 'POST', url: '/api/entitlements/request', body: { courseVersion: 'formation-fiscale-v1' } }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

/* Mauvais jeton : Supabase n’est pas configuré dans cet environnement de test,
   le socle doit donc refuser sans exception non gérée. */
await run('GET /api/dossier avec un jeton invalide', dossierHandler,
  mockRequest({ url: '/api/dossier', headers: bearer('jeton-invalide') }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

/* Méthodes refusées. */
await run('POST /api/session refusé', sessionHandler, mockRequest({ method: 'POST', url: '/api/session' }), ({ response }) => {
  assert.equal(response.statusCode, 405);
});

/* Contournement de développement : « AUTH_BYPASS=true » est figé au chargement du
   module, ce cas est donc vérifié dans un processus séparé, comme « npm run dev ». */
{
  const { execFileSync } = await import('node:child_process');
  const childScript = `
    import sessionHandler from '${new URL('../api/session.js', import.meta.url).pathname}';
    import dossierHandler from '${new URL('../api/dossier.js', import.meta.url).pathname}';
    import driveTokenHandler from '${new URL('../api/drive-token.js', import.meta.url).pathname}';
    import adminEntitlementsHandler from '${new URL('../api/admin/entitlements.js', import.meta.url).pathname}';
    import adminEntitlementEventsHandler from '${new URL('../api/admin/entitlement-events.js', import.meta.url).pathname}';
    import adminEntitlementUpdateHandler from '${new URL('../api/admin/entitlements/[id].js', import.meta.url).pathname}';
    const makeRes = () => ({ statusCode: 0, headers: {}, payload: undefined, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.payload = v ? JSON.parse(v) : undefined; } });
    const req = (url) => ({ method: 'GET', url, headers: { host: 'localhost' } });
    const sessionRes = makeRes();
    await sessionHandler(req('/api/session'), sessionRes);
    const dossierRes = makeRes();
    await dossierHandler(req('/api/dossier'), dossierRes);
    if (sessionRes.statusCode !== 200 || sessionRes.payload.developmentBypass !== true) throw new Error('session bypass attendu 200 + developmentBypass');
    if (dossierRes.statusCode !== 200 || !dossierRes.payload.folders?.length) throw new Error('dossier bypass attendu 200 + rubriques');
    const driveRes = makeRes();
    await driveTokenHandler(req('/api/drive-token'), driveRes);
    if (driveRes.statusCode !== 200 || driveRes.payload.developmentBypass !== true || driveRes.payload.connected !== false) throw new Error('liaison Drive attendue 200/connected:false en développement');
    const adminListRes = makeRes();
    await adminEntitlementsHandler(req('/api/admin/entitlements'), adminListRes);
    if (adminListRes.statusCode !== 200 || adminListRes.payload.auditAvailable !== false || adminListRes.payload.entitlements?.length !== 0) throw new Error('liste administrateur attendue 200 + tableau vide en développement');
    const adminEventsRes = makeRes();
    await adminEntitlementEventsHandler(req('/api/admin/entitlement-events'), adminEventsRes);
    if (adminEventsRes.statusCode !== 200 || adminEventsRes.payload.events?.length !== 0) throw new Error('journal administrateur attendu 200 + tableau vide en développement');
    const adminDecisionRes = makeRes();
    const adminDecisionReq = { method: 'PATCH', url: '/api/admin/entitlements/6f1e0c2a-9b3d-4f57-8a10-2c9c4e5b7d31', headers: { host: 'localhost' }, body: { status: 'paid' } };
    await adminEntitlementUpdateHandler(adminDecisionReq, adminDecisionRes);
    if (adminDecisionRes.statusCode !== 503) throw new Error('décision administrateur attendue 503 sans Supabase en développement');
    console.log('bypass-ok:' + dossierRes.payload.folders.length);
  `;
  try {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', childScript], {
      env: { ...process.env, AUTH_BYPASS: 'true', NODE_ENV: 'development' },
      encoding: 'utf8'
    }).trim();
    assert.match(output, /bypass-ok:\d+/);
    results.push(`OK    AUTH_BYPASS=true → session 200 + dossier complet (${output.split(':')[1]} rubriques) + liaison Drive annoncée`);
  } catch (error) {
    failures += 1;
    results.push(`ECHEC AUTH_BYPASS=true → ${String(error.stderr || error.message).trim().split('\n').slice(-1)[0]}`);
  }
}

/* Google Drive : liaison et accès temporaire. */
await run('GET /api/drive-token sans jeton', driveTokenHandler, mockRequest({ url: '/api/drive-token' }), ({ response }) => {
  assert.equal(response.statusCode, 401);
});

await run('PUT /api/drive-token (méthode refusée)', driveTokenHandler, mockRequest({ method: 'PUT', url: '/api/drive-token' }), ({ response }) => {
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'GET, POST, DELETE');
});

await run('GET /api/drive-token avec un jeton invalide', driveTokenHandler, mockRequest({ url: '/api/drive-token', headers: bearer('jeton-invalide') }), ({ response }) => {
  assert.equal(response.statusCode, 401);
});

/* Configuration publique : la route existe aussi en statique. */
await run('GET /api/public-config', publicConfigHandler, mockRequest({ url: '/api/public-config' }), ({ response }) => {
  assert.equal(response.statusCode, 200);
  assert.ok('supabaseUrl' in response.payload && 'supabaseAnonKey' in response.payload);
});

/* Les textes juridiques sont publics ; leur écriture reste protégée par l'API administrateur. */
{
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  await run('GET /api/legal-documents sans connexion', legalDocumentsHandler, mockRequest({ url: '/api/legal-documents' }), ({ response }) => {
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload.documents.map((document) => document.slug), ['confidentialite', 'conditions-utilisation']);
    assert.ok(response.payload.documents.every((document) => typeof document.content === 'string' && document.content.length > 100));
  });
  globalThis.fetch = previousFetch;
}

await run('POST /api/legal-documents refusé', legalDocumentsHandler, mockRequest({ method: 'POST', url: '/api/legal-documents' }), ({ response }) => {
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'GET');
});

await run('GET /api/admin/legal-documents sans jeton', adminLegalDocumentsHandler,
  mockRequest({ url: '/api/admin/legal-documents' }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

await run('PUT /api/admin/legal-documents sans jeton', adminLegalDocumentsHandler,
  mockRequest({ method: 'PUT', url: '/api/admin/legal-documents', body: { slug: 'confidentialite', title: 'Test', content: 'Texte' } }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

/* Administration : tableau de bord des règlements (réservé à l’administrateur). */
const ADMIN_ID = '6f1e0c2a-9b3d-4f57-8a10-2c9c4e5b7d31';

await run('GET /api/admin/entitlements sans jeton', adminEntitlementsHandler,
  mockRequest({ url: '/api/admin/entitlements' }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

await run('GET /api/admin/entitlements avec un jeton invalide', adminEntitlementsHandler,
  mockRequest({ url: '/api/admin/entitlements', headers: bearer('jeton-invalide') }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

await run('GET /api/admin/entitlement-events sans jeton', adminEntitlementEventsHandler,
  mockRequest({ url: '/api/admin/entitlement-events' }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

await run('POST /api/admin/entitlements refusé', adminEntitlementsHandler,
  mockRequest({ method: 'POST', url: '/api/admin/entitlements' }),
  ({ response }) => {
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.allow, 'GET');
  });

await run('PATCH /api/admin/entitlements/:id sans jeton', adminEntitlementUpdateHandler,
  mockRequest({ method: 'PATCH', url: `/api/admin/entitlements/${ADMIN_ID}`, body: { status: 'paid' } }),
  ({ response }) => { assert.equal(response.statusCode, 401); });

await run('GET /api/admin/entitlements/:id refusé (méthode)', adminEntitlementUpdateHandler,
  mockRequest({ url: `/api/admin/entitlements/${ADMIN_ID}` }),
  ({ response }) => {
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.allow, 'PATCH');
  });

console.log(results.join('\n'));
console.log(failures === 0 ? `\n${results.length} scénarios réussis.` : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);

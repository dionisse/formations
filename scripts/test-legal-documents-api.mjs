/* Exercices GET/PUT serverless avec une authentification et une réponse REST Supabase simulées. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const childScript = `
  import assert from 'node:assert/strict';
  import adminHandler from '${new URL('../api/admin/legal-documents.js', import.meta.url).pathname}';
  const requests = [];
  const adminId = '6f1e0c2a-9b3d-4f57-8a10-2c9c4e5b7d31';
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
    if (url.pathname === '/rest/v1/legal_documents') {
      requests.push({ method: init.method || 'GET', url: url.toString(), headers: init.headers, body: init.body });
      if ((init.method || 'GET') === 'POST') {
        const document = JSON.parse(init.body);
        return new Response(JSON.stringify([{ ...document, updated_at: '2026-10-12T12:00:00.000Z' }]), {
          status: 201, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('Unexpected URL: ' + url.toString());
  };
  const response = () => ({ statusCode: 0, headers: {}, payload: null, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, end(value) { this.payload = value ? JSON.parse(value) : null; } });
  const request = (method, body, token = 'admin-token') => ({
    method, url: '/api/admin/legal-documents', body,
    headers: { host: 'localhost', authorization: 'Bearer ' + token }
  });
  const getResponse = response();
  await adminHandler(request('GET'), getResponse);
  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.payload.documents.length, 2);
  assert.equal(getResponse.payload.source, 'supabase');

  const saveResponse = response();
  await adminHandler(request('PUT', { slug: 'confidentialite', title: 'Politique actualisée', content: '  Texte simple.\\r\\n\\r\\nDernier paragraphe.  ' }), saveResponse);
  assert.equal(saveResponse.statusCode, 200);
  assert.equal(saveResponse.payload.document.title, 'Politique actualisée');
  assert.equal(saveResponse.payload.document.content, 'Texte simple.\\n\\nDernier paragraphe.');
  assert.equal(saveResponse.payload.document.updatedAt, '2026-10-12T12:00:00.000Z');
  assert.equal(requests.at(-1).method, 'POST');
  assert.match(requests.at(-1).url, /on_conflict=slug/);
  assert.match(requests.at(-1).headers.Prefer, /resolution=merge-duplicates/);

  const invalidResponse = response();
  await adminHandler(request('PUT', { slug: 'un-autre-document', title: 'Test', content: 'Texte' }), invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(requests.filter((item) => item.method === 'POST').length, 1);

  const deniedResponse = response();
  await adminHandler(request('GET', undefined, 'participant-token'), deniedResponse);
  assert.equal(deniedResponse.statusCode, 403);
  console.log('Vérifications de l’API Supabase des documents juridiques réussies.');
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
assert.match(output, /Vérifications de l’API Supabase des documents juridiques réussies/);
console.log(output.trim());

/* Exercices les actions du tableau de bord certificats dans le vrai DOM de admin.html. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { LEGAL_DOCUMENTS } from '../legal-documents-data.js';

const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:4173/admin.html', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.confirm = () => true;

let records = [{
  reference: 'CERT-UI-01', participantName: 'Alice Exemple', profile: 'Fiscaliste', birthDate: '1990-05-10',
  birthPlace: 'Cotonou', nationality: 'Béninoise', paymentReference: 'RECU-01', status: 'pending',
  createdAt: '2026-10-10T12:00:00.000Z', validatedAt: null, updatedAt: '2026-10-12T12:00:00.000Z'
}];
const requests = [];
window.fiscaleParticipantAuth = {
  ready: Promise.resolve(),
  session: { access_token: 'admin-token' },
  getServerSession: async () => ({
    authenticated: true,
    isAdmin: true,
    user: { email: 'godwingobex@gmail.com' }
  }),
  subscribe: () => () => {}
};

globalThis.window = window;
globalThis.document = document;
globalThis.FormData = window.FormData;
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = new URL(url, 'http://localhost:4173');
  const path = requestUrl.pathname;
  requests.push({ path, search: requestUrl.search, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
  let payload = {};
  if (path === '/api/admin/entitlements') payload = { entitlements: [] };
  else if (path === '/api/admin/entitlement-events') payload = { events: [] };
  else if (path === '/api/admin/legal-documents') payload = { documents: LEGAL_DOCUMENTS, source: 'supabase' };
  else if (path === '/api/certificates' && (!options.method || options.method === 'GET')) payload = { certificates: records };
  else if (path === '/api/certificates' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    const saved = { ...records.find((item) => item.reference === body.reference), ...body, updatedAt: '2026-10-12T14:00:00.000Z' };
    records = [...records.filter((item) => item.reference !== saved.reference), saved];
    payload = { certificate: saved };
  } else if (path === '/api/certificates' && options.method === 'PATCH') {
    const body = JSON.parse(options.body);
    const reference = requestUrl.searchParams.get('reference');
    records = records.map((item) => item.reference === reference ? { ...item, status: body.status, updatedAt: '2026-10-12T14:30:00.000Z' } : item);
    payload = { certificate: records.find((item) => item.reference === reference) };
  }
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

await import('../admin.js?admin-certificate-ui-test');
async function settle() {
  for (let index = 0; index < 8; index += 1) await new Promise((resolve) => setImmediate(resolve));
}
await settle();

assert.equal(document.querySelector('#admin-dashboard').hidden, false);
assert.match(document.querySelector('#admin-certificates-list').textContent, /CERT-UI-01/);
assert.match(document.querySelector('#admin-certificates-list').textContent, /Alice Exemple/);

document.querySelector('[data-certificate-action="edit"]').click();
assert.equal(document.querySelector('#admin-certificate-reference').readOnly, true);
assert.equal(document.querySelector('#admin-certificate-name').value, 'Alice Exemple');
assert.equal(document.querySelector('#admin-certificate-birth-place').value, 'Cotonou');
document.querySelector('#admin-certificate-name').value = 'Alice Modifiée';
document.querySelector('#admin-certificate-payment-reference').value = 'RECU-02';
document.querySelector('#admin-certificate-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await settle();
const saveRequest = requests.find((request) => request.path === '/api/certificates' && request.method === 'POST');
assert.equal(saveRequest.body.reference, 'CERT-UI-01');
assert.equal(saveRequest.body.participantName, 'Alice Modifiée');
assert.equal(saveRequest.body.paymentReference, 'RECU-02');
assert.equal(document.querySelector('#admin-certificate-reference').readOnly, false);
assert.match(document.querySelector('#admin-certificates-feedback').textContent, /Modifications enregistrées/);

document.querySelector('[data-certificate-action="validated"]').click();
await settle();
const patchRequest = requests.find((request) => request.path === '/api/certificates' && request.search.includes('reference=CERT-UI-01') && request.method === 'PATCH');
assert.equal(patchRequest.body.status, 'validated');
assert.match(document.querySelector('#admin-certificates-list').textContent, /Validé/);

dom.window.close();
delete globalThis.window;
delete globalThis.document;
delete globalThis.FormData;
delete globalThis.fetch;
console.log('Vérifications du formulaire, de la modification et de la validation depuis le tableau de bord réussies.');

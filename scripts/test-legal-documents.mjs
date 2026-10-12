/* Vérifie les textes de référence, la fusion avec les valeurs Supabase et le rendu en texte brut sans HTML exécutable. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_MAX_LENGTH, mergeLegalDocuments } from '../legal-documents-data.js';
import { renderLegalText } from '../legal-text.js';

assert.deepEqual(LEGAL_DOCUMENTS.map((document) => document.slug), ['confidentialite', 'conditions-utilisation']);
assert.ok(LEGAL_DOCUMENTS.every((document) => document.title && document.content.length > 1000 && document.content.length <= LEGAL_DOCUMENT_MAX_LENGTH));
assert.equal((LEGAL_DOCUMENTS[0].content.match(/\n\d{1,2}\. /g) || []).length, 12);
assert.equal((LEGAL_DOCUMENTS[1].content.match(/\n\d{1,2}\. /g) || []).length, 17);

for (const [slug, file] of [
  ['confidentialite', 'confidentialite.html'],
  ['conditions-utilisation', 'conditions-utilisation.html']
]) {
  const page = new JSDOM(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  assert.equal(page.window.document.body.dataset.legalSlug, slug);
  assert.ok(page.window.document.querySelector('#legal-content'));
  assert.ok(page.window.document.querySelector('footer a[href="/confidentialite.html"]'));
  assert.ok(page.window.document.querySelector('footer a[href="/conditions-utilisation.html"]'));
  page.window.close();
}

const adminPage = new JSDOM(readFileSync(new URL('../admin.html', import.meta.url), 'utf8'));
assert.ok(adminPage.window.document.querySelector('#admin-legal-document-title'));
assert.ok(adminPage.window.document.querySelector('#admin-legal-document-content'));
assert.equal(adminPage.window.document.querySelectorAll('[data-legal-slug]').length, 2);
assert.ok(adminPage.window.document.querySelector('#admin-certificate-form'));
assert.ok(adminPage.window.document.querySelector('#admin-certificate-reference[required]'));
assert.equal(adminPage.window.document.querySelectorAll('#admin-certificate-status option').length, 3);
assert.ok(adminPage.window.document.querySelector('.admin-quick-tools a[href="/classeur.html"]'));
assert.ok(adminPage.window.document.querySelector('.admin-quick-tools a[href="/index.html?mode=developer#programme"]'));
adminPage.window.close();

for (const file of ['index.html', 'connexion.html', 'perfecto.html', 'admin.html']) {
  const page = new JSDOM(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  assert.ok(page.window.document.querySelector('footer a[href="/confidentialite.html"]'), `${file} doit lier la politique`);
  assert.ok(page.window.document.querySelector('footer a[href="/conditions-utilisation.html"]'), `${file} doit lier les conditions`);
  page.window.close();
}

const saved = mergeLegalDocuments([
  { slug: 'confidentialite', title: 'Politique modifiée', content: '1. Titre modifié\n\nTexte actualisé.', updated_at: '2026-10-12T12:00:00.000Z' },
  { slug: 'slug-inconnu', title: 'Ignoré', content: 'Ignoré' }
]);
assert.equal(saved[0].title, 'Politique modifiée');
assert.equal(saved[0].updatedAt, '2026-10-12T12:00:00.000Z');
assert.equal(saved[1].title, LEGAL_DOCUMENTS[1].title);

const dom = new JSDOM('<article id="content"></article>');
globalThis.document = dom.window.document;
const content = document.querySelector('#content');
renderLegalText(content, '1. Titre de section\n\nParagraphe avec <img src=x onerror=alert(1)> littéral.\n\n- Première règle\n- Deuxième règle');
assert.equal(content.querySelectorAll('h2').length, 1);
assert.equal(content.querySelectorAll('ul li').length, 2);
assert.equal(content.querySelector('img'), null);
assert.match(content.textContent, /<img src=x onerror=alert\(1\)> littéral/);

dom.window.close();
delete globalThis.document;
console.log('Tous les contrôles des documents juridiques sont réussis.');

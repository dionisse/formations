import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../perfecto.html', import.meta.url), 'utf8');
const document = new JSDOM(html).window.document;
const sequences = [...document.querySelectorAll('.perfecto-sequence-card')];

assert.equal(sequences.length, 7, 'Le parcours Perfecto doit comporter exactement 7 séquences.');
assert.deepEqual(
  sequences.map((sequence) => sequence.querySelector('.sequence-number')?.textContent.trim()),
  ['01', '02', '03', '04', '05', '06', '07'],
  'Les séquences doivent être numérotées dans l’ordre.'
);

for (const [index, sequence] of sequences.entries()) {
  assert.ok(sequence.querySelector('h3'), `La séquence ${index + 1} doit avoir un titre.`);
  assert.ok(sequence.querySelector('.sequence-exercise'), `La séquence ${index + 1} doit proposer un exercice Perfecto.`);
  const expected = sequence.querySelector('.sequence-verification ul');
  assert.ok(expected, `La séquence ${index + 1} doit présenter des résultats vérifiables.`);
  assert.ok(expected.querySelectorAll('li').length >= 2, `La séquence ${index + 1} doit avoir au moins deux contrôles de sortie.`);
}

const bodyText = document.body.textContent.replace(/\s+/g, ' ');
for (const phrase of [
  'dossier-école',
  'la version et la licence',
  'taux pédagogique',
  'Crédit théorique : 396 000 FCFA',
  '7 000 000 FCFA',
  'vente au comptant de 1 000 000 FCFA',
  '20/01/N ne fixe pas à elle seule la date de mise en service',
  'Banque 5211 = 16 450 000 FCFA',
  'Stock final : 2 000 000 FCFA'
]) {
  assert.ok(bodyText.toLowerCase().includes(phrase.toLowerCase()), `Le parcours doit préciser : ${phrase}`);
}

const dayCards = document.querySelectorAll('.perfecto-day-grid article');
assert.equal(dayCards.length, 3, 'L’organisation proposée doit couvrir trois journées.');
assert.equal(document.querySelectorAll('.perfecto-assessment-list li').length, 5, 'L’évaluation doit présenter les cinq critères annoncés.');

const vatSales = 4_000_000 * 0.18;
const vatPurchases = 5_000_000 * 0.18;
const vatAsset = 1_200_000 * 0.18;
assert.equal(vatSales, 720_000);
assert.equal(vatPurchases + vatAsset - vatSales, 396_000, 'Le crédit de TVA pédagogique doit être arithmétiquement cohérent.');

const bankClosing = 20_000_000 + 2_000_000 - 2_000_000 - 3_000_000 - 500_000 - 50_000;
assert.equal(bankClosing, 16_450_000, 'Le solde bancaire attendu doit être cohérent avec les flux retenus.');

console.log('Tous les contrôles du programme Perfecto sont réussis.');

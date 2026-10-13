import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../perfecto.html', import.meta.url), 'utf8');
const catalogue = readFileSync(new URL('../plateforme.js', import.meta.url), 'utf8');
const document = new JSDOM(html).window.document;
const sequences = [...document.querySelectorAll('.perfecto-sequence-card')];

assert.equal(sequences.length, 7, 'Le parcours Perfecto doit comporter exactement 7 séquences.');
assert.deepEqual(
  sequences.map((sequence) => sequence.querySelector('.sequence-number')?.textContent.trim()),
  ['01', '02', '03', '04', '05', '06', '07'],
  'Les séquences doivent être numérotées dans l’ordre.'
);

for (const [index, sequence] of sequences.entries()) {
  const number = index + 1;
  assert.ok(sequence.querySelector('h3'), `La séquence ${number} doit avoir un titre.`);
  assert.ok(sequence.querySelector('.sequence-exercise'), `La séquence ${number} doit proposer un exercice Perfecto.`);
  const expected = sequence.querySelector('.sequence-verification ul');
  assert.ok(expected, `La séquence ${number} doit présenter des résultats vérifiables.`);
  assert.ok(expected.querySelectorAll('li').length >= 2, `La séquence ${number} doit avoir au moins deux contrôles de sortie.`);

  const workshop = sequence.querySelector('.perfecto-deep-dive');
  assert.ok(workshop, `La séquence ${number} doit avoir un atelier approfondi.`);
  assert.ok(workshop.open, `L’atelier de la séquence ${number} doit être visible par défaut.`);
  assert.ok(workshop.querySelector('.deep-dive-intro'), `La séquence ${number} doit présenter une mise en situation.`);
  assert.ok(workshop.querySelector('.deep-dive-panel ol li'), `La séquence ${number} doit guider le travail pratique étape par étape.`);
  assert.ok(workshop.querySelector('.deep-expert-note p')?.textContent.trim().length >= 160, `La séquence ${number} doit contenir une explication d’expert substantielle.`);
  assert.ok(workshop.querySelector('.deep-dive-output'), `La séquence ${number} doit finir par un livrable ou un contrôle de sortie.`);
  assert.ok(workshop.textContent.trim().length >= 1100, `L’atelier de la séquence ${number} doit être suffisamment développé.`);
}

const bodyText = document.body.textContent.replace(/\s+/g, ' ');
for (const phrase of [
  'cas professionnel reconstitué, réaliste',
  'aucune pièce d’un client réel n’a été fournie',
  'le format approfondi recommandé compte 28 heures',
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

const workshopHours = sequences.map((sequence) => Number(sequence.querySelector('.deep-dive-time')?.textContent.match(/·\s*(\d+)\s*H/)?.[1]));
assert.deepEqual(workshopHours, [3, 4, 3, 4, 3, 4, 7], 'Les durées d’atelier doivent correspondre à la progression proposée.');
assert.equal(workshopHours.reduce((sum, hours) => sum + hours, 0), 28, 'Les sept ateliers doivent totaliser 28 heures.');
const dayCards = [...document.querySelectorAll('.perfecto-day-grid article')];
assert.equal(dayCards.length, 4, 'Le format approfondi doit prévoir quatre journées.');
assert.ok(dayCards.every((day) => day.textContent.includes('7 H')), 'Chaque journée approfondie doit représenter 7 heures.');
assert.match(catalogue, /7 séquences · 28 h · 4 jours recommandés/, 'Le catalogue doit afficher la durée approfondie.');
assert.equal(document.querySelectorAll('.perfecto-assessment-list li').length, 5, 'L’évaluation doit présenter les cinq critères annoncés.');

const vatSales = 4_000_000 * 0.18;
const vatPurchases = 5_000_000 * 0.18;
const vatAsset = 1_200_000 * 0.18;
assert.equal(vatSales, 720_000);
assert.equal(vatPurchases + vatAsset - vatSales, 396_000, 'Le crédit de TVA pédagogique doit être arithmétiquement cohérent.');

const bankClosing = 20_000_000 + 2_000_000 - 2_000_000 - 3_000_000 - 500_000 - 50_000;
assert.equal(bankClosing, 16_450_000, 'Le solde bancaire attendu doit être cohérent avec les flux retenus.');

console.log('Les 7 ateliers approfondis, leurs explications et contrôles sont cohérents.');

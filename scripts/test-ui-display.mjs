/* test-ui-display — non-régression des affichages signalés sur les captures mobiles :
   dépliage des séquences, rendu des cas pratiques et des QCM, états masqués,
   empilement des cheminement et carte ressources. Les tests exécutent la vraie
   page (formation-fiscale.html + script.js) dans un DOM jsdom et contrôlent aussi les
   garde-fous CSS qui ne peuvent pas être simulés sans moteur de mise en page. */

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('formation-fiscale.html', root), 'utf8');
const script = readFileSync(new URL('script.js', root), 'utf8');
const css = readFileSync(new URL('styles.css', root), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:4173/formation-fiscale.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

/* API de défilement absentes de jsdom : le script les appelle au clic. */
window.Element.prototype.scrollIntoView = () => {};
window.scrollTo = () => {};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  });
}

/* Comptage structurel des écouteurs de clic : un seul gestionnaire par bouton de
   séquence et par étape de rail. Deux gestionnaires concurrents se neutralisent
   selon l'ordre d'invocation (différent entre navigateurs) : le conflit historique
   « les séquences ne se déplient pas » venait de là. */
const clickListeners = new Map();
const nativeAddEventListener = window.EventTarget.prototype.addEventListener;
window.EventTarget.prototype.addEventListener = function register(type, listener, options) {
  if (type === 'click' && typeof this.closest === 'function') {
    const owner = this.closest('.sequence-toggle, .rail-step');
    if (owner) clickListeners.set(owner, (clickListeners.get(owner) || 0) + 1);
  }
  return nativeAddEventListener.call(this, type, listener, options);
};

let failures = 0;
function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`OK    ${label}`);
    return;
  }
  failures += 1;
  console.log(`ÉCHEC ${label}${detail ? ` — ${detail}` : ''}`);
}

function click(element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

window.eval(script);

/* 0. Un seul gestionnaire de clic par bouton de séquence et par étape de rail. */
const toggles = [...document.querySelectorAll('.sequence-toggle')];
ok('la page contient 7 boutons de séquence', toggles.length === 7, `${toggles.length} trouvés`);
ok(
  'chaque bouton de séquence porte exactement un gestionnaire de clic',
  toggles.every((toggle) => clickListeners.get(toggle) === 1),
  toggles.map((toggle) => clickListeners.get(toggle) || 0).join(',')
);
const railSteps = [...document.querySelectorAll('.rail-step')];
ok(
  'chaque étape du rail porte exactement un gestionnaire de clic',
  railSteps.length === 7 && railSteps.every((step) => clickListeners.get(step) === 1),
  railSteps.map((step) => clickListeners.get(step) || 0).join(',')
);

/* 1. Dépliage des séquences : le bouton « + » doit ouvrir une carte repliée. */
const card2 = document.querySelector('[data-sequence-card="2"]');
const toggle2 = card2?.querySelector('.sequence-toggle');
ok('la carte de séquence 2 existe dans la page', Boolean(card2 && toggle2));

click(toggle2);
ok('cliquer sur le bouton d’une séquence repliée la déplie', card2.classList.contains('open'));
ok('aria-expanded passe à true au dépliage', toggle2.getAttribute('aria-expanded') === 'true');

click(toggle2);
ok('recliquer sur le bouton replie la séquence', !card2.classList.contains('open'));
ok('aria-expanded revient à false au repliage', toggle2.getAttribute('aria-expanded') === 'false');

const card1 = document.querySelector('[data-sequence-card="1"]');
const toggle1 = card1?.querySelector('.sequence-toggle');
click(toggle1);
ok('la séquence active se replie depuis son bouton', !card1.classList.contains('open'));
click(toggle1);
ok('la séquence active se déplie à nouveau', card1.classList.contains('open'));

/* L'aperçu d'une séquence verrouillée s'ouvre sans fermer la séquence en cours ;
   l'accordéon (une seule carte ouverte) s'applique aux séquences déverrouillées. */
click(toggle2);
ok('l’aperçu d’une séquence verrouillée s’ouvre sans fermer la séquence en cours', card2.classList.contains('open') && card1.classList.contains('open'));
click(toggle2);
ok('l’aperçu d’une séquence verrouillée se referme', !card2.classList.contains('open') && card1.classList.contains('open'));

/* 2. Atelier « cas pratique » : les trois réponses doivent être rendues. */
const scenarioOptions = document.querySelectorAll('#scenario-options .scenario-option');
ok('l’atelier réflexe affiche ses 3 réponses', scenarioOptions.length === 3, `${scenarioOptions.length} trouvées`);
ok('l’atelier n’affiche pas de chargement bloqué', !document.querySelector('#scenario-question')?.textContent.includes('Chargement'));

/* 3. QCM : chaque questionnaire doit rendre ses questions. */
const quizContainers = [
  ['quiz-questions', '#sequence-quiz'],
  ['quiz-questions-2', '#sequence-quiz-2'],
  ['quiz-questions-3', '#sequence-quiz-3'],
  ['quiz-questions-4', '#sequence-quiz-4'],
  ['quiz-questions-5', '#sequence-quiz-5'],
  ['quiz-questions-7', '#sequence-quiz-7'],
  ['final-quiz-questions', '#final-quiz']
];
for (const [containerId, formSelector] of quizContainers) {
  const container = document.getElementById(containerId);
  const questions = container ? container.querySelectorAll('.quiz-question') : [];
  ok(`QCM ${containerId} : questions rendues`, container && questions.length >= 8, `${questions.length} question(s)`);
  const form = document.querySelector(formSelector);
  ok(`QCM ${containerId} : formulaire présent`, Boolean(form));
}

/* 4. Les panneaux de résultat et boutons à état hidden doivent démarrer masqués. */
const hiddenResults = [...document.querySelectorAll('.quiz-result')];
ok('des panneaux de résultat QCM existent', hiddenResults.length >= 7, `${hiddenResults.length} trouvés`);
ok('tous les panneaux de résultat sont masqués avant validation', hiddenResults.every((node) => node.hasAttribute('hidden')));
ok('le bouton « Cas suivant » démarre masqué', document.querySelector('#next-case')?.hasAttribute('hidden') === true);

/* 5. Garde-fous CSS : hidden respecté et cheminement empilés sur mobile. */
ok('CSS : [hidden] reste toujours masqué (display:none !important)', /\[hidden\]\{display:none!important\}/.test(css));
ok(
  'CSS : les cheminement mobiles sont empilés (flex !important, plus de colonne de 20 px)',
  /display:flex!important;flex-direction:column!important;grid-template-columns:none!important/.test(css)
);
ok(
  'CSS : les cartes ressources réservent la place du lien (pas de chevauchement)',
  /\.resource-card\{[^}]*padding:25px 22px 74px/.test(css)
);

/* 6. Parcours guidé : verrouillage progressif cohérent. */
const guidedBanner = document.querySelector('#guided-banner');
ok('le parcours guidé est présent', Boolean(guidedBanner));
const card7 = document.querySelector('[data-sequence-card="7"]');
ok('une séquence verrouillée porte la classe preview-only', card7.classList.contains('preview-only'));

if (failures > 0) {
  console.log(`\n${failures} échec(s) sur les affichages.`);
  process.exit(1);
}
console.log('\nTous les contrôles d’affichage sont réussis.');

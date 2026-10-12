import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../home.js', import.meta.url), 'utf8');
const home = new JSDOM(html, {
  url: 'http://localhost:4173/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const homeDocument = home.window.document;

assert.match(homeDocument.title, /Fiscalité/);
assert.match(homeDocument.body.textContent, /Afrique de l’Ouest/);
assert.match(homeDocument.querySelector('.home-brand')?.textContent || '', /Fiscalité/);
assert.equal(homeDocument.querySelectorAll('main > .home-hero').length, 1);
assert.equal(homeDocument.querySelectorAll('main > .home-catalogue').length, 1);
assert.equal(homeDocument.querySelectorAll('.course-stage, .sequence-card, .quiz-form, #guided-banner').length, 0, 'le contenu pédagogique ne doit pas apparaître sur l’accueil');
assert.match(homeDocument.querySelector('#catalogue-title')?.textContent || '', /Formations et programmes/);
assert.ok(homeDocument.querySelector('#course-search'));
assert.equal(homeDocument.querySelectorAll('[data-course-filter]').length, 3);

const cards = [...homeDocument.querySelectorAll('.home-course-card')];
assert.equal(cards.length, 2, 'les deux fiches du catalogue GOBEX doivent être visibles');
assert.match(cards[0].querySelector('.home-course-kicker')?.textContent || '', /FORMATION PROFESSIONNELLE/);
assert.match(cards[0].querySelector('.home-course-kicker')?.textContent || '', /FISCALITÉ/);
assert.match(cards[1].querySelector('.home-course-kicker')?.textContent || '', /PROGRAMME/);
assert.match(cards[1].querySelector('.home-course-kicker')?.textContent || '', /PERFECTO/);
assert.equal(cards[0].querySelector('.home-course-footer a')?.getAttribute('href'), '/formation-fiscale.html#programme');
assert.equal(cards[1].querySelector('.home-course-footer a')?.getAttribute('href'), '/perfecto.html');
assert.equal(homeDocument.querySelectorAll('.home-course-payment').length, 0, 'les fiches d’accueil restent des liens vers les parcours');

home.window.eval(script);
const click = (element) => element.dispatchEvent(new home.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const search = homeDocument.querySelector('#course-search');
const allFilter = homeDocument.querySelector('[data-course-filter="all"]');
const formationFilter = homeDocument.querySelector('[data-course-filter="formation"]');
const programmeFilter = homeDocument.querySelector('[data-course-filter="programme"]');

click(formationFilter);
assert.equal(cards[0].hidden, false);
assert.equal(cards[1].hidden, true);
assert.equal(formationFilter.getAttribute('aria-pressed'), 'true');
assert.match(homeDocument.querySelector('#course-result-count')?.textContent || '', /01 parcours/);

click(allFilter);
search.value = 'Fiscalite';
search.dispatchEvent(new home.window.Event('input', { bubbles: true }));
assert.equal(cards[0].hidden, false, 'la recherche doit ignorer les accents');
assert.equal(cards[1].hidden, true);

search.value = 'terme introuvable';
search.dispatchEvent(new home.window.Event('input', { bubbles: true }));
assert.equal(homeDocument.querySelector('#course-empty-state')?.hidden, false);
assert.match(homeDocument.querySelector('#course-result-count')?.textContent || '', /00 parcours/);

search.value = '';
search.dispatchEvent(new home.window.Event('input', { bubbles: true }));
click(programmeFilter);
assert.equal(cards[0].hidden, true);
assert.equal(cards[1].hidden, false);

const menuToggle = homeDocument.querySelector('.home-menu-toggle');
const homeNav = homeDocument.querySelector('#home-nav');
click(menuToggle);
assert.equal(homeNav.classList.contains('is-open'), true);
assert.equal(menuToggle.getAttribute('aria-expanded'), 'true');
click(homeNav.querySelector('a'));
assert.equal(homeNav.classList.contains('is-open'), false);
assert.equal(menuToggle.getAttribute('aria-expanded'), 'false');

const fiscalCourse = new JSDOM(readFileSync(new URL('../formation-fiscale.html', import.meta.url), 'utf8'));
const courseDocument = fiscalCourse.window.document;
assert.ok(courseDocument.querySelector('.course-stage[data-course-version="formation-fiscale-v1"]'));
assert.ok(courseDocument.querySelector('#programme'));
assert.equal(courseDocument.querySelectorAll('.sequence-card').length, 7);
assert.equal(courseDocument.querySelector('.home-catalogue'), null, 'la fiche de formation ne doit pas reproduire le catalogue d’accueil');
assert.match(courseDocument.querySelector('.brand-name')?.textContent || '', /Fiscalité/);

home.window.close();
fiscalCourse.window.close();
console.log('Le catalogue d’accueil, ses filtres et les pages de parcours sont correctement séparés.');

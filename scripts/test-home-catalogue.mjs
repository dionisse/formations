import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const home = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
const homeDocument = home.window.document;

assert.match(homeDocument.title, /Fiscalité/);
assert.equal(homeDocument.documentElement.classList.contains('course-gated'), false);
assert.equal(homeDocument.querySelectorAll('main > *').length, 1, 'la page d’accueil ne doit contenir que la section catalogue');
assert.equal(homeDocument.querySelectorAll('main > .home-course-catalogue').length, 1);
assert.equal(homeDocument.querySelectorAll('.course-stage, .sequence-card, .quiz-form, #guided-banner').length, 0, 'le contenu pédagogique ne doit pas apparaître sur l’accueil');
assert.equal(homeDocument.querySelectorAll('.course-process-steps').length, 0);
assert.match(homeDocument.querySelector('#home-course-catalogue-title')?.textContent || '', /Programmes et formations/);

const cards = [...homeDocument.querySelectorAll('.home-course-card')];
assert.equal(cards.length, 2, 'les deux fiches du catalogue GOBEX doivent être visibles');
assert.match(cards[0].querySelector('.home-course-category')?.textContent || '', /FISCALITÉ/);
assert.match(cards[1].querySelector('.home-course-category')?.textContent || '', /PERFECTO/);
assert.equal(cards[0].querySelector('.home-course-start')?.getAttribute('href'), '/formation-fiscale.html#programme');
assert.equal(cards[1].querySelector('.home-course-start')?.getAttribute('href'), '/perfecto.html');
assert.equal(homeDocument.querySelectorAll('.home-course-payment').length, 0, 'les fiches d’accueil restent des liens vers le contenu des parcours');
assert.ok(homeDocument.querySelector('.main-nav a[href="#catalogue-formations"]'));

const fiscalCourse = new JSDOM(readFileSync(new URL('../formation-fiscale.html', import.meta.url), 'utf8'));
const courseDocument = fiscalCourse.window.document;
assert.ok(courseDocument.querySelector('.course-stage[data-course-version="formation-fiscale-v1"]'));
assert.ok(courseDocument.querySelector('#programme'));
assert.equal(courseDocument.querySelectorAll('.sequence-card').length, 7);
assert.equal(courseDocument.querySelector('.home-course-catalogue'), null, 'la fiche de formation ne doit pas reproduire le catalogue d’accueil');
assert.match(courseDocument.querySelector('.brand-name')?.textContent || '', /Fiscalité/);

home.window.close();
fiscalCourse.window.close();
console.log('Le catalogue d’accueil et les pages de parcours sont correctement séparés.');



/* Protection de copie : elle bloque les gestes courants sans empêcher la saisie dans les formulaires. */
(() => {
  const isEditable = (target) => target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  const preventContentAction = (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  };
  ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach((eventName) => {
    document.addEventListener(eventName, preventContentAction, true);
  });
  document.addEventListener('keydown', (event) => {
    if (isEditable(event.target)) return;
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'x'].includes(event.key.toLowerCase())) event.preventDefault();
  }, true);
  document.querySelectorAll('img').forEach((image) => { image.draggable = false; });
})();

const isMobileCourseViewport = () => {
  const narrowViewport = window.innerWidth <= 820 || (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 820px)').matches);
  const touchDevice = Number(navigator.maxTouchPoints || 0) > 0 || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
  const phoneLandscape = touchDevice && Math.max(window.innerWidth, window.innerHeight) <= 1200 && Math.min(window.innerWidth, window.innerHeight) <= 700;
  return narrowViewport || phoneLandscape;
};

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const backToTop = document.querySelector('.back-to-top');

menuToggle?.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.main-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

const sequenceCards = [...document.querySelectorAll('.sequence-card')];
const railSteps = [...document.querySelectorAll('.rail-step')];
const railProgress = document.querySelector('.rail-progress');

function activateSequence(number, scrollToCard = false) {
  const card = document.querySelector(`[data-sequence-card="${number}"]`);
  if (!card) return;
  railSteps.forEach((step) => step.classList.toggle('active', step.dataset.sequence === String(number)));
  const activeIndex = Math.max(0, Number(number) - 1);
  if (railProgress) {
    railProgress.style.height = window.innerWidth <= 820 ? '2px' : `${Math.min(100, activeIndex * 16.5 + 5)}%`;
    railProgress.style.width = window.innerWidth <= 820 ? `${Math.min(100, activeIndex * 16.5 + 5)}%` : '2px';
  }
  if (scrollToCard) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

sequenceCards.forEach((card) => {
  const toggle = card.querySelector('.sequence-toggle');
  toggle?.addEventListener('click', () => {
    const willOpen = !card.classList.contains('open');
    sequenceCards.forEach((other) => {
      other.classList.remove('open');
      other.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', 'false');
    });
    if (willOpen) {
      card.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      activateSequence(card.dataset.sequenceCard);
    }
  });
});

railSteps.forEach((step) => {
  step.addEventListener('click', () => {
    const number = step.dataset.sequence;
    const card = document.querySelector(`[data-sequence-card="${number}"]`);
    sequenceCards.forEach((other) => {
      other.classList.remove('open');
      other.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', 'false');
    });
    card?.classList.add('open');
    card?.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', 'true');
    activateSequence(number, true);
  });
});

const observedSections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.main-nav a')];
if (typeof window.IntersectionObserver === 'function') {
  try {
    const sectionObserver = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    observedSections.forEach((section) => sectionObserver.observe(section));
  } catch (error) {
    /* Un navigateur mobile peut exposer l’API sans pouvoir l’instancier. */
  }
}

window.addEventListener('scroll', () => {
  backToTop?.classList.toggle('visible', window.scrollY > 500);
}, { passive: true });
backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

window.addEventListener('resize', () => {
  const current = document.querySelector('.rail-step.active')?.dataset.sequence || '1';
  activateSequence(current);
});

activateSequence('1');

const roleWorkshop = document.querySelector('#atelier-roles');
if (roleWorkshop) {
  const scenarios = [
    {
      question: 'Une pièce manque au dossier et bloque votre contrôle. Qui doit être alerté en premier ?',
      options: [['Le client directement', 'client'], ['Le Chef de mission', 'chef'], ['Personne, on avance quand même', 'personne']],
      answer: 'chef',
      success: 'Exact. L’assistant fait remonter toute difficulté au Chef de mission, qui organise la suite et décide de l’escalade nécessaire.'
    },
    {
      question: 'Le planning et le budget d’une nouvelle mission doivent être préparés. Qui en prend la responsabilité ?',
      options: [['Le Directeur de mission', 'directeur'], ['Le Stagiaire', 'stagiaire'], ['Le personnel administratif seul', 'admin']],
      answer: 'directeur',
      success: 'Exact. Le Directeur de mission transforme le besoin en planning, ressources et livrables, puis le fait approuver au bon niveau.'
    },
    {
      question: 'Une réunion client doit être confirmée et les rapports mis en forme. Qui apporte son appui ?',
      options: [['L’Assistant uniquement', 'assistant'], ['Le Secrétaire / personnel administratif', 'admin'], ['Le Stagiaire seul', 'stagiaire']],
      answer: 'admin',
      success: 'Exact. L’appui administratif fluidifie les rendez-vous, les courriers, la mise en forme et la circulation des informations.'
    }
  ];
  const count = roleWorkshop.querySelector('#scenario-count');
  const question = roleWorkshop.querySelector('#scenario-question');
  const options = roleWorkshop.querySelector('#scenario-options');
  const feedback = roleWorkshop.querySelector('#scenario-feedback');
  const nextCase = roleWorkshop.querySelector('#next-case');
  const dots = roleWorkshop.querySelector('#scenario-dots');
  let currentScenario = 0;

  function renderScenario() {
    const scenario = scenarios[currentScenario];
    count.textContent = `CAS ${String(currentScenario + 1).padStart(2, '0')} / ${String(scenarios.length).padStart(2, '0')}`;
    question.textContent = scenario.question;
    feedback.textContent = '';
    feedback.className = 'scenario-feedback';
    nextCase.hidden = true;
    nextCase.innerHTML = currentScenario === scenarios.length - 1 ? 'Rejouer l’atelier <span>↻</span>' : 'Cas suivant <span>→</span>';
    options.innerHTML = scenario.options.map(([label, value]) => `<button class="scenario-option" type="button" data-answer="${value}">${label}</button>`).join('');
    dots.innerHTML = scenarios.map((_, index) => `<span class="scenario-dot ${index === currentScenario ? 'active' : index < currentScenario ? 'done' : ''}"></span>`).join('');
    options.querySelectorAll('.scenario-option').forEach((option) => {
      option.addEventListener('click', () => {
        if (option.dataset.answer === scenario.answer) {
          option.classList.add('correct');
          options.querySelectorAll('.scenario-option').forEach((button) => { button.disabled = true; });
          feedback.textContent = scenario.success;
          feedback.classList.add('success');
          nextCase.hidden = false;
        } else {
          option.classList.add('wrong');
          feedback.textContent = 'Pas tout à fait. Relisez le périmètre de ce rôle et essayez encore.';
          feedback.classList.add('error');
        }
      });
    });
  }

  nextCase.addEventListener('click', () => {
    currentScenario = (currentScenario + 1) % scenarios.length;
    renderScenario();
  });
  renderScenario();
}

const quizForm = document.querySelector('#sequence-quiz');
if (quizForm) {
  const quizData = [
    { question: 'Dans une mission fiscale, la fiscalité doit être comprise comme…', options: ['Une simple formalité déclarative', 'Un sujet qui touche aussi les opérations, la paie et les décisions de gestion', 'Une tâche réservée au personnel administratif', 'Une activité indépendante de l’entreprise'], answer: 1, explanation: 'La fiscalité concerne les opérations, la paie, la trésorerie, les relations commerciales et les décisions de gestion.' },
    { question: 'Quel est l’un des objectifs du séminaire ?', options: ['Travailler sans planning', 'Éviter toute supervision', 'Partager un cadre de travail commun', 'Limiter la documentation'], answer: 2, explanation: 'Le séminaire vise notamment à partager un cadre commun, renforcer les réflexes et structurer les travaux.' },
    { question: 'Qui coordonne les activités techniques et administratives du cabinet ?', options: ['Le Gérant / l’Associé', 'Le Stagiaire', 'L’Assistant', 'Le Secrétaire uniquement'], answer: 0, explanation: 'Le Gérant ou l’Associé coordonne les activités techniques et administratives et veille au respect des procédures.' },
    { question: 'Qui prépare le planning d’une mission et le fait approuver par l’Associé ou le Gérant ?', options: ['Le Stagiaire', 'Le Directeur de mission', 'Le client', 'Le personnel administratif'], answer: 1, explanation: 'Le Directeur de mission prépare le planning, organise les ressources et le fait approuver au bon niveau.' },
    { question: 'Quel est le rôle central du Chef de mission ?', options: ['Remplacer systématiquement le Gérant', 'Superviser et contrôler les travaux des assistants', 'Gérer seul la relation commerciale', 'Ne jamais former les membres de l’équipe'], answer: 1, explanation: 'Le Chef de mission organise le travail quotidien, supervise les assistants et contrôle la qualité des travaux.' },
    { question: 'Lorsqu’un Assistant rencontre une difficulté dans une mission, il doit…', options: ['La garder pour lui', 'Contacter directement le client sans validation', 'La signaler au Chef de mission', 'Demander au Stagiaire de décider'], answer: 2, explanation: 'L’Assistant rend compte au Chef de mission de toutes les difficultés relatives aux travaux exécutés.' },
    { question: 'Quelle règle s’applique au Stagiaire ?', options: ['Il entretient directement la relation avec le client', 'Il accède à toutes les informations du cabinet', 'Il respecte le secret et la discrétion professionnels', 'Il réalise seul les missions complexes'], answer: 2, explanation: 'Le Stagiaire travaille dans un périmètre défini et est tenu au respect du secret professionnel et de la discrétion.' },
    { question: 'Pour commencer une planification utile, il faut d’abord…', options: ['Ouvrir plusieurs dossiers en même temps', 'Choisir la période et le résultat attendu', 'Attendre que l’urgence apparaisse', 'Supprimer les temps de revue'], answer: 1, explanation: 'On choisit un horizon de planification puis on définit le résultat, le livrable et l’échéance.' },
    { question: 'Dans une mission fiscale, une bonne priorité tient compte notamment de…', options: ['L’urgence seulement', 'L’impact, l’urgence, le risque, les dépendances et la rentabilité', 'La tâche la plus facile', 'L’ordre d’arrivée des e-mails uniquement'], answer: 1, explanation: 'La priorité se décide en croisant urgence, impact, risque, dépendance et rentabilité.' },
    { question: 'Pourquoi faut-il prévoir un temps de réserve dans l’agenda ?', options: ['Pour remplir le calendrier', 'Pour absorber les imprévus, retours et validations sans désorganiser la mission', 'Pour éviter d’imputer les temps', 'Pour supprimer les échanges d’équipe'], answer: 1, explanation: 'Une marge protège la mission contre les pièces manquantes, les demandes urgentes et les validations complémentaires.' }
  ];
  const questionsContainer = document.querySelector('#quiz-questions');
  const progressLabel = document.querySelector('#quiz-progress-label');
  const progressBar = document.querySelector('#quiz-progress-bar');
  const message = document.querySelector('#quiz-form-message');
  const submit = document.querySelector('#quiz-submit');
  const result = document.querySelector('#quiz-result');
  const resultScore = document.querySelector('#quiz-result-score');
  const resultMessage = document.querySelector('#quiz-result-message');
  const correctCount = document.querySelector('#quiz-correct-count');
  const review = document.querySelector('#quiz-review-list');
  const reset = document.querySelector('#quiz-reset');

  function renderQuiz() {
    questionsContainer.innerHTML = quizData.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    questionsContainer.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateQuizProgress));
    updateQuizProgress();
  }

  function updateQuizProgress() {
    const answered = quizData.filter((_, index) => quizForm.querySelector(`input[name="question-${index}"]:checked`)).length;
    progressLabel.textContent = `${answered} / ${quizData.length} répondues`;
    progressBar.style.width = `${answered / quizData.length * 100}%`;
  }

  function showQuizResult() {
    const answers = quizData.map((_, index) => quizForm.querySelector(`input[name="question-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      message.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      message.className = 'quiz-form-message';
      const firstMissing = answers.findIndex((answer) => !answer);
      quizForm.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    quizData.forEach((item, index) => {
      const selected = Number(answers[index].value);
      const options = quizForm.querySelectorAll(`input[name="question-${index}"]`);
      options.forEach((input) => {
        input.disabled = true;
        const optionLabel = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) optionLabel.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) optionLabel.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    const score = correct * 2;
    resultScore.innerHTML = `${score}<span>/20</span>`;
    correctCount.textContent = `${correct} / ${quizData.length} bonnes réponses`;
    resultMessage.textContent = score >= 16 ? 'Très bon résultat. Vos réflexes sont bien installés.' : score >= 10 ? 'Les bases sont là. Relisez les points de vigilance avant de poursuivre.' : 'Prenez le temps de revoir les rôles et la méthode de planification avant la suite.';
    review.innerHTML = quizData.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    message.textContent = 'Évaluation terminée. Consultez la correction commentée ci-dessous.';
    message.className = 'quiz-form-message success';
    submit.disabled = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quizForm.addEventListener('submit', (event) => { event.preventDefault(); showQuizResult(); });
  reset.addEventListener('click', () => { quizForm.reset(); quizForm.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); submit.disabled = false; result.hidden = true; message.textContent = ''; message.className = 'quiz-form-message'; renderQuiz(); quizForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderQuiz();
}

const quizForm2 = document.querySelector('#sequence-quiz-2');
if (quizForm2) {
  const quizData2 = [
    { question: 'Quel est le point de départ d’une mission de revue fiscale ?', options: ['Commencer immédiatement les tests', 'Comprendre le besoin, le périmètre et les livrables', 'Archiver les pièces anciennes', 'Rédiger le rapport final'], answer: 1, explanation: 'Une mission solide commence par un cadrage partagé : besoin, période, impôts, entités, livrables et responsabilités.' },
    { question: 'Avant de planifier les travaux, il est essentiel de vérifier…', options: ['Uniquement le nombre de collaborateurs', 'Les travaux antérieurs, les changements et les contrôles en cours', 'La couleur du dossier', 'Le nombre de réunions prévues'], answer: 1, explanation: 'Les travaux précédents et les changements significatifs permettent d’orienter l’analyse des risques.' },
    { question: 'Que contient principalement le dossier permanent ?', options: ['Les seuls e-mails de la période', 'Les informations durables sur l’entreprise, son organisation et ses obligations', 'Uniquement les feuilles de temps', 'Les réponses du questionnaire final'], answer: 1, explanation: 'Le dossier permanent conserve les informations de référence qui expliquent l’entreprise et doivent être actualisées lorsqu’elles évoluent.' },
    { question: 'Une approche par les risques consiste à…', options: ['Contrôler toutes les opérations de la même façon', 'Concentrer les travaux sur les zones à impact ou probabilité élevés', 'Éviter les tests documentés', 'Ne travailler que sur les demandes du client'], answer: 1, explanation: 'L’approche par les risques permet de concentrer les ressources sur les zones sensibles et les conséquences les plus importantes.' },
    { question: 'Une feuille de travail de qualité doit permettre de retrouver…', options: ['Seulement le nom de l’auditeur', 'Le test réalisé, la preuve examinée et la conclusion', 'Le budget du cabinet uniquement', 'Une opinion non documentée'], answer: 1, explanation: 'La feuille de travail doit rendre le raisonnement traçable : objectif, travaux, preuve, résultat et conclusion.' },
    { question: 'Pour qualifier un constat, il est utile de documenter…', options: ['Le fait, la règle, la cause, la conséquence et l’action', 'Uniquement la conséquence supposée', 'La préférence personnelle de l’auditeur', 'Seulement la date du contrôle'], answer: 0, explanation: 'Cette logique permet de distinguer ce qui est observé, ce qui devrait être, pourquoi l’écart existe et comment le traiter.' },
    { question: 'La finalisation d’une mission comprend notamment…', options: ['La suppression des points en suspens', 'La revue de supervision, la validation des faits et la restitution', 'L’arrêt des échanges avec le client', 'Le remplacement des preuves par des commentaires'], answer: 1, explanation: 'La finalisation consiste à solder les points, faire relire, valider les faits, hiérarchiser les risques et restituer.' },
    { question: 'Une recommandation est réellement pilotable lorsqu’elle comporte…', options: ['Une formulation générale uniquement', 'Un responsable, une échéance et une preuve attendue', 'Un long commentaire sans action', 'Une nouvelle mission automatique'], answer: 1, explanation: 'Le responsable, la date et la preuve permettent de vérifier objectivement la prise en compte de l’action.' },
    { question: 'Le suivi des recommandations précédentes sert à…', options: ['Répéter le rapport précédent', 'Vérifier la mise en œuvre et réévaluer le risque résiduel', 'Éviter toute nouvelle analyse', 'Fermer automatiquement les écarts'], answer: 1, explanation: 'Le suivi transforme les recommandations en actions vérifiables et réinjecte les enseignements dans la nouvelle analyse des risques.' },
    { question: 'Quel rapprochement est particulièrement utile lors d’une revue fiscale ?', options: ['Comptabilité, déclarations, pièces justificatives et paiements', 'Agenda personnel et météo', 'Liste des congés uniquement', 'Logo et papier à en-tête'], answer: 0, explanation: 'Le rapprochement de ces sources permet de vérifier la cohérence entre les opérations, les enregistrements, les déclarations et les règlements.' }
  ];
  const questions2 = document.querySelector('#quiz-questions-2');
  const progressLabel2 = document.querySelector('#quiz-progress-label-2');
  const progressBar2 = document.querySelector('#quiz-progress-bar-2');
  const message2 = document.querySelector('#quiz-form-message-2');
  const submit2 = document.querySelector('#quiz-submit-2');
  const result2 = document.querySelector('#quiz-result-2');
  const resultScore2 = document.querySelector('#quiz-result-score-2');
  const resultMessage2 = document.querySelector('#quiz-result-message-2');
  const correctCount2 = document.querySelector('#quiz-correct-count-2');
  const review2 = document.querySelector('#quiz-review-list-2');
  const reset2 = document.querySelector('#quiz-reset-2');

  function renderQuiz2() {
    questions2.innerHTML = quizData2.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-2-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    questions2.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateQuiz2));
    updateQuiz2();
  }

  function updateQuiz2() {
    const answered = quizData2.filter((_, index) => quizForm2.querySelector(`input[name="question-2-${index}"]:checked`)).length;
    progressLabel2.textContent = `${answered} / ${quizData2.length} répondues`;
    progressBar2.style.width = `${answered / quizData2.length * 100}%`;
  }

  function showQuizResult2() {
    const answers = quizData2.map((_, index) => quizForm2.querySelector(`input[name="question-2-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      message2.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      const firstMissing = answers.findIndex((answer) => !answer);
      quizForm2.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    quizData2.forEach((item, index) => {
      const selected = Number(answers[index].value);
      quizForm2.querySelectorAll(`input[name="question-2-${index}"]`).forEach((input) => {
        input.disabled = true;
        const label = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) label.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) label.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    const score = correct * 2;
    resultScore2.innerHTML = `${score}<span>/20</span>`;
    correctCount2.textContent = `${correct} / ${quizData2.length} bonnes réponses`;
    resultMessage2.textContent = score >= 16 ? 'Très bon résultat. Votre démarche de revue est bien structurée.' : score >= 10 ? 'Les bases sont là. Relisez les portes de contrôle avant de poursuivre.' : 'Reprenez le cycle de mission et la structure du dossier avant la suite.';
    review2.innerHTML = quizData2.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    message2.textContent = 'Évaluation terminée. Consultez la correction commentée ci-dessous.';
    message2.className = 'quiz-form-message success';
    submit2.disabled = true;
    result2.hidden = false;
    result2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quizForm2.addEventListener('submit', (event) => { event.preventDefault(); showQuizResult2(); });
  reset2.addEventListener('click', () => { quizForm2.reset(); quizForm2.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); submit2.disabled = false; result2.hidden = true; message2.textContent = ''; message2.className = 'quiz-form-message'; renderQuiz2(); quizForm2.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderQuiz2();
}

const quizForm3 = document.querySelector('#sequence-quiz-3');
if (quizForm3) {
  const quizData3 = [
    { question: 'Quel est le rôle du classeur de la séquence 03 ?', options: ['Remplacer les travaux de revue', 'Donner un accès organisé aux fichiers de chaque rubrique du dossier', 'Conserver uniquement les résultats du QCM', 'Créer automatiquement les conclusions fiscales'], answer: 1, explanation: 'Le classeur est une interface de classement et d’accès : il rapproche chaque rubrique de ses pièces, références et travaux.' },
    { question: 'Que doit-il se passer lorsqu’une rubrique est sélectionnée ?', options: ['Le système affiche uniquement sa description', 'Le système affiche les documents attendus et les fichiers déjà associés à cette rubrique', 'Le système ouvre tous les fichiers du dossier', 'Le système supprime les pièces non consultées'], answer: 1, explanation: 'La navigation par rubrique doit faire ressortir les fichiers utiles au bon endroit, sans mélanger les pièces des autres rubriques.' },
    { question: 'Quelle action est possible depuis la bibliothèque de fichiers ?', options: ['Ajouter un fichier, le consulter, le renommer, le remplacer ou le supprimer', 'Modifier le CGI directement', 'Valider automatiquement le rapport', 'Changer les données de la balance sans trace'], answer: 0, explanation: 'La bibliothèque permet de gérer les pièces du dossier. Les opérations restent distinctes de la conclusion fiscale et doivent rester traçables.' },
    { question: 'Après l’ajout d’un fichier, quelle information permet de le rattacher au bon emplacement ?', options: ['La couleur de son icône', 'L’identifiant de la rubrique et ses métadonnées de fichier', 'Le nom du navigateur', 'Le nombre de personnes connectées'], answer: 1, explanation: 'Le serveur conserve notamment la rubrique, le nom, le type, la taille, les dates et un identifiant unique.' },
    { question: 'Comment le classeur ouvre-t-il un fichier ajouté depuis le navigateur ?', options: ['En utilisant librement le chemin privé de l’ordinateur', 'En passant par une route du serveur qui sert la copie locale du dossier', 'En copiant le fichier dans le rapport final', 'En envoyant le fichier par email'], answer: 1, explanation: 'Un navigateur ne peut pas ouvrir librement un chemin file://. Le serveur conserve une copie locale et la sert après contrôle d’accès.' },
    { question: 'Quel référencement est le plus cohérent pour une pièce de la rubrique TVA ?', options: ['04.02.FT-03 ou 04.02.PJ-03-01 selon sa nature', 'DOCUMENT-1 sans autre indication', 'Le nom du collaborateur uniquement', 'Une référence différente à chaque consultation'], answer: 0, explanation: 'Une nomenclature stable relie la rubrique, le sous-dossier, la feuille de travail et la pièce justificative.' },
    { question: 'Quelle modification remplace réellement le contenu d’un fichier déjà classé ?', options: ['Renommer le fichier', 'Utiliser l’action « Remplacer » en conservant son identifiant de dossier', 'Ouvrir la rubrique sans enregistrer', 'Modifier le titre de la page'], answer: 1, explanation: 'Renommer change l’étiquette ; remplacer met à jour le contenu tout en conservant le rattachement du fichier au dossier.' },
    { question: 'Pourquoi l’identification Google est-elle distincte du classement des fichiers ?', options: ['Google sert à identifier et inscrire l’utilisateur ; les fichiers restent gérés dans l’espace de travail', 'Google valide les taux d’imposition', 'Google remplace la supervision du Directeur', 'Google supprime le besoin de référencer les pièces'], answer: 0, explanation: 'La connexion Google établit l’identité de l’utilisateur. Elle ne remplace ni le classement, ni la revue, ni la responsabilité de l’équipe.' },
    { question: 'Lorsqu’une intégration Google Drive sera activée, quelle référence devra principalement être conservée ?', options: ['Le chemin absolu du poste de l’utilisateur', 'L’identifiant Google Drive du fichier et son dossier parent', 'Le mot de passe Google', 'Une copie du token dans le navigateur'], answer: 1, explanation: 'Un service cloud se référence avec un fileId et un parentId. Les mots de passe et tokens ne doivent jamais être exposés dans l’interface.' },
    { question: 'Avant de considérer une pièce comme correctement classée, il faut vérifier que…', options: ['Elle est au bon emplacement, consultable, référencée et rattachée à une conclusion ou un suivi', 'Elle porte seulement un nom compréhensible', 'Elle est présente dans plusieurs rubriques', 'Elle a été déposée sans être revue'], answer: 0, explanation: 'La qualité du dossier associe classement, preuve retrouvable, consultation possible et utilisation dans le raisonnement de la mission.' }
  ];
  const questions3 = document.querySelector('#quiz-questions-3');
  const progressLabel3 = document.querySelector('#quiz-progress-label-3');
  const progressBar3 = document.querySelector('#quiz-progress-bar-3');
  const message3 = document.querySelector('#quiz-form-message-3');
  const submit3 = document.querySelector('#quiz-submit-3');
  const result3 = document.querySelector('#quiz-result-3');
  const resultScore3 = document.querySelector('#quiz-result-score-3');
  const resultMessage3 = document.querySelector('#quiz-result-message-3');
  const correctCount3 = document.querySelector('#quiz-correct-count-3');
  const review3 = document.querySelector('#quiz-review-list-3');
  const reset3 = document.querySelector('#quiz-reset-3');

  function renderQuiz3() {
    questions3.innerHTML = quizData3.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-3-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    questions3.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateQuiz3));
    updateQuiz3();
  }

  function updateQuiz3() {
    const answered = quizData3.filter((_, index) => quizForm3.querySelector(`input[name="question-3-${index}"]:checked`)).length;
    progressLabel3.textContent = `${answered} / ${quizData3.length} répondues`;
    progressBar3.style.width = `${answered / quizData3.length * 100}%`;
  }

  function showQuizResult3() {
    const answers = quizData3.map((_, index) => quizForm3.querySelector(`input[name="question-3-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      message3.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      const firstMissing = answers.findIndex((answer) => !answer);
      quizForm3.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    quizData3.forEach((item, index) => {
      const selected = Number(answers[index].value);
      quizForm3.querySelectorAll(`input[name="question-3-${index}"]`).forEach((input) => {
        input.disabled = true;
        const label = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) label.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) label.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    const score = correct * 2;
    resultScore3.innerHTML = `${score}<span>/20</span>`;
    correctCount3.textContent = `${correct} / ${quizData3.length} bonnes réponses`;
    resultMessage3.textContent = score >= 16 ? 'Très bon résultat. Vous savez relier programme, rubrique, preuve et accès au dossier.' : score >= 10 ? 'Les bases sont là. Relisez le classement, les actions sur les fichiers et le rôle de Google.' : 'Reprenez la logique du dossier : une rubrique, une preuve retrouvable et une action tracée.';
    review3.innerHTML = quizData3.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    message3.textContent = 'Évaluation terminée. Consultez la correction commentée ci-dessous.';
    message3.className = 'quiz-form-message success';
    submit3.disabled = true;
    result3.hidden = false;
    result3.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quizForm3.addEventListener('submit', (event) => { event.preventDefault(); showQuizResult3(); });
  reset3.addEventListener('click', () => { quizForm3.reset(); quizForm3.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); submit3.disabled = false; result3.hidden = true; message3.textContent = ''; message3.className = 'quiz-form-message'; renderQuiz3(); quizForm3.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderQuiz3();
}

const quizForm4 = document.querySelector('#sequence-quiz-4');
if (quizForm4) {
  const quizData4 = [
    { question: 'Avant de préparer une déclaration de TVA, quelle base documentaire faut-il d’abord réunir ?', options: ['Les pièces comptables, la balance générale et les grands-livres', 'Uniquement la dernière quittance de paiement', 'Seulement le chiffre d’affaires communiqué oralement', 'Le rapport de la mission précédente sans les pièces'], answer: 0, explanation: 'La préparation commence par les pièces comptables, la balance et les grands-livres, puis par leur rapprochement.' },
    { question: 'Pour un prestataire de services, quel point doit être examiné lors de la revue de TVA ?', options: ['La couleur du logo sur la facture', 'Le point des encaissements et la règle d’exigibilité applicable', 'Uniquement le solde bancaire de clôture', 'Le nombre de véhicules de l’entreprise'], answer: 1, explanation: 'Les encaissements peuvent déterminer l’exigibilité pour les prestations de services. La règle applicable à l’opération doit être confirmée dans les textes en vigueur.' },
    { question: 'Concernant la TVA pour compte de tiers, quelle affirmation correspond à la méthodologie de la séquence ?', options: ['Elle est toujours compensable avec la TVA de la société', 'Elle est due uniquement à la clôture annuelle', 'Elle doit être rapprochée entre paiement, déclaration, déduction et preuve de reversement', 'Elle ne nécessite pas de facture du prestataire'], answer: 2, explanation: 'La feuille de travail doit relier le prestataire, la facture, le paiement, la TVA déclarée, la TVA déduite et la preuve de reversement. Elle ne doit pas être compensée avec la TVA due par la société.' },
    { question: 'Quel contrôle permet de tester l’exhaustivité d’une retenue AIB ?', options: ['Comparer les fournisseurs payés, les factures, les bases et la déclaration', 'Vérifier seulement le total de la balance', 'Contrôler uniquement les fournisseurs non payés', 'Remplacer le rapprochement par une estimation'], answer: 0, explanation: 'Le rapprochement des fournisseurs réglés, des factures, des bases hors taxe, des retenues et de la déclaration permet d’identifier les absences et les écarts.' },
    { question: 'Pour un fournisseur étranger soumis à une retenue, quel point doit être documenté avec prudence ?', options: ['Le pays du navigateur utilisé pour la saisie', 'La couleur de la facture', 'Le nombre de pages du contrat', 'La convention fiscale applicable et les justificatifs requis'], answer: 3, explanation: 'Les conventions fiscales, notamment celles applicables avec les pays concernés, peuvent modifier l’analyse. Leur application et les justificatifs doivent être confirmés.' },
    { question: 'Quel est le rôle du logiciel Seri Paie dans la production des déclarations sociales et salariales ?', options: ['Il remplace toute revue des pièces comptables', 'Il produit les états après saisie, mais les éléments variables et la base imposable doivent être revus', 'Il valide automatiquement les avantages en nature', 'Il détermine seul le régime fiscal des indemnités'], answer: 1, explanation: 'Seri Paie facilite la production, mais la revue doit couvrir les éléments variables, les avantages en nature, les indemnités et le rapprochement avec la comptabilité.' },
    { question: 'Comment traiter une indemnité de licenciement lors de la revue des impôts sur salaires ?', options: ['L’exclure sans conserver de justification', 'La réintégrer automatiquement à l’IS', 'Analyser sa qualification et le texte applicable avant de conclure sur son traitement à l’IRPP', 'Ne jamais la rapprocher de la paie'], answer: 2, explanation: 'Le traitement doit être documenté au regard de la qualification de l’indemnité et des dispositions en vigueur. La séquence rappelle cette réserve.' },
    { question: 'Quelle information doit être obtenue au plus tard le 10 mars pour la TVM ?', options: ['Le registre des fournisseurs étrangers', 'Le fichier des immobilisations mis à jour', 'La liste des congés du personnel', 'Le tableau des ventes en gros'], answer: 1, explanation: 'Le fichier des immobilisations mis à jour sert à identifier les véhicules et à les classer dans les catégories pertinentes pour la TVM.' },
    { question: 'Après la revue et la prise en compte des observations, quel circuit est attendu ?', options: ['Archiver immédiatement sans transmettre au client', 'Transmettre directement une version non revue à l’administration', 'Finaliser, transmettre au client puis à l’Administration fiscale, suivre le paiement et classer les preuves', 'Supprimer les feuilles de travail après paiement'], answer: 2, explanation: 'Le circuit comprend la finalisation, la transmission au client, la transmission à l’Administration fiscale, le paiement dans les délais, le classement et l’envoi des quittances.' },
    { question: 'Que faut-il impérativement confirmer avant de présenter un taux, un article ou un délai comme règle applicable ?', options: ['La préférence du préparateur', 'Le modèle de l’ordinateur', 'La date de création du dossier', 'Le CGI, les textes d’application, les conventions et les textes en vigueur pour l’exercice contrôlé'], answer: 3, explanation: 'Les taux, articles, seuils, délais et conditions sont des repères à vérifier dans les textes applicables à l’exercice contrôlé ; ils ne doivent pas être présentés comme définitifs sans cette vérification.' }
  ];
  const questions4 = document.querySelector('#quiz-questions-4');
  const progressLabel4 = document.querySelector('#quiz-progress-label-4');
  const progressBar4 = document.querySelector('#quiz-progress-bar-4');
  const message4 = document.querySelector('#quiz-form-message-4');
  const submit4 = document.querySelector('#quiz-submit-4');
  const result4 = document.querySelector('#quiz-result-4');
  const resultScore4 = document.querySelector('#quiz-result-score-4');
  const resultMessage4 = document.querySelector('#quiz-result-message-4');
  const correctCount4 = document.querySelector('#quiz-correct-count-4');
  const review4 = document.querySelector('#quiz-review-list-4');
  const reset4 = document.querySelector('#quiz-reset-4');

  function renderQuiz4() {
    questions4.innerHTML = quizData4.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-4-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    questions4.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateQuiz4));
    updateQuiz4();
  }

  function updateQuiz4() {
    const answered = quizData4.filter((_, index) => quizForm4.querySelector(`input[name="question-4-${index}"]:checked`)).length;
    progressLabel4.textContent = `${answered} / ${quizData4.length} répondues`;
    progressBar4.style.width = `${answered / quizData4.length * 100}%`;
  }

  function showQuizResult4() {
    const answers = quizData4.map((_, index) => quizForm4.querySelector(`input[name="question-4-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      message4.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      const firstMissing = answers.findIndex((answer) => !answer);
      quizForm4.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    quizData4.forEach((item, index) => {
      const selected = Number(answers[index].value);
      quizForm4.querySelectorAll(`input[name="question-4-${index}"]`).forEach((input) => {
        input.disabled = true;
        const label = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) label.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) label.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    const score = correct * 2;
    resultScore4.innerHTML = `${score}<span>/20</span>`;
    correctCount4.textContent = `${correct} / ${quizData4.length} bonnes réponses`;
    resultMessage4.textContent = score >= 16 ? 'Très bon résultat. Vous maîtrisez le circuit déclaratif et les principaux points de contrôle.' : score >= 10 ? 'Les bases sont acquises. Relisez les points de preuve, les circuits et les réserves de vérification.' : 'Reprenez les cinq rubriques de la séquence et le circuit saisie, revue, transmission, paiement et classement.';
    review4.innerHTML = quizData4.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    message4.textContent = 'Évaluation terminée. Consultez la correction commentée ci-dessous.';
    message4.className = 'quiz-form-message success';
    submit4.disabled = true;
    result4.hidden = false;
    result4.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quizForm4.addEventListener('submit', (event) => { event.preventDefault(); showQuizResult4(); });
  reset4.addEventListener('click', () => { quizForm4.reset(); quizForm4.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); submit4.disabled = false; result4.hidden = true; message4.textContent = ''; message4.className = 'quiz-form-message'; renderQuiz4(); quizForm4.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderQuiz4();
}

const quizForm5 = document.querySelector('#sequence-quiz-5');
if (quizForm5) {
  const quizData5 = [
    { question: 'Avec quel interlocuteur du client faut-il communiquer pour obtenir et transmettre les documents de paie ?', options: ['N’importe quel salarié disponible', 'Le collaborateur responsable des ressources humaines', 'Une société de distribution de courriers', 'Un fournisseur du client'], answer: 1, explanation: 'Les échanges doivent se faire avec le collaborateur du client responsable des ressources humaines afin de limiter les risques de divulgation.' },
    { question: 'À quelle date les fiches employés doivent-elles être transmises au plus tard selon la méthodologie ?', options: ['Le 5 de chaque mois', 'Le 10 de chaque mois', 'Le 25 de chaque mois', 'À la fin de l’exercice'], answer: 2, explanation: 'Les fiches employés doivent être obtenues au plus tard le 25 de chaque mois. Les pièces reçues hors délai doivent être identifiées et suivies.' },
    { question: 'Que faut-il faire avant de transmettre les fiches employés à la saisie ?', options: ['Calculer les différents éléments de rémunération', 'Supprimer les éléments variables', 'Envoyer directement les fiches au client', 'Classer la déclaration définitive'], answer: 0, explanation: 'La méthodologie prévoit le calcul des différents éléments de rémunération avant la transmission des fiches à la saisie.' },
    { question: 'Quel ensemble d’éléments doit faire l’objet d’un contrôle spécifique ?', options: ['Uniquement le salaire de base', 'Les avantages en nature, indemnités de congés et primes d’ancienneté', 'Uniquement les frais de déplacement', 'Seulement les documents administratifs'], answer: 1, explanation: 'Les avantages en nature, les indemnités de congés et les primes d’ancienneté font partie des éléments sensibles à évaluer et documenter.' },
    { question: 'Quel repère doit être suivi pour contrôler les primes d’ancienneté ?', options: ['La couleur de la fiche de paie', 'La date d’embauche de chaque salarié', 'Le numéro de la quittance fiscale', 'Le nombre de pages du journal de paie'], answer: 1, explanation: 'La date d’embauche doit être notée et suivie pour apprécier l’ancienneté. Le repère du support — après trois ans, taux de 3 %, taux évolutif — doit être confirmé pour la période applicable.' },
    { question: 'Que signifie le principe de cumul des rémunérations dans la revue de la paie ?', options: ['Ne conserver qu’une seule rémunération par salarié', 'Prendre en compte les rémunérations perçues au cours d’un même mois', 'Additionner uniquement les primes annuelles', 'Écarter les éléments variables'], answer: 1, explanation: 'Il faut s’assurer du respect du principe de cumul des rémunérations perçues au cours d’un même mois, notamment lorsque plusieurs éléments ou situations se cumulent.' },
    { question: 'Quels documents édités doivent être comparés aux informations des fiches employés ?', options: ['La fiche de paie, le journal de paie et les déclarations fiscale et sociale', 'Uniquement le contrat de travail', 'La balance générale sans les états de paie', 'Le planning annuel du cabinet'], answer: 0, explanation: 'La fiche de paie, le journal de paie et les déclarations fiscale et sociale doivent être conformes aux informations mentionnées sur les fiches employés.' },
    { question: 'Que faut-il faire après l’édition des documents de paie ?', options: ['Les transmettre à la revue', 'Les supprimer immédiatement', 'Les envoyer à tous les collaborateurs du cabinet', 'Les classer sans contrôle'], answer: 0, explanation: 'Les documents édités sont transmis à la revue. Les observations doivent ensuite être prises en compte avant la transmission au client.' },
    { question: 'Quelle séquence de clôture est correcte ?', options: ['Payer, saisir, calculer, puis obtenir les fiches', 'Calculer, saisir, éditer, revoir, corriger, transmettre, payer et classer', 'Classer les fiches avant tout calcul', 'Transmettre au client avant la revue'], answer: 1, explanation: 'Le circuit attendu part des fiches et des calculs, passe par la saisie et l’édition, la revue et les corrections, puis aboutit à la transmission, au paiement et au classement.' },
    { question: 'Que faut-il classer à la fin du traitement ?', options: ['Uniquement le fichier de travail personnel', 'La déclaration définitive et les feuilles de travail', 'Tous les documents dans un espace accessible à tous', 'Aucune preuve après paiement'], answer: 1, explanation: 'La déclaration définitive et les feuilles de travail doivent être classées. Les preuves de transmission, de paiement et les observations apurées complètent le dossier.' }
  ];
  const questions5 = document.querySelector('#quiz-questions-5');
  const progressLabel5 = document.querySelector('#quiz-progress-label-5');
  const progressBar5 = document.querySelector('#quiz-progress-bar-5');
  const message5 = document.querySelector('#quiz-form-message-5');
  const submit5 = document.querySelector('#quiz-submit-5');
  const result5 = document.querySelector('#quiz-result-5');
  const resultScore5 = document.querySelector('#quiz-result-score-5');
  const resultMessage5 = document.querySelector('#quiz-result-message-5');
  const correctCount5 = document.querySelector('#quiz-correct-count-5');
  const review5 = document.querySelector('#quiz-review-list-5');
  const reset5 = document.querySelector('#quiz-reset-5');

  function renderQuiz5() {
    questions5.innerHTML = quizData5.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-5-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    questions5.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateQuiz5));
    updateQuiz5();
  }

  function updateQuiz5() {
    const answered = quizData5.filter((_, index) => quizForm5.querySelector(`input[name="question-5-${index}"]:checked`)).length;
    progressLabel5.textContent = `${answered} / ${quizData5.length} répondues`;
    progressBar5.style.width = `${answered / quizData5.length * 100}%`;
  }

  function showQuizResult5() {
    const answers = quizData5.map((_, index) => quizForm5.querySelector(`input[name="question-5-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      message5.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      const firstMissing = answers.findIndex((answer) => !answer);
      quizForm5.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    quizData5.forEach((item, index) => {
      const selected = Number(answers[index].value);
      quizForm5.querySelectorAll(`input[name="question-5-${index}"]`).forEach((input) => {
        input.disabled = true;
        const label = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) label.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) label.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    const score = correct * 2;
    resultScore5.innerHTML = `${score}<span>/20</span>`;
    correctCount5.textContent = `${correct} / ${quizData5.length} bonnes réponses`;
    resultMessage5.textContent = score >= 16 ? 'Très bon résultat. Vous maîtrisez le circuit de traitement et les contrôles essentiels de la paie.' : score >= 10 ? 'Les bases sont acquises. Relisez la confidentialité, les pièces à obtenir et les contrôles avant transmission.' : 'Reprenez le circuit complet : protéger, obtenir, calculer, revoir, transmettre, payer et classer.';
    review5.innerHTML = quizData5.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    message5.textContent = 'Évaluation terminée. Consultez la correction commentée ci-dessous.';
    message5.className = 'quiz-form-message success';
    submit5.disabled = true;
    result5.hidden = false;
    result5.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quizForm5.addEventListener('submit', (event) => { event.preventDefault(); showQuizResult5(); });
  reset5.addEventListener('click', () => { quizForm5.reset(); quizForm5.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); submit5.disabled = false; result5.hidden = true; message5.textContent = ''; message5.className = 'quiz-form-message'; renderQuiz5(); quizForm5.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderQuiz5();
}

const quizForm7 = document.querySelector('#sequence-quiz-7');
if (quizForm7) {
  const quizData7 = [
    { question: 'Qu’est-ce qu’une consultation fiscale selon la séquence ?', options: ['Une réponse verbale ou écrite à une question posée par le client', 'Un classement automatique des déclarations', 'Une décision prise à la place du client sans analyse', 'Une simple copie du CGI'], answer: 0, explanation: 'La consultation est une réponse verbale ou écrite à une question posée par le client. La consultation verbale doit rester l’exception.' },
    { question: 'Lequel de ces éléments fait partie des qualités attendues d’un consultant ?', options: ['La technique, le don des langues et l’imagination', 'La rapidité sans vérification', 'La certitude de ne jamais demander de pièce', 'La délégation systématique du raisonnement'], answer: 0, explanation: 'La séquence retient la technique, le « don des langues » et l’imagination comme qualités du consultant.' },
    { question: 'Avant de répondre à une demande, quel point relatif au client faut-il notamment examiner ?', options: ['Uniquement le montant des honoraires', 'Le conflit d’intérêt éventuel et l’objectif réel du client', 'La couleur du dossier', 'Le nombre de pages de la demande'], answer: 1, explanation: 'Le client peut être une entreprise, un membre de réseau ou un autre bureau. L’identification du client et le contrôle des conflits d’intérêts sont indispensables.' },
    { question: 'Quelle source appartient aux sources du droit à rechercher dans une consultation ?', options: ['Les conventions fiscales, la loi, les règlements, la jurisprudence et la doctrine', 'Uniquement l’expérience personnelle', 'Les habitudes du client seulement', 'Une réponse non vérifiée trouvée dans un ancien dossier'], answer: 0, explanation: 'La séquence cite les traités et conventions, le CGI, les décrets, règlements et arrêtés, la jurisprudence, la doctrine et les usages ou pratiques.' },
    { question: 'Que signifie le raisonnement déductif ?', options: ['Tirer une conclusion générale de nombreux cas particuliers', 'Partir d’un principe général pour en dégager des applications particulières', 'Répondre selon son intuition sans source', 'Éviter de segmenter la question'], answer: 1, explanation: 'Le raisonnement déductif part d’un principe général pour en dégager des applications particulières. Le raisonnement inductif suit le mouvement inverse.' },
    { question: 'Que faut-il vérifier dans un raisonnement logique ?', options: ['L’injection correcte des données, la cohérence de la démarche et la vraisemblance de la conclusion', 'Uniquement la longueur du document', 'Seulement l’opinion du client', 'La présence d’un tableau même sans source'], answer: 0, explanation: 'La séquence demande de vérifier les données injectées, la cohérence de la démarche et la vraisemblance de la conclusion.' },
    { question: 'Quel est un principe de la règle de l’analyse ?', options: ['Diviser les questions en sous-questions selon une approche logique', 'Répondre à toutes les questions en même temps', 'Perdre de vue l’objectif du client', 'Accepter les automatismes sans contrôle'], answer: 0, explanation: 'La règle de l’analyse consiste notamment à segmenter, diviser les questions en sous-questions et distinguer l’accessoire du principal.' },
    { question: 'Quel plan correspond à la structure attendue d’une consultation ?', options: ['Rappel de la question, plan, analyse, solutions éventuelles et conclusion', 'Conclusion seule, sans rappeler les faits', 'Annexes uniquement', 'Opinion instinctive puis signature immédiate'], answer: 0, explanation: 'Le plan reprend la question et son environnement, expose la démarche, analyse les aspects, présente si nécessaire les solutions et conclut.' },
    { question: 'Quelle revue est attendue avant la revue finale d’une consultation ?', options: ['Une revue indépendante par une autre personne et la signature du gérant', 'Aucune revue si le texte semble correct', 'Une revue uniquement par le client', 'Une validation orale sans conservation de version'], answer: 0, explanation: 'La séquence prévoit une revue indépendante par une autre personne avant la revue finale et la signature de la consultation par le gérant.' },
    { question: 'Quelle règle s’applique au classement des dossiers d’assistance fiscale ?', options: ['Classer les déclarations et documents du plus vieux au plus récent dès que le travail est livré au client', 'Tout classer uniquement à la fin de l’année', 'Mélanger les versions de travail et définitives', 'Ne conserver que les documents définitifs sans les travaux de revue'], answer: 0, explanation: 'Les documents sont classés du plus vieux au plus récent et le classement se fait dès la fin de la mission d’assistance, lorsque le travail est livré au client. Les travaux de revue et les travaux définitifs validés doivent être conservés.' }
  ];
  const questions7 = document.querySelector('#quiz-questions-7');
  const progressLabel7 = document.querySelector('#quiz-progress-label-7');
  const progressBar7 = document.querySelector('#quiz-progress-bar-7');
  const message7 = document.querySelector('#quiz-form-message-7');
  const submit7 = document.querySelector('#quiz-submit-7');
  const result7 = document.querySelector('#quiz-result-7');
  const resultScore7 = document.querySelector('#quiz-result-score-7');
  const resultMessage7 = document.querySelector('#quiz-result-message-7');
  const correctCount7 = document.querySelector('#quiz-correct-count-7');
  const review7 = document.querySelector('#quiz-review-list-7');
  const reset7 = document.querySelector('#quiz-reset-7');

  function renderQuiz7() {
    questions7.innerHTML = quizData7.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="question-7-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    questions7.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateQuiz7));
    updateQuiz7();
  }

  function updateQuiz7() {
    const answered = quizData7.filter((_, index) => quizForm7.querySelector(`input[name="question-7-${index}"]:checked`)).length;
    progressLabel7.textContent = `${answered} / ${quizData7.length} répondues`;
    progressBar7.style.width = `${answered / quizData7.length * 100}%`;
  }

  function showQuizResult7() {
    const answers = quizData7.map((_, index) => quizForm7.querySelector(`input[name="question-7-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      message7.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      const firstMissing = answers.findIndex((answer) => !answer);
      quizForm7.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    quizData7.forEach((item, index) => {
      const selected = Number(answers[index].value);
      quizForm7.querySelectorAll(`input[name="question-7-${index}"]`).forEach((input) => {
        input.disabled = true;
        const label = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) label.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) label.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    const score = correct * 2;
    resultScore7.innerHTML = `${score}<span>/20</span>`;
    correctCount7.textContent = `${correct} / ${quizData7.length} bonnes réponses`;
    resultMessage7.textContent = score >= 16 ? 'Très bon résultat. Vous savez transformer une question en réponse fiscale structurée et traçable.' : score >= 10 ? 'Les bases sont acquises. Relisez les sources, le raisonnement, la revue et le classement.' : 'Reprenez la méthode : écouter, documenter, raisonner, rédiger, relire et classer.';
    review7.innerHTML = quizData7.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    message7.textContent = 'Évaluation terminée. Consultez la correction commentée ci-dessous.';
    message7.className = 'quiz-form-message success';
    submit7.disabled = true;
    result7.hidden = false;
    result7.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quizForm7.addEventListener('submit', (event) => { event.preventDefault(); showQuizResult7(); });
  reset7.addEventListener('click', () => { quizForm7.reset(); quizForm7.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); submit7.disabled = false; result7.hidden = true; message7.textContent = ''; message7.className = 'quiz-form-message'; renderQuiz7(); quizForm7.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderQuiz7();
}

/* Parcours guidé : une séquence visible à la fois et déverrouillage progressif. */
(() => {
  const guidedGroups = [
    { number: 1, title: 'Installer le cadre du séminaire', sections: ['sequence-01', 'quiz-s1'], quizResult: 'quiz-result' },
    { number: 2, title: 'Méthodologie des missions de revue fiscale', sections: ['sequence-02', 'quiz-s2'], quizResult: 'quiz-result-2' },
    { number: 3, title: 'Construire les programmes de travail', sections: ['sequence-03', 'quiz-s3'], quizResult: 'quiz-result-3' },
    { number: 4, title: 'Établir et revoir les déclarations fiscales', sections: ['sequence-04', 'quiz-s4'], quizResult: 'quiz-result-4' },
    { number: 5, title: 'Traiter la paie avec méthode', sections: ['sequence-05', 'quiz-s5'], quizResult: 'quiz-result-5' },
    { number: 6, title: 'Accompagner un contrôle fiscal', sections: ['sequence-06'] },
    { number: 7, title: 'Formuler une consultation fiscale', sections: ['sequence-07', 'quiz-s7'], quizResult: 'quiz-result-7' }
  ];
  const banner = document.querySelector('#guided-banner');
  if (!banner) return;
  const status = document.querySelector('#guided-status');
  const step = document.querySelector('#guided-step');
  const stage = document.querySelector('#guided-stage');
  const progress = document.querySelector('#guided-progress-bar');
  const reset = document.querySelector('#guided-reset');
  const guidedStorageKey = 'fiscale-guided-sequences-v1';
  const guidedCurrentStorageKey = 'fiscale-guided-current-v1';
  const guidedProgressStorageKey = 'fiscale-guided-progress-v2';
  const guidedCookieMaxAge = 60 * 60 * 24 * 365;
  const mobileNormalOnly = isMobileCourseViewport();
  let developerMode = !mobileNormalOnly && new URLSearchParams(window.location.search).get('mode') === 'developer';
  if (!mobileNormalOnly) {
    try { developerMode = developerMode || localStorage.getItem('fiscale-developer-mode') === '1'; } catch (error) { /* stockage local indisponible */ }
  }
  const allGuidedSections = guidedGroups.flatMap((group) => group.sections).map((id) => document.querySelector(`#${id}`)).filter(Boolean);
  const postCourseSections = [document.querySelector('#evaluation-finale'), document.querySelector('#certificate-section'), document.querySelector('#methode'), document.querySelector('#ressources'), document.querySelector('main > .final-cta')].filter(Boolean);
  let completed = new Set();
  let currentNumber = 1;
  let storedCurrentNumber = 1;
  let storedScrollY = 0;

  function readCookie(key) {
    const encodedKey = encodeURIComponent(key);
    const entry = document.cookie.split('; ').find((part) => part.startsWith(`${encodedKey}=`));
    if (!entry) return null;
    try { return decodeURIComponent(entry.slice(encodedKey.length + 1)); } catch (error) { return null; }
  }

  function readPersistent(key) {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return stored;
    } catch (error) { /* stockage local indisponible */ }
    return readCookie(key);
  }

  function writePersistent(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { /* cookie de secours ci-dessous */ }
    try {
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${guidedCookieMaxAge}; Path=/; SameSite=Lax`;
    } catch (error) { /* cookies indisponibles */ }
  }

  let storedProgress = null;
  try { storedProgress = JSON.parse(readPersistent(guidedProgressStorageKey) || 'null'); } catch (error) { storedProgress = null; }
  if (storedProgress && Array.isArray(storedProgress.completed)) {
    completed = new Set(storedProgress.completed.filter((number) => Number.isInteger(number) && number >= 1 && number <= guidedGroups.length));
    storedCurrentNumber = Number(storedProgress.current) || 1;
    storedScrollY = Number(storedProgress.scrollY) || 0;
  } else {
    try {
      const stored = JSON.parse(readPersistent(guidedStorageKey) || '[]');
      completed = new Set(stored.filter((number) => Number.isInteger(number) && number >= 1 && number <= guidedGroups.length));
    } catch (error) {
      completed = new Set();
    }
    const storedCurrent = Number(readPersistent(guidedCurrentStorageKey));
    if (Number.isInteger(storedCurrent) && storedCurrent >= 1 && storedCurrent <= guidedGroups.length) storedCurrentNumber = storedCurrent;
  }

  function saveProgressState() {
    const state = JSON.stringify({ completed: [...completed].sort((a, b) => a - b), current: currentNumber, scrollY: Math.max(0, Math.round(window.scrollY || 0)), updatedAt: new Date().toISOString() });
    writePersistent(guidedProgressStorageKey, state);
    writePersistent(guidedStorageKey, JSON.stringify([...completed].sort((a, b) => a - b)));
    writePersistent(guidedCurrentStorageKey, String(currentNumber));
  }

  function saveProgress() { saveProgressState(); }
  function saveCurrent() { saveProgressState(); }

  const quizDraftStorageKey = 'fiscale-quiz-drafts-v1';
  function readQuizDrafts() {
    try {
      const drafts = JSON.parse(readPersistent(quizDraftStorageKey) || '{}');
      return drafts && typeof drafts === 'object' ? drafts : {};
    } catch (error) {
      return {};
    }
  }
  function saveQuizDrafts(drafts) { writePersistent(quizDraftStorageKey, JSON.stringify(drafts)); }
  function saveQuizDraft(form) {
    if (!form?.id) return;
    const drafts = readQuizDrafts();
    drafts[form.id] = Object.fromEntries([...form.querySelectorAll('input[type="radio"]:checked')].map((input) => [input.name, input.value]));
    saveQuizDrafts(drafts);
  }
  function restoreQuizDrafts() {
    const drafts = readQuizDrafts();
    document.querySelectorAll('form[id^="sequence-quiz"], #final-quiz').forEach((form) => {
      const answers = drafts[form.id];
      if (!answers) return;
      Object.entries(answers).forEach(([name, value]) => {
        const input = [...form.querySelectorAll('input[type="radio"]')].find((candidate) => candidate.name === name && candidate.value === value);
        if (input) input.checked = true;
      });
      form.querySelectorAll('input[type="radio"]:checked').forEach((input) => input.dispatchEvent(new Event('change', { bubbles: true })));
    });
  }
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (input?.tagName === 'INPUT' && input.type === 'radio' && input.form?.id && (input.form.id.startsWith('sequence-quiz') || input.form.id === 'final-quiz')) saveQuizDraft(input.form);
  });
  restoreQuizDrafts();
  document.querySelectorAll('[id^="quiz-reset"], #final-quiz-reset').forEach((button) => button.addEventListener('click', () => {
    window.setTimeout(() => {
      const form = button.closest('section')?.querySelector('form');
      if (!form?.id) return;
      const drafts = readQuizDrafts();
      delete drafts[form.id];
      saveQuizDrafts(drafts);
    }, 0);
  }));

  let progressSaveTimer = 0;
  window.addEventListener('scroll', () => {
    window.clearTimeout(progressSaveTimer);
    progressSaveTimer = window.setTimeout(saveProgressState, 250);
  }, { passive: true });
  window.addEventListener('pagehide', saveProgressState);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveProgressState(); });

  function firstIncomplete() {
    return guidedGroups.find((group) => !completed.has(group.number))?.number || guidedGroups.length;
  }

  function isUnlocked(number) {
    return developerMode || number <= firstIncomplete();
  }

  function getGroup(number) {
    return guidedGroups.find((group) => group.number === Number(number));
  }

  function getGroupForElement(element) {
    if (!element) return null;
    const section = element.closest('section');
    return guidedGroups.find((group) => group.sections.includes(element.id) || group.sections.includes(section?.id)) || null;
  }

  function quizIsComplete(group) {
    if (!group.quizResult) return true;
    const result = document.querySelector(`#${group.quizResult}`);
    return Boolean(result && !result.hidden);
  }

  const completion = document.createElement('div');
  completion.className = 'guided-completion';
  completion.id = 'guided-completion';
  completion.innerHTML = '<div><span class="guided-completion-label">Fin de séquence</span><h3 id="guided-completion-title"></h3><p id="guided-completion-note"></p></div><button class="button button-primary" id="guided-finish" type="button"></button>';
  document.querySelector('#methode')?.before(completion);
  const completionTitle = completion.querySelector('#guided-completion-title');
  const completionNote = completion.querySelector('#guided-completion-note');
  const finish = completion.querySelector('#guided-finish');

  function updateCardStates() {
    const next = developerMode ? guidedGroups.length : firstIncomplete();
    sequenceCards.forEach((card) => {
      const number = Number(card.dataset.sequenceCard);
      const previewOnly = !developerMode && number > next;
      card.classList.toggle('preview-only', previewOnly);
      card.classList.remove('locked');
      card.setAttribute('aria-current', number === currentNumber ? 'step' : 'false');
      card.querySelector('.sequence-toggle')?.setAttribute('aria-disabled', 'false');
    });
    railSteps.forEach((railStep) => {
      const number = Number(railStep.dataset.sequence);
      railStep.classList.toggle('locked', number > next);
      railStep.setAttribute('aria-disabled', String(number > next));
    });
  }

  function updateBanner() {
    const group = getGroup(currentNumber);
    const complete = developerMode || completed.size === guidedGroups.length;
    step.textContent = developerMode ? 'DEV' : `${String(currentNumber).padStart(2, '0')} / ${String(guidedGroups.length).padStart(2, '0')}`;
    stage.textContent = developerMode ? 'Accès développeur' : complete ? 'Parcours terminé' : completed.has(currentNumber) ? 'Déjà validée' : 'En cours';
    progress.style.width = `${complete ? 100 : Math.max(5, completed.size / guidedGroups.length * 100)}%`;
    banner.classList.toggle('is-complete', complete);
    if (developerMode) status.textContent = 'Mode développeur actif : toutes les séquences, les contenus et les questionnaires sont consultables sans validation.';
    else if (!complete) status.textContent = `Séquence ${String(currentNumber).padStart(2, '0')} : ${group.title}. Terminez cette étape pour déverrouiller la suivante. Progression enregistrée automatiquement sur cet appareil.`;
  }

  function updateCompletion() {
    const group = getGroup(currentNumber);
    const alreadyComplete = developerMode || completed.has(currentNumber);
    const quizRequired = Boolean(group.quizResult);
    const quizComplete = quizIsComplete(group);
    completionTitle.textContent = `Séquence ${String(currentNumber).padStart(2, '0')} · ${group.title}`;
    if (developerMode) {
      completionNote.textContent = 'Mode développeur : les validations ne sont pas requises pour consulter ou tester les séquences.';
      finish.disabled = true;
      finish.textContent = 'Validation désactivée en mode développeur';
    } else if (alreadyComplete) {
      completionNote.textContent = currentNumber === guidedGroups.length ? 'Toutes les séquences sont validées. Les ressources et la méthode générale sont maintenant accessibles.' : 'Cette séquence est déjà validée. Vous pouvez la relire ou passer à la suivante.';
      finish.disabled = false;
      finish.textContent = currentNumber === guidedGroups.length ? 'Parcours terminé' : 'Passer à la séquence suivante →';
    } else if (quizRequired && !quizComplete) {
      completionNote.textContent = 'Pour terminer cette séquence, complétez et validez le QCM associé. La séquence suivante restera verrouillée jusque-là.';
      finish.disabled = true;
      finish.textContent = 'Valider le QCM pour continuer';
    } else {
      completionNote.textContent = quizRequired ? 'Le QCM est validé. Vous pouvez maintenant clôturer cette séquence.' : 'Après avoir parcouru cette séquence, confirmez sa clôture pour déverrouiller la suivante.';
      finish.disabled = false;
      finish.textContent = currentNumber === guidedGroups.length ? 'Terminer le parcours →' : 'Terminer la séquence et continuer →';
    }
  }

  function updateVisibility() {
    const group = getGroup(currentNumber);
    if (developerMode) allGuidedSections.forEach((section) => { section.hidden = false; });
    else allGuidedSections.forEach((section) => { section.hidden = !group.sections.includes(section.id); });
    const courseComplete = developerMode || completed.size === guidedGroups.length;
    postCourseSections.forEach((section) => { section.hidden = !courseComplete; });
    completion.hidden = developerMode;
    updateBanner();
    updateCompletion();
    updateCardStates();
    activateSequence(String(currentNumber));
    sequenceCards.forEach((card) => {
      const isCurrent = Number(card.dataset.sequenceCard) === currentNumber;
      card.classList.toggle('open', isCurrent);
      card.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', String(isCurrent));
    });
  }

  function showLockedMessage(number) {
    const group = getGroup(number);
    status.textContent = `L’aperçu de la séquence ${String(number).padStart(2, '0')} reste accessible. Le contenu complet sera disponible après validation de la séquence ${String(firstIncomplete()).padStart(2, '0')}.`;
    banner.classList.add('is-warning');
    window.setTimeout(() => banner.classList.remove('is-warning'), 1800);
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return group;
  }

  function showGroup(number, scroll = true) {
    const targetNumber = Number(number);
    if (!isUnlocked(targetNumber)) { showLockedMessage(targetNumber); return; }
    currentNumber = targetNumber;
    saveCurrent();
    updateVisibility();
    if (scroll) getGroup(currentNumber).sections.map((id) => document.querySelector(`#${id}`)).find(Boolean)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  finish.addEventListener('click', () => {
    const group = getGroup(currentNumber);
    if (!completed.has(currentNumber) && !quizIsComplete(group)) { updateCompletion(); return; }
    completed.add(currentNumber);
    saveProgress();
    if (currentNumber < guidedGroups.length) showGroup(currentNumber + 1, true);
    else { updateVisibility(); document.querySelector('#evaluation-finale')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  reset.addEventListener('click', () => {
    saveQuizDrafts({});
    completed.clear();
    saveProgress();
    currentNumber = 1;
    saveCurrent();
    showGroup(1, false);
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    const group = getGroupForElement(target);
    if (!group) return;
    if (!isUnlocked(group.number)) {
      event.preventDefault();
      showLockedMessage(group.number);
      return;
    }
    event.preventDefault();
    showGroup(group.number, false);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  railSteps.forEach((railStep) => {
    railStep.addEventListener('click', (event) => {
      const number = Number(railStep.dataset.sequence);
      if (!isUnlocked(number)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showLockedMessage(number);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      showGroup(number, true);
    }, true);
  });

  sequenceCards.forEach((card) => {
    card.querySelector('.sequence-toggle')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const number = Number(card.dataset.sequenceCard);
      const isPreview = !isUnlocked(number);
      const willOpen = !card.classList.contains('open');
      if (isPreview) {
        card.classList.toggle('open', willOpen);
        card.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', String(willOpen));
        status.textContent = willOpen ? `Aperçu de la séquence ${String(number).padStart(2, '0')} ouvert. Le contenu complet sera disponible après validation de la séquence ${String(firstIncomplete()).padStart(2, '0')}.` : `Aperçu de la séquence ${String(number).padStart(2, '0')} refermé.`;
        return;
      }
      sequenceCards.forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', 'false');
      });
      card.classList.toggle('open', willOpen);
      card.querySelector('.sequence-toggle')?.setAttribute('aria-expanded', String(willOpen));
    }, true);
  });

  document.querySelectorAll('form[id^="sequence-quiz-"]').forEach((form) => form.addEventListener('submit', () => window.setTimeout(updateCompletion, 0)));
  if (typeof window.MutationObserver === 'function') {
    document.querySelectorAll('#quiz-result, [id^="quiz-result-"]').forEach((result) => new window.MutationObserver(updateCompletion).observe(result, { attributes: true, attributeFilter: ['hidden'] }));
  }
  const resumeNumber = developerMode ? 1 : Math.min(storedCurrentNumber, firstIncomplete());
  showGroup(resumeNumber, false);
  if (!developerMode && storedScrollY > 0) {
    window.setTimeout(() => window.scrollTo({ top: storedScrollY, behavior: 'auto' }), 80);
  }
  window.addEventListener('resize', () => {
    if (!isMobileCourseViewport() || !developerMode) return;
    developerMode = false;
    currentNumber = Math.min(currentNumber, firstIncomplete());
    updateVisibility();
  });
})();


/* Certificat : aperçu, demande WhatsApp et validation manuelle par le cabinet. */
(() => {
  const certificateSection = document.querySelector('#certificate-section');
  const certificateOffer = document.querySelector('#certificate-offer');
  const certificateStart = document.querySelector('#certificate-start');
  const certificateFormPanel = document.querySelector('#certificate-form-panel');
  const certificateForm = document.querySelector('#certificate-form');
  const certificateMessage = document.querySelector('#certificate-form-message');
  const certificatePreviewPanel = document.querySelector('#certificate-preview-panel');
  const certificateEdit = document.querySelector('#certificate-edit');
  const paymentButton = document.querySelector('#certificate-pay');
  const whatsappButton = document.querySelector('#certificate-whatsapp');
  const verifyButton = document.querySelector('#certificate-verify');
  const validationStatus = document.querySelector('#certificate-validation-status');
  const paymentConfirm = document.querySelector('#certificate-payment-confirm');
  const downloadButton = document.querySelector('#certificate-download');
  const developerPanel = document.querySelector('#developer-certificates-panel');
  const developerForm = document.querySelector('#developer-certificate-form');
  const developerList = document.querySelector('#developer-certificates-list');
  const developerMessage = document.querySelector('#developer-certificates-message');
  if (!certificateSection || !certificateForm) return;

  const profileStorageKey = 'fiscale-certificate-profile-v1';
  const stateStorageKey = 'fiscale-certificate-state-v1';
  const paymentUrl = 'https://goespay.io/pay/FJK9BGDH';
  const whatsappNumber = '2290190895323';
  const mobileNormalOnly = isMobileCourseViewport();
  let developerMode = !mobileNormalOnly && new URLSearchParams(window.location.search).get('mode') === 'developer';
  if (!mobileNormalOnly) {
    try { developerMode = developerMode || localStorage.getItem('fiscale-developer-mode') === '1'; } catch (error) { /* stockage local indisponible */ }
  }
  let profile = {};
  let state = { accepted: false, previewReady: false, paymentConfirmed: false, validated: false, whatsappSent: false, reference: '' };

  function readLocal(key, fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      return stored && typeof stored === 'object' ? stored : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
      localStorage.setItem(stateStorageKey, JSON.stringify(state));
    } catch (error) { /* la génération reste utilisable si le stockage est indisponible */ }
  }

  function formatBirthDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  function setPreviewValue(id, value) {
    const target = document.querySelector(`#${id}`);
    if (target) target.textContent = value || '—';
  }

  function createReference() {
    if (state.reference) return state.reference;
    state.reference = `GOBEX-FORM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    return state.reference;
  }

  function setValidationStatus(message, type = '') {
    validationStatus.textContent = message;
    validationStatus.className = type ? `is-${type}` : '';
  }

  function renderPreview() {
    setPreviewValue('certificate-participant-name', profile.participantName);
    setPreviewValue('certificate-birth-date', formatBirthDate(profile.birthDate));
    setPreviewValue('certificate-birth-place', profile.birthPlace);
    setPreviewValue('certificate-nationality', profile.nationality);
    setPreviewValue('certificate-profile', profile.profile);
    setPreviewValue('certificate-reference', createReference());
    paymentConfirm.checked = state.paymentConfirmed === true;
    downloadButton.disabled = !state.validated;
    if (state.validated) setValidationStatus('Certificat validé par le cabinet. Le téléchargement est disponible.', 'success');
    else if (state.paymentConfirmed) setValidationStatus('Paiement déclaré. En attente de validation par le cabinet.', 'pending');
    else setValidationStatus('En attente du règlement et de la transmission du reçu.', 'pending');
    certificatePreviewPanel.hidden = false;
    certificateFormPanel.hidden = true;
    saveLocal();
  }

  function openForm() {
    state.accepted = true;
    certificateOffer.hidden = true;
    certificateFormPanel.hidden = false;
    certificatePreviewPanel.hidden = true;
    certificateMessage.textContent = '';
    certificateForm.querySelector('#participant-name')?.focus();
    saveLocal();
  }

  async function verifyCertificate() {
    const reference = createReference();
    verifyButton.disabled = true;
    setValidationStatus('Vérification de l’état auprès du cabinet…', 'pending');
    try {
      const response = await fetch(`/api/certificates/verify?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'verification_failed');
      state.validated = result.valid === true;
      if (state.validated) {
        setValidationStatus(`Certificat ${reference} validé par le cabinet.`, 'success');
        downloadButton.disabled = false;
      } else if (result.status === 'pending') {
        setValidationStatus('Demande reçue. Le cabinet doit encore valider le certificat.', 'pending');
        downloadButton.disabled = true;
      } else if (result.status === 'revoked') {
        setValidationStatus('Ce certificat a été révoqué. Contactez le cabinet.', 'error');
        downloadButton.disabled = true;
      } else {
        setValidationStatus('Code non encore enregistré. Envoyez le reçu et le code par WhatsApp.', 'error');
        downloadButton.disabled = true;
      }
      saveLocal();
    } catch (error) {
      setValidationStatus('Service de vérification momentanément indisponible. Réessayez plus tard.', 'error');
      downloadButton.disabled = true;
    } finally {
      verifyButton.disabled = false;
    }
  }

  function sendWhatsAppRequest() {
    const reference = createReference();
    const message = [
      'Bonjour GOBEX,',
      'Je souhaite faire valider mon certificat de participation.',
      '',
      `Code du certificat : ${reference}`,
      `Nom et prénoms : ${profile.participantName || ''}`,
      `Date de naissance : ${formatBirthDate(profile.birthDate)}`,
      `Lieu de naissance : ${profile.birthPlace || ''}`,
      `Nationalité : ${profile.nationality || ''}`,
      `Profil : ${profile.profile || ''}`,
      '',
      'Je joins le reçu de paiement à ce message. Merci de valider mon certificat.'
    ].join('\n');
    state.whatsappSent = true;
    saveLocal();
    setValidationStatus('WhatsApp ouvert. Joignez le reçu avant d’envoyer le message.', 'pending');
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  async function parseResponse(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'request_failed');
    return result;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
  }

  function developerStatusLabel(status) {
    return { pending: 'En attente', validated: 'Validé', revoked: 'Révoqué' }[status] || status;
  }

  function renderDeveloperCertificates(certificates) {
    if (!certificates.length) {
      developerList.innerHTML = '<p class="developer-certificates-empty">Aucune demande enregistrée. Saisissez le code reçu par WhatsApp.</p>';
      return;
    }
    developerList.innerHTML = certificates.map((certificate) => `<article class="developer-certificate-item"><div><strong>${escapeHtml(certificate.reference)}</strong><span>${escapeHtml(certificate.participantName)} · ${escapeHtml(certificate.profile || 'Profil non renseigné')}</span><small>${developerStatusLabel(certificate.status)} · ${new Date(certificate.updatedAt).toLocaleString('fr-FR')}</small></div><div class="developer-certificate-actions"><button type="button" data-certificate-status="validated" data-certificate-reference="${escapeHtml(certificate.reference)}">Valider</button><button type="button" data-certificate-status="pending" data-certificate-reference="${escapeHtml(certificate.reference)}">En attente</button><button type="button" data-certificate-status="revoked" data-certificate-reference="${escapeHtml(certificate.reference)}">Révoquer</button></div></article>`).join('');
  }

  async function loadDeveloperCertificates() {
    if (!developerPanel) return;
    developerPanel.hidden = false;
    try {
      const result = await parseResponse(await fetch('/api/certificates', { cache: 'no-store' }));
      renderDeveloperCertificates(result.certificates || []);
      developerMessage.textContent = '';
    } catch (error) {
      developerList.innerHTML = '<p class="developer-certificates-empty">Impossible de charger les demandes. Vérifiez la session développeur du serveur.</p>';
    }
  }

  async function saveDeveloperCertificate(body) {
    developerMessage.textContent = 'Enregistrement en cours…';
    try {
      await parseResponse(await fetch('/api/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      developerMessage.textContent = 'Décision enregistrée.';
      developerForm.reset();
      await loadDeveloperCertificates();
    } catch (error) {
      developerMessage.textContent = error.message === 'Accès développeur requis.' ? 'Accès refusé : utilisez la session développeur autorisée.' : 'Impossible d’enregistrer cette décision.';
    }
  }

  async function changeDeveloperStatus(reference, status) {
    try {
      await parseResponse(await fetch(`/api/certificates/${encodeURIComponent(reference)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }));
      developerMessage.textContent = `Certificat ${reference} : ${developerStatusLabel(status)}.`;
      await loadDeveloperCertificates();
    } catch (error) {
      developerMessage.textContent = 'Impossible de modifier le statut de ce certificat.';
    }
  }

  certificateStart.addEventListener('click', openForm);
  certificateForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!certificateForm.checkValidity()) {
      certificateMessage.textContent = 'Complétez les champs obligatoires pour générer l’aperçu.';
      certificateForm.reportValidity();
      return;
    }
    profile = Object.fromEntries(new FormData(certificateForm).entries());
    state = { ...state, accepted: true, previewReady: true, paymentConfirmed: false, validated: false, whatsappSent: false, reference: '' };
    certificateMessage.textContent = '';
    renderPreview();
  });
  certificateEdit.addEventListener('click', () => {
    certificatePreviewPanel.hidden = true;
    certificateFormPanel.hidden = false;
    certificateForm.querySelector('#participant-name')?.focus();
  });
  paymentButton.addEventListener('click', () => window.open(paymentUrl, '_blank', 'noopener,noreferrer,width=520,height=720'));
  whatsappButton.addEventListener('click', sendWhatsAppRequest);
  verifyButton.addEventListener('click', verifyCertificate);
  paymentConfirm.addEventListener('change', () => {
    state.paymentConfirmed = paymentConfirm.checked;
    if (state.paymentConfirmed && !state.validated) setValidationStatus('Paiement déclaré. Envoyez le reçu par WhatsApp puis attendez la validation du cabinet.', 'pending');
    saveLocal();
  });
  downloadButton.addEventListener('click', () => {
    if (!state.validated) return;
    document.body.classList.add('printing-certificate');
    const clearPrintMode = () => document.body.classList.remove('printing-certificate');
    window.addEventListener('afterprint', clearPrintMode, { once: true });
    window.print();
    window.setTimeout(clearPrintMode, 1500);
  });

  developerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const reference = document.querySelector('#developer-certificate-reference').value.trim();
    const participantName = document.querySelector('#developer-certificate-name').value.trim();
    if (!reference || !participantName) { developerMessage.textContent = 'Le code et le nom sont obligatoires.'; return; }
    saveDeveloperCertificate({ reference, participantName, profile: document.querySelector('#developer-certificate-profile').value.trim(), status: document.querySelector('#developer-certificate-status').value });
  });
  developerList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-certificate-status]');
    if (button) changeDeveloperStatus(button.dataset.certificateReference, button.dataset.certificateStatus);
  });

  profile = readLocal(profileStorageKey, {});
  state = { ...state, ...readLocal(stateStorageKey, {}) };
  if (profile.participantName) {
    Object.entries(profile).forEach(([name, value]) => {
      const field = certificateForm.elements.namedItem(name);
      if (field) field.value = value;
    });
  }
  if (state.accepted) certificateOffer.hidden = true;
  if (state.previewReady && profile.participantName) renderPreview();
  else if (state.accepted) certificateFormPanel.hidden = false;
  if (developerMode) {
    loadDeveloperCertificates();
    window.addEventListener('resize', () => {
      if (!isMobileCourseViewport() || !developerMode) return;
      developerMode = false;
      if (developerPanel) developerPanel.hidden = true;
    });
  }
})();

const finalQuizForm = document.querySelector('#final-quiz');
if (finalQuizForm) {
  const finalQuizData = [
    { question: 'Quel est l’objectif central d’une formation fiscale structurée ?', options: ['Partager un cadre de travail commun et produire des travaux contrôlables', 'Éviter toute supervision', 'Remplacer les textes fiscaux par des habitudes', 'Réduire les pièces conservées'], answer: 0, explanation: 'Le parcours vise un cadre commun, une méthode reproductible, une supervision et des preuves retrouvables.' },
    { question: 'Quel réflexe appartient à la planification d’une mission ?', options: ['Choisir une période, définir un résultat attendu et réserver les temps de revue', 'Attendre la dernière échéance pour répartir les tâches', 'Supprimer les temps de contrôle', 'Travailler sans responsable identifié'], answer: 0, explanation: 'La planification relie période, résultat, priorités, ressources, échéances et temps de supervision.' },
    { question: 'Quel document permet de démontrer les travaux réalisés et la conclusion retenue ?', options: ['Une feuille de travail référencée avec ses pièces et sa conclusion', 'Un message oral non documenté', 'Une copie sans période ni client', 'Une liste de tâches sans statut'], answer: 0, explanation: 'Une feuille de travail doit permettre de comprendre les travaux, les pièces examinées, les anomalies et la conclusion.' },
    { question: 'Quelle distinction est essentielle dans un dossier fiscal ?', options: ['Dossier permanent et dossier de l’exercice', 'Documents importants et documents sans date', 'Pièces papier et pièces sans référence', 'Fichiers internes et fichiers sans responsable'], answer: 0, explanation: 'Le dossier permanent contient les informations durables à mettre à jour ; le dossier courant documente la mission et la période.' },
    { question: 'Dans une répartition des travaux, que signifie une revue indépendante ?', options: ['Une autre personne contrôle les travaux, les preuves et la conclusion', 'Le préparateur valide seul son propre travail', 'Le client supprime les anomalies', 'La revue intervient seulement après archivage'], answer: 0, explanation: 'La revue indépendante apporte un second regard et permet d’apurer les observations avant validation finale.' },
    { question: 'Quel est le rôle d’un référencement stable dans un dossier ?', options: ['Relier chaque document à sa rubrique, sa période, sa nature et sa version', 'Donner un nom différent à chaque ouverture', 'Remplacer la conservation des preuves', 'Éviter toute version définitive'], answer: 0, explanation: 'Un code stable rend les pièces retrouvables et relie le document à la feuille de travail et à la conclusion.' },
    { question: 'Avant d’établir la TVA, quelle base faut-il réunir et rapprocher ?', options: ['Pièces comptables, balance générale et grands-livres', 'Uniquement une estimation du chiffre d’affaires', 'Seulement la dernière quittance', 'Le fichier des congés'], answer: 0, explanation: 'La TVA se prépare à partir des pièces, de la balance et des grands-livres, avec un rapprochement des informations.' },
    { question: 'Quelle règle concerne la TVA pour compte de tiers ?', options: ['Elle doit être rapprochée et ne doit pas être compensée avec la TVA due par la société', 'Elle est toujours compensée avec la TVA de la société', 'Elle ne nécessite aucune preuve de paiement', 'Elle est due uniquement à la clôture annuelle'], answer: 0, explanation: 'Le montant payé, déclaré et déduit doit être relié aux pièces et à la preuve de reversement, sans compensation avec la TVA de la société.' },
    { question: 'Pour un fournisseur étranger soumis à une retenue AIB, quel point doit être vérifié ?', options: ['La convention fiscale applicable et les justificatifs requis', 'Uniquement le nom du fournisseur', 'La couleur de la facture', 'Le nombre de pages du contrat'], answer: 0, explanation: 'Les conventions fiscales peuvent influencer l’analyse ; leur application doit être vérifiée et documentée.' },
    { question: 'Quelle information doit être obtenue au plus tard le 10 mars pour la TVM ?', options: ['Le fichier des immobilisations mis à jour', 'La liste des fournisseurs non payés', 'Les fiches employés', 'Le registre des consultations'], answer: 0, explanation: 'Le fichier des immobilisations permet d’identifier et de classer les véhicules concernés par la TVM.' },
    { question: 'Quelle est la date limite mentionnée pour obtenir les fiches employés ?', options: ['Le 5', 'Le 10', 'Le 25', 'Le dernier jour de l’exercice'], answer: 2, explanation: 'La méthodologie de paie prévoit l’obtention obligatoire des fiches employés au plus tard le 25 de chaque mois.' },
    { question: 'Avec qui faut-il communiquer pour obtenir et transmettre les documents de paie ?', options: ['Le collaborateur du client responsable des ressources humaines', 'Tous les collaborateurs du client', 'Une personne extérieure non habilitée', 'Un fournisseur'], answer: 0, explanation: 'Les échanges doivent être centralisés avec le responsable RH désigné afin de protéger la confidentialité des données.' },
    { question: 'Que faut-il faire avant de transmettre les fiches employés à la saisie ?', options: ['Calculer les différents éléments de rémunération', 'Supprimer les avantages en nature', 'Envoyer les fiches sans contrôle', 'Classer le dossier définitif'], answer: 0, explanation: 'Les éléments de rémunération doivent être calculés et documentés avant la saisie.' },
    { question: 'À la réception d’un avis de vérification, quelle est la première démarche ?', options: ['Vérifier la procédure et préparer la réunion et les pièces avec le client', 'Répondre immédiatement sans lire l’avis', 'Contacter tous les salariés', 'Détruire les anciennes pièces'], answer: 0, explanation: 'Il faut examiner la procédure, réunir le client, obtenir les pièces et préparer les dispositions matérielles.' },
    { question: 'Quel délai du support doit être vérifié pour répondre à une notification de redressement ?', options: ['10 jours', '15 jours', '30 jours', '90 jours'], answer: 2, explanation: 'Le support mentionne un délai de 30 jours. Ce délai doit être confirmé dans les textes et selon la procédure applicable au dossier.' },
    { question: 'Comment traiter la caution et le recours en matière de contentieux fiscal ?', options: ['Vérifier le repère de 25 %, les conditions du sursis et conseiller un avocat si la procédure le requiert', 'Appliquer automatiquement 25 % sans vérifier le texte', 'Saisir le juge sans analyser les délais', 'Ne conserver aucune preuve de versement'], answer: 0, explanation: 'Le repère de 25 % est conservé avec une réserve de vérification. Les règles de procédure et la compétence de l’avocat doivent être respectées.' },
    { question: 'Qu’est-ce qu’une consultation fiscale ?', options: ['Une réponse verbale ou écrite à une question posée par le client', 'Une décision automatique de l’administration', 'Un classement de déclarations', 'Une opinion sans faits ni sources'], answer: 0, explanation: 'La consultation répond à une question du client ; la consultation verbale doit rester l’exception et être confirmée par écrit.' },
    { question: 'Quelle combinaison constitue des sources du droit à examiner ?', options: ['Conventions, CGI, règlements, jurisprudence et doctrine', 'Uniquement l’expérience personnelle', 'Seulement les habitudes du client', 'Une ancienne réponse non vérifiée'], answer: 0, explanation: 'Les sources comprennent notamment les traités et conventions, la loi, les textes réglementaires, la jurisprudence et la doctrine.' },
    { question: 'Quel enchaînement correspond à une consultation bien construite ?', options: ['Rappeler la question, analyser, présenter les solutions éventuelles et conclure', 'Affirmer une conclusion avant de vérifier les faits', 'Copier un texte sans l’appliquer', 'Rédiger uniquement une liste de sources'], answer: 0, explanation: 'Une consultation suit une démarche intelligible : question et environnement, plan, analyse, solutions éventuelles et conclusion.' },
    { question: 'Quelle règle s’applique au classement des dossiers d’assistance fiscale ?', options: ['Classer du plus vieux au plus récent dès que le travail est livré au client', 'Attendre systématiquement la fin de l’année', 'Mélanger travaux de revue et versions définitives', 'Conserver seulement les pièces les plus récentes'], answer: 0, explanation: 'Le classement commence dès la livraison au client, du plus vieux au plus récent, en conservant les travaux de revue et les documents définitifs validés.' }
  ];
  const finalQuestions = document.querySelector('#final-quiz-questions');
  const finalProgressLabel = document.querySelector('#final-quiz-progress-label');
  const finalProgressBar = document.querySelector('#final-quiz-progress-bar');
  const finalMessage = document.querySelector('#final-quiz-form-message');
  const finalSubmit = document.querySelector('#final-quiz-submit');
  const finalResult = document.querySelector('#final-quiz-result');
  const finalScore = document.querySelector('#final-quiz-score');
  const finalResultMessage = document.querySelector('#final-quiz-message');
  const finalCorrectCount = document.querySelector('#final-quiz-correct-count');
  const finalReview = document.querySelector('#final-quiz-review-list');
  const finalReset = document.querySelector('#final-quiz-reset');

  function renderFinalQuiz() {
    finalQuestions.innerHTML = finalQuizData.map((item, questionIndex) => `<fieldset class="quiz-question"><legend class="quiz-question-header"><span class="quiz-question-number">${String(questionIndex + 1).padStart(2, '0')}</span><span class="quiz-question-text">${item.question}</span></legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="final-question-${questionIndex}" value="${optionIndex}" /><span>${String.fromCharCode(65 + optionIndex)}. ${option}</span></label>`).join('')}</div></fieldset>`).join('');
    finalQuestions.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateFinalQuiz));
    updateFinalQuiz();
  }

  function updateFinalQuiz() {
    const answered = finalQuizData.filter((_, index) => finalQuizForm.querySelector(`input[name="final-question-${index}"]:checked`)).length;
    finalProgressLabel.textContent = `${answered} / ${finalQuizData.length} répondues`;
    finalProgressBar.style.width = `${answered / finalQuizData.length * 100}%`;
  }

  function showFinalResult() {
    const answers = finalQuizData.map((_, index) => finalQuizForm.querySelector(`input[name="final-question-${index}"]:checked`));
    const unanswered = answers.filter((answer) => !answer).length;
    if (unanswered) {
      finalMessage.textContent = `Il reste ${unanswered} question${unanswered > 1 ? 's' : ''} à compléter avant de valider.`;
      const firstMissing = answers.findIndex((answer) => !answer);
      finalQuizForm.querySelectorAll('.quiz-question')[firstMissing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let correct = 0;
    finalQuizData.forEach((item, index) => {
      const selected = Number(answers[index].value);
      finalQuizForm.querySelectorAll(`input[name="final-question-${index}"]`).forEach((input) => {
        input.disabled = true;
        const label = input.closest('.quiz-option');
        if (Number(input.value) === item.answer) label.classList.add('is-correct');
        if (Number(input.value) === selected && selected !== item.answer) label.classList.add('is-wrong');
      });
      if (selected === item.answer) correct += 1;
    });
    finalScore.innerHTML = `${correct}<span>/20</span>`;
    finalCorrectCount.textContent = `${correct} / ${finalQuizData.length} bonnes réponses`;
    finalResultMessage.textContent = correct >= 16 ? 'Très bon résultat. Votre parcours est solidement maîtrisé.' : correct >= 10 ? 'Parcours validé. Reprenez les corrections commentées pour consolider vos points de vigilance.' : 'Relisez les séquences et les corrections commentées avant de recommencer l’évaluation.';
    finalReview.innerHTML = finalQuizData.map((item, index) => { const selected = Number(answers[index].value); const isCorrect = selected === item.answer; return `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}"><span>${isCorrect ? '✓' : '!'}</span><div><strong>${String(index + 1).padStart(2, '0')}. ${isCorrect ? 'Bonne réponse' : `Réponse attendue : ${String.fromCharCode(65 + item.answer)}`}</strong><p>${item.explanation}</p></div></div>`; }).join('');
    finalMessage.textContent = 'Évaluation finale terminée. Consultez la correction commentée ci-dessous.';
    finalMessage.className = 'quiz-form-message success';
    finalSubmit.disabled = true;
    finalResult.hidden = false;
    finalResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  finalQuizForm.addEventListener('submit', (event) => { event.preventDefault(); showFinalResult(); });
  finalReset.addEventListener('click', () => { finalQuizForm.reset(); finalQuizForm.querySelectorAll('input').forEach((input) => { input.disabled = false; input.closest('.quiz-option').classList.remove('is-correct', 'is-wrong'); }); finalSubmit.disabled = false; finalResult.hidden = true; finalMessage.textContent = ''; finalMessage.className = 'quiz-form-message'; renderFinalQuiz(); finalQuizForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  renderFinalQuiz();
}

/* Progressive reveal animations with a reduced-motion fallback. */
(() => {
  const revealNodes = [...document.querySelectorAll('.section-heading, .objective-card, .sequence-card, .guided-banner, .guided-completion, .quiz-heading, .declaration-card, .allocation-panel, .work-allocation, .file-organization, .resource-card, .final-cta-inner, .planning-step, .phase-card, .role-card')];
  revealNodes.forEach((node, index) => {
    node.classList.add('motion-reveal');
    node.style.setProperty('--motion-delay', `${Math.min(index % 6, 5) * 65}ms`);
  });
  const rail = document.querySelector('.program-rail');
  rail?.classList.add('timeline-ready');
  rail?.querySelectorAll('.rail-step').forEach((step, index) => step.style.setProperty('--timeline-delay', `${index * 90}ms`));
  if (typeof window.IntersectionObserver !== 'function') {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }
  try {
    const observer = new window.IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        instance.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    revealNodes.forEach((node) => observer.observe(node));
  } catch (error) {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  }
})();

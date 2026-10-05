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
    railProgress.style.height = window.innerWidth <= 720 ? '2px' : `${Math.min(100, activeIndex * 16.5 + 5)}%`;
    railProgress.style.width = window.innerWidth <= 720 ? `${Math.min(100, activeIndex * 16.5 + 5)}%` : '2px';
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
      activateSequence(card.dataset.sequence);
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
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    }
  });
}, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
observedSections.forEach((section) => sectionObserver.observe(section));

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
    { question: 'Quel est le rôle principal d’un programme de travail ?', options: ['Remplacer le rapport final', 'Décrire les contrôles, les preuves et les conclusions attendues', 'Lister uniquement les impôts', 'Servir de feuille de présence'], answer: 1, explanation: 'Le programme relie objectif, risque, procédure, preuve et conclusion afin de guider et démontrer les travaux.' },
    { question: 'Quel élément doit être adapté à chaque entreprise ?', options: ['Le logo du cabinet', 'Le périmètre, les risques et les procédures de contrôle', 'La couleur des feuilles', 'Le nombre de pages du rapport'], answer: 1, explanation: 'Un programme de travail est une base méthodologique à adapter à l’activité, au régime fiscal, à la période et aux risques.' },
    { question: 'Quelle taxe fait partie des axes de revue présentés ?', options: ['TVA', 'Taxe de stationnement interne', 'Taxe sur les loisirs personnels', 'Aucune taxe sur les opérations'], answer: 0, explanation: 'La TVA fait partie des programmes de revue, avec notamment les retenues, impôts et contributions listés dans la séquence.' },
    { question: 'Pour une revue de TVA, quel rapprochement est pertinent ?', options: ['Factures, journaux, déclarations et paiements', 'Agenda et congés', 'Courriers uniquement', 'Inventaire du mobilier uniquement'], answer: 0, explanation: 'Le rapprochement entre opérations, comptabilité, déclarations et paiements permet de tester la cohérence du traitement.' },
    { question: 'Que doit contenir une feuille de travail bien référencée ?', options: ['Une conclusion sans pièce', 'Une référence reliée au test et à la preuve examinée', 'Un commentaire oral uniquement', 'Un fichier sans date'], answer: 1, explanation: 'La référence permet de retrouver le test, la pièce justificative et la conclusion associée.' },
    { question: 'Quel est le rôle du Chef de mission dans le programme ?', options: ['Construire, répartir et suivre les travaux', 'Exécuter toutes les tâches seul', 'Ne jamais revoir les travaux', 'Valider les paiements du client'], answer: 0, explanation: 'Le Chef construit le programme, répartit les tests et suit l’avancement de l’équipe.' },
    { question: 'Qui intervient pour revoir les zones sensibles et arbitrer les conclusions majeures ?', options: ['Le Stagiaire', 'Le Directeur de mission', 'Le client seul', 'Le fournisseur'], answer: 1, explanation: 'Le Directeur de mission revoit les zones sensibles, arbitre et valide les conclusions importantes.' },
    { question: 'Le programme de travail doit être actualisé lorsque…', options: ['Les risques ou l’activité évoluent', 'La mission est terminée depuis longtemps', 'Le dossier change de couleur', 'Aucune information nouvelle n’apparaît'], answer: 0, explanation: 'Le programme doit rester aligné avec les risques, les changements d’activité et les informations nouvelles.' },
    { question: 'Quel est l’objectif du programme relatif au résultat fiscal et à l’IS ?', options: ['Ignorer le résultat comptable', 'Documenter le passage du résultat comptable au résultat fiscal et recalculer l’impôt', 'Vérifier uniquement les immobilisations', 'Remplacer la balance générale'], answer: 1, explanation: 'La revue examine les retraitements, les déductions, les réintégrations et la cohérence du calcul de l’impôt.' },
    { question: 'Avant de conclure un programme, il faut s’assurer que…', options: ['La procédure est référencée, la preuve est suffisante et la conclusion est revue', 'Le programme est resté vierge', 'Les anomalies sont supprimées', 'La preuve n’est pas conservée'], answer: 0, explanation: 'Les quatre portes de qualité sont : complet, référencé, revu et actionnable.' }
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
    resultMessage3.textContent = score >= 16 ? 'Très bon résultat. Vous savez construire et piloter un programme de revue.' : score >= 10 ? 'Les bases sont là. Relisez la ligne de programme et les axes fiscaux.' : 'Reprenez la structure d’un programme et le rôle de chaque niveau de supervision.';
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

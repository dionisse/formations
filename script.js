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

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

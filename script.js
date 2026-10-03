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

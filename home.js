const searchInput = document.querySelector('#course-search');
const courseCards = [...document.querySelectorAll('.home-course-card[data-course-type]')];
const filterButtons = [...document.querySelectorAll('[data-course-filter]')];
const resultCount = document.querySelector('#course-result-count');
const emptyState = document.querySelector('#course-empty-state');
const menuToggle = document.querySelector('.home-menu-toggle');
const homeNav = document.querySelector('#home-nav');

let activeFilter = 'all';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
}

function updateCatalogue() {
  const query = normalize(searchInput?.value.trim());
  let visibleCount = 0;

  courseCards.forEach((card) => {
    const matchesFilter = activeFilter === 'all' || card.dataset.courseType === activeFilter;
    const searchText = normalize(`${card.dataset.courseSearch || ''} ${card.textContent}`);
    const matchesSearch = !query || searchText.includes(query);
    const visible = matchesFilter && matchesSearch;
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  if (resultCount) {
    resultCount.textContent = `${String(visibleCount).padStart(2, '0')} parcours`;
  }
  if (emptyState) emptyState.hidden = visibleCount !== 0;
}

searchInput?.addEventListener('input', updateCatalogue);
filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.courseFilter || 'all';
    filterButtons.forEach((filterButton) => {
      const active = filterButton === button;
      filterButton.classList.toggle('is-active', active);
      filterButton.setAttribute('aria-pressed', String(active));
    });
    updateCatalogue();
  });
});

menuToggle?.addEventListener('click', () => {
  const isOpen = homeNav?.classList.toggle('is-open') || false;
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
});
homeNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    homeNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Ouvrir le menu');
  });
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput?.focus();
  }
  if (event.key === 'Escape' && homeNav?.classList.contains('is-open')) {
    homeNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Ouvrir le menu');
  }
});

updateCatalogue();

const COURSE_CATALOG = [
  {
    version: 'formation-fiscale-v1',
    title: 'Méthodologie fiscale',
    category: 'FISCALITÉ',
    format: 'PARCOURS GUIDÉ',
    description: 'Un itinéraire professionnel pour structurer la revue fiscale, les déclarations, la paie, le contrôle et le conseil.',
    sequenceCount: 7,
    durationLabel: '7 séquences',
    actionUrl: '/#programme',
    actionLabel: 'Reprendre la formation',
    visualLabel: 'CABINET GOBEX · SÉMINAIRE',
    visualNumber: '07',
    sequenceLabels: [
      'Installer le cadre du séminaire',
      'Méthodologie des missions de revue fiscale',
      'Construire les programmes de travail',
      'Établir et revoir les déclarations fiscales',
      'Traiter la paie avec méthode',
      'Accompagner un contrôle fiscal',
      'Formuler une consultation fiscale'
    ]
  }
];

const loginView = document.querySelector('#platform-login-view');
const dashboard = document.querySelector('#platform-dashboard');
const courseGrid = document.querySelector('#training-catalog');
const loadStatus = document.querySelector('#platform-load-status');
const syncStatus = document.querySelector('#participant-sync-status');
const greetingName = document.querySelector('#platform-greeting-name');
const trainingCount = document.querySelector('#platform-training-count');
const activeCount = document.querySelector('#platform-active-count');
const trainingLabel = document.querySelector('#platform-training-label');
const catalogueCount = document.querySelector('#platform-catalogue-count');
const catalogueLink = document.querySelector('#platform-catalogue-link');

let currentSession = null;
let refreshVersion = 0;
let unsubscribe = () => {};

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function participantFirstName(user) {
  const metadata = user?.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || '';
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName || user?.email?.split('@')[0] || 'participant';
}

function readParticipantLocalProgress(course, userId) {
  if (!userId) return null;
  const courseVersion = course.version;
  const sequenceCount = Math.max(1, Number(course.sequenceCount) || 1);
  const keys = [
    `fiscale-guided-progress-v2:${courseVersion}:participant:${userId}`,
    `fiscale-guided-progress-v2:participant:${userId}`
  ];
  let raw = null;
  for (const key of keys) {
    try { raw = localStorage.getItem(key); } catch (error) { /* stockage local indisponible */ }
    if (!raw) {
      const cookieName = encodeURIComponent(key);
      const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${cookieName}=`));
      if (cookie) {
        try { raw = decodeURIComponent(cookie.slice(cookieName.length + 1)); } catch (error) { raw = null; }
      }
    }
    if (raw) break;
  }
  if (!raw) return null;
  try {
    const progress = JSON.parse(raw);
    if (!progress || progress.courseVersion !== courseVersion || !Array.isArray(progress.completed)) return null;
    const completed = [...new Set(progress.completed.filter((number) => Number.isInteger(number) && number >= 1 && number <= sequenceCount))];
    const current = Number(progress.current);
    const savedAt = Date.parse(progress.lastSavedAt || '');
    return {
      courseVersion,
      completed,
      current: Number.isInteger(current) && current >= 1 && current <= sequenceCount ? current : 1,
      lastSavedAt: Number.isFinite(savedAt) ? new Date(savedAt).toISOString() : new Date(0).toISOString(),
      scrollY: Math.max(0, Number(progress.scrollY) || 0),
      source: 'local'
    };
  } catch (error) {
    return null;
  }
}

function normalizeRemoteProgress(row, course) {
  if (!row || !Array.isArray(row.completed)) return null;
  const sequenceCount = Math.max(1, Number(course.sequenceCount) || 1);
  const completed = [...new Set(row.completed.map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= sequenceCount))];
  const current = Number(row.current_sequence);
  const savedAt = Date.parse(row.last_saved_at || '');
  return {
    courseVersion: row.course_version,
    completed,
    current: Number.isInteger(current) && current >= 1 && current <= sequenceCount ? current : 1,
    lastSavedAt: Number.isFinite(savedAt) ? new Date(savedAt).toISOString() : new Date(0).toISOString(),
    scrollY: Math.max(0, Number(row.scroll_y) || 0),
    source: 'remote'
  };
}

function selectNewestProgress(localState, remoteState) {
  if (!localState) return remoteState;
  if (!remoteState) return localState;
  return Date.parse(localState.lastSavedAt) > Date.parse(remoteState.lastSavedAt) ? localState : remoteState;
}

function progressForRow(course, rows, userId) {
  const localState = readParticipantLocalProgress(course, userId);
  const remoteRow = rows.find((row) => row.course_version === course.version);
  return selectNewestProgress(localState, normalizeRemoteProgress(remoteRow, course));
}

function courseProgressPercent(progress, sequenceCount) {
  if (!progress || !sequenceCount) return 0;
  return Math.min(100, Math.round((progress.completed.length / sequenceCount) * 100));
}

function hasStarted(progress) {
  return Boolean(progress && (progress.completed.length > 0 || progress.current > 1 || progress.scrollY > 0));
}

function progressLabel(progress, course) {
  if (!progress || (!progress.completed.length && progress.current === 1 && !progress.scrollY)) {
    return 'Prête à commencer';
  }
  if (progress.completed.length >= course.sequenceCount) return 'Formation terminée';
  const completedText = `${progress.completed.length} séquence${progress.completed.length > 1 ? 's' : ''} terminée${progress.completed.length > 1 ? 's' : ''}`;
  const nextNumber = Math.min(progress.current, course.sequenceCount);
  const nextTitle = course.sequenceLabels?.[nextNumber - 1] || `Séquence ${String(nextNumber).padStart(2, '0')}`;
  return `${completedText} · prochaine : ${nextTitle}`;
}

function renderCourseCard(course, progress) {
  const completedCount = progress?.completed.length || 0;
  const percentage = courseProgressPercent(progress, course.sequenceCount);
  const title = safeText(course.title);
  const category = safeText(course.category);
  const format = safeText(course.format);
  const description = safeText(course.description);
  const label = safeText(progressLabel(progress, course));
  const duration = safeText(course.durationLabel);
  const visualLabel = safeText(course.visualLabel);
  const visualNumber = safeText(course.visualNumber);
  const actionLabel = safeText(hasStarted(progress) ? course.actionLabel : 'Commencer la formation');
  const actionUrl = safeText(course.actionUrl);

  return `<article class="training-course-card" data-course-version="${safeText(course.version)}">
    <div class="training-course-visual" aria-hidden="true">
      <span class="course-visual-grid"></span><span class="course-visual-number">${visualNumber}</span>
      <span class="course-visual-badge">${format}</span><span class="course-visual-label">${visualLabel}</span>
    </div>
    <div class="training-course-body">
      <div class="training-course-meta"><span>${category}</span><i></i><span>${format}</span></div>
      <h3>${title}</h3>
      <p class="training-course-description">${description}</p>
      <div class="course-progress">
        <div class="course-progress-top"><span>${label}</span><strong>${percentage}%</strong></div>
        <div class="course-progress-track" role="progressbar" aria-label="Progression de ${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><div class="course-progress-bar" style="width:${percentage}%"></div></div>
      </div>
      <div class="training-course-footer"><span class="course-sequence-count">${duration}</span><a class="training-course-button" href="${actionUrl}">${actionLabel}<span aria-hidden="true">→</span></a></div>
    </div>
  </article>`;
}

function renderCatalogue(rows, userId) {
  const items = COURSE_CATALOG
    .filter((course) => course.available !== false)
    .map((course) => ({ course, progress: progressForRow(course, rows, userId) }));
  const startedCount = items.filter(({ progress }) => hasStarted(progress)).length;
  if (trainingCount) trainingCount.textContent = String(items.length).padStart(2, '0');
  if (trainingLabel) trainingLabel.textContent = items.length === 1 ? 'formation disponible' : 'formations disponibles';
  if (activeCount) activeCount.textContent = String(startedCount).padStart(2, '0');
  if (catalogueCount) catalogueCount.textContent = `${String(items.length).padStart(2, '0')} PARCOURS`;
  if (courseGrid) {
    courseGrid.innerHTML = items.map(({ course, progress }) => renderCourseCard(course, progress)).join('');
  }
}

function showLogin() {
  if (loginView) loginView.hidden = false;
  if (dashboard) dashboard.hidden = true;
}

async function loadDashboard(session) {
  const version = ++refreshVersion;
  const user = session?.user;
  if (!user) {
    showLogin();
    return;
  }
  currentSession = session;
  if (loginView) loginView.hidden = true;
  if (dashboard) dashboard.hidden = false;
  if (greetingName) greetingName.textContent = participantFirstName(user);
  if (loadStatus) loadStatus.textContent = 'Chargement de vos formations…';
  if (syncStatus) {
    syncStatus.textContent = 'Chargement de votre progression…';
    syncStatus.dataset.state = 'pending';
  }
  if (courseGrid) courseGrid.innerHTML = '';

  const auth = window.fiscaleParticipantAuth;
  const client = auth?.client;
  const courseVersions = COURSE_CATALOG.filter((course) => course.available !== false).map((course) => course.version);
  let rows = [];
  let remoteError = null;

  if (client && courseVersions.length) {
    try {
      const result = await client.from('participant_progress')
        .select('course_version, completed, current_sequence, scroll_y, last_saved_at')
        .eq('user_id', user.id)
        .in('course_version', courseVersions);
      if (result.error) remoteError = result.error;
      else rows = result.data || [];
    } catch (error) {
      remoteError = error;
    }
  } else {
    remoteError = new Error('Supabase non configuré.');
  }

  if (version !== refreshVersion || currentSession?.user?.id !== user.id) return;
  renderCatalogue(rows, user.id);
  if (loadStatus) loadStatus.textContent = '';

  const hasLocalProgress = COURSE_CATALOG.some((course) => readParticipantLocalProgress(course, user.id));
  if (syncStatus) {
    if (remoteError) {
      syncStatus.textContent = hasLocalProgress
        ? 'Serveur indisponible : la progression enregistrée sur cet appareil reste consultable.'
        : 'La synchronisation sera disponible dès que le projet Supabase sera configuré.';
      syncStatus.dataset.state = 'warning';
    } else {
      syncStatus.textContent = 'Progression synchronisée avec votre compte participant.';
      syncStatus.dataset.state = 'success';
    }
  }
}

catalogueLink?.addEventListener('click', (event) => {
  if (!currentSession) {
    event.preventDefault();
    document.querySelector('#platform-login-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector('#participant-google-login')?.focus({ preventScroll: true });
  }
});

if (window.fiscaleParticipantAuth) {
  const auth = window.fiscaleParticipantAuth;
  unsubscribe = auth.subscribe((session) => {
    currentSession = session || null;
    if (session?.user) void loadDashboard(session);
    else {
      refreshVersion += 1;
      showLogin();
    }
  });
  auth.ready.then(() => {
    const session = auth.session;
    currentSession = session || null;
    if (session?.user) void loadDashboard(session);
    else showLogin();
  }).catch((error) => {
    console.error('Participant platform initialization failed:', error);
    showLogin();
  });
} else {
  if (loadStatus) loadStatus.textContent = 'Le service de connexion n’a pas pu démarrer. Actualisez la page pour réessayer.';
}

window.addEventListener('pagehide', () => unsubscribe());

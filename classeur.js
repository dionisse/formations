const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const passwordInput = document.querySelector('#login-password');
const togglePassword = document.querySelector('#toggle-password');
const folderNav = document.querySelector('#folder-nav');
const folderSearch = document.querySelector('#folder-search');
let dossier = null;
let currentFolderId = '01';
const seenFolders = new Set();

const request = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Une erreur est survenue.');
  return payload;
};

function showLogin(message = '') {
  appView.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message;
}
function requireUser(payload) {
  if (!payload || payload.authenticated !== true || !payload.user || typeof payload.user !== 'object') {
    throw new Error('La session est invalide ou a expiré. Veuillez vous reconnecter.');
  }
  const email = String(payload.user.email || '').trim();
  const name = String(payload.user.name || email || 'Participant').trim();
  if (!email) throw new Error('Le serveur n’a pas renvoyé l’identité du participant.');
  return { email, name };
}
function showApp(user) {
  const safeUser = user && typeof user === 'object' ? user : {};
  loginView.hidden = true;
  appView.hidden = false;
  document.querySelector('#user-name').textContent = safeUser.name || safeUser.email || 'Participant';
  document.querySelector('#user-email').textContent = safeUser.email || '';
}
function flattenFolders(folders) {
  return folders.flatMap((folder) => [folder, ...(folder.children || [])]);
}
function getFolder(id) { return flattenFolders(dossier.folders).find((folder) => folder.id === id); }
function renderNavigation() {
  const query = folderSearch.value.trim().toLowerCase();
  folderNav.innerHTML = dossier.folders.map((folder) => {
    const matchesParent = `${folder.id} ${folder.title} ${folder.description}`.toLowerCase().includes(query);
    const children = folder.children || [];
    const visibleChildren = children.filter((child) => `${child.id} ${child.title} ${child.description}`.toLowerCase().includes(query) || matchesParent);
    if (query && !matchesParent && visibleChildren.length === 0) return '';
    return `<div class="folder-group"><button class="folder-button ${folder.id === currentFolderId ? 'active' : ''}" type="button" data-folder-id="${folder.id}"><span class="folder-number">${folder.id}</span><span><strong>${folder.title}</strong><small>${folder.description}</small></span>${children.length ? '<b class="folder-chevron">⌄</b>' : ''}</button>${children.length ? `<div class="folder-children ${folder.id === '22' || visibleChildren.some((child) => child.id === currentFolderId) ? 'expanded' : ''}">${children.map((child) => `<button class="child-button ${child.id === currentFolderId ? 'active' : ''}" type="button" data-folder-id="${child.id}"><span>${child.id}</span>${child.title}</button>`).join('')}</div>` : ''}</div>`;
  }).join('');
  folderNav.querySelectorAll('[data-folder-id]').forEach((button) => button.addEventListener('click', () => selectFolder(button.dataset.folderId)));
}
function renderFolder(folder) {
  currentFolderId = folder.id;
  seenFolders.add(folder.id);
  document.querySelector('#breadcrumb-current').textContent = folder.title;
  document.querySelector('#page-title').textContent = folder.title;
  document.querySelector('#page-description').textContent = folder.description;
  document.querySelector('#folder-reference').textContent = folder.reference;
  document.querySelector('#folder-status').textContent = seenFolders.has(folder.id) ? 'Consulté' : 'À consulter';
  const isParent = Boolean(folder.children?.length);
  const documents = folder.documents || [];
  document.querySelector('#folder-content').innerHTML = `<div class="folder-hero"><div class="folder-icon">${isParent ? '▤' : '✓'}</div><div><span class="folder-eyebrow">RUBRIQUE ${folder.id}</span><h2>${folder.title}</h2><p>${folder.objective || folder.description}</p></div><span class="folder-read-only">LECTURE SEULE</span></div>${isParent ? `<div class="subfolder-callout"><span>↘</span><div><strong>Cette rubrique contient ${folder.children.length} sous-rubriques.</strong><p>Utilisez l’index à gauche pour consulter chaque partie du dossier.</p></div></div>` : ''}<div class="detail-grid"><section class="detail-card"><div class="detail-card-head"><span>DOCUMENTS ATTENDUS</span><b>${documents.length.toString().padStart(2, '0')}</b></div><ul class="document-list">${documents.map((item) => `<li><span class="document-check">✓</span><span>${item}</span></li>`).join('')}</ul></section><section class="detail-card reference-card"><div class="detail-card-head"><span>RÉFÉRENCEMENT</span><b>${folder.reference}</b></div><div class="reference-example"><span>Exemple de classement</span><strong>${folder.reference}.FT-01</strong><small>Feuille de travail · consultation uniquement</small><strong>${folder.reference}.PJ-01</strong><small>Pièce justificative rattachée</small></div></section></div><div class="read-only-note"><span>⌑</span><div><strong>Espace de consultation</strong><p>Les fichiers réels du client ne sont pas importés dans ce classeur. Cette page présente l’ordre de classement, les documents attendus et les repères de la mission.</p></div></div>`;
  updateProgress();
  renderNavigation();
}
function selectFolder(id) { const folder = getFolder(id); if (folder) renderFolder(folder); }
function updateProgress() {
  const total = flattenFolders(dossier.folders).length;
  const percent = Math.round((seenFolders.size / total) * 100);
  document.querySelector('#progress-count').textContent = `${seenFolders.size} / ${total} consultés`;
  document.querySelector('#progress-percent').textContent = `${percent}%`;
  document.querySelector('#progress-bar').style.width = `${percent}%`;
  document.querySelector('#folder-count').textContent = `${dossier.folders.length} rubriques · ${flattenFolders(dossier.folders).length - dossier.folders.length} sous-rubriques`;
}
async function openSession() {
  try {
    const session = await request('/api/session');
    const user = requireUser(session);
    dossier = await request('/api/dossier');
    showApp(user);
    renderFolder(getFolder(currentFolderId));
  } catch { showLogin(); }
}
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const session = await request('/api/login', { method: 'POST', body: JSON.stringify({ email: loginForm.email.value, password: loginForm.password.value }) });
    const user = requireUser(session);
    dossier = await request('/api/dossier');
    showApp(user);
    renderFolder(getFolder(currentFolderId));
  } catch (error) { loginError.textContent = error.message; } finally { button.disabled = false; }
});
togglePassword.addEventListener('click', () => { passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password'; togglePassword.textContent = passwordInput.type === 'password' ? '◉' : '◌'; });
document.querySelector('#logout-button').addEventListener('click', async () => { await request('/api/logout', { method: 'POST' }).catch(() => {}); dossier = null; seenFolders.clear(); showLogin(); });
folderSearch.addEventListener('input', renderNavigation);
openSession();

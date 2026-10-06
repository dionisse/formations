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
  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  } catch {
    throw new Error('Le serveur sécurisé est inaccessible. Lancez « npm run server » puis rechargez cette page.');
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    if (response.status === 404 || !contentType.includes('application/json')) throw new Error('Cette page n’est pas reliée au serveur sécurisé. Lancez « npm run server » puis ouvrez http://localhost:4173.');
    throw new Error(payload.error || `La requête a échoué (${response.status}).`);
  }
  return payload;
};

async function uploadRequest(url, file, method = 'POST') {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
    });
  } catch {
    throw new Error('Le fichier n’a pas pu être envoyé au serveur.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `L’envoi a échoué (${response.status}).`);
  return payload;
}

function showLogin(message = '') {
  appView.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message;
}
function requireUser(payload) {
  if (!payload || payload.authenticated !== true || !payload.user || typeof payload.user !== 'object') throw new Error('La session est invalide ou a expiré. Veuillez vous reconnecter.');
  const email = String(payload.user.email || '').trim();
  const name = String(payload.user.name || email || 'Participant').trim();
  if (!email) throw new Error('Le serveur n’a pas renvoyé l’identité du participant.');
  return { email, name, developmentBypass: payload.developmentBypass === true };
}
function showApp(user) {
  const safeUser = user && typeof user === 'object' ? user : {};
  loginView.hidden = true;
  appView.hidden = false;
  document.querySelector('#user-name').textContent = safeUser.name || safeUser.email || 'Participant';
  document.querySelector('#user-email').textContent = safeUser.email || '';
  document.querySelector('#session-mode').textContent = safeUser.developmentBypass ? 'Mode développement' : 'Session sécurisée';
  appView.classList.toggle('development-mode', Boolean(safeUser.developmentBypass));
}
function flattenFolders(folders) { return folders.flatMap((folder) => [folder, ...(folder.children || [])]); }
function getFolder(id) { return flattenFolders(dossier.folders).find((folder) => folder.id === id); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function formatBytes(bytes) {
  if (!bytes) return '0 octet';
  if (bytes < 1024) return `${bytes} octets`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function formatDate(value) { return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Date inconnue'; }
function filesForFolder(folderId) { return (dossier.files || []).filter((file) => file.folderId === folderId); }

function renderNavigation() {
  const query = folderSearch.value.trim().toLowerCase();
  folderNav.innerHTML = dossier.folders.map((folder) => {
    const matchesParent = `${folder.id} ${folder.title} ${folder.description}`.toLowerCase().includes(query);
    const children = folder.children || [];
    const visibleChildren = children.filter((child) => `${child.id} ${child.title} ${child.description}`.toLowerCase().includes(query) || matchesParent);
    if (query && !matchesParent && visibleChildren.length === 0) return '';
    return `<div class="folder-group"><button class="folder-button ${folder.id === currentFolderId ? 'active' : ''}" type="button" data-folder-id="${folder.id}"><span class="folder-number">${folder.id}</span><span><strong>${escapeHtml(folder.title)}</strong><small>${escapeHtml(folder.description)}</small></span>${children.length ? '<b class="folder-chevron">⌄</b>' : ''}</button>${children.length ? `<div class="folder-children ${folder.id === '22' || visibleChildren.some((child) => child.id === currentFolderId) ? 'expanded' : ''}">${children.map((child) => `<button class="child-button ${child.id === currentFolderId ? 'active' : ''}" type="button" data-folder-id="${child.id}"><span>${child.id}</span>${escapeHtml(child.title)}</button>`).join('')}</div>` : ''}</div>`;
  }).join('');
  folderNav.querySelectorAll('[data-folder-id]').forEach((button) => button.addEventListener('click', () => selectFolder(button.dataset.folderId)));
}

function renderFiles(folder) {
  const files = filesForFolder(folder.id);
  if (!files.length) return '<div class="file-empty"><span>＋</span><div><strong>Aucun fichier ajouté dans cette rubrique.</strong><small>Ajoutez les pièces du dossier ici pour les retrouver au même endroit que leur référence pédagogique.</small></div></div>';
  return `<div class="file-list">${files.map((file) => `<article class="file-row"><span class="file-type">${escapeHtml((file.mimeType || 'DOC').split('/').pop().slice(0, 4).toUpperCase())}</span><div class="file-main"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)} · dernière modification ${formatDate(file.updatedAt)} · stockage local : ${escapeHtml(file.localPath || 'dossier')}</small></div><div class="file-actions"><a href="/api/files/${encodeURIComponent(file.id)}" target="_blank" rel="noopener">Consulter</a><button type="button" data-file-action="rename" data-file-id="${escapeHtml(file.id)}">Renommer</button><button type="button" data-file-action="replace" data-file-id="${escapeHtml(file.id)}">Remplacer</button><button type="button" class="file-danger" data-file-action="delete" data-file-id="${escapeHtml(file.id)}">Supprimer</button></div></article>`).join('')}</div>`;
}

function renderFolder(folder) {
  currentFolderId = folder.id;
  seenFolders.add(folder.id);
  const files = filesForFolder(folder.id);
  const isParent = Boolean(folder.children?.length);
  const documents = folder.documents || [];
  document.querySelector('#breadcrumb-current').textContent = folder.title;
  document.querySelector('#page-title').textContent = folder.title;
  document.querySelector('#page-description').textContent = folder.description;
  document.querySelector('#folder-reference').textContent = folder.reference;
  document.querySelector('#folder-status').textContent = `${files.length} fichier${files.length > 1 ? 's' : ''}`;
  document.querySelector('#folder-content').innerHTML = `<div class="folder-hero"><div class="folder-icon">${isParent ? '▤' : '✓'}</div><div><span class="folder-eyebrow">RUBRIQUE ${folder.id}</span><h2>${escapeHtml(folder.title)}</h2><p>${escapeHtml(folder.objective || folder.description)}</p></div><span class="folder-read-only">ACCÈS DOSSIER</span></div>${isParent ? `<div class="subfolder-callout"><span>↘</span><div><strong>Cette rubrique contient ${folder.children.length} sous-rubriques.</strong><p>Utilisez l’index à gauche pour consulter chaque partie du dossier.</p></div></div>` : ''}<section class="folder-files"><div class="folder-files-head"><div><span class="folder-section-label">FICHIERS DU DOSSIER</span><h3>Les pièces de cette rubrique</h3><p>Ajoutez, consultez, renommez ou remplacez les fichiers liés à ce dossier.</p></div><div><button id="add-file-button" class="file-add-button" type="button">＋ Ajouter un fichier</button><input id="file-input" type="file" multiple hidden /></div></div><div id="upload-status" class="upload-status" role="status"></div>${renderFiles(folder)}</section><div class="detail-grid"><section class="detail-card"><div class="detail-card-head"><span>DOCUMENTS ATTENDUS</span><b>${documents.length.toString().padStart(2, '0')}</b></div><ul class="document-list">${documents.map((item) => `<li><span class="document-check">✓</span><span>${escapeHtml(item)}</span></li>`).join('')}</ul></section><section class="detail-card reference-card"><div class="detail-card-head"><span>RÉFÉRENCEMENT</span><b>${escapeHtml(folder.reference)}</b></div><div class="reference-example"><span>Exemple de classement</span><strong>${escapeHtml(folder.reference)}.FT-01</strong><small>Feuille de travail liée à cette rubrique</small><strong>${escapeHtml(folder.reference)}.PJ-01</strong><small>Pièce justificative rattachée</small></div></section></div><div class="read-only-note"><span>⌑</span><div><strong>Un point d’accès au dossier</strong><p>Les fichiers sont conservés dans l’espace de travail du dossier. Le classeur organise leur accès par rubrique sans dupliquer les documents.</p></div></div>`;
  bindFolderActions(folder);
  updateProgress();
  renderNavigation();
}

function setUploadStatus(message, error = false) {
  const status = document.querySelector('#upload-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', error);
}
async function reloadCurrentFolder() {
  dossier = await request('/api/dossier');
  renderFolder(getFolder(currentFolderId));
}
async function addFiles(folder, files) {
  if (!files.length) return;
  setUploadStatus(`Envoi de ${files.length} fichier${files.length > 1 ? 's' : ''}…`);
  try {
    for (const file of files) await uploadRequest(`/api/files?folderId=${encodeURIComponent(folder.id)}`, file);
    await reloadCurrentFolder();
  } catch (error) { setUploadStatus(error.message, true); }
}
async function replaceFile(fileId, file) {
  setUploadStatus('Remplacement du fichier…');
  try { await uploadRequest(`/api/files/${encodeURIComponent(fileId)}`, file, 'PUT'); await reloadCurrentFolder(); }
  catch (error) { setUploadStatus(error.message, true); }
}
async function bindFileInput(input, folder) {
  const files = [...input.files];
  const replaceId = input.dataset.replaceId;
  input.value = '';
  delete input.dataset.replaceId;
  if (replaceId && files[0]) return replaceFile(replaceId, files[0]);
  return addFiles(folder, files);
}
function bindFolderActions(folder) {
  const input = document.querySelector('#file-input');
  document.querySelector('#add-file-button').addEventListener('click', () => input.click());
  input.addEventListener('change', () => bindFileInput(input, folder));
  document.querySelectorAll('[data-file-action]').forEach((button) => button.addEventListener('click', async () => {
    const file = (dossier.files || []).find((item) => item.id === button.dataset.fileId);
    if (!file) return;
    if (button.dataset.fileAction === 'replace') { input.dataset.replaceId = file.id; input.click(); return; }
    if (button.dataset.fileAction === 'rename') {
      const name = window.prompt('Nouveau nom du fichier', file.name);
      if (!name || name.trim() === file.name) return;
      try { await request(`/api/files/${encodeURIComponent(file.id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }); await reloadCurrentFolder(); }
      catch (error) { setUploadStatus(error.message, true); }
      return;
    }
    if (button.dataset.fileAction === 'delete' && window.confirm(`Supprimer « ${file.name} » du dossier ?`)) {
      try { await request(`/api/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' }); await reloadCurrentFolder(); }
      catch (error) { setUploadStatus(error.message, true); }
    }
  }));
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
  } catch (error) { showLogin(error.message === 'Authentification requise.' ? '' : error.message); }
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

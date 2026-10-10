

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

const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const googleLoginPanel = document.querySelector('#google-login-panel');
const loginError = document.querySelector('#participant-auth-status');
const accessPanel = document.querySelector('#course-access-panel');
const accessMessage = document.querySelector('#course-access-message');
const accessStatus = document.querySelector('#course-access-status');
const requestAccessButton = document.querySelector('#request-course-access');
const paymentWhatsappLink = document.querySelector('#course-payment-whatsapp');
const folderNav = document.querySelector('#folder-nav');
const folderSearch = document.querySelector('#folder-search');
const courseVersion = 'formation-fiscale-v1';
const trainingWhatsappNumber = '2290190895323';
let dossier = null;
let currentFolderId = '01';
let sessionLoadVersion = 0;
const seenFolders = new Set();

async function authHeaders(extra = {}) {
  const auth = window.fiscaleParticipantAuth;
  if (auth?.ready) await auth.ready;
  const token = auth?.session?.access_token;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

const request = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: await authHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) })
    });
  } catch {
    throw new Error('Le serveur sécurisé est inaccessible. Lancez « npm run server » puis rechargez cette page.');
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    const error = new Error(payload.error || `La requête a échoué (${response.status}).`);
    error.status = response.status;
    error.code = payload.code || '';
    error.payload = payload;
    if (response.status === 404 || !contentType.includes('application/json')) error.message = 'Cette page n’est pas reliée au serveur sécurisé. Lancez « npm run server » puis ouvrez http://localhost:4173.';
    throw error;
  }
  return payload;
};

async function uploadRequest(url, file, method = 'POST') {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: await authHeaders({ 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }),
      body: file
    });
  } catch {
    throw new Error('Le fichier n’a pas pu être envoyé au serveur.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `L’envoi a échoué (${response.status}).`);
    error.status = response.status;
    error.code = payload.code || '';
    throw error;
  }
  return payload;
}

async function openProtectedFile(fileId) {
  const viewer = window.open('about:blank', '_blank');
  if (!viewer) {
    setUploadStatus('Autorisez les fenêtres contextuelles pour ouvrir ce fichier.', true);
    return;
  }
  viewer.opener = null;
  setUploadStatus('Vérification de votre accès et ouverture du fichier…');
  try {
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: await authHeaders()
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Ouverture impossible (${response.status}).`);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    viewer.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
    setUploadStatus('Fichier ouvert dans un nouvel onglet.');
  } catch (error) {
    viewer.close();
    setUploadStatus(error.message || 'Le fichier n’a pas pu être ouvert.', true);
  }
}

function showLogin(message = '') {
  appView.hidden = true;
  accessPanel.hidden = true;
  loginView.hidden = false;
  googleLoginPanel.hidden = false;
  if (window.fiscaleParticipantAuth?.session) {
    document.querySelector('#participant-google-login').hidden = false;
    document.querySelector('#participant-logout-button').hidden = false;
  }
  if (message) loginError.textContent = message;
}

function requireUser(payload) {
  if (!payload || payload.authenticated !== true || !payload.user || typeof payload.user !== 'object') throw new Error('La session est invalide ou a expiré. Veuillez vous reconnecter.');
  const email = String(payload.user.email || '').trim();
  const name = String(payload.user.name || email || 'Participant').trim();
  if (!email) throw new Error('Le serveur n’a pas renvoyé l’identité du participant.');
  return {
    id: payload.user.id,
    email,
    name,
    isAdmin: payload.isAdmin === true,
    developmentBypass: payload.developmentBypass === true,
    entitlement: payload.entitlement || null,
    entitlementCheckError: payload.entitlementCheckError === true
  };
}

function showAccess(user, session) {
  appView.hidden = true;
  loginView.hidden = false;
  googleLoginPanel.hidden = true;
  accessPanel.hidden = false;
  document.querySelector('#access-user-email').textContent = user.email;
  const status = session.entitlement?.status || 'not_requested';
  if (session.entitlementCheckError) {
    accessMessage.textContent = 'Nous ne pouvons pas vérifier le règlement pour le moment. Réessayez plus tard ou contactez le Cabinet GOBEX.';
    accessStatus.textContent = 'La vérification sécurisée de votre accès est temporairement indisponible.';
    requestAccessButton.disabled = true;
    paymentWhatsappLink.hidden = true;
  } else if (status === 'pending') {
    accessMessage.textContent = 'Votre demande a été enregistrée. Le classeur sera activé après confirmation du règlement par le Cabinet GOBEX.';
    accessStatus.textContent = 'Envoyez votre reçu à GOBEX en indiquant la référence de la demande ci-dessous.';
    requestAccessButton.disabled = true;
    requestAccessButton.textContent = 'Demande en attente de confirmation';
    configurePaymentWhatsApp(user, session.entitlement);
  } else if (status === 'revoked') {
    accessMessage.textContent = 'L’accès à cette formation n’est pas actif. Contactez le Cabinet GOBEX pour toute question sur votre règlement.';
    accessStatus.textContent = 'Une demande déjà clôturée ne peut pas être réouverte depuis le navigateur.';
    requestAccessButton.disabled = true;
    requestAccessButton.textContent = 'Contacter le Cabinet GOBEX';
    configurePaymentWhatsApp(user, session.entitlement);
  } else {
    accessMessage.textContent = 'L’accès au classeur et aux livrables s’active après confirmation du règlement de cette formation.';
    accessStatus.textContent = 'Préparez une demande puis envoyez votre reçu à GOBEX sur WhatsApp.';
    requestAccessButton.disabled = false;
    requestAccessButton.textContent = 'Préparer ma demande d’accès';
    paymentWhatsappLink.hidden = true;
  }
}

function configurePaymentWhatsApp(user, entitlement) {
  if (!paymentWhatsappLink || !entitlement?.id) {
    if (paymentWhatsappLink) paymentWhatsappLink.hidden = true;
    return;
  }
  const message = [
    'Bonjour GOBEX,',
    'Je souhaite faire confirmer mon règlement pour accéder aux livrables et au classeur de la formation fiscale.',
    `Compte participant : ${user.email}`,
    `Formation : ${courseVersion}`,
    `Référence de demande : ${entitlement.id}`,
    'Je joins mon reçu de paiement à ce message.'
  ].join('\n');
  paymentWhatsappLink.href = `https://wa.me/${trainingWhatsappNumber}?text=${encodeURIComponent(message)}`;
  paymentWhatsappLink.hidden = false;
}

function showApp(user) {
  loginView.hidden = true;
  accessPanel.hidden = true;
  appView.hidden = false;
  document.querySelector('#user-name').textContent = user.name || user.email || 'Participant';
  document.querySelector('#user-email').textContent = user.email || '';
  document.querySelector('#session-mode').textContent = user.developmentBypass ? 'Développement local' : user.isAdmin ? 'Administrateur vérifié' : 'Accès formation confirmé';
  document.querySelector('#admin-link').hidden = !user.isAdmin && !user.developmentBypass;
  document.querySelector('#logout-button').hidden = Boolean(user.developmentBypass);
  appView.classList.toggle('development-mode', Boolean(user.developmentBypass || user.isAdmin));
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
  return `<div class="file-list">${files.map((file) => `<article class="file-row"><span class="file-type">${escapeHtml((file.mimeType || 'DOC').split('/').pop().slice(0, 4).toUpperCase())}</span><div class="file-main"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)} · dernière modification ${formatDate(file.updatedAt)} · stockage local : ${escapeHtml(file.localPath || 'dossier')}</small></div><div class="file-actions"><a href="#" data-file-action="open" data-file-id="${escapeHtml(file.id)}">Consulter</a><button type="button" data-file-action="rename" data-file-id="${escapeHtml(file.id)}">Renommer</button><button type="button" data-file-action="replace" data-file-id="${escapeHtml(file.id)}">Remplacer</button><button type="button" class="file-danger" data-file-action="delete" data-file-id="${escapeHtml(file.id)}">Supprimer</button></div></article>`).join('')}</div>`;
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
  document.querySelectorAll('[data-file-action]').forEach((button) => button.addEventListener('click', async (event) => {
    const file = (dossier.files || []).find((item) => item.id === button.dataset.fileId);
    if (!file) return;
    if (button.dataset.fileAction === 'open') {
      event.preventDefault();
      await openProtectedFile(file.id);
      return;
    }
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
  const version = ++sessionLoadVersion;
  try {
    const session = await request('/api/session');
    if (version !== sessionLoadVersion) return;
    const user = requireUser(session);
    if (!user.isAdmin && !user.developmentBypass && (user.entitlementCheckError || user.entitlement?.status !== 'paid')) {
      showAccess(user, session);
      return;
    }
    const result = await request('/api/dossier');
    if (version !== sessionLoadVersion) return;
    dossier = result;
    showApp(user);
    renderFolder(getFolder(currentFolderId));
  } catch (error) {
    if (version !== sessionLoadVersion) return;
    if (error.status === 401) showLogin();
    else if (error.status === 402) {
      try {
        const session = await request('/api/session');
        showAccess(requireUser(session), session);
      } catch { showLogin(error.message); }
    } else showLogin(error.message);
  }
}

requestAccessButton?.addEventListener('click', async () => {
  requestAccessButton.disabled = true;
  accessStatus.textContent = 'Enregistrement de votre demande…';
  try {
    await request('/api/entitlements/request', {
      method: 'POST',
      body: JSON.stringify({ courseVersion })
    });
    await openSession();
  } catch (error) {
    accessStatus.textContent = error.message || 'La demande n’a pas pu être enregistrée.';
    requestAccessButton.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  const result = await window.fiscaleParticipantAuth?.signOut();
  if (result?.error) {
    window.alert('La déconnexion n’a pas abouti. Réessayez.');
    return;
  }
  dossier = null;
  seenFolders.clear();
  window.location.reload();
});
folderSearch.addEventListener('input', renderNavigation);

const participantAuth = window.fiscaleParticipantAuth;
participantAuth?.subscribe(() => { void openSession(); });
participantAuth?.ready.then(() => { void openSession(); }).catch((error) => {
  showLogin('Le service de connexion n’a pas pu démarrer. Réessayez plus tard.');
  console.error('Workbook auth initialization failed:', error);
});
if (!participantAuth) showLogin('Le service de connexion n’a pas pu démarrer. Actualisez la page.');

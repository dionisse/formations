/* Fichiers du classeur conservés dans le Google Drive du participant.
   L'application n'héberge aucun document : le navigateur envoie les pièces directement
   dans le dossier « Fiscale — Dossier » du Drive du participant (portée drive.file,
   limitée aux fichiers créés par l'application) et lit la liste depuis ce même dossier.
   Le seul secret conservé côté serveur est le jeton hors ligne, échangé par /api/drive-token. */

(() => {
  const TOKEN_ENDPOINT = '/api/drive-token';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const ROOT_FOLDER_NAME = 'Fiscale — Dossier';
  const INDEX_FILE_NAME = 'dossier-index.json';
  const FOLDER_LABEL = `Mon Drive / ${ROOT_FOLDER_NAME}`;
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,appProperties,webViewLink';

  let accessToken = '';
  let accessTokenExpiresAt = 0;
  let rootFolderId = '';
  let indexFileId = '';
  let lastError = null;
  let linkState = { known: false, connected: false, mail: '' };
  let banner = null;

  const auth = () => window.fiscaleParticipantAuth || null;

  async function bearerToken() {
    const participantAuth = auth();
    if (participantAuth?.ready) await participantAuth.ready;
    return participantAuth?.session?.access_token || '';
  }

  async function readJson(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message || payload.error || `Google Drive a refusé la demande (${response.status}).`);
      error.status = response.status;
      error.code = payload.error?.errors?.[0]?.reason || payload.code || '';
      throw error;
    }
    return payload;
  }

  async function driveAccess(force = false) {
    if (!force && accessToken && Date.now() < accessTokenExpiresAt - 60 * 1000) return accessToken;
    const token = await bearerToken();
    if (!token) {
      lastError = 'Connectez-vous avec votre compte Google pour retrouver vos fichiers.';
      const error = new Error(lastError);
      error.code = 'session_required';
      throw error;
    }
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'L’accès à votre Google Drive est momentanément indisponible.');
      error.status = response.status;
      error.code = payload.code || '';
      if (error.code === 'drive_not_connected') linkState = { known: true, connected: false, mail: '' };
      throw error;
    }
    accessToken = payload.accessToken;
    accessTokenExpiresAt = Date.now() + (Number(payload.expiresIn) || 3600) * 1000;
    linkState = { known: true, connected: true, mail: payload.googleEmail || '' };
    lastError = null;
    syncBanner();
    return accessToken;
  }

  async function driveFetch(url, options = {}, retry = true) {
    const token = await driveAccess();
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
    });
    if (response.status === 401 && retry) {
      await driveAccess(true);
      return driveFetch(url, options, false);
    }
    return response;
  }

  async function listAll(query) {
    const files = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({ q: query, fields: `nextPageToken,files(${FILE_FIELDS})`, pageSize: '1000' });
      if (pageToken) params.set('pageToken', pageToken);
      const payload = await readJson(await driveFetch(`${DRIVE_API}/files?${params}`));
      files.push(...(payload.files || []));
      pageToken = payload.nextPageToken || '';
    } while (pageToken);
    return files;
  }

  async function ensureRootFolder() {
    if (rootFolderId) return rootFolderId;
    const query = `mimeType='${FOLDER_MIME}' and trashed=false and appProperties has {key='fiscaleRole' and value='root'}`;
    const existing = await listAll(query);
    if (existing.length) {
      rootFolderId = existing[0].id;
      return rootFolderId;
    }
    const created = await readJson(await driveFetch(`${DRIVE_API}/files?fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ROOT_FOLDER_NAME,
        mimeType: FOLDER_MIME,
        appProperties: { fiscaleRole: 'root' }
      })
    }));
    rootFolderId = created.id;
    return rootFolderId;
  }

  async function metadataFor(file, folderId) {
    return {
      name: file.name || 'document',
      mimeType: file.type || 'application/octet-stream',
      appProperties: { fiscaleRole: 'piece', fiscaleFolderId: String(folderId || '') }
    };
  }

  async function createFile(folderId, file) {
    const parent = await ensureRootFolder();
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ ...(await metadataFor(file, folderId)), parents: [parent] })], { type: 'application/json' }));
    form.append('file', file, file.name || 'document');
    return readJson(await driveFetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`, { method: 'POST', body: form }));
  }

  async function replaceContent(fileId, file) {
    await readJson(await driveFetch(`${DRIVE_UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${FILE_FIELDS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    }));
    return readJson(await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=${FILE_FIELDS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mimeType: file.type || 'application/octet-stream' })
    }));
  }

  function normalized(file) {
    const properties = file.appProperties || {};
    return {
      id: file.id,
      folderId: properties.fiscaleFolderId || '',
      name: file.name,
      mimeType: file.mimeType || 'application/octet-stream',
      size: Number(file.size) || 0,
      updatedAt: file.modifiedTime || '',
      localPath: FOLDER_LABEL
    };
  }

  async function findIndexFile() {
    if (indexFileId) return indexFileId;
    const query = `trashed=false and appProperties has {key='fiscaleRole' and value='index'}`;
    const existing = await listAll(query);
    indexFileId = existing.length ? existing[0].id : '';
    return indexFileId;
  }

  async function writeIndex(files) {
    const parent = await ensureRootFolder();
    const inventory = {
      application: 'Fiscale — classeur',
      dossier: 'Dossier de revue fiscale',
      note: 'Ce fichier est le sommaire des pièces déposées par le classeur. Chaque fichier reste rangé dans ce même dossier.',
      updatedAt: new Date().toISOString(),
      files: files.map((file) => ({ id: file.id, rubrique: file.folderId, nom: file.name, type: file.mimeType, taille: file.size, modifie: file.updatedAt }))
    };
    const body = new Blob([JSON.stringify(inventory, null, 2)], { type: 'application/json' });
    const currentId = await findIndexFile();
    if (currentId) {
      await readJson(await driveFetch(`${DRIVE_UPLOAD}/files/${encodeURIComponent(currentId)}?uploadType=media&fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      }));
      return currentId;
    }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: INDEX_FILE_NAME,
      mimeType: 'application/json',
      parents: [parent],
      appProperties: { fiscaleRole: 'index' }
    })], { type: 'application/json' }));
    form.append('file', body, INDEX_FILE_NAME);
    const created = await readJson(await driveFetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', body: form }));
    indexFileId = created.id;
    return indexFileId;
  }

  async function folderFiles() {
    const parent = await ensureRootFolder();
    const query = `'${parent}' in parents and trashed=false and appProperties has {key='fiscaleRole' and value='piece'}`;
    const files = await listAll(query);
    return files.map(normalized).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async function list() {
    try {
      const files = await folderFiles();
      await writeIndex(files).catch(() => {});
      return files;
    } catch (error) {
      lastError = error.message;
      if (error.code !== 'drive_not_connected') console.error('Drive listing failed:', error);
      syncBanner();
      throw error;
    }
  }

  async function upload(folderId, file) {
    const created = await createFile(folderId, file);
    await refreshIndex().catch(() => {});
    return normalized(created);
  }

  async function replace(fileId, file) {
    const updated = await replaceContent(fileId, file);
    await refreshIndex().catch(() => {});
    return normalized(updated);
  }

  async function rename(fileId, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Le nom du fichier ne peut pas être vide.');
    const updated = await readJson(await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=${FILE_FIELDS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed })
    }));
    await refreshIndex().catch(() => {});
    return normalized(updated);
  }

  async function remove(fileId) {
    await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
    await refreshIndex().catch(() => {});
  }

  async function open(fileId) {
    const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
    if (response.ok) {
      const blob = await response.blob();
      const viewer = window.open('about:blank', '_blank');
      if (!viewer) throw new Error('Autorisez les fenêtres contextuelles pour ouvrir ce fichier.');
      viewer.opener = null;
      const objectUrl = URL.createObjectURL(blob);
      viewer.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
      return;
    }
    /* Repli : la page Google Drive du fichier, pour les formats que Google convertit. */
    const description = await readJson(await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=webViewLink,id`));
    if (description.webViewLink) {
      window.open(description.webViewLink, '_blank', 'noopener');
      return;
    }
    throw new Error('Ce fichier n’a pas pu être ouvert depuis votre Google Drive.');
  }

  async function refreshIndex() {
    return writeIndex(await folderFiles());
  }

  async function fetchStatus() {
    const token = await bearerToken();
    if (!token) return { configured: true, connected: false, signedOut: true };
    const response = await fetch(TOKEN_ENDPOINT, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { configured: true, connected: false, error: payload.error || '' };
    return payload;
  }

  function bannerHost() {
    if (!banner) banner = document.querySelector('#drive-banner');
    return banner;
  }

  function renderBanner(state) {
    const host = bannerHost();
    if (!host) return;
    if (!state || state.connected) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    const reason = state.signedOut
      ? 'Connectez-vous avec Google pour retrouver vos fichiers dans votre propre Drive.'
      : state.error || lastError || 'Reliez votre Google Drive en une étape : vos pièces y seront déposées et vous resterez seul à pouvoir les consulter.';
    host.innerHTML = `<div class="drive-banner-text"><strong>Vos fichiers vont dans votre Google Drive</strong><span>${reason.replace(/</g, '&lt;')}</span></div><button type="button" id="drive-connect">${state.signedOut ? 'Se connecter avec Google' : 'Relier mon Google Drive'}</button>`;
    host.querySelector('#drive-connect')?.addEventListener('click', () => connect());
  }

  function syncBanner(state) {
    if (document.documentElement.dataset.filesSource !== 'drive') return;
    if (state) { renderBanner(state); return; }
    if (!linkState.known) {
      fetchStatus().then((status) => {
        linkState = { known: true, connected: Boolean(status.connected), mail: status.googleEmail || '' };
        renderBanner(status);
      }).catch(() => {});
      return;
    }
    renderBanner({ connected: linkState.connected, error: linkState.connected ? '' : lastError });
  }

  async function connect() {
    const participantAuth = auth();
    if (!participantAuth?.signInWithGoogle) throw new Error('La connexion Google n’est pas disponible sur cette page.');
    const { error } = await participantAuth.signInWithGoogle(window.location.href);
    if (error) throw error;
  }

  window.fiscaleDrive = {
    list,
    upload,
    replace,
    rename,
    remove,
    open,
    connect,
    syncBanner,
    status: fetchStatus,
    folderName: ROOT_FOLDER_NAME,
    get lastError() { return lastError; },
    get link() { return { ...linkState }; }
  };

  const participantAuth = auth();
  if (participantAuth?.ready) participantAuth.ready.then(() => syncBanner());
  participantAuth?.subscribe?.(() => syncBanner());
})();

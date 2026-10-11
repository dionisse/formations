/* Banc d’essai du module Drive : exécute drive.js dans un contexte isolé (vm) avec un
   faux Google Drive — mêmes routes, mêmes requêtes que l’API réelle — et vérifie le
   cycle complet : dossier, envoi, sommaire, remplacement, renommage, ouverture, suppression.
   Usage : node scripts/test-drive-module.mjs */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../drive.js', import.meta.url), 'utf8');
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const results = [];
let failures = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(`OK    ${name}${detail ? ` → ${detail}` : ''}`);
  } catch (error) {
    failures += 1;
    results.push(`ECHEC ${name} → ${error.message}`);
  }
}

/* ---------- Faux Google Drive ---------- */
function createFakeDrive() {
  const files = new Map();
  const calls = [];
  let nextId = 1;

  const matches = (file, query) => {
    if (query.includes('trashed=false') && file.trashed) return false;
    const parents = query.match(/'([^']+)' in parents/);
    if (parents && !(file.parents || []).includes(parents[1])) return false;
    const name = query.match(/(?:^|\s)name='([^']+)'/);
    if (name && file.name !== name[1]) return false;
    const mime = query.match(/mimeType='([^']+)'/);
    if (mime && file.mimeType !== mime[1]) return false;
    for (const property of query.matchAll(/appProperties has \{key='([^']+)' and value='([^']+)'\}/g)) {
      if ((file.appProperties || {})[property[1]] !== property[2]) return false;
    }
    return true;
  };

  const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  const notFound = () => json({ error: { code: 404, message: 'File not found' } }, 404);

  const multipart = async (form) => {
    const metadata = JSON.parse(await form.get('metadata').text());
    const media = form.get('file');
    return { metadata, media };
  };

  const create = (metadata, media) => {
    const id = `drive-file-${nextId++}`;
    const file = {
      id,
      name: metadata.name,
      mimeType: metadata.mimeType || media?.type || 'application/octet-stream',
      parents: metadata.parents || [],
      appProperties: metadata.appProperties || {},
      size: String(media?.size ?? 0),
      modifiedTime: new Date(Date.now() + nextId).toISOString(),
      webViewLink: `https://drive.google.com/file/d/${id}/view`,
      content: media
    };
    files.set(id, file);
    return file;
  };

  const serialize = (file, fields) => {
    const wanted = fields ? fields.replace(/^files\(|\)$/g, '').split(',') : ['id', 'name', 'mimeType', 'size', 'modifiedTime', 'appProperties', 'webViewLink'];
    const view = {};
    for (const field of wanted) {
      if (field === 'id') view.id = file.id;
      else if (field === 'name') view.name = file.name;
      else if (field === 'mimeType') view.mimeType = file.mimeType;
      else if (field === 'size') view.size = file.size;
      else if (field === 'modifiedTime') view.modifiedTime = file.modifiedTime;
      else if (field === 'appProperties') view.appProperties = file.appProperties;
      else if (field === 'webViewLink') view.webViewLink = file.webViewLink;
    }
    return view;
  };

  async function fetchImpl(url, options = {}) {
    const target = new URL(url);
    const upload = target.pathname.startsWith(new URL(DRIVE_UPLOAD).pathname);
    const path = target.pathname.replace(upload ? new URL(DRIVE_UPLOAD).pathname : new URL(DRIVE_API).pathname, '') || '/';
    const method = String(options.method || 'GET').toUpperCase();
    const bearer = options.headers?.Authorization || options.headers?.authorization || '';
    calls.push({ method, path, query: target.searchParams.get('q') || '', authorized: /^Bearer driv/.test(bearer) });

    if (!/^Bearer /.test(bearer)) return json({ error: { code: 401, message: 'Invalid Credentials' } }, 401);

    const fileMatch = path.match(/^\/files\/([^/]+)$/);

    /* Envois multipart / remplacements de contenu : traités avant les routes JSON. */
    if (upload && path === '/files' && method === 'POST') {
      const { metadata, media } = await multipart(options.body);
      return json(serialize(create(metadata, media), target.searchParams.get('fields')));
    }
    if (upload && fileMatch && method === 'PATCH') {
      const file = files.get(fileMatch[1]);
      if (!file) return notFound();
      file.content = options.body;
      file.size = String(options.body?.size ?? file.size);
      file.modifiedTime = new Date(Date.now() + nextId++).toISOString();
      return json(serialize(file, target.searchParams.get('fields')));
    }

    if (path === '/files' && method === 'GET') {
      const query = target.searchParams.get('q') || '';
      const found = [...files.values()].filter((file) => matches(file, query));
      return json({ files: found.map((file) => serialize(file, target.searchParams.get('fields'))) });
    }
    if (path === '/files' && method === 'POST') return json(serialize(create(JSON.parse(options.body), null), target.searchParams.get('fields')));

    if (fileMatch && method === 'GET') {
      const file = files.get(fileMatch[1]);
      if (!file) return notFound();
      if (target.searchParams.get('alt') === 'media') {
        return new Response(file.content || new Blob([]), { status: 200, headers: { 'Content-Type': file.mimeType } });
      }
      return json(serialize(file, target.searchParams.get('fields')));
    }
    if (fileMatch && method === 'PATCH') {
      const file = files.get(fileMatch[1]);
      if (!file) return notFound();
      if (target.searchParams.get('uploadType') === 'media') {
        file.content = options.body;
        file.size = String(options.body?.size ?? file.size);
      } else {
        Object.assign(file, JSON.parse(options.body));
      }
      file.modifiedTime = new Date(Date.now() + nextId++).toISOString();
      return json(serialize(file, target.searchParams.get('fields')));
    }
    if (fileMatch && method === 'DELETE') {
      if (!files.has(fileMatch[1])) return notFound();
      files.delete(fileMatch[1]);
      return new Response(null, { status: 204 });
    }
    return json({ error: { code: 404, message: `Route simulée inconnue : ${method} ${path}` } }, 404);
  }

  return { fetchImpl, files, calls };
}

/* ---------- Contexte navigateur minimal ---------- */
function createPage(fakeDrive, { signedIn = true, driveLink } = {}) {
  const context = {};
  const sandbox = {
    console,
    setTimeout,
    Date,
    Blob,
    FormData,
    URL,
    URLSearchParams,
    Response,
    fetch: async (url, options) => {
      if (String(url) === '/api/drive-token') {
        const result = driveLink ? driveLink(options) : { ok: true, status: 200, payload: { accessToken: 'drive-token-1', expiresIn: 3600, googleEmail: 'participant@example.com' } };
        return new Response(JSON.stringify(result.payload), { status: result.status, headers: { 'Content-Type': 'application/json' } });
      }
      return fakeDrive.fetchImpl(String(url), options);
    },
    document: {
      documentElement: { dataset: {} },
      querySelector: () => null
    },
    __signedIn: signedIn,
    opened: []
  };
  sandbox.window = sandbox;
  sandbox.window.fiscaleParticipantAuth = {
    ready: Promise.resolve(),
    session: signedIn ? { access_token: 'supabase-token' } : null,
    signInWithGoogle: async () => ({ error: null }),
    subscribe: () => () => {}
  };
  Object.assign(context, sandbox);
  context.open = (url) => {
    context.openedWindow = url;
    return { location: { replace: (value) => context.opened.push(value) }, close() {}, opener: null };
  };
  context.window = context;   /* le module écrit sur window.fiscaleDrive */
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'drive.js' });
  return context;
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
const fake = createFakeDrive();
const page = createPage(fake);
const drive = page.fiscaleDrive;
const document_ = new Blob(['Contrat de prestation'], { type: 'application/pdf' });
Object.defineProperty(document_, 'name', { value: 'contrat.pdf' });
Object.defineProperty(document_, 'type', { value: 'application/pdf' });

let uploaded = null;

await check('le module expose son interface', () => {
  for (const key of ['list', 'upload', 'replace', 'rename', 'remove', 'open', 'connect', 'syncBanner']) {
    assert.equal(typeof drive[key], 'function', `${key} doit être une fonction`);
  }
  return 'list, upload, replace, rename, remove, open';
});

await check('premier envoi : le dossier « Fiscale — Dossier » est créé', async () => {
  uploaded = await drive.upload('01', document_);
  assert.equal(uploaded.folderId, '01');
  assert.equal(uploaded.name, 'contrat.pdf');
  assert.equal(uploaded.localPath, 'Mon Drive / Fiscale — Dossier');
  const folder = [...fake.files.values()].find((file) => file.mimeType === FOLDER_MIME);
  assert.ok(folder, 'un dossier doit être créé');
  assert.equal(folder.name, 'Fiscale — Dossier');
  assert.equal(folder.appProperties.fiscaleRole, 'root');
  return `dossier créé, pièce rangée en rubrique 01`;
});

await check('le sommaire dossier-index.json est écrit dans le Drive', async () => {
  const index = [...fake.files.values()].find((file) => file.name === 'dossier-index.json');
  assert.ok(index, 'le sommaire doit exister');
  const inventory = JSON.parse(await index.content.text());
  assert.equal(inventory.files.length, 1);
  assert.equal(inventory.files[0].rubrique, '01');
  assert.equal(inventory.files[0].nom, 'contrat.pdf');
  return `sommaire publié (${inventory.files.length} pièce)`;
});

await check('list() renvoie les pièces classées par rubrique', async () => {
  const bilan = new Blob(['Bilan'], { type: 'application/pdf' });
  Object.defineProperty(bilan, 'name', { value: 'bilan-2025.pdf' });
  await drive.upload('04', bilan);
  const files = await drive.list();
  assert.equal(files.length, 2);
  assert.equal(files.map((file) => file.name).join(' | '), 'bilan-2025.pdf | contrat.pdf');
  assert.equal([...files.map((file) => file.folderId)].sort().join(' | '), '01 | 04');
  assert.ok(files.every((file) => file.localPath === 'Mon Drive / Fiscale — Dossier'));
  assert.ok(files.every((file) => Number.isFinite(file.size)));
  return files.map((file) => `${file.folderId}:${file.name}`).join(', ');
});

await check('replace() remplace le contenu sans changer la pièce', async () => {
  const remplacement = new Blob(['Contrat de prestation révisé'], { type: 'application/pdf' });
  Object.defineProperty(remplacement, 'name', { value: 'contrat-revise.pdf' });
  const updated = await drive.replace(uploaded.id, remplacement);
  assert.equal(updated.id, uploaded.id);
  assert.equal(fake.files.get(uploaded.id).name, 'contrat.pdf', 'le nom de la pièce ne doit pas changer');
  assert.equal(await fake.files.get(uploaded.id).content.text(), 'Contrat de prestation révisé');
  return 'contenu remplacé, nom conservé';
});

await check('rename() renomme la pièce et tient le sommaire à jour', async () => {
  const renamed = await drive.rename(uploaded.id, 'contrat-2025.pdf');
  assert.equal(renamed.name, 'contrat-2025.pdf');
  const index = [...fake.files.values()].find((file) => file.name === 'dossier-index.json');
  const inventory = JSON.parse(await index.content.text());
  assert.ok(inventory.files.some((file) => file.nom === 'contrat-2025.pdf'));
  return 'nom mis à jour';
});

await check('open() ouvre la pièce depuis le Drive', async () => {
  await drive.open(uploaded.id);
  assert.equal(page.openedWindow, 'about:blank');
  assert.equal(page.opened.length, 1);
  assert.ok(page.opened[0].startsWith('blob:'), `ouverture inattendue : ${page.opened[0]}`);
  return 'pièce ouverte depuis le Drive dans un nouvel onglet';
});

await check('remove() retire la pièce du Drive', async () => {
  await drive.remove(uploaded.id);
  assert.equal(fake.files.has(uploaded.id), false);
  const files = await drive.list();
  assert.equal(files.length, 1);
  return 'suppression effective';
});

await check('les échanges sont autorisés par le jeton temporaire', () => {
  const unauthorized = fake.calls.filter((call) => !call.authorized);
  assert.equal(unauthorized.length, 0);
  assert.ok(fake.calls.some((call) => call.query.includes("fiscaleRole' and value='piece'")));
  return `${fake.calls.length} appels Drive, tous signés`;
});

await check('aucun jeton Drive n’est demandé côté navigateur sans liaison', async () => {
  const refused = createPage(fake, { driveLink: () => ({ ok: false, status: 409, payload: { error: 'Votre Google Drive n’est pas encore relié à votre compte.', code: 'drive_not_connected' } }) });
  await assert.rejects(() => refused.fiscaleDrive.list(), /Google Drive n’est pas encore relié/);
  return 'message clair pour reconnecter le Drive';
});

await check('la liaison absente est signalée au classeur', async () => {
  const banner = createPage(fake, { driveLink: () => ({ ok: false, status: 409, payload: { error: 'Reliez votre Drive.', code: 'drive_not_connected' } }) });
  let rendered = null;
  banner.document.documentElement.dataset.filesSource = 'drive';
  banner.document.querySelector = () => ({
    hidden: true,
    innerHTML: '',
    set hidden(value) { this._hidden = value; },
    get hidden() { return this._hidden; },
    querySelector: () => null
  });
  banner.fiscaleDrive.syncBanner({ connected: false, error: 'Reliez votre Drive.' });
  rendered = banner.document.querySelector('#drive-banner');
  assert.ok(rendered !== null);
  return 'bandeau de connexion disponible';
});

await pause();
console.log(results.join('\n'));
console.log(failures === 0 ? `\n${results.length} scénarios réussis.` : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);

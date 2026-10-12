import { LEGAL_DOCUMENTS, mergeLegalDocuments, LEGAL_DOCUMENT_MAX_LENGTH } from './legal-documents-data.js';
import { renderLegalText } from './legal-text.js';

const loginView = document.querySelector('#admin-login-view');
const deniedView = document.querySelector('#admin-denied-view');
const dashboard = document.querySelector('#admin-dashboard');
const entitlementsList = document.querySelector('#admin-entitlements-list');
const eventsList = document.querySelector('#admin-events-list');
const feedback = document.querySelector('#admin-feedback');
const refreshButton = document.querySelector('#admin-refresh-button');
const legalFeedback = document.querySelector('#admin-legal-feedback');
const legalTabs = [...document.querySelectorAll('[data-legal-slug]')];
const legalTitleInput = document.querySelector('#admin-legal-document-title');
const legalContentInput = document.querySelector('#admin-legal-document-content');
const legalSaveButton = document.querySelector('#admin-legal-save');
const legalPreview = document.querySelector('#admin-legal-live-preview');
const legalCharCount = document.querySelector('#admin-legal-char-count');
const auth = window.fiscaleParticipantAuth;
let legalDocuments = new Map(LEGAL_DOCUMENTS.map((document) => [document.slug, document]));
let selectedLegalSlug = 'confidentialite';
let currentSessionVersion = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function statusLabel(status) {
  return ({ pending: 'En attente', paid: 'Payé · accès actif', revoked: 'Révoqué' })[status] || 'Inconnu';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function showLogin(message = '') {
  loginView.hidden = false;
  deniedView.hidden = true;
  dashboard.hidden = true;
  document.querySelector('#admin-identity').hidden = true;
  document.querySelector('#participant-logout-button').hidden = !auth?.session || Boolean(auth.session.developmentBypass);
  if (auth?.session) document.querySelector('#participant-google-login').hidden = false;
  if (message) document.querySelector('#participant-auth-status').textContent = message;
}

function showDenied(serverSession) {
  loginView.hidden = true;
  deniedView.hidden = false;
  dashboard.hidden = true;
  document.querySelector('#admin-identity').hidden = true;
  document.querySelector('#participant-logout-button').hidden = true;
  document.querySelector('#admin-denied-email').textContent = serverSession?.user?.email || 'Compte non identifié';
}

function showDashboard(serverSession) {
  loginView.hidden = true;
  deniedView.hidden = true;
  dashboard.hidden = false;
  const identity = document.querySelector('#admin-identity');
  identity.textContent = serverSession.user?.email || 'Administrateur';
  identity.hidden = false;
  document.querySelector('#participant-logout-button').hidden = Boolean(serverSession.developmentBypass);
}

async function authenticatedFetch(url, options = {}) {
  await auth?.ready;
  const token = auth?.session?.access_token;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `La requête a échoué (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function renderEntitlements(entitlements) {
  const pending = entitlements.filter((item) => item.status === 'pending').length;
  const paid = entitlements.filter((item) => item.status === 'paid').length;
  const revoked = entitlements.filter((item) => item.status === 'revoked').length;
  document.querySelector('#admin-pending-count').textContent = String(pending).padStart(2, '0');
  document.querySelector('#admin-paid-count').textContent = String(paid).padStart(2, '0');
  document.querySelector('#admin-revoked-count').textContent = String(revoked).padStart(2, '0');

  if (!entitlements.length) {
    entitlementsList.innerHTML = '<p class="admin-empty">Aucune demande de règlement n’est enregistrée pour le moment.</p>';
    return;
  }
  entitlementsList.innerHTML = entitlements.map((item) => {
    const participant = item.participant || {};
    const name = participant.full_name || 'Participant';
    const email = participant.email || item.user_id;
    const disabledPaid = item.status === 'paid' ? 'disabled' : '';
    const disabledPending = item.status === 'pending' ? 'disabled' : '';
    const disabledRevoked = item.status === 'revoked' ? 'disabled' : '';
    return `<article class="admin-entitlement-card" data-entitlement-id="${escapeHtml(item.id)}">
      <div class="admin-entitlement-card-head">
        <div class="admin-entitlement-person"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(email)}</span><small>Participant · ${escapeHtml(item.user_id)}</small></div>
        <span class="admin-status-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="admin-entitlement-meta"><span>Formation : <b>${escapeHtml(item.course_version)}</b></span><span>Demande : <b>${escapeHtml(formatDate(item.requested_at))}</b></span><span>Méthode : <b>${item.payment_method === 'manual_whatsapp' ? 'WhatsApp manuel' : escapeHtml(item.payment_method)}</b></span>${item.paid_at ? `<span>Confirmé : <b>${escapeHtml(formatDate(item.paid_at))}</b></span>` : ''}</div>
      <div class="admin-entitlement-actions"><input class="admin-payment-reference" type="text" maxlength="180" aria-label="Référence du reçu de paiement" placeholder="Référence du reçu (facultatif)" value="${escapeHtml(item.payment_reference || '')}" /><button type="button" data-action="paid" data-entitlement-id="${escapeHtml(item.id)}" ${disabledPaid}>Confirmer le paiement</button><button type="button" data-action="pending" data-entitlement-id="${escapeHtml(item.id)}" ${disabledPending}>Remettre en attente</button><button type="button" data-action="revoked" data-entitlement-id="${escapeHtml(item.id)}" ${disabledRevoked}>Révoquer</button></div>
    </article>`;
  }).join('');
}

function renderEvents(events) {
  if (!events.length) {
    eventsList.innerHTML = '<p class="admin-empty">Aucune décision enregistrée dans le journal.</p>';
    return;
  }
  eventsList.innerHTML = events.map((event) => `<article class="admin-event-row"><strong>${escapeHtml(event.course_version)}</strong><span>${escapeHtml(event.previous_status || 'nouvelle demande')} → ${escapeHtml(statusLabel(event.new_status))} · participant ${escapeHtml(String(event.user_id).slice(0, 8))}</span><time>${escapeHtml(formatDate(event.created_at))}</time></article>`).join('');
}

async function loadData() {
  feedback.textContent = 'Chargement des demandes…';
  feedback.classList.remove('is-error');
  entitlementsList.innerHTML = '<p class="admin-empty">Chargement…</p>';
  try {
    const [entitlementsResult, eventsResult] = await Promise.all([
      authenticatedFetch('/api/admin/entitlements'),
      authenticatedFetch('/api/admin/entitlement-events')
    ]);
    renderEntitlements(entitlementsResult.entitlements || []);
    renderEvents(eventsResult.events || []);
    feedback.textContent = '';
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.add('is-error');
    entitlementsList.innerHTML = '<p class="admin-empty">Le tableau ne peut pas être chargé. Vérifiez la migration Supabase et les règles RLS.</p>';
    eventsList.innerHTML = '<p class="admin-empty">Journal temporairement indisponible.</p>';
  }
}

function currentLegalDocument() {
  return legalDocuments.get(selectedLegalSlug) || null;
}

function legalDocumentUrl(slug) {
  return slug === 'conditions-utilisation' ? '/conditions-utilisation.html' : '/confidentialite.html';
}

function legalDocumentIsDirty() {
  const document = currentLegalDocument();
  return Boolean(document && (legalTitleInput?.value !== document.title || legalContentInput?.value !== document.content));
}

function setLegalFeedback(message, isError = false) {
  if (!legalFeedback) return;
  legalFeedback.textContent = message;
  legalFeedback.classList.toggle('is-error', isError);
}

function setLegalEditorEnabled(enabled) {
  legalTabs.forEach((tab) => { tab.disabled = !enabled; });
  if (legalTitleInput) legalTitleInput.disabled = !enabled;
  if (legalContentInput) legalContentInput.disabled = !enabled;
}

function updateLegalEditor() {
  const current = currentLegalDocument();
  if (!current || !legalTitleInput || !legalContentInput) return;
  const previewTitle = document.querySelector('#admin-legal-document-name');
  const updatedLabel = document.querySelector('#admin-legal-updated');
  const previewLink = document.querySelector('#admin-legal-preview-link');
  if (previewTitle) previewTitle.textContent = legalTitleInput.value || 'Document sans titre';
  if (updatedLabel) updatedLabel.textContent = current.updatedAt ? `Enregistré le ${formatDate(current.updatedAt)}` : 'Version de référence';
  if (previewLink) previewLink.href = legalDocumentUrl(selectedLegalSlug);
  if (legalCharCount) legalCharCount.textContent = `${legalContentInput.value.length.toLocaleString('fr-FR')} / ${LEGAL_DOCUMENT_MAX_LENGTH.toLocaleString('fr-FR')} caractères`;
  if (legalPreview) renderLegalText(legalPreview, legalContentInput.value);
  if (legalSaveButton) legalSaveButton.disabled = !legalDocumentIsDirty();
  const panel = document.querySelector('#admin-legal-panel');
  const activeTab = legalTabs.find((tab) => tab.dataset.legalSlug === selectedLegalSlug);
  if (panel && activeTab) panel.setAttribute('aria-labelledby', activeTab.id);
}

function displayLegalDocument(slug, { confirmDiscard = true } = {}) {
  if (!legalDocuments.has(slug) || slug === selectedLegalSlug) return;
  if (confirmDiscard && legalDocumentIsDirty() && !window.confirm('Abandonner les modifications non enregistrées de ce document ?')) {
    legalTabs.find((tab) => tab.dataset.legalSlug === selectedLegalSlug)?.focus();
    return;
  }

  selectedLegalSlug = slug;
  const current = currentLegalDocument();
  legalTitleInput.value = current.title;
  legalContentInput.value = current.content;
  legalTabs.forEach((tab) => {
    const selected = tab.dataset.legalSlug === slug;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  updateLegalEditor();
  setLegalFeedback('Modifiez le texte puis enregistrez-le pour le publier.');
}

async function loadLegalDocuments() {
  if (!legalFeedback) return;
  setLegalEditorEnabled(false);
  setLegalFeedback('Chargement des documents juridiques…');
  try {
    const payload = await authenticatedFetch('/api/admin/legal-documents');
    legalDocuments = new Map(mergeLegalDocuments(payload.documents).map((document) => [document.slug, document]));
    setLegalEditorEnabled(true);
    const active = currentLegalDocument();
    legalTitleInput.value = active.title;
    legalContentInput.value = active.content;
    updateLegalEditor();
    setLegalFeedback(payload.source === 'defaults'
      ? 'Textes de référence chargés. Configurez Supabase pour enregistrer les modifications partagées en ligne.'
      : 'Textes chargés. Les modifications enregistrées seront publiées sur les pages publiques.');
  } catch (error) {
    legalDocuments = new Map(LEGAL_DOCUMENTS.map((document) => [document.slug, { ...document, updatedAt: null }]));
    setLegalEditorEnabled(true);
    legalTitleInput.value = currentLegalDocument().title;
    legalContentInput.value = currentLegalDocument().content;
    updateLegalEditor();
    setLegalFeedback(`${error.message} Les textes de référence restent affichés ; l’enregistrement en ligne nécessite la migration Supabase.`, true);
  }
}

async function saveLegalDocument() {
  if (!legalDocumentIsDirty() || !legalSaveButton) return;
  const title = legalTitleInput.value.trim();
  const content = legalContentInput.value.trim();
  if (!title || !content) {
    setLegalFeedback('Le titre et le texte doivent être renseignés.', true);
    return;
  }
  if (content.length > LEGAL_DOCUMENT_MAX_LENGTH) {
    setLegalFeedback(`Le texte dépasse la limite de ${LEGAL_DOCUMENT_MAX_LENGTH.toLocaleString('fr-FR')} caractères.`, true);
    return;
  }

  legalSaveButton.disabled = true;
  legalSaveButton.textContent = 'Enregistrement…';
  setLegalFeedback('Enregistrement du document…');
  try {
    const payload = await authenticatedFetch('/api/admin/legal-documents', {
      method: 'PUT',
      body: JSON.stringify({ slug: selectedLegalSlug, title, content })
    });
    const saved = payload.document || { slug: selectedLegalSlug, title, content, updatedAt: new Date().toISOString() };
    legalDocuments.set(selectedLegalSlug, {
      slug: saved.slug,
      title: saved.title,
      content: saved.content,
      updatedAt: saved.updatedAt || null
    });
    legalTitleInput.value = saved.title;
    legalContentInput.value = saved.content;
    updateLegalEditor();
    setLegalFeedback('Document enregistré. Il est maintenant consultable depuis le pied de page du site.');
  } catch (error) {
    setLegalFeedback(error.message, true);
    updateLegalEditor();
  } finally {
    legalSaveButton.textContent = 'Enregistrer le document';
    updateLegalEditor();
  }
}

async function bootstrap() {
  const version = ++currentSessionVersion;
  if (!auth) {
    showLogin('Le service de connexion n’a pas pu démarrer. Actualisez la page.');
    return;
  }
  try {
    await auth.ready;
    const serverSession = await auth.getServerSession();
    if (version !== currentSessionVersion) return;
    if (!serverSession?.authenticated) {
      showLogin();
      return;
    }
    if (!serverSession.isAdmin) {
      showDenied(serverSession);
      return;
    }
    showDashboard(serverSession);
    await Promise.all([loadData(), loadLegalDocuments()]);
  } catch (error) {
    if (version !== currentSessionVersion) return;
    showLogin(error.message || 'La connexion n’a pas pu être vérifiée.');
  }
}

refreshButton?.addEventListener('click', () => { void loadData(); });
legalTabs.forEach((tab) => tab.addEventListener('click', () => displayLegalDocument(tab.dataset.legalSlug)));
legalTitleInput?.addEventListener('input', updateLegalEditor);
legalContentInput?.addEventListener('input', updateLegalEditor);
legalSaveButton?.addEventListener('click', () => { void saveLegalDocument(); });
document.querySelector('.admin-legal-tabs')?.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = legalTabs.findIndex((tab) => tab.dataset.legalSlug === selectedLegalSlug);
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const next = legalTabs[(currentIndex + direction + legalTabs.length) % legalTabs.length];
  next?.focus();
  if (next) displayLegalDocument(next.dataset.legalSlug);
});
window.addEventListener('beforeunload', (event) => {
  if (!legalDocumentIsDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});

entitlementsList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action][data-entitlement-id]');
  if (!button || button.disabled) return;
  const card = button.closest('.admin-entitlement-card');
  const paymentReference = card?.querySelector('.admin-payment-reference')?.value.trim() || '';
  const status = button.dataset.action;
  if (status === 'paid' && !window.confirm('Le reçu et le règlement ont-ils bien été vérifiés ? Cette décision ouvre les livrables et le classeur pour cette formation.')) return;
  button.disabled = true;
  feedback.textContent = 'Enregistrement de la décision…';
  feedback.classList.remove('is-error');
  try {
    await authenticatedFetch(`/api/admin/entitlements/${encodeURIComponent(button.dataset.entitlementId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, paymentReference })
    });
    feedback.textContent = 'Décision enregistrée et journalisée.';
    await loadData();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.add('is-error');
    button.disabled = false;
  }
});

document.querySelector('#denied-signout-button')?.addEventListener('click', async () => {
  const result = await auth?.signOut();
  if (result?.error) {
    document.querySelector('#admin-denied-email').textContent = 'Déconnexion impossible. Réessayez.';
    return;
  }
  window.location.reload();
});

auth?.subscribe(() => { void bootstrap(); });
auth?.ready.then(() => { void bootstrap(); }).catch(() => showLogin('Impossible de démarrer Supabase Auth.'));

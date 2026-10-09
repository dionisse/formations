const loginView = document.querySelector('#admin-login-view');
const deniedView = document.querySelector('#admin-denied-view');
const dashboard = document.querySelector('#admin-dashboard');
const entitlementsList = document.querySelector('#admin-entitlements-list');
const eventsList = document.querySelector('#admin-events-list');
const feedback = document.querySelector('#admin-feedback');
const refreshButton = document.querySelector('#admin-refresh-button');
const auth = window.fiscaleParticipantAuth;
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
    await loadData();
  } catch (error) {
    if (version !== currentSessionVersion) return;
    showLogin(error.message || 'La connexion n’a pas pu être vérifiée.');
  }
}

refreshButton?.addEventListener('click', () => { void loadData(); });

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

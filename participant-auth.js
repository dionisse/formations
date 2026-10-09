/* Authentification des participants via Supabase Auth et Google OAuth. */
(() => {
  const dialog = document.querySelector('#participant-account-dialog');
  const openButton = document.querySelector('#participant-account-button');
  const closeButton = document.querySelector('#participant-account-close');
  const buttonLabel = document.querySelector('#participant-account-button-label');
  const googleButton = document.querySelector('#participant-google-login');
  const logoutButton = document.querySelector('#participant-logout-button');
  const profilePanel = document.querySelector('#participant-account-profile');
  const avatar = document.querySelector('#participant-account-avatar');
  const name = document.querySelector('#participant-account-name');
  const email = document.querySelector('#participant-account-email');
  const authStatus = document.querySelector('#participant-auth-status');
  const syncStatus = document.querySelector('#participant-sync-status');
  const dashboardLink = document.querySelector('#participant-dashboard-link');
  const listeners = new Set();
  let resolveEnvironment = () => {};
  window.fiscaleSupabaseEnvReady = new Promise((resolve) => { resolveEnvironment = resolve; });
  window.resolveFiscaleSupabaseEnv = resolveEnvironment;
  if (window.fiscaleSupabaseConfig) resolveEnvironment();
  else window.setTimeout(resolveEnvironment, 1200);

  let supabaseClient = null;
  let currentSession = null;
  let initialized = false;

  function setAuthStatus(message, isError = false) {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.classList.toggle('is-error', isError);
  }

  function setSyncStatus(message, state = '') {
    if (!syncStatus) return;
    syncStatus.textContent = message;
    syncStatus.dataset.state = state;
  }

  function usableValue(value) {
    const candidate = String(value || '').trim();
    return candidate && !candidate.startsWith('%VITE_') && !candidate.includes('<') && !candidate.includes('>') ? candidate : '';
  }

  async function readConfig() {
    await window.fiscaleSupabaseEnvReady;
    const embedded = {
      url: usableValue(window.fiscaleSupabaseConfig?.url),
      anonKey: usableValue(window.fiscaleSupabaseConfig?.anonKey)
    };
    if (embedded.url && embedded.anonKey) return embedded;

    try {
      const response = await fetch('/api/public-config', { cache: 'no-store' });
      if (response.ok) {
        const runtime = await response.json();
        const url = usableValue(runtime.supabaseUrl);
        const anonKey = usableValue(runtime.supabaseAnonKey);
        if (url && anonKey) return { url, anonKey };
      }
    } catch (error) {
      /* Les déploiements statiques peuvent ne pas exposer la route de configuration. */
    }
    return { url: '', anonKey: '' };
  }

  function notifySession(session) {
    currentSession = session || null;
    renderSession(currentSession);
    window.setTimeout(() => {
      listeners.forEach((listener) => {
        try { listener(currentSession); } catch (error) { console.error('Participant session listener failed:', error); }
      });
    }, 0);
  }

  function renderSession(session) {
    const user = session?.user || null;
    const metadata = user?.user_metadata || {};
    const displayName = metadata.full_name || metadata.name || user?.email || 'Participant';
    const avatarUrl = metadata.avatar_url || metadata.picture || '';

    if (buttonLabel) buttonLabel.textContent = user ? 'Mon compte' : 'Connexion';
    if (profilePanel) profilePanel.hidden = !user;
    if (logoutButton) logoutButton.hidden = !user;
    if (googleButton) googleButton.hidden = Boolean(user);
    if (dashboardLink) dashboardLink.hidden = !user;
    if (name) name.textContent = displayName;
    if (email) email.textContent = user?.email || '';
    if (avatar) {
      avatar.hidden = !avatarUrl;
      avatar.alt = avatarUrl ? `Photo de profil de ${displayName}` : '';
      if (avatarUrl && avatar.src !== avatarUrl) avatar.src = avatarUrl;
    }

    if (user) setAuthStatus('Votre compte participant est connecté avec Google.');
    else if (initialized) setAuthStatus('La première connexion crée automatiquement votre compte participant.');
  }

  function loadSupabaseSdk() {
    if (window.supabase?.createClient) return Promise.resolve(true);
    const script = document.querySelector('#supabase-js-sdk');
    if (!script) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(Boolean(window.supabase?.createClient));
      };
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', finish, { once: true });
      window.setTimeout(finish, 8000);
    });
  }

  async function initialize() {
    const config = await readConfig();
    if (!config.url || !config.anonKey) {
      initialized = true;
      setAuthStatus('Connexion non activée : ajoutez l’URL Supabase et la clé publique du projet dans la configuration.');
      return;
    }

    if (!await loadSupabaseSdk()) {
      initialized = true;
      setAuthStatus('Le service de connexion n’a pas pu être chargé. Vérifiez votre connexion puis actualisez la page.', true);
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      supabaseClient.auth.onAuthStateChange((_event, session) => notifySession(session));
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      initialized = true;
      notifySession(data?.session || null);
    } catch (error) {
      initialized = true;
      setAuthStatus('Impossible d’initialiser la connexion Supabase. Vérifiez la configuration du projet.', true);
      console.error('Supabase participant auth initialization failed:', error);
    }
  }

  const ready = initialize();

  async function signInWithGoogle(redirectTo = `${window.location.origin}/connexion.html`) {
    await ready;
    if (!supabaseClient) return { error: new Error('Supabase n’est pas encore configuré.') };
    return supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'openid email profile',
        queryParams: { prompt: 'select_account' }
      }
    });
  }

  async function signOut() {
    await ready;
    if (!supabaseClient) return { error: new Error('Supabase n’est pas encore configuré.') };
    return supabaseClient.auth.signOut({ scope: 'local' });
  }

  async function getServerSession() {
    await ready;
    const accessToken = currentSession?.access_token;
    try {
      const response = await fetch('/api/session', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  window.fiscaleParticipantAuth = {
    ready,
    signInWithGoogle,
    signOut,
    getServerSession,
    get client() { return supabaseClient; },
    get session() { return currentSession; },
    get configured() { return Boolean(supabaseClient); },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      if (initialized) window.setTimeout(() => listener(currentSession), 0);
      return () => listeners.delete(listener);
    },
    setSyncStatus
  };

  openButton?.addEventListener('click', () => {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    openButton.setAttribute('aria-expanded', 'true');
    if (!supabaseClient && initialized) {
      setSyncStatus('La progression reste enregistrée sur cet appareil tant que Supabase n’est pas configuré.', 'warning');
    }
  });
  closeButton?.addEventListener('click', () => dialog?.close?.());
  dialog?.addEventListener('close', () => openButton?.setAttribute('aria-expanded', 'false'));
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  googleButton?.addEventListener('click', async () => {
    googleButton.disabled = true;
    setAuthStatus('Redirection sécurisée vers Google…');
    const { error } = await signInWithGoogle(googleButton.dataset.redirectTo || `${window.location.origin}/connexion.html`);
    if (error) {
      setAuthStatus('La connexion Google a échoué. Vérifiez la configuration du projet puis réessayez.', true);
      googleButton.disabled = false;
      console.error('Google participant sign-in failed:', error);
    }
  });

  logoutButton?.addEventListener('click', async () => {
    if (!supabaseClient) return;
    logoutButton.disabled = true;
    const { error } = await signOut();
    if (error) {
      setAuthStatus('La déconnexion n’a pas abouti. Réessayez.', true);
      logoutButton.disabled = false;
      console.error('Participant sign-out failed:', error);
      return;
    }
    window.location.reload();
  });
})();

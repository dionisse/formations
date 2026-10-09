/* Vite injecte les seules valeurs publiques Supabase au build. */
const env = import.meta.env || {};
window.fiscaleSupabaseConfig = {
  url: env.VITE_SUPABASE_URL || '',
  anonKey: env.VITE_SUPABASE_ANON_KEY || ''
};
window.resolveFiscaleSupabaseEnv?.();

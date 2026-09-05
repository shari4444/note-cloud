import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Sign in with Google OAuth via Supabase
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.');
  }

  const redirectUrl = `${window.location.origin}/dashboard/index.html`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with Email and Password via Supabase
 */
export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

/**
 * Sign up with Email and Password via Supabase
 */
export async function signUpWithEmail(email, password, metadata = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/dashboard/index.html`
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (!isSupabaseConfigured()) {
    window.location.href = '/index.html';
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) console.error('Sign out error:', error);
  window.location.href = '/index.html';
}

/**
 * Get current session
 */
export async function getSession() {
  if (!isSupabaseConfigured()) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }
  return session;
}

/**
 * Get current authenticated user
 */
export async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Helper to extract display name, email, avatar from user metadata
 */
export function getUserProfileInfo(user) {
  if (!user) return { name: 'Regina', email: '', avatarUrl: '', initial: 'R' };

  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || user.email?.split('@')[0] || 'Regina';
  const email = user.email || '';
  const avatarUrl = meta.avatar_url || meta.picture || '';
  const initial = (name.trim().charAt(0) || 'R').toUpperCase();

  return { name, email, avatarUrl, initial };
}

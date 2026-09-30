import { useCallback, useEffect, useState } from 'react';
import { isSupabaseAuthConfigured, supabase } from '../auth/supabaseClient';

export const useSupabaseAuth = () => {
  const [state, setState] = useState({ session: null, loading: isSupabaseAuthConfigured, error: null });

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) setState({ session: data.session, loading: false, error });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false, error: null });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Google authentication is not configured.');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: globalThis.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    ...state,
    configured: isSupabaseAuthConfigured,
    user: state.session?.user ?? null,
    accessToken: state.session?.access_token ?? '',
    signInWithGoogle,
    signOut,
  };
};

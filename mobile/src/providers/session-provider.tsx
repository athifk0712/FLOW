import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

// The stored session, kept current. A device with a session (guest or account) opens straight on Beranda; one
// without lands on the welcome screen (Google, email, or guest mode). The root layout keeps the splash up while
// isLoading, so nothing flickers in between.
export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION first (restored from storage, or from a Google redirect on web),
    // then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED, so the guard redirects on login and logout.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

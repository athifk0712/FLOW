import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
};

const SessionContext = createContext<SessionState>({ session: null, isLoading: true, error: null });

// No login wall: a first launch gets an anonymous account so the user can start logging right away.
// Linking an email to keep the data comes later, from settings.
export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true, error: null });

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION first, so it covers the restore-from-storage case too.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && !session) {
        supabase.auth.signInAnonymously().then(({ error }) => {
          // On success SIGNED_IN fires and sets the session below.
          if (error) setState({ session: null, isLoading: false, error: error.message });
        });
        return;
      }
      setState({ session, isLoading: false, error: null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

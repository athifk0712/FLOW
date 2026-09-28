import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION first, so it covers the restore-from-storage case too.
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

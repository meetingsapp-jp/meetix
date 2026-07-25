import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Agency } from '../types';

interface AgencyContextValue {
  agency: Agency | null;
  loading: boolean;
  error: string | null;
}

const AgencyContext = createContext<AgencyContextValue>({ agency: null, loading: true, error: null });

// Single-tenant for the MVP: load the one agency row. When real auth arrives,
// this resolves from the logged-in user instead.
export function AgencyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgencyContextValue>({ agency: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        setState({ agency: null, loading: false, error: 'no-supabase' });
        return;
      }
      const { data, error } = await supabase.from('agencies').select('*').limit(1).maybeSingle();
      if (!active) return;
      if (error) setState({ agency: null, loading: false, error: error.message });
      else setState({ agency: data as Agency | null, loading: false, error: null });
    })();
    return () => {
      active = false;
    };
  }, []);

  return <AgencyContext.Provider value={state}>{children}</AgencyContext.Provider>;
}

export function useAgency() {
  return useContext(AgencyContext);
}

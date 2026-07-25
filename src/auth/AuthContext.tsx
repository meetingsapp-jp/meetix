import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { PERMISSIONS, type Role } from './roles';
import type { Agency, AppUser } from '../types';

interface AuthContextValue {
  session: Session | null;
  appUser: AppUser | null;
  agency: Agency | null;
  role: Role | null;
  can: (typeof PERMISSIONS)[Role] | { manageEvents: false; managePassengers: false; exportData: false };
  loading: boolean;
  /** session exists but the user is not linked to any agency row */
  notProvisioned: boolean;
  signOut: () => Promise<void>;
}

const NO_PERMS = { manageEvents: false, managePassengers: false, exportData: false } as const;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      if (!session) {
        setAppUser(null);
        setAgency(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: user } = await supabase
        .from('app_users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      setAppUser((user as AppUser) ?? null);
      if (user) {
        const { data: ag } = await supabase.from('agencies').select('*').limit(1).maybeSingle();
        if (active) setAgency((ag as Agency) ?? null);
      } else {
        setAgency(null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(() => {
    const role = (appUser?.role as Role) ?? null;
    return {
      session,
      appUser,
      agency,
      role,
      can: role ? PERMISSIONS[role] : NO_PERMS,
      loading,
      notProvisioned: Boolean(session && !loading && !appUser),
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    };
  }, [session, appUser, agency, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

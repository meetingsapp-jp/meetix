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
  can: (typeof PERMISSIONS)[Role] | { manageEvents: false; managePassengers: false; exportData: false; manageTeam: false };
  isPlatformAdmin: boolean;
  loading: boolean;
  /** session exists but the user is neither in an agency nor a platform admin */
  notProvisioned: boolean;
  signOut: () => Promise<void>;
  refreshAgency: () => Promise<void>;
}

const NO_PERMS = { manageEvents: false, managePassengers: false, exportData: false, manageTeam: false } as const;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
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
        setIsPlatformAdmin(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [{ data: user }, { data: admin }] = await Promise.all([
        supabase.from('app_users').select('*').eq('auth_user_id', session.user.id).maybeSingle(),
        supabase.from('platform_admins').select('id').eq('auth_user_id', session.user.id).maybeSingle(),
      ]);
      if (!active) return;
      setAppUser((user as AppUser) ?? null);
      setIsPlatformAdmin(Boolean(admin));
      if (user) {
        const { data: ag } = await supabase.from('agencies').select('*').eq('id', (user as AppUser).agency_id).maybeSingle();
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
      isPlatformAdmin,
      loading,
      notProvisioned: Boolean(session && !loading && !appUser && !isPlatformAdmin),
      signOut: async () => {
        await supabase?.auth.signOut();
      },
      refreshAgency: async () => {
        if (!supabase || !appUser) return;
        const { data } = await supabase.from('agencies').select('*').eq('id', appUser.agency_id).maybeSingle();
        setAgency((data as Agency | null) ?? null);
      },
    };
  }, [session, appUser, agency, isPlatformAdmin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PERMISSIONS, ROLES, type Role } from './roles';

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  can: (typeof PERMISSIONS)[Role];
}

const RoleContext = createContext<RoleContextValue | null>(null);

// Temporary stub: role is chosen in-app (a selector in the header) instead of
// coming from a real authenticated session. Swapped for Supabase Auth later,
// once you confirm the auth strategy.
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(ROLES[0].id);
  const value = useMemo<RoleContextValue>(
    () => ({ role, setRole, can: PERMISSIONS[role] }),
    [role],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within <RoleProvider>');
  return ctx;
}

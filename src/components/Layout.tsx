import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useRole } from '../auth/RoleContext';
import { ROLES } from '../auth/roles';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/events', label: 'Eventos' },
  { to: '/transport', label: 'Transporte' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { role, setRole } = useRole();

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
          <span className="font-bold text-lg">EventOps</span>
          <nav className="flex gap-1 flex-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <label className="text-xs flex items-center gap-2">
            <span className="opacity-70">Rol:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id} className="text-slate-900">
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!isSupabaseConfigured && (
          <div className="bg-amber-500 text-amber-950 text-xs text-center py-1">
            Modo demostración — sin base de datos conectada (esperando credenciales de Supabase).
          </div>
        )}
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">{children}</main>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRole } from '../auth/RoleContext';
import { ROLES } from '../auth/roles';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const nav = [
  { to: '/', key: 'nav.dashboard', end: true },
  { to: '/events', key: 'nav.events' },
  { to: '/transport', key: 'nav.transport' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { role, setRole } = useRole();
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="font-bold text-lg">{t('app.name')}</span>
          <nav className="flex gap-1 flex-1 min-w-0">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                }
              >
                {t(n.key)}
              </NavLink>
            ))}
          </nav>

          <label className="text-xs flex items-center gap-1.5">
            <span className="opacity-70">{t('language.label')}:</span>
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
            >
              {SUPPORTED_LANGUAGES.map((lng) => (
                <option key={lng} value={lng} className="text-slate-900">
                  {t(`language.${lng}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs flex items-center gap-1.5">
            <span className="opacity-70">{t('roles.label')}:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id} className="text-slate-900">
                  {t(`roles.${r.id}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!isSupabaseConfigured && (
          <div className="bg-amber-500 text-amber-950 text-xs text-center py-1 px-2">
            {t('app.demoBanner')}
          </div>
        )}
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">{children}</main>
    </div>
  );
}

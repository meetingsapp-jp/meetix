import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { SUPPORTED_LANGUAGES } from '../i18n';
import Button from './ui/Button';

const nav = [
  { to: '/', key: 'nav.dashboard', end: true },
  { to: '/events', key: 'nav.events' },
  { to: '/transport', key: 'nav.transport' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { appUser, agency, signOut, isPlatformAdmin, can } = useAuth();

  const brand = agency?.brand_color || undefined;

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand text-white" style={brand ? { backgroundColor: brand } : undefined}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          {agency?.logo_url ? (
            <img src={agency.logo_url} alt={agency.name} className="h-8 w-8 rounded object-contain bg-white/10" />
          ) : null}
          <span className="font-bold text-lg">{agency?.name ?? t('app.name')}</span>
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
            {can.manageTeam && (
              <NavLink
                to="/team"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                }
              >
                {t('team.title')}
              </NavLink>
            )}
            {can.manageTeam && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
                }
              >
                {t('settings.nav')}
              </NavLink>
            )}
            {isPlatformAdmin && (
              <NavLink to="/admin" className="px-3 py-1.5 rounded text-sm hover:bg-white/10">
                {t('admin.title')}
              </NavLink>
            )}
          </nav>

          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
            aria-label={t('language.label')}
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <option key={lng} value={lng} className="text-slate-900">{t(`language.${lng}`)}</option>
            ))}
          </select>

          {appUser && (
            <div className="flex items-center gap-2 text-xs">
              <div className="text-right leading-tight">
                <div className="font-medium">{appUser.full_name}</div>
                <div className="opacity-70">{t(`roles.${appUser.role}`)}</div>
              </div>
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={signOut}>
                {t('auth.signOut')}
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">{children}</main>
    </div>
  );
}

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
  { to: '/coordinador', key: 'coordinator.title' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { appUser, agency, signOut, isPlatformAdmin, can } = useAuth();

  const brand = agency?.brand_color || undefined;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded px-3 py-1.5 text-sm ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`;

  return (
    <div className="min-h-full flex flex-col">
      <header
        className="bg-brand text-white"
        style={{ ...(brand ? { backgroundColor: brand } : {}), paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Top row: brand + language + user */}
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          {agency?.logo_url ? (
            <img src={agency.logo_url} alt={agency.name} className="h-8 w-8 shrink-0 rounded object-contain bg-white/10" />
          ) : null}
          <span className="truncate text-lg font-bold">{agency?.name ?? t('app.name')}</span>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="rounded border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-white"
              aria-label={t('language.label')}
            >
              {SUPPORTED_LANGUAGES.map((lng) => (
                <option key={lng} value={lng} className="text-slate-900">
                  {lng.toUpperCase()}
                </option>
              ))}
            </select>
            {appUser && (
              <>
                <div className="hidden text-right text-xs leading-tight sm:block">
                  <div className="font-medium">{appUser.full_name}</div>
                  <div className="opacity-70">{t(`roles.${appUser.role}`)}</div>
                </div>
                <Button variant="ghost" className="text-white hover:bg-white/10" onClick={signOut}>
                  {t('auth.signOut')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Second row: nav, horizontally scrollable on small screens */}
        <div className="mx-auto max-w-6xl px-2 pb-2">
          <nav className="flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                {t(n.key)}
              </NavLink>
            ))}
            {can.manageTeam && (
              <NavLink to="/team" className={navClass}>{t('team.title')}</NavLink>
            )}
            {can.manageTeam && (
              <NavLink to="/settings" className={navClass}>{t('settings.nav')}</NavLink>
            )}
            {isPlatformAdmin && (
              <NavLink to="/admin" className={navClass}>{t('admin.title')}</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main
        className="flex-1 mx-auto max-w-6xl w-full"
        style={{
          padding:
            '1.5rem calc(1rem + env(safe-area-inset-right)) calc(6rem + env(safe-area-inset-bottom)) calc(1rem + env(safe-area-inset-left))',
        }}
      >
        {children}
      </main>
    </div>
  );
}

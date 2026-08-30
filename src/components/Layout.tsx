import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const icons: Record<string, JSX.Element> = {
  dashboard: <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  events: <svg {...iconProps}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>,
  transport: <svg {...iconProps}><rect x="3" y="6" width="18" height="9" rx="2" /><path d="M3 11h18" /><circle cx="7.5" cy="18" r="1.6" /><circle cx="16.5" cy="18" r="1.6" /></svg>,
  coordinator: <svg {...iconProps}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 3.5h6v3H9zM9 11l2 2 4-4" /></svg>,
  settings: <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>,
  team: <svg {...iconProps}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" /><circle cx="17.5" cy="8.5" r="2.6" /><path d="M15.5 14.3c2.6.4 4.5 2.5 4.5 5.2" /></svg>,
};

const bottomNav = [
  { to: '/', key: 'nav.dashboard', end: true, icon: 'dashboard' },
  { to: '/events', key: 'nav.events', icon: 'events' },
  { to: '/transport', key: 'nav.transport', icon: 'transport' },
  { to: '/coordinador', key: 'coordinator.title', icon: 'coordinator' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { appUser, agency, signOut, isPlatformAdmin, can } = useAuth();
  const navigate = useNavigate();

  const brand = agency?.brand_color || undefined;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded px-3 py-1.5 text-sm ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`;

  const [agencyMenuOpen, setAgencyMenuOpen] = useState(false);
  const agencyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agencyMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (agencyMenuRef.current && !agencyMenuRef.current.contains(e.target as Node)) setAgencyMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [agencyMenuOpen]);

  return (
    <div className="min-h-full flex flex-col">
      <header
        className="bg-brand text-white"
        style={{ ...(brand ? { backgroundColor: brand } : {}), paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Top row: brand + language + user */}
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          {can.manageTeam ? (
            <div className="relative min-w-0" ref={agencyMenuRef}>
              <button
                type="button"
                onClick={() => setAgencyMenuOpen((o) => !o)}
                className="flex min-w-0 items-center gap-2 rounded px-1 py-0.5 hover:bg-white/10"
                aria-haspopup="menu"
                aria-expanded={agencyMenuOpen}
              >
                {agency?.logo_url ? (
                  <img src={agency.logo_url} alt={agency.name} className="h-8 w-8 shrink-0 rounded object-contain bg-white/10" />
                ) : null}
                <span className="truncate text-lg font-bold">{agency?.name ?? t('app.name')}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {agencyMenuOpen && (
                <div className="absolute left-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-700 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <button
                    onClick={() => { setAgencyMenuOpen(false); navigate('/settings'); }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    {t('settings.nav')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              {agency?.logo_url ? (
                <img src={agency.logo_url} alt={agency.name} className="h-8 w-8 shrink-0 rounded object-contain bg-white/10" />
              ) : null}
              <span className="truncate text-lg font-bold">{agency?.name ?? t('app.name')}</span>
            </div>
          )}

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
                <div className="text-right text-xs leading-tight">
                  <div className="max-w-[120px] truncate font-medium sm:max-w-none">{appUser.full_name}</div>
                  <div className="hidden opacity-70 sm:block">{t(`roles.${appUser.role}`)}</div>
                </div>
                <Button variant="ghost" className="text-white hover:bg-white/10" onClick={signOut}>
                  {t('auth.signOut')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Second row: full nav on desktop; on mobile a bottom bar is used. */}
        <div className="mx-auto hidden max-w-6xl px-2 pb-2 md:block">
          <nav className="flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                {t(n.key)}
              </NavLink>
            ))}
            {can.manageTeam && (
              <NavLink to="/team" className={navClass}>{t('team.title')}</NavLink>
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

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.04)] dark:border-slate-700 dark:bg-slate-800 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {bottomNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-brand-accent' : 'text-slate-500 dark:text-slate-400'}`
            }
          >
            {icons[n.icon]}
            <span className="leading-none">{t(n.key)}</span>
          </NavLink>
        ))}
        {can.manageTeam && (
          <NavLink
            to="/team"
            className={({ isActive }) =>
              `flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-brand-accent' : 'text-slate-500 dark:text-slate-400'}`
            }
          >
            {icons.team}
            <span className="leading-none">{t('team.title')}</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// The app's layouts are only designed and tested in portrait. On a phone
// rotated to landscape, screens like Dashboard/Coordinador render with huge
// wasted vertical space and cramped/overflowing tables ("se corre para un
// costado"). Rather than reflow every screen for landscape too, block phone
// use in landscape with a clear, friendly full-screen message. Tablets and
// desktops (wide viewports) are unaffected — this only fires on narrow,
// phone-sized screens.
export default function PortraitGuard() {
  const { t } = useTranslation();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape) and (max-width: 900px)');
    const update = () => setBlocked(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center text-white">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
        <path d="M3 9a9 9 0 0 1 3-4M3 5v4h4" />
      </svg>
      <p className="max-w-xs text-sm">{t('common.rotateToPortrait')}</p>
    </div>
  );
}

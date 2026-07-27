import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerSW } from 'virtual:pwa-register';

// Registers the service worker, checks for new deploys periodically, and shows a
// small banner so users can update to the latest version with one tap.
export default function UpdateBanner() {
  const { t } = useTranslation();
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        // Poll for a new deploy every 60s so long-lived (installed) sessions update.
        if (registration) {
          setInterval(() => registration.update().catch(() => {}), 60_000);
        }
      },
    });
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-3 bg-brand px-4 py-3 text-sm text-white shadow-lg">
      <span>{t('pwa.updateAvailable')}</span>
      <button
        onClick={() => updateRef.current?.(true)}
        className="rounded-md bg-white px-3 py-1.5 font-medium text-brand hover:bg-slate-100"
      >
        {t('pwa.update')}
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/ui/Modal';

// Chrome/Edge/Android fire this before offering to install; we capture it and
// trigger it from our own button. Typed locally (not in lib.dom yet).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this instead of display-mode.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Floating "Install app" button. On Android/desktop it fires the native install
// prompt; on iOS (no prompt API) it shows the Add-to-Home-Screen steps.
export default function InstallButton() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt, so surface the button proactively.
    if (isIOS) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || !visible || isStandalone()) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setVisible(false);
      setDeferred(null);
    } else if (isIOS) {
      setIosHelp(true);
    }
  }

  return (
    <>
      <div
        className="fixed z-40 flex items-center"
        style={{
          bottom: 'calc(1rem + env(safe-area-inset-bottom))',
          right: 'calc(1rem + env(safe-area-inset-right))',
        }}
      >
        <button
          onClick={handleClick}
          className="flex items-center gap-2 rounded-full bg-brand py-2.5 pl-3 pr-4 text-sm font-medium text-white shadow-lg ring-1 ring-black/5 transition hover:brightness-110"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3v11m0 0l-4-4m4 4l4-4M5 21h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t('install.button')}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300"
        >
          &times;
        </button>
      </div>

      <Modal open={iosHelp} title={t('install.iosTitle')} onClose={() => setIosHelp(false)}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>{t('install.iosStep1')}</li>
          <li>{t('install.iosStep2')}</li>
          <li>{t('install.iosStep3')}</li>
        </ol>
      </Modal>
    </>
  );
}

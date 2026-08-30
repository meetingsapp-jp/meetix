import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { getPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push';

// A small bell toggle in the header, available to every team member
// (directors and coordinators alike) so each person opts in on their own
// device — notifications go out per-subscription, not per-role.
export default function PushToggle() {
  const { t } = useTranslation();
  const { agency, appUser } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isPushSupported();

  useEffect(() => {
    if (!supported) return;
    getPushSubscription().then((sub) => setSubscribed(Boolean(sub))).catch(() => {});
  }, [supported]);

  if (!supported || !agency || !appUser) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush(agency!.id, appUser!.id);
        setSubscribed(true);
      }
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={subscribed ? t('push.on') : t('push.off')}
      aria-label={subscribed ? t('push.on') : t('push.off')}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm transition ${
        subscribed ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'
      }`}
    >
      {subscribed ? '🔔' : '🔕'}
    </button>
  );
}

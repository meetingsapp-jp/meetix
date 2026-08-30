import { supabase } from './supabaseClient';

// Public VAPID key — safe to ship in the client bundle (it's the "public"
// half of the pair; only the server holds the private key that lets it
// actually sign push messages).
const VAPID_PUBLIC_KEY = 'BL9T5D8zUGQXZke8Rb-Lt2LMn9HWgHv1a1DiBQKlFM1UyGdlFbLP80RAxxyogcu2sCpcGHy1AQ1DygQpf9FzGJw';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(agencyId: string, appUserId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  if (!isPushSupported()) throw new Error('Este navegador no soporta notificaciones push.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado.');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('La suscripción push no devolvió las claves esperadas.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      agency_id: agencyId,
      app_user_id: appUserId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

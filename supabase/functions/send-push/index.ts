// Edge Function: send-push
// Called by database triggers (notify_vip_arrival, notify_urgent_incident) via
// pg_net, NOT by end users — verify_jwt is disabled and instead a shared
// x-trigger-secret header (set from the trigger + this function's own secret)
// authenticates the caller as "our own database", not the open internet.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const triggerSecret = Deno.env.get('TRIGGER_SECRET');
  if (!triggerSecret || req.headers.get('x-trigger-secret') !== triggerSecret) {
    return json(401, { error: 'unauthorized' });
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublic || !vapidPrivate) return json(500, { error: 'vapid_not_configured' });

  const body = await req.json().catch(() => ({}));
  const agencyId = String(body.agency_id ?? '');
  const title = String(body.title ?? 'MEETIX');
  const msgBody = String(body.body ?? '');
  const url = typeof body.url === 'string' ? body.url : '/';
  if (!agencyId) return json(400, { error: 'missing_agency_id' });

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@meetixapp.com',
    vapidPublic,
    vapidPrivate,
  );

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: subs, error } = await admin.from('push_subscriptions').select('*').eq('agency_id', agencyId);
  if (error) return json(500, { error: error.message });

  let sent = 0;
  await Promise.allSettled(
    (subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body: msgBody, url }),
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }),
  );

  return json(200, { ok: true, subscribers: subs?.length ?? 0, sent });
});

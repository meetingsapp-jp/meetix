// Edge Function: agency-invite-user
// A Director invites a teammate to THEIR agency. Verifies the caller is a
// director of an agency, creates the teammate + app_users row in that same
// agency, and returns a set-password link to share. Service-role only lives here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['director_general', 'director_eventos', 'planificador', 'guia_coordinador'];
const CAN_INVITE = ['director_general', 'director_eventos'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json(401, { error: 'unauthorized' });

    const admin = createClient(url, serviceKey);
    const { data: me } = await admin
      .from('app_users').select('agency_id, role').eq('auth_user_id', user.id).maybeSingle();
    if (!me) return json(403, { error: 'not_in_agency' });
    if (!CAN_INVITE.includes(me.role)) return json(403, { error: 'not_allowed' });

    const body = await req.json().catch(() => ({}));
    const fullName = String(body.fullName ?? '').trim();
    const email = String(body.email ?? '').trim();
    const role = String(body.role ?? '');
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
    if (!fullName || !email || !ROLES.includes(role)) return json(400, { error: 'missing_fields' });

    const { error: cErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (cErr && !/registered|already|exists/i.test(cErr.message)) return json(400, { error: cErr.message });

    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo },
    });
    if (lErr) return json(400, { error: lErr.message });
    const userId = link.user?.id ?? null;

    const { error: iErr } = await admin.from('app_users').insert({
      agency_id: me.agency_id,
      auth_user_id: userId,
      full_name: fullName,
      role,
      email,
      preferred_language: 'es',
    });
    if (iErr && !/duplicate|unique/i.test(iErr.message)) return json(400, { error: iErr.message });

    // See agency-reset-password for why tokenHash is returned alongside
    // actionLink: action_link is single-use and gets silently burned by
    // WhatsApp/Slack/etc. link-preview bots before the real person opens it.
    return json(200, {
      ok: true,
      actionLink: link.properties?.action_link,
      tokenHash: link.properties?.hashed_token,
    });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

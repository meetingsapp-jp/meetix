// Edge Function: agency-reset-password
// A Director generates a password-reset link for an existing teammate in
// THEIR OWN agency. auth.admin.generateLink() requires the service-role key,
// which must never reach the browser — that only lives here. Verifies the
// caller is a director and that the target member belongs to the same
// agency before generating the link.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const CAN_RESET = ['director_general', 'director_eventos'];

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
    if (!CAN_RESET.includes(me.role)) return json(403, { error: 'not_allowed' });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.memberId ?? '').trim();
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
    if (!memberId) return json(400, { error: 'missing_member_id' });

    const { data: member } = await admin
      .from('app_users').select('agency_id, email').eq('id', memberId).maybeSingle();
    if (!member || member.agency_id !== me.agency_id) return json(403, { error: 'not_allowed' });
    if (!member.email) return json(400, { error: 'member_has_no_email' });

    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'recovery', email: member.email, options: { redirectTo },
    });
    if (lErr) return json(400, { error: lErr.message });

    return json(200, { ok: true, actionLink: link.properties?.action_link });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

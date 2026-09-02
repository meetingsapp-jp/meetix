// Edge Function: agency-update-member
// A Director edits a teammate's name/email in THEIR OWN agency. Updating
// app_users.email alone (the old client-side behavior) desyncs the display
// email from the real Supabase Auth account, silently breaking that
// member's ability to log in with the new address and breaking
// admin.auth.admin.generateLink() (used by "Resetear contraseña") since it
// looks up the auth account by email. This function updates both the
// auth user and the app_users row together, atomically from the caller's
// point of view. Service-role only lives here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const CAN_EDIT = ['director_general', 'director_eventos'];

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
    if (!CAN_EDIT.includes(me.role)) return json(403, { error: 'not_allowed' });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.memberId ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const email = String(body.email ?? '').trim();
    if (!memberId || !fullName || !email) return json(400, { error: 'missing_fields' });

    const { data: member } = await admin
      .from('app_users').select('agency_id, email, auth_user_id').eq('id', memberId).maybeSingle();
    if (!member || member.agency_id !== me.agency_id) return json(403, { error: 'not_allowed' });

    if (member.auth_user_id && email !== member.email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(member.auth_user_id, { email, email_confirm: true });
      if (authErr) return json(400, { error: authErr.message });
    }

    const { error: updErr } = await admin
      .from('app_users').update({ full_name: fullName, email }).eq('id', memberId);
    if (updErr) return json(400, { error: updErr.message });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

// Edge Function: admin-create-agency
// Creates a new agency + its owner (Director General) and emails the owner an
// invite to set their password. Only callable by a platform super-admin.
// Uses the service-role key (available in the Edge runtime env) — never exposed
// to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  try {
    // 1) Identify the caller from their JWT.
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json(401, { error: 'unauthorized' });

    const admin = createClient(url, serviceKey);

    // 2) Only platform super-admins may proceed.
    const { data: pa } = await admin.from('platform_admins').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!pa) return json(403, { error: 'not_platform_admin' });

    // 3) Validate input.
    const body = await req.json().catch(() => ({}));
    const agencyName = String(body.agencyName ?? '').trim();
    const ownerName = String(body.ownerName ?? '').trim();
    const ownerEmail = String(body.ownerEmail ?? '').trim();
    const language = ['es', 'en', 'pt'].includes(body.language) ? body.language : 'es';
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
    if (!agencyName || !ownerName || !ownerEmail) return json(400, { error: 'missing_fields' });

    // 4) Create the agency.
    const { data: agency, error: aErr } = await admin
      .from('agencies')
      .insert({ name: agencyName, default_language: language })
      .select('id')
      .single();
    if (aErr) return json(400, { error: aErr.message });

    // 5) Invite the owner (creates the auth user + sends the set-password email).
    const { data: invited, error: iErr } = await admin.auth.admin.inviteUserByEmail(ownerEmail, { redirectTo });
    if (iErr || !invited?.user) {
      await admin.from('agencies').delete().eq('id', agency.id); // rollback
      return json(400, { error: iErr?.message ?? 'invite_failed' });
    }

    // 6) Create the owner's app_users row as Director General, already linked.
    const { error: pErr } = await admin.from('app_users').insert({
      agency_id: agency.id,
      auth_user_id: invited.user.id,
      full_name: ownerName,
      role: 'director_general',
      email: ownerEmail,
      preferred_language: language,
    });
    if (pErr) return json(400, { error: pErr.message });

    return json(200, { ok: true, agencyId: agency.id });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

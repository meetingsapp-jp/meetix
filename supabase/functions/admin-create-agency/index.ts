// Edge Function: admin-create-agency
// Two actions (only callable by a platform super-admin):
//  - default ('create'): create an agency + its owner (Director General) and
//    return a set-password link the admin can share (no email dependency).
//  - 'access_link': generate a fresh set-password link for an existing owner.
// Uses the service-role key from the Edge runtime env — never exposed to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  try {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json(401, { error: 'unauthorized' });

    const admin = createClient(url, serviceKey);
    const { data: pa } = await admin.from('platform_admins').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!pa) return json(403, { error: 'not_platform_admin' });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'create');
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined;
    const ownerEmail = String(body.ownerEmail ?? '').trim();

    // --- Generate a fresh set-password link for an existing owner ---
    if (action === 'access_link') {
      if (!ownerEmail) return json(400, { error: 'missing_fields' });
      const { data: link, error } = await admin.auth.admin.generateLink({
        type: 'recovery', email: ownerEmail, options: { redirectTo },
      });
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true, actionLink: link.properties?.action_link });
    }

    // --- Create agency + owner ---
    const agencyName = String(body.agencyName ?? '').trim();
    const ownerName = String(body.ownerName ?? '').trim();
    const language = ['es', 'en', 'pt'].includes(body.language) ? body.language : 'es';
    if (!agencyName || !ownerName || !ownerEmail) return json(400, { error: 'missing_fields' });

    const { data: agency, error: aErr } = await admin
      .from('agencies').insert({ name: agencyName, default_language: language }).select('id').single();
    if (aErr) return json(400, { error: aErr.message });

    // Create the owner (ignore if the email already exists).
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email: ownerEmail, email_confirm: true });
    if (cErr && !/registered|already|exists/i.test(cErr.message)) {
      await admin.from('agencies').delete().eq('id', agency.id);
      return json(400, { error: cErr.message });
    }

    // Get a set-password link (also yields the user id).
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'recovery', email: ownerEmail, options: { redirectTo },
    });
    if (lErr) {
      await admin.from('agencies').delete().eq('id', agency.id);
      return json(400, { error: lErr.message });
    }
    const userId = created?.user?.id ?? link.user?.id ?? null;

    const { error: pErr } = await admin.from('app_users').insert({
      agency_id: agency.id,
      auth_user_id: userId,
      full_name: ownerName,
      role: 'director_general',
      email: ownerEmail,
      preferred_language: language,
    });
    if (pErr && !/duplicate|unique/i.test(pErr.message)) {
      return json(400, { error: pErr.message });
    }

    return json(200, { ok: true, agencyId: agency.id, actionLink: link.properties?.action_link });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

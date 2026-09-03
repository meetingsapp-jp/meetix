// Edge Function: transport-en-route
// Public, no-login endpoint: a driver taps a link (containing an
// unguessable access_token, no auth) to signal "ya salí" for their
// transport job. No passenger or agency data is ever returned — the
// response only confirms success and echoes the provider's own name back
// (so the driver sees "Gracias, Remis Sur" as a sanity check that they
// tapped the right link). Service-role only lives here, since normal RLS
// has no anon-write path onto transport_providers.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? '').trim();
    if (!token) return json(400, { error: 'missing_token' });

    const admin = createClient(url, serviceKey);
    const { data: provider, error: selErr } = await admin
      .from('transport_providers').select('id, name').eq('access_token', token).maybeSingle();
    if (selErr) return json(500, { error: selErr.message });
    if (!provider) return json(404, { error: 'not_found' });

    const { error: updErr } = await admin
      .from('transport_providers').update({ en_route_at: new Date().toISOString() }).eq('id', provider.id);
    if (updErr) return json(400, { error: updErr.message });

    return json(200, { ok: true, providerName: provider.name });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

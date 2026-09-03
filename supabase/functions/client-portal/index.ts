// Edge Function: client-portal
// Public, no-login endpoint for the agency's own client to view an event
// and plan its agenda (per demo feedback: "posibilidad de hacer una app
// para Cliente" so they can plan the template/agenda before the event).
// Access is scoped entirely by an unguessable per-event access_token —
// there is no app_users account, no session, no other event/agency data
// is ever reachable through this endpoint. Service-role only lives here,
// since normal RLS has no anon path onto events/sessions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SESSION_TYPES = ['charla', 'comida', 'traslado', 'actividad', 'libre'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? '').trim();
    const action = String(body.action ?? '');
    if (!token) return json(400, { error: 'missing_token' });

    const { data: event, error: evErr } = await admin
      .from('events')
      .select('id, agency_id, name, start_date, end_date, destinations, status')
      .eq('client_access_token', token)
      .maybeSingle();
    if (evErr) return json(500, { error: evErr.message });
    if (!event) return json(404, { error: 'not_found' });

    if (action === 'get_event') {
      return json(200, { ok: true, event });
    }

    if (action === 'list_sessions') {
      const { data, error } = await admin
        .from('sessions')
        .select('id, name, starts_at, ends_at, session_type, location')
        .eq('event_id', event.id)
        .order('starts_at', { ascending: true, nullsFirst: false });
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true, sessions: data ?? [] });
    }

    if (action === 'create_session' || action === 'update_session') {
      const p = body.payload ?? {};
      const name = String(p.name ?? '').trim();
      if (!name) return json(400, { error: 'missing_name' });
      const sessionType = SESSION_TYPES.includes(p.session_type) ? p.session_type : null;
      const patch = {
        name,
        starts_at: p.starts_at ?? null,
        ends_at: p.ends_at ?? null,
        session_type: sessionType,
        location: p.location ? String(p.location).trim() : null,
      };
      if (action === 'create_session') {
        const { data, error } = await admin
          .from('sessions')
          .insert({ ...patch, event_id: event.id, agency_id: event.agency_id })
          .select('id, name, starts_at, ends_at, session_type, location')
          .single();
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true, session: data });
      }
      const sessionId = String(p.id ?? '');
      if (!sessionId) return json(400, { error: 'missing_id' });
      const { data: existing } = await admin.from('sessions').select('event_id').eq('id', sessionId).maybeSingle();
      if (!existing || existing.event_id !== event.id) return json(403, { error: 'not_allowed' });
      const { data, error } = await admin
        .from('sessions').update(patch).eq('id', sessionId)
        .select('id, name, starts_at, ends_at, session_type, location').single();
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true, session: data });
    }

    if (action === 'delete_session') {
      const sessionId = String(body.payload?.id ?? '');
      if (!sessionId) return json(400, { error: 'missing_id' });
      const { data: existing } = await admin.from('sessions').select('event_id').eq('id', sessionId).maybeSingle();
      if (!existing || existing.event_id !== event.id) return json(403, { error: 'not_allowed' });
      const { error } = await admin.from('sessions').delete().eq('id', sessionId);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown_action' });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

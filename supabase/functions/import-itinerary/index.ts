// Edge Function: import-itinerary
// Takes free-form itinerary text (pasted from a confirmation email, PDF export,
// hotel rooming list, etc.) and uses an LLM to extract structured passenger rows,
// in the same shape the Excel import already understands (see ParsedRow on the
// client). Requires the caller to be a signed-in team member of an agency, and
// an ANTHROPIC_API_KEY secret configured on this project.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_INPUT_CHARS = 20000;

const TOOL_SCHEMA = {
  name: 'extract_passengers',
  description: 'Extract structured passenger/travel rows from itinerary text.',
  input_schema: {
    type: 'object',
    properties: {
      passengers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string' },
            email: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            document_id: { type: ['string', 'null'], description: 'Passport or ID number' },
            nationality: { type: ['string', 'null'] },
            is_vip: { type: 'boolean' },
            hotel: { type: ['string', 'null'] },
            room_number: { type: ['string', 'null'] },
            emergency_contact: { type: ['string', 'null'] },
            notes: { type: ['string', 'null'] },
            arrival: {
              type: 'object',
              properties: {
                airline: { type: ['string', 'null'] },
                flight_number: { type: ['string', 'null'] },
                flight_datetime: { type: ['string', 'null'], description: 'ISO 8601 datetime, or null if unknown' },
              },
              required: ['airline', 'flight_number', 'flight_datetime'],
            },
            departure: {
              type: 'object',
              properties: {
                airline: { type: ['string', 'null'] },
                flight_number: { type: ['string', 'null'] },
                flight_datetime: { type: ['string', 'null'], description: 'ISO 8601 datetime, or null if unknown' },
              },
              required: ['airline', 'flight_number', 'flight_datetime'],
            },
          },
          required: ['full_name', 'arrival', 'departure'],
        },
      },
    },
    required: ['passengers'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json(500, { error: 'ai_not_configured' });

  try {
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json(401, { error: 'unauthorized' });

    const { data: me } = await caller.from('app_users').select('agency_id').eq('auth_user_id', user.id).maybeSingle();
    if (!me) return json(403, { error: 'not_in_agency' });

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? '').trim();
    if (!text) return json(400, { error: 'missing_text' });

    const truncated = text.slice(0, MAX_INPUT_CHARS);
    const today = new Date().toISOString().slice(0, 10);

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system:
          `You extract traveler/passenger data from itinerary documents (confirmation emails, PDFs, rooming lists, ` +
          `transport manifests) into structured rows. Today's date is ${today}; use it to resolve dates without a year. ` +
          `Only include people who are actually travelers/guests, not agency staff. If a field isn't present, use null ` +
          `(or false for is_vip). Call the extract_passengers tool exactly once with everything you found.`,
        messages: [{ role: 'user', content: truncated }],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: 'extract_passengers' },
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      return json(502, { error: 'ai_request_failed', detail: errBody.slice(0, 500) });
    }

    const aiData = await aiRes.json();
    const toolUse = (aiData.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
    if (!toolUse) return json(502, { error: 'ai_no_tool_use' });

    const passengers = Array.isArray(toolUse.input?.passengers) ? toolUse.input.passengers : [];
    return json(200, { ok: true, passengers });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

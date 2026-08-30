import { supabase } from '../supabaseClient';
import type { ParsedRow } from './passengers';

interface AiPassenger {
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  nationality: string | null;
  is_vip: boolean;
  hotel: string | null;
  room_number: string | null;
  emergency_contact: string | null;
  notes: string | null;
  arrival: { airline: string | null; flight_number: string | null; flight_datetime: string | null };
  departure: { airline: string | null; flight_number: string | null; flight_datetime: string | null };
}

// Sends pasted itinerary text to the import-itinerary edge function, which uses
// an LLM to extract structured passenger rows, and adapts them into the same
// ParsedRow shape the Excel import already produces (so the same review/import
// UI works for both paths).
export async function extractItineraryText(text: string): Promise<ParsedRow[]> {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  const { data, error } = await supabase.functions.invoke('import-itinerary', { body: { text } });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) {
        const b = await ctx.json();
        detail = b.error === 'ai_not_configured'
          ? 'La importación con IA no está configurada (falta la clave de API).'
          : (b.error ?? detail);
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const passengers = ((data as { passengers?: AiPassenger[] })?.passengers ?? []) as AiPassenger[];
  return passengers.map((p) => ({
    full_name: (p.full_name ?? '').trim(),
    email: p.email ?? null,
    phone: p.phone ?? null,
    document_id: p.document_id ?? null,
    nationality: p.nationality ?? null,
    is_vip: Boolean(p.is_vip),
    hotel: p.hotel ?? null,
    room_number: p.room_number ?? null,
    emergency_contact: p.emergency_contact ?? null,
    notes: p.notes ?? null,
    arrival: {
      airline: p.arrival?.airline ?? null,
      flight_number: p.arrival?.flight_number ?? null,
      flight_datetime: p.arrival?.flight_datetime ?? null,
    },
    departure: {
      airline: p.departure?.airline ?? null,
      flight_number: p.departure?.flight_number ?? null,
      flight_datetime: p.departure?.flight_datetime ?? null,
    },
    valid: Boolean((p.full_name ?? '').trim()),
  }));
}

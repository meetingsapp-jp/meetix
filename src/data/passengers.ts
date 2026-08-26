import { supabase } from '../lib/supabaseClient';
import type { EventRow, FlightDirection, Hotel, PassengerWithMeta } from '../types';
import type { ParsedRow } from '../lib/import/passengers';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export interface PassengerInput {
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  nationality: string | null;
  is_vip: boolean;
  hotel_id: string | null;
  room_number: string | null;
  emergency_contact: string | null;
  dietary: string | null;
  allergies: string | null;
  special_needs: string | null;
  notes: string | null;
}

export interface FlightInput {
  airline: string | null;
  flight_number: string | null;
  flight_datetime: string | null;
}

export interface FlightsInput {
  arrival: FlightInput;
  departure: FlightInput;
}

function hasFlightData(f: FlightInput): boolean {
  return Boolean(f.airline || f.flight_number || f.flight_datetime);
}

export async function getEvent(eventId: string): Promise<EventRow> {
  const { data, error } = await client().from('events').select('*').eq('id', eventId).single();
  if (error) throw new Error(error.message);
  return data as EventRow;
}

export async function listPassengers(eventId: string): Promise<PassengerWithMeta[]> {
  const { data, error } = await client()
    .from('passengers')
    .select('*, hotel:hotels(name), transport_provider:transport_providers(name), flights(*)')
    .eq('event_id', eventId)
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as PassengerWithMeta[];
}

// Flights are rewritten wholesale for a passenger (at most one arrival + one departure).
async function saveFlights(agencyId: string, passengerId: string, flights: FlightsInput) {
  await client().from('flights').delete().eq('passenger_id', passengerId);
  const rows = (['arrival', 'departure'] as FlightDirection[])
    .map((direction) => ({ direction, data: flights[direction] }))
    .filter((r) => hasFlightData(r.data))
    .map((r) => ({
      agency_id: agencyId,
      passenger_id: passengerId,
      direction: r.direction,
      airline: r.data.airline,
      flight_number: r.data.flight_number,
      flight_datetime: r.data.flight_datetime,
    }));
  if (rows.length) {
    const { error } = await client().from('flights').insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function createPassenger(
  agencyId: string,
  eventId: string,
  input: PassengerInput,
  flights: FlightsInput,
): Promise<void> {
  const { data, error } = await client()
    .from('passengers')
    .insert({
      ...input,
      agency_id: agencyId,
      event_id: eventId,
      transport_type: input.is_vip ? 'vip' : 'group',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await saveFlights(agencyId, (data as { id: string }).id, flights);
}

export async function updatePassenger(
  agencyId: string,
  id: string,
  input: PassengerInput,
  flights: FlightsInput,
): Promise<void> {
  const { error } = await client()
    .from('passengers')
    .update({ ...input, transport_type: input.is_vip ? 'vip' : 'group' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await saveFlights(agencyId, id, flights);
}

export async function deletePassenger(id: string): Promise<void> {
  const { error } = await client().from('passengers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Quick VIP/group toggle used by the transport view (keeps is_vip and
// transport_type in sync).
export async function setPassengerVip(id: string, isVip: boolean): Promise<void> {
  const { error } = await client()
    .from('passengers')
    .update({ is_vip: isVip, transport_type: isVip ? 'vip' : 'group' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// Bulk import from a parsed spreadsheet: auto-creates missing hotels, then
// inserts all passengers and their flights. Uses client-generated ids so we can
// attach flights without relying on insert order.
export async function bulkImportPassengers(
  agencyId: string,
  eventId: string,
  rows: ParsedRow[],
): Promise<{ inserted: number }> {
  const valid = rows.filter((r) => r.full_name.trim());
  if (!valid.length) return { inserted: 0 };
  const db = client();

  // 1) Ensure every referenced hotel exists (match by name, create the rest).
  const existing = await listHotels(eventId);
  const hotelId = new Map(existing.map((h) => [h.name.trim().toLowerCase(), h.id]));
  const missing = [...new Set(valid.map((r) => r.hotel?.trim()).filter(Boolean) as string[])].filter(
    (name) => !hotelId.has(name.toLowerCase()),
  );
  if (missing.length) {
    const { data, error } = await db
      .from('hotels')
      .insert(missing.map((name) => ({ agency_id: agencyId, event_id: eventId, name })))
      .select('id, name');
    if (error) throw new Error(error.message);
    (data ?? []).forEach((h: { id: string; name: string }) => hotelId.set(h.name.trim().toLowerCase(), h.id));
  }

  // 2) Build passenger rows with explicit ids.
  const pax = valid.map((r) => ({
    id: crypto.randomUUID(),
    row: r,
    record: {
      id: undefined as unknown as string, // filled below
      agency_id: agencyId,
      event_id: eventId,
      full_name: r.full_name.trim(),
      email: r.email,
      phone: r.phone,
      document_id: r.document_id,
      nationality: r.nationality,
      is_vip: r.is_vip,
      transport_type: r.is_vip ? 'vip' : 'group',
      transport_provider_id: null,
      hotel_id: r.hotel ? hotelId.get(r.hotel.trim().toLowerCase()) ?? null : null,
      room_number: r.room_number,
      emergency_contact: r.emergency_contact,
      notes: r.notes,
    },
  }));
  pax.forEach((p) => (p.record.id = p.id));

  const { error: pErr } = await db.from('passengers').insert(pax.map((p) => p.record));
  if (pErr) throw new Error(pErr.message);

  // 3) Flights (arrival/departure) for rows that carry any flight data.
  const flights: Record<string, unknown>[] = [];
  for (const p of pax) {
    for (const dir of ['arrival', 'departure'] as FlightDirection[]) {
      const f = p.row[dir];
      if (f.airline || f.flight_number || f.flight_datetime) {
        flights.push({
          agency_id: agencyId,
          passenger_id: p.id,
          direction: dir,
          airline: f.airline,
          flight_number: f.flight_number,
          flight_datetime: f.flight_datetime,
        });
      }
    }
  }
  if (flights.length) {
    const { error: fErr } = await db.from('flights').insert(flights);
    if (fErr) throw new Error(fErr.message);
  }

  return { inserted: pax.length };
}

// --- Hotels (needed by the passenger form) ---
export async function listHotels(eventId: string): Promise<Hotel[]> {
  const { data, error } = await client().from('hotels').select('*').eq('event_id', eventId).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Hotel[];
}

export async function createHotel(agencyId: string, eventId: string, name: string): Promise<Hotel> {
  const { data, error } = await client()
    .from('hotels')
    .insert({ agency_id: agencyId, event_id: eventId, name })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Hotel;
}

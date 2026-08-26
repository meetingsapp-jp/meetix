import { supabase } from '../lib/supabaseClient';
import type { EventRow, FlightDirection, Hotel, PassengerWithMeta, Person } from '../types';
import type { ParsedRow } from '../lib/import/passengers';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

// The passenger form still edits one combined object; the data layer splits it
// into the person (stable) and the participation (event-specific).
export interface PassengerInput {
  full_name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  nationality: string | null;
  is_vip: boolean;
  hotel_id: string | null;
  room_number: string | null;
  cost_center: string | null;
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
  terminal: string | null;
}

export interface FlightsInput {
  arrival: FlightInput;
  departure: FlightInput;
}

function personFields(i: PassengerInput) {
  return {
    full_name: i.full_name,
    email: i.email,
    phone: i.phone,
    document_id: i.document_id,
    nationality: i.nationality,
    dietary: i.dietary,
    allergies: i.allergies,
    special_needs: i.special_needs,
    emergency_contact: i.emergency_contact,
  };
}

function participationFields(i: PassengerInput) {
  return {
    is_vip: i.is_vip,
    transport_type: i.is_vip ? 'vip' : 'group',
    hotel_id: i.hotel_id,
    room_number: i.room_number,
    cost_center: i.cost_center,
    notes: i.notes,
  };
}

function hasFlightData(f: FlightInput): boolean {
  return Boolean(f.airline || f.flight_number || f.flight_datetime || f.terminal);
}

// Flatten a joined person onto the participation row so downstream reads
// (`p.full_name`, `p.dietary`, …) keep working unchanged.
function flatten(row: any): PassengerWithMeta {
  const person = row.person ?? null;
  return {
    id: row.id,
    agency_id: row.agency_id,
    event_id: row.event_id,
    person_id: row.person_id,
    is_vip: row.is_vip,
    transport_type: row.transport_type,
    transport_provider_id: row.transport_provider_id,
    hotel_id: row.hotel_id,
    room_number: row.room_number,
    cost_center: row.cost_center ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    full_name: person?.full_name ?? '',
    email: person?.email ?? null,
    phone: person?.phone ?? null,
    document_id: person?.document_id ?? null,
    nationality: person?.nationality ?? null,
    dietary: person?.dietary ?? null,
    allergies: person?.allergies ?? null,
    special_needs: person?.special_needs ?? null,
    emergency_contact: person?.emergency_contact ?? null,
    person,
    hotel: row.hotel ?? null,
    transport_provider: row.transport_provider ?? null,
    flights: row.flights ?? [],
  };
}

const PARTICIPATION_SELECT =
  'id, agency_id, event_id, person_id, is_vip, transport_type, transport_provider_id, ' +
  'hotel_id, room_number, cost_center, notes, created_at, updated_at, ' +
  'person:people(*), hotel:hotels(name), transport_provider:transport_providers(name), flights(*)';

export async function getEvent(eventId: string): Promise<EventRow> {
  const { data, error } = await client().from('events').select('*').eq('id', eventId).single();
  if (error) throw new Error(error.message);
  return data as EventRow;
}

export async function listPassengers(eventId: string): Promise<PassengerWithMeta[]> {
  const { data, error } = await client()
    .from('passengers')
    .select(PARTICIPATION_SELECT)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(flatten).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

// --- People directory --------------------------------------------------------

export async function listPeople(agencyId: string): Promise<Person[]> {
  const { data, error } = await client()
    .from('people')
    .select('*')
    .eq('agency_id', agencyId)
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Person[];
}

// Match an existing person by document, then email, within the agency.
async function findPersonId(agencyId: string, documentId: string | null, email: string | null): Promise<string | null> {
  const db = client();
  if (documentId) {
    const { data } = await db.from('people').select('id').eq('agency_id', agencyId).eq('document_id', documentId).limit(1);
    if (data && data.length) return data[0].id as string;
  }
  if (email) {
    const { data } = await db.from('people').select('id').eq('agency_id', agencyId).eq('email', email).limit(1);
    if (data && data.length) return data[0].id as string;
  }
  return null;
}

// Reuse the given person (or one matched by identity), else create a new one.
async function upsertPerson(agencyId: string, fields: ReturnType<typeof personFields>, personId: string | null): Promise<string> {
  const db = client();
  if (personId) {
    const { error } = await db.from('people').update(fields).eq('id', personId);
    if (error) throw new Error(error.message);
    return personId;
  }
  const existing = await findPersonId(agencyId, fields.document_id, fields.email);
  if (existing) {
    const { error } = await db.from('people').update(fields).eq('id', existing);
    if (error) throw new Error(error.message);
    return existing;
  }
  const { data, error } = await db.from('people').insert({ ...fields, agency_id: agencyId }).select('id').single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

// Flights are rewritten wholesale for a participation (one arrival + one departure).
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
      terminal: r.data.terminal,
    }));
  if (rows.length) {
    const { error } = await client().from('flights').insert(rows);
    if (error) throw new Error(error.message);
  }
}

// personId: pass when the user picked someone from the directory; otherwise the
// person is matched by identity or created.
export async function createPassenger(
  agencyId: string,
  eventId: string,
  input: PassengerInput,
  flights: FlightsInput,
  personId: string | null = null,
): Promise<void> {
  const pid = await upsertPerson(agencyId, personFields(input), personId);
  const { data, error } = await client()
    .from('passengers')
    .insert({ ...participationFields(input), agency_id: agencyId, event_id: eventId, person_id: pid })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await saveFlights(agencyId, (data as { id: string }).id, flights);
}

export async function updatePassenger(
  agencyId: string,
  id: string,
  personId: string,
  input: PassengerInput,
  flights: FlightsInput,
): Promise<void> {
  await upsertPerson(agencyId, personFields(input), personId);
  const { error } = await client().from('passengers').update(participationFields(input)).eq('id', id);
  if (error) throw new Error(error.message);
  await saveFlights(agencyId, id, flights);
}

export async function deletePassenger(id: string): Promise<void> {
  const { error } = await client().from('passengers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Quick VIP/group toggle used by the transport view.
export async function setPassengerVip(id: string, isVip: boolean): Promise<void> {
  const { error } = await client()
    .from('passengers')
    .update({ is_vip: isVip, transport_type: isVip ? 'vip' : 'group' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// Identity key for dedup: document > email > name.
function personKey(documentId: string | null, email: string | null, fullName: string): string {
  const d = documentId?.trim();
  if (d) return `d:${d.toLowerCase()}`;
  const e = email?.trim();
  if (e) return `e:${e.toLowerCase()}`;
  return `n:${fullName.trim().toLowerCase()}`;
}

// Bulk import: ensure hotels, then find-or-create people, then participations
// and their flights. Same person across rows/events is reused.
export async function bulkImportPassengers(
  agencyId: string,
  eventId: string,
  rows: ParsedRow[],
): Promise<{ inserted: number }> {
  const valid = rows.filter((r) => r.full_name.trim());
  if (!valid.length) return { inserted: 0 };
  const db = client();

  // 1) Ensure hotels exist.
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

  // 2) Find-or-create people (deduped by identity).
  const { data: existingPeople, error: pplErr } = await db
    .from('people')
    .select('id, document_id, email, full_name')
    .eq('agency_id', agencyId);
  if (pplErr) throw new Error(pplErr.message);
  const personIdByKey = new Map<string, string>();
  for (const pe of existingPeople ?? []) {
    personIdByKey.set(personKey(pe.document_id, pe.email, pe.full_name), pe.id);
  }
  const toCreate = new Map<string, Record<string, unknown>>();
  for (const r of valid) {
    const key = personKey(r.document_id, r.email, r.full_name);
    if (!personIdByKey.has(key) && !toCreate.has(key)) {
      toCreate.set(key, {
        agency_id: agencyId,
        full_name: r.full_name.trim(),
        email: r.email,
        phone: r.phone,
        document_id: r.document_id,
        nationality: r.nationality,
        emergency_contact: r.emergency_contact,
      });
    }
  }
  if (toCreate.size) {
    const { data, error } = await db.from('people').insert([...toCreate.values()]).select('id, document_id, email, full_name');
    if (error) throw new Error(error.message);
    for (const pe of data ?? []) personIdByKey.set(personKey(pe.document_id, pe.email, pe.full_name), pe.id);
  }

  // 3) Participations with explicit ids so flights can attach.
  const pax = valid.map((r) => ({
    id: crypto.randomUUID(),
    row: r,
    record: {
      id: undefined as unknown as string,
      agency_id: agencyId,
      event_id: eventId,
      person_id: personIdByKey.get(personKey(r.document_id, r.email, r.full_name))!,
      is_vip: r.is_vip,
      transport_type: r.is_vip ? 'vip' : 'group',
      transport_provider_id: null,
      hotel_id: r.hotel ? hotelId.get(r.hotel.trim().toLowerCase()) ?? null : null,
      room_number: r.room_number,
      notes: r.notes,
    },
  }));
  pax.forEach((p) => (p.record.id = p.id));

  const { error: pErr } = await db.from('passengers').insert(pax.map((p) => p.record));
  if (pErr) throw new Error(pErr.message);

  // 4) Flights.
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

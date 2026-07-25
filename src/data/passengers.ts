import { supabase } from '../lib/supabaseClient';
import type { EventRow, FlightDirection, Hotel, PassengerWithMeta } from '../types';

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
    .select('*, hotel:hotels(name), flights(*)')
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

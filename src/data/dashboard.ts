import { supabase } from '../lib/supabaseClient';
import type { EventStatus, FlightDirection } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export interface DashboardFlight {
  direction: FlightDirection;
  airline: string | null;
  flight_number: string | null;
  flight_datetime: string | null;
}

export interface DashboardPassenger {
  id: string;
  full_name: string;
  document_id: string | null;
  email: string | null;
  phone: string | null;
  is_vip: boolean;
  hotel_id: string | null;
  room_number: string | null;
  event_id: string;
  event: { name: string; status: EventStatus } | null;
  flights: DashboardFlight[];
}

// Agency-wide passenger snapshot used to power the live dashboard: upcoming
// flights, VIP totals, data-quality alerts (missing hotel/flight/room), and
// the cross-event passenger search (a passenger's own event page can only
// search within that one event).
export async function listAgencyPassengers(agencyId: string): Promise<DashboardPassenger[]> {
  const { data, error } = await client()
    .from('passengers')
    .select(
      'id, is_vip, hotel_id, room_number, event_id, person:people(full_name, document_id, email, phone), ' +
        'event:events(name, status), flights(direction, airline, flight_number, flight_datetime)',
    )
    .eq('agency_id', agencyId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    full_name: row.person?.full_name ?? '',
    document_id: row.person?.document_id ?? null,
    email: row.person?.email ?? null,
    phone: row.person?.phone ?? null,
    event: row.event ?? null,
    flights: row.flights ?? [],
  })) as DashboardPassenger[];
}

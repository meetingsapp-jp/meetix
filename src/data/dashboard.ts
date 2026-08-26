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
  is_vip: boolean;
  hotel_id: string | null;
  room_number: string | null;
  event_id: string;
  event: { name: string; status: EventStatus } | null;
  flights: DashboardFlight[];
}

// Agency-wide passenger snapshot used to power the live dashboard: upcoming
// flights, VIP totals, and data-quality alerts (missing hotel/flight/room).
export async function listAgencyPassengers(agencyId: string): Promise<DashboardPassenger[]> {
  const { data, error } = await client()
    .from('passengers')
    .select(
      'id, is_vip, hotel_id, room_number, event_id, person:people(full_name), ' +
        'event:events(name, status), flights(direction, airline, flight_number, flight_datetime)',
    )
    .eq('agency_id', agencyId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    full_name: row.person?.full_name ?? '',
    event: row.event ?? null,
    flights: row.flights ?? [],
  })) as DashboardPassenger[];
}

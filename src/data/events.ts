import { supabase } from '../lib/supabaseClient';
import type { Client, EventRow, EventStatus, EventWithMeta } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export interface EventInput {
  name: string;
  client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  destinations: string[];
  status: EventStatus;
}

// List events for the agency, with client name and passenger count.
export async function listEvents(agencyId: string): Promise<EventWithMeta[]> {
  const { data, error } = await client()
    .from('events')
    .select('*, client:clients(name), passengers(count)')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    client: row.client ?? null,
    passenger_count: row.passengers?.[0]?.count ?? 0,
  })) as EventWithMeta[];
}

export async function createEvent(agencyId: string, input: EventInput): Promise<EventRow> {
  const { data, error } = await client()
    .from('events')
    .insert({ ...input, agency_id: agencyId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as EventRow;
}

export async function updateEvent(id: string, input: EventInput): Promise<EventRow> {
  const { data, error } = await client().from('events').update(input).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data as EventRow;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await client().from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Clients (needed by the event form) ---
export async function listClients(agencyId: string): Promise<Client[]> {
  const { data, error } = await client()
    .from('clients')
    .select('*')
    .eq('agency_id', agencyId)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}

export async function createClient(agencyId: string, name: string, country: string | null): Promise<Client> {
  const { data, error } = await client()
    .from('clients')
    .insert({ agency_id: agencyId, name, country })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Client;
}

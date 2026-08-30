import { supabase } from '../lib/supabaseClient';
import type { AppUser, Client, EventRow, EventStatus, EventWithMeta } from '../types';

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

// --- Coordinator assignment (guía/coordinador only sees events assigned to them) ---

export async function listCoordinators(agencyId: string): Promise<AppUser[]> {
  const { data, error } = await client()
    .from('app_users')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('role', 'guia_coordinador')
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as AppUser[];
}

export async function listEventCoordinatorIds(eventId: string): Promise<string[]> {
  const { data, error } = await client().from('event_coordinators').select('app_user_id').eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { app_user_id: string }) => r.app_user_id);
}

// Rewrites the full set of coordinators assigned to an event.
export async function setEventCoordinators(agencyId: string, eventId: string, appUserIds: string[]): Promise<void> {
  const db = client();
  const { error: delErr } = await db.from('event_coordinators').delete().eq('event_id', eventId);
  if (delErr) throw new Error(delErr.message);
  if (appUserIds.length) {
    const { error } = await db
      .from('event_coordinators')
      .insert(appUserIds.map((appUserId) => ({ agency_id: agencyId, event_id: eventId, app_user_id: appUserId })));
    if (error) throw new Error(error.message);
  }
}

export async function listAssignedEventIds(appUserId: string): Promise<string[]> {
  const { data, error } = await client().from('event_coordinators').select('event_id').eq('app_user_id', appUserId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { event_id: string }) => r.event_id);
}

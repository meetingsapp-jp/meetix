import { supabase } from '../lib/supabaseClient';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export type IncidentSeverity = 'info' | 'warning' | 'urgent';

export interface Incident {
  id: string;
  agency_id: string;
  event_id: string;
  passenger_id: string | null;
  title: string;
  detail: string | null;
  severity: IncidentSeverity;
  resolved: boolean;
  created_by: string | null;
  created_at: string;
}

// --- Arrival check-in (who has landed) ---------------------------------------

// Passenger ids marked as arrived. RLS scopes rows to the agency; the caller
// intersects with the event's passengers, so no event filter is needed here.
export async function listArrivedIds(_eventId?: string): Promise<string[]> {
  const { data, error } = await client().from('arrival_checkins').select('passenger_id');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { passenger_id: string }) => r.passenger_id);
}

export async function setArrived(agencyId: string, passengerId: string, arrived: boolean): Promise<void> {
  const db = client();
  if (arrived) {
    const { error } = await db
      .from('arrival_checkins')
      .upsert(
        { agency_id: agencyId, passenger_id: passengerId, arrived_at: new Date().toISOString() },
        { onConflict: 'passenger_id' },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('arrival_checkins').delete().eq('passenger_id', passengerId);
    if (error) throw new Error(error.message);
  }
}

// --- Incidents ---------------------------------------------------------------

export interface IncidentInput {
  title: string;
  detail: string | null;
  severity: IncidentSeverity;
  passenger_id: string | null;
  created_by: string | null;
}

export async function listIncidents(eventId: string): Promise<Incident[]> {
  const { data, error } = await client()
    .from('incidents')
    .select('*')
    .eq('event_id', eventId)
    .order('resolved')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Incident[];
}

export async function createIncident(agencyId: string, eventId: string, input: IncidentInput): Promise<Incident> {
  const { data, error } = await client()
    .from('incidents')
    .insert({ ...input, agency_id: agencyId, event_id: eventId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Incident;
}

export async function setIncidentResolved(id: string, resolved: boolean): Promise<void> {
  const { error } = await client().from('incidents').update({ resolved }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteIncident(id: string): Promise<void> {
  const { error } = await client().from('incidents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Event notes (running notepad shared by the team) ------------------------

export interface EventNote {
  id: string;
  agency_id: string;
  event_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
}

export async function listEventNotes(eventId: string): Promise<EventNote[]> {
  const { data, error } = await client()
    .from('event_notes')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventNote[];
}

export async function addEventNote(
  agencyId: string,
  eventId: string,
  authorId: string | null,
  authorName: string | null,
  body: string,
): Promise<EventNote> {
  const { data, error } = await client()
    .from('event_notes')
    .insert({ agency_id: agencyId, event_id: eventId, author_id: authorId, author_name: authorName, body })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as EventNote;
}

export async function deleteEventNote(id: string): Promise<void> {
  const { error } = await client().from('event_notes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- Event team chat -----------------------------------------------------------

export interface EventMessage {
  id: string;
  agency_id: string;
  event_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
}

export async function listEventMessages(eventId: string): Promise<EventMessage[]> {
  const { data, error } = await client()
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventMessage[];
}

export async function sendEventMessage(
  agencyId: string,
  eventId: string,
  authorId: string | null,
  authorName: string | null,
  body: string,
): Promise<EventMessage> {
  const { data, error } = await client()
    .from('event_messages')
    .insert({ agency_id: agencyId, event_id: eventId, author_id: authorId, author_name: authorName, body })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as EventMessage;
}

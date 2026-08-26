import { supabase } from '../lib/supabaseClient';
import type { Session, SessionType, SessionWithMeta } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export interface SessionInput {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  session_type: SessionType | null;
  location: string | null;
}

// Agenda for an event: sessions ordered chronologically, each with its
// attendee count so the list can show "N asistentes" without extra queries.
export async function listSessions(eventId: string): Promise<SessionWithMeta[]> {
  const { data, error } = await client()
    .from('sessions')
    .select('*, session_attendance(count)')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true, nullsFirst: false })
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    attendee_count: row.session_attendance?.[0]?.count ?? 0,
  })) as SessionWithMeta[];
}

export async function createSession(agencyId: string, eventId: string, input: SessionInput): Promise<Session> {
  const { data, error } = await client()
    .from('sessions')
    .insert({ ...input, agency_id: agencyId, event_id: eventId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Session;
}

export async function updateSession(id: string, input: SessionInput): Promise<Session> {
  const { data, error } = await client().from('sessions').update(input).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data as Session;
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await client().from('sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Passenger ids currently marked as attending a given session.
export async function listAttendeeIds(sessionId: string): Promise<string[]> {
  const { data, error } = await client()
    .from('session_attendance')
    .select('passenger_id')
    .eq('session_id', sessionId)
    .eq('attending', true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { passenger_id: string }) => r.passenger_id);
}

// Toggle a passenger's attendance for a session. Presence of a row (attending)
// means "attends"; unchecking removes the row to keep the table clean.
export async function setAttendance(
  agencyId: string,
  sessionId: string,
  passengerId: string,
  attending: boolean,
): Promise<void> {
  const db = client();
  if (attending) {
    const { error } = await db
      .from('session_attendance')
      .upsert(
        { agency_id: agencyId, session_id: sessionId, passenger_id: passengerId, attending: true },
        { onConflict: 'session_id,passenger_id' },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from('session_attendance')
      .delete()
      .eq('session_id', sessionId)
      .eq('passenger_id', passengerId);
    if (error) throw new Error(error.message);
  }
}

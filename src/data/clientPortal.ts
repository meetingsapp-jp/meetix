import { supabase } from '../lib/supabaseClient';

export interface ClientPortalEvent {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destinations: string[];
  status: string;
}

export interface ClientPortalSession {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  session_type: string | null;
  location: string | null;
}

export interface ClientSessionInput {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  session_type: string | null;
  location: string | null;
}

async function call<T>(token: string, action: string, payload?: unknown): Promise<T> {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  const { data, error } = await supabase.functions.invoke('client-portal', { body: { token, action, payload } });
  if (error || !data?.ok) {
    throw new Error(data?.error ?? error?.message ?? 'unknown_error');
  }
  return data as T;
}

export async function getPortalEvent(token: string): Promise<ClientPortalEvent> {
  const { event } = await call<{ event: ClientPortalEvent }>(token, 'get_event');
  return event;
}

export async function listPortalSessions(token: string): Promise<ClientPortalSession[]> {
  const { sessions } = await call<{ sessions: ClientPortalSession[] }>(token, 'list_sessions');
  return sessions;
}

export async function createPortalSession(token: string, input: ClientSessionInput): Promise<ClientPortalSession> {
  const { session } = await call<{ session: ClientPortalSession }>(token, 'create_session', input);
  return session;
}

export async function updatePortalSession(
  token: string,
  id: string,
  input: ClientSessionInput,
): Promise<ClientPortalSession> {
  const { session } = await call<{ session: ClientPortalSession }>(token, 'update_session', { ...input, id });
  return session;
}

export async function deletePortalSession(token: string, id: string): Promise<void> {
  await call(token, 'delete_session', { id });
}

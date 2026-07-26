import { supabase } from '../lib/supabaseClient';
import type { TransportProvider } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export async function listProviders(eventId: string): Promise<TransportProvider[]> {
  const { data, error } = await client()
    .from('transport_providers')
    .select('*')
    .eq('event_id', eventId)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as TransportProvider[];
}

export interface ProviderInput {
  name: string;
  contact_phone: string | null;
  notes: string | null;
}

export async function createProvider(
  agencyId: string,
  eventId: string,
  input: ProviderInput,
): Promise<TransportProvider> {
  const { data, error } = await client()
    .from('transport_providers')
    .insert({ ...input, agency_id: agencyId, event_id: eventId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TransportProvider;
}

// Assign (or clear) a transport provider on a passenger.
export async function setPassengerProvider(passengerId: string, providerId: string | null): Promise<void> {
  const { error } = await client()
    .from('passengers')
    .update({ transport_provider_id: providerId })
    .eq('id', passengerId);
  if (error) throw new Error(error.message);
}

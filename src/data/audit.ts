import { supabase } from '../lib/supabaseClient';

export interface AuditEntry {
  id: string;
  agency_id: string;
  event_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  detail: string | null;
  created_at: string;
}

// Fire-and-forget: an audit entry is never allowed to block or fail the action
// it's recording, so errors are swallowed (logged to the console only).
export async function logAudit(params: {
  agencyId: string;
  eventId?: string | null;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityLabel?: string | null;
  detail?: string | null;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('audit_log').insert({
    agency_id: params.agencyId,
    event_id: params.eventId ?? null,
    actor_id: params.actorId,
    actor_name: params.actorName,
    action: params.action,
    entity_type: params.entityType,
    entity_label: params.entityLabel ?? null,
    detail: params.detail ?? null,
  });
  if (error) console.error('audit log failed:', error.message);
}

export async function listAuditLog(agencyId: string, eventId?: string): Promise<AuditEntry[]> {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  let query = supabase.from('audit_log').select('*').eq('agency_id', agencyId);
  if (eventId) query = query.eq('event_id', eventId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditEntry[];
}

import { supabase } from '../lib/supabaseClient';

export interface EventTask {
  id: string;
  agency_id: string;
  event_id: string;
  title: string;
  assignee: string | null;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

export async function listTasks(eventId: string): Promise<EventTask[]> {
  const { data, error } = await client()
    .from('event_tasks')
    .select('*')
    .eq('event_id', eventId)
    .order('done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as EventTask[];
}

export interface TaskInput {
  title: string;
  assignee: string | null;
  due_date: string | null;
}

export async function createTask(agencyId: string, eventId: string, input: TaskInput): Promise<EventTask> {
  const { data, error } = await client()
    .from('event_tasks')
    .insert({ ...input, agency_id: agencyId, event_id: eventId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as EventTask;
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  const { error } = await client().from('event_tasks').update({ done }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await client().from('event_tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

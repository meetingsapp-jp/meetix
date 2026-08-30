-- Free-form running notes per event, shared by the team (director/planner/coordinator).
create table if not exists event_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid references app_users(id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table event_notes enable row level security;

create policy sel_agency on event_notes for select
  using (agency_id = current_agency_id());
create policy ins_member on event_notes for insert
  with check (agency_id = current_agency_id());
create policy del_member on event_notes for delete
  using (agency_id = current_agency_id());

create index if not exists event_notes_event_id_idx on event_notes(event_id);

-- Internal team chat per event (director/planner/coordinator), replacing ad-hoc WhatsApp groups.
create table if not exists event_messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid references app_users(id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table event_messages enable row level security;

create policy sel_agency on event_messages for select
  using (agency_id = current_agency_id());
create policy ins_member on event_messages for insert
  with check (agency_id = current_agency_id());

create index if not exists event_messages_event_id_idx on event_messages(event_id);

-- Realtime for the chat table.
alter publication supabase_realtime add table event_messages;

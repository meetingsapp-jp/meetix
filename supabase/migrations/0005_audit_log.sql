create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  actor_id uuid references app_users(id) on delete set null,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_label text,
  detail text,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

create policy sel_agency on audit_log for select
  using (agency_id = current_agency_id());
create policy ins_member on audit_log for insert
  with check (agency_id = current_agency_id());

create index if not exists audit_log_event_id_idx on audit_log(event_id);
create index if not exists audit_log_agency_id_idx on audit_log(agency_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);

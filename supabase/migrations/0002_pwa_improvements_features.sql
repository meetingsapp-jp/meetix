-- PWA improvements: hotel pickup time, local transfers, coordinator event assignment.

-- Hotel pickup time for departures (shown alongside the flight's own departure time).
alter table flights add column if not exists pickup_time timestamptz;
comment on column flights.pickup_time is 'Scheduled hotel pickup/departure time (mainly for departure flights).';

-- Local (non-flying) transfers: passengers who travel by ground only, plus
-- an optional origin/destination address (linked to Google Maps in the UI).
alter table passengers add column if not exists is_local_transfer boolean not null default false;
alter table passengers add column if not exists origin_address text;
alter table passengers add column if not exists destination_address text;

-- Coordinators are assigned to specific events; when a coordinator has no
-- rows here for an event they should not see it.
create table if not exists event_coordinators (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  app_user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, app_user_id)
);

alter table event_coordinators enable row level security;

create policy sel_agency on event_coordinators for select
  using (agency_id = current_agency_id());

create policy ins_mgr on event_coordinators for insert
  with check (agency_id = current_agency_id() and is_manager());

create policy del_mgr on event_coordinators for delete
  using (agency_id = current_agency_id() and is_manager());

create index if not exists event_coordinators_event_id_idx on event_coordinators(event_id);
create index if not exists event_coordinators_app_user_id_idx on event_coordinators(app_user_id);

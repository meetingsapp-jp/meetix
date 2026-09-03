-- Generalizes QR check-in beyond "arrived from the airport" (arrival_checkins,
-- unchanged — it still drives the VIP-arrival push). This is a log of every
-- other checkpoint a passenger's QR can be scanned at: hotel arrival, and
-- general event presence. Multiple rows per passenger/checkpoint are
-- expected (a log, not a single boolean) — the app shows the most recent.
create table if not exists checkin_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  passenger_id uuid not null references passengers(id) on delete cascade,
  checkpoint text not null check (checkpoint in ('hotel', 'evento')),
  created_at timestamptz not null default now()
);

create index if not exists checkin_events_event_idx on checkin_events(event_id);
create index if not exists checkin_events_passenger_idx on checkin_events(passenger_id);

alter table checkin_events enable row level security;

-- Same coordinator-scoping shape as events/passengers/flights (migration
-- 0013): a guía coordinador only sees/writes checkpoints for events they're
-- assigned to; every other role is agency-wide.
create policy sel_agency on checkin_events for select
  using (
    agency_id = current_agency_id()
    and (
      current_user_role() <> 'guia_coordinador'
      or exists (
        select 1 from event_coordinators ec
        where ec.event_id = checkin_events.event_id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

create policy ins_agency on checkin_events for insert
  with check (
    agency_id = current_agency_id()
    and (
      current_user_role() <> 'guia_coordinador'
      or exists (
        select 1 from event_coordinators ec
        where ec.event_id = checkin_events.event_id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

-- Coordinators marking session (agenda item) attendance via QR needs the
-- same event-scoped write access on session_attendance that insert/delete
-- only granted to is_manager() until now.
drop policy if exists ins_mgr on session_attendance;
create policy ins_mgr on session_attendance for insert
  with check (
    agency_id = current_agency_id()
    and (
      is_manager()
      or exists (
        select 1 from sessions s
        join event_coordinators ec on ec.event_id = s.event_id
        where s.id = session_attendance.session_id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

drop policy if exists del_mgr on session_attendance;
create policy del_mgr on session_attendance for delete
  using (
    agency_id = current_agency_id()
    and (
      is_manager()
      or exists (
        select 1 from sessions s
        join event_coordinators ec on ec.event_id = s.event_id
        where s.id = session_attendance.session_id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

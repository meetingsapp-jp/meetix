-- Documentation catch-up: this repo's 0001_init.sql still shows the
-- TEMPORARY "dev_all_access" policy (full read/write for any anon or
-- authenticated caller) on the 10 core tables. That policy was already
-- replaced live, directly on the Supabase project, with proper
-- agency-scoped policies — but no migration file ever recorded that change,
-- so the migration history didn't match the live schema. This migration
-- makes the two match: drop the temporary policy (if it's somehow still
-- there) and (re)create the real scoped policies, so running the
-- migrations from scratch reproduces what's actually running in
-- production.

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'agencies','app_users','clients','events','hotels','transport_providers',
    'passengers','flights','sessions','session_attendance'
  ]
  loop
    execute format('drop policy if exists dev_all_access on %I;', tbl);
  end loop;
end $$;

-- agencies
drop policy if exists admin_read_all on agencies;
create policy admin_read_all on agencies for select
  using (is_platform_admin());
drop policy if exists sel_own on agencies;
create policy sel_own on agencies for select
  using (id = current_agency_id());
drop policy if exists upd_own_agency on agencies;
create policy upd_own_agency on agencies for update
  using (id = current_agency_id() and current_user_role() in ('director_general', 'director_eventos'))
  with check (id = current_agency_id() and current_user_role() in ('director_general', 'director_eventos'));

-- app_users
drop policy if exists admin_read_all on app_users;
create policy admin_read_all on app_users for select
  using (is_platform_admin());
drop policy if exists sel_member on app_users;
create policy sel_member on app_users for select
  using (agency_id = current_agency_id());

-- clients
drop policy if exists sel_agency on clients;
create policy sel_agency on clients for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on clients;
create policy ins_mgr on clients for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_mgr on clients;
create policy upd_mgr on clients for update
  using (agency_id = current_agency_id() and is_manager())
  with check (agency_id = current_agency_id() and is_manager());
drop policy if exists del_mgr on clients;
create policy del_mgr on clients for delete using (agency_id = current_agency_id() and is_manager());

-- events
drop policy if exists sel_agency on events;
create policy sel_agency on events for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on events;
create policy ins_mgr on events for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_mgr on events;
create policy upd_mgr on events for update
  using (agency_id = current_agency_id() and is_manager())
  with check (agency_id = current_agency_id() and is_manager());
drop policy if exists del_mgr on events;
create policy del_mgr on events for delete using (agency_id = current_agency_id() and is_manager());

-- hotels
drop policy if exists sel_agency on hotels;
create policy sel_agency on hotels for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on hotels;
create policy ins_mgr on hotels for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_mgr on hotels;
create policy upd_mgr on hotels for update
  using (agency_id = current_agency_id() and is_manager())
  with check (agency_id = current_agency_id() and is_manager());
drop policy if exists del_mgr on hotels;
create policy del_mgr on hotels for delete using (agency_id = current_agency_id() and is_manager());

-- transport_providers
drop policy if exists sel_agency on transport_providers;
create policy sel_agency on transport_providers for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on transport_providers;
create policy ins_mgr on transport_providers for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_mgr on transport_providers;
create policy upd_mgr on transport_providers for update
  using (agency_id = current_agency_id() and is_manager())
  with check (agency_id = current_agency_id() and is_manager());
drop policy if exists del_mgr on transport_providers;
create policy del_mgr on transport_providers for delete using (agency_id = current_agency_id() and is_manager());

-- passengers
drop policy if exists sel_agency on passengers;
create policy sel_agency on passengers for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on passengers;
create policy ins_mgr on passengers for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_member on passengers;
create policy upd_member on passengers for update
  using (agency_id = current_agency_id())
  with check (agency_id = current_agency_id());
drop policy if exists del_mgr on passengers;
create policy del_mgr on passengers for delete using (agency_id = current_agency_id() and is_manager());

-- flights
drop policy if exists sel_agency on flights;
create policy sel_agency on flights for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on flights;
create policy ins_mgr on flights for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_member on flights;
create policy upd_member on flights for update
  using (agency_id = current_agency_id())
  with check (agency_id = current_agency_id());
drop policy if exists del_mgr on flights;
create policy del_mgr on flights for delete using (agency_id = current_agency_id() and is_manager());

-- sessions
drop policy if exists sel_agency on sessions;
create policy sel_agency on sessions for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on sessions;
create policy ins_mgr on sessions for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_mgr on sessions;
create policy upd_mgr on sessions for update
  using (agency_id = current_agency_id() and is_manager())
  with check (agency_id = current_agency_id() and is_manager());
drop policy if exists del_mgr on sessions;
create policy del_mgr on sessions for delete using (agency_id = current_agency_id() and is_manager());

-- session_attendance
drop policy if exists sel_agency on session_attendance;
create policy sel_agency on session_attendance for select using (agency_id = current_agency_id());
drop policy if exists ins_mgr on session_attendance;
create policy ins_mgr on session_attendance for insert with check (agency_id = current_agency_id() and is_manager());
drop policy if exists upd_mgr on session_attendance;
create policy upd_mgr on session_attendance for update
  using (agency_id = current_agency_id() and is_manager())
  with check (agency_id = current_agency_id() and is_manager());
drop policy if exists del_mgr on session_attendance;
create policy del_mgr on session_attendance for delete using (agency_id = current_agency_id() and is_manager());

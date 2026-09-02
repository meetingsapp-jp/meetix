-- Bug 1: app_users had SELECT-only RLS policies. Editing a teammate's name,
-- email, or role from the Team page silently affected 0 rows (no error, no
-- change) because no UPDATE policy matched. Add one, scoped to directors
-- acting within their own agency.
create policy upd_director on app_users for update
  using (agency_id = current_agency_id() and current_user_role() in ('director_general', 'director_eventos'))
  with check (agency_id = current_agency_id() and current_user_role() in ('director_general', 'director_eventos'));

-- Bug 2: a guía coordinador could see (and access transport/passenger data
-- for) every event in the agency, not just the ones a director assigned
-- them to via event_coordinators — the "coordinator only sees assigned
-- events" restriction only existed as a client-side filter on one page
-- (Coordinador), not enforced at the data layer, so Eventos/Transporte/
-- Pasajeros still leaked every event. Tighten SELECT on events, passengers
-- and flights so a guía coordinador only sees rows for events they're
-- actually assigned to; every other role is unaffected.
drop policy if exists sel_agency on events;
create policy sel_agency on events for select
  using (
    agency_id = current_agency_id()
    and (
      current_user_role() <> 'guia_coordinador'
      or exists (
        select 1 from event_coordinators ec
        where ec.event_id = events.id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

drop policy if exists sel_agency on passengers;
create policy sel_agency on passengers for select
  using (
    agency_id = current_agency_id()
    and (
      current_user_role() <> 'guia_coordinador'
      or exists (
        select 1 from event_coordinators ec
        where ec.event_id = passengers.event_id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

drop policy if exists sel_agency on flights;
create policy sel_agency on flights for select
  using (
    agency_id = current_agency_id()
    and (
      current_user_role() <> 'guia_coordinador'
      or exists (
        select 1 from passengers p
        join event_coordinators ec on ec.event_id = p.event_id
        where p.id = flights.passenger_id
          and ec.app_user_id = (select id from app_users where auth_user_id = auth.uid())
      )
    )
  );

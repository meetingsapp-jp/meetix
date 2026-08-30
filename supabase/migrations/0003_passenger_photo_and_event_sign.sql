-- Passenger (person) photo, for identifying them on arrival.
alter table people add column if not exists photo_url text;

-- Per-event welcome/pickup sign, uploaded by staff and shown to the coordinator.
alter table events add column if not exists welcome_sign_url text;

-- Storage buckets, mirroring the existing "logos" bucket pattern.
insert into storage.buckets (id, name, public)
values ('passenger-photos', 'passenger-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('event-signs', 'event-signs', true)
on conflict (id) do nothing;

create policy passenger_photos_read on storage.objects for select
  using (bucket_id = 'passenger-photos');

create policy passenger_photos_write on storage.objects for insert
  with check (
    bucket_id = 'passenger-photos'
    and (storage.foldername(name))[1] = (current_agency_id())::text
    and current_user_role() = any (array['director_general'::user_role, 'director_eventos'::user_role, 'planificador'::user_role])
  );

create policy passenger_photos_update on storage.objects for update
  using (
    bucket_id = 'passenger-photos'
    and (storage.foldername(name))[1] = (current_agency_id())::text
    and current_user_role() = any (array['director_general'::user_role, 'director_eventos'::user_role, 'planificador'::user_role])
  );

create policy event_signs_read on storage.objects for select
  using (bucket_id = 'event-signs');

create policy event_signs_write on storage.objects for insert
  with check (
    bucket_id = 'event-signs'
    and (storage.foldername(name))[1] = (current_agency_id())::text
    and current_user_role() = any (array['director_general'::user_role, 'director_eventos'::user_role, 'planificador'::user_role])
  );

create policy event_signs_update on storage.objects for update
  using (
    bucket_id = 'event-signs'
    and (storage.foldername(name))[1] = (current_agency_id())::text
    and current_user_role() = any (array['director_general'::user_role, 'director_eventos'::user_role, 'planificador'::user_role])
  );

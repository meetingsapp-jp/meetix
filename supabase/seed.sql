-- OPTIONAL seed — creates the single agency (tenant) and one demo user per role
-- so the app has an agency to attach data to before real auth exists.
-- This is NOT run automatically. Apply it only if you explicitly choose to.
-- It inserts minimal foundational rows, NOT fake business data (no events/passengers).

insert into agencies (name, default_language)
values ('Mi Agencia de Eventos', 'es');

insert into app_users (agency_id, full_name, role, preferred_language)
select id, 'Director General', 'director_general', 'es' from agencies limit 1;
insert into app_users (agency_id, full_name, role, preferred_language)
select id, 'Director de Eventos', 'director_eventos', 'es' from agencies limit 1;
insert into app_users (agency_id, full_name, role, preferred_language)
select id, 'Planificador', 'planificador', 'es' from agencies limit 1;
insert into app_users (agency_id, full_name, role, preferred_language)
select id, 'Guía / Coordinador', 'guia_coordinador', 'es' from agencies limit 1;

-- Trigger: notify the team when a new chat message is posted in an event.
create or replace function notify_new_chat_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_event_name text;
  v_snippet text;
begin
  select e.name into v_event_name from events e where e.id = new.event_id;
  v_snippet := left(new.body, 120);
  perform net.http_post(
    url := 'https://rkrtoozowhahymrzpfkn.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type','application/json','x-trigger-secret','011bd45038aa3aa7407c545add79d4bdefa61338768aed3b52e29590149efb3c'),
    body := jsonb_build_object(
      'agency_id', new.agency_id,
      'title', coalesce(new.author_name, 'Chat') || case when v_event_name is not null then ' — ' || v_event_name else '' end,
      'body', v_snippet,
      'url', '/coordinador'
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_chat_message on event_messages;
create trigger trg_notify_new_chat_message
after insert on event_messages
for each row execute function notify_new_chat_message();

-- Scheduled reminder: passengers with a departure flight/pickup coming up
-- soon that still has unchecked departure-checklist items. Deduped so the
-- same passenger doesn't trigger a push more than once.
create table if not exists push_notified_departures (
  passenger_id uuid primary key references passengers(id) on delete cascade,
  notified_at timestamptz not null default now()
);

-- Internal bookkeeping only, written by the security-definer function above;
-- no app-facing policies needed.
alter table push_notified_departures enable row level security;

create or replace function notify_pending_departure_checklists() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select p.agency_id, count(*) as pending_count
    from passengers p
    join flights f on f.passenger_id = p.id and f.direction = 'departure'
    where f.flight_datetime is not null
      and f.flight_datetime between now() and now() + interval '3 hours'
      and jsonb_array_length(p.departure_checklist) > 0
      and exists (
        select 1 from jsonb_array_elements(p.departure_checklist) item
        where (item->>'done')::boolean is not true
      )
      and not exists (select 1 from push_notified_departures d where d.passenger_id = p.id)
    group by p.agency_id
  loop
    perform net.http_post(
      url := 'https://rkrtoozowhahymrzpfkn.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-trigger-secret','011bd45038aa3aa7407c545add79d4bdefa61338768aed3b52e29590149efb3c'),
      body := jsonb_build_object(
        'agency_id', r.agency_id,
        'title', 'Checklist de despacho pendiente',
        'body', r.pending_count || ' pasajero(s) salen pronto con el checklist sin completar',
        'url', '/coordinador'
      )
    );
  end loop;

  insert into push_notified_departures (passenger_id)
  select p.id
  from passengers p
  join flights f on f.passenger_id = p.id and f.direction = 'departure'
  where f.flight_datetime is not null
    and f.flight_datetime between now() and now() + interval '3 hours'
    and jsonb_array_length(p.departure_checklist) > 0
    and exists (
      select 1 from jsonb_array_elements(p.departure_checklist) item
      where (item->>'done')::boolean is not true
    )
    and not exists (select 1 from push_notified_departures d where d.passenger_id = p.id)
  on conflict (passenger_id) do nothing;
end;
$$;

create extension if not exists pg_cron;

-- cron.schedule() re-uses the existing job when the name already matches,
-- so this migration is safe to re-run.
select cron.schedule(
  'notify-pending-departure-checklists',
  '*/30 * * * *',
  $$select notify_pending_departure_checklists();$$
);

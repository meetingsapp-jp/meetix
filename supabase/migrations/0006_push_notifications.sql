create extension if not exists pg_net;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  app_user_id uuid not null references app_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy sel_own on push_subscriptions for select
  using (agency_id = current_agency_id() and app_user_id = (select id from app_users where auth_user_id = auth.uid()));

create policy ins_own on push_subscriptions for insert
  with check (agency_id = current_agency_id() and app_user_id = (select id from app_users where auth_user_id = auth.uid()));

create policy upd_own on push_subscriptions for update
  using (agency_id = current_agency_id() and app_user_id = (select id from app_users where auth_user_id = auth.uid()))
  with check (agency_id = current_agency_id() and app_user_id = (select id from app_users where auth_user_id = auth.uid()));

create policy del_own on push_subscriptions for delete
  using (agency_id = current_agency_id() and app_user_id = (select id from app_users where auth_user_id = auth.uid()));

create index if not exists push_subscriptions_agency_id_idx on push_subscriptions(agency_id);

-- Trigger: notify on VIP arrival. The trigger secret below is not a
-- credential to a third party — it just lets the send-push edge function
-- (verify_jwt disabled, since this call has no end-user session) trust that
-- the request came from this project's own database, not the open internet.
create or replace function notify_vip_arrival() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_is_vip boolean;
  v_agency_id uuid;
  v_event_id uuid;
  v_event_name text;
begin
  select p.full_name, p.is_vip, p.agency_id, p.event_id
    into v_full_name, v_is_vip, v_agency_id, v_event_id
  from passengers p where p.id = new.passenger_id;

  if v_is_vip then
    select e.name into v_event_name from events e where e.id = v_event_id;
    perform net.http_post(
      url := 'https://rkrtoozowhahymrzpfkn.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-trigger-secret','011bd45038aa3aa7407c545add79d4bdefa61338768aed3b52e29590149efb3c'),
      body := jsonb_build_object(
        'agency_id', v_agency_id,
        'title', 'Llegada VIP',
        'body', v_full_name || case when v_event_name is not null then ' — ' || v_event_name else '' end,
        'url', '/coordinador'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_vip_arrival on arrival_checkins;
create trigger trg_notify_vip_arrival
after insert on arrival_checkins
for each row execute function notify_vip_arrival();

-- Trigger: notify on urgent incident.
create or replace function notify_urgent_incident() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_event_name text;
begin
  if new.severity = 'urgent' then
    select e.name into v_event_name from events e where e.id = new.event_id;
    perform net.http_post(
      url := 'https://rkrtoozowhahymrzpfkn.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-trigger-secret','011bd45038aa3aa7407c545add79d4bdefa61338768aed3b52e29590149efb3c'),
      body := jsonb_build_object(
        'agency_id', new.agency_id,
        'title', 'Incidencia urgente',
        'body', new.title || case when v_event_name is not null then ' — ' || v_event_name else '' end,
        'url', '/coordinador'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_urgent_incident on incidents;
create trigger trg_notify_urgent_incident
after insert on incidents
for each row execute function notify_urgent_incident();

-- 0007 dropped the vestigial passengers.full_name column, which broke this
-- trigger (it read full_name directly off passengers instead of the joined
-- people row, like every other part of the app already does).
create or replace function notify_vip_arrival() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_is_vip boolean;
  v_agency_id uuid;
  v_event_id uuid;
  v_event_name text;
begin
  select pe.full_name, p.is_vip, p.agency_id, p.event_id
    into v_full_name, v_is_vip, v_agency_id, v_event_id
  from passengers p
  join people pe on pe.id = p.person_id
  where p.id = new.passenger_id;

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

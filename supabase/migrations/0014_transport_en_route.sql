-- Lets a driver (who has no app account) tap a no-login link to signal "ya
-- salí" for a specific transport provider, without exposing any passenger
-- data. access_token is the unguessable key embedded in that public link;
-- en_route_at is overwritten each time they tap it (simple aviso, not a
-- history of trips).
alter table transport_providers add column if not exists access_token uuid not null default gen_random_uuid();
alter table transport_providers add column if not exists en_route_at timestamptz;

create unique index if not exists transport_providers_access_token_idx on transport_providers(access_token);

create or replace function notify_transport_en_route() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.en_route_at is not null and (old.en_route_at is null or new.en_route_at <> old.en_route_at) then
    perform net.http_post(
      url := 'https://rkrtoozowhahymrzpfkn.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-trigger-secret','011bd45038aa3aa7407c545add79d4bdefa61338768aed3b52e29590149efb3c'),
      body := jsonb_build_object(
        'agency_id', new.agency_id,
        'title', 'Transporte en camino',
        'body', new.name || ' avisó que ya salió',
        'url', '/transporte'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_transport_en_route on transport_providers;
create trigger trg_notify_transport_en_route
after update on transport_providers
for each row execute function notify_transport_en_route();

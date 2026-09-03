-- Lets an agency share a no-login link per event with their own client, so
-- the client can plan the agenda template collaboratively (per Jimena's
-- demo feedback: "posibilidad de hacer una app para Cliente"). The client
-- never gets an app_users account — access is entirely scoped by this
-- unguessable token, enforced server-side by the client-portal edge
-- function (service role), never through normal RLS.
alter table events add column if not exists client_access_token uuid not null default gen_random_uuid();

create unique index if not exists events_client_access_token_idx on events(client_access_token);

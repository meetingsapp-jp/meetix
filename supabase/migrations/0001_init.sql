-- EventOps — initial schema (v2)
-- Multi-tenant (single agency for now), roles, events, passengers, hotels,
-- ground transport providers, flights, and meeting sessions/attendance.
--
-- RLS = Option A: Row Level Security is ENABLED on every table from day one.
-- Because real Supabase Auth is not wired yet, TEMPORARY development policies
-- below grant access to the anon/authenticated roles so the app can function.
-- >>> These dev policies MUST be replaced with agency-scoped policies (keyed to
-- >>> auth.uid() -> app_users.agency_id) the moment authentication is added. <<<

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('director_general', 'director_eventos', 'planificador', 'guia_coordinador');
create type event_status as enum ('planificacion', 'confirmado', 'en_curso', 'finalizado', 'cancelado');
create type transport_type as enum ('vip', 'group');
create type flight_direction as enum ('arrival', 'departure');
create type language as enum ('es', 'en', 'pt');

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_language language not null default 'es',
  created_at timestamptz not null default now()
);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  auth_user_id uuid,                 -- null until real auth is wired
  full_name text not null,
  role user_role not null,
  preferred_language language not null default 'es',
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  name text not null,
  country text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  start_date date,
  end_date date,
  destinations text[] not null default '{}',
  status event_status not null default 'planificacion',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table hotels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  address text,
  check_in date,
  check_out date,
  created_at timestamptz not null default now()
);

create table transport_providers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table passengers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  document_id text,                  -- passport / national ID
  nationality text,
  is_vip boolean not null default false,
  transport_type transport_type not null default 'group',
  transport_provider_id uuid references transport_providers(id) on delete set null,
  hotel_id uuid references hotels(id) on delete set null,
  room_number text,
  emergency_contact text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table flights (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  passenger_id uuid not null references passengers(id) on delete cascade,
  direction flight_direction not null,
  airline text,
  flight_number text,
  flight_datetime timestamptz,
  origin_airport text,
  destination_airport text,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  starts_at timestamptz,
  location text,
  created_at timestamptz not null default now()
);

create table session_attendance (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  passenger_id uuid not null references passengers(id) on delete cascade,
  attending boolean not null default true,
  created_at timestamptz not null default now(),
  unique (session_id, passenger_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_events_updated before update on events
  for each row execute function set_updated_at();
create trigger trg_passengers_updated before update on passengers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_app_users_agency on app_users(agency_id);
create index idx_clients_agency on clients(agency_id);
create index idx_events_agency on events(agency_id);
create index idx_events_client on events(client_id);
create index idx_hotels_event on hotels(event_id);
create index idx_transport_providers_event on transport_providers(event_id);
create index idx_passengers_event on passengers(event_id);
create index idx_passengers_agency on passengers(agency_id);
create index idx_passengers_is_vip on passengers(is_vip);
create index idx_passengers_transport_type on passengers(transport_type);
create index idx_flights_passenger on flights(passenger_id);
create index idx_sessions_event on sessions(event_id);
create index idx_session_attendance_session on session_attendance(session_id);
create index idx_session_attendance_passenger on session_attendance(passenger_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled everywhere (Option A)
-- ---------------------------------------------------------------------------
alter table agencies             enable row level security;
alter table app_users            enable row level security;
alter table clients              enable row level security;
alter table events               enable row level security;
alter table hotels               enable row level security;
alter table transport_providers  enable row level security;
alter table passengers           enable row level security;
alter table flights              enable row level security;
alter table sessions             enable row level security;
alter table session_attendance   enable row level security;

-- TEMPORARY development policies (pre-auth). Replace with agency-scoped
-- policies once authentication is in place. Grants full access to anon +
-- authenticated so the app can be built and tested without login.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'agencies','app_users','clients','events','hotels','transport_providers',
    'passengers','flights','sessions','session_attendance'
  ]
  loop
    execute format(
      'create policy dev_all_access on %I for all to anon, authenticated using (true) with check (true);',
      tbl
    );
  end loop;
end $$;

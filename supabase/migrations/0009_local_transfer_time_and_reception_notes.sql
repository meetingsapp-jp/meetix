-- Local (ground-only) transfers didn't have a scheduled time at all.
alter table passengers add column if not exists local_transfer_time timestamptz;

-- Free-form notes on how the passenger is actually received/dispatched
-- (met at the airport with a sign, picked up by a guide at the hotel, has to
-- check in themselves, etc.) — distinct from the transport provider itself.
alter table passengers add column if not exists reception_notes text;
alter table passengers add column if not exists dispatch_notes text;

-- Lightweight per-passenger departure checklist (gifts handed over, etc.).
-- Kept as jsonb on the row rather than a separate table since it's scoped
-- to a single passenger and never queried independently.
alter table passengers add column if not exists departure_checklist jsonb not null default '[]'::jsonb;

-- Vestige of the pre-refactor schema, before passengers/people were split
-- into participation + stable person. The app has never read or written it
-- (full_name always comes from the joined person), but it was still NOT NULL
-- with no default, so a new passenger's insert failed the constraint.
alter table passengers drop column if exists full_name;

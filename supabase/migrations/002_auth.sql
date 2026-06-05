-- ============================================================
-- Filmoteka — auth migration
-- Run in two steps (see comments below)
-- ============================================================

-- ── STEP 1: Run this immediately ────────────────────────────
-- Auto-set user_id on insert so existing code doesn't need changing

create or replace function set_user_id()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger movies_set_user_id
  before insert on movies
  for each row execute function set_user_id();

create trigger locations_set_user_id
  before insert on locations
  for each row execute function set_user_id();


-- ── STEP 2: Run AFTER logging in and verifying data is claimed ──
-- Tighten RLS from "allow all" to "user owns row"
-- Only run once you've confirmed your movies show user_id = your UUID

-- drop policy "mvp_allow_all" on movies;
-- drop policy "mvp_allow_all" on locations;

-- create policy "user_movies" on movies for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);

-- create policy "user_locations" on locations for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);

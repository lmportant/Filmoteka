-- ============================================================
-- Filmoteka — initial schema
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── movies ──────────────────────────────────────────────────
create table movies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid,            -- nullable for MVP; FK to auth.users added when auth is wired up
  title               text not null,   -- user's title as imported or entered
  location_code       text not null,   -- e.g. 'S01', 'SZ045', 'REGAL'
  status              text not null default 'przegrane'
                        check (status in ('przegrane', 'do_przegrania')),
  has_metadata        boolean not null default false,

  -- TMDB fields (populated after enrichment)
  tmdb_id             integer,
  tmdb_title_pl       text,
  tmdb_title_en       text,
  tmdb_title_original text,
  tmdb_year           integer,
  tmdb_genres         text[],
  tmdb_overview_pl    text,
  tmdb_overview_en    text,
  tmdb_poster_path    text,            -- relative; full URL: https://image.tmdb.org/t/p/w500{path}
  tmdb_cast           jsonb,           -- [{name, character, profile_path}]
  tmdb_director       text,
  tmdb_rating         numeric(3,1),
  tmdb_language       text,            -- original language code e.g. 'pl', 'en', 'it'
  tmdb_fetched_at     timestamptz,

  -- Manual metadata (for movies not found in TMDB)
  manual_title_pl     text,
  manual_title_en     text,
  manual_year         integer,
  manual_genres       text[],
  manual_overview     text,
  manual_cast         text,
  manual_director     text,

  custom_notes        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── locations ───────────────────────────────────────────────
create table locations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  code         text not null unique,   -- e.g. 'S01', 'REGAL', 'SZ045'
  type         text not null
                 check (type in ('binder', 'szafka_slupek', 'regal', 'szafka', 'regal_bluray', 'other')),
  display_name text,                   -- optional human-readable label
  created_at   timestamptz not null default now()
);

-- ── indexes ─────────────────────────────────────────────────
create index idx_movies_location_code on movies (location_code);
create index idx_movies_status        on movies (status);
create index idx_movies_has_metadata  on movies (has_metadata);
create index idx_movies_tmdb_id       on movies (tmdb_id);
create index idx_movies_tmdb_year     on movies (tmdb_year);

-- Full-text search across all title fields (Polish simple tokenizer works for both PL and EN)
create index idx_movies_search on movies using gin (
  to_tsvector('simple',
    coalesce(title, '')               || ' ' ||
    coalesce(tmdb_title_pl, '')       || ' ' ||
    coalesce(tmdb_title_en, '')       || ' ' ||
    coalesce(tmdb_title_original, '') || ' ' ||
    coalesce(manual_title_pl, '')     || ' ' ||
    coalesce(manual_title_en, '')
  )
);

-- ── updated_at trigger ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger movies_updated_at
  before update on movies
  for each row execute function update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
-- Permissive for MVP (single user, no auth yet).
-- When auth is added: replace USING (true) with USING (auth.uid() = user_id)
alter table movies    enable row level security;
alter table locations enable row level security;

create policy "mvp_allow_all" on movies    for all using (true) with check (true);
create policy "mvp_allow_all" on locations for all using (true) with check (true);

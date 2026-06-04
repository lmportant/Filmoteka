# Filmoteka

Personal physical DVD/Blu-ray collection manager. Mobile-first PWA.

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | SvelteKit (plain JS, no TypeScript) |
| Styling | Tailwind CSS v4 |
| DB / Auth / Functions | Supabase (free tier) |
| Hosting | Vercel (free tier, auto-deploy from GitHub) |
| Movie metadata | TMDB API (free, `language=pl-PL`) |
| XLSX import/export | SheetJS (`xlsx` npm package) |
| Future App Store | Capacitor |

## Dev Commands

```bash
npm run dev          # start dev server at localhost:5173
npm run build        # production build
npm run preview      # preview production build locally
```

## Environment Variables

Stored in `.env` (gitignored). See `.env.example` for template.

- `PUBLIC_SUPABASE_URL` — Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key (safe for browser)

TMDB API key is stored as a Supabase Edge Function secret (`TMDB_API_KEY`), never in client code.

## Supabase Project

URL: `https://mxvvelvlxifzipylvftl.supabase.co`

## Database Schema

### `movies`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto-generated |
| user_id | uuid FK | references auth.users |
| title | text | user's title as imported/entered |
| location_code | text | e.g. 'S01', 'SZ045', 'REGAL' |
| status | text | 'przegrane' \| 'do_przegrania' |
| has_metadata | boolean | false = no TMDB match yet |
| tmdb_id | integer | nullable |
| tmdb_title_pl | text | Polish title from TMDB |
| tmdb_title_en | text | English title |
| tmdb_title_original | text | original language title |
| tmdb_year | integer | |
| tmdb_genres | text[] | |
| tmdb_overview_pl | text | Polish plot summary |
| tmdb_overview_en | text | English fallback |
| tmdb_poster_path | text | relative path → `https://image.tmdb.org/t/p/w500{path}` |
| tmdb_cast | jsonb | `[{name, character, profile_path}]` |
| tmdb_director | text | |
| tmdb_rating | numeric(3,1) | |
| tmdb_language | text | original language code |
| tmdb_fetched_at | timestamptz | |
| manual_title_pl | text | for non-TMDB movies |
| manual_title_en | text | |
| manual_year | integer | |
| manual_genres | text[] | |
| manual_overview | text | |
| manual_cast | text | free-text |
| manual_director | text | |
| custom_notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `locations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| code | text UNIQUE | e.g. 'S01', 'REGAL' |
| type | text | see types below |
| display_name | text | optional label override |
| created_at | timestamptz | |

## Location Types

| Code pattern | Type value | Description |
|---|---|---|
| S01–S060 | `binder` | Physical DVD binders (~70 discs each) |
| SZ001–SZ600 | `szafka_slupek` | Szafka Słupek — individual sticker IDs |
| REGAL | `regal` | Open shelf |
| SZAFW, SZAFN | `szafka` | Wardrobes |
| ROB | `regal_bluray` | Regał Oryginał Blue-Ray |
| BOX | `other` | Box |

## Import File

Source: `FILMOTEKA DO 62.xlsx`, sheet `FILMOTEKA`
- Column A: location code
- Column B: title (Polish)
- Cell background `#00B0F0` (Excel color int `15773696`) → `status = 'do_przegrania'`
- Everything else → `status = 'przegrane'`
- Normalize `C60` → `S60` on import
- Total: ~6,172 rows, ~921 "do_przegrania"

## TMDB Strategy

- Primary fetch: `language=pl-PL`
- Secondary fetch: `language=en-US` (for English title/overview fallback)
- Always store `original_title` from TMDB response
- API key in Supabase secret `TMDB_API_KEY` (never client-side)
- Rate limit: ~40 requests / 10 seconds on free tier
- Edge Function: `supabase/functions/fetch-tmdb/index.ts`

## Polish Terminology

| Polish | Meaning |
|---|---|
| Przegrane | Already digitized/ripped to digital |
| Do Przegrania | Still needs to be digitized |
| Szafka Słupek | Column cabinet (SZ sticker location) |
| Segregator | Binder (S01–S060 location type) |
| Regał | Open shelf |
| Szafka | Wardrobe/cabinet |

## Search

In-app search works across: `title`, `tmdb_title_pl`, `tmdb_title_en`, `tmdb_title_original`, `manual_title_pl`, `manual_title_en`

## Project Phases

- **Phase 0** — Project setup (current)
- **Phase 1** — Data import + XLSX export
- **Phase 2** — Core list view with search/filter
- **Phase 3** — Add new movie (TMDB search + manual)
- **Phase 4** — Movie detail & edit
- **Phase 5** — Batch TMDB enrichment
- **Phase 6** — Location management
- **Phase 7** — PWA & polish

## Key Files

```
src/lib/supabase.js          — Supabase client
src/lib/tmdb.js              — TMDB helpers (to create)
src/lib/import.js            — SheetJS import logic (to create)
src/lib/export.js            — SheetJS export logic (to create)
src/routes/+page.svelte      — Movie list (home)
src/routes/import/           — Import wizard (to create)
src/routes/movie/[id]/       — Movie detail/edit (to create)
src/routes/movie/new/        — Add movie (to create)
src/routes/locations/        — Location manager (to create)
supabase/migrations/         — DB schema SQL (to create)
supabase/functions/fetch-tmdb/ — Edge function (to create)
```

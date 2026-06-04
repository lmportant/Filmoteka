import { json } from '@sveltejs/kit';
import { TMDB_API_TOKEN } from '$env/static/private';

const HEADERS = { Authorization: `Bearer ${TMDB_API_TOKEN}` };

export async function GET({ params, url }) {
	const mediaType = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';

	const [plRes, enRes] = await Promise.all([
		fetch(
			`https://api.themoviedb.org/3/${mediaType}/${params.id}?language=pl-PL&append_to_response=credits`,
			{ headers: HEADERS }
		),
		fetch(`https://api.themoviedb.org/3/${mediaType}/${params.id}?language=en-US`, {
			headers: HEADERS
		})
	]);

	if (!plRes.ok) return json(null, { status: 404 });

	const pl = await plRes.json();
	const en = await enRes.json();

	const director =
		pl.credits?.crew?.find((c) => c.job === 'Director' || c.job === 'Series Director')?.name ??
		null;
	const cast = (pl.credits?.cast ?? []).slice(0, 10).map((a) => ({
		name: a.name,
		character: a.character,
		profile_path: a.profile_path ?? null
	}));

	return json({
		tmdb_id: pl.id,
		tmdb_title_pl: pl.title || pl.name || null,
		tmdb_title_en: en.title || en.name || null,
		tmdb_title_original: pl.original_title || pl.original_name || null,
		tmdb_year: parseInt((pl.release_date || pl.first_air_date || '').slice(0, 4)) || null,
		tmdb_genres: (pl.genres ?? []).map((g) => g.name),
		tmdb_overview_pl: pl.overview || null,
		tmdb_overview_en: en.overview || null,
		tmdb_poster_path: pl.poster_path ?? null,
		tmdb_cast: cast,
		tmdb_director: director,
		tmdb_rating: pl.vote_average ? Math.round(pl.vote_average * 10) / 10 : null,
		tmdb_language: pl.original_language ?? null
	});
}

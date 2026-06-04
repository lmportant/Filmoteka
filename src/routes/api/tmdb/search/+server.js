import { json } from '@sveltejs/kit';
import { TMDB_API_TOKEN } from '$env/static/private';

export async function GET({ url }) {
	const query = url.searchParams.get('q')?.trim();
	if (!query) return json([]);

	const params = new URLSearchParams({ query, language: 'pl-PL', include_adult: 'false', page: '1' });
	const res = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, {
		headers: { Authorization: `Bearer ${TMDB_API_TOKEN}` }
	});

	if (!res.ok) return json([]);

	const { results = [] } = await res.json();

	return json(
		results
			.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
			.slice(0, 8)
			.map((r) => ({
				tmdb_id: r.id,
				media_type: r.media_type,
				title_pl: r.title || r.name || '',
				title_original: r.original_title || r.original_name || '',
				year: (r.release_date || r.first_air_date || '').slice(0, 4),
				poster_path: r.poster_path || null,
				rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null
			}))
	);
}

import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase.js';

export async function GET() {
	const { data } = await supabase
		.from('movies')
		.select('tmdb_genres, manual_genres');

	const genres = new Set();
	for (const row of data ?? []) {
		for (const g of row.tmdb_genres ?? []) if (g) genres.add(g);
		for (const g of row.manual_genres ?? []) if (g) genres.add(g);
	}

	return json([...genres].sort((a, b) => a.localeCompare(b, 'pl')), {
		headers: { 'Cache-Control': 'max-age=300' }
	});
}

import * as XLSX from 'xlsx';

const HEADERS = [
	'Lokalizacja',
	'Tytuł',
	'Status',
	'Tytuł PL (TMDB)',
	'Tytuł EN',
	'Tytuł oryginalny',
	'Rok',
	'Gatunki',
	'Reżyser',
	'Ocena TMDB'
];

const BLUE_ARGB = 'FF00B0F0';

function movieToRow(m) {
	return [
		m.location_code,
		m.title,
		m.status === 'do_przegrania' ? 'Do Przegrania' : 'Przegrane',
		m.tmdb_title_pl || m.manual_title_pl || '',
		m.tmdb_title_en || m.manual_title_en || '',
		m.tmdb_title_original || '',
		m.tmdb_year || m.manual_year || '',
		[...(m.tmdb_genres ?? []), ...(m.manual_genres ?? [])].join(', '),
		m.tmdb_director || m.manual_director || '',
		m.tmdb_rating ?? ''
	];
}

// filter: 'all' | 'przegrane' | 'do_przegrania'
export function exportToXlsx(movies, filter = 'all') {
	const rows =
		filter === 'przegrane'
			? movies.filter((m) => m.status === 'przegrane')
			: filter === 'do_przegrania'
				? movies.filter((m) => m.status === 'do_przegrania')
				: movies;

	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.aoa_to_sheet([HEADERS]);

	rows.forEach((m, i) => {
		const rowData = movieToRow(m);
		rowData.forEach((val, c) => {
			const addr = XLSX.utils.encode_cell({ r: i + 1, c });
			ws[addr] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
			if (m.status === 'do_przegrania') {
				ws[addr].s = { fill: { patternType: 'solid', fgColor: { argb: BLUE_ARGB } } };
			}
		});
	});

	ws['!ref'] = XLSX.utils.encode_range({
		s: { r: 0, c: 0 },
		e: { r: rows.length, c: HEADERS.length - 1 }
	});

	XLSX.utils.book_append_sheet(wb, ws, 'FILMOTEKA');
	const date = new Date().toISOString().slice(0, 10);
	XLSX.writeFile(wb, `filmoteka_${date}.xlsx`);
}

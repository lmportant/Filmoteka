import * as XLSX from 'xlsx';

function normalizeCode(raw) {
	const code = String(raw || '').trim().toUpperCase();
	return code === 'C60' ? 'S60' : code;
}

function getLocationType(code) {
	if (/^S\d+$/.test(code)) return 'binder';
	if (/^SZ\d+$/.test(code)) return 'szafka_slupek';
	if (code === 'REGAL') return 'regal';
	if (code === 'SZAFW' || code === 'SZAFN') return 'szafka';
	if (code === 'ROB') return 'regal_bluray';
	return 'other';
}

function isBlueHighlight(cell) {
	if (!cell?.s) return false;
	const fg = cell.s.fill?.fgColor ?? cell.s.fgColor;
	if (!fg) return false;
	const rgb = (fg.rgb ?? '').toUpperCase();
	const argb = (fg.argb ?? '').toUpperCase();
	return rgb === '00B0F0' || argb === 'FF00B0F0';
}

export function parseXlsx(uint8array) {
	const wb = XLSX.read(uint8array, { type: 'array', cellStyles: true, cellNF: false });
	const ws = wb.Sheets['FILMOTEKA'] ?? wb.Sheets[wb.SheetNames[0]];
	const range = XLSX.utils.decode_range(ws['!ref']);

	const movies = [];
	const locationMap = new Map();

	// Row 0 is the "FILMOTEKA" title header — start at row 1
	for (let r = 1; r <= range.e.r; r++) {
		const cellA = ws[XLSX.utils.encode_cell({ r, c: 0 })];
		const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })];
		if (!cellA?.v || !cellB?.v) continue;

		const code = normalizeCode(cellA.v);
		const title = String(cellB.v).trim();
		if (!code || !title) continue;

		const status = isBlueHighlight(cellB) ? 'do_przegrania' : 'przegrane';
		if (!locationMap.has(code)) locationMap.set(code, getLocationType(code));
		movies.push({ title, location_code: code, status, has_metadata: false });
	}

	const locations = Array.from(locationMap, ([code, type]) => ({ code, type }));
	return { movies, locations };
}

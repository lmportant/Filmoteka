<script>
	import { supabase } from '$lib/supabase.js';
	import { posterUrl } from '$lib/tmdb.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import GenrePicker from '$lib/GenrePicker.svelte';

	let step = $state('search');

	let query = $state('');
	let results = $state([]);
	let searching = $state(false);
	let searchTimer;
	let selected = $state(null);

	let locations = $state([]);
	let locationCode = $state('');
	let newCode = $state('');
	let saving = $state(false);
	let error = $state('');

	let manual = $state({
		title: '',
		title_en: '',
		year: '',
		director: '',
		genres: /** @type {string[]} */ ([]),
		overview: '',
		location_code: ''
	});

	onMount(async () => {
		const { data } = await supabase
			.from('locations')
			.select('code, type, display_name')
			.order('type')
			.order('code');
		locations = data ?? [];
	});

	async function onSearchInput(e) {
		query = e.target.value;
		clearTimeout(searchTimer);
		if (!query.trim()) { results = []; return; }
		searchTimer = setTimeout(async () => {
			searching = true;
			const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
			results = res.ok ? await res.json() : [];
			searching = false;
		}, 400);
	}

	function selectResult(r) {
		selected = r;
		step = 'location';
	}

	function goManual() {
		manual.title = query;
		step = 'manual';
	}

	const groupedLocations = $derived.by(() => {
		const groups = { binder: [], szafka_slupek: [], other: [] };
		for (const l of locations) {
			if (l.type === 'binder') groups.binder.push(l);
			else if (l.type === 'szafka_slupek') groups.szafka_slupek.push(l);
			else groups.other.push(l);
		}
		return groups;
	});

	const finalCode = $derived(newCode.trim().toUpperCase() || locationCode);

	async function saveFromTmdb() {
		if (!finalCode) { error = 'Wybierz lub wpisz lokalizację'; return; }
		saving = true;
		error = '';

		const res = await fetch(`/api/tmdb/movie/${selected.tmdb_id}?type=${selected.media_type}`);
		const meta = res.ok ? await res.json() : null;

		const movie = meta
			? { ...meta, title: meta.tmdb_title_pl || selected.title_pl, location_code: finalCode, status: 'przegrane', has_metadata: true }
			: { title: selected.title_pl, location_code: finalCode, status: 'przegrane', has_metadata: false, tmdb_id: selected.tmdb_id, tmdb_title_pl: selected.title_pl, tmdb_title_original: selected.title_original, tmdb_year: parseInt(selected.year) || null };

		await supabase.from('locations').upsert(
			[{ code: finalCode, type: guessType(finalCode) }],
			{ onConflict: 'code' }
		);

		const { data, error: err } = await supabase.from('movies').insert(movie).select('id').single();
		if (err) { error = err.message; saving = false; return; }
		goto(`/movie/${data.id}`);
	}

	async function saveManual() {
		const code = manual.location_code.trim().toUpperCase();
		if (!manual.title.trim()) { error = 'Tytuł jest wymagany'; return; }
		if (!code) { error = 'Lokalizacja jest wymagana'; return; }
		saving = true;
		error = '';

		await supabase.from('locations').upsert([{ code, type: guessType(code) }], { onConflict: 'code' });

		const { data, error: err } = await supabase.from('movies').insert({
			title: manual.title.trim(),
			location_code: code,
			status: 'przegrane',
			has_metadata: false,
			manual_title_pl: manual.title.trim() || null,
			manual_title_en: manual.title_en.trim() || null,
			manual_year: parseInt(manual.year) || null,
			manual_director: manual.director.trim() || null,
			manual_genres: manual.genres.length > 0 ? manual.genres : null,
			manual_overview: manual.overview.trim() || null
		}).select('id').single();

		if (err) { error = err.message; saving = false; return; }
		goto(`/movie/${data.id}`);
	}

	function guessType(code) {
		if (/^S\d+$/.test(code)) return 'binder';
		if (/^SZ\d+$/.test(code)) return 'szafka_slupek';
		if (code === 'REGAL') return 'regal';
		if (code === 'SZAFW' || code === 'SZAFN') return 'szafka';
		if (code === 'ROB') return 'regal_bluray';
		return 'other';
	}
</script>

<div class="min-h-screen bg-white dark:bg-gray-950">
	<header class="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
		<button onclick={() => step === 'search' ? goto('/') : (step = 'search')}
			class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
		<h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">
			{step === 'search' ? 'Dodaj film' : step === 'location' ? 'Wybierz lokalizację' : 'Dodaj ręcznie'}
		</h1>
	</header>

	{#if step === 'search'}
		<div class="px-4 pt-4">
			<input type="search" placeholder="Wpisz tytuł po polsku, angielsku lub oryginalny..."
				value={query} oninput={onSearchInput} autofocus
				class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
		</div>

		{#if searching}
			<div class="px-4 pt-6 text-center">
				<div class="w-5 h-5 mx-auto rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-[#00B0F0] animate-spin"></div>
			</div>
		{:else if results.length > 0}
			<div class="px-4 pt-3 space-y-2">
				{#each results as r}
					<button onclick={() => selectResult(r)}
						class="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-[#00B0F0]/30 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-colors text-left">
						{#if r.poster_path}
							<img src={posterUrl(r.poster_path, 'w92')} alt={r.title_pl}
								class="w-10 h-14 object-cover rounded-lg shrink-0 bg-gray-100 dark:bg-gray-800" />
						{:else}
							<div class="w-10 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center">
								<svg class="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
								</svg>
							</div>
						{/if}
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.title_pl}</p>
							{#if r.title_original && r.title_original !== r.title_pl}
								<p class="text-xs text-gray-400 dark:text-gray-500 truncate">{r.title_original}</p>
							{/if}
							<p class="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
								{r.year || '—'}
								{#if r.media_type === 'tv'}<span class="ml-1">· Serial</span>{/if}
								{#if r.rating}<span class="ml-1">· ★ {r.rating}</span>{/if}
							</p>
						</div>
					</button>
				{/each}
			</div>
		{:else if query.trim() && !searching}
			<div class="px-4 pt-8 text-center">
				<p class="text-sm text-gray-400 dark:text-gray-500">Nie znaleziono w TMDB</p>
			</div>
		{/if}

		{#if query.trim()}
			<div class="px-4 pt-4">
				<button onclick={goManual}
					class="w-full py-3 text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600">
					Dodaj ręcznie bez metadanych
				</button>
			</div>
		{/if}
	{/if}

	{#if step === 'location' && selected}
		<div class="px-4 pt-4">
			<div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl mb-5">
				{#if selected.poster_path}
					<img src={posterUrl(selected.poster_path, 'w92')} alt={selected.title_pl}
						class="w-8 h-12 object-cover rounded-lg shrink-0" />
				{/if}
				<div class="min-w-0">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selected.title_pl}</p>
					<p class="text-xs text-gray-400 dark:text-gray-500">{selected.year || '—'}</p>
				</div>
			</div>

			<div class="mb-4">
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Wpisz kod lokalizacji</label>
				<input type="text" placeholder="np. S01, SZ123, REGAŁ" bind:value={newCode}
					class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 uppercase placeholder-gray-300 dark:placeholder-gray-600" />
			</div>

			<p class="text-xs text-gray-400 dark:text-gray-500 mb-2">lub wybierz z listy</p>

			<div class="space-y-4 pb-32">
				{#if groupedLocations.binder.length}
					<div>
						<p class="text-[11px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wide mb-1.5">Segregatory</p>
						<div class="grid grid-cols-4 gap-1.5">
							{#each groupedLocations.binder as l}
								<button onclick={() => { locationCode = l.code; newCode = ''; }}
									class="py-2 text-xs rounded-xl border transition-colors {locationCode === l.code && !newCode
										? 'border-[#00B0F0] text-[#00B0F0] bg-sky-50 dark:bg-sky-950/30'
										: 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}">
									{l.code}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if groupedLocations.szafka_slupek.length}
					<div>
						<p class="text-[11px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wide mb-1.5">Szafka Słupek</p>
						<div class="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
							{#each groupedLocations.szafka_slupek as l}
								<button onclick={() => { locationCode = l.code; newCode = ''; }}
									class="py-2 text-xs rounded-xl border transition-colors {locationCode === l.code && !newCode
										? 'border-[#00B0F0] text-[#00B0F0] bg-sky-50 dark:bg-sky-950/30'
										: 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}">
									{l.code}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if groupedLocations.other.length}
					<div>
						<p class="text-[11px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wide mb-1.5">Inne</p>
						<div class="grid grid-cols-3 gap-1.5">
							{#each groupedLocations.other as l}
								<button onclick={() => { locationCode = l.code; newCode = ''; }}
									class="py-2 text-xs rounded-xl border transition-colors {locationCode === l.code && !newCode
										? 'border-[#00B0F0] text-[#00B0F0] bg-sky-50 dark:bg-sky-950/30'
										: 'border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}">
									{l.display_name || l.code}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 px-4 py-4">
			{#if error}<p class="text-xs text-red-400 mb-2">{error}</p>{/if}
			<button onclick={saveFromTmdb} disabled={saving || !finalCode}
				class="w-full py-3.5 rounded-2xl font-medium text-white text-sm disabled:opacity-40"
				style="background:#00B0F0">
				{saving ? 'Dodawanie...' : `Dodaj do ${finalCode || '...'}`}
			</button>
		</div>
	{/if}

	{#if step === 'manual'}
		<div class="px-4 pt-4 pb-32 space-y-3">
			{#each [
				['title', 'Tytuł (PL) *', 'text', 'Tytuł po polsku'],
				['title_en', 'Tytuł (EN)', 'text', 'English title'],
				['year', 'Rok', 'number', 'np. 1994'],
				['director', 'Reżyser', 'text', 'Imię i nazwisko'],
				['location_code', 'Lokalizacja *', 'text', 'np. S01, SZ123']
			] as [field, label, type, placeholder]}
				<div>
					<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">{label}</label>
					<input {type} {placeholder} bind:value={manual[field]}
						class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600 {field === 'location_code' ? 'uppercase' : ''}" />
				</div>
			{/each}
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Gatunki</label>
				<GenrePicker bind:selected={manual.genres} />
			</div>
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Opis</label>
				<textarea placeholder="Opis fabuły..." bind:value={manual.overview} rows="3"
					class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600 resize-none">
				</textarea>
			</div>
		</div>

		<div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 px-4 py-4">
			{#if error}<p class="text-xs text-red-400 mb-2">{error}</p>{/if}
			<button onclick={saveManual} disabled={saving}
				class="w-full py-3.5 rounded-2xl font-medium text-white text-sm disabled:opacity-40"
				style="background:#00B0F0">
				{saving ? 'Dodawanie...' : 'Dodaj film'}
			</button>
		</div>
	{/if}
</div>

<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase.js';
	import { posterUrl } from '$lib/tmdb.js';
	import { onMount } from 'svelte';

	let movie = $state(null);
	let loading = $state(true);
	let editing = $state(false);
	let saving = $state(false);
	let fetchingTmdb = $state(false);
	let showEnOverview = $state(false);
	let showDeleteConfirm = $state(false);
	let error = $state('');

	// Edit form fields (populated when editing opens)
	let editTitle = $state('');
	let editLocation = $state('');
	let editStatus = $state('przegrane');
	let editNotes = $state('');

	onMount(async () => {
		const { data } = await supabase.from('movies').select('*').eq('id', $page.params.id).single();
		movie = data;
		loading = false;
	});

	function openEdit() {
		editTitle = movie.title;
		editLocation = movie.location_code;
		editStatus = movie.status;
		editNotes = movie.custom_notes || '';
		editing = true;
		error = '';
	}

	async function saveEdit() {
		if (!editTitle.trim()) { error = 'Tytuł jest wymagany'; return; }
		const code = editLocation.trim().toUpperCase();
		if (!code) { error = 'Lokalizacja jest wymagana'; return; }
		saving = true;
		error = '';

		await supabase.from('locations').upsert([{ code, type: guessType(code) }], { onConflict: 'code' });

		const { error: err } = await supabase.from('movies').update({
			title: editTitle.trim(),
			location_code: code,
			status: editStatus,
			custom_notes: editNotes.trim() || null
		}).eq('id', movie.id);

		if (err) { error = err.message; saving = false; return; }

		movie = { ...movie, title: editTitle.trim(), location_code: code, status: editStatus, custom_notes: editNotes.trim() || null };
		editing = false;
		saving = false;
	}

	async function fetchTmdb() {
		if (!movie.tmdb_id) { error = 'Brak ID TMDB — nie można pobrać danych'; return; }
		fetchingTmdb = true;
		error = '';

		const res = await fetch(`/api/tmdb/movie/${movie.tmdb_id}?type=movie`);
		if (!res.ok) { error = 'Nie udało się pobrać danych z TMDB'; fetchingTmdb = false; return; }

		const meta = await res.json();
		const { error: err } = await supabase.from('movies').update({ ...meta, has_metadata: true }).eq('id', movie.id);
		if (err) { error = err.message; fetchingTmdb = false; return; }

		movie = { ...movie, ...meta, has_metadata: true };
		fetchingTmdb = false;
	}

	async function deleteMovie() {
		await supabase.from('movies').delete().eq('id', movie.id);
		goto('/');
	}

	function guessType(code) {
		if (/^S\d+$/.test(code)) return 'binder';
		if (/^SZ\d+$/.test(code)) return 'szafka_slupek';
		if (code === 'REGAL') return 'regal';
		if (code === 'SZAFW' || code === 'SZAFN') return 'szafka';
		if (code === 'ROB') return 'regal_bluray';
		return 'other';
	}

	const displayTitle = $derived(
		movie?.tmdb_title_pl || movie?.manual_title_pl || movie?.title || ''
	);
	const poster = $derived(posterUrl(movie?.tmdb_poster_path, 'w300'));
	const genres = $derived(movie?.tmdb_genres || movie?.manual_genres || []);
	const cast = $derived(movie?.tmdb_cast || []);
	const overviewPl = $derived(movie?.tmdb_overview_pl || movie?.manual_overview || '');
	const overviewEn = $derived(movie?.tmdb_overview_en || '');
	const year = $derived(movie?.tmdb_year || movie?.manual_year || null);
	const director = $derived(movie?.tmdb_director || movie?.manual_director || null);
	const rating = $derived(movie?.tmdb_rating || null);
</script>

<div class="min-h-screen bg-white">
	<!-- Header -->
	<header class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
		<button onclick={() => editing ? (editing = false) : goto('/')}
			class="text-gray-400 hover:text-gray-600 p-1 -ml-1">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
		{#if !editing && movie}
			<button onclick={openEdit} class="text-sm text-[#00B0F0]">Edytuj</button>
		{/if}
	</header>

	{#if loading}
		<div class="px-4 pt-8 space-y-3">
			<div class="h-5 w-48 bg-gray-100 rounded animate-pulse"></div>
			<div class="h-3 w-24 bg-gray-100 rounded animate-pulse"></div>
		</div>

	{:else if !movie}
		<div class="px-4 pt-16 text-center">
			<p class="text-gray-300 text-sm">Film nie istnieje</p>
			<button onclick={() => goto('/')} class="mt-3 text-xs text-[#00B0F0]">Wróć do listy</button>
		</div>

	{:else if editing}
		<!-- Edit form -->
		<div class="px-4 pt-4 pb-32 space-y-4">
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Tytuł *</label>
				<input type="text" bind:value={editTitle}
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30" />
			</div>
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Lokalizacja *</label>
				<input type="text" bind:value={editLocation}
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 uppercase outline-none focus:ring-2 focus:ring-[#00B0F0]/30" />
			</div>
			<div>
				<label class="text-xs text-gray-400 mb-2 block">Status</label>
				<div class="flex gap-2">
					{#each [['przegrane', 'Przegrane'], ['do_przegrania', 'Do Przegrania']] as [val, label]}
						<button onclick={() => (editStatus = val)}
							class="flex-1 py-2.5 text-sm rounded-xl border transition-colors {editStatus === val
								? 'border-[#00B0F0] text-[#00B0F0] bg-sky-50'
								: 'border-gray-100 text-gray-500'}">
							{label}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Notatki</label>
				<textarea bind:value={editNotes} rows="3" placeholder="Dodatkowe informacje..."
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 resize-none placeholder-gray-300">
				</textarea>
			</div>

			{#if !movie.has_metadata}
				<p class="text-xs text-gray-400 pt-2">
					Ten film nie ma metadanych TMDB. Możesz je pobrać jeśli znasz ID TMDB.
				</p>
			{/if}

			<!-- Delete -->
			{#if showDeleteConfirm}
				<div class="pt-4 space-y-2">
					<p class="text-sm text-red-500 text-center">Na pewno usunąć ten film?</p>
					<div class="flex gap-2">
						<button onclick={() => (showDeleteConfirm = false)}
							class="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-500">Anuluj</button>
						<button onclick={deleteMovie}
							class="flex-1 py-2.5 text-sm bg-red-500 text-white rounded-xl">Usuń</button>
					</div>
				</div>
			{:else}
				<button onclick={() => (showDeleteConfirm = true)}
					class="w-full pt-2 text-xs text-red-400 hover:text-red-500">Usuń film z kolekcji</button>
			{/if}
		</div>

		<div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
			{#if error}<p class="text-xs text-red-400 mb-2">{error}</p>{/if}
			<button onclick={saveEdit} disabled={saving}
				class="w-full py-3.5 rounded-2xl font-medium text-white text-sm disabled:opacity-40"
				style="background:#00B0F0">
				{saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
			</button>
		</div>

	{:else}
		<!-- Detail view -->
		<div class="pb-8">
			<!-- Poster + title -->
			<div class="flex gap-4 px-4 pt-4 pb-4">
				{#if poster}
					<img src={poster} alt={displayTitle}
						class="w-24 rounded-2xl object-cover shrink-0 bg-gray-100 shadow-sm" />
				{:else}
					<div class="w-24 h-36 rounded-2xl bg-gray-100 shrink-0 flex items-center justify-center">
						<svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4"/>
						</svg>
					</div>
				{/if}
				<div class="min-w-0 flex-1 pt-1">
					<h2 class="text-base font-semibold text-gray-900 leading-snug">{displayTitle}</h2>
					{#if movie.tmdb_title_original && movie.tmdb_title_original !== displayTitle}
						<p class="text-xs text-gray-400 mt-0.5">{movie.tmdb_title_original}</p>
					{/if}
					{#if movie.tmdb_title_en && movie.tmdb_title_en !== displayTitle && movie.tmdb_title_en !== movie.tmdb_title_original}
						<p class="text-xs text-gray-400">{movie.tmdb_title_en}</p>
					{/if}

					<div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
						{#if year}<span class="text-xs text-gray-400">{year}</span>{/if}
						{#if rating}<span class="text-xs text-gray-400">★ {rating}</span>{/if}
						{#if movie.tmdb_language && movie.tmdb_language !== 'pl'}
							<span class="text-xs text-gray-300 uppercase">{movie.tmdb_language}</span>
						{/if}
					</div>

					<!-- Location + status -->
					<div class="flex items-center gap-2 mt-2">
						<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{movie.location_code}</span>
						{#if movie.status === 'do_przegrania'}
							<span class="text-[10px] px-2 py-0.5 rounded-full font-medium" style="background:#f0f9ff; color:#00B0F0">Do Przegrania</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Genres -->
			{#if genres.length}
				<div class="px-4 pb-3 flex flex-wrap gap-1.5">
					{#each genres as g}
						<span class="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">{g}</span>
					{/each}
				</div>
			{/if}

			<!-- Director -->
			{#if director}
				<div class="px-4 pb-3">
					<p class="text-xs text-gray-400">Reżyseria: <span class="text-gray-700">{director}</span></p>
				</div>
			{/if}

			<!-- Overview -->
			{#if overviewPl}
				<div class="px-4 pb-4">
					<p class="text-sm text-gray-600 leading-relaxed">{overviewPl}</p>
					{#if overviewEn}
						<button onclick={() => (showEnOverview = !showEnOverview)}
							class="mt-2 text-xs text-gray-300 hover:text-gray-400">
							{showEnOverview ? 'Ukryj EN' : 'Pokaż po angielsku'}
						</button>
						{#if showEnOverview}
							<p class="mt-2 text-sm text-gray-400 leading-relaxed">{overviewEn}</p>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Cast -->
			{#if cast.length}
				<div class="pb-4">
					<p class="px-4 text-xs font-medium text-gray-300 uppercase tracking-wide mb-2">Obsada</p>
					<div class="px-4 flex gap-3 overflow-x-auto no-scrollbar pb-1">
						{#each cast as a}
							<div class="shrink-0 w-16 text-center">
								{#if a.profile_path}
									<img src={posterUrl(a.profile_path, 'w92')} alt={a.name}
										class="w-16 h-16 rounded-full object-cover bg-gray-100 mx-auto" />
								{:else}
									<div class="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
										<svg class="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
										</svg>
									</div>
								{/if}
								<p class="text-[10px] text-gray-500 mt-1 leading-tight truncate">{a.name}</p>
								{#if a.character}
									<p class="text-[10px] text-gray-300 truncate">{a.character}</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Custom notes -->
			{#if movie.custom_notes}
				<div class="px-4 pb-4">
					<p class="text-xs font-medium text-gray-300 uppercase tracking-wide mb-1">Notatki</p>
					<p class="text-sm text-gray-500">{movie.custom_notes}</p>
				</div>
			{/if}

			<!-- No metadata state -->
			{#if !movie.has_metadata}
				<div class="mx-4 p-3 bg-gray-50 rounded-2xl">
					<p class="text-xs text-gray-400 mb-2">Brak metadanych dla tego filmu.</p>
					{#if movie.tmdb_id}
						<button onclick={fetchTmdb} disabled={fetchingTmdb}
							class="text-xs font-medium disabled:opacity-40"
							style="color:#00B0F0">
							{fetchingTmdb ? 'Pobieranie...' : 'Pobierz z TMDB'}
						</button>
					{/if}
					{#if error}<p class="text-xs text-red-400 mt-1">{error}</p>{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

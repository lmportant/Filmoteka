<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { posterUrl } from '$lib/tmdb.js';

	const BATCH_SIZE = 3;   // movies processed concurrently
	const BATCH_DELAY = 500; // ms between batches (~12 req/s, well under TMDB limit)

	let status = $state('idle'); // 'idle' | 'running' | 'paused' | 'done'
	let total = $state(0);        // total movies needing enrichment at page load
	let previouslySkipped = $state(0); // already-stamped not-found from prior runs
	let enriched = $state(0);     // matched + saved successfully
	let notFound = $state(0);     // TMDB returned no results
	let errors = $state(0);       // API/network errors
	let recent = $state([]);      // last 8 processed { title, result, poster_path }
	let resetMessage = $state(''); // feedback after resetNotFound

	let startTime = 0;
	let sessionProcessed = $state(0); // processed in this session (for ETA)

	const processed = $derived(enriched + notFound + errors);
	const pct = $derived(total > 0 ? Math.round((processed / total) * 100) : 0);

	const eta = $derived.by(() => {
		if (!startTime || sessionProcessed < 3) return null;
		const elapsed = (Date.now() - startTime) / 1000;
		const rate = sessionProcessed / elapsed;
		const remaining = total - processed;
		if (rate <= 0 || remaining <= 0) return null;
		const secs = Math.round(remaining / rate);
		if (secs < 60) return '< 1 minuta';
		if (secs < 3600) return `~${Math.ceil(secs / 60)} min`;
		return `~${Math.ceil(secs / 3600)} godz`;
	});

	onMount(async () => {
		await refreshTotal();
	});

	async function refreshTotal() {
		const { count } = await supabase
			.from('movies')
			.select('*', { count: 'exact', head: true })
			.eq('has_metadata', false)
			.is('tmdb_fetched_at', null);
		total = count ?? 0;

		const { count: sc } = await supabase
			.from('movies')
			.select('*', { count: 'exact', head: true })
			.eq('has_metadata', false)
			.not('tmdb_fetched_at', 'is', null);
		previouslySkipped = sc ?? 0;
	}

	async function start() {
		status = 'running';
		startTime = Date.now();
		sessionProcessed = 0;
		await runLoop();
	}

	async function resume() {
		status = 'running';
		await runLoop();
	}

	function pause() {
		status = 'paused';
	}

	async function runLoop() {
		while (status === 'running') {
			// Always fetch fresh from DB — already-processed ones won't appear
			const { data } = await supabase
				.from('movies')
				.select('id, title')
				.eq('has_metadata', false)
				.is('tmdb_fetched_at', null)
				.limit(30);

			if (!data?.length) { status = 'done'; break; }

			for (let i = 0; i < data.length; i += BATCH_SIZE) {
				if (status !== 'running') break;
				await Promise.all(data.slice(i, i + BATCH_SIZE).map(enrichOne));
				if (status === 'running' && i + BATCH_SIZE < data.length) {
					await sleep(BATCH_DELAY);
				}
			}
		}
	}

	// Strip episode/series indicators that confuse TMDB:
	// "TYTUŁ (1,2,3/7)" → "TYTUŁ"
	// "TYTUŁ - SERIAL" → "TYTUŁ"
	// "TYTUŁ CZ. 2" → "TYTUŁ"
	function cleanTitle(title) {
		return title
			.replace(/\s*\([^)]*\)/g, '')                             // remove (...)
			.replace(/\s*[-–]\s*(SERIAL|FILM|MINI-?SERIAL|SEZON\s*\d+).*$/i, '') // remove "- SERIAL" etc.
			.replace(/\s+(CZ\.|CZĘŚĆ|VOL\.?|PART)\s*\d+.*$/i, '')    // remove "CZ. 2" etc.
			.trim();
	}

	async function searchTmdb(query) {
		const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
		return res.ok ? await res.json() : [];
	}

	async function enrichOne(movie) {
		try {
			// 1. Search TMDB — try original title first, then cleaned version
			let results = await searchTmdb(movie.title);

			if (!results.length) {
				const cleaned = cleanTitle(movie.title);
				if (cleaned && cleaned !== movie.title) {
					results = await searchTmdb(cleaned);
				}
			}

			if (!results.length) {
				// Mark attempted so we don't retry endlessly
				await supabase.from('movies')
					.update({ tmdb_fetched_at: new Date().toISOString() })
					.eq('id', movie.id);
				notFound++;
				sessionProcessed++;
				pushRecent(movie.title, 'not_found', null);
				return;
			}

			const best = results[0];

			// 2. Fetch full metadata
			const dRes = await fetch(`/api/tmdb/movie/${best.tmdb_id}?type=${best.media_type}`);
			const meta = dRes.ok ? await dRes.json() : null;

			if (!meta) {
				await supabase.from('movies')
					.update({ tmdb_fetched_at: new Date().toISOString() })
					.eq('id', movie.id);
				errors++;
				sessionProcessed++;
				pushRecent(movie.title, 'error', null);
				return;
			}

			// 3. Save to DB
			await supabase.from('movies')
				.update({ ...meta, has_metadata: true })
				.eq('id', movie.id);

			enriched++;
			sessionProcessed++;
			pushRecent(meta.tmdb_title_pl || movie.title, 'ok', meta.tmdb_poster_path);
		} catch {
			errors++;
			sessionProcessed++;
			pushRecent(movie.title, 'error', null);
		}
	}

	function pushRecent(title, result, poster_path) {
		recent = [{ title, result, poster_path }, ...recent].slice(0, 8);
	}

	// Clear tmdb_fetched_at on not-found movies so they get retried
	async function resetNotFound() {
		const count = previouslySkipped;
		await supabase
			.from('movies')
			.update({ tmdb_fetched_at: null })
			.eq('has_metadata', false)
			.not('tmdb_fetched_at', 'is', null);
		notFound = 0;
		errors = 0;
		enriched = 0;
		recent = [];
		await refreshTotal();
		status = 'idle';
		resetMessage = `Przywrócono ${count.toLocaleString('pl-PL')} filmów do kolejki. Naciśnij „Rozpocznij pobieranie".`;
	}

	function sleep(ms) {
		return new Promise((r) => setTimeout(r, ms));
	}

	const statusLabel = $derived(
		status === 'idle' ? 'Gotowy'
		: status === 'running' ? 'Pobieranie...'
		: status === 'paused' ? 'Zatrzymano'
		: 'Gotowe!'
	);
</script>

<div class="min-h-screen bg-white">
	<header class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 p-1 -ml-1">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div>
			<h1 class="text-base font-semibold text-gray-900 leading-tight">Metadane TMDB</h1>
			<p class="text-[11px] text-gray-400">{statusLabel}</p>
		</div>
	</header>

	<div class="px-4 pt-6 pb-12 max-w-lg mx-auto space-y-6">

		<!-- Stats cards -->
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-2xl bg-gray-50 p-4">
				<p class="text-2xl font-semibold text-gray-900">{total.toLocaleString('pl-PL')}</p>
				<p class="text-xs text-gray-400 mt-0.5">do pobrania</p>
			</div>
			<div class="rounded-2xl p-4" style="background:#f0f9ff">
				<p class="text-2xl font-semibold" style="color:#00B0F0">{enriched.toLocaleString('pl-PL')}</p>
				<p class="text-xs mt-0.5" style="color:#7dd3fc">pobrano metadane</p>
			</div>
			<div class="rounded-2xl bg-gray-50 p-4">
				<p class="text-2xl font-semibold text-gray-400">{notFound.toLocaleString('pl-PL')}</p>
				<p class="text-xs text-gray-400 mt-0.5">nie znaleziono</p>
			</div>
			<div class="rounded-2xl bg-gray-50 p-4">
				<p class="text-2xl font-semibold text-gray-400">{errors.toLocaleString('pl-PL')}</p>
				<p class="text-xs text-gray-400 mt-0.5">błędy</p>
			</div>
		</div>

		<!-- Progress bar -->
		{#if status !== 'idle'}
			<div>
				<div class="flex justify-between text-xs text-gray-400 mb-2">
					<span>{processed.toLocaleString('pl-PL')} / {total.toLocaleString('pl-PL')}</span>
					<span>{eta ?? (status === 'done' ? 'Ukończono' : '...')}</span>
				</div>
				<div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
					<div class="h-2 rounded-full transition-all duration-300"
						style="width:{pct}%; background:#00B0F0"></div>
				</div>
				<p class="text-right text-xs text-gray-300 mt-1">{pct}%</p>
			</div>
		{/if}

		<!-- Action button -->
		{#if status === 'idle'}
			{#if total === 0 && previouslySkipped === 0}
				<div class="text-center py-6">
					<p class="text-gray-300 text-sm">Wszystkie filmy mają już metadane.</p>
					<a href="/" class="mt-3 inline-block text-xs" style="color:#00B0F0">Wróć do listy</a>
				</div>
			{:else}
				<div class="space-y-3">
					{#if resetMessage}
						<div class="rounded-xl p-3 text-sm text-center" style="background:#f0f9ff; color:#00B0F0">
							{resetMessage}
						</div>
					{/if}

					{#if total > 0}
						<p class="text-sm text-gray-500">
							Do pobrania: <strong>{total.toLocaleString('pl-PL')}</strong> filmów
							{#if previouslySkipped > 0}
								<span class="text-gray-400 font-normal">
									(w tym {previouslySkipped.toLocaleString('pl-PL')} wcześniej pominiętych)
								</span>
							{/if}
						</p>
						<p class="text-xs text-gray-400">
							Możesz zatrzymać i wznowić w dowolnym momencie — postęp jest zapisywany na bieżąco.
						</p>
						<button onclick={() => { resetMessage = ''; start(); }}
							class="w-full py-3.5 rounded-2xl font-medium text-white text-sm"
							style="background:#00B0F0">
							Rozpocznij pobieranie
						</button>
					{/if}

					{#if previouslySkipped > 0 && total === 0}
						<div>
							<p class="text-xs text-gray-400 mb-2">
								<strong>{previouslySkipped.toLocaleString('pl-PL')}</strong> filmów pominiętych w poprzednim uruchomieniu.
								Ulepszone wyszukiwanie może teraz je dopasować.
							</p>
							<button onclick={resetNotFound}
								class="w-full py-3 rounded-2xl text-sm border border-gray-200 text-gray-500 hover:border-gray-300">
								Ponów próbę dla pominiętych ({previouslySkipped.toLocaleString('pl-PL')})
							</button>
						</div>
					{:else if previouslySkipped > 0}
						<div class="pt-2 border-t border-gray-100">
							<button onclick={resetNotFound}
								class="w-full py-3 rounded-2xl text-sm border border-gray-200 text-gray-500 hover:border-gray-300">
								Ponów próbę dla pominiętych ({previouslySkipped.toLocaleString('pl-PL')})
							</button>
						</div>
					{/if}
				</div>
			{/if}

		{:else if status === 'running'}
			<button onclick={pause}
				class="w-full py-3.5 rounded-2xl font-medium text-sm border-2 border-gray-200 text-gray-500">
				Pauza
			</button>

		{:else if status === 'paused'}
			<div class="space-y-2">
				<button onclick={resume}
					class="w-full py-3.5 rounded-2xl font-medium text-white text-sm"
					style="background:#00B0F0">
					Wznów
				</button>
				<p class="text-center text-xs text-gray-400">
					Możesz zamknąć tę stronę — następnym razem wznowi od miejsca zatrzymania.
				</p>
			</div>

		{:else if status === 'done'}
			<div class="text-center py-2 space-y-3">
				<p class="text-sm text-gray-500">Pobieranie zakończone.</p>
				{#if notFound > 0}
					<p class="text-xs text-gray-400">
						{notFound} filmów bez dopasowania — możesz je wyszukać ręcznie z widoku szczegółów.
					</p>
					<button onclick={resetNotFound}
						class="text-xs underline text-gray-400 hover:text-gray-600">
						Ponów próbę dla nieznalezionych
					</button>
				{/if}
				<a href="/" class="inline-block text-sm font-medium" style="color:#00B0F0">
					Wróć do kolekcji
				</a>
			</div>
		{/if}

		<!-- Live feed -->
		{#if recent.length > 0}
			<div>
				<p class="text-xs font-medium text-gray-300 uppercase tracking-wide mb-3">Ostatnio przetworzone</p>
				<div class="space-y-2">
					{#each recent as item}
						<div class="flex items-center gap-3">
							{#if item.poster_path}
								<img src={posterUrl(item.poster_path, 'w92')} alt=""
									class="w-7 h-10 object-cover rounded-lg shrink-0 bg-gray-100" />
							{:else}
								<div class="w-7 h-10 rounded-lg bg-gray-100 shrink-0"></div>
							{/if}
							<p class="text-sm text-gray-700 truncate flex-1">{item.title}</p>
							{#if item.result === 'ok'}
								<span class="text-xs shrink-0" style="color:#00B0F0">✓</span>
							{:else if item.result === 'not_found'}
								<span class="text-xs text-gray-300 shrink-0">—</span>
							{:else}
								<span class="text-xs text-red-300 shrink-0">✗</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

	</div>
</div>

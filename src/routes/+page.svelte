<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { exportToXlsx } from '$lib/export.js';
	import { goto } from '$app/navigation';
	import { signOut, user } from '$lib/auth.js';

	const PAGE_SIZE = 50;

	let movies = $state([]);
	let total = $state(0);
	let doCount = $state(0);
	let noMetaCount = $state(0);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let page = $state(0);
	let exporting = $state(false);
	let showExportMenu = $state(false);

	let search = $state('');
	let statusFilter = $state('all'); // 'all' | 'przegrane' | 'do_przegrania'
	let sortBy = $state('location'); // 'location' | 'title'

	let sentinel = $state(null);
	/** @type {IntersectionObserver | undefined} */
	let observer;
	let searchTimer;

	onMount(async () => {
		const { count } = await supabase.from('movies').select('*', { count: 'exact', head: true });
		if (!count) {
			goto('/import');
			return;
		}
		total = count;

		const { count: dc } = await supabase
			.from('movies')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'do_przegrania');
		doCount = dc ?? 0;

		const { count: nc } = await supabase
			.from('movies')
			.select('*', { count: 'exact', head: true })
			.eq('has_metadata', false)
			.is('tmdb_fetched_at', null);
		noMetaCount = nc ?? 0;

		observer = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) loadNextPage();
		}, { rootMargin: '300px' });

		await loadFirstPage();
		loading = false;

		return () => observer?.disconnect();
	});

	$effect(() => {
		if (sentinel && observer) {
			observer.observe(sentinel);
			return () => { if (sentinel) observer.unobserve(sentinel); };
		}
	});

	function buildQuery() {
		let q = supabase
			.from('movies')
			.select('id, title, location_code, status, tmdb_title_original, has_metadata');

		const term = search.trim();
		if (term) {
			q = q.or(
				`title.ilike.%${term}%,tmdb_title_en.ilike.%${term}%,tmdb_title_original.ilike.%${term}%`
			);
		}
		if (statusFilter !== 'all') q = q.eq('status', statusFilter);
		return sortBy === 'title' ? q.order('title') : q.order('location_code').order('title');
	}

	async function loadFirstPage() {
		movies = [];
		hasMore = true;
		loadingMore = true;
		const { data } = await buildQuery().range(0, PAGE_SIZE - 1);
		movies = data ?? [];
		hasMore = (data?.length ?? 0) === PAGE_SIZE;
		page = 1;
		loadingMore = false;
	}

	async function loadNextPage() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		const { data } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
		movies = [...movies, ...(data ?? [])];
		hasMore = (data?.length ?? 0) === PAGE_SIZE;
		page++;
		loadingMore = false;
	}

	function onSearchInput(e) {
		search = e.target.value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(loadFirstPage, 300);
	}

	function setStatus(val) {
		statusFilter = val;
		loadFirstPage();
	}

	function toggleSort() {
		sortBy = sortBy === 'location' ? 'title' : 'location';
		loadFirstPage();
	}

	async function doExport(filter) {
		showExportMenu = false;
		exporting = true;
		const { data } = await supabase
			.from('movies')
			.select(
				'location_code,title,status,tmdb_title_pl,tmdb_title_en,tmdb_title_original,tmdb_year,tmdb_genres,tmdb_director,tmdb_rating,manual_title_pl,manual_title_en,manual_year,manual_genres,manual_director'
			)
			.order('location_code')
			.order('title');
		exportToXlsx(data ?? [], filter);
		exporting = false;
	}

	const przegraneCount = $derived(total - doCount);
	const isSearching = $derived(search.trim().length > 0 || statusFilter !== 'all');
</script>

<div class="min-h-screen bg-white flex flex-col">

	<!-- Sticky header -->
	<header class="sticky top-0 z-20 bg-white border-b border-gray-100">
		<div class="px-4 py-3 flex items-center justify-between">
			<div>
				<h1 class="text-base font-semibold text-gray-900 leading-tight">Filmoteka</h1>
				{#if !loading}
					<p class="text-[11px] text-gray-400 leading-tight">
						{total.toLocaleString('pl-PL')} filmów
					</p>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<!-- Enrich indicator -->
				{#if noMetaCount > 0}
					<a href="/enrich"
						class="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-[#00B0F0]/40 hover:text-[#00B0F0] transition-colors">
						{noMetaCount.toLocaleString('pl-PL')} bez metadanych
					</a>
				{/if}
				<!-- Export dropdown -->
				<div class="relative">
					<button
						onclick={() => (showExportMenu = !showExportMenu)}
						disabled={exporting || loading}
						class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
					>
						{exporting ? '...' : 'Eksportuj'}
					</button>
					{#if showExportMenu}
						<div class="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30">
							{#each [['all', 'Wszystkie filmy'], ['przegrane', 'Tylko Przegrane'], ['do_przegrania', 'Tylko Do Przegrania']] as [val, label]}
								<button
									onclick={() => doExport(val)}
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
								>
									{label}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<a
					href="/import"
					class="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
					style="background:#00B0F0"
				>
					Import
				</a>

				<button
					onclick={() => signOut().then(() => goto('/login'))}
					class="text-xs text-gray-300 hover:text-gray-500 px-1"
					title={$user?.email}
				>
					Wyloguj
				</button>
			</div>
		</div>

		<!-- Search bar -->
		<div class="px-4 pb-2">
			<input
				type="search"
				placeholder="Szukaj filmów..."
				value={search}
				oninput={onSearchInput}
				class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300"
			/>
		</div>

		<!-- Filter chips + sort -->
		<div class="px-4 pb-3 flex items-center justify-between gap-2">
			<div class="flex gap-1.5 overflow-x-auto no-scrollbar">
				{#each [['all', 'Wszystkie'], ['przegrane', 'Przegrane'], ['do_przegrania', 'Do Przegrania']] as [val, label]}
					<button
						onclick={() => setStatus(val)}
						class="shrink-0 text-xs px-3 py-1 rounded-full transition-colors {statusFilter === val
							? 'text-white font-medium'
							: 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
						style={statusFilter === val ? 'background:#00B0F0' : ''}
					>
						{label}
					</button>
				{/each}
			</div>

			<button
				onclick={toggleSort}
				class="shrink-0 text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
			>
				{sortBy === 'location' ? 'Lok.' : 'A–Z'}
				<svg class="w-3 h-3" viewBox="0 0 12 12" fill="none">
					<path d="M6 2L9 5H3L6 2Z" fill="currentColor"/>
					<path d="M6 10L3 7H9L6 10Z" fill="currentColor"/>
				</svg>
			</button>
		</div>
	</header>

	<!-- Stats bar (hidden while searching) -->
	{#if !loading && !isSearching}
		<div class="px-4 pt-3 pb-1 flex gap-2">
			<div class="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
				<p class="text-base font-semibold text-gray-900">{total.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-gray-400">filmów</p>
			</div>
			<div class="flex-1 rounded-xl p-2.5 text-center" style="background:#f0f9ff">
				<p class="text-base font-semibold" style="color:#00B0F0">{doCount.toLocaleString('pl-PL')}</p>
				<p class="text-[10px]" style="color:#7dd3fc">do przegrania</p>
			</div>
			<div class="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
				<p class="text-base font-semibold text-gray-900">{przegraneCount.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-gray-400">przegranych</p>
			</div>
		</div>
	{/if}

	<!-- Movie list -->
	<main class="flex-1 px-4 pb-8">
		{#if loading}
			<!-- Skeleton -->
			<div class="pt-4 space-y-3">
				{#each Array(8) as _}
					<div class="flex justify-between items-center py-1">
						<div class="space-y-1.5">
							<div class="h-3.5 w-40 bg-gray-100 rounded animate-pulse"></div>
							<div class="h-2.5 w-12 bg-gray-100 rounded animate-pulse"></div>
						</div>
					</div>
				{/each}
			</div>

		{:else if movies.length === 0 && !loadingMore}
			<div class="pt-16 text-center">
				<p class="text-gray-300 text-sm">Brak wyników</p>
				{#if isSearching}
					<button onclick={() => { search = ''; statusFilter = 'all'; loadFirstPage(); }}
						class="mt-3 text-xs text-[#00B0F0]">Wyczyść filtry</button>
				{/if}
			</div>

		{:else}
			<div class="pt-2 divide-y divide-gray-50">
				{#each movies as m (m.id)}
					<a href="/movie/{m.id}" class="py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50/50 -mx-1 px-1 rounded-lg transition-colors">
						<div class="min-w-0 flex-1">
							<p class="text-sm text-gray-900 truncate leading-snug">{m.title}</p>
							<p class="text-[11px] text-gray-400 mt-0.5">
								{m.location_code}
								{#if m.tmdb_title_original && m.tmdb_title_original !== m.title}
									<span class="text-gray-300"> · {m.tmdb_title_original}</span>
								{/if}
							</p>
						</div>
						{#if m.status === 'do_przegrania'}
							<span
								class="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
								style="background:#f0f9ff; color:#00B0F0"
							>
								Do Prz.
							</span>
						{/if}
					</a>
				{/each}
			</div>

			<!-- Infinite scroll sentinel -->
			{#if hasMore}
				<div bind:this={sentinel} class="py-6 flex justify-center">
					{#if loadingMore}
						<div class="w-5 h-5 rounded-full border-2 border-gray-200 border-t-[#00B0F0] animate-spin"></div>
					{/if}
				</div>
			{:else if movies.length > 0}
				<p class="py-6 text-center text-[11px] text-gray-200">
					{movies.length.toLocaleString('pl-PL')} filmów
				</p>
			{/if}
		{/if}
	</main>
</div>

<!-- FAB: Add new movie -->
<a href="/movie/new"
	class="fixed bottom-6 right-5 w-13 h-13 rounded-full shadow-lg flex items-center justify-center text-white text-2xl z-20"
	style="background:#00B0F0; width:52px; height:52px">
	<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
		<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
	</svg>
</a>

<!-- Close export menu on outside click -->
{#if showExportMenu}
	<div class="fixed inset-0 z-10" onclick={() => (showExportMenu = false)} role="none"></div>
{/if}

<style>
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

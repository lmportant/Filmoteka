<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase.js';
	import { onMount } from 'svelte';

	const PAGE_SIZE = 50;
	const code = $derived(decodeURIComponent($page.params.code));

	let movies = $state([]);
	let total = $state(0);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let pageNum = $state(0);
	let sentinel = $state(null);
	let observer;

	onMount(async () => {
		const { count } = await supabase
			.from('movies')
			.select('*', { count: 'exact', head: true })
			.eq('location_code', code);
		total = count ?? 0;

		observer = new IntersectionObserver(
			([e]) => { if (e.isIntersecting) loadNext(); },
			{ rootMargin: '300px' }
		);

		await loadFirst();
		loading = false;

		return () => observer?.disconnect();
	});

	$effect(() => {
		if (sentinel && observer) {
			observer.observe(sentinel);
			return () => { if (sentinel) observer.unobserve(sentinel); };
		}
	});

	async function loadFirst() {
		loadingMore = true;
		const { data } = await supabase
			.from('movies')
			.select('id, title, status, tmdb_title_original, has_metadata')
			.eq('location_code', code)
			.order('title')
			.range(0, PAGE_SIZE - 1);
		movies = data ?? [];
		hasMore = (data?.length ?? 0) === PAGE_SIZE;
		pageNum = 1;
		loadingMore = false;
	}

	async function loadNext() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		const { data } = await supabase
			.from('movies')
			.select('id, title, status, tmdb_title_original, has_metadata')
			.eq('location_code', code)
			.order('title')
			.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
		movies = [...movies, ...(data ?? [])];
		hasMore = (data?.length ?? 0) === PAGE_SIZE;
		pageNum++;
		loadingMore = false;
	}
</script>

<div class="min-h-screen bg-white dark:bg-gray-950">
	<header class="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
		<a href="/locations" class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1" aria-label="Wróć">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div>
			<h1 class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">{code}</h1>
			{#if !loading}
				<p class="text-[11px] text-gray-400 dark:text-gray-500">{total.toLocaleString('pl-PL')} filmów</p>
			{/if}
		</div>
	</header>

	{#if loading}
		<div class="px-4 pt-4 space-y-3">
			{#each Array(8) as _}
				<div class="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>
			{/each}
		</div>

	{:else if movies.length === 0}
		<div class="px-4 pt-16 text-center">
			<p class="text-gray-300 dark:text-gray-600 text-sm">Brak filmów w tej lokalizacji.</p>
		</div>

	{:else}
		<div class="px-4 pt-2 pb-8 divide-y divide-gray-50 dark:divide-gray-800">
			{#each movies as m (m.id)}
				<a href="/movie/{m.id}" class="py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-white/5 -mx-1 px-1 rounded-lg transition-colors">
					<div class="min-w-0 flex-1">
						<p class="text-sm text-gray-900 dark:text-gray-100 truncate">{m.title}</p>
						{#if m.tmdb_title_original && m.tmdb_title_original !== m.title}
							<p class="text-[11px] text-gray-300 dark:text-gray-600 truncate">{m.tmdb_title_original}</p>
						{/if}
					</div>
					{#if m.status === 'do_przegrania'}
						<span class="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium bg-sky-50 dark:bg-sky-950/40" style="color:#00B0F0">Do Prz.</span>
					{/if}
				</a>
			{/each}

			{#if hasMore}
				<div bind:this={sentinel} class="py-6 flex justify-center">
					{#if loadingMore}
						<div class="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-[#00B0F0] animate-spin"></div>
					{/if}
				</div>
			{:else}
				<p class="py-6 text-center text-[11px] text-gray-200 dark:text-gray-700">{movies.length.toLocaleString('pl-PL')} filmów</p>
			{/if}
		</div>
	{/if}
</div>

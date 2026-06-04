<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { exportToXlsx } from '$lib/export.js';
	import { goto } from '$app/navigation';

	let movies = $state([]);
	let total = $state(0);
	let doCount = $state(0);
	let loading = $state(true);
	let exporting = $state(false);
	let exportFilter = $state('all');
	let showExportMenu = $state(false);

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

		const { data } = await supabase
			.from('movies')
			.select('id, title, location_code, status')
			.order('location_code')
			.order('title')
			.limit(100);
		movies = data ?? [];
		loading = false;
	});

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
</script>

<div class="min-h-screen bg-white">
	<!-- Header -->
	<header class="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
		<div>
			<h1 class="text-lg font-semibold text-gray-900">Filmoteka</h1>
			{#if !loading}
				<p class="text-xs text-gray-400">{total.toLocaleString('pl-PL')} filmów</p>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<!-- Export button -->
			<div class="relative">
				<button
					onclick={() => (showExportMenu = !showExportMenu)}
					disabled={exporting || loading}
					class="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
				>
					{exporting ? 'Eksport...' : 'Eksportuj'}
				</button>

				{#if showExportMenu}
					<div class="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20">
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
				class="text-sm px-3 py-1.5 rounded-lg text-white font-medium"
				style="background:#00B0F0"
			>
				Importuj
			</a>
		</div>
	</header>

	<!-- Stats -->
	{#if !loading && total > 0}
		<div class="px-4 py-4 flex gap-3">
			<div class="flex-1 rounded-xl bg-gray-50 p-3 text-center">
				<p class="text-xl font-semibold text-gray-900">{total.toLocaleString('pl-PL')}</p>
				<p class="text-xs text-gray-400 mt-0.5">filmów</p>
			</div>
			<div class="flex-1 rounded-xl p-3 text-center" style="background:#f0f9ff">
				<p class="text-xl font-semibold" style="color:#00B0F0">{doCount.toLocaleString('pl-PL')}</p>
				<p class="text-xs mt-0.5" style="color:#7dd3fc">do przegrania</p>
			</div>
			<div class="flex-1 rounded-xl bg-gray-50 p-3 text-center">
				<p class="text-xl font-semibold text-gray-900">{(total - doCount).toLocaleString('pl-PL')}</p>
				<p class="text-xs text-gray-400 mt-0.5">przegranych</p>
			</div>
		</div>
	{/if}

	<!-- Movie list (first 100, full list coming in Phase 2) -->
	{#if loading}
		<div class="px-4 py-12 text-center text-gray-300 text-sm">Ładowanie...</div>
	{:else}
		<div class="px-4 pb-8">
			{#if total > 100}
				<p class="text-xs text-gray-300 mb-3">
					Pokazuję 100 z {total.toLocaleString('pl-PL')} — pełna lista z wyszukiwaniem dostępna wkrótce
				</p>
			{/if}

			<div class="divide-y divide-gray-50">
				{#each movies as m (m.id)}
					<div class="py-2.5 flex items-center justify-between gap-3">
						<div class="min-w-0">
							<p class="text-sm text-gray-900 truncate">{m.title}</p>
							<p class="text-xs text-gray-400 mt-0.5">{m.location_code}</p>
						</div>
						{#if m.status === 'do_przegrania'}
							<span
								class="shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium"
								style="background:#f0f9ff; color:#00B0F0"
							>
								Do Prz.
							</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Close export menu on outside click -->
{#if showExportMenu}
	<div class="fixed inset-0 z-10" onclick={() => (showExportMenu = false)} role="none"></div>
{/if}

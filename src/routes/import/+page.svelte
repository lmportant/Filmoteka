<script>
	import { parseXlsx } from '$lib/import.js';
	import { supabase } from '$lib/supabase.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let fileInput = $state(null);
	let parsed = $state(null);
	let importing = $state(false);
	let progress = $state(0);
	let error = $state('');
	let dragging = $state(false);
	let existingCount = $state(0);
	let showConfirm = $state(false);

	onMount(async () => {
		const { count } = await supabase.from('movies').select('*', { count: 'exact', head: true });
		existingCount = count ?? 0;
	});

	async function readFile(f) {
		if (!f) return;
		if (!f.name.endsWith('.xlsx')) {
			error = 'Wybierz plik w formacie .xlsx';
			return;
		}
		error = '';
		parsed = null;
		showConfirm = false;
		const buf = await f.arrayBuffer();
		parsed = parseXlsx(new Uint8Array(buf));
	}

	function onDrop(e) {
		e.preventDefault();
		dragging = false;
		readFile(e.dataTransfer.files[0]);
	}

	function handleImportClick() {
		if (existingCount > 0) {
			showConfirm = true;
		} else {
			importData();
		}
	}

	async function importData() {
		if (!parsed) return;
		showConfirm = false;
		importing = true;
		error = '';
		progress = 0;

		try {
			if (existingCount > 0) {
				await supabase.from('movies').delete().gte('created_at', '1900-01-01T00:00:00');
				await supabase.from('locations').delete().gte('created_at', '1900-01-01T00:00:00');
			}

			await supabase.from('locations').upsert(parsed.locations, { onConflict: 'code' });

			const BATCH = 500;
			for (let i = 0; i < parsed.movies.length; i += BATCH) {
				const { error: err } = await supabase
					.from('movies')
					.insert(parsed.movies.slice(i, i + BATCH));
				if (err) throw err;
				progress = Math.min(i + BATCH, parsed.movies.length);
			}

			goto('/');
		} catch (e) {
			error = e.message ?? 'Błąd podczas importu';
		} finally {
			importing = false;
		}
	}

	const doCount = $derived(parsed?.movies.filter((m) => m.status === 'do_przegrania').length ?? 0);
	const pct = $derived(parsed ? Math.round((progress / parsed.movies.length) * 100) : 0);
</script>

<div class="min-h-screen bg-white px-4 py-8 max-w-lg mx-auto">
	<a href="/" class="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">← Wróć</a>

	<h1 class="text-2xl font-semibold text-gray-900 mb-1">Importuj kolekcję</h1>
	<p class="text-sm text-gray-400 mb-8">Plik .xlsx z arkuszem FILMOTEKA (kolumny: lokalizacja, tytuł)</p>

	<!-- Drop zone -->
	<button
		class="w-full border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
           {dragging ? 'border-[#00B0F0] bg-sky-50' : 'border-gray-200 hover:border-gray-300'}"
		ondragover={(e) => { e.preventDefault(); dragging = true; }}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
		onclick={() => fileInput?.click()}
	>
		<p class="text-gray-400 text-sm">Przeciągnij plik .xlsx tutaj</p>
		<p class="text-gray-300 text-xs mt-1">lub kliknij, aby wybrać</p>
	</button>

	<input
		bind:this={fileInput}
		type="file"
		accept=".xlsx"
		class="hidden"
		onchange={(e) => readFile(e.target.files[0])}
	/>

	{#if error}
		<p class="mt-4 text-red-500 text-sm">{error}</p>
	{/if}

	{#if parsed}
		<!-- Summary -->
		<div class="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
			<div class="flex justify-between text-sm">
				<span class="text-gray-500">Filmy</span>
				<span class="font-semibold text-gray-900">{parsed.movies.length.toLocaleString('pl-PL')}</span>
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-gray-500">Do Przegrania</span>
				<span class="font-semibold" style="color:#00B0F0">{doCount.toLocaleString('pl-PL')}</span>
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-gray-500">Lokalizacje</span>
				<span class="font-semibold text-gray-900">{parsed.locations.length}</span>
			</div>
		</div>

		<!-- Preview table -->
		<div class="mt-6">
			<p class="text-xs text-gray-400 mb-2">Podgląd — pierwsze 20 wierszy</p>
			<div class="overflow-x-auto rounded-xl border border-gray-100">
				<table class="w-full text-xs">
					<thead class="bg-gray-50">
						<tr>
							<th class="text-left px-3 py-2 text-gray-400 font-normal">Lok.</th>
							<th class="text-left px-3 py-2 text-gray-400 font-normal">Tytuł</th>
							<th class="text-left px-3 py-2 text-gray-400 font-normal">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each parsed.movies.slice(0, 20) as m}
							<tr class="border-t border-gray-50">
								<td class="px-3 py-2 text-gray-500 whitespace-nowrap">{m.location_code}</td>
								<td class="px-3 py-2 text-gray-900 max-w-[180px] truncate">{m.title}</td>
								<td class="px-3 py-2 whitespace-nowrap">
									{#if m.status === 'do_przegrania'}
										<span style="color:#00B0F0" class="text-[11px]">Do Przegrania</span>
									{:else}
										<span class="text-gray-300 text-[11px]">Przegrane</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Progress bar -->
		{#if importing}
			<div class="mt-5">
				<div class="flex justify-between text-xs text-gray-400 mb-1">
					<span>Importowanie...</span>
					<span>{progress.toLocaleString('pl-PL')} / {parsed.movies.length.toLocaleString('pl-PL')}</span>
				</div>
				<div class="w-full bg-gray-100 rounded-full h-1.5">
					<div class="h-1.5 rounded-full transition-all" style="width:{pct}%; background:#00B0F0"></div>
				</div>
			</div>
		{/if}

		<!-- Import button -->
		<button
			onclick={handleImportClick}
			disabled={importing}
			class="mt-5 w-full py-3.5 rounded-2xl font-medium text-white text-sm transition-opacity disabled:opacity-40 cursor-pointer"
			style="background:#00B0F0"
		>
			{importing
				? `Importowanie... ${pct}%`
				: `Importuj ${parsed.movies.length.toLocaleString('pl-PL')} filmów`}
		</button>
	{/if}
</div>

<!-- Overwrite confirmation modal -->
{#if showConfirm}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
		onclick={() => showConfirm = false}>
		<div class="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4"
			onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
					<svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
					</svg>
				</div>
				<h2 class="text-base font-semibold text-gray-900">Zastąpić kolekcję?</h2>
			</div>
			<p class="text-sm text-gray-500">
				Masz już <strong class="text-gray-900">{existingCount.toLocaleString('pl-PL')} filmów</strong> w bazie, włącznie z metadanymi TMDB i ręcznymi edycjami. Import usunie całą kolekcję i zastąpi ją danymi z pliku.
			</p>
			<p class="text-xs text-red-400">Tej operacji nie można cofnąć.</p>
			<div class="flex gap-3 pt-1">
				<button
					onclick={() => showConfirm = false}
					class="flex-1 py-3 rounded-2xl text-sm font-medium text-gray-600 bg-gray-100"
				>
					Anuluj
				</button>
				<button
					onclick={importData}
					class="flex-1 py-3 rounded-2xl text-sm font-medium text-white bg-red-500"
				>
					Tak, zastąp
				</button>
			</div>
		</div>
	</div>
{/if}

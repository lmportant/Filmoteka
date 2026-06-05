<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';

	const TYPE_LABELS = {
		binder: 'Segregatory',
		regal_bluray: 'Regał Blu-Ray',
		szafka: 'Szafy',
		regal: 'Regały',
		other: 'Inne',
		szafka_slupek: 'Szafka Słupek'
	};

	const TYPE_ORDER = ['binder', 'regal_bluray', 'szafka', 'regal', 'other', 'szafka_slupek'];

	let locations = $state([]);
	let loading = $state(true);
	let szOpen = $state(false); // szafka_slupek collapsed by default
	let searchSz = $state('');

	// Editing state
	let editCode = $state(''); // which location is being edited
	let editMode = $state(''); // 'rename' | 'transfer'
	let renameValue = $state('');
	let transferDest = $state('');
	let saving = $state(false);
	let editError = $state('');

	onMount(async () => {
		await load();
	});

	async function load() {
		const [{ data: locs }, { data: movies }] = await Promise.all([
			supabase.from('locations').select('*').order('type').order('code'),
			supabase.from('movies').select('location_code')
		]);

		const counts = {};
		for (const m of movies ?? []) {
			counts[m.location_code] = (counts[m.location_code] || 0) + 1;
		}

		locations = (locs ?? []).map((l) => ({ ...l, count: counts[l.code] || 0 }));
		loading = false;
	}

	function openEdit(code, mode) {
		if (editCode === code && editMode === mode) {
			closeEdit();
			return;
		}
		editCode = code;
		editMode = mode;
		renameValue = code;
		transferDest = '';
		editError = '';
	}

	function closeEdit() {
		editCode = '';
		editMode = '';
		editError = '';
	}

	async function rename(oldCode) {
		const newCode = renameValue.trim().toUpperCase();
		if (!newCode || newCode === oldCode) { closeEdit(); return; }
		saving = true;
		editError = '';

		// Check collision
		const exists = locations.find((l) => l.code === newCode && l.code !== oldCode);
		if (exists) {
			editError = `Lokalizacja „${newCode}" już istnieje.`;
			saving = false;
			return;
		}

		await supabase.from('movies').update({ location_code: newCode }).eq('location_code', oldCode);
		const { error } = await supabase.from('locations').update({ code: newCode }).eq('code', oldCode);

		if (error) { editError = error.message; saving = false; return; }
		closeEdit();
		await load();
		saving = false;
	}

	async function transferAll(sourceCode) {
		const dest = transferDest.trim().toUpperCase();
		if (!dest || dest === sourceCode) { editError = 'Wybierz inną lokalizację docelową.'; return; }
		saving = true;
		editError = '';

		// Ensure destination location exists
		await supabase.from('locations').upsert([{ code: dest, type: guessType(dest) }], { onConflict: 'code' });

		// Move all movies
		await supabase.from('movies').update({ location_code: dest }).eq('location_code', sourceCode);

		// Delete empty source location
		await supabase.from('locations').delete().eq('code', sourceCode);

		closeEdit();
		await load();
		saving = false;
	}

	function guessType(code) {
		if (/^S\d+$/.test(code)) return 'binder';
		if (/^SZ\d+$/.test(code)) return 'szafka_slupek';
		if (code === 'REGAL') return 'regal';
		if (code === 'SZAFW' || code === 'SZAFN') return 'szafka';
		if (code === 'ROB') return 'regal_bluray';
		return 'other';
	}

	const grouped = $derived.by(() => {
		const map = {};
		for (const loc of locations) {
			const t = loc.type || 'other';
			if (!map[t]) map[t] = [];
			map[t].push(loc);
		}
		return TYPE_ORDER.filter((t) => map[t]?.length).map((t) => ({ type: t, items: map[t] }));
	});

	const nonSzTotal = $derived(locations.filter((l) => l.type !== 'szafka_slupek').length);
	const szItems = $derived(
		locations
			.filter((l) => l.type === 'szafka_slupek')
			.filter((l) => !searchSz.trim() || l.code.toLowerCase().includes(searchSz.toLowerCase()))
	);

	const transferOptions = $derived(locations.filter((l) => l.code !== editCode));
</script>

<div class="min-h-screen bg-white">
	<header class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 p-1 -ml-1" aria-label="Wróć">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div>
			<h1 class="text-base font-semibold text-gray-900 leading-tight">Lokalizacje</h1>
			{#if !loading}
				<p class="text-[11px] text-gray-400">{locations.length} lokalizacji</p>
			{/if}
		</div>
	</header>

	{#if loading}
		<div class="px-4 pt-8 space-y-3">
			{#each Array(6) as _}
				<div class="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
			{/each}
		</div>

	{:else}
		<div class="pb-8">
			{#each grouped as group}
				{#if group.type !== 'szafka_slupek'}
					<!-- Regular groups -->
					<div class="pt-5 pb-1">
						<p class="px-4 text-[11px] font-medium text-gray-300 uppercase tracking-wide mb-1">
							{TYPE_LABELS[group.type]}
						</p>
						{#each group.items as loc}
							<div class="border-b border-gray-50 last:border-0">
								<!-- Location row -->
								<div class="px-4 py-3 flex items-center gap-3">
									<a href="/locations/{encodeURIComponent(loc.code)}"
										class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900">{loc.code}</p>
										{#if loc.display_name}
											<p class="text-xs text-gray-400">{loc.display_name}</p>
										{/if}
									</a>
									<span class="text-xs text-gray-400 shrink-0">{loc.count.toLocaleString('pl-PL')}</span>
									<div class="flex gap-1 shrink-0">
										<button
											onclick={() => openEdit(loc.code, 'rename')}
											class="text-xs px-2.5 py-1 rounded-lg border transition-colors {editCode === loc.code && editMode === 'rename'
												? 'border-[#00B0F0] text-[#00B0F0]'
												: 'border-gray-200 text-gray-400 hover:border-gray-300'}"
										>
											Zmień
										</button>
										<button
											onclick={() => openEdit(loc.code, 'transfer')}
											class="text-xs px-2.5 py-1 rounded-lg border transition-colors {editCode === loc.code && editMode === 'transfer'
												? 'border-[#00B0F0] text-[#00B0F0]'
												: 'border-gray-200 text-gray-400 hover:border-gray-300'}"
										>
											Przenieś
										</button>
									</div>
								</div>

								<!-- Inline edit panel -->
								{#if editCode === loc.code}
									<div class="px-4 pb-3 space-y-2">
										{#if editMode === 'rename'}
											<p class="text-xs text-gray-400">Nowy kod lokalizacji — zaktualizuje wszystkie {loc.count} filmów.</p>
											<div class="flex gap-2">
												<input
													type="text"
													bind:value={renameValue}
													onkeydown={(e) => e.key === 'Enter' && rename(loc.code)}
													class="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[#00B0F0]/30"
												/>
												<button
													onclick={() => rename(loc.code)}
													disabled={saving}
													class="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-40"
													style="background:#00B0F0"
												>
													{saving ? '...' : 'Zapisz'}
												</button>
												<button onclick={closeEdit} class="px-3 py-2 text-sm text-gray-400 hover:text-gray-600">
													✕
												</button>
											</div>

										{:else if editMode === 'transfer'}
											<p class="text-xs text-gray-400">Przenieś {loc.count} filmów do innej lokalizacji.</p>
											<div class="flex gap-2">
												<div class="flex-1 relative">
													<input
														type="text"
														bind:value={transferDest}
														placeholder="Kod docelowy (np. S61)"
														list="transfer-options-{loc.code}"
														class="w-full text-sm bg-gray-50 rounded-xl px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300"
													/>
													<datalist id="transfer-options-{loc.code}">
														{#each transferOptions as opt}
															<option value={opt.code}>{opt.code} ({opt.count})</option>
														{/each}
													</datalist>
												</div>
												<button
													onclick={() => transferAll(loc.code)}
													disabled={saving || !transferDest.trim()}
													class="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-40"
													style="background:#00B0F0"
												>
													{saving ? '...' : 'Przenieś'}
												</button>
												<button onclick={closeEdit} class="px-3 py-2 text-sm text-gray-400 hover:text-gray-600">
													✕
												</button>
											</div>
										{/if}

										{#if editError}
											<p class="text-xs text-red-400">{editError}</p>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/each}

			<!-- Szafka Słupek — collapsible (600+ items) -->
			{#if szItems.length > 0 || locations.some((l) => l.type === 'szafka_slupek')}
				<div class="pt-5">
					<button
						onclick={() => (szOpen = !szOpen)}
						class="w-full px-4 pb-1 flex items-center justify-between text-left"
					>
						<p class="text-[11px] font-medium text-gray-300 uppercase tracking-wide">
							Szafka Słupek
							<span class="ml-1 normal-case font-normal">
								({locations.filter((l) => l.type === 'szafka_slupek').length})
							</span>
						</p>
						<svg class="w-4 h-4 text-gray-300 transition-transform {szOpen ? 'rotate-180' : ''}"
							fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>

					{#if szOpen}
						<div class="px-4 pt-2 pb-3">
							<input
								type="search"
								bind:value={searchSz}
								placeholder="Szukaj kodu SZ..."
								class="w-full text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 mb-3"
							/>
						</div>
						{#each szItems as loc}
							<div class="border-b border-gray-50 last:border-0">
								<div class="px-4 py-2.5 flex items-center gap-3">
									<a href="/locations/{encodeURIComponent(loc.code)}" class="flex-1 min-w-0">
										<p class="text-sm text-gray-700">{loc.code}</p>
									</a>
									<span class="text-xs text-gray-400 shrink-0">{loc.count}</span>
									<div class="flex gap-1 shrink-0">
										<button
											onclick={() => openEdit(loc.code, 'rename')}
											class="text-xs px-2 py-1 rounded-lg border transition-colors {editCode === loc.code && editMode === 'rename'
												? 'border-[#00B0F0] text-[#00B0F0]'
												: 'border-gray-200 text-gray-400'}"
										>Zmień</button>
										<button
											onclick={() => openEdit(loc.code, 'transfer')}
											class="text-xs px-2 py-1 rounded-lg border transition-colors {editCode === loc.code && editMode === 'transfer'
												? 'border-[#00B0F0] text-[#00B0F0]'
												: 'border-gray-200 text-gray-400'}"
										>Przenieś</button>
									</div>
								</div>
								{#if editCode === loc.code}
									<div class="px-4 pb-3 space-y-2">
										{#if editMode === 'rename'}
											<div class="flex gap-2">
												<input type="text" bind:value={renameValue}
													onkeydown={(e) => e.key === 'Enter' && rename(loc.code)}
													class="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[#00B0F0]/30" />
												<button onclick={() => rename(loc.code)} disabled={saving}
													class="px-4 py-2 text-sm rounded-xl text-white disabled:opacity-40"
													style="background:#00B0F0">{saving ? '...' : 'Zapisz'}</button>
												<button onclick={closeEdit} class="px-2 py-2 text-sm text-gray-400">✕</button>
											</div>
										{:else if editMode === 'transfer'}
											<div class="flex gap-2">
												<input type="text" bind:value={transferDest}
													placeholder="Kod docelowy"
													list="sz-transfer-{loc.code}"
													class="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300" />
												<datalist id="sz-transfer-{loc.code}">
													{#each transferOptions as opt}
														<option value={opt.code}></option>
													{/each}
												</datalist>
												<button onclick={() => transferAll(loc.code)} disabled={saving || !transferDest.trim()}
													class="px-4 py-2 text-sm rounded-xl text-white disabled:opacity-40"
													style="background:#00B0F0">{saving ? '...' : 'Przenieś'}</button>
												<button onclick={closeEdit} class="px-2 py-2 text-sm text-gray-400">✕</button>
											</div>
										{/if}
										{#if editError}
											<p class="text-xs text-red-400">{editError}</p>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

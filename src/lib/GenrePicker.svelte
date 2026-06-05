<script>
	import { onMount } from 'svelte';

	let { selected = $bindable([]) } = $props();

	let allGenres = $state([]);
	let query = $state('');
	let open = $state(false);

	onMount(async () => {
		const res = await fetch('/api/genres');
		if (res.ok) allGenres = await res.json();
	});

	const filtered = $derived(
		allGenres
			.filter((g) => !selected.includes(g))
			.filter((g) => !query.trim() || g.toLowerCase().includes(query.toLowerCase()))
			.slice(0, 10)
	);

	const showAddNew = $derived(
		query.trim().length > 0 &&
		!allGenres.some((g) => g.toLowerCase() === query.trim().toLowerCase()) &&
		!selected.some((g) => g.toLowerCase() === query.trim().toLowerCase())
	);

	function add(genre) {
		const g = genre.trim();
		if (g && !selected.includes(g)) selected = [...selected, g];
		query = '';
		open = false;
	}

	function remove(genre) {
		selected = selected.filter((g) => g !== genre);
	}

	function onKeydown(e) {
		if (e.key === 'Enter') { e.preventDefault(); if (query.trim()) add(query); }
		if (e.key === 'Escape') open = false;
		if (e.key === 'Backspace' && !query && selected.length > 0) {
			selected = selected.slice(0, -1);
		}
	}
</script>

<div class="relative">
	<!-- Selected chips -->
	{#if selected.length > 0}
		<div class="flex flex-wrap gap-1.5 mb-2">
			{#each selected as genre}
				<span class="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
					style="background:#f0f9ff; color:#00B0F0">
					{genre}
					<button
						type="button"
						onclick={() => remove(genre)}
						class="leading-none opacity-60 hover:opacity-100 text-sm"
						aria-label="Usuń gatunek {genre}"
					>×</button>
				</span>
			{/each}
		</div>
	{/if}

	<!-- Input -->
	<input
		type="text"
		bind:value={query}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
		onkeydown={onKeydown}
		placeholder={selected.length ? 'Dodaj gatunek...' : 'np. Dramat, Thriller...'}
		class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300"
	/>

	<!-- Dropdown -->
	{#if open && (filtered.length > 0 || showAddNew)}
		<div class="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-48 overflow-y-auto">
			{#each filtered as genre}
				<button
					type="button"
					onmousedown={() => add(genre)}
					class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					{genre}
				</button>
			{/each}
			{#if showAddNew}
				<button
					type="button"
					onmousedown={() => add(query)}
					class="w-full text-left px-4 py-2.5 text-sm border-t border-gray-50 hover:bg-sky-50"
					style="color:#00B0F0"
				>
					Dodaj „{query.trim()}"
				</button>
			{/if}
		</div>
	{/if}

	<p class="text-[11px] text-gray-300 mt-1">Wybierz z listy lub wpisz nowy gatunek</p>
</div>

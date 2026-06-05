<script>
	import { supabase } from '$lib/supabase.js';
	import { onMount } from 'svelte';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	let requests = $state([]);
	let loading = $state(true);
	let filter = $state('pending');
	let actionMsg = $state('');

	onMount(async () => {
		await loadRequests();
	});

	async function loadRequests() {
		loading = true;
		actionMsg = '';
		let q = supabase.from('access_requests').select('*').order('created_at', { ascending: false });
		if (filter === 'pending') q = q.eq('status', 'pending');
		const { data } = await q;
		requests = data ?? [];
		loading = false;
	}

	async function invite(req) {
		actionMsg = '';
		const {
			data: { session }
		} = await supabase.auth.getSession();

		const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/invite-user`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`
			},
			body: JSON.stringify({ email: req.email, requestId: req.id })
		});

		if (res.ok) {
			actionMsg = `✓ Zaproszenie wysłane do ${req.email}`;
			await loadRequests();
		} else {
			const err = await res.json().catch(() => ({}));
			actionMsg = 'Błąd: ' + (err.error ?? 'nieznany');
		}
	}

	async function reject(req) {
		const { error } = await supabase
			.from('access_requests')
			.update({ status: 'rejected' })
			.eq('id', req.id);
		if (!error) {
			actionMsg = `Odrzucono prośbę od ${req.email}`;
			await loadRequests();
		}
	}

	async function deleteReq(req) {
		await supabase.from('access_requests').delete().eq('id', req.id);
		actionMsg = `Usunięto wpis ${req.email}`;
		await loadRequests();
	}

	function formatDate(ts) {
		return new Date(ts).toLocaleDateString('pl-PL', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const statusLabel = { pending: 'oczekuje', invited: 'zaproszony', rejected: 'odrzucony' };
	const statusColor = {
		pending: 'text-amber-500',
		invited: 'text-green-500',
		rejected: 'text-gray-400'
	};
</script>

<div class="min-h-screen bg-white">
	<header class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 p-1 -ml-1">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h1 class="text-base font-semibold text-gray-900">Panel admina</h1>
	</header>

	<div class="px-4 pt-6 pb-12 max-w-lg mx-auto">
			<!-- Section header -->
			<p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Prośby o dostęp</p>

			<!-- Filter tabs -->
			<div class="flex bg-gray-100 rounded-xl p-1 mb-5">
				{#each [['pending', 'Oczekujące'], ['all', 'Wszystkie']] as [val, label]}
					<button
						onclick={() => { filter = val; loadRequests(); }}
						class="flex-1 py-2 text-sm rounded-lg transition-colors font-medium {filter === val
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-500'}"
					>
						{label}
					</button>
				{/each}
			</div>

			{#if actionMsg}
				<p
					class="text-sm mb-4 {actionMsg.startsWith('✓')
						? 'text-green-500'
						: actionMsg.startsWith('Błąd')
							? 'text-red-400'
							: 'text-gray-500'}"
				>
					{actionMsg}
				</p>
			{/if}

			{#if loading}
				<div class="flex justify-center py-12">
					<div class="w-5 h-5 rounded-full border-2 border-gray-200 border-t-[#00B0F0] animate-spin"></div>
				</div>
			{:else if requests.length === 0}
				<p class="text-sm text-gray-400 text-center py-12">Brak próśb o dostęp.</p>
			{:else}
				<div class="space-y-3">
					{#each requests as req (req.id)}
						<div class="bg-gray-50 rounded-2xl p-4 space-y-2">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="text-sm font-medium text-gray-900 truncate">{req.email}</p>
									<p class="text-[11px] text-gray-400">{formatDate(req.created_at)}</p>
								</div>
								<span class="text-xs font-medium shrink-0 {statusColor[req.status]}">
									{statusLabel[req.status] ?? req.status}
								</span>
							</div>

							{#if req.message}
								<p class="text-xs text-gray-500 italic">"{req.message}"</p>
							{/if}

							{#if req.status === 'pending'}
								<div class="flex gap-2 pt-1">
									<button
										onclick={() => invite(req)}
										class="flex-1 py-2 rounded-xl text-xs font-medium text-white"
										style="background:#00B0F0"
									>
										Wyślij zaproszenie
									</button>
									<button
										onclick={() => reject(req)}
										class="flex-1 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-200"
									>
										Odrzuć
									</button>
								</div>
							{:else}
								<div class="flex justify-end pt-1">
									<button
										onclick={() => deleteReq(req)}
										class="text-xs text-gray-400 hover:text-red-400 transition-colors"
									>
										Usuń wpis
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
		{/if}
	</div>
</div>

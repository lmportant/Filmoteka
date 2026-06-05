<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user, authLoading, initAuth, claimExistingData, signOut } from '$lib/auth.js';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	const { needRefresh, updateServiceWorker } = useRegisterSW();

	let { children } = $props();
	let migrationDone = false;

	onMount(async () => {
		await initAuth();
	});

	// Auth guard — runs when auth state or current page changes
	$effect(() => {
		if ($authLoading) return;

		const onLoginPage = $page.url.pathname === '/login';

		if (!$user && !onLoginPage) {
			goto('/login');
			return;
		}

		if ($user && onLoginPage) {
			goto('/');
			return;
		}

		// One-time claim of existing data after first login
		if ($user && !migrationDone) {
			migrationDone = true;
			claimExistingData($user.id);
		}
	});

	async function handleSignOut() {
		await signOut();
		goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Filmoteka</title>
</svelte:head>

{#if $authLoading}
	<div class="min-h-screen bg-white flex items-center justify-center">
		<div class="w-5 h-5 rounded-full border-2 border-gray-200 border-t-[#00B0F0] animate-spin"></div>
	</div>
{:else}
	{@render children()}
{/if}

<!-- Update available banner -->
{#if $needRefresh}
	<div class="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3
		bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl shadow-lg">
		<span class="text-sm">Dostępna aktualizacja</span>
		<button
			onclick={() => updateServiceWorker(true)}
			class="text-xs font-medium px-3 py-1.5 rounded-lg"
			style="background:#00B0F0"
		>
			Odśwież
		</button>
	</div>
{/if}

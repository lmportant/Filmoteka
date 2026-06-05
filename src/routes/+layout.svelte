<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user, authLoading, initAuth, claimExistingData, signOut, userRole } from '$lib/auth.js';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	const { needRefresh, updateServiceWorker } = useRegisterSW();

	let { children } = $props();
	let migrationDone = false;

	// PWA install
	let deferredPrompt = $state(null);
	let showInstallBanner = $state(false);
	let showIOSModal = $state(false);
	let isIOS = $state(false);

	onMount(async () => {
		await initAuth();

		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			window.navigator.standalone === true;
		if (isStandalone) return;

		isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
		const isMobile =
			/android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 768;

		if (isMobile && isIOS) {
			showInstallBanner = true;
		}

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e;
			showInstallBanner = true;
		});
	});

	async function handleInstall() {
		if (isIOS) {
			showIOSModal = true;
			return;
		}
		if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			deferredPrompt = null;
			if (outcome === 'accepted') showInstallBanner = false;
		}
	}

	// Auth + admin route guard
	$effect(() => {
		if ($authLoading) return;

		const path = $page.url.pathname;
		const onLoginPage = path === '/login';
		const onAdminPage = path.startsWith('/admin');

		if (!$user && !onLoginPage) {
			goto('/login');
			return;
		}

		if ($user && onLoginPage) {
			goto('/');
			return;
		}

		// Guard admin: only redirect once role is resolved (non-null)
		if ($user && onAdminPage && $userRole !== null && $userRole !== 'admin') {
			goto('/');
			return;
		}

		if ($user && !migrationDone) {
			migrationDone = true;
			claimExistingData($user.id);
		}
	});
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

<!-- PWA install banner (shown when logged in, on mobile, not standalone) -->
{#if $user && showInstallBanner}
	<div class="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3
		bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl shadow-lg">
		<div class="flex items-center gap-2 min-w-0">
			<svg class="w-5 h-5 shrink-0 text-[#00B0F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
			</svg>
			<span class="text-xs truncate">Zainstaluj aplikację na telefonie</span>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<button
				onclick={handleInstall}
				class="text-xs font-medium px-3 py-1.5 rounded-lg"
				style="background:#00B0F0"
			>
				Zainstaluj
			</button>
			<button
				onclick={() => showInstallBanner = false}
				class="text-gray-400 hover:text-white p-1"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<!-- iOS install instructions modal -->
{#if showIOSModal}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
		onclick={() => showIOSModal = false}>
		<div class="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4"
			onclick={(e) => e.stopPropagation()}>
			<h2 class="text-base font-semibold text-gray-900">Dodaj do ekranu głównego</h2>
			<ol class="space-y-3 text-sm text-gray-600">
				<li class="flex items-start gap-3">
					<span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">1</span>
					<span>Stuknij przycisk <strong>Udostępnij</strong> (kwadrat ze strzałką) na dole Safari</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">2</span>
					<span>Przewiń w dół i stuknij <strong>Dodaj do ekranu głównego</strong></span>
				</li>
				<li class="flex items-start gap-3">
					<span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">3</span>
					<span>Stuknij <strong>Dodaj</strong> w prawym górnym rogu</span>
				</li>
			</ol>
			<button
				onclick={() => { showIOSModal = false; showInstallBanner = false; }}
				class="w-full py-3 rounded-2xl text-sm font-medium text-white"
				style="background:#00B0F0"
			>
				Rozumiem
			</button>
		</div>
	</div>
{/if}

<!-- App update banner -->
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

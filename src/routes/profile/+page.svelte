<script>
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase.js';
	import { user, signOut, userRole } from '$lib/auth.js';
	import { isDark, toggleTheme } from '$lib/theme.js';
	import { onMount } from 'svelte';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let newEmail = $state('');
	let savingPassword = $state(false);
	let savingEmail = $state(false);
	let passwordMsg = $state('');
	let emailMsg = $state('');
	let stats = $state({ total: 0, enriched: 0, doCount: 0 });

	let isStandalone = $state(false);
	let showUninstallModal = $state(false);
	let isIOS = $state(false);

	onMount(async () => {
		const [{ count: total }, { count: enriched }, { count: doCount }] = await Promise.all([
			supabase.from('movies').select('*', { count: 'exact', head: true }),
			supabase.from('movies').select('*', { count: 'exact', head: true }).eq('has_metadata', true),
			supabase.from('movies').select('*', { count: 'exact', head: true }).eq('status', 'do_przegrania')
		]);
		stats = { total: total ?? 0, enriched: enriched ?? 0, doCount: doCount ?? 0 };

		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			window.navigator.standalone === true;
		isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
	});

	async function changePassword() {
		passwordMsg = '';
		if (!newPassword) { passwordMsg = 'Wpisz nowe hasło.'; return; }
		if (newPassword.length < 6) { passwordMsg = 'Hasło musi mieć co najmniej 6 znaków.'; return; }
		if (newPassword !== confirmPassword) { passwordMsg = 'Hasła nie są identyczne.'; return; }
		savingPassword = true;
		const { error } = await supabase.auth.updateUser({ password: newPassword });
		savingPassword = false;
		if (error) { passwordMsg = error.message; return; }
		passwordMsg = '✓ Hasło zostało zmienione.';
		newPassword = '';
		confirmPassword = '';
	}

	async function changeEmail() {
		emailMsg = '';
		const trimmed = newEmail.trim();
		if (!trimmed || !trimmed.includes('@')) { emailMsg = 'Wpisz prawidłowy adres e-mail.'; return; }
		savingEmail = true;
		const { error } = await supabase.auth.updateUser({ email: trimmed });
		savingEmail = false;
		if (error) { emailMsg = error.message; return; }
		emailMsg = '✓ Link potwierdzający wysłany na nowy adres.';
		newEmail = '';
	}

	async function handleSignOut() {
		await signOut();
		goto('/login');
	}

	const initial = $derived($user?.email?.charAt(0).toUpperCase() ?? '?');
	const avatarColor = $derived(hashColor($user?.email ?? ''));

	function hashColor(str) {
		const colors = ['#00B0F0', '#6366f1', '#ec4899', '#f59e0b', '#10b981'];
		let h = 0;
		for (const c of str) h = c.charCodeAt(0) + ((h << 5) - h);
		return colors[Math.abs(h) % colors.length];
	}
</script>

<div class="min-h-screen bg-white dark:bg-gray-950">
	<header class="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">Profil</h1>
	</header>

	<div class="px-4 pt-8 pb-12 max-w-sm mx-auto space-y-8">

		<!-- Avatar + email -->
		<div class="flex flex-col items-center gap-3 pb-2">
			<div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold text-white"
				style="background:{avatarColor}">
				{initial}
			</div>
			<p class="text-sm text-gray-600 dark:text-gray-400">{$user?.email ?? ''}</p>
		</div>

		<!-- Collection stats -->
		<div class="grid grid-cols-3 gap-2">
			<div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
				<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">filmów</p>
			</div>
			<div class="bg-sky-50 dark:bg-sky-950/40 rounded-xl p-3 text-center">
				<p class="text-lg font-semibold" style="color:#00B0F0">{stats.enriched.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-sky-300 mt-0.5">z metadanymi</p>
			</div>
			<div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
				<p class="text-lg font-semibold text-gray-400 dark:text-gray-500">{stats.doCount.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">do przegrania</p>
			</div>
		</div>

		<!-- Dark mode toggle -->
		<div class="pt-2 border-t border-gray-100 dark:border-gray-800">
			<button onclick={toggleTheme}
				class="flex items-center justify-between w-full py-3 text-sm text-gray-600 dark:text-gray-400">
				<span>{$isDark ? 'Tryb ciemny' : 'Tryb jasny'}</span>
				<div class="w-11 h-6 rounded-full relative transition-colors {$isDark ? 'bg-[#00B0F0]' : 'bg-gray-200'}">
					<div class="w-4 h-4 bg-white rounded-full absolute top-1 transition-all {$isDark ? 'left-6' : 'left-1'}"></div>
				</div>
			</button>
		</div>

		<!-- Change password -->
		<div class="space-y-3">
			<p class="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Zmień hasło</p>
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Nowe hasło</label>
				<input type="password" bind:value={newPassword} placeholder="min. 6 znaków" autocomplete="new-password"
					class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
			</div>
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Powtórz hasło</label>
				<input type="password" bind:value={confirmPassword} placeholder="powtórz nowe hasło" autocomplete="new-password"
					class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
			</div>
			{#if passwordMsg}
				<p class="text-xs {passwordMsg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}">{passwordMsg}</p>
			{/if}
			<button onclick={changePassword} disabled={savingPassword}
				class="w-full py-3 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
				style="background:#00B0F0">
				{savingPassword ? 'Zapisywanie...' : 'Zmień hasło'}
			</button>
		</div>

		<!-- Change email -->
		<div class="space-y-3">
			<p class="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Zmień e-mail</p>
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Nowy adres e-mail</label>
				<input type="email" bind:value={newEmail} placeholder="nowy@email.com" autocomplete="email"
					class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
			</div>
			{#if emailMsg}
				<p class="text-xs {emailMsg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}">{emailMsg}</p>
			{/if}
			<button onclick={changeEmail} disabled={savingEmail}
				class="w-full py-3 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
				style="background:#00B0F0">
				{savingEmail ? 'Wysyłanie...' : 'Zmień e-mail'}
			</button>
			<p class="text-[11px] text-gray-300 dark:text-gray-600 text-center">
				Link potwierdzający zostanie wysłany na nowy adres.
			</p>
		</div>

		<!-- Admin panel link -->
		{#if $userRole === 'admin'}
			<div class="pt-2 border-t border-gray-100 dark:border-gray-800">
				<a href="/admin" class="flex items-center justify-between w-full py-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
					<span class="font-medium">Panel admina</span>
					<svg class="w-4 h-4 text-gray-400 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
					</svg>
				</a>
			</div>
		{/if}

		<!-- Uninstall PWA -->
		{#if isStandalone}
			<div class="pt-2 border-t border-gray-100 dark:border-gray-800">
				<button onclick={() => showUninstallModal = true}
					class="w-full py-3 text-sm text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors text-left">
					Usuń aplikację z ekranu głównego
				</button>
			</div>
		{/if}

		<!-- Sign out -->
		<div class="pt-2 border-t border-gray-100 dark:border-gray-800">
			<button onclick={handleSignOut} class="w-full py-3 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
				Wyloguj się
			</button>
		</div>
	</div>
</div>

<!-- Uninstall instructions modal -->
{#if showUninstallModal}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
		onclick={() => showUninstallModal = false}>
		<div class="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 space-y-4"
			onclick={(e) => e.stopPropagation()}>
			<h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Usuń aplikację</h2>
			{#if isIOS}
				<ol class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
					<li class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">1</span>
						<span>Wróć do ekranu głównego i znajdź ikonę <strong>Filmoteka</strong></span>
					</li>
					<li class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">2</span>
						<span>Przytrzymaj ikonę, aż pojawi się menu</span>
					</li>
					<li class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">3</span>
						<span>Stuknij <strong>Usuń aplikację</strong></span>
					</li>
				</ol>
			{:else}
				<ol class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
					<li class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">1</span>
						<span>Znajdź ikonę <strong>Filmoteka</strong> na ekranie głównym</span>
					</li>
					<li class="flex items-start gap-3">
						<span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">2</span>
						<span>Przytrzymaj ikonę i stuknij <strong>Odinstaluj</strong></span>
					</li>
				</ol>
			{/if}
			<button onclick={() => showUninstallModal = false}
				class="w-full py-3 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800">
				Zamknij
			</button>
		</div>
	</div>
{/if}

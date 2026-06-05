<script>
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase.js';
	import { user, signOut } from '$lib/auth.js';
	import { onMount } from 'svelte';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let newEmail = $state('');
	let savingPassword = $state(false);
	let savingEmail = $state(false);
	let passwordMsg = $state('');
	let emailMsg = $state('');
	let stats = $state({ total: 0, enriched: 0, doCount: 0 });

	onMount(async () => {
		const [{ count: total }, { count: enriched }, { count: doCount }] = await Promise.all([
			supabase.from('movies').select('*', { count: 'exact', head: true }),
			supabase.from('movies').select('*', { count: 'exact', head: true }).eq('has_metadata', true),
			supabase.from('movies').select('*', { count: 'exact', head: true }).eq('status', 'do_przegrania')
		]);
		stats = { total: total ?? 0, enriched: enriched ?? 0, doCount: doCount ?? 0 };
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

	// Initial-based avatar
	const initial = $derived($user?.email?.charAt(0).toUpperCase() ?? '?');
	const avatarColor = $derived(hashColor($user?.email ?? ''));

	function hashColor(str) {
		const colors = ['#00B0F0', '#6366f1', '#ec4899', '#f59e0b', '#10b981'];
		let h = 0;
		for (const c of str) h = c.charCodeAt(0) + ((h << 5) - h);
		return colors[Math.abs(h) % colors.length];
	}
</script>

<div class="min-h-screen bg-white">
	<header class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 p-1 -ml-1">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<h1 class="text-base font-semibold text-gray-900">Profil</h1>
	</header>

	<div class="px-4 pt-8 pb-12 max-w-sm mx-auto space-y-8">

		<!-- Avatar + email -->
		<div class="flex flex-col items-center gap-3 pb-2">
			<div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold text-white"
				style="background:{avatarColor}">
				{initial}
			</div>
			<p class="text-sm text-gray-600">{$user?.email ?? ''}</p>
		</div>

		<!-- Collection stats -->
		<div class="grid grid-cols-3 gap-2">
			<div class="bg-gray-50 rounded-xl p-3 text-center">
				<p class="text-lg font-semibold text-gray-900">{stats.total.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-gray-400 mt-0.5">filmów</p>
			</div>
			<div class="rounded-xl p-3 text-center" style="background:#f0f9ff">
				<p class="text-lg font-semibold" style="color:#00B0F0">{stats.enriched.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] mt-0.5" style="color:#7dd3fc">z metadanymi</p>
			</div>
			<div class="bg-gray-50 rounded-xl p-3 text-center">
				<p class="text-lg font-semibold text-gray-400">{stats.doCount.toLocaleString('pl-PL')}</p>
				<p class="text-[10px] text-gray-400 mt-0.5">do przegrania</p>
			</div>
		</div>

		<!-- Change password -->
		<div class="space-y-3">
			<p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Zmień hasło</p>
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Nowe hasło</label>
				<input type="password" bind:value={newPassword} placeholder="min. 6 znaków"
					autocomplete="new-password"
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300" />
			</div>
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Powtórz hasło</label>
				<input type="password" bind:value={confirmPassword} placeholder="powtórz nowe hasło"
					autocomplete="new-password"
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300" />
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
			<p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Zmień e-mail</p>
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Nowy adres e-mail</label>
				<input type="email" bind:value={newEmail} placeholder="nowy@email.com"
					autocomplete="email"
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300" />
			</div>
			{#if emailMsg}
				<p class="text-xs {emailMsg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}">{emailMsg}</p>
			{/if}
			<button onclick={changeEmail} disabled={savingEmail}
				class="w-full py-3 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
				style="background:#00B0F0">
				{savingEmail ? 'Wysyłanie...' : 'Zmień e-mail'}
			</button>
			<p class="text-[11px] text-gray-300 text-center">
				Link potwierdzający zostanie wysłany na nowy adres.
			</p>
		</div>

		<!-- Sign out -->
		<div class="pt-2 border-t border-gray-100">
			<button onclick={handleSignOut}
				class="w-full py-3 text-sm text-gray-400 hover:text-gray-600">
				Wyloguj się
			</button>
		</div>

	</div>
</div>

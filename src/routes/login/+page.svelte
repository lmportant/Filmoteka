<script>
	import { goto } from '$app/navigation';
	import { signIn, user } from '$lib/auth.js';
	import { supabase } from '$lib/supabase.js';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state('');
	let showPassword = $state(false);

	let showRequest = $state(false);
	let requestEmail = $state('');
	let requestMessage = $state('');
	let requesting = $state(false);
	let requestMsg = $state('');

	onMount(() => {
		const unsub = user.subscribe((u) => {
			if (u) goto('/');
		});
		return unsub;
	});

	async function submit() {
		error = '';
		if (!email.trim() || !password.trim()) { error = 'Wypełnij oba pola.'; return; }
		submitting = true;
		const err = await signIn(email.trim(), password);
		if (err) { error = translateError(err); submitting = false; }
	}

	async function submitRequest() {
		requestMsg = '';
		const trimmed = requestEmail.trim();
		if (!trimmed || !trimmed.includes('@')) { requestMsg = 'Wpisz prawidłowy adres e-mail.'; return; }
		requesting = true;
		const { error: err } = await supabase.from('access_requests').insert({
			email: trimmed,
			message: requestMessage.trim() || null
		});
		requesting = false;
		if (err) { requestMsg = 'Błąd: ' + err.message; }
		else { requestMsg = '✓ Prośba wysłana. Odezwiemy się wkrótce.'; requestEmail = ''; requestMessage = ''; }
	}

	function translateError(msg) {
		if (msg.includes('Invalid login credentials')) return 'Nieprawidłowy e-mail lub hasło.';
		if (msg.includes('Password should be')) return 'Hasło musi mieć co najmniej 6 znaków.';
		if (msg.includes('rate limit')) return 'Zbyt wiele prób. Poczekaj chwilę.';
		if (msg.includes('Email not confirmed')) return 'Potwierdź adres e-mail przed zalogowaniem.';
		return msg;
	}
</script>

<div class="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-6">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Filmoteka</h1>
			<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Twoja kolekcja filmów</p>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-3">
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">E-mail</label>
				<input type="email" bind:value={email} placeholder="twoj@email.com" autocomplete="email"
					class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
			</div>
			<div>
				<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Hasło</label>
				<div class="relative">
					<input type={showPassword ? 'text' : 'password'} bind:value={password} placeholder="hasło" autocomplete="current-password"
						class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 pr-11 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
					<button type="button" onclick={() => showPassword = !showPassword}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1">
						{#if showPassword}
							<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}
			<button type="submit" disabled={submitting}
				class="w-full py-3.5 rounded-2xl font-medium text-white text-sm mt-2 disabled:opacity-40 transition-opacity"
				style="background:#00B0F0">
				{submitting ? 'Logowanie...' : 'Zaloguj się'}
			</button>
		</form>

		<div class="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
			<button onclick={() => { showRequest = !showRequest; requestMsg = ''; }}
				class="w-full text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-center transition-colors">
				{showRequest ? '← Wróć do logowania' : 'Nie masz dostępu? Wyślij prośbę →'}
			</button>

			{#if showRequest}
				<div class="mt-4 space-y-3">
					<div>
						<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Twój e-mail</label>
						<input type="email" bind:value={requestEmail} placeholder="twoj@email.com"
							class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600" />
					</div>
					<div>
						<label class="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Wiadomość (opcjonalnie)</label>
						<textarea bind:value={requestMessage} placeholder="Dlaczego chcesz uzyskać dostęp?" rows="2"
							class="w-full text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 dark:placeholder-gray-600 resize-none"></textarea>
					</div>
					{#if requestMsg}
						<p class="text-sm {requestMsg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}">{requestMsg}</p>
					{/if}
					<button onclick={submitRequest} disabled={requesting}
						class="w-full py-3 rounded-2xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
						style="background:#6366f1">
						{requesting ? 'Wysyłanie...' : 'Wyślij prośbę o dostęp'}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<script>
	import { goto } from '$app/navigation';
	import { signIn, user } from '$lib/auth.js';
	import { supabase } from '$lib/supabase.js';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state('');

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
		if (!email.trim() || !password.trim()) {
			error = 'Wypełnij oba pola.';
			return;
		}
		submitting = true;
		const err = await signIn(email.trim(), password);
		if (err) {
			error = translateError(err);
			submitting = false;
		}
	}

	async function submitRequest() {
		requestMsg = '';
		const trimmed = requestEmail.trim();
		if (!trimmed || !trimmed.includes('@')) {
			requestMsg = 'Wpisz prawidłowy adres e-mail.';
			return;
		}
		requesting = true;
		const { error: err } = await supabase.from('access_requests').insert({
			email: trimmed,
			message: requestMessage.trim() || null
		});
		requesting = false;
		if (err) {
			requestMsg = 'Błąd: ' + err.message;
		} else {
			requestMsg = '✓ Prośba wysłana. Odezwiemy się wkrótce.';
			requestEmail = '';
			requestMessage = '';
		}
	}

	function translateError(msg) {
		if (msg.includes('Invalid login credentials')) return 'Nieprawidłowy e-mail lub hasło.';
		if (msg.includes('Password should be')) return 'Hasło musi mieć co najmniej 6 znaków.';
		if (msg.includes('rate limit')) return 'Zbyt wiele prób. Poczekaj chwilę.';
		if (msg.includes('Email not confirmed')) return 'Potwierdź adres e-mail przed zalogowaniem.';
		return msg;
	}
</script>

<div class="min-h-screen bg-white flex flex-col items-center justify-center px-6">
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="text-center mb-8">
			<h1 class="text-2xl font-semibold text-gray-900">Filmoteka</h1>
			<p class="text-sm text-gray-400 mt-1">Twoja kolekcja filmów</p>
		</div>

		<!-- Login form -->
		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-3">
			<div>
				<label class="text-xs text-gray-400 mb-1 block">E-mail</label>
				<input
					type="email"
					bind:value={email}
					placeholder="twoj@email.com"
					autocomplete="email"
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300"
				/>
			</div>
			<div>
				<label class="text-xs text-gray-400 mb-1 block">Hasło</label>
				<input
					type="password"
					bind:value={password}
					placeholder="hasło"
					autocomplete="current-password"
					class="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300"
				/>
			</div>

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full py-3.5 rounded-2xl font-medium text-white text-sm mt-2 disabled:opacity-40 transition-opacity"
				style="background:#00B0F0"
			>
				{submitting ? 'Logowanie...' : 'Zaloguj się'}
			</button>
		</form>

		<!-- Access request -->
		<div class="mt-8 pt-6 border-t border-gray-100">
			<button
				onclick={() => { showRequest = !showRequest; requestMsg = ''; }}
				class="w-full text-sm text-gray-400 hover:text-gray-600 text-center transition-colors"
			>
				{showRequest ? '← Wróć do logowania' : 'Nie masz dostępu? Wyślij prośbę →'}
			</button>

			{#if showRequest}
				<div class="mt-4 space-y-3">
					<div>
						<label class="text-xs text-gray-400 mb-1 block">Twój e-mail</label>
						<input
							type="email"
							bind:value={requestEmail}
							placeholder="twoj@email.com"
							class="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300"
						/>
					</div>
					<div>
						<label class="text-xs text-gray-400 mb-1 block">Wiadomość (opcjonalnie)</label>
						<textarea
							bind:value={requestMessage}
							placeholder="Dlaczego chcesz uzyskać dostęp?"
							rows="2"
							class="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00B0F0]/30 placeholder-gray-300 resize-none"
						></textarea>
					</div>
					{#if requestMsg}
						<p class="text-sm {requestMsg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}">{requestMsg}</p>
					{/if}
					<button
						onclick={submitRequest}
						disabled={requesting}
						class="w-full py-3 rounded-2xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
						style="background:#6366f1"
					>
						{requesting ? 'Wysyłanie...' : 'Wyślij prośbę o dostęp'}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

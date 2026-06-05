<script>
	import { goto } from '$app/navigation';
	import { signIn, signUp, user } from '$lib/auth.js';
	import { onMount } from 'svelte';

	let mode = $state('login'); // 'login' | 'register'
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state('');

	// Already logged in — bounce to home
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
		if (password.length < 6) {
			error = 'Hasło musi mieć co najmniej 6 znaków.';
			return;
		}
		submitting = true;

		const err =
			mode === 'login'
				? await signIn(email.trim(), password)
				: await signUp(email.trim(), password);

		if (err) {
			error = translateError(err);
			submitting = false;
		}
		// On success: onAuthStateChange in auth.js updates the session store,
		// which triggers the layout guard and redirects to /
	}

	function translateError(msg) {
		if (msg.includes('Invalid login credentials')) return 'Nieprawidłowy e-mail lub hasło.';
		if (msg.includes('User already registered')) return 'Ten e-mail jest już zarejestrowany.';
		if (msg.includes('Password should be')) return 'Hasło musi mieć co najmniej 6 znaków.';
		if (msg.includes('rate limit')) return 'Zbyt wiele prób. Poczekaj chwilę.';
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

		<!-- Mode tabs -->
		<div class="flex bg-gray-100 rounded-xl p-1 mb-6">
			{#each [['login', 'Zaloguj się'], ['register', 'Utwórz konto']] as [val, label]}
				<button
					onclick={() => { mode = val; error = ''; }}
					class="flex-1 py-2 text-sm rounded-lg transition-colors font-medium {mode === val
						? 'bg-white text-gray-900 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'}"
				>
					{label}
				</button>
			{/each}
		</div>

		<!-- Form -->
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
					placeholder="min. 6 znaków"
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
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
				{#if submitting}
					{mode === 'login' ? 'Logowanie...' : 'Tworzenie konta...'}
				{:else}
					{mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
				{/if}
			</button>
		</form>
	</div>
</div>

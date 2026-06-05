import { writable, derived } from 'svelte/store';
import { supabase } from './supabase.js';
import { browser } from '$app/environment';

export const session = writable(null);
export const user = derived(session, ($s) => $s?.user ?? null);
export const authLoading = writable(true);

export async function initAuth() {
	if (!browser) return;
	const { data } = await supabase.auth.getSession();
	session.set(data.session);
	authLoading.set(false);

	supabase.auth.onAuthStateChange((_, newSession) => {
		session.set(newSession);
	});
}

export async function signIn(email, password) {
	const { error } = await supabase.auth.signInWithPassword({ email, password });
	return error?.message ?? null;
}

export async function signUp(email, password) {
	const { error } = await supabase.auth.signUp({ email, password });
	return error?.message ?? null;
}

export async function signOut() {
	await supabase.auth.signOut();
}

// One-time migration: claim all movies/locations with no user_id
export async function claimExistingData(userId) {
	const { count } = await supabase
		.from('movies')
		.select('*', { count: 'exact', head: true })
		.is('user_id', null);

	if (count && count > 0) {
		await supabase.from('movies').update({ user_id: userId }).is('user_id', null);
		await supabase.from('locations').update({ user_id: userId }).is('user_id', null);
	}
}

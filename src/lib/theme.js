import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const KEY = 'filmoteka-theme';

function prefersDark() {
	return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark) {
	document.documentElement.classList.toggle('dark', dark);
}

const stored = browser ? localStorage.getItem(KEY) : null;
const initialDark = stored !== null ? stored === 'dark' : prefersDark();

export const isDark = writable(initialDark);

export function initTheme() {
	if (!browser) return;
	applyDark(initialDark);

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
		if (localStorage.getItem(KEY) === null) {
			isDark.set(e.matches);
			applyDark(e.matches);
		}
	});
}

export function toggleTheme() {
	isDark.update((dark) => {
		const next = !dark;
		localStorage.setItem(KEY, next ? 'dark' : 'light');
		applyDark(next);
		return next;
	});
}

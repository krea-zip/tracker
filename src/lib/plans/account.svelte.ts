import { getSupabase } from '$lib/supabase/browser';
import { saveBoard } from './autosave';

export async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	const response = await fetch(path, {
		method,
		cache: 'no-store',
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
	return data as T;
}

class Account {
	user = $state<{ id: string; email: string } | null>(null);
	eligible = $state(false);
	configured = $state(false);
	loading = $state(true);
	busy = $state(false);
	error = $state('');
	#request = 0;

	async refresh() {
		const request = ++this.#request;
		try {
			const data = await accountRequest<{
				configured: boolean;
				user: { id: string; email: string } | null;
				eligible: boolean;
			}>('/api/account');
			if (request !== this.#request) return;
			this.user = data.user;
			this.eligible = data.eligible;
			this.configured = data.configured;
		} catch {
			if (request !== this.#request) return;
			this.user = null;
			this.eligible = false;
			this.error = 'Your account could not be checked. Your browser draft is safe; try again.';
		} finally {
			if (request === this.#request) this.loading = false;
		}
	}

	async signIn(snapshot?: Record<string, unknown>, returnTo = location.pathname + location.search + location.hash) {
		this.error = '';
		this.busy = true;
		try {
			if (snapshot && !saveBoard(localStorage, JSON.stringify(snapshot))) {
				throw new Error('Your browser could not keep this draft. Export a PDF or copy it as text before signing in.');
			}
			const client = await getSupabase();
			const callback = new URL('/auth/callback', location.origin);
			sessionStorage.setItem('tracker-auth-return', returnTo);
			const { error } = await client.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: callback.href,
					queryParams: { hd: 'krea.ac.in', prompt: 'select_account' }
				}
			});
			if (error) throw error;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Google sign-in could not start.';
		} finally {
			this.busy = false;
		}
	}

	async signOut() {
		this.busy = true;
		this.error = '';
		try {
			const client = await getSupabase();
			const { error } = await client.auth.signOut({ scope: 'local' });
			if (error) throw error;
			++this.#request;
			this.user = null;
			this.eligible = false;
		} catch {
			this.error = 'Sign-out failed. Please try again.';
		} finally {
			this.busy = false;
		}
	}
}

export const account = new Account();

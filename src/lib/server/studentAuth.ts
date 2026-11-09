import { createServerClient } from '@supabase/ssr';
import { error, type RequestEvent } from '@sveltejs/kit';
import { supabaseConfig } from '$lib/supabase/config';
import type { Database } from '$lib/supabase/database.types';

export function studentClient(event: RequestEvent) {
	const config = supabaseConfig();
	if (!config) error(503, 'Google sign-in is not available on this site yet. You can keep planning as a guest.');
	event.setHeaders({ 'cache-control': 'private, no-store' });
	return createServerClient<Database>(config.url, config.key, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) =>
				cookies.forEach(({ name, value, options }) => event.cookies.set(name, value, { ...options, path: '/' }))
		}
	});
}

export async function studentAccount(event: RequestEvent) {
	const client = studentClient(event);
	const {
		data: { user },
		error: authError
	} = await client.auth.getUser();
	if (authError || !user) return { client, user: null, eligible: false };
	// Eligibility comes from verified auth identities, never editable user metadata.
	const { data, error: eligibilityError } = await client.rpc('can_review');
	if (eligibilityError) error(503, 'Account access could not be checked. Please try again.');
	return { client, user, eligible: data === true };
}

export async function requireStudent(event: RequestEvent) {
	const account = await studentAccount(event);
	if (!account.user) error(401, 'Sign in with your Krea Google account to continue.');
	if (!account.eligible) error(403, 'Use your @krea.ac.in Google account to continue.');
	return { ...account, user: account.user };
}

export async function requestDocument(event: RequestEvent): Promise<Record<string, unknown>> {
	// Cookie-authenticated writes must originate from this site.
	if (event.request.headers.get('origin') !== event.url.origin) error(403, 'Please make this request from tracker.');
	if (Number(event.request.headers.get('content-length')) > 300_000) error(413, 'This plan is too large.');
	const text = await event.request.text();
	if (new TextEncoder().encode(text).length > 300_000) error(413, 'This plan is too large.');
	try {
		const body = JSON.parse(text);
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
		return body;
	} catch {
		error(400, 'This request could not be read.');
	}
}

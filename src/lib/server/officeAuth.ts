// the academic office's sign-in: one shared password (ADMIN_PASSWORD in
// vercel) and the name the person types, kept in a signed, http-only
// cookie for a week. the signing key comes from the password, so changing
// the password signs everyone out.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'tracker_office';
const WEEK = 7 * 24 * 60 * 60;
export const NAME_MAX = 60;

const sha256 = (text: string) => createHash('sha256').update(text).digest();
const sign = (password: string, payload: string) =>
	createHmac('sha256', sha256(`tracker-office-session\0${password}`))
		.update(payload)
		.digest('base64url');

/** the typed password against the real one, in constant time */
export function passwordMatches(password: string, given: string) {
	return timingSafeEqual(sha256(password), sha256(given));
}

/** the cookie's value: who, until when, and a signature over both */
function sessionValue(password: string, name: string, now = Date.now()) {
	const payload = Buffer.from(JSON.stringify({ name, exp: now + WEEK * 1000 })).toString('base64url');
	return `${payload}.${sign(password, payload)}`;
}

/** the name in a session cookie, or null when it's missing, forged or expired */
function sessionName(password: string, value: string | undefined, now = Date.now()): string | null {
	const [payload, signature] = value?.split('.') ?? [];
	if (!payload || !signature) return null;
	const expected = Buffer.from(sign(password, payload));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
	try {
		const { name, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
		return typeof name === 'string' && typeof exp === 'number' && exp > now ? name : null;
	} catch {
		return null;
	}
}

export function signIn(cookies: Cookies, password: string, name: string) {
	cookies.set(COOKIE, sessionValue(password, name), { path: '/', httpOnly: true, sameSite: 'lax', maxAge: WEEK });
}

export const signedInName = (cookies: Cookies, password: string) => sessionName(password, cookies.get(COOKIE));

export const signOut = (cookies: Cookies) => cookies.delete(COOKIE, { path: '/' });

// A plan shared as a link: the planning state, deflated and base64url-encoded
// into the URL fragment, so it never reaches a server. Grades stay out, they
// are the student's own record, not part of the plan they're showing someone.
import type { Json } from '$lib/supabase/database.types';
import { planDocument } from './document';

const PREFIX = '#plan=';
/** a link this long is already far past any real plan */
const MAX_ENCODED = 12_000;

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
	const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
	return new Uint8Array(await new Response(piped).arrayBuffer());
}

const fromBase64Url = (text: string) =>
	Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** the encoded plan in a URL fragment, if it carries one */
export const sharedPlanIn = (hash: string): string | null =>
	hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null;

/** Unpack and validate a shared plan. Courses are checked against the
 *  current curriculum when the plan is opened (Plan.restore). */
export async function readSharedPlan(encoded: string): Promise<Json> {
	if (!encoded || encoded.length > MAX_ENCODED || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
		throw new Error('This share link is incomplete or damaged.');
	}
	let text: string;
	try {
		text = new TextDecoder().decode(await through(fromBase64Url(encoded), new DecompressionStream('deflate-raw')));
	} catch {
		throw new Error('This share link is incomplete or damaged.');
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error('This share link is incomplete or damaged.');
	}
	return planDocument(value && typeof value === 'object' ? { picks: {}, ...value } : value);
}

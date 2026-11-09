// ─────────────────────────────────────────────
// Catalogue prose, the one big field that isn't in the first-load bundle.
// The descriptions are ~60% of the course data and are read by exactly one
// panel, so they arrive in their own chunk after the app is interactive
// (written by `npm run curriculum:pull`). The details panel simply has no "about"
// paragraph for the second or two before it lands.
// ─────────────────────────────────────────────

import { browser } from '$app/environment';
import { runtimeSnapshot } from './runtime';

let descriptions = $state<Record<string, string> | null>(null);
let started = false;
// the office's student preview carries its own descriptions
const previewed = runtimeSnapshot()?.descriptions;

/** start fetching the descriptions chunk, safe to call as often as you like */
export function loadDescriptions() {
	if (started || !browser) return;
	started = true;
	if (previewed) return void (descriptions = previewed);
	import('$lib/data/course-descriptions.json').then((m) => (descriptions = m.default)).catch(() => (started = false)); // offline / chunk 404 → try again next time
}

export const descriptionOf = (code: string): string | undefined => descriptions?.[code] || undefined;

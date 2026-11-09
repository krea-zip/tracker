// the office's "student preview": a staff member opens the planner from the
// academic office with ?admin-preview=1, and the unsaved draft (handed over
// in session storage, see Workspace.preview) stands in for the published
// catalogue in that tab only. everyone else always gets the published one.
import { browser } from '$app/environment';
import type { CurriculumSnapshot } from './snapshot';

export const PREVIEW_KEY = 'tracker-office-preview';

export type PreviewSnapshot = CurriculumSnapshot & { descriptions?: Record<string, string> };

/** the draft being previewed in this tab, or null */
export function previewSnapshot(): PreviewSnapshot | null {
	if (!browser || !new URLSearchParams(location.search).has('admin-preview')) return null;
	try {
		const raw = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) ?? 'null');
		return raw && raw.format === 1 && Array.isArray(raw.courses) ? raw : null;
	} catch {
		return null;
	}
}

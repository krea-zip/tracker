// a saved plan comes from an older build, another browser or a pasted link, so
// nothing in it is trusted: each piece is checked against the current catalogue.
// a null means the save has no usable value there, and the plan keeps its own.
import { hasCode, isCore } from '$lib/curriculum/data';
import { parseSlot, type SlotKey } from '$lib/types';
import type { Here } from './calendar';
import { isGradeMark, type GradeMark } from './grades/grades';
import { coreOnly, isBreakKind, MAX_YEARS, type BreakInfo } from './structure';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** breaks: a known kind on a real trimester, an away term's credits a
 *  sensible number */
export function cleanBreaks(raw: unknown): Record<SlotKey, BreakInfo> | null {
	if (!isObject(raw)) return null;
	const out: Record<SlotKey, BreakInfo> = {};
	for (const [key, b] of Object.entries(raw)) {
		const { year, trim } = parseSlot(key);
		if (!(year >= 1 && year <= MAX_YEARS) || ![1, 2, 3].includes(trim)) continue;
		if (!b || typeof b !== 'object' || !isBreakKind((b as BreakInfo).kind)) continue;
		const credits = (b as BreakInfo).credits;
		out[key] = {
			kind: (b as BreakInfo).kind,
			...((b as BreakInfo).kind === 'away' && typeof credits === 'number' && credits >= 0 && credits <= 40
				? { credits: Math.round(credits) }
				: {})
		};
	}
	return out;
}

export function cleanNow(raw: unknown): Here | null {
	const now = raw as { year?: unknown; trim?: unknown } | null | undefined;
	return now &&
		typeof now.year === 'number' &&
		now.year >= 1 &&
		now.year <= MAX_YEARS &&
		(now.trim === 1 || now.trim === 2 || now.trim === 3)
		? { year: now.year, trim: now.trim }
		: null;
}

/** placements against the current catalogue, null when it isn't one at all */
export function cleanPlacements(raw: unknown): Record<SlotKey, string[]> | null {
	if (!isObject(raw)) return null;
	const placements: Record<SlotKey, string[]> = {};
	for (const [key, codes] of Object.entries(raw)) {
		const { year, trim } = parseSlot(key);
		if (!(year >= 1 && year <= MAX_YEARS) || ![1, 2, 3].includes(trim)) continue;
		if (!Array.isArray(codes)) continue;
		let valid = codes.filter((c): c is string => typeof c === 'string' && hasCode(c));
		// year-1 t1/t2 hold only foundation courses (an over-max slot
		// is kept as-is, the hints flag it rather than dropping data)
		if (coreOnly(year, trim)) valid = valid.filter(isCore);
		if (valid.length) placements[key] = valid;
	}
	return placements;
}

/** where courses sit on the zoomed credit canvas */
export function cleanZoomPos(raw: unknown): Record<string, number> | null {
	if (!isObject(raw)) return null;
	const pos: Record<string, number> = {};
	for (const [code, cell] of Object.entries(raw)) {
		if (hasCode(code) && typeof cell === 'number' && cell >= 0 && cell < 24) pos[code] = cell;
	}
	return pos;
}

export function cleanGrades(raw: unknown): Record<string, GradeMark> | null {
	if (!isObject(raw)) return null;
	const grades: Record<string, GradeMark> = {};
	for (const [code, mark] of Object.entries(raw)) if (hasCode(code) && isGradeMark(mark)) grades[code] = mark;
	return grades;
}

/** per-course "counts toward" choices: real courses, subject ids, never empty */
export function cleanCountsToward(raw: unknown): Record<string, string[]> | null {
	if (!isObject(raw)) return null;
	const out: Record<string, string[]> = {};
	for (const [code, subjects] of Object.entries(raw)) {
		if (!hasCode(code) || !Array.isArray(subjects)) continue;
		const ok = subjects.filter((s): s is string => typeof s === 'string');
		if (ok.length) out[code] = ok;
	}
	return out;
}

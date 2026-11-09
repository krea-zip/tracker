// edits made in the old admin pages, which lived only in the browser that
// made them. the office offers them once, in that browser, as additions to
// the draft, then clears them. once nobody has any left, delete this file
// and OldEditsNotice.svelte.
import { variantOf, type CreditShare, type Lecturer, type Variant } from '$lib/curriculum/snapshot';
import type { ProgrammeRole, Subject } from '$lib/types';
import { newCourse, type OfficeDocument } from './model';
import type { RuleKey } from './policies';

const KEYS = {
	courses: 'tracker-course-edits',
	newCourses: 'tracker-new-courses',
	rules: 'tracker-rule-edits',
	share: 'tracker-credit-sharing',
	prereqs: 'tracker-prereq-edits',
	batches: 'tracker-batch-edits',
	descriptions: 'tracker-description-edits',
	lecturers: 'tracker-lecturer-edits',
	subjects: 'tracker-subject-edits',
	programmes: 'tracker-programme-edits'
} as const;

type Raw = Record<string, unknown>;
export type OldEdits = Partial<Record<keyof typeof KEYS, unknown>>;

const isObject = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const entries = (v: unknown): [string, Raw][] =>
	isObject(v) ? (Object.entries(v).filter(([, x]) => isObject(x)) as [string, Raw][]) : [];
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
const numbers = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => Number.isFinite(x)) : undefined);

/** whatever old edits this browser still holds, or null */
export function findOldEdits(): OldEdits | null {
	const found: OldEdits = {};
	for (const [name, key] of Object.entries(KEYS)) {
		try {
			const raw = localStorage.getItem(key);
			if (raw) found[name as keyof typeof KEYS] = JSON.parse(raw);
		} catch {
			// unreadable leftovers are simply cleared with the rest
		}
	}
	return Object.keys(found).length ? found : null;
}

export function clearOldEdits() {
	for (const key of Object.values(KEYS)) localStorage.removeItem(key);
}

/** lay the old edits over the draft; returns how many records changed */
export function applyOldEdits(doc: OfficeDocument, old: OldEdits): number {
	const c = doc.curriculum;
	let changed = 0;
	const course = (code: string) => c.courses.find((x) => x.code === code);

	for (const [code, n] of entries(old.newCourses))
		if (!course(code) && typeof n.title === 'string' && typeof n.subject === 'string') {
			c.courses.push(newCourse(code, n.title, n.subject));
			changed++;
		}

	for (const [code, edit] of entries(old.courses)) {
		const target = course(code);
		if (!target) continue;
		if (typeof edit.title === 'string') target.title = edit.title;
		if (Number.isFinite(edit.credits)) target.credits = edit.credits as number;
		if (typeof edit.required === 'boolean') target.required = edit.required;
		if (typeof edit.faculty === 'string') target.faculty = edit.faculty;
		if (edit.retired === true) target.retired = true;
		const offered = numbers(edit.offered);
		if (offered) target.offered = offered.filter((t) => t >= 1 && t <= 3) as (1 | 2 | 3)[];
		const years = numbers(edit.eligibleYears);
		if (years) target.eligibleYears = years;
		// a cross-listing replaced whole; the course's own department stays
		if (isObject(edit.codesBySubject)) {
			const map = { ...(edit.codesBySubject as Record<string, string>), [target.subject]: target.code };
			target.codesBySubject = map;
			target.subjects = [target.subject, ...Object.keys(map).filter((s) => s !== target.subject)];
			target.codes = [target.code, ...new Set(Object.values(map).filter((x) => x !== target.code))];
		}
		changed++;
	}

	if (isObject(old.prereqs))
		for (const [code, list] of Object.entries(old.prereqs)) {
			const target = course(code);
			const prereqs = strings(list);
			if (target && prereqs) {
				target.prereqs = prereqs.filter((p) => p !== code);
				changed++;
			}
		}

	if (isObject(old.rules))
		for (const [key, value] of Object.entries(old.rules))
			if (key in c.rules && Number.isFinite(value)) {
				c.rules[key as RuleKey] = value as number;
				changed++;
			}

	if (old.share === 'one' || old.share === 'all') {
		c.creditSharing = old.share as CreditShare;
		changed++;
	}

	if (isObject(old.descriptions))
		for (const [code, text] of Object.entries(old.descriptions))
			if (typeof text === 'string') {
				doc.descriptions[code] = text;
				changed++;
			}

	const lecturers = isObject(old.lecturers) ? old.lecturers : {};
	for (const [id, fields] of entries(lecturers.edited)) {
		const target = c.lecturers.find((l) => l.id === id);
		if (target) (Object.assign(target, fields), changed++);
	}
	for (const [id, person] of entries(lecturers.added))
		if (!c.lecturers.some((l) => l.id === id))
			(c.lecturers.push({ ...(person as unknown as Lecturer), id }), changed++);
	const removed = new Set(strings(lecturers.removed) ?? []);
	if (removed.size) ((c.lecturers = c.lecturers.filter((l) => !removed.has(l.id))), (changed += removed.size));
	if (isObject(lecturers.teaches))
		for (const [code, ids] of Object.entries(lecturers.teaches)) {
			const target = course(code);
			const list = strings(ids);
			if (target && list) ((target.lecturers = list), changed++);
		}

	const subjects = isObject(old.subjects) ? old.subjects : {};
	for (const [id, fields] of entries(subjects.edited)) {
		const target = c.subjects.find((s) => s.id === id);
		if (target) (Object.assign(target, fields), changed++);
	}
	for (const [id, subject] of entries(subjects.added))
		if (!c.subjects.some((s) => s.id === id)) (c.subjects.push({ ...(subject as unknown as Subject), id }), changed++);

	// "set|subject|variant" → that programme in that requirement set
	for (const [key, edit] of entries(old.programmes)) {
		const [setId, subject, variant] = key.split('|') as [string, string, Variant];
		const set = c.requirementSets.find((s) => s.id === setId);
		if (!set) continue;
		let p = set.programmes.find((x) => x.subject === subject && x.variant === variant);
		if (!p)
			set.programmes.push(
				(p = {
					subject,
					variant,
					credits: { total: 0, required: null, elective: null },
					required: [],
					picks: [],
					electives: [],
					choices: [],
					pathway: []
				})
			);
		if (Number.isFinite(edit.total)) p.credits.total = edit.total as number;
		if (edit.required === null || Number.isFinite(edit.required)) p.credits.required = edit.required as number | null;
		if (edit.elective === null || Number.isFinite(edit.elective)) p.credits.elective = edit.elective as number | null;
		p.required = strings(edit.requiredCourses) ?? p.required;
		p.electives = strings(edit.electives) ?? p.electives;
		changed++;
	}

	// '[year, subject, role, fourYear, double]' → that batch's rule record
	for (const [key, rule] of entries(old.batches)) {
		try {
			const [batch, subject, role, fourYear, double] = JSON.parse(key) as [
				number,
				string,
				ProgrammeRole,
				boolean,
				boolean
			];
			const variant = variantOf(role, fourYear, double);
			const courses = isObject(rule.courses) ? (rule.courses as Record<string, 'required' | 'elective'>) : {};
			const requiredCredits = Number.isFinite(rule.requiredCredits) ? (rule.requiredCredits as number) : undefined;
			const existing = c.batchRules.find((r) => r.batch === batch && r.subject === subject && r.variant === variant);
			if (existing) (Object.assign(existing.courses, courses), (existing.requiredCredits ??= requiredCredits));
			else c.batchRules.push({ batch, subject, variant, courses, requiredCredits });
			changed++;
		} catch {
			// a key this importer can't read is skipped
		}
	}

	return changed;
}

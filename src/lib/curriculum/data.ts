// ─────────────────────────────────────────────
// The curriculum at runtime: indexes over the compiled snapshot and the
// questions the planner asks of it. Nothing here reconciles source data,
// that is the compiler's job (curriculum/compiler.ts). The catalogue is the
// published release this build pulled, or, in the office's student preview,
// the draft being previewed (curriculum/preview.ts).
// ─────────────────────────────────────────────

import snapshotData from '$lib/data/curriculum.json';
import { runtimeSnapshot } from './runtime';
import {
	subjectOffered,
	variantOf,
	type ChoiceGroup,
	type CreditShare,
	type CurriculumSnapshot,
	type Lecturer,
	type ProgrammeRequirements,
	type RequirementSet,
	type SnapshotCourse,
	type Variant
} from './snapshot';
import type { Course, ProgrammeRole, Subject, TrimNum } from '$lib/types';

export type { ChoiceCourse, ChoiceGroup } from './snapshot';

const snapshot: CurriculumSnapshot = runtimeSnapshot() ?? (snapshotData as unknown as CurriculumSnapshot);
export const PREVIEWING = snapshot !== (snapshotData as unknown);

/** when the catalogue was last rebuilt from the term sheets */
export const DATA_UPDATED = snapshot.updatedOn ? new Date(snapshot.updatedOn) : null;

// ── Subjects ──

export const SUBJECTS: Subject[] = snapshot.subjects;
export const MAJOR_SUBJECTS: Subject[] = SUBJECTS.filter((s) => s.majorable);
/** what the minor/concentration pickers offer: every real subject, not the
 *  foundation core, nor the open minor (offered separately, minor slot only) */
export const PROGRAMME_SUBJECTS: Subject[] = SUBJECTS.filter((s) => s.id !== 'core' && s.id !== 'open');
export const OPEN_MINOR: Subject = SUBJECTS.find((s) => s.id === 'open')!;
const OPEN_MINOR_CREDITS = 24; // a minor-sized allowance of free courses

const batchProfiles = snapshot.batchProfiles ?? [];
/** can this batch take the subject in this role (see subjectOffered) */
export const offeredTo = (subject: Subject, role: ProgrammeRole, batch: number) =>
	subjectOffered(subject, role, batch, batchProfiles);

/** the batches a student can say they're in: the first with requirement data
 *  through this year's, or further if the office has planned ahead */
const LAST_BATCH = Math.max(
	new Date().getFullYear(),
	...batchProfiles.map((p) => p.batch),
	...snapshot.requirementSets.flatMap((s) => s.batches ?? [])
);
export const STUDENT_BATCHES: number[] = Array.from({ length: LAST_BATCH - 2021 }, (_, i) => 2022 + i);

export const subjectById = (id: string): Subject => {
	const s = SUBJECTS.find((s) => s.id === id);
	if (!s) throw new Error(`unknown subject: ${id}`);
	return s;
};

// ── The drop form's numbers, university-wide, set in the office's policies ──

const RULES = snapshot.rules;
export const TRIM_MIN = RULES.TRIM_MIN; // minimum credits per trimester (full-time status)
export const TRIM_NORMAL_MAX = RULES.TRIM_NORMAL_MAX; // recommended load, four 4-credit courses
export const TRIM_STANDARD_MAX = RULES.TRIM_STANDARD_MAX; // above this a trimester is heavy …
export const TRIM_HARD_MAX = RULES.TRIM_HARD_MAX; // absolute cap (a fifth course) …
export const HEAVY_TRIMS_ALLOWED = RULES.HEAVY_TRIMS_ALLOWED; // … allowed this many terms in the whole tenure
export const AUDIT_LIMIT = RULES.AUDIT_LIMIT; // audits allowed over the whole degree
export const MIN_TOTAL_3YR = RULES.MIN_TOTAL_3YR; // credits to graduate, three-year programme
export const MIN_TOTAL_4YR = RULES.MIN_TOTAL_4YR; // credits to graduate, four-year programme
export const MAX_TOTAL_3YR = RULES.MAX_TOTAL_3YR; // total-credit ceiling, three-year programme
// a double major in three years may stretch the ceiling (132); a release
// from before the rule existed keeps the plain one
export const MAX_TOTAL_3YR_DOUBLE = RULES.MAX_TOTAL_3YR_DOUBLE ?? RULES.MAX_TOTAL_3YR;
export const MAX_TOTAL_4YR = RULES.MAX_TOTAL_4YR; // total-credit ceiling, four-year programme
/** the most credits a tenure may hold: the degree length's ceiling, which a
 *  three-year double major may stretch */
export const creditCeilingFor = (fourYear: boolean, isDouble: boolean): number =>
	fourYear ? MAX_TOTAL_4YR : isDouble ? MAX_TOTAL_3YR_DOUBLE : MAX_TOTAL_3YR;

// ── Courses ──

/** how a course that satisfies more than one of a student's programmes is
 *  credited when it carries no override of its own, see Course.share */
export const CREDIT_SHARE_DEFAULT: CreditShare = snapshot.creditSharing ?? 'one';

const toCourse = ({ terms: _terms, lecturers: _lecturers, ...c }: SnapshotCourse): Course => ({
	...c,
	subjects: [...c.subjects],
	codes: [...c.codes],
	codesBySubject: { ...c.codesBySubject },
	offered: [...c.offered],
	eligibleYears: [...c.eligibleYears],
	prereqs: [...c.prereqs],
	unlocks: []
});

/** every course, retired ones included, for importers that meet old codes */
const ALL_COURSES: Course[] = snapshot.courses.map(toCourse);

/** the live catalogue, everything the planner can show and place */
export const COURSES: Course[] = ALL_COURSES.filter((c) => !c.retired);

// ── Capstones ──
// a department document can promise a capstone project (literature: 12
// credits in place of three electives) that has no catalogue code yet. each
// department whose programmes state one gets a stand-in the planner can
// place in a final year. it is the planner's alone: the public site and the
// office's course list never see it, so neither needs a made-up code.

/** the letters a department's codes start with, LITT for literature */
const prefixOf = (subject: string): string => {
	const counts = new Map<string, number>();
	for (const c of COURSES) {
		const prefix = c.codesBySubject[subject]?.match(/^[A-Z]+/)?.[0];
		if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? subject.slice(0, 4).toUpperCase();
};

const capstoneCredits = new Map<string, number>();
for (const set of snapshot.requirementSets)
	for (const p of set.programmes) if (p.capstone) capstoneCredits.set(p.subject, p.capstone.credits);

/** the placeable stand-ins, one per department that offers a capstone */
export const CAPSTONES: Course[] = [...capstoneCredits].map(([subject, credits]) => {
	const code = `${prefixOf(subject)}-CAP`;
	return {
		code,
		title: 'Capstone project',
		faculty: '',
		subject,
		subjects: [subject],
		codes: [code],
		codesBySubject: { [subject]: code },
		credits,
		required: false,
		offered: [1, 2, 3],
		eligibleYears: [4],
		prereqs: [],
		unlocks: []
	};
});
const capstoneCodes = new Set(CAPSTONES.map((c) => c.code));

const index = new Map([...COURSES, ...CAPSTONES].map((c) => [c.code, c]));
const aliases = new Map([...COURSES, ...CAPSTONES].flatMap((c) => c.codes.map((code) => [code, c] as const)));

// a retired course drops out of every prerequisite list, or it would be a
// requirement no one could meet
for (const c of COURSES) c.prereqs = c.prereqs.filter((p) => index.has(p));
// `unlocks` is exactly the inverse relation, derived, never stored
for (const c of COURSES) for (const p of c.prereqs) index.get(p)!.unlocks.push(c.code);

// A failed course stays on the plan as the attempt it was, under the course's
// code plus `~n` (COMP201~1), so the code itself is free to place again as the
// retake. Everything below reads an attempt as the course it is an attempt at.
const ATTEMPT_RE = /~(\d+)$/;
/** the course a plan entry is about: a code, or one of its failed attempts */
export const baseCode = (id: string): string => id.replace(ATTEMPT_RE, '');
/** a failed attempt kept on the plan, not the live course */
export const isAttemptId = (id: string): boolean => ATTEMPT_RE.test(id);
/** which attempt a `~n` id is, 0 for the course's own code */
export const attemptNumber = (id: string): number => Number(ATTEMPT_RE.exec(id)?.[1] ?? 0);
export const attemptId = (code: string, n: number): string => `${baseCode(code)}~${n}`;

export const hasCode = (code: string): boolean => {
	const c = baseCode(code);
	return index.has(c) || aliases.has(c);
};

export const byCode = (code: string): Course => {
	const c = index.get(baseCode(code)) ?? aliases.get(baseCode(code));
	if (!c) throw new Error(`unknown course code: ${code}`);
	return c;
};

/** the code a course is shown under when browsing a subject (HIST235 under
 *  history), its canonical code otherwise */
export const codeFor = (course: Course, subject?: string): string =>
	(subject && course.codesBySubject[subject]) || course.code;

export const creditsOfCodes = (codes: string[]): number =>
	codes.reduce((sum, code) => sum + (index.get(code)?.credits ?? 0), 0);

/** can a course be taken at all within a 3- or 4-year plan? */
export const reachableIn = (code: string, fourYear: boolean): boolean => {
	const c = index.get(code);
	if (!c || (c.pendingCredits && c.credits === 0)) return false;
	return !c.eligibleYears.length || c.eligibleYears.some((y) => y <= (fourYear ? 4 : 3));
};

// ── Equivalences ──

// Separate courses that satisfy one another, any one of a group (the
// discrete-maths core taught by three departments)…
for (const group of snapshot.equivalences.substitutes) {
	const present = group.filter((code) => index.has(code));
	for (const code of present) {
		const course = index.get(code)!;
		// A course may appear in several explicit substitution groups. Keep
		// each direct link without making the groups transitively equivalent.
		course.substitutes = [...new Set([...(course.substitutes ?? []), ...present.filter((other) => other !== code)])];
	}
}
// …and one-way: the maths course clears the applied one, not the reverse.
export const MATHS_COVERS = snapshot.equivalences.covers;
for (const { maths, applied } of MATHS_COVERS) {
	const m = index.get(maths);
	const a = index.get(applied);
	if (!m || !a) continue;
	m.covers = [...new Set([...(m.covers ?? []), applied])];
	a.coveredBy = [...new Set([...(a.coveredBy ?? []), maths])];
}

/** codes accepted in place of `code`, ask this wherever a requirement or
 *  prerequisite needs "is this already satisfied?" */
export const satisfiedBy = (code: string): string[] => {
	const c = index.get(baseCode(code));
	return c ? [...new Set([...(c.substitutes ?? []), ...(c.coveredBy ?? [])])] : [];
};

const TRANSCRIPT_ONLY = new Set(snapshot.equivalences.transcriptOnly);
/** on the transcript, toward no programme (matched on the canonical code) */
export const isTranscriptOnly = (code: string): boolean =>
	TRANSCRIPT_ONLY.has(index.get(baseCode(code))?.code ?? baseCode(code));

// ── The KCCS foundation core: every student, years 1–2 (KCCS190 in year 3);
//    year 1 t1/t2 hold only these, at most Y1_CORE_MAX per trimester ──

export const CORE_COURSES: Course[] = COURSES.filter((c) => c.subject === 'core');
export const CORE_CREDITS = CORE_COURSES.reduce((sum, c) => sum + c.credits, 0);
export const Y1_CORE_MAX = 4;
export const isCore = (code: string): boolean => index.get(baseCode(code))?.subject === 'core';

// The drop form's audit rules: a 2- or 4-credit course, never KCCS/391/490/491.
const AUDIT_EXCLUDED_RE = /(?:391|490|491)$/;
export const canAudit = (code: string): boolean => {
	const c = index.get(baseCode(code));
	if (!c || c.subject === 'core') return false;
	if (c.codes.some((x) => AUDIT_EXCLUDED_RE.test(x))) return false;
	return c.credits === 2 || c.credits === 4;
};

// ── Lecturers ──

export type Professor = Lecturer;
/** everyone in the directory, plus lecturers the term sheets name */
export const LECTURERS: Professor[] = snapshot.lecturers;
const lecturers = new Map(LECTURERS.map((l) => [l.id, l]));
export const lecturerById = (id: string): Professor | undefined => lecturers.get(id);
const courseRecords = new Map(snapshot.courses.map((c) => [c.code, c]));

/** lecturer ids for a course, as its latest term listed them */
const lecturerIdsOf = (code: string): string[] => courseRecords.get(code)?.lecturers ?? [];

/** who has taught a course, position, office hours, photo where known */
export function facultyOf(code: string): Professor[] {
	return lecturerIdsOf(byCode(code).code).flatMap((id) => lecturers.get(id) ?? []);
}

/** who teaches a course, as the search bar reads it: the names lecturers go
 *  by and the spellings the term sheets used */
export const facultySearchText = (c: Course): string =>
	[c.faculty, ...facultyOf(c.code).map((p) => p.name)].join(' ').toLowerCase();

/** "24_T1" → "2024 T1" */
export const termLabel = (term: string): string => {
	const [year, trim] = term.split('_');
	return year && trim ? `20${year} ${trim.toUpperCase()}` : term;
};

/** the terms a course ran, newest first: "2026 T2", "2025 T2", … */
export const termsOffered = (code: string): string[] =>
	(courseRecords.get(byCode(code).code)?.terms ?? []).map(termLabel);

/** the raw term ids a course ran ("24_T1"), for counting */
export const ranIn = (code: string): string[] => courseRecords.get(byCode(code).code)?.terms ?? [];

/** Every term the timetables cover, by trimester, oldest first: what "how
 *  often did it run in T1" is counted against. A term missing from the
 *  timetables (no sheet for it) simply isn't counted. */
export const RECORDED_TERMS: Record<1 | 2 | 3, string[]> = (() => {
	const by: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
	for (const term of [...new Set(snapshot.courses.flatMap((c) => c.terms ?? []))].sort()) {
		const trim = Number(/T(\d)$/i.exec(term)?.[1]);
		if (trim === 1 || trim === 2 || trim === 3) by[trim].push(term);
	}
	return by;
})();

// A lecturer is credited with every term a course of theirs ran, the data
// keeps each course's latest lecturers, so close enough to show what someone
// teaches and how recently.
const taught = new Map<string, string[]>();
for (const c of COURSES) {
	for (const id of lecturerIdsOf(c.code)) taught.set(id, [...(taught.get(id) ?? []), c.code]);
}

/** a lecturer's courses by term, newest first, the latest `terms` terms */
export function taughtBy(prof: Professor, terms = 3): { term: string; codes: string[] }[] {
	const byTerm = new Map<string, string[]>();
	for (const code of taught.get(prof.id) ?? [])
		for (const term of courseRecords.get(code)?.terms ?? []) byTerm.set(term, [...(byTerm.get(term) ?? []), code]);
	return [...byTerm]
		.sort(([a], [b]) => b.localeCompare(a))
		.slice(0, terms)
		.map(([term, codes]) => ({ term, codes }));
}

/** every course a lecturer is associated with, not a promise of future teaching */
export function facultyCourses(prof: Professor): Course[] {
	return [...new Set(taught.get(prof.id) ?? [])].map(byCode).sort((a, b) => a.title.localeCompare(b.title));
}

// ── Programme requirements ──
// The snapshot holds every programme variant, resolved, for each requirement
// set; a batch follows the set that names it, else the default (the website).
// With no batch given, the newest set. Rules for one batch only go on top.

const defaultSet = snapshot.requirementSets.find((s) => s.batches === null)!;
const latestSet = snapshot.requirementSets.findLast((s) => s.batches !== null) ?? defaultSet;
const programmeKey = (setId: string, subject: string, variant: Variant) => `${setId}|${subject}|${variant}`;
const programmes = new Map(
	snapshot.requirementSets.flatMap((set) =>
		set.programmes.map((p) => [programmeKey(set.id, p.subject, p.variant), p] as const)
	)
);

const programmeAt = (setId: string, subject: string, variant: Variant): ProgrammeRequirements | undefined =>
	programmes.get(programmeKey(setId, subject, variant));
export const programmeOf = programmeAt;
/** the newest requirement set: its name and the batches it governs */
export const CURRENT_REQUIREMENTS = { name: latestSet.name, batches: latestSet.batches ?? [] };
const setFor = (batch: number | undefined): RequirementSet =>
	batch === undefined ? latestSet : (snapshot.requirementSets.find((s) => s.batches?.includes(batch)) ?? defaultSet);

function programmeFor(subject: string, role: ProgrammeRole, fourYear: boolean, isDouble: boolean, batch?: number) {
	return programmeAt(setFor(batch).id, subject, variantOf(role, fourYear, isDouble));
}

/** is this the capstone stand-in, not a catalogue course */
export const isCapstone = (code: string): boolean => capstoneCodes.has(baseCode(code));

/** what the details panel says about a capstone, it has no description */
export const capstoneAbout = (code: string): string | undefined => {
	if (!isCapstone(code)) return undefined;
	const { credits } = byCode(code);
	return `A ${credits}-credit project in your final year, supervised by your department. Where your programme makes it optional, it takes the place of ${credits / 4} electives. It has no course code yet, so this holds its place on your plan; the department sets the topic and when it runs.`;
};

/** the capstone a programme takes, if its document states one. the
 *  requirement lists above leave it out, they're the site's too, and a
 *  stand-in has no page there; the planner adds it to its own sets */
export function capstoneFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): { code: string; required: boolean } | undefined {
	const stated = programmeFor(subject, role, fourYear, isDouble, batch)?.capstone;
	const course = stated && CAPSTONES.find((c) => c.subject === subject);
	return course ? { code: course.code, required: stated.required } : undefined;
}

type BatchRule = { courses: Record<string, 'required' | 'elective'>; requiredCredits?: number };
const batchKey = (batch: number, subject: string, variant: Variant) => `${batch}|${subject}|${variant}`;
const batchRules = new Map<string, BatchRule>(
	snapshot.batchRules.map(({ batch, subject, variant, courses, requiredCredits }) => [
		batchKey(batch, subject, variant),
		{ courses, requiredCredits }
	])
);

export function batchRuleFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
) {
	return batch === undefined
		? undefined
		: batchRules.get(batchKey(batch, subject, variantOf(role, fourYear, isDouble)));
}

export function creditsFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): number {
	if (subject === 'open') return role === 'minor' ? OPEN_MINOR_CREDITS : 0;
	return programmeFor(subject, role, fourYear, isDouble, batch)?.credits.total ?? 0;
}

/** the required credits the programme states, the honest denominator when
 *  its required list is choice pools */
export const requiredCreditsFor = (
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
) =>
	batchRuleFor(subject, role, fourYear, isDouble, batch)?.requiredCredits ??
	programmeFor(subject, role, fourYear, isDouble, batch)?.credits.required ??
	undefined;

/** a batch rule's verdict on a course, by its canonical code */
const batchVerdict = (edits: BatchRule['courses'], code: string) => edits[byCode(code).code];

export function requiredSetFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): string[] {
	const base = (programmeFor(subject, role, fourYear, isDouble, batch)?.required ?? []).filter((code) =>
		index.has(code)
	);
	const rule = batchRuleFor(subject, role, fourYear, isDouble, batch);
	if (!rule) return base;
	const result = new Set(base.map((code) => byCode(code).code));
	for (const [alias, type] of Object.entries(rule.courses)) {
		if (!hasCode(alias)) continue;
		const code = byCode(alias).code;
		if (type === 'required' && reachableIn(code, fourYear)) result.add(code);
		else result.delete(code);
	}
	return [...result];
}

export function electiveSetFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): string[] {
	const result = new Set(
		(programmeFor(subject, role, fourYear, isDouble, batch)?.electives ?? []).filter((code) => index.has(code))
	);
	for (const [alias, type] of Object.entries(batchRuleFor(subject, role, fourYear, isDouble, batch)?.courses ?? {})) {
		if (!hasCode(alias)) continue;
		const code = byCode(alias).code;
		if (type === 'elective') result.add(code);
		else result.delete(code);
	}
	return [...result];
}

/** 'choose N from' pools, they count toward the required credits */
export function pickSetFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): string[] {
	const edits = batchRuleFor(subject, role, fourYear, isDouble, batch)?.courses ?? {};
	return (programmeFor(subject, role, fourYear, isDouble, batch)?.picks ?? []).filter(
		(code) => index.has(code) && !batchVerdict(edits, code)
	);
}

/** the 'choose N from …' groups the student still has to decide */
export function choiceGroupsFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): ChoiceGroup[] {
	const edits = batchRuleFor(subject, role, fourYear, isDouble, batch)?.courses ?? {};
	const verdict = (code: string | null) => (code && hasCode(code) ? batchVerdict(edits, code) : undefined);
	return (programmeFor(subject, role, fourYear, isDouble, batch)?.choices ?? [])
		.map((group) => ({
			...group,
			pick: Math.max(0, group.pick - group.courses.filter((c) => verdict(c.code) === 'required').length),
			courses: group.courses.filter((c) => !verdict(c.code))
		}))
		.filter((group) => group.pick > 0);
}

/** the department's suggested placement of the required courses */
export function recommendedFor(
	subject: string,
	role: ProgrammeRole,
	fourYear: boolean,
	isDouble: boolean,
	batch?: number
): { year: number; trim: TrimNum; code: string }[] {
	return (programmeFor(subject, role, fourYear, isDouble, batch)?.pathway ?? []).filter(({ code }) => index.has(code));
}

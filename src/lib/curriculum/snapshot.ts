import type { Course, ProgrammeRole, Subject, TrimNum } from '$lib/types';

/**
 * The curriculum as the app consumes it: every course, lecturer and programme
 * rule, already reconciled. The compiler (./compiler.ts) produces it from the
 * scrape and the department documents; Postgres stores it; the runtime
 * ($lib/data) only indexes and looks things up. JSON-serialisable throughout.
 */
export type CurriculumSnapshot = {
	format: 1;
	/** content hash, changes whenever anything in the snapshot does */
	release: string;
	/** when the catalogue was last scraped (YYYY-MM-DD), shown to students */
	updatedOn: string | null;
	subjects: Subject[];
	rules: PlannerRules;
	courses: SnapshotCourse[];
	lecturers: Lecturer[];
	equivalences: Equivalences;
	requirementSets: RequirementSet[];
	batchRules: BatchRuleRecord[];
	/** how a course counting for two of a student's programmes is credited by
	 *  default; set in the office, absent from older releases */
	creditSharing?: CreditShare;
	/** what each batch changes about which programmes it can take; absent
	 *  from older releases */
	batchProfiles?: BatchProfile[];
};

export type CreditShare = 'one' | 'all';

/** A course as the catalogue ships it. `unlocks` and the equivalence edges
 *  are derived by the runtime from `prereqs` and `equivalences`. */
export type SnapshotCourse = Omit<Course, 'unlocks' | 'substitutes' | 'covers' | 'coveredBy'> & {
	/** every term it ran, newest first: "25_T2" */
	terms: string[];
	/** lecturer ids, as the latest term listed them */
	lecturers: string[];
};

export type Lecturer = {
	id: string;
	name: string;
	email: string;
	position: string;
	office_hours: string;
	/** room or office code, e.g. "JSW 210", when the record has one */
	office_number?: string;
	image_url: string;
	url: string;
	date_of_joining?: string;
};

export type PlannerRules = {
	TRIM_MIN: number;
	TRIM_NORMAL_MAX: number;
	TRIM_STANDARD_MAX: number;
	TRIM_HARD_MAX: number;
	HEAVY_TRIMS_ALLOWED: number;
	AUDIT_LIMIT: number;
	MIN_TOTAL_3YR: number;
	MIN_TOTAL_4YR: number;
	MAX_TOTAL_3YR: number;
	/** a double major may stretch a three-year tenure this far; absent from
	 *  releases before the rule was added */
	MAX_TOTAL_3YR_DOUBLE?: number;
	MAX_TOTAL_4YR: number;
};

export type Equivalences = {
	/** separate courses that satisfy one another (any one of a group) */
	substitutes: string[][];
	/** one-way: the maths course is accepted in place of the applied one */
	covers: { maths: string; applied: string }[];
	/** on the transcript, toward no programme */
	transcriptOnly: string[];
};

export type Variant =
	| 'single_major_4yr'
	| 'double_major_4yr'
	| 'single_major_3yr'
	| 'double_major_3yr'
	| 'minor_4yr'
	| 'minor_3yr'
	| 'concentration_4yr'
	| 'concentration_3yr';

/** The programme a student's choices describe. A concentration has one
 *  course list, but its credits can differ by degree length (CS: 16 or 20). */
export const variantOf = (role: ProgrammeRole, fourYear: boolean, isDouble: boolean): Variant => {
	const length = fourYear ? '4yr' : '3yr';
	if (role === 'major') return `${isDouble ? 'double' : 'single'}_major_${length}`;
	return `${role}_${length}`;
};

export type ChoiceCourse = { code: string | null; title: string };
export type ChoiceGroup = { rule: string; pick: number; courses: ChoiceCourse[] };

/** One programme variant's rules, fully resolved. */
export type ProgrammeRequirements = {
	subject: string;
	variant: Variant;
	credits: { total: number; required: number | null; elective: number | null };
	required: string[];
	/** courses in 'choose N' pools, they count toward the required credits */
	picks: string[];
	electives: string[];
	choices: ChoiceGroup[];
	/** the suggested placement of required courses */
	pathway: { year: number; trim: TrimNum; code: string }[];
	/** a capstone project the document states, which the catalogue has no
	 *  code for; optional ones stand in for electives. absent = none */
	capstone?: Capstone;
};

export type Capstone = { credits: number; required: boolean };

/** The rules a run of batches graduates under. `batches: null` is the
 *  default set, for any batch no other set names. */
export type RequirementSet = {
	id: string;
	name: string;
	batches: number[] | null;
	programmes: ProgrammeRequirements[];
};

/** A batch's changes to who can study what: only the differences, so
 *  `philosophy: { major: true }` opens a major from that batch on. */
export type BatchOffers = Record<string, Partial<Record<ProgrammeRole, boolean>>>;
export type BatchProfile = { batch: number; offers: BatchOffers };

/** can this batch take the subject in this role? the newest batch up to this
 *  one that says so decides, so a major opened for 2027 stays open for later
 *  batches until one closes it. nothing said, the subject's own default holds */
export function subjectOffered(
	subject: Subject,
	role: ProgrammeRole,
	batch: number,
	profiles: BatchProfile[] = []
): boolean {
	const stated = profiles
		.filter((p) => p.batch <= batch && p.offers[subject.id]?.[role] !== undefined)
		.sort((a, b) => b.batch - a.batch)[0];
	return stated ? stated.offers[subject.id][role]! : role !== 'major' || subject.majorable;
}

/** A rule for one batch only ("ENVS201 for the 2022 batch"). */
export type BatchRuleRecord = {
	batch: number;
	subject: string;
	variant: Variant;
	courses: Record<string, 'required' | 'elective'>;
	requiredCredits?: number;
};

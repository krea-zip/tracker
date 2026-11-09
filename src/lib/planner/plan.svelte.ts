// ─────────────────────────────────────────────
// Plan, all app state + the "laws" in one class.
// Created once in the planner layout and shared through context (usePlan).
// ─────────────────────────────────────────────

import { browser } from '$app/environment';
import { restoreBoard, saveBoard } from '$lib/plans/autosave';
// the board's motion is a plan concern: only the plan knows when a change is
// one course moving (worth watching fly) and when it is a whole-board redraw
import { quietRedraw } from '$lib/ui/transitions';
import { selectCatalogue, type CatalogueSort, type CourseKind, type QuickFilter } from '$lib/planner/catalogue/select';
import { guessNow, slotAt, slotOrder, trimName, trimSpelled, type Here, type TrimNaming } from './calendar';
import {
	CORE_COURSES,
	CORE_CREDITS,
	SUBJECTS,
	HEAVY_TRIMS_ALLOWED,
	creditCeilingFor,
	MIN_TOTAL_3YR,
	MIN_TOTAL_4YR,
	TRIM_HARD_MAX,
	TRIM_MIN,
	TRIM_STANDARD_MAX,
	Y1_CORE_MAX,
	attemptId,
	attemptNumber,
	baseCode,
	byCode,
	capstoneFor,
	isCore,
	creditsFor,
	hasCode,
	isAttemptId,
	pickSetFor,
	requiredSetFor,
	satisfiedBy,
	subjectById,
	STUDENT_BATCHES,
	offeredTo
} from '$lib/curriculum/data';
import { GRADE_POINTS, isGradeLetter, weightedGpa, type GradeMark } from '$lib/planner/grades/grades';
import { planHints } from './rules';
import { choicePools } from './choices';
import { claimCredits, programmeStats } from './credits';
import { planFill } from './fill';
import { PlanHistory } from './history.svelte';
import { meetsRequired, ofSubject, setsFor, typeIn } from './programmeSets';
import { cleanBreaks, cleanGrades, cleanNow, cleanPlacements, cleanZoomPos } from './saveFormat';
import {
	BREAK_KINDS,
	coreOnly,
	isBoardView,
	MAX_YEARS,
	programmesFor,
	type BoardView,
	type BreakInfo
} from './structure';
import { distinctHues } from './hues';
import { keepPicksDistinct, pickOptions, type Picks, type PickRole } from './picks';
import { recommendedElectives, recommendedPath } from './recommended';
import {
	slotKey,
	parseSlot,
	TRIMS,
	type Course,
	type CourseType,
	type Hint,
	type Programme,
	type ProgrammeRole,
	type ProgrammeStat,
	type SlotKey,
	type StructureKind,
	type TrimNum
} from '$lib/types';

// bump only when the saved shape changes in a way applySave can't read
const SAVE_VERSION = 1;

export class Plan {
	storageError = $state('');
	// ── raw state ──
	fourYear = $state(true);
	// how far the grid runs, see `years` below
	yearCount = $state(4);
	batchStartYear = $state(2026);
	structure = $state<StructureKind>('major-minor');
	// mathematics is the one subject with a published pathway, so the
	// first-visit grid actually demonstrates the recommended order
	picks = $state({ major1: 'mathematics', major2: 'history', minor: 'physics', conc: 'physics' });
	placements = $state<Record<SlotKey, string[]>>({});
	audited = $state<string[]>([]); // codes the student has marked as audits
	grades = $state<Record<string, GradeMark>>({}); // code → grade / status (audits never carry one)
	// what a grid chip is labelled with, either, or both. Turning one off
	// forces the other on, so a chip is never blank
	showCodes = $state(true);
	showTitles = $state(false);
	creditTargetMode = $state<'minimum' | 'maximum'>('minimum');
	// the board's view, picked at the top of the board. Plan by default so the
	// planner stays clean.
	view = $state<BoardView>('plan');
	// Grade view is the 'grades' view: it unlocks grade entry on chips, in the
	// details panel, the CGPA / recovery panel, and the grade hints. Nothing
	// grade-related shows in any other view, except a failed attempt's U.
	get gradeMode(): boolean {
		return this.view === 'grades';
	}
	set gradeMode(on: boolean) {
		this.view = on ? 'grades' : 'plan';
	}
	showGradeLabels = $state(true); // show the grade on each chip (only ever in grade view)
	// students count trimesters by year or through the degree; see calendar.ts
	trimNaming = $state<TrimNaming>('year');
	// Has the student changed anything yet? The grid arrives pre-filled with the
	// department's recommended path, so until they touch it their plan and the
	// recommendation are the same thing and a programme change should re-lay it
	// out. Once they've edited it, it is THEIR plan and a programme change must
	// never move their courses. No UI, the student never sees this decision,
	// they just find that the app does the obvious thing either way.
	touched = $state(false);
	// the first-visit welcome is open: the board shows only what's been
	// answered, not the suggested path for the defaults behind the questions
	welcoming = $state(false);
	// every part of the app is labelled, after the welcome or from the ? key
	guiding = $state(false);
	// the welcome replayed (?welcome) empties the board, so nothing is saved
	// from then on and a reload brings the student's own plan back
	rehearsing = $state(false);
	// warn hints the student has waived, a broken prerequisite is a real rule,
	// but plenty of students hold a waiver for one, so a red hint can be crossed
	// off. Keyed by the hint's rule id, so it stays crossed off across reloads
	// and re-appears the moment a DIFFERENT course breaks the same rule.
	waived = $state<string[]>([]);
	// Trimesters not spent taking courses here: a break, a suspension, or a
	// term away (see BreakKind). Nothing can be placed in one, and no load
	// rule applies to it. Set from a trimester's own view: most students never
	// need it, so nothing about it shows on the board until it's used.
	breaks = $state<Record<SlotKey, BreakInfo>>({});
	// "you are here": the trimester the student is in now, the line between
	// what they've taken and what they can still change. null until they say;
	// then it's guessed from the batch and the date (calendar.ts)
	now = $state<Here | null>(null);
	// where a course sits on the zoomed credit canvas (cell index 0-23, 4 per
	// row), set when the student drops it on a specific spot; absent = packed
	zoomPos = $state<Record<string, number>>({});
	zoom = $state<{ year: number; trim: TrimNum } | null>(null);
	// the courses a hint names, while the student points at that hint, they
	// light up on the grid so the hint and the trimester it's about connect
	highlight = $state<string[]>([]);
	highlightSlots = $state<SlotKey[]>([]); // trimesters a pointed-at hint is about
	// the feedback window: null = shut, otherwise the text it opens with (a
	// course or a hint can open it pre-filled with what it's about)
	feedbackDraft = $state<string | null>(null);
	search = $state('');
	catalogueReveal = $state<{ code: string } | null>(null);

	revealCourse(code: string) {
		if (!hasCode(code)) return;
		const course = byCode(code);
		this.selected = course;
		this.catalogueReveal = { code: course.code };
	}

	filters = $state<string[]>([]); // checked catalogue subject filters
	// checked course kinds; not saved, or a reload could quietly hide courses
	kinds = $state<CourseKind[]>([]);
	quick = $state<QuickFilter[]>([]); // not saved either
	catalogueTerms = $state<TrimNum[]>([]);
	catalogueCredits = $state<number[]>([]);
	catalogueSort = $state<CatalogueSort>('relevance');
	#selected = $state<Course | null>(null); // course shown in the details bar
	/** which attempt of it the bar is about, when that is a failed one (COMP201~1) */
	selectedId = $state<string | null>(null);
	get selected(): Course | null {
		return this.#selected;
	}
	set selected(course: Course | null) {
		this.#selected = course;
		this.selectedId = null;
		// a reveal answers one click ("show me COMP350"); choosing anything
		// else ends it, so no stale outline or "showing" bar is left behind
		if (course?.code !== this.catalogueReveal?.code) this.catalogueReveal = null;
	}
	/** show a course on the board, a failed attempt of it included */
	select(id: string) {
		const course = byCode(id);
		this.#selected = course;
		this.selectedId = isAttemptId(id) ? id : null;
		if (course.code !== this.catalogueReveal?.code) this.catalogueReveal = null;
	}
	railOpen = $state(false); // the sidebar slid in, where it doesn't fit as a column
	dragging = $state<string | null>(null); // code mid-drag → grid shows where it fits
	flash = $state<string | null>(null); // transient "not offered" style message
	#flashTimer: ReturnType<typeof setTimeout> | undefined;

	// A miniature is an unsaved, two-year plan inside the welcome frame.
	readonly miniature: boolean = false;

	constructor({ miniature = false } = {}) {
		this.miniature = miniature;
		this.rehearsing = miniature;
		// default plan = the department order for the chosen programmes;
		// a saved plan (below) replaces it
		if (!miniature) this.seedRecommended();
		if (!browser) return;
		try {
			if (!miniature) restoreBoard(localStorage, (value) => this.applySave(value));
		} catch {
			/* Browser storage can be blocked; the current session still works. */
		}

		$effect(() => {
			// Practice plans keep local undo history while skipping autosave.
			this.#history.record(this.#planningState());
			if (this.rehearsing) return;
			const json = JSON.stringify(this.snapshot());
			try {
				this.storageError = saveBoard(localStorage, json) ? '' : 'Your browser could not save the latest changes.';
			} catch {
				this.storageError =
					'Browser storage is unavailable, so this plan is lost when the tab closes. Copy a share link to keep it.';
			}
		});
	}

	// ── undo / redo ──
	// Each entry is a whole planning state, courses, programmes, batch,
	// grades, audits, crossed-off hints, so undo puts back exactly what was
	// there, however many courses one action moved. How the board is viewed
	// (codes, titles, filters, grade view) is not history.
	#history = new PlanHistory();
	get canUndo() {
		return this.#history.canUndo;
	}
	get canRedo() {
		return this.#history.canRedo;
	}

	#planningState(): string {
		const {
			placements,
			picks,
			structure,
			fourYear,
			yearCount,
			batchStartYear,
			grades,
			audited,
			waived,
			touched,
			breaks,
			now
		} = this.snapshot();
		return JSON.stringify({
			placements,
			picks,
			structure,
			fourYear,
			yearCount,
			batchStartYear,
			grades,
			audited,
			waived,
			touched,
			breaks,
			now
		});
	}

	/** Start recording once the page is up (see PlanHistory.start) */
	startHistory() {
		this.#history.start(this.#planningState());
	}

	undo() {
		const state = this.#history.undo();
		if (state !== undefined) this.#travel(state, 'undone');
	}

	redo() {
		const state = this.#history.redo();
		if (state !== undefined) this.#travel(state, 'redone');
	}

	#travel(state: string, done: string) {
		quietRedraw(); // a whole state at once, fade, don't fly
		this.applySave({ ...this.snapshot(), ...JSON.parse(state) });
		this.#setFlash(done);
	}

	/** Everything that makes up a schedule, in the exact shape applySave reads.
	 *  The autosave writes this; so does a named save. One serialiser means a
	 *  saved schedule can never drift from what the restore path understands. */
	snapshot() {
		return {
			// stamped so a future build can tell an old save's shape from a new
			// one and migrate it, instead of having to discard it
			version: SAVE_VERSION,
			placements: this.placements,
			breaks: this.breaks,
			now: this.now,
			touched: this.touched,
			waived: this.waived,
			zoomPos: this.zoomPos,
			audited: this.audited,
			grades: this.grades,
			view: this.view,
			gradeMode: this.gradeMode, // older builds read this, keep writing it
			showGradeLabels: this.showGradeLabels,
			trimNaming: this.trimNaming,
			creditTargetMode: this.creditTargetMode,
			showCodes: this.showCodes,
			showTitles: this.showTitles,
			fourYear: this.fourYear,
			yearCount: this.yearCount,
			batchStartYear: this.batchStartYear,
			structure: this.structure,
			picks: this.picks,
			filters: this.filters
		};
	}

	/** load a schedule saved earlier, same validation as a page load, so a
	 *  snapshot from an older build can never break the app */
	restore(data: unknown) {
		quietRedraw(); // the whole board changes at once, fade, don't fly
		if (data && typeof data === 'object') this.applySave(data as Record<string, unknown>);
		this.selected = null;
		this.zoom = null;
	}

	/** validate + apply a saved/imported plan object. Shared by the
	 *  localStorage restore and the import button, everything is checked
	 *  against the current catalogue, so a stale save can't break the app. */
	private applySave(parsed: {
		fourYear?: unknown;
		batchStartYear?: unknown;
		structure?: unknown;
		picks?: Record<string, unknown>;
		filters?: unknown;
		placements?: unknown;
		audited?: unknown;
		grades?: unknown;
		gradeMode?: unknown;
		view?: unknown;
		breaks?: unknown;
		now?: unknown;
		showGradeLabels?: unknown;
		trimNaming?: unknown;
		trimNumbers?: unknown; // before trimNaming
		creditTargetMode?: unknown;
		showCodes?: unknown;
		showTitles?: unknown;
	}) {
		if (typeof parsed.fourYear === 'boolean') this.fourYear = parsed.fourYear;
		const yearCount = (parsed as { yearCount?: unknown }).yearCount;
		this.yearCount =
			typeof yearCount === 'number' && Number.isInteger(yearCount) && yearCount >= 3 && yearCount <= MAX_YEARS
				? yearCount
				: 4;
		this.batchStartYear =
			typeof parsed.batchStartYear === 'number' &&
			Number.isInteger(parsed.batchStartYear) &&
			STUDENT_BATCHES.includes(parsed.batchStartYear)
				? parsed.batchStartYear
				: 2026;
		if (
			typeof parsed.structure === 'string' &&
			['single-major', 'double-major', 'major-minor', 'major-conc', 'major-minor-conc'].includes(parsed.structure)
		)
			this.structure = parsed.structure as StructureKind;
		// older saves stored subject codes ("BUSI"), only accept current ids,
		// and majors additionally must be subjects offered as a major
		const isSubject = (v: unknown) => SUBJECTS.some((s) => s.id === v);
		const isMajor = (v: unknown) => SUBJECTS.some((s) => s.id === v && offeredTo(s, 'major', this.batchStartYear));
		for (const k of Object.keys(this.picks) as (keyof typeof this.picks)[]) {
			const ok = k === 'major1' || k === 'major2' ? isMajor : isSubject;
			const pick = parsed.picks?.[k];
			if (ok(pick)) this.picks[k] = pick as string;
		}
		if (Array.isArray(parsed.filters)) this.filters = parsed.filters.filter(isSubject);
		const breaks = cleanBreaks(parsed.breaks);
		if (breaks) this.breaks = breaks;
		const now = cleanNow(parsed.now);
		if (now) this.now = now;
		const placements = cleanPlacements(parsed.placements);
		if (placements) this.placements = placements;
		const zoomPos = cleanZoomPos((parsed as { zoomPos?: unknown }).zoomPos);
		if (zoomPos) this.zoomPos = zoomPos;
		if (Array.isArray(parsed.audited))
			this.audited = parsed.audited.filter((c: unknown): c is string => typeof c === 'string' && hasCode(c));
		const grades = cleanGrades(parsed.grades);
		if (grades) this.grades = grades;
		if (parsed.creditTargetMode === 'minimum' || parsed.creditTargetMode === 'maximum')
			this.creditTargetMode = parsed.creditTargetMode;
		if (typeof parsed.showCodes === 'boolean') this.showCodes = parsed.showCodes;
		if (typeof parsed.showTitles === 'boolean') this.showTitles = parsed.showTitles;
		if (!this.showCodes && !this.showTitles) this.showCodes = true;
		if (isBoardView(parsed.view)) this.view = parsed.view;
		else if (typeof parsed.gradeMode === 'boolean') this.gradeMode = parsed.gradeMode; // a save from before views
		if (typeof parsed.showGradeLabels === 'boolean') this.showGradeLabels = parsed.showGradeLabels;
		if (parsed.trimNaming === 'year' || parsed.trimNaming === 'degree') this.trimNaming = parsed.trimNaming;
		// earlier builds: 'current' (and before it 'degree') put degree numbers
		// in the header, the closest thing to naming through the degree
		else if (parsed.trimNumbers === 'current' || parsed.trimNumbers === 'degree') this.trimNaming = 'degree';
		// A save exists, so this plan has been used before: treat it as touched
		// unless it says otherwise. Getting this wrong in the `false` direction
		// would let a programme change re-lay-out a plan somebody built, and a
		// save written before this field existed can't tell us either way.
		this.touched = true;
		const touched = (parsed as { touched?: unknown }).touched;
		if (typeof touched === 'boolean') this.touched = touched;
		// waivers are opaque rule ids, a hint the build no longer emits simply
		// never matches, so an old id costs nothing and is kept
		const waived = (parsed as { waived?: unknown }).waived;
		if (Array.isArray(waived)) this.waived = waived.filter((v): v is string => typeof v === 'string');
		this.ensureDistinctPicks();
	}

	coreOnly(year: number, trim: TrimNum): boolean {
		return coreOnly(year, trim);
	}

	// ── derived: structure ──
	// year 4 is on the grid by default, plenty of 3-year students spread
	// their degree over four years. 4yup only picks WHICH variant's
	// requirements apply (3yr vs 4yr lists and credit tables) and how far the
	// seeder packs. The student can add a fifth year (the manual allows n + 2)
	// or, on a 3-year degree, take year 4 off, never below the degree's own
	// length.
	minYears = $derived(this.miniature ? 2 : this.fourYear ? 4 : 3);
	years = $derived(
		Array.from({ length: this.miniature ? 2 : Math.max(this.yearCount, this.minYears) }, (_, i) => i + 1)
	);
	canRemoveYear = $derived(this.years.length > this.minYears);
	/** an n-year degree gets n + 2 years: the grid never runs past that */
	maxYears = $derived(this.miniature ? 2 : this.minYears + 2);
	/** where the student is now: what they said, or the guess */
	here: Here = $derived(this.now ?? guessNow(this.batchStartYear, new Date(), this.years.length));
	/** credits earned on terms away, toward the total (not a programme) */
	awayCredits = $derived(
		Object.values(this.breaks).reduce((sum, b) => sum + (b.kind === 'away' ? (b.credits ?? 0) : 0), 0)
	);
	trims = TRIMS;
	seedYears = $derived(this.fourYear ? [1, 2, 3, 4] : [1, 2, 3]);

	programmes: Programme[] = $derived(programmesFor(this.structure, this.picks));

	selectedSubjects = $derived(this.programmes.map((p) => p.subject));
	isDouble = $derived(this.structure === 'double-major');
	// the degree total is the sum of whatever each chosen major/minor/concentration
	// actually requires (from programme.json), not a flat university-wide number,
	// plus the foundation core every student completes on top
	degreeTotal = $derived(
		this.programmes.reduce(
			(sum, p) => sum + creditsFor(p.subject, p.role, this.fourYear, this.isDouble, this.batchStartYear),
			0
		) + CORE_CREDITS
	);

	creditCeiling = $derived(creditCeilingFor(this.fourYear, this.isDouble));
	/** the fewest credits to graduate: the degree's own minimum (120 / 160),
	 *  or what the chosen programmes add up to when that is more */
	creditMinimum = $derived(Math.max(this.fourYear ? MIN_TOTAL_4YR : MIN_TOTAL_3YR, this.degreeTotal));
	/** the programmes need more than the ceiling allows, only overlap between
	 *  them (a course counting twice) can make the plan fit */
	creditsConflict = $derived(this.creditMinimum > this.creditCeiling);
	creditTarget = $derived(this.creditTargetMode === 'maximum' ? this.creditCeiling : this.creditMinimum);

	// ── derived: placements ──
	/** everything on the board in a *visible* year, failed attempts included:
	 *  `id` is what the grid holds, `code` the course it is (COMP201~1 → COMP201) */
	attempts = $derived.by(() => {
		const out: { id: string; code: string; key: SlotKey; year: number; trim: TrimNum }[] = [];
		for (const [key, ids] of Object.entries(this.placements)) {
			const { year, trim } = parseSlot(key);
			if (!this.years.includes(year)) continue;
			for (const id of ids) out.push({ id, code: baseCode(id), key, year, trim });
		}
		return out;
	});

	/** every course placed in a *visible* year, with its slot. A failed
	 *  attempt is not here: it earned nothing, so no rule, credit total or
	 *  prerequisite counts it. */
	placed = $derived(
		this.attempts.filter((a) => a.id === a.code).map(({ code, key, year, trim }) => ({ code, key, year, trim }))
	);

	placedCodes = $derived(new Set(this.placed.map((p) => p.code)));

	/** is this id anywhere on the board (hidden years too) */
	onBoard(id: string): boolean {
		return Object.values(this.placements).some((ids) => ids.includes(id));
	}

	/** the failed attempts of a course, oldest first */
	attemptsOf(code: string) {
		const base = baseCode(code);
		return this.attempts
			.filter((a) => a.code === base && a.id !== base)
			.sort((a, b) => attemptNumber(a.id) - attemptNumber(b.id));
	}

	/** Failed attempts still holding the grade a U gives: the latest one of a
	 *  course, until the retake carries a letter grade, which replaces it. */
	failedAttempts = $derived.by(() => {
		const latest = new Map<string, (typeof this.attempts)[number]>();
		for (const a of this.attempts) {
			if (a.id === a.code || this.grades[a.id] !== 'U') continue;
			const seen = latest.get(a.code);
			if (!seen || attemptNumber(a.id) > attemptNumber(seen.id)) latest.set(a.code, a);
		}
		return [...latest.values()].filter((a) => !isGradeLetter(this.grades[a.code]) && !this.isAudit(a.code));
	});
	totalPlacedCredits = $derived(this.placed.reduce((sum, p) => sum + byCode(p.code).credits, 0) + this.awayCredits);

	// ── grades / CGPA ──
	// every placed, non-audit course that carries a grade, one row per unique
	// code, with its credits and grade points (a U scores 0 but still counts,
	// exactly as the manual computes CGPA)
	gradedCourses = $derived.by(() => {
		const out: { code: string; credits: number; points: number; letter: GradeMark }[] = [];
		for (const code of this.placedCodes) {
			const mark = this.grades[code];
			// only real letter grades count toward the CGPA, W / I earn no points
			if (!mark || this.isAudit(code) || !isGradeLetter(mark)) continue;
			out.push({ code, credits: byCode(code).credits, points: GRADE_POINTS[mark], letter: mark });
		}
		// a failed course scores 0 until its retake has a grade
		for (const a of this.failedAttempts)
			out.push({ code: a.id, credits: byCode(a.code).credits, points: 0, letter: 'U' });
		return out;
	});
	gradedCredits = $derived(this.gradedCourses.reduce((s, c) => s + c.credits, 0));
	earnedPoints = $derived(this.gradedCourses.reduce((s, c) => s + c.points * c.credits, 0));
	/** cumulative GPA over everything graded so far, null until a grade exists */
	cgpa = $derived(this.gradedCredits > 0 ? this.earnedPoints / this.gradedCredits : null);
	/** every placed non-audit credit, what the final CGPA will be taken over,
	 *  so the recovery projection runs against the plan the student actually built */
	gradableCredits = $derived.by(() => {
		let c = 0;
		for (const code of this.placedCodes) if (!this.isAudit(code)) c += byCode(code).credits;
		for (const a of this.failedAttempts) c += byCode(a.code).credits; // graded, so in the denominator
		return c;
	});

	// ── laws: course type ──
	// per-programme required/elective sets for the exact variant on the plan
	// (a 3-year single major's list, not some other variant's), from the
	// scraped website structure (requirements.json). Required closes over
	// prerequisites: a hard prereq of a required course (Analysis 4 for
	// Topology 1) must be taken too, so it reads as required.
	programmeSets = $derived(setsFor(this.programmes, this.isDouble, this.fourYear, this.batchStartYear));

	// role toward your chosen major/minor. Anything the programmes don't
	// list, a different department, or an in-department course that isn't a
	// stated requirement, is 'other', NOT an audit. Audits are a separate
	// flag the student sets.
	courseType(code: string): CourseType {
		return typeIn(code, this.programmeSets);
	}

	// ── what-if ──
	// Another degree tried on top of the plan: the grid reads as if these were
	// your programmes, and nothing changes until applyWhatIf.
	whatIf = $state<{ structure: StructureKind; picks: Picks; fourYear: boolean; batch: number } | null>(null);
	whatIfProgrammes = $derived(this.whatIf ? programmesFor(this.whatIf.structure, this.whatIf.picks) : []);
	whatIfSets = $derived(
		this.whatIf
			? setsFor(
					this.whatIfProgrammes,
					this.whatIf.structure === 'double-major',
					this.whatIf.fourYear,
					this.whatIf.batch
				)
			: []
	);
	/** what the degree tried would ask for in all, as degreeTotal is for yours */
	whatIfTotal = $derived(
		this.whatIf
			? this.whatIfProgrammes.reduce(
					(sum, p) =>
						sum +
						creditsFor(
							p.subject,
							p.role,
							this.whatIf!.fourYear,
							this.whatIf!.structure === 'double-major',
							this.whatIf!.batch
						),
					0
				) + CORE_CREDITS
			: 0
	);
	/** start a what-if from the plan as it is */
	startWhatIf() {
		this.whatIf = {
			structure: this.structure,
			picks: { ...this.picks },
			fourYear: this.fourYear,
			batch: this.batchStartYear
		};
	}

	whatIfType(code: string): CourseType {
		return typeIn(code, this.whatIfSets);
	}

	#whatIfHues = $derived(
		distinctHues(
			this.whatIfSets.map((s) => s.subject),
			(s) => subjectById(s).hue
		)
	);

	/** the hue a course would wear under the tried degree */
	whatIfHue(code: string): number | undefined {
		const c = byCode(code);
		for (const s of this.whatIfSets)
			if (meetsRequired(c, s) || c.codes.some((x) => s.elective.has(x)) || ofSubject(c, s.subject))
				return s.subject === 'open' ? undefined : this.#whatIfHues.get(s.subject);
		return undefined;
	}

	/** Make the tried degree yours, the same as picking it on the left, and
	 *  with `adds`, put the courses it still needs where the what-if found room
	 *  for them. A plan nobody has edited yet is laid out afresh for the new
	 *  degree instead, the way the sidebar does it. */
	applyWhatIf(adds: { code: string; year: number; trim: TrimNum }[] = []) {
		if (!this.whatIf) return;
		const wasTouched = this.touched;
		this.structure = this.whatIf.structure;
		this.picks = { ...this.whatIf.picks };
		this.fourYear = this.whatIf.fourYear;
		this.batchStartYear = this.whatIf.batch;
		this.programmeChanged();
		let added = 0;
		if (wasTouched && adds.length) {
			this.#touch();
			const next: Record<SlotKey, string[]> = Object.fromEntries(
				Object.entries(this.placements).map(([key, codes]) => [key, [...codes]])
			);
			for (const { code, year, trim } of adds) {
				if (this.placedCodes.has(code) || this.breaks[slotKey(year, trim)]) continue;
				next[slotKey(year, trim)] = [...(next[slotKey(year, trim)] ?? []), code];
				if (year > this.yearCount) this.yearCount = Math.min(MAX_YEARS, year);
				added++;
			}
			this.placements = next;
		}
		this.view = 'plan';
		this.#setFlash(
			added
				? `your programme is now the one you tried, ${added} course${added === 1 ? '' : 's'} it needs added`
				: 'your programme is now the one you tried'
		);
	}

	// ── breaks ──
	/** the break a trimester is marked as, if it is one */
	breakAt(year: number, trim: TrimNum): BreakInfo | undefined {
		return this.breaks[slotKey(year, trim)];
	}

	/** Mark a trimester as a break, a suspension or a term away. Its courses,
	 *  and every course after it, move later by `shift` trimesters: 3 keeps
	 *  each course in the trimester it runs, 1 is the shortest delay. A course
	 *  never lands in another break. Says no (and why) when the grid would
	 *  have to run past its last year. */
	setBreak(year: number, trim: TrimNum, info: BreakInfo, shift: 0 | 1 | 3 = 0): boolean {
		const key = slotKey(year, trim);
		const start = slotOrder(year, trim);
		const last = slotOrder(this.maxYears, 3);
		const off = (o: number) => o === start || !!this.breaks[slotKey(slotAt(o).year, slotAt(o).trim)];
		const moving = Object.entries(this.placements).filter(
			([k, codes]) => codes.length && slotOrder(parseSlot(k).year, parseSlot(k).trim) >= start
		);
		// a trimester with courses needs them moved; an empty one is just marked
		if (!shift && (this.placements[key]?.length ?? 0) > 0) return false;
		const dest = (o: number) => {
			let d = o + shift;
			while (d <= last && off(d)) d += shift;
			return d;
		};
		const next: Record<SlotKey, string[]> = {};
		let furthest = 0;
		for (const [k, codes] of Object.entries(this.placements)) {
			const o = slotOrder(parseSlot(k).year, parseSlot(k).trim);
			const to = o >= start && codes.length && shift ? dest(o) : o;
			if (to > last) {
				this.#setFlash(
					`no room to move everything back: it would run past year ${this.maxYears}, the most a ${this.minYears}-year degree has (n + 2)`
				);
				return false;
			}
			const at = slotAt(to);
			next[slotKey(at.year, at.trim)] = [...(next[slotKey(at.year, at.trim)] ?? []), ...codes];
			furthest = Math.max(furthest, at.year);
		}
		quietRedraw();
		this.#touch();
		this.placements = next;
		this.breaks = { ...this.breaks, [key]: info };
		if (furthest > this.years.length) this.yearCount = furthest;
		const moved = shift ? moving.reduce((n, [, codes]) => n + codes.length, 0) : 0;
		this.#setFlash(
			moved
				? `${this.trimName(year, trim)} is ${info.kind === 'away' ? 'a term away' : `a ${BREAK_KINDS[info.kind].label}`} now, ${moved} course${moved === 1 ? '' : 's'} moved back ${shift === 3 ? 'a year' : 'a trimester'}`
				: `${this.trimName(year, trim)} is ${info.kind === 'away' ? 'a term away' : `a ${BREAK_KINDS[info.kind].label}`} now`
		);
		return true;
	}

	/** an away term's credits, as the student updates them */
	setAwayCredits(year: number, trim: TrimNum, credits: number) {
		const key = slotKey(year, trim);
		const b = this.breaks[key];
		if (b?.kind !== 'away') return;
		this.breaks = {
			...this.breaks,
			[key]: { kind: 'away', credits: Math.max(0, Math.min(40, Math.round(credits) || 0)) }
		};
	}

	/** back to a normal trimester; courses moved for the break stay where they are */
	clearBreak(year: number, trim: TrimNum) {
		const key = slotKey(year, trim);
		if (!this.breaks[key]) return;
		this.#touch();
		const { [key]: _gone, ...rest } = this.breaks;
		this.breaks = rest;
		this.#setFlash(`${this.trimName(year, trim)} is a normal trimester again`);
	}

	/** which chosen programme (by index) a course counts toward, picks the
	 *  hue it wears. -1 when it belongs to none of them. A placed course wears
	 *  the programme that claims its credits; any other, the first programme
	 *  whose requirement or department it is part of. */
	programmeOf(code: string): number {
		const c = byCode(code);
		// a placed course: the programme it actually counts toward
		const claimed = this.claims.get(c.code);
		if (claimed?.length && this.programmes[claimed[0]]?.subject !== 'open') return claimed[0];
		for (let i = 0; i < this.programmeSets.length; i++) {
			const s = this.programmeSets[i];
			if (meetsRequired(c, s) || c.codes.some((x) => s.elective.has(x)) || ofSubject(c, s.subject)) return i;
		}
		return -1;
	}

	/** what a course is to this plan, in words: "required · computer science major" */
	roleLabel(code: string): string {
		const type = this.courseType(code);
		if (type === 'core') return 'foundation core (KCCS)';
		if (type === 'other') return 'counts toward none of your programmes';
		const prog = this.programmes[this.programmeOf(code)];
		return prog ? `${type} · ${subjectById(prog.subject).label} ${prog.role}` : type;
	}

	/** How a cross-listed course counts in each department it belongs to. The
	 *  role is a department's own call (Electronics I is required for physics
	 *  majors and an elective for computer science ones), so the details panel
	 *  spells out every one: each department's major, plus the student's own
	 *  programme there when it is a minor or concentration. */
	rolesIn(code: string): {
		subject: string;
		label: string;
		/** "physics major", "physics minor" */
		scope: string;
		role: 'required' | 'elective';
		/** the student's own programme */
		mine: boolean;
	}[] {
		const c = byCode(code);
		if (isCore(code)) return [];
		const out: ReturnType<Plan['rolesIn']> = [];
		for (const subject of c.subjects) {
			if (subject === 'core' || subject === 'open') continue;
			const label = subjectById(subject).label;
			const mine = this.programmes.find((p) => p.subject === subject);
			const read = (role: ProgrammeRole, double: boolean): 'required' | 'elective' => {
				const capstone = capstoneFor(subject, role, this.fourYear, double, this.batchStartYear);
				const required = new Set([
					...requiredSetFor(subject, role, this.fourYear, double, this.batchStartYear),
					...pickSetFor(subject, role, this.fourYear, double, this.batchStartYear),
					...(capstone?.required ? [capstone.code] : [])
				]);
				// listed as required, or else an elective, a general one when the
				// department doesn't list it, exactly as courseType reads it
				return c.codes.some((x) => required.has(x)) ? 'required' : 'elective';
			};
			const ownMajor = mine?.role === 'major';
			out.push({
				subject,
				label,
				scope: `${label.toLowerCase()} major`,
				role: read('major', ownMajor ? this.isDouble : false),
				mine: ownMajor
			});
			if (mine && !ownMajor)
				out.push({
					subject,
					label,
					scope: `${label.toLowerCase()} ${mine.role}`,
					role: read(mine.role, false),
					mine: true
				});
		}
		return out;
	}

	/** each programme's colour on this plan, kept apart when two subjects'
	 *  own hues are too close to tell apart (planner/hues.ts) */
	hues = $derived(
		distinctHues(
			this.programmes.map((p) => p.subject),
			(s) => subjectById(s).hue
		)
	);
	hueFor(subject: string): number | undefined {
		return this.hues.get(subject);
	}

	/** the hue a chip/card wears: its programme's colour on this plan
	 *  (undefined for KCCS, other-dept. courses and the open minor) */
	hueOf(code: string): number | undefined {
		const i = this.programmeOf(code);
		return i >= 0 ? this.hueFor(this.programmes[i].subject) : undefined;
	}

	isAudit(code: string): boolean {
		return this.audited.includes(code);
	}

	toggleAudit(code: string) {
		// marking an audit is a decision about YOUR plan, not the preview
		this.#touch();
		this.audited = this.audited.includes(code) ? this.audited.filter((c) => c !== code) : [...this.audited, code];
	}

	gradeOf(code: string): GradeMark | undefined {
		return this.grades[code];
	}

	/** set a course's grade / status, or clear it with null. A U fails the
	 *  course: that attempt stays where it was, as a record, and the course is
	 *  free to place again. Re-grading a failed attempt brings it back. */
	setGrade(code: string, mark: GradeMark | null) {
		if (mark === 'U' && !isAttemptId(code) && this.onBoard(code)) {
			this.#fail(code);
			return;
		}
		if (isAttemptId(code) && mark !== 'U') {
			this.#unfail(code, mark);
			return;
		}
		if (mark) {
			this.grades = { ...this.grades, [code]: mark };
		} else {
			const { [code]: _drop, ...rest } = this.grades;
			this.grades = rest;
		}
	}

	/** the slot a board id sits in */
	#slotOf(id: string): SlotKey | undefined {
		return Object.keys(this.placements).find((key) => this.placements[key].includes(id));
	}

	/** swap one board id for another in place, grade, audit and canvas spot following */
	#rename(from: string, to: string, mark: GradeMark | null) {
		const key = this.#slotOf(from);
		if (!key) return;
		this.#touch();
		this.placements[key] = this.placements[key].map((c) => (c === from ? to : c));
		const { [from]: _gone, ...rest } = this.grades;
		this.grades = mark ? { ...rest, [to]: mark } : rest;
		if (from in this.zoomPos) {
			this.zoomPos[to] = this.zoomPos[from];
			delete this.zoomPos[from];
		}
		if (this.selectedId === from) this.selectedId = isAttemptId(to) ? to : null;
	}

	#fail(code: string) {
		let n = 1;
		while (this.onBoard(attemptId(code, n))) n++;
		this.audited = this.audited.filter((c) => c !== code); // an audit has no grade to fail
		this.#rename(code, attemptId(code, n), 'U');
		// the panel was on this course: stay with the attempt, not the empty code
		if (this.#selected?.code === baseCode(code)) this.selectedId = attemptId(code, n);
	}

	#unfail(id: string, mark: GradeMark | null) {
		const base = baseCode(id);
		if (this.onBoard(base)) {
			this.#setFlash(`${this.courseLabel(base)} is already retaken on the plan, remove that first`);
			return;
		}
		this.#rename(id, base, mark);
		if (this.#selected?.code === base) this.selectedId = null;
	}

	/** the code a placed course should read as on the grid: the one from
	 *  the student's own programme (HIST235 for a historian) when the
	 *  cross-listed course belongs to exactly one of their subjects */
	shownCode(code: string): string {
		const c = byCode(code);
		const inProgramme = this.selectedSubjects.filter((s) => c.subjects.includes(s));
		return inProgramme.length === 1 ? (c.codesBySubject[inProgramme[0]] ?? c.code) : c.code;
	}

	/** Shared course label: whichever of the code / title switches above the grid
	 *  are on. Both on reads "COMP236 · Digitalization and Society" */
	courseLabel(code: string, displayCode?: string): string {
		if (!hasCode(code)) return code;
		const parts: string[] = [];
		if (this.showCodes) parts.push(displayCode ?? this.shownCode(code));
		if (this.showTitles) parts.push(byCode(code).title);
		return parts.join(' · ');
	}

	trimName(year: number, trim: TrimNum): string {
		return trimName(year, trim, this.trimNaming);
	}
	trimSpelled(year: number, trim: TrimNum): string {
		return trimSpelled(year, trim, this.trimNaming);
	}

	/** flip one of the label switches, keeping at least one of them on */
	toggleLabel(which: 'code' | 'title') {
		if (which === 'code') {
			this.showCodes = !this.showCodes;
			if (!this.showCodes) this.showTitles = true;
		} else {
			this.showTitles = !this.showTitles;
			if (!this.showTitles) this.showCodes = true;
		}
	}

	// ── slot helpers ──
	slotCourses(year: number, trim: TrimNum): string[] {
		return this.placements[slotKey(year, trim)] ?? [];
	}

	slotCredits(year: number, trim: TrimNum): number {
		return this.slotCourses(year, trim).reduce((sum, code) => sum + byCode(code).credits, 0);
	}

	/** the trimesters past the degree's first year holding more than
	 *  TRIM_STANDARD_MAX (but not over the hard cap), each one uses an
	 *  extra-load allowance, and only HEAVY_TRIMS_ALLOWED are allowed */
	heavyTrimesters = $derived(
		this.years
			.filter((y) => y !== 1)
			.flatMap(
				(year) =>
					TRIMS.filter((t) => {
						const c = this.slotCredits(year, t);
						return c > TRIM_STANDARD_MAX && c <= TRIM_HARD_MAX;
					}).length
			)
			.reduce((a, b) => a + b, 0)
	);

	/** A trimester's credit load against the drop form, as its footer shows it.
	 *  Year 1 (the foundation core) and a year past the degree's length are
	 *  exempt, as in the hints. 'heavy' is allowed, but only HEAVY_TRIMS_ALLOWED
	 *  times in the whole tenure. 'over' is what the corner shows red: past the
	 *  hard cap, or heavy once more trimesters are heavy than the allowance
	 *  covers. A fine load says nothing about other rules. */
	slotLoad(
		year: number,
		trim: TrimNum
	): { credits: number; status: 'exempt' | 'under' | 'ok' | 'heavy' | 'over'; note: string } {
		const credits = this.slotCredits(year, trim);
		if (this.breaks[slotKey(year, trim)]) return { credits, status: 'exempt', note: '' };
		if (year === 1 || year > (this.fourYear ? 4 : 3)) return { credits, status: 'exempt', note: '' };
		if (credits > TRIM_HARD_MAX) return { credits, status: 'over', note: `over the ${TRIM_HARD_MAX}-credit cap` };
		if (credits > TRIM_STANDARD_MAX)
			return this.heavyTrimesters > HEAVY_TRIMS_ALLOWED
				? {
						credits,
						status: 'over',
						note: `over ${TRIM_STANDARD_MAX}, more than the ${HEAVY_TRIMS_ALLOWED} heavy trimesters allowed`
					}
				: {
						credits,
						status: 'heavy',
						note: `heavy: over ${TRIM_STANDARD_MAX}, allowed ${HEAVY_TRIMS_ALLOWED} times in the degree`
					};
		if (credits < TRIM_MIN) return { credits, status: 'under', note: `under the ${TRIM_MIN}-credit minimum` };
		return { credits, status: 'ok', note: '' };
	}

	/** trimester GPA for a slot, credit-weighted over its letter-graded,
	 *  non-audit courses; null when nothing there carries a grade */
	slotTgpa(year: number, trim: TrimNum): number | null {
		const items: { points: number; credits: number }[] = [];
		for (const code of this.slotCourses(year, trim)) {
			const g = this.grades[code];
			if (this.isAudit(code) || !isGradeLetter(g)) continue;
			items.push({ points: GRADE_POINTS[g], credits: byCode(code).credits });
		}
		return weightedGpa(items);
	}

	/** GPA across a whole year's letter-graded, non-audit courses; null when
	 *  none of that year's courses are graded */
	yearGpa(year: number): number | null {
		const items: { points: number; credits: number }[] = [];
		for (const trim of TRIMS) {
			for (const code of this.slotCourses(year, trim)) {
				const g = this.grades[code];
				if (this.isAudit(code) || !isGradeLetter(g)) continue;
				items.push({ points: GRADE_POINTS[g], credits: byCode(code).credits });
			}
		}
		return weightedGpa(items);
	}

	// ── the drop laws: core-only slots, trimester offering, eligible years, prereq order ──
	canDrop(code: string, year: number, trim: TrimNum): boolean {
		if (this.breaks[slotKey(year, trim)]) return false; // on a break, nothing goes in
		if (byCode(code).pendingCredits && byCode(code).credits === 0) return false;
		// year-1 t1/t2: any foundation course drops anywhere here, always,
		// the max-4 rule is soft (the hints police it), nothing else applies
		if (this.coreOnly(year, trim)) return isCore(code);
		const course = byCode(code);
		// no term info → allow anywhere
		if (course.offered.length && !course.offered.includes(trim)) return false;
		// a 300-level course must not light up a year-2 slot (a fifth year
		// is open to whatever a fourth year is)
		if (course.eligibleYears.length && !course.eligibleYears.includes(Math.min(year, 4))) return false;
		// placed prereqs must stay strictly earlier (unplaced ones only warn);
		// a substitute (Proofs&Ideas ⇄ Discrete Maths ⇄ Maths Foundations)
		// placed earlier satisfies it too
		const order = year * 10 + trim;
		for (const pre of course.prereqs) {
			const subs = hasCode(pre) ? satisfiedBy(pre) : [];
			const ats = this.placed.filter((p) => p.code === pre || subs.includes(p.code));
			if (ats.length && !ats.some((at) => at.year * 10 + at.trim < order)) return false;
		}
		return true;
	}

	// ── actions ──
	/** put a course in a slot, at position `at` among the slot's other
	 *  courses (where it was dropped between them), or on the end */
	place(code: string, year: number, trim: TrimNum, at?: number) {
		if (isAttemptId(code)) return; // a failed attempt is a record, not something to move
		const off = this.breaks[slotKey(year, trim)];
		if (off) {
			this.#setFlash(
				`${this.trimName(year, trim)} is marked as ${BREAK_KINDS[off.kind].label === 'away' ? 'a term away' : `a ${BREAK_KINDS[off.kind].label}`}, open it to take that off first`
			);
			return;
		}
		if (byCode(code).pendingCredits && byCode(code).credits === 0) {
			this.#setFlash('Credit value needs confirmation in admin before this course can count toward your plan.');
			return;
		}
		if (this.coreOnly(year, trim) && !isCore(code)) {
			// a bounced drop is not an edit, stay where we are
			this.#setFlash(`${this.trimName(1, trim)} takes foundation (KCCS) courses only`);
			return;
		}
		this.#touch();
		// a 5th foundation course IS taken (so t1⇄t2 shuffles and retake
		// planning stay fluid even when both slots are full), the hints
		// flag the over-max slot until it's resolved
		if (this.coreOnly(year, trim) && this.slotCourses(year, trim).filter((c) => c !== code).length >= Y1_CORE_MAX) {
			this.#setFlash(`${this.trimName(1, trim)} is over the ${Y1_CORE_MAX}-course max now, move one out`);
		}
		// a slot the course isn't offered in (or open to) still takes the
		// drop, the hints call it out instead of the drop bouncing
		this.remove(code); // moving = remove from wherever it was first
		const key = slotKey(year, trim);
		const list = [...(this.placements[key] ?? [])];
		list.splice(at ?? list.length, 0, code);
		this.placements[key] = list;
	}

	remove(code: string) {
		// already a no-op when place() passed the gate on the way in
		this.#touch();
		for (const key of Object.keys(this.placements)) {
			if (this.placements[key].includes(code)) {
				this.placements[key] = this.placements[key].filter((c) => c !== code);
				if (this.placements[key].length === 0) delete this.placements[key];
			}
		}
		delete this.zoomPos[code]; // off the plan → its canvas spot is forgotten
		if (isAttemptId(code)) {
			// a failed attempt taken off the board takes its U with it
			const { [code]: _u, ...rest } = this.grades;
			this.grades = rest;
		}
	}

	clearSlot(year: number, trim: TrimNum) {
		this.#touch();
		delete this.placements[slotKey(year, trim)];
	}

	/** one more year on the grid, up to a fifth */
	addYear() {
		if (this.years.length < this.maxYears) this.yearCount = this.years.length + 1;
	}

	/** take the last year off the grid, and every course on it off the plan,
	 *  so nothing is left placed in a year that can't be seen */
	removeYear() {
		if (!this.canRemoveYear) return;
		const year = this.years.length;
		const codes = TRIMS.flatMap((t) => this.placements[slotKey(year, t)] ?? []);
		if (codes.length) this.#touch();
		for (const t of TRIMS) delete this.placements[slotKey(year, t)];
		for (const code of codes) delete this.zoomPos[code];
		if (this.zoom?.year === year) this.zoom = null;
		this.yearCount = year - 1;
	}

	/** the trailing years past the degree's length that hold no course */
	#dropEmptyYears() {
		let last = this.years.length;
		while (last > this.minYears && TRIMS.every((t) => !this.placements[slotKey(last, t)]?.length)) last--;
		this.yearCount = last;
	}

	/** wipe everything back to the freshly-seeded recommended plan */
	reset() {
		this.trimNaming = 'year';
		this.breaks = {};
		this.now = null;
		this.audited = [];
		this.grades = {};
		this.showCodes = true;
		this.showTitles = false;
		this.creditTargetMode = 'minimum';
		this.selected = null;
		this.zoom = null;
		this.zoomPos = {}; // nothing is where the student put it any more
		this.yearCount = 4;
		this.waived = []; // waived rules were about courses that are now gone
		// start over = the fresh-visit state exactly: the recommended path on
		// the grid, untouched, so picking a different degree re-lays it out
		this.touched = false;
		this.seedRecommended();
	}

	/** Every mutating action passes through here. There is one plan and it is
	 *  always editable, this only records that the student has made it theirs,
	 *  which is what stops a later programme change from re-laying it out. */
	#touch() {
		this.touched = true;
	}

	/** A sidebar programme control changed. Every surface answers at once, the
	 *  catalogue re-sorts and re-filters, every chip recolours, so the motion
	 *  is damped for this render (see quietRedraw) instead of a few hundred
	 *  cards flying.
	 *
	 *  A plan nobody has edited yet is still the example it arrived as, so it
	 *  re-lays itself out for the new degree, a first visit never shows
	 *  someone else's courses. Once the student has changed anything, the grid
	 *  never moves: every course stays exactly where it is, and the new
	 *  degree's recommendation shows underneath as dashed ghosts in the slots
	 *  it would use. The board's footer then offers the bulk moves, add the
	 *  required courses, take every suggestion, drop the courses that no
	 *  longer count, so the student decides what changes. */
	programmeChanged() {
		quietRedraw();
		if (!this.fourYear && this.structure === 'major-minor-conc') this.structure = 'major-minor';
		this.ensureDistinctPicks();
		// switching to 4 years brings year 4 back; switching to 3 takes off the
		// years past the third that hold nothing, one with courses stays, so
		// nothing placed there is hidden or lost
		if (this.yearCount < this.minYears) this.yearCount = this.minYears;
		if (!this.touched) this.seedRecommended();
		if (!this.fourYear) this.#dropEmptyYears();
		const missing = this.missingRequiredCodes.length;
		const strays = this.otherPlacedCodes.length;
		if (missing || strays)
			this.#setFlash(
				[
					missing && `${missing} required course${missing === 1 ? '' : 's'} to add`,
					strays && `${strays} no longer count${strays === 1 ? 's' : ''}`
				]
					.filter(Boolean)
					.join(' · ') + ', see the buttons under the grid'
			);
	}

	/** what a role's dropdown lists, see planner/picks.ts */
	pickOptions(role: PickRole) {
		return pickOptions(this.structure, this.picks, role, this.batchStartYear);
	}

	/** no two roles may hold the same subject: after a pick or a change of
	 *  degree, a later role on an earlier one's subject moves along */
	ensureDistinctPicks() {
		keepPicksDistinct(this.structure, this.picks, this.batchStartYear);
	}

	/** the first-visit welcome: lay out the suggested path for the programmes
	 *  answered so far, adding only what's new. courses already on the grid
	 *  stay put, so it fills in rather than reshuffling with every answer; a
	 *  programme switched away takes its courses with it */
	growRecommended(programmes: Programme[]) {
		const target = recommendedPath(this, programmes);
		const wanted = new Set(Object.values(target).flat());
		const grid: Record<SlotKey, string[]> = {};
		for (const [slot, codes] of Object.entries(this.placements))
			grid[slot as SlotKey] = codes.filter((c) => wanted.has(c));
		const placed = new Set(Object.values(grid).flat());
		for (const [slot, codes] of Object.entries(target))
			for (const code of codes) if (!placed.has(code)) (grid[slot as SlotKey] ??= []).push(code);
		this.placements = grid;
	}

	/** fill the grid with the suggested path for the chosen programmes (see
	 *  planner/recommended.ts), replacing whatever is on it. called when an
	 *  untouched plan's degree changes */
	seedRecommended() {
		quietRedraw(); // every chip is about to change at once, fade, don't fly
		this.placements = Object.fromEntries(Object.entries(this.recommended).map(([key, codes]) => [key, [...codes]]));
	}

	/** the department's suggested path for the current programme; derived,
	 *  not stored, so it's never a second plan to get lost in (planner/recommended.ts) */
	recommended: Record<SlotKey, string[]> = $derived.by(() => recommendedPath(this));

	/** the elective room the path leaves, as placeholder credits per trimester */
	recommendedElectives: Record<SlotKey, number> = $derived.by(() => recommendedElectives(this));

	/** The elective credits the degree actually leaves open, quoted rather
	 *  than the box count, because a remainder that isn't a whole number of
	 *  4-credit courses (a history major + physics minor leaves 2 spare) would
	 *  otherwise be rounded away in the one place the figure matters. */
	recommendedElectiveCredits = $derived(
		Math.max(
			0,
			this.creditTarget -
				Object.values(this.recommended)
					.flat()
					.reduce((sum, code) => sum + byCode(code).credits, 0)
		)
	);

	/** electives the reference plan suggests for one cell */
	electivesFor(year: number, trim: TrimNum): number {
		return this.recommendedElectives[slotKey(year, trim)] ?? 0;
	}

	// ── the suggestion layer ──
	// Where your plan and the recommendation differ, in the recommendation's
	// own slots. A course you have placed somewhere ELSE is not suggested, you
	// have made your call about it, and neither is one an interchangeable
	// substitute already covers (Discrete Maths standing in for Proofs).
	suggestions: Record<SlotKey, string[]> = $derived.by(() => {
		const out: Record<SlotKey, string[]> = {};
		for (const [key, codes] of Object.entries(this.recommended)) {
			if (this.breaks[key]) continue; // nothing is suggested into a break
			const open = codes.filter(
				(code) => !this.placedCodes.has(code) && !satisfiedBy(code).some((sub) => this.placedCodes.has(sub))
			);
			if (open.length) out[key] = open;
		}
		return out;
	});

	suggestedCodes = $derived(new Set(Object.values(this.suggestions).flat()));
	suggestionCount = $derived(this.suggestedCodes.size);

	/** the recommendation's ghosts for one cell */
	suggestionsFor(year: number, trim: TrimNum): string[] {
		return this.welcoming ? [] : (this.suggestions[slotKey(year, trim)] ?? []);
	}

	/** take one suggestion: it lands in the slot the recommendation put it in */
	acceptSuggestion(code: string) {
		for (const [key, codes] of Object.entries(this.suggestions)) {
			if (!codes.includes(code)) continue;
			const { year, trim } = parseSlot(key);
			this.place(code, year, trim);
			return;
		}
	}

	/** take every outstanding suggestion at once */
	acceptAllSuggestions() {
		quietRedraw(); // the board fills in one go, fade, don't fly
		this.#touch();
		const next: Record<SlotKey, string[]> = Object.fromEntries(
			Object.entries(this.placements).map(([key, codes]) => [key, [...codes]])
		);
		for (const [key, codes] of Object.entries(this.suggestions)) {
			next[key] = [...(next[key] ?? []), ...codes];
		}
		this.placements = next;
	}

	/** Throw the plan away and start from the reference plan. The one action
	 *  besides "start over" that discards work, so it is never something an
	 *  edit does by itself, the panel asks twice before calling it. Grades and
	 *  audits go with it: they were about courses that are no longer here. */
	useRecommended() {
		this.breaks = {}; // the suggested path knows nothing of them
		this.seedRecommended();
		this.zoomPos = {};
		this.audited = this.audited.filter((c) => this.placedCodes.has(c));
		this.grades = Object.fromEntries(Object.entries(this.grades).filter(([code]) => this.placedCodes.has(code)));
		this.selected = null;
		this.zoom = null;
		this.touched = true; // they chose this plan, so it is theirs now
		this.#setFlash('the suggested path is now your plan');
	}

	// ── the required courses of every chosen programme not yet on the grid ──
	// a placed substitute satisfies a requirement (MATH191 for COMP201)
	missingRequiredCodes: string[] = $derived.by(() => {
		const out = new Set(this.programmes.flatMap((_, i) => this.requiredLeftFor(i)));
		for (const c of CORE_COURSES) if (!this.placedCodes.has(c.code)) out.add(c.code);
		return [...out];
	});

	/** one programme's required courses still to place */
	requiredLeftFor(i: number): string[] {
		if (this.programmes[i].subject === 'open') return [];
		return [...this.programmeSets[i].required].filter(
			(code) =>
				hasCode(code) && !this.placedCodes.has(code) && !satisfiedBy(code).some((sub) => this.placedCodes.has(sub))
		);
	}

	// ── filling in the plan, see fill.ts ──
	#fill = $derived.by(() => planFill(this));

	/** how many courses fillIn() adds */
	fillCount = $derived.by(() => this.#fill.added);

	fillIn() {
		const { next, added, unplaced } = this.#fill;
		if (!added) return;
		quietRedraw(); // the board fills in one go, fade, don't fly
		this.#touch();
		this.placements = next;
		this.#setFlash(
			unplaced.length
				? `filled in, but no trimester has room for ${unplaced.map((c) => this.courseLabel(c)).join(', ')} under the recommended load`
				: 'filled in: every required course is on your plan'
		);
	}

	// ── clearing out the strays ──
	// Courses on the grid that count toward none of the declared programmes:
	// a different department's course that isn't in any of your required or
	// elective lists (the green 'other' chips). The foundation core is never
	// one of these, every student takes it, and neither is anything in your
	// own department, which counts as a subject elective.
	otherPlacedCodes = $derived([...this.placedCodes].filter((code) => this.courseType(code) === 'other'));

	/** drop every placed course that counts toward no chosen programme */
	removeOtherCourses() {
		const n = this.otherPlacedCodes.length;
		this.removeCourses(
			this.otherPlacedCodes,
			`removed ${n} course${n === 1 ? '' : 's'} that count toward no programme`
		);
	}

	/** take a set of courses off the grid at once, then say so */
	removeCourses(codes: Iterable<string>, flash: string) {
		const drop = new Set(codes);
		if (!drop.size) return;
		quietRedraw(); // several chips leave at once, fade, don't fly
		this.#touch();
		const next: Record<SlotKey, string[]> = {};
		for (const [key, codes] of Object.entries(this.placements)) {
			const kept = codes.filter((c) => !drop.has(c));
			if (kept.length) next[key] = kept;
		}
		this.placements = next;
		for (const code of drop) delete this.zoomPos[code];
		this.#setFlash(flash);
	}

	/** is any filter narrowing the catalogue */
	get narrowed(): boolean {
		return !!(
			this.catalogueSubject ||
			this.filters.length ||
			this.quick.length ||
			this.kinds.length ||
			this.catalogueTerms.length ||
			this.catalogueCredits.length
		);
	}

	clearNarrowing() {
		this.catalogueSubject = '';
		this.filters = [];
		this.quick = [];
		this.kinds = [];
		this.catalogueTerms = [];
		this.catalogueCredits = [];
	}

	toggleFilter(subjectId: string) {
		if (this.filters.includes(subjectId)) {
			this.filters = this.filters.filter((f) => f !== subjectId);
			return;
		}
		this.filters = [...this.filters, subjectId];
	}

	#setFlash(msg: string) {
		this.flash = msg;
		clearTimeout(this.#flashTimer);
		this.#flashTimer = setTimeout(() => (this.flash = null), 2500);
	}

	// ── waivers ──
	// A red hint states a rule the university actually enforces, but it is
	// enforced by the registry, not by us, and students do get prerequisite
	// waivers, one-off offerings and year exemptions all the time. So every
	// warn hint carries a stable `id` and can be crossed off: the rule stops
	// counting against the plan (no red chip, no tinted cell) until the
	// student brings it back, and the waiver survives a reload.
	waiveHint(id: string) {
		if (!this.waived.includes(id)) this.waived = [...this.waived, id];
	}

	unwaiveHint(id: string) {
		this.waived = this.waived.filter((w) => w !== id);
	}

	// ── the laws → hints, see planner/rules.ts ──
	allHints: Hint[] = $derived.by(() => planHints(this));

	/** what the panel and the grid answer to: every hint the student has not
	 *  crossed off */
	hints: Hint[] = $derived(this.allHints.filter((h) => !h.id || !this.waived.includes(h.id)));

	/** the crossed-off hints that STILL apply, a waived rule the student has
	 *  since fixed simply drops out of the list (its id stays waived, so
	 *  breaking the same rule again is still crossed off) */
	waivedHints: Hint[] = $derived(this.allHints.filter((h) => h.id && this.waived.includes(h.id)));

	/** codes named in any hint → bold on the grid */
	flaggedCodes = $derived(new Set(this.hints.flatMap((h) => h.codes)));
	/** the worst hint naming each course, the shape its chip's marker takes.
	 *  'good' notes never mark a chip: the required dot is already a circle. */
	flagKinds = $derived.by(() => {
		const rank = { warn: 0, caution: 1, info: 2, good: 3 };
		const out = new Map<string, Hint['kind']>();
		for (const h of this.hints) {
			if (h.kind === 'good') continue;
			for (const code of h.codes) {
				const was = out.get(code);
				if (!was || rank[h.kind] < rank[was]) out.set(code, h.kind);
			}
		}
		return out;
	});
	/** codes named in a WARN hint → their cell gets tinted */
	warnCodes = $derived(new Set(this.hints.filter((h) => h.kind === 'warn').flatMap((h) => h.codes)));

	slotHasProblem(year: number, trim: TrimNum): boolean {
		return this.slotCourses(year, trim).some((code) => this.warnCodes.has(code));
	}

	// ── which programme each placed course counts toward (see credits.ts) ──
	claims: Map<string, number[]> = $derived.by(() => claimCredits(this));
	stats: ProgrammeStat[] = $derived.by(() => programmeStats(this));

	/** the 'choose N from' groups, see choices.ts */
	choices = $derived.by(() => choicePools(this));

	// ── catalogue (filtered + sorted) ──
	catalogueSubject = $state('');

	// the trimesters still open to you, after the one you're in
	laterSlots = $derived(
		this.years
			.flatMap((year) => this.trims.map((trim) => ({ year, trim })))
			.filter(
				({ year, trim }) =>
					slotOrder(year, trim) > slotOrder(this.here.year, this.here.trim) && !this.breaks[slotKey(year, trim)]
			)
	);
	#neededCodes = $derived(new Set(this.missingRequiredCodes.map((code) => byCode(code).code)));

	/** canDrop lets an unplaced prerequisite through with a warning; ready doesn't */
	#readyAt(course: Course, year: number, trim: TrimNum): boolean {
		const order = slotOrder(year, trim);
		return (
			this.canDrop(course.code, year, trim) &&
			course.prereqs.filter(hasCode).every((pre) => {
				const met = [pre, ...satisfiedBy(pre)];
				return this.placed.some((p) => met.includes(p.code) && slotOrder(p.year, p.trim) < order);
			})
		);
	}

	#passesQuick(course: Course): boolean {
		return this.quick.every((filter) => {
			if (filter === 'needed')
				return (
					this.#neededCodes.has(course.code) &&
					this.laterSlots.some(({ trim }) => !course.offered.length || course.offered.includes(trim))
				);
			if (this.placedCodes.has(course.code)) return false;
			if (filter === 'next') {
				const next = this.laterSlots[0];
				return !!next && this.canDrop(course.code, next.year, next.trim);
			}
			return filter === 'unplanned' || this.laterSlots.some(({ year, trim }) => this.#readyAt(course, year, trim));
		});
	}

	catalogue: Course[] = $derived(
		selectCatalogue({
			search: this.search,
			filters: this.filters,
			kinds: this.kinds,
			terms: this.catalogueTerms,
			credits: this.catalogueCredits,
			sort: this.catalogueSort,
			quick: (course) => this.#passesQuick(course),
			selectedSubjects: this.selectedSubjects,
			subject: this.catalogueSubject,
			trim: this.zoom?.trim,
			reveal: this.catalogueReveal?.code,
			courseType: (code) => this.courseType(code)
		})
	);
}

// which programme each placed course counts toward, and what that adds up to.
// plain functions of the plan, like rules.ts; the store derives from them.
import {
	byCode,
	creditsFor,
	creditsOfCodes,
	CREDIT_SHARE_DEFAULT,
	isCore,
	isTranscriptOnly,
	requiredCreditsFor,
	requiredSetFor,
	satisfiedBy,
	subjectById
} from '$lib/curriculum/data';
import type { Course, ProgrammeStat } from '$lib/types';
import type { Plan } from './plan.svelte';
import { ofSubject } from './programmeSets';

/** Match a required course using the same directed equivalences as missing-course hints. */
function satisfiesStructure(course: Course, codes: Set<string>): boolean {
	return [...codes].some(
		(code) => course.codes.includes(code) || satisfiedBy(code).some((sub) => course.codes.includes(sub))
	);
}

/** can programme i take this course's credits at all? */
function countsFor(plan: Plan, c: Course, i: number): boolean {
	if (isTranscriptOnly(c.code)) return false;
	const prog = plan.programmes[i];
	if (prog.subject === 'open') return !isCore(c.code);
	const s = plan.programmeSets[i];
	// is the course named in this programme's scraped required / choice /
	// elective lists for the exact variant?
	const inLists =
		satisfiesStructure(c, s.requiredAll) || satisfiesStructure(c, s.pick) || c.codes.some((x) => s.elective.has(x));
	// a minor counts ONLY the courses its scraped structure names, not
	// every course in the department, so cross-listed or extra
	// department courses don't inflate its credits
	if (prog.role === 'minor') return inLists;
	return ofSubject(c, prog.subject) || inLists;
}

/** the declared programmes (by index) a course could count toward: those
 *  that take it on their own, plus any it is cross-listed into. Two or
 *  more and the student may choose (Plan.countsToward) */
export function creditTakers(plan: Plan, c: Course): number[] {
	if (isTranscriptOnly(c.code)) return [];
	return plan.programmes
		.map((_, i) => i)
		.filter((i) => {
			const prog = plan.programmes[i];
			return prog.subject !== 'open' && (countsFor(plan, c, i) || c.subjects.includes(prog.subject));
		});
}

/** Ordinary cross-listed courses follow the configured sharing policy, unless the
 * student chose where one counts (Plan.countsToward).
 * Explicit required-course equivalences satisfy both programme tallies;
 * totalPlacedCredits still counts the actual course only once. */
export function claimCredits(plan: Plan): Map<string, number[]> {
	const counts = (c: Course, i: number) => countsFor(plan, c, i);
	// …unless /admin has set the course (or the whole site) to share its
	// credits: then it counts toward EVERY declared programme it satisfies.
	// The open minor still only takes what no declared programme did.
	//
	// A course counted once goes where it is needed: first to a programme
	// that requires it (or has it in a 'choose N' pool), then to the first
	// that still has credits to fill, and only when every one is full to the
	// first that takes it, so a cross-listed elective doesn't vanish into
	// a major that is already complete while the minor still needs it.
	const claimedBy = new Map<string, number[]>();
	const room = plan.programmes.map((prog) =>
		creditsFor(prog.subject, prog.role, plan.fourYear, plan.isDouble, plan.batchStartYear)
	);
	const requires = (c: Course, i: number) => {
		const sets = plan.programmeSets[i];
		return satisfiesStructure(c, sets.requiredAll) || satisfiesStructure(c, sets.pick);
	};
	const claim = (c: Course, i: number) => {
		claimedBy.set(c.code, [...(claimedBy.get(c.code) ?? []), i]);
		room[i] -= c.credits;
	};
	const courses = plan.placed.map((p) => byCode(p.code));
	// required courses first, so an elective never takes a programme's room
	// from the course it actually demands; then the courses only one
	// programme takes, so a cross-listed one that could count for either
	// fills whichever still has room
	const takersOf = (c: Course) => plan.programmes.filter((prog, i) => prog.subject !== 'open' && counts(c, i)).length;
	const ordered = [
		...courses.filter((c) => plan.programmes.some((_, i) => requires(c, i))),
		...courses.filter((c) => !plan.programmes.some((_, i) => requires(c, i))).sort((a, b) => takersOf(a) - takersOf(b))
	];
	for (const c of ordered) {
		// the student said where it counts: exactly those, nothing automatic
		const chosen = plan.countsToward[c.code];
		if (chosen?.length) {
			const picked = creditTakers(plan, c).filter((i) => chosen.includes(plan.programmes[i].subject));
			if (picked.length) {
				for (const i of picked) claim(c, i);
				continue;
			}
		}
		const takers = plan.programmes.map((_, i) => i).filter((i) => counts(c, i));
		const declared = takers.filter((i) => plan.programmes[i].subject !== 'open');
		const equivalentRequirement = declared.some((i) => {
			const sets = plan.programmeSets[i];
			return [...sets.requiredAll, ...sets.pick].some(
				(code) => !c.codes.includes(code) && satisfiedBy(code).some((sub) => c.codes.includes(sub))
			);
		});
		if (((c.share ?? CREDIT_SHARE_DEFAULT) === 'all' || equivalentRequirement) && declared.length) {
			for (const i of declared) claim(c, i);
			continue;
		}
		const pick =
			declared.find((i) => requires(c, i)) ??
			declared.find((i) => room[i] > 0) ??
			takers.find((i) => plan.programmes[i].subject === 'open' && room[i] > 0) ??
			declared[0] ??
			takers[0];
		if (pick !== undefined) claim(c, pick);
	}
	return claimedBy;
}

/** each programme's progress, for the hints panel */
export function programmeStats(plan: Plan): ProgrammeStat[] {
	const claimedBy = plan.claims;
	return plan.programmes.map((prog, i) => {
		const total = creditsFor(prog.subject, prog.role, plan.fourYear, plan.isDouble, plan.batchStartYear);
		const sets = plan.programmeSets[i];
		// only the courses this programme has claimed (see above)
		const mine = plan.placed.filter((p) => claimedBy.get(p.code)?.includes(i)).map((p) => byCode(p.code));
		const placedCredits = mine.reduce((s, c) => s + c.credits, 0);
		// the open minor has no course list of its own, its claimed courses
		// are whatever isn't foundation core and no declared programme took
		if (prog.subject === 'open') {
			return {
				role: prog.role,
				subject: prog.subject,
				label: 'open minor',
				totalCredits: total,
				creditsLeft: Math.max(0, total - placedCredits),
				requiredDone: 0,
				requiredNeeded: 0,
				electiveDone: Math.min(total, placedCredits),
				electiveNeeded: total,
				requiredLeft: []
			};
		}
		// everything that satisfies the required structure, the fixed
		// core closed over prereqs (incl. a cross-department prereq that
		// fills the credit budget, like BIOS201 for env studies) plus the
		// choice pools. requiredAll (not required) so those support courses
		// still count toward the degree's required credits.
		const structure = new Set([...sets.requiredAll, ...sets.pick]);
		// what the degree *demands* comes from the site's own credit table
		// when stated, the course list overstates it when it's choice
		// pools (history: pick 3 of 5 methodology courses)
		const requiredNeeded =
			requiredCreditsFor(prog.subject, prog.role, plan.fourYear, plan.isDouble, plan.batchStartYear) ??
			creditsOfCodes(requiredSetFor(prog.subject, prog.role, plan.fourYear, plan.isDouble, plan.batchStartYear));
		const requiredDone = Math.min(
			requiredNeeded,
			mine.filter((c) => satisfiesStructure(c, structure)).reduce((s, c) => s + c.credits, 0)
		);
		return {
			role: prog.role,
			subject: prog.subject,
			label: subjectById(prog.subject).label,
			totalCredits: total,
			creditsLeft: Math.max(0, total - placedCredits),
			requiredDone,
			requiredNeeded,
			electiveDone: Math.min(Math.max(0, total - requiredNeeded), Math.max(0, placedCredits - requiredDone)),
			electiveNeeded: Math.max(0, total - requiredNeeded),
			requiredLeft: plan.requiredLeftFor(i)
		};
	});
}

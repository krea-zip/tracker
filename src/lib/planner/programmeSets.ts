// what a programme asks for, in the exact variant on the plan, and what that
// makes of a course. from the scraped website structure (requirements.json).
import {
	byCode,
	capstoneFor,
	electiveSetFor,
	isCapstone,
	isCore,
	isTranscriptOnly,
	pickSetFor,
	reachableIn,
	requiredCreditsFor,
	requiredSetFor,
	batchRuleFor,
	satisfiedBy
} from '$lib/curriculum/data';
import type { Course, CourseType, Programme } from '$lib/types';

/** a course of the department, which a major counts as a general elective
 *  even when its lists don't name it. not a capstone: that counts only where
 *  the programme's document takes one (setsFor) */
export const ofSubject = (c: Course, subject: string): boolean => c.subjects.includes(subject) && !isCapstone(c.code);

/** one programme's course lists, for the exact variant on the plan */
export type ProgrammeSets = {
	subject: string;
	required: Set<string>;
	requiredAll: Set<string>;
	pick: Set<string>;
	elective: Set<string>;
};

/** each programme's required / choice / elective sets, for the exact variant */
export function setsFor(programmes: Programme[], double: boolean, fourYear: boolean, batch: number): ProgrammeSets[] {
	return programmes.map((p) => {
		// start from the stated required core, THEN close over prerequisites
		//, but a prereq whose interchangeable partner is already required
		// (COMP321 needs MATH191, and COMP201 ⇄ MATH191 is already in) is
		// already satisfied, so it must not be added as a separate course.
		// `required` = what reads as required (lavender); `requiredAll` also
		// carries cross-department prereqs for the credit budget.
		const required = new Set(requiredSetFor(p.subject, p.role, fourYear, double, batch));
		// a capstone joins the programme's own lists: required where the
		// document says so, else one of the electives it stands in for
		const capstone = capstoneFor(p.subject, p.role, fourYear, double, batch);
		if (capstone?.required) required.add(capstone.code);
		const requiredAll = new Set(required);
		// the degree's stated required-credit figure, prereqs only fill
		// the budget up to it, so a course's biology prereq (BIOS201 for an
		// env-studies major) doesn't inflate the requirement past the table
		const cap = requiredCreditsFor(p.subject, p.role, fourYear, double, batch);
		let sum = [...requiredAll].reduce((s, c) => s + byCode(c).credits, 0);
		const queue = [...required];
		while (queue.length) {
			const code = queue.pop()!;
			for (const pre of byCode(code).prereqs) {
				if (!reachableIn(pre, fourYear) || requiredAll.has(pre)) continue;
				if (batchRuleFor(p.subject, p.role, fourYear, double, batch)?.courses[byCode(pre).code] === 'elective')
					continue;
				if (satisfiedBy(pre).some((s) => requiredAll.has(s))) continue;
				if (cap !== undefined && sum + byCode(pre).credits > cap) continue;
				requiredAll.add(pre);
				sum += byCode(pre).credits;
				queue.push(pre);
				// it only READS as required (white) if it's a course of this
				// subject, a cross-department prereq stays a green 'other'
				// support course (it's on the site's list nowhere)
				if (byCode(pre).subjects.includes(p.subject)) required.add(pre);
			}
		}
		return {
			subject: p.subject,
			required,
			requiredAll,
			// 'choose N from' pools, required choices, coloured as required
			pick: new Set(pickSetFor(p.subject, p.role, fourYear, double, batch)),
			elective: new Set([
				...electiveSetFor(p.subject, p.role, fourYear, double, batch),
				...(capstone && !capstone.required ? [capstone.code] : [])
			])
		};
	});
}

/** what a course is to these programmes */
export const meetsRequired = (course: Course, sets: ProgrammeSets): boolean =>
	[...sets.required, ...sets.pick].some(
		(code) => course.codes.includes(code) || satisfiedBy(code).some((sub) => course.codes.includes(sub))
	);

export function typeIn(code: string, sets: ProgrammeSets[]): CourseType {
	if (isCore(code)) return 'core'; // the foundation curriculum, everyone's requirement
	if (isTranscriptOnly(code)) return 'other'; // on the transcript, toward no programme
	const c = byCode(code);
	let role: CourseType = 'other';
	for (const s of sets) {
		if (meetsRequired(c, s)) return 'required';
		// in the variant's elective pool, OR simply a course in your
		// major/minor's own department (a general subject elective),
		// either way it's not 'other'. 'other' (untinted) is reserved for a
		// different department.
		if (c.codes.some((x) => s.elective.has(x)) || ofSubject(c, s.subject)) role = 'elective';
	}
	return role;
}

// the university's regulations as tracker reads them (credit loads, the
// foundation core, prerequisite order, year and trimester eligibility,
// audits, the credit ceiling, grades), turned into the hints the sidebar
// lists. a plain function of the plan so the rules can be read and tested
// on their own; the plan store derives `allHints` from it.
import type { Plan } from './plan.svelte';
import { offeredIn } from './calendar';
import {
	AUDIT_LIMIT,
	byCode,
	canAudit,
	CORE_COURSES,
	hasCode,
	HEAVY_TRIMS_ALLOWED,
	isCore,
	isTranscriptOnly,
	MATHS_COVERS,
	satisfiedBy,
	subjectById,
	TRIM_HARD_MAX,
	TRIM_MIN,
	TRIM_STANDARD_MAX,
	Y1_CORE_MAX
} from '$lib/curriculum/data';
import { GRAD_MIN_CGPA, recovery } from '$lib/planner/grades/grades';
import { slotKey, TRIMS, type Hint, type TrimNum } from '$lib/types';

/** every rule the plan is held to, as hints: worst first is the panel's job,
 *  this just states each broken (or satisfied) rule once */
export function planHints(plan: Plan): Hint[] {
	// a hint names courses the way the codes / titles switches say, like
	// the grid and the catalogue, so the two never disagree
	// hints name courses by code alone, titles on or off; the chips they point at carry the rest
	const code = (c: string) => (hasCode(c) ? plan.shownCode(c) : c);
	const hints: Hint[] = [];
	const pos = new Map<string, { year: number; trim: TrimNum; order: number }>();
	for (const p of plan.placed) pos.set(p.code, { year: p.year, trim: p.trim, order: p.year * 10 + p.trim });

	// law 0, every trimester of the tenure must reach the minimum
	// credits (not just the one being zoomed, the default plan should
	// already own up to its thin trimesters). Year 1 is exempt: t1/t2
	// are the foundation core and t3 carries no min or max at all.
	// An empty plan is under the minimum in EVERY trimester, so these are
	// gathered into one chip instead of nine identical ones, the panel is
	// meant to be read, and a wall of the same sentence isn't.
	const thin: { year: number; trim: TrimNum; credits: number }[] = [];
	for (const year of plan.years) {
		if (year === 1) continue;
		for (const trim of TRIMS) {
			const c = plan.slotCredits(year, trim);
			// a year past the degree's length (year 4 on a 3-year degree, a
			// fifth year) is optional spillover, an empty trimester there
			// is normal, not an under-loaded one
			if (year > (plan.fourYear ? 4 : 3) && c === 0) continue;
			if (plan.breaks[slotKey(year, trim)]) continue; // a break isn't under-loaded
			if (c < TRIM_MIN) thin.push({ year, trim, credits: c });
		}
	}
	if (thin.length) {
		// a credit-count issue is a caution (yellow), not a hard error,
		// you top a light trimester up with other courses
		hints.push({
			kind: 'caution',
			text:
				thin.length === 1
					? `${plan.trimName(thin[0].year, thin[0].trim)} has ${thin[0].credits} of the ${TRIM_MIN} credits it needs`
					: `under ${TRIM_MIN} credits: ${thin.map((t) => `${plan.trimName(t.year, t.trim)} ${t.credits}`).join(' · ')}`,
			codes: [],
			slots: thin.map((t) => slotKey(t.year, t.trim))
		});
	}

	// law 0.5, the foundation core: all twelve KCCS courses must be on
	// the plan (year-1 t1/t2 only ever hold them, max 4 each, the drop
	// laws enforce that; a stale save could still break it, so check too)
	const missingCore = CORE_COURSES.filter((c) => !plan.placedCodes.has(c.code));
	if (missingCore.length) {
		hints.push({
			kind: 'caution',
			text: `${missingCore.length} foundation course${missingCore.length === 1 ? '' : 's'} still to place`,
			codes: missingCore.map((c) => c.code),
			toPlace: missingCore.map((c) => c.code)
		});
	} else {
		hints.push({ kind: 'good', text: 'all foundation courses are on the plan', codes: [] });
	}
	for (const trim of [1, 2] as TrimNum[]) {
		const codes = plan.slotCourses(1, trim);
		const nonCore = codes.filter((c) => !isCore(c));
		if (nonCore.length) {
			hints.push({
				kind: 'warn',
				id: `core-only:1-${trim}`,
				text: `${plan.trimName(1, trim)} can only hold foundation (KCCS) courses`,
				codes: nonCore
			});
		}
		if (codes.length > Y1_CORE_MAX) {
			hints.push({
				kind: 'warn',
				id: `core-max:1-${trim}`,
				text: `${plan.trimName(1, trim)} can hold at most ${Y1_CORE_MAX} foundation courses (${codes.length}/${Y1_CORE_MAX})`,
				codes
			});
		}
	}

	// law 1, prerequisites must come in an earlier trimester. A placed
	// substitute (MATH191 ⇄ COMP201) satisfies the prerequisite too.
	for (const p of plan.placed) {
		const course = byCode(p.code);
		for (const pre of course.prereqs) {
			const subs = hasCode(pre) ? satisfiedBy(pre) : [];
			const placedAt = [pos.get(pre), ...subs.map((s) => pos.get(s))].filter((x) => x !== undefined);
			const prePos = placedAt.length ? placedAt.reduce((a, b) => (a.order <= b.order ? a : b)) : undefined;
			// all three forms share one waiver id: a waiver is held against
			// the REQUIREMENT (COMP321's MATH191), so crossing it off stays
			// crossed off however the student then shuffles the two courses
			const id = `prereq:${p.code}:${pre}`;
			// each line ends with where the prerequisite is, which is the fix
			const needs = `${code(p.code)} needs ${code(pre)} first${subs.length ? ` (or ${subs.map((sub) => code(sub)).join(' / ')})` : ''}`;
			if (!prePos) {
				hints.push({ kind: 'warn', id, text: `${needs}, not on your plan yet`, codes: [p.code, pre] });
			} else if (prePos.order === p.year * 10 + p.trim) {
				hints.push({
					kind: 'warn',
					id,
					text: `${needs}, both are in ${plan.trimName(p.year, p.trim)}`,
					codes: [p.code, pre]
				});
			} else if (prePos.order > p.year * 10 + p.trim) {
				// a substitute may be the one placed: name that one, not "it"
				const placed = [pre, ...subs].find((c) => pos.get(c) === prePos) ?? pre;
				const where = plan.trimName(prePos.year, prePos.trim);
				hints.push({
					kind: 'warn',
					id,
					text: `${needs}, but ${placed === pre ? "it's" : `${code(placed)} is`} in ${where}`,
					codes: [p.code, pre]
				});
			}
		}
	}

	// law 1.5, a course should only be placed in a year it's actually
	// open to (from the CSVs' Year 1-4 columns). This is what used to
	// silently let e.g. a 300+ level course sit in a first-year slot.
	for (const p of plan.placed) {
		const course = byCode(p.code);
		if (course.eligibleYears.length && !course.eligibleYears.includes(Math.min(p.year, 4))) {
			hints.push({
				kind: 'warn',
				id: `year:${p.code}:y${p.year}`,
				text: `${code(p.code)} is for year ${course.eligibleYears.join('/')}, not year ${p.year}`,
				codes: [p.code]
			});
		}
	}

	// law 1.6, a drop into a trimester the course has never run in is
	// allowed (the grid takes it), but it must be called out
	for (const p of plan.placed) {
		const course = byCode(p.code);
		if (course.offered.length && !course.offered.includes(p.trim)) {
			hints.push({
				kind: 'warn',
				// per trimester: "it runs in t2 this year" is a claim about t2,
				// and must not quietly cover a later move into t3
				id: `offered:${p.code}:t${p.trim}`,
				text: `${code(p.code)} doesn't run in ${plan.trimName(p.year, p.trim)}, it runs in ${offeredIn(course.offered, plan.trimNaming)}${plan.trimNaming === 'year' ? ' that year' : ''}`,
				codes: [p.code]
			});
		}
	}

	// law 2, substitute courses are interchangeable (Proofs and Ideas,
	// Discrete Mathematics, Mathematical Foundations of Data Science)
	for (const p of plan.placed) {
		const course = byCode(p.code);
		for (const otherCode of course.substitutes ?? []) {
			const other = byCode(otherCode);
			if (pos.has(other.code)) {
				// both placed, redundant, not wrong. Emit once per pair
				// (the lower code speaks) so a 3-way group isn't noisy.
				if (p.code < other.code) {
					hints.push({
						kind: 'info',
						text: `${code(p.code)} and ${code(other.code)} are interchangeable, you only need one`,
						codes: [p.code, other.code]
					});
				}
			} else if (plan.courseType(other.code) === 'required') {
				hints.push({
					kind: 'info',
					text: `you can switch ${code(p.code)} for ${code(other.code)}`,
					codes: [p.code, other.code]
				});
			}
		}
	}

	// law 2.5, the maths department teaches the full version of a couple of
	// courses another department also teaches applied ("Introduction to
	// Linear Algebra" is required for a computer-science major, but a maths
	// student has already done the real thing). Doing the maths one clears
	// both; doing the applied one does NOT clear the maths requirement, so
	// the hint has to name the direction rather than call them equivalent.
	// Only shown when the student is actually doing both departments.
	const covers = MATHS_COVERS.filter(({ maths, applied }) => {
		if (!hasCode(maths) || !hasCode(applied)) return false;
		if (!plan.selectedSubjects.includes('mathematics')) return false;
		// the department that asks for the applied version is on the plan
		return byCode(applied).subjects.some((s) => plan.selectedSubjects.includes(s));
	});
	if (covers.length) {
		const pairs = covers.map(({ maths, applied }) => `${code(maths)} covers ${code(applied)}`);
		hints.push({
			kind: 'info',
			text: `you are doing maths alongside a department that teaches its own applied version, take the maths course and you do not need the applied one: ${pairs.join('; ')}. It does not work the other way round.`,
			codes: covers.flatMap(({ maths, applied }) => [maths, applied])
		});
	}

	// law 2.6, the programme's own required courses that aren't on the grid
	// yet. Law 0.5 does this for the foundation core; without the same for
	// each programme a student can sit on "required 0/40" with nothing
	// telling them WHICH courses are missing.
	for (let i = 0; i < plan.programmes.length; i++) {
		const prog = plan.programmes[i];
		if (prog.subject === 'open') continue;
		const missing = [...plan.programmeSets[i].required]
			.filter((code) => hasCode(code) && !plan.placedCodes.has(code))
			// a placed substitute already satisfies it (MATH191 for COMP201)
			.filter((code) => !satisfiedBy(code).some((s) => plan.placedCodes.has(s)))
			.sort();
		if (!missing.length) continue;
		const label = subjectById(prog.subject).label;
		hints.push({
			kind: 'caution',
			text: `${label} ${prog.role}: ${missing.length} required course${missing.length === 1 ? '' : 's'} to place`,
			codes: missing,
			toPlace: missing
		});
	}

	// law 2.7, the chosen structure can't fit under the university's own
	// ceiling. Not something the student can fix by moving courses around,
	// so it's said once, up front, rather than as a per-trimester nag.
	const structureCap = plan.creditCeiling;
	if (plan.degreeTotal > structureCap) {
		hints.push({
			kind: 'caution',
			text: `this combination asks for ${plan.degreeTotal} credits but the ${plan.fourYear ? 'four' : 'three'}-year ceiling is ${structureCap}, the programmes overlap in practice, so talk to your mentor about which courses count for both`,
			codes: []
		});
	}

	// law 3, trimester credit caps: TRIM_STANDARD_MAX (18) normally, up to
	// TRIM_HARD_MAX (20) at most twice in the whole tenure (year 1 exempt,
	// same as the minimum)
	const heavy: { year: number; trim: TrimNum; credits: number }[] = [];
	for (const year of plan.years) {
		if (year === 1) continue;
		for (const trim of TRIMS) {
			const credits = plan.slotCredits(year, trim);
			if (credits > TRIM_HARD_MAX) {
				hints.push({
					kind: 'caution',
					text: `${plan.trimName(year, trim)} is over the ${TRIM_HARD_MAX}-credit cap (${credits}/${TRIM_HARD_MAX})`,
					codes: plan.slotCourses(year, trim)
				});
			} else if (credits > TRIM_STANDARD_MAX) {
				heavy.push({ year, trim, credits });
			}
		}
	}
	if (heavy.length > HEAVY_TRIMS_ALLOWED) {
		hints.push({
			kind: 'caution',
			text: `only ${HEAVY_TRIMS_ALLOWED} trimesters in your whole tenure may go over ${TRIM_STANDARD_MAX} credits; you have ${heavy.length}`,
			codes: heavy.flatMap((h) => plan.slotCourses(h.year, h.trim))
		});
	} else {
		for (const h of heavy) {
			hints.push({
				kind: 'info',
				text: `${plan.trimName(h.year, h.trim)} is a heavy trimester (${h.credits}/${TRIM_HARD_MAX}), ${HEAVY_TRIMS_ALLOWED} allowed`,
				codes: []
			});
		}
	}

	// law 4, audits are limited (only the ones the student marked), and
	// the drop form excludes KCCS / 391 / 490 / 491 and any course that
	// isn't 2 or 4 credits from being audited at all
	const badAudits = plan.audited.filter((code) => !canAudit(code));
	if (badAudits.length) {
		hints.push({
			kind: 'warn',
			id: `audit-ineligible:${[...badAudits].sort().join(',')}`,
			text: `${badAudits.map((c) => code(c)).join(', ')} can't be audited, only 2- or 4-credit courses, never KCCS/391/490/491`,
			codes: badAudits
		});
	}
	const audits = plan.placed.filter((p) => plan.audited.includes(p.code));
	if (audits.length > AUDIT_LIMIT) {
		hints.push({
			kind: 'warn',
			id: 'audit-limit',
			text: `too many audits, only ${AUDIT_LIMIT} allowed`,
			codes: audits.map((a) => a.code)
		});
	} else if (audits.length === AUDIT_LIMIT) {
		hints.push({ kind: 'info', text: 'you are out of audits', codes: [] });
	} else {
		const left = AUDIT_LIMIT - audits.length;
		hints.push({ kind: 'good', text: `${left} audit${left === 1 ? '' : 's'} remaining`, codes: [] });
	}

	// law 5, degree credit total, and the drop form's hard ceiling on
	// extra credits (128 for a 3-year tenure, 132 for a 3-year double major,
	// 176 for a 4-year one)
	if (plan.totalPlacedCredits < plan.creditMinimum) {
		const left = plan.creditMinimum - plan.totalPlacedCredits;
		hints.push({
			kind: 'caution',
			id: 'credit-minimum',
			text: `${left} more credits needed to reach the ${plan.creditMinimum}-credit degree minimum; completing your major alone is not enough`,
			codes: []
		});
	}
	const tenureCap = plan.creditCeiling;
	if (plan.totalPlacedCredits > tenureCap) {
		hints.push({
			kind: 'warn',
			id: 'credit-ceiling',
			text: `total credits exceed the ${tenureCap}-credit ceiling for the ${plan.fourYear ? 'four' : 'three'}-year programme (${plan.totalPlacedCredits}/${tenureCap})`,
			codes: []
		});
	} else if (plan.totalPlacedCredits > plan.creditMinimum) {
		hints.push({
			kind: 'caution',
			text: `you will exceed the required total credits (${plan.totalPlacedCredits}/${plan.creditMinimum})`,
			codes: []
		});
	}

	// ── grade-view hints (from the Examinations & Assessment Manual) ──
	if (plan.gradeMode) {
		const mark = (code: string) => plan.grades[code];
		const graded = [...plan.placedCodes].filter((c) => !plan.isAudit(c));
		const label = (codes: string[]) => codes.map((c) => code(c)).join(', ');

		// failing: a U scores 0 and blocks graduation until cleared. The failed
		// attempt stays on the grid; the course is free to place again
		const uCodes = plan.failedAttempts.map((a) => a.id);
		if (uCodes.length)
			hints.push({
				kind: 'warn',
				id: `grade-u:${[...uCodes].sort().join(',')}`,
				text: `${label(uCodes)}: U (fail), counts as 0 for now; place the course again from the catalogue, or take a supplementary exam and re-grade it here, and the new grade replaces the U.`,
				codes: uCodes
			});

		// incompletes revert to the computed grade if left unfinished
		const iCodes = graded.filter((c) => mark(c) === 'I');
		if (iCodes.length)
			hints.push({
				kind: 'caution',
				text: `${label(iCodes)}: Incomplete, submit pending work within six weeks or it defaults to the computed grade.`,
				codes: iCodes
			});

		// a D or E can be raised via an improvement exam
		const deCodes = graded.filter((c) => mark(c) === 'D' || mark(c) === 'E');
		if (deCodes.length)
			hints.push({
				kind: 'info',
				text: `${label(deCodes)}: a D/E can be raised with an improvement exam (up to ${plan.fourYear ? 4 : 3} across the degree).`,
				codes: deCodes
			});

		// the 5.5 CGPA graduation floor, with how far off it is
		if (plan.cgpa !== null && plan.cgpa < GRAD_MIN_CGPA) {
			const rec = recovery(GRAD_MIN_CGPA, plan.earnedPoints, plan.gradedCredits, plan.gradableCredits);
			const left = Math.max(0, plan.gradableCredits - plan.gradedCredits);
			if (rec.kind === 'reachable')
				hints.push({
					kind: 'caution',
					text: `CGPA ${plan.cgpa.toFixed(2)} is below the 5.5 graduation floor, average at least ${rec.needed.toFixed(2)} over your remaining ${left} credits to recover.`,
					codes: []
				});
			else
				hints.push({
					kind: 'warn',
					id: 'cgpa-floor',
					text:
						rec.kind === 'impossible'
							? `CGPA ${plan.cgpa.toFixed(2)} is below the 5.5 graduation floor and can't reach it on this plan, clear a U or add credits.`
							: `CGPA ${plan.cgpa.toFixed(2)} is below the 5.5 graduation floor.`,
					codes: []
				});
		}

		// Dean's Merit List, the grade condition (the list itself is the top 10%)
		if (plan.gradedCredits > 0) {
			if (uCodes.length || iCodes.length)
				hints.push({
					kind: 'info',
					text: `an I or U grade makes you ineligible for the Dean's Merit List this year.`,
					codes: []
				});
			else
				hints.push({
					kind: 'good',
					text: `no I or U grades, you meet the Dean's Merit List grade condition (the list is the cohort's top 10%).`,
					codes: []
				});
		}
	}

	// transcript-only courses: fine to take, but say plainly that they
	// won't move any programme's tally
	for (const p of plan.placed) {
		if (!isTranscriptOnly(p.code)) continue;
		hints.push({
			kind: 'info',
			text: `${code(p.code)} shows on your transcript but counts toward no programme`,
			codes: [p.code]
		});
	}

	return hints;
}

// ─────────────────────────────────────────────
// What the board's views read off the plan: how often a course ran in its
// trimester, a course's prerequisite chain and what another degree would
// make of the plan. The views themselves are picked
// at the top of the board (Plan.view); this is the arithmetic behind them,
// kept out of the plan store so it stays about the plan.
// ─────────────────────────────────────────────

import {
	RECORDED_TERMS,
	TRIM_STANDARD_MAX,
	byCode,
	hasCode,
	isCore,
	ranIn,
	satisfiedBy,
	termLabel
} from '$lib/curriculum/data';
import type { Plan } from '$lib/planner/plan.svelte';
import { MAX_YEARS } from '$lib/planner/structure';
import { slotAt, slotOrder, type Here } from '$lib/planner/calendar';
import type { TrimNum } from '$lib/types';

// ── will it run? ──

export type RunKind = 'always' | 'sometimes' | 'never' | 'unknown';

/** how often a course ran in a trimester, against the terms on record */
export function runRecord(code: string, trim: TrimNum) {
	const recorded = RECORDED_TERMS[trim];
	const history = ranIn(code);
	const ran = history.filter((t) => recorded.includes(t));
	const kind: RunKind =
		!recorded.length || !history.length
			? 'unknown' // a course added since the timetables, or a trimester with none
			: ran.length === recorded.length
				? 'always'
				: ran.length
					? 'sometimes'
					: 'never';
	return { kind, ran, recorded };
}

/** "ran 2024 T1, 2026 T1" / "never ran in T3 (2024, 2025 on record)" */
export function runText(code: string, trim: TrimNum): string {
	const { kind, ran, recorded } = runRecord(code, trim);
	if (kind === 'unknown') return 'no timetable record for this course yet';
	const years = recorded.map((t) => `20${t.split('_')[0]}`).join(', ');
	if (kind === 'never') return `never ran in T${trim} (timetables for ${years})`;
	return `ran ${ran.map(termLabel).join(', ')}, ${ran.length} of ${recorded.length} T${trim}s on record`;
}

// ── prerequisites ──

export type Chain = {
	root: string;
	/** every course in the chain, the root included */
	nodes: Set<string>;
	/** one per "needs": from the course taken first to the one that needs it */
	edges: { from: string; to: string; late: boolean }[];
	/** a prerequisite in the chain that isn't on the plan at all */
	missing: { code: string; neededBy: string }[];
	/** what comes before the root, and after it */
	before: string[];
	after: string[];
};

/** A placed course's prerequisite chain on the plan: everything it needs,
 *  and what that needs, back to the start; and everything that needs it,
 *  forward to the end. An interchangeable course (Proofs and Ideas for
 *  Discrete Maths) placed in a prerequisite's stead counts as it. */
export function prereqChain(plan: Plan, root: string): Chain {
	const at = new Map(plan.placed.map((p) => [p.code, p.year * 10 + p.trim]));
	const onPlan = (pre: string) => [byCode(pre).code, ...satisfiedBy(pre)].filter((c) => at.has(c));
	const needs = (code: string) => byCode(code).prereqs.filter(hasCode);

	const nodes = new Set([root]);
	const edges: Chain['edges'] = [];
	const missing: Chain['missing'] = [];
	const before: string[] = [];
	const after: string[] = [];
	const seen = new Set<string>();
	const link = (from: string, to: string) => {
		if (seen.has(`${from}>${to}`)) return;
		seen.add(`${from}>${to}`);
		edges.push({ from, to, late: at.get(from)! >= at.get(to)! });
	};

	// back: what it needs, and what those need
	const back = [root];
	while (back.length) {
		const code = back.pop()!;
		for (const pre of needs(code)) {
			const have = onPlan(pre);
			if (!have.length) {
				if (!missing.some((m) => m.code === byCode(pre).code && m.neededBy === code))
					missing.push({ code: byCode(pre).code, neededBy: code });
				continue;
			}
			for (const h of have) {
				link(h, code);
				if (nodes.has(h)) continue;
				nodes.add(h);
				before.push(h);
				back.push(h);
			}
		}
	}

	// forward: what needs it, and what needs those
	const placed = [...at.keys()];
	const forward = [root];
	while (forward.length) {
		const code = forward.pop()!;
		for (const next of placed) {
			if (next === code || !needs(next).some((pre) => onPlan(pre).includes(code))) continue;
			link(code, next);
			if (nodes.has(next)) continue;
			nodes.add(next);
			after.push(next);
			forward.push(next);
		}
	}
	return { root, nodes, edges, missing, before, after };
}

// ── what-if ──

export type Needed = {
	code: string;
	/** on the tried degree's required list, or needed first by one that is */
	why: 'required' | 'prerequisite';
	for?: string;
	/** the earliest trimester it fits, null when it fits nowhere on the grid */
	at: Here | null;
};

export type Verdict = {
	here: Here;
	/** non-KCCS courses taken by now (this trimester included) */
	taken: { counts: string[]; stops: string[] };
	/** courses planned after now */
	ahead: { stops: string[]; starts: string[] };
	needed: Needed[];
	/** when the plan ends with the needed courses added */
	finish: Here | null;
	/** inside the tried degree's own length (4 or 3 years) */
	onTime: boolean;
	/** the same, if the planned courses that would stop counting were dropped */
	ifDropped: { finish: Here | null; onTime: boolean } | null;
	limitYears: number;
	/** credits on the plan once the needed courses are added */
	total: number;
};

/**
 * What switching to the tried degree would mean from where the student is:
 * what they've taken that still counts, what they've planned that wouldn't,
 * what the new degree still needs (and what THAT needs first), and where it
 * could all go: the earliest trimester each needed course runs in, after its
 * prerequisites, in a year it's open to, skipping breaks, without taking a
 * trimester past the 18-credit regular load. So: can it still be done on time?
 */
export function whatIfVerdict(plan: Plan): Verdict | null {
	const tried = plan.whatIf;
	if (!tried) return null;
	const here = plan.here;
	const h = slotOrder(here.year, here.trim);

	const taken: Verdict['taken'] = { counts: [], stops: [] };
	const ahead: Verdict['ahead'] = { stops: [], starts: [] };
	for (const p of plan.placed) {
		if (isCore(p.code)) continue;
		const now = plan.courseType(p.code) !== 'other';
		const then = plan.whatIfType(p.code) !== 'other';
		if (slotOrder(p.year, p.trim) <= h) {
			if (then) taken.counts.push(p.code);
			else if (now) taken.stops.push(p.code);
		} else {
			if (now && !then) ahead.stops.push(p.code);
			if (!now && then) ahead.starts.push(p.code);
		}
	}

	// what the tried degree requires that isn't on the plan, and what those
	// need first that isn't either (a substitute on the plan covers it)
	const onPlan = (code: string) =>
		plan.placedCodes.has(byCode(code).code) || satisfiedBy(code).some((x) => plan.placedCodes.has(x));
	const need = new Map<string, Needed>();
	for (const set of plan.whatIfSets)
		for (const code of set.required)
			if (hasCode(code) && !onPlan(code))
				need.set(byCode(code).code, { code: byCode(code).code, why: 'required', at: null });
	const neededAs = (pre: string) => [byCode(pre).code, ...satisfiedBy(pre)].find((x) => need.has(x));
	const queue = [...need.keys()];
	while (queue.length) {
		const code = queue.pop()!;
		for (const pre of byCode(code).prereqs) {
			if (!hasCode(pre) || onPlan(pre) || neededAs(pre)) continue;
			const c = byCode(pre).code;
			need.set(c, { code: c, why: 'prerequisite', for: code, at: null });
			queue.push(c);
		}
	}

	// prerequisites before what needs them; the courses that run in the
	// fewest trimesters first, they have the least room to move
	const depth = new Map<string, number>();
	const depthOf = (code: string, seen = new Set<string>()): number => {
		if (depth.has(code)) return depth.get(code)!;
		if (seen.has(code)) return 0;
		seen.add(code);
		let d = 0;
		for (const pre of byCode(code).prereqs) {
			const n = hasCode(pre) ? neededAs(pre) : undefined;
			if (n) d = Math.max(d, depthOf(n, seen) + 1);
		}
		depth.set(code, d);
		return d;
	};
	const order = [...need.keys()].sort(
		(a, b) =>
			depthOf(a) - depthOf(b) ||
			byCode(a).offered.length - byCode(b).offered.length ||
			a.localeCompare(b, undefined, { numeric: true })
	);
	const placedAt = new Map(plan.placed.map((p) => [p.code, slotOrder(p.year, p.trim)]));
	// as far as the tried degree may run: n + 2 years
	const last = slotOrder(Math.min(MAX_YEARS, (tried.fourYear ? 4 : 3) + 2), 3);

	const schedule = (dropStops: boolean) => {
		const load = new Map<number, number>();
		let finish = -1;
		for (const a of plan.attempts) {
			const o = slotOrder(a.year, a.trim);
			if (dropStops && o > h && a.id === a.code && ahead.stops.includes(a.code)) continue;
			load.set(o, (load.get(o) ?? 0) + byCode(a.code).credits);
			finish = Math.max(finish, o);
		}
		const at = new Map<string, number | null>();
		for (const code of order) {
			const c = byCode(code);
			let earliest = h + 1;
			let blocked = false;
			for (const pre of c.prereqs) {
				if (!hasCode(pre)) continue;
				const placed = [byCode(pre).code, ...satisfiedBy(pre)]
					.map((x) => placedAt.get(x))
					.filter((o): o is number => o !== undefined);
				if (placed.length) {
					earliest = Math.max(earliest, Math.min(...placed) + 1);
					continue;
				}
				const n = neededAs(pre);
				if (!n) continue;
				const q = at.get(n);
				if (q == null) {
					blocked = true;
					break;
				}
				earliest = Math.max(earliest, q + 1);
			}
			let landed: number | null = null;
			for (let o = earliest; !blocked && o <= last; o++) {
				const { year, trim } = slotAt(o);
				if (plan.breakAt(year, trim)) continue;
				if (plan.coreOnly(year, trim) && !isCore(code)) continue;
				if (c.offered.length && !c.offered.includes(trim)) continue;
				if (c.eligibleYears.length && !c.eligibleYears.includes(Math.min(year, 4))) continue;
				if ((load.get(o) ?? 0) + c.credits > TRIM_STANDARD_MAX) continue;
				landed = o;
				break;
			}
			at.set(code, landed);
			if (landed !== null) {
				load.set(landed, (load.get(landed) ?? 0) + c.credits);
				finish = Math.max(finish, landed);
			}
		}
		return { at, finish: finish >= 0 ? finish : null, all: [...at.values()].every((v) => v !== null) };
	};

	const degreeEnd = slotOrder(tried.fourYear ? 4 : 3, 3);
	const base = schedule(false);
	const onTime = base.all && base.finish !== null && base.finish <= degreeEnd;
	let ifDropped: Verdict['ifDropped'] = null;
	if (!onTime && ahead.stops.length) {
		const d = schedule(true);
		ifDropped = {
			finish: d.finish !== null ? slotAt(d.finish) : null,
			onTime: d.all && d.finish !== null && d.finish <= degreeEnd
		};
	}
	const needed = [...need.values()]
		.map((n) => {
			const o = base.at.get(n.code);
			return { ...n, at: o == null ? null : slotAt(o) };
		})
		.sort(
			(a, b) =>
				(a.at ? slotOrder(a.at.year, a.at.trim) : 99) - (b.at ? slotOrder(b.at.year, b.at.trim) : 99) ||
				a.code.localeCompare(b.code, undefined, { numeric: true })
		);
	return {
		here,
		taken,
		ahead,
		needed,
		finish: base.finish !== null ? slotAt(base.finish) : null,
		onTime,
		ifDropped,
		limitYears: (tried.fourYear ? 4 : 3) + 2,
		total: plan.totalPlacedCredits + needed.reduce((sum, n) => sum + (n.at ? byCode(n.code).credits : 0), 0)
	};
}

// ─────────────────────────────────────────────
// Where a student is in their degree today: "you are here", the line between
// what they've already taken and what they can still plan. tracker guesses it
// from the batch and the date; the student can always correct it.
// ─────────────────────────────────────────────

import type { TrimNum } from '$lib/types';

export type Here = { year: number; trim: TrimNum };

/**
 * Krea's academic year starts in August. Its trimesters are taken to run
 * August–October, November–January and February–April (May–July, the
 * summer, still counts as T3 just done). Not the published calendar, which
 * isn't in tracker's data, so the guess is only ever a default; TERM_MONTHS
 * below is the same assumption, written out for the grid's header.
 */
export function guessNow(batchStartYear: number, today: Date, lastYear: number): Here {
	const month = today.getMonth(); // 0 = January
	// the August this academic year began
	const academicStart = month >= 7 ? today.getFullYear() : today.getFullYear() - 1;
	const year = academicStart - batchStartYear + 1;
	const trim: TrimNum = month >= 7 && month <= 9 ? 1 : month >= 10 || month === 0 ? 2 : 3;
	if (year < 1) return { year: 1, trim: 1 }; // hasn't started yet
	if (year > lastYear) return { year: lastYear, trim: 3 }; // past the grid's end
	return { year, trim };
}

/** a trimester's place in the whole degree: year 1 T1 is 0, year 2 T1 is 3 */
export const slotOrder = (year: number, trim: number): number => (year - 1) * 3 + (trim - 1);

/** the trimester at a place in the degree */
export const slotAt = (order: number): Here => ({
	year: Math.floor(order / 3) + 1,
	trim: ((order % 3) + 1) as TrimNum
});

/** a trimester's number across the whole degree, as students count them:
 *  year 1 T1 is t1, year 4 T1 is t10 */
export const degreeTrim = (year: number, trim: number): number => slotOrder(year, trim) + 1;

/** the academic year a year of the degree falls in, from the batch, short:
 *  batch 2023, year 4 → "26 to 27" */
export const academicYear = (batchStartYear: number, year: number): string => {
	const start = batchStartYear + year - 1;
	return `${String(start).slice(-2)} to ${String(start + 1).slice(-2)}`;
};

/** The months each trimester is taken to run, the same assumption guessNow
 *  makes. Krea's published calendar isn't in tracker's data, so this (and the
 *  month test in guessNow) is the place to fix. */
const TERM_MONTHS: Record<TrimNum, [string, string]> = {
	1: ['aug', 'oct'],
	2: ['nov', 'jan'],
	3: ['feb', 'apr']
};

/** a trimester's months, any year: "aug to oct" */
export const termMonths = (trim: TrimNum): string => TERM_MONTHS[trim].join(' to ');

/** for narrow table columns */
export const termMonthsShort = (trim: TrimNum): string => TERM_MONTHS[trim].join('–');

// ── naming a trimester ──
// students count trimesters two ways, by year ("y2 t3", how courses are
// offered) or through the degree ("t6"). mixing them made "t3" mean two
// things on one screen, so every label goes through these and follows the
// one naming the student picked.

export type TrimNaming = 'year' | 'degree';

export const trimName = (year: number, trim: TrimNum, naming: TrimNaming): string =>
	naming === 'degree' ? `t${degreeTrim(year, trim)}` : `y${year} t${trim}`;

/** for titles and screen readers, where "t6" alone says too little */
export const trimSpelled = (year: number, trim: TrimNum, naming: TrimNaming): string =>
	naming === 'degree'
		? `trimester ${degreeTrim(year, trim)} of your degree (year ${year}, trimester ${trim})`
		: `year ${year}, trimester ${trim}`;

/** when in the year a course runs. through the degree it's the months,
 *  since "t1" there would read as the first trimester of the degree */
export const offeredIn = (trims: readonly TrimNum[], naming: TrimNaming): string =>
	naming === 'degree' ? trims.map(termMonths).join(' or ') : trims.map((t) => `t${t}`).join('/');

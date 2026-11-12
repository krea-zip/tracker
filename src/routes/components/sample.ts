// the example the components page draws: a computer science major with a
// mathematics minor, laid out by hand so every mark has something to show.
// a detached plan neither reads nor writes the student's saved plan.
import { Plan } from '$lib/planner/plan.svelte';
import type { TrimNum } from '$lib/types';

const PLACEMENTS: Record<string, string[]> = {
	'1-1': ['KCCS101', 'KCCS102', 'KCCS121'],
	'1-2': ['KCCS131', 'KCCS103', 'KCCS122', 'KCCS124'],
	'1-3': ['MATH191', 'KCCS132', 'KCCS133', 'KCCS134'],
	'2-1': ['MATH230', 'COMP204'],
	'2-2': ['MATH202', 'COMP205'],
	'2-3': ['KCCS123', 'MATH203', 'COMP210', 'COMP217'],
	'3-1': ['COMP305', 'COMP350', 'MATH201'],
	'3-2': ['KCCS190', 'COMP312', 'COMP313'],
	'3-3': ['COMP308', 'COMP321', 'COMP347'],
	'4-1': ['COMP344', 'PSYC201'],
	'4-2': ['MATH231'],
	'4-3': ['MATH344'] // runs in t2 only, so the wrong-trimester hint has a course
};

export type SampleState = {
	/** a course held mid-drag */
	lifted?: string;
	/** a trimester opened on its own */
	zoom?: { year: number; trim: TrimNum };
	/** the course open in the details panel */
	select?: string;
};

export function samplePlan({ lifted, zoom, select }: SampleState = {}) {
	const plan = new Plan({ detached: true });
	plan.restore({
		...plan.snapshot(),
		batchStartYear: 2024,
		fourYear: true,
		structure: 'major-minor',
		picks: { ...plan.picks, major1: 'computer science', minor: 'mathematics' },
		placements: Object.fromEntries(
			Object.entries(PLACEMENTS).map(([slot, codes]) => [slot, codes.filter((code) => code !== lifted)])
		),
		showTitles: true
	});
	plan.dragging = lifted ?? null;
	plan.zoom = zoom ?? null;
	if (select) plan.select(select);
	return plan;
}

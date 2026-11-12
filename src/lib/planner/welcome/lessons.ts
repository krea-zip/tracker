// The practice is one small story: Jeff's plan at Greendale, put right one
// part of the planner at a time, in the order a student meets them: the
// grid, the catalogue, a course's card, the hints, then all of it at once.
// Every quest has a reason the student can see (this course doesn't run
// then, his major is a course short, could this one go sooner?), only one
// thing is ever wrong at a time, and each step leaves the plan the way the
// next one needs it.
import type { Plan } from '$lib/planner/plan.svelte';

/** what the frame shows beside the grid on a step */
export type Layout = {
	/** the sidebar's sections, in the sidebar's own order */
	rail?: ('progress' | 'hints')[];
	catalogue?: boolean;
	/** the course card sits beside the grid instead of sliding over it */
	dock?: boolean;
};

/** the plan as it stood when a step was first opened */
export type Baseline = { at: Record<string, string> };

export type Task = {
	id: string;
	/** the quest, in two or three words */
	title: string;
	/** why, then how, shown while it's the quest at hand; *words between stars* come out bold */
	how: string;
	/** what to ring in the miniature while this is the task at hand: the first of these on screen */
	point?: string | string[];
	/** or the gesture to draw: a course flying from one place to another */
	drag?: { from: string; to: string; label: string };
	/** done once this holds… */
	done?: (plan: Plan, from: Baseline) => boolean;
	/** …or once a click lands on this */
	clicked?: string;
	/** a result rather than an action: it unticks if the plan stops meeting it */
	live?: boolean;
};

export type LessonInfo = {
	id: string;
	/** its name on the step track */
	label: string;
	title: string;
	intro: string;
	tasks: Task[];
	/** said once every quest is done: a cheer, then one thing worth knowing */
	praise: string;
	layout: Layout;
	/** set the pretend plan up for this step, the first time it opens */
	enter?: (plan: Plan) => void;
};

export const slotsOf = (plan: Plan): Baseline['at'] =>
	Object.fromEntries(plan.placed.map((p) => [p.code, `${p.year}-${p.trim}`]));

const chip = (code: string) => `.chip[data-code="${code}"]`;
const cell = (year: number, trim: number) => `.cell[data-year="${year}"][data-trim="${trim}"]`;

const flagged = (plan: Plan, code: string) => plan.hints.some((h) => h.kind === 'warn' && h.codes.includes(code));
/** nothing in the hints list: no ▲ problem and no ■ warning */
const clear = (plan: Plan) => !plan.hints.some((h) => h.kind === 'warn' || h.kind === 'caution');
/** every programme full, and the degree's credits all planned */
const complete = (plan: Plan) =>
	plan.stats.every((s) => s.creditsLeft === 0) && plan.totalPlacedCredits >= plan.creditMinimum;

const LESSON_LIST = [
	{
		id: 'grid',
		label: 'grid',
		title: 'the grid',
		intro: 'this is Jeff’s plan at Greendale. each row is a year, each column a trimester, each box a course.',
		layout: {},
		tasks: [
			{
				id: 'grid-key',
				title: 'read the colours',
				how: 'each programme has its own colour. click *select* above the grid to open the key.',
				point: '[aria-controls="colour-key"]',
				clicked: '[aria-controls="colour-key"]'
			},
			{
				id: 'grid-light',
				title: 'light up his major',
				how: 'click *film studies* in the key: Jeff’s film courses light up. filled with a dot is required, outlined is an elective.',
				// the row while the key is open, the button that opens it once it's shut
				point: [
					'#colour-key [aria-label="subject colour legend"] li:first-child button',
					'[aria-controls="colour-key"]'
				],
				clicked: '#colour-key [aria-label="subject colour legend"] li:first-child button'
			},
			{
				id: 'grid-move',
				title: 'move Spanish 101',
				how: 'it only runs in t3, so it has a ▲. drag *SPAN101* to a t3: the cells that turn mint are where it can go.',
				drag: { from: chip('SPAN101'), to: cell(2, 3), label: 'SPAN101' },
				done: (plan) => !flagged(plan, 'SPAN101')
			}
		],
		praise: '*fixed.* moved the wrong one? ↶ on the bar undoes any move.'
	},
	{
		id: 'catalogue',
		label: 'catalogue',
		title: 'the catalogue',
		intro: 'every course on offer. Jeff’s film major still needs *Critical Film Studies*.',
		layout: { catalogue: true },
		tasks: [
			{
				id: 'catalogue-filter',
				title: 'show film only',
				how: 'the pills under *browse* narrow the list to one department. click *film*; click it again later to see everything.',
				point: '.pills.subjects [data-subject="film"]',
				done: (plan) => plan.filters.includes('film')
			},
			{
				id: 'catalogue-find',
				title: 'find it',
				how: 'still a lot of film. type *critical* into the search box.',
				point: '.search-box input',
				done: (plan) => plan.search.trim().length > 1
			},
			{
				id: 'catalogue-add',
				title: 'add it',
				how: 'drag *FILM301* onto the grid, into the cell that turns mint.',
				drag: { from: '[data-course="FILM301"] [data-course-card]', to: cell(2, 3), label: 'FILM301' },
				done: (plan) => plan.placedCodes.has('FILM301')
			}
		],
		praise:
			'*added.* to take a course off, drag it back onto the catalogue. the slider button beside *sort by* has more filters: what you still need, what runs next.'
	},
	{
		id: 'info',
		label: 'info',
		title: 'course info',
		intro:
			'click any course for its card. the top row says its credits, when it runs, and whether Jeff’s degree requires it.',
		layout: { dock: true },
		tasks: [
			{
				id: 'info-titles',
				title: 'show titles',
				how: 'the grid shows codes. click *titles* above the grid to see the names too.',
				point: '[data-label-key="title"]',
				done: (plan) => plan.showTitles
			},
			{
				id: 'info-open',
				title: 'open Critical Film Studies',
				how: 'could Jeff take it sooner? click *Critical Film Studies* on the grid.',
				point: chip('FILM301'),
				done: (plan) => plan.selected?.code === 'FILM301'
			},
			{
				id: 'info-runs',
				title: 'when it runs',
				how: '*offered* is the trimesters it usually runs in: t1 and t3. click it to see each past run.',
				point: '[aria-controls="d-runs"]',
				clicked: '[aria-controls="d-runs"]'
			},
			{
				id: 'info-needs',
				title: 'what it needs',
				how: '*needs first* lists what must come earlier, and where Jeff has it. click *FILM201* there to open its card.',
				point: '.d-prereq .d-chip',
				clicked: '.d-prereq .d-chip'
			}
		],
		praise:
			'*not sooner.* FILM301 needs FILM201 first, and that’s in y2 t2. *your plan*, on every card, moves or removes a course without dragging.',
		// skipped the catalogue? then the course this step opens isn't on the grid yet
		enter: (plan) => {
			if (!plan.placedCodes.has('FILM301')) plan.place('FILM301', 2, 3);
		}
	},
	{
		id: 'hints',
		label: 'hints',
		title: 'hints',
		intro:
			'Jeff moved *FILM301* and *STAT101* to y2 t1. the hints list now has one of each kind: ▲ a problem, ■ a warning, and an advisory.',
		layout: { rail: ['hints'] },
		tasks: [
			{
				id: 'hints-read',
				title: 'read the problem',
				how: 'a ▲ is something the university won’t allow. click the ▲ card at the top of the hints list: it lights FILM301 on the grid.',
				point: '.hint-heading',
				clicked: '.hint-heading'
			},
			{
				id: 'hints-toggle',
				title: 'hide the warnings',
				how: 'a ■ is worth fixing but allowed. the ▲ and ■ counts at the top are switches: click *■ 1* to hide warnings, again to show them.',
				point: '.tally-item[data-kind="caution"]',
				clicked: '.tally-item[data-kind="caution"]'
			},
			{
				id: 'hints-notes',
				title: 'open the advisories',
				how: 'advisories are just good to know, nothing’s wrong. click *advisories* at the bottom of the list.',
				point: '.notes-toggle',
				clicked: '.notes-toggle'
			},
			{
				id: 'hints-fix',
				title: 'fix it',
				how: 'drag *FILM301* back to t3, after FILM201.',
				drag: { from: chip('FILM301'), to: cell(2, 3), label: 'FILM301' },
				done: (plan) => !flagged(plan, 'FILM301')
			}
		],
		praise:
			'*all clear.* one move fixed all three: t1 is lighter, t3 has enough credits. whenever you see a ▲ or ■, the hints say why.',
		// Jeff's moves, made as the step opens: FILM301 too early (▲), which
		// leaves t3 short (■) and t1 heavy (advisory). Spanish goes to t3
		// first, as the grid step leaves it, in case that step was skipped
		enter: (plan) => {
			if (flagged(plan, 'SPAN101')) plan.place('SPAN101', 2, 3);
			plan.place('STAT101', 2, 1);
			if (!flagged(plan, 'FILM301')) plan.place('FILM301', 2, 1);
		}
	},
	{
		id: 'graduate',
		label: 'graduate',
		title: 'graduation day',
		intro:
			'the whole planner, as your own one looks: degree progress and hints on the left, then the catalogue and the grid.',
		layout: { rail: ['progress', 'hints'], catalogue: true },
		tasks: [
			{
				id: 'graduate-degree',
				title: 'degree complete',
				how: 'degree progress, top left, says how many credits are left. the catalogue has the courses.',
				point: '.credit-summary',
				live: true,
				done: complete
			},
			{
				id: 'graduate-clear',
				title: 'nothing to fix',
				how: 'open a hint to see which course it’s about, then move that course.',
				point: '[data-tour="hints"]',
				live: true,
				done: clear
			}
		],
		praise: '*Jeff graduates!* your own plan works the same way, with more boxes.'
	}
] as const satisfies readonly LessonInfo[];

export const LESSONS: readonly LessonInfo[] = LESSON_LIST;
export type Lesson = (typeof LESSON_LIST)[number]['id'];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** a task's words, split where its stars say bold */
export const emphasised = (text: string) => text.split('*').map((words, i) => ({ words, bold: i % 2 === 1 }));

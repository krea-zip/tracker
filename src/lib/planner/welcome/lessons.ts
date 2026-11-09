// One entry per playground slide: what it says beside the miniature, what to
// try, and how the frame can tell it was tried. Everything acts on the same
// pretend plan, so what a student does on one slide is still there on the next.
import type { Plan } from '$lib/planner/plan.svelte';

/** where a lesson's part sits in the real planner */
export type MapPart = 'grid' | 'bar' | 'catalogue' | 'info' | 'hints' | 'details' | 'all';

/** the plan as it stood when a slide was first opened */
export type Baseline = { at: Record<string, string> };

export type Task = {
	id: string;
	/** what to try; *words between stars* come out bold */
	text: string;
	/** what to ring in the miniature while this is the task at hand */
	point?: string;
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
	title: string;
	label: string;
	intro: string;
	tasks: Task[];
	/** how this part works with the others */
	links: string[];
	map: MapPart;
	/** set the pretend plan up for this slide, the first time it opens */
	enter?: (plan: Plan) => void;
};

export const slotsOf = (plan: Plan): Baseline['at'] =>
	Object.fromEntries(plan.placed.map((p) => [p.code, `${p.year}-${p.trim}`]));

const chip = (code: string) => `.chip[data-code="${code}"]`;
const cell = (year: number, trim: number) => `.cell[data-year="${year}"][data-trim="${trim}"]`;
const UNDO = '[aria-label="undo"]';

const moved = (plan: Plan, from: Baseline) =>
	plan.placed.some((p) => from.at[p.code] && from.at[p.code] !== `${p.year}-${p.trim}`);
const undone = (plan: Plan) => plan.flash === 'undone';
const count = (plan: Plan, kind: 'warn' | 'caution') => plan.hints.filter((h) => h.kind === kind).length;

const LESSON_LIST = [
	{
		id: 'terms',
		title: 'a tiny planner to play with',
		label: 'the playground',
		intro: 'just a demo: two years, three trimesters each, and pretend courses. nothing here changes your plan.',
		tasks: [
			{
				id: 'terms-move',
				text: 'drag *TEA202* to another trimester. mint cells are where it fits.',
				drag: { from: chip('TEA202'), to: cell(2, 3), label: 'TEA202' },
				done: moved
			},
			{
				id: 'terms-undo',
				text: 'changed your mind? press *↶* in the bar, or ctrl+z.',
				point: UNDO,
				done: undone
			},
			{
				id: 'terms-open',
				text: 'click the empty part of a trimester to open it, then *← back*.',
				point: cell(2, 3),
				done: (plan) => plan.zoom !== null
			}
		],
		links: [
			'y1 t1 and t2 only take kccs, the foundation courses everyone does.',
			'a faded cell still takes a drop. the hints will flag it for you.'
		],
		map: 'grid'
	},
	{
		id: 'display',
		title: 'make the grid yours',
		label: 'display',
		intro: 'the grid’s bar changes what the boxes say, and its display menu explains what their colours mean.',
		tasks: [
			{
				id: 'display-titles',
				text: 'turn on *titles* to read course names in the boxes.',
				point: '[aria-label="course labels"] button:nth-child(2)',
				done: (plan) => plan.showTitles
			},
			{
				id: 'display-hover',
				text: 'point at a colour. everything else on the grid steps back.',
				point: '.legend[aria-label="course colour legend"]',
				done: (plan) => plan.highlight.length > 0
			},
			{
				id: 'display-pick',
				text: 'click *cat philosophy* to keep its courses lit.',
				point: '.legend[aria-label="subject colour legend"] li:nth-child(2) button',
				clicked: '.legend button'
			}
		],
		links: [
			'with a colour kept lit, *− drop* takes that whole group off the grid. ↶ brings it back.',
			'in your planner this menu opens from the *display* button on the bar.'
		],
		map: 'bar'
	},
	{
		id: 'catalogue',
		title: 'find it, drag it, drop it',
		label: 'catalogue',
		intro: 'every course on offer. search it, narrow it down, then drag what you want onto the grid.',
		tasks: [
			{
				id: 'catalogue-search',
				text: 'search for *cardboard*.',
				point: '.search-box input',
				done: (plan) => plan.search.trim().length > 1
			},
			{
				id: 'catalogue-drag',
				text: 'drag *CAT201* onto the grid. only the trimesters it runs in light up.',
				drag: { from: '[data-course="CAT201"] [data-course-card]', to: cell(2, 3), label: 'CAT201' },
				done: (plan) => plan.placedCodes.has('CAT201') || plan.placedCodes.has('CAT205')
			},
			{
				id: 'catalogue-filter',
				text: 'narrow the list with a pill like *cats*, or the sliders for more filters.',
				point: '.pills.subjects',
				done: (plan) => plan.narrowed
			}
		],
		links: [
			'click a card to read about it and add it with a trimester picker.',
			'drop a box back on the catalogue to take it off your plan.',
			'click a trimester on the grid and this list shows what runs then.'
		],
		map: 'catalogue'
	},
	{
		id: 'progress',
		title: 'watch your degree fill up',
		label: 'degree progress',
		intro: 'every credit on the grid lands here. each programme gets a bar, required credits first, then electives.',
		tasks: [
			{
				id: 'progress-open',
				text: 'open *dream studies* to see its required and elective credits.',
				point: '.prog .toggle',
				clicked: '.prog .toggle'
			},
			{
				id: 'progress-remove',
				text: 'take a course off the grid with its *×* and watch the bar drop.',
				point: chip('NAP101'),
				done: (plan, from) => plan.placed.length < Object.keys(from.at).length
			},
			{
				id: 'progress-undo',
				text: 'press *↶* and the credits come straight back.',
				point: UNDO,
				done: undone
			}
		],
		links: [
			'*choices* lists pick-one pools. its dots fill as you place their courses.',
			'*planning issues* counts what the hints found and jumps down to them.'
		],
		map: 'info'
	},
	{
		id: 'hints',
		title: 'a little help along the way',
		label: 'hints',
		intro: 'tracker checks your plan against the rules as you go. ▲ problems come first, then ■ warnings.',
		tasks: [
			{
				id: 'hints-open',
				text: 'open *prerequisites first*. its courses light up on the grid.',
				point: '.hint-heading',
				clicked: '.hint-heading'
			},
			{
				id: 'hints-fix',
				text: 'fix it: drag *NAP301* to y2 t3, after NAP201. the hint goes away.',
				drag: { from: chip('NAP301'), to: cell(2, 3), label: 'NAP301' },
				done: (plan) => count(plan, 'warn') === 0
			},
			{
				id: 'hints-badge',
				text: 'click the *■* count at the top to hide warnings for now.',
				point: '.tally-item[data-kind="caution"]',
				clicked: '.tally-item'
			}
		],
		links: [
			'a course a hint names wears the same mark on the grid. click it and the hint opens.',
			'got permission to skip a rule? *waived?* crosses it off.'
		],
		map: 'hints',
		// the problem may already be fixed by now: this slide needs one to show
		enter: (plan) => {
			if (count(plan, 'warn') === 0) plan.place('NAP301', 2, 1);
		}
	},
	{
		id: 'details',
		title: 'every box has a story',
		label: 'course details',
		intro: 'click any box or catalogue card to see what it needs, what it leads to, when it runs and who teaches it.',
		tasks: [
			{
				id: 'details-other',
				text: 'click *NAP301* on the grid. the card swaps to it.',
				point: chip('NAP301'),
				done: (plan) => !!plan.selected && plan.selected.code !== 'NAP201'
			},
			{
				id: 'details-link',
				text: 'click the course under *needs first* to jump to it.',
				point: '.d-prereq .d-chip',
				clicked: '.d-related .d-chip'
			},
			{
				id: 'details-move',
				text: 'pick a *trimester* and press *move*: no dragging needed.',
				point: '.d-place-row',
				clicked: '.d-place-go'
			}
		],
		links: [
			'*offered* opens a table of when the course really ran.',
			'*audit & result* marks an audit, or a failed attempt to retake.',
			'all these names and courses are made up.'
		],
		map: 'details'
	},
	{
		id: 'together',
		title: 'now all of it at once',
		label: 'all together',
		intro: 'the real layout, in miniature. use anything you’ve learned to finish this tiny degree.',
		tasks: [
			{
				id: 'together-problems',
				text: 'no *▲ problems* left',
				live: true,
				done: (plan) => count(plan, 'warn') === 0
			},
			{
				id: 'together-full',
				text: 'both *programmes* full',
				live: true,
				done: (plan) => plan.stats.every((s) => s.creditsLeft === 0)
			},
			{
				id: 'together-warnings',
				text: 'no *■ warnings* left',
				live: true,
				done: (plan) => count(plan, 'caution') === 0
			}
		],
		links: [],
		map: 'all'
	}
] as const satisfies readonly LessonInfo[];

export const LESSONS: readonly LessonInfo[] = LESSON_LIST;
export type Lesson = (typeof LESSON_LIST)[number]['id'];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** a task's words, split where its stars say bold */
export const emphasised = (text: string) => text.split('*').map((words, i) => ({ words, bold: i % 2 === 1 }));

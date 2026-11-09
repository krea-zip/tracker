// what the guide labels, one short line each. `side` is where the note sits
// against its control; one the window has folded or scrolled away is left out.
export type Side = 'above' | 'below' | 'left' | 'right';
export type GuideNote = { target: string; side: Side; text: string };

export const GUIDE_NOTES: GuideNote[] = [
	{ target: '[data-tour="settings"]', side: 'below', text: 'dark mode, saved plans and sharing' },
	{ target: '[data-tour="four-year"]', side: 'below', text: 'toggle if planning a 3-year degree' },
	{ target: '[data-tour="hints"] h3', side: 'right', text: 'what needs fixing, worst first' },
	{
		target: '[data-tour="catalogue"] input[type="search"]',
		side: 'below',
		text: 'every course: search, then drag one onto the grid'
	},
	{
		target: '[data-tour="views"]',
		side: 'below',
		text: 'other views: grades, will it run?, prerequisites, what-if'
	},
	{ target: '[aria-label="course labels"]', side: 'below', text: 'codes, titles or both' },
	{
		target: '#colour-key',
		side: 'below',
		text: 'what the colours mean. point at a row to light up its courses'
	},
	{ target: '[data-tour="trim-head"] .name', side: 'below', text: 'toggle if you prefer t11 over y4 t2' },
	{ target: '[data-tour="credits"]', side: 'below', text: 'your credits: click for the full picture' },
	{
		target: '.overview .cell[data-year="2"] .chip',
		side: 'below',
		text: 'click a course to see everything about it'
	},
	{ target: '[data-tour="suggested-path"]', side: 'above', text: "your department's suggested order" }
];

// A complete, fictional curriculum for the isolated welcome frame. It goes
// through the same indexes, rules and components as the published curriculum,
// so every panel in the playground is the real one, reading pretend courses.
// The degree is Jeff's at Greendale: every course is named after an episode
// of Community, and the codes are numbered clear of the real catalogue's.
import type { CurriculumSnapshot, ProgrammeRequirements, SnapshotCourse } from '$lib/curriculum/snapshot';
import type { TrimNum } from '$lib/types';

const TEACHERS: Record<string, { id: string; name: string }> = {
	film: { id: 'pelton', name: 'Dean Pelton' },
	anth: { id: 'duncan', name: 'Professor Duncan' },
	span: { id: 'chang', name: 'Señor Chang' },
	stat: { id: 'slater', name: 'Professor Slater' }
};

function course(
	code: string,
	title: string,
	subject: string,
	offered: TrimNum[],
	prereqs: string[] = [],
	required = true
): SnapshotCourse {
	const teacher = TEACHERS[subject];
	return {
		code,
		title,
		subject,
		subjects: [subject],
		codes: [code],
		codesBySubject: { [subject]: code },
		faculty: teacher?.name ?? '',
		credits: 4,
		required,
		offered,
		eligibleYears: [1, 2],
		prereqs,
		// two years of runs, so "when it ran" has something to show
		terms: ['26', '25'].flatMap((year) => offered.map((t) => `${year}_T${t}`)),
		lecturers: teacher ? [teacher.id] : []
	};
}

const courses = [
	course('KCCS111', 'Communication Studies', 'core', [1, 2]),
	course('KCCS112', 'Social Psychology', 'core', [1, 2]),
	course('KCCS113', 'Environmental Science', 'core', [1, 2]),
	course('KCCS114', 'Interpretive Dance', 'core', [1, 2]),
	course('FILM101', 'Introduction to Film', 'film', [1, 2, 3]),
	course('FILM201', 'Intermediate Documentary Filmmaking', 'film', [1, 2], ['FILM101']),
	course('FILM301', 'Critical Film Studies', 'film', [1, 3], ['FILM201']),
	course('FILM150', 'Messianic Myths and Ancient Peoples', 'film', [1, 3], [], false),
	course('FILM210', 'Intro to Recycled Cinema', 'film', [2, 3], [], false),
	course('ANTH101', 'Anthropology 101', 'anth', [1, 2, 3]),
	course('ANTH201', 'Applied Anthropology and Culinary Arts', 'anth', [2, 3], ['ANTH101']),
	course('ANTH205', 'Origins of Vampire Mythology', 'anth', [1, 2], ['ANTH101']),
	course('ANTH210', 'Comparative Religion', 'anth', [2, 3], ['ANTH101'], false),
	course('SPAN101', 'Spanish 101', 'span', [3], [], false),
	course('STAT101', 'Introduction to Statistics', 'stat', [1, 2, 3], [], false)
];

// every programme here is fixed courses only, no "pick any two" pools, so
// what's left to do is always a course the student can name
function programme(
	subject: string,
	variant: ProgrammeRequirements['variant'],
	required: string[],
	electives: string[]
): ProgrammeRequirements {
	return {
		subject,
		variant,
		credits: {
			total: (required.length + electives.length) * 4,
			required: required.length * 4,
			elective: electives.length * 4
		},
		required,
		electives,
		picks: [],
		choices: [],
		pathway: []
	};
}

export const playgroundSnapshot: CurriculumSnapshot & { descriptions: Record<string, string> } = {
	format: 1,
	release: 'welcome-playground',
	updatedOn: null,
	subjects: [
		{ id: 'core', label: 'kccs', short: 'kccs', majorable: false },
		{ id: 'film', label: 'film studies', short: 'film', majorable: true, hue: 210 },
		{ id: 'anth', label: 'anthropology', short: 'anth', majorable: true, hue: 285 },
		{ id: 'span', label: 'spanish', short: 'span', majorable: true, hue: 150 },
		{ id: 'stat', label: 'statistics', short: 'stat', majorable: true, hue: 60 },
		{ id: 'open', label: 'open minor', short: 'open', majorable: false }
	],
	rules: {
		TRIM_MIN: 8,
		TRIM_NORMAL_MAX: 12,
		TRIM_STANDARD_MAX: 16,
		TRIM_HARD_MAX: 20,
		HEAVY_TRIMS_ALLOWED: 2,
		AUDIT_LIMIT: 2,
		// kccs and the two programmes ask for 48; two free courses (Spanish
		// and statistics) make up the rest, so a finished plan lands on it exactly
		MIN_TOTAL_3YR: 56,
		MIN_TOTAL_4YR: 56,
		MAX_TOTAL_3YR: 64,
		MAX_TOTAL_4YR: 64
	},
	courses,
	lecturers: [
		{
			id: 'pelton',
			name: 'Dean Pelton',
			position: 'Dean of Greendale, and film when he can',
			email: 'dean@example.invalid',
			office_hours: 'Any theme day · The dean’s office',
			image_url: '',
			url: ''
		},
		{
			id: 'duncan',
			name: 'Professor Duncan',
			position: 'Professor of anthropology',
			email: 'duncan@example.invalid',
			office_hours: 'Mondays · Study room F',
			image_url: '',
			url: ''
		},
		{
			id: 'chang',
			name: 'Señor Chang',
			position: 'Profesor de español',
			email: 'chang@example.invalid',
			office_hours: 'Unpredictable · Room 101',
			image_url: '',
			url: ''
		},
		{
			id: 'slater',
			name: 'Professor Slater',
			position: 'Professor of statistics',
			email: 'slater@example.invalid',
			office_hours: 'Tuesdays after class · Room 307',
			image_url: '',
			url: ''
		}
	],
	equivalences: { substitutes: [], covers: [], transcriptOnly: [] },
	batchRules: [],
	requirementSets: [
		{
			id: 'playground',
			name: 'Pretend degree',
			batches: null,
			programmes: [
				programme('film', 'single_major_4yr', ['FILM101', 'FILM201', 'FILM301'], ['FILM150', 'FILM210']),
				// the other majors, so a course card and what-if have something true to say
				programme('anth', 'single_major_4yr', ['ANTH101', 'ANTH201', 'ANTH205', 'ANTH210'], []),
				programme('span', 'single_major_4yr', ['SPAN101'], []),
				programme('stat', 'single_major_4yr', ['STAT101'], []),
				programme('anth', 'minor_4yr', ['ANTH101', 'ANTH201', 'ANTH205'], [])
			]
		}
	],
	descriptions: Object.fromEntries(
		courses.map((c) => [
			c.code,
			`${c.title} is a pretend course at Greendale, named after an episode of Community. Its credits, offerings, prerequisites and teacher are examples only. In your real plan, this section has the catalogue description of the course you opened.`
		])
	)
};

// Jeff's plan as the practice opens on it: one thing wrong that the grid
// shows (Spanish 101 sits in a trimester it doesn't run in), and one course
// his major still needs (Critical Film Studies, not on the grid yet). Put
// right, it lands on the degree minimum exactly.
export const playgroundPlacements = (): Record<string, string[]> => ({
	'1-1': ['KCCS111', 'KCCS112'],
	'1-2': ['KCCS113', 'KCCS114'],
	'1-3': ['FILM101', 'ANTH101'],
	'2-1': ['SPAN101', 'FILM150', 'ANTH205'],
	'2-2': ['FILM201', 'FILM210', 'ANTH201'],
	'2-3': ['STAT101']
});

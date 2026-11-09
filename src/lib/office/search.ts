// the office's find-anything: pages, individual settings, actions and every
// record in the draft, ranked together. settings carry the words staff might
// use for them, because nobody remembers what a thing is officially called.
import { VARIANTS, type OfficeDocument } from './model.ts';
import { OFFICE_LINKS, officeHref } from './navigation.ts';
import { RULE_INFO, type RuleKey } from './policies.ts';
import { batchYears } from './requirements.ts';
import { batchStage, nextBatch } from './batches.ts';

export type SearchAction = 'save' | 'preview' | 'backup';
export type SearchEntry = {
	label: string;
	detail: string;
	icon: string;
	href?: string;
	action?: SearchAction;
	/** other words for it; matched, never shown */
	words?: string;
};
export type SearchGroup = { title: string; hits: SearchEntry[] };

const setting = (label: string, detail: string, icon: string, href: string, words = ''): SearchEntry => ({
	label,
	detail,
	icon,
	href,
	words
});

/** every setting worth finding by name, wherever it lives */
function settings(next: number): SearchEntry[] {
	const batch = `/admin/batches/${next}`;
	const rule = (key: RuleKey) =>
		setting(
			RULE_INFO[key].label,
			RULE_INFO[key].help,
			'sliders',
			`/admin/rules#rule-${key}`,
			'policy limit credits load'
		);
	return [
		...(Object.keys(RULE_INFO) as RuleKey[]).map(rule),
		setting(
			'CGPA to graduate',
			'University policies',
			'sliders',
			'/admin/rules#policy-graduation',
			'gpa minimum degree'
		),
		setting(
			'CGPA to keep financial aid',
			'University policies',
			'sliders',
			'/admin/rules#policy-aid',
			'gpa scholarship'
		),
		setting(
			'CGPA for an exit award',
			'University policies',
			'sliders',
			'/admin/rules#policy-exit',
			'gpa leave diploma'
		),
		setting(
			'Foundation courses per trimester',
			'University policies',
			'sliders',
			'/admin/rules#policy-foundation',
			'kccs core year 1'
		),
		setting(
			'Course sizes that can be audited',
			'University policies',
			'sliders',
			'/admin/rules#policy-audit',
			'audit credits'
		),
		setting(
			'Courses that can never be audited',
			'University policies',
			'sliders',
			'/admin/rules#policy-audit-excluded',
			'audit excluded'
		),
		setting(
			'Grade points',
			'What each letter grade is worth',
			'sliders',
			'/admin/rules#grade-points',
			'gpa letter scale marks'
		),
		setting(
			'Policy source and effective date',
			'Where the numbers come from',
			'sliders',
			'/admin/rules#policy-source',
			'reference circular regulation notes'
		),

		setting(
			'Open or close a programme for a batch',
			'Offer a major, minor or concentration to one batch on',
			'layers',
			`${batch}?section=programmes`,
			'new major introduce add remove philosophy available'
		),
		setting(
			'Change which curriculum a batch follows',
			'Move a batch to another set of requirements, or give it its own',
			'layers',
			`${batch}?section=requirements`,
			'requirement set copy fork'
		),
		setting(
			'Course rules for one batch',
			'Make a course required or elective for a single batch',
			'layers',
			`${batch}?section=requirements#course-rules`,
			'override exception required elective'
		),
		setting(
			'Record a change for a batch',
			'Keep a note of what changed, why and who decided',
			'layers',
			`${batch}#log`,
			'log note senate minutes decision'
		),
		setting(
			'What changed for a batch',
			'Everything different from the batch before',
			'layers',
			batch,
			'difference compare summary'
		),
		setting('Plan another batch', 'Add a batch further ahead', 'layers', '/admin/batches#plan', 'new future year add'),

		setting(
			'Programme credits',
			'Total, required and elective credits',
			'degree',
			'/admin/requirements#credits',
			'degree requirement total'
		),
		setting(
			'Required courses of a programme',
			'Degree requirements',
			'degree',
			'/admin/requirements#required',
			'compulsory mandatory core'
		),
		setting('Electives of a programme', 'Degree requirements', 'degree', '/admin/requirements#electives', 'optional'),
		setting('Choice pools', 'Pick N of these courses', 'degree', '/admin/requirements#choices', 'choose group pick'),
		setting(
			'Suggested path',
			'Which trimester each course sits in',
			'degree',
			'/admin/requirements#pathway',
			'recommended order pathway roadmap'
		),
		setting(
			'Capstone project',
			'Credits and whether it is required',
			'degree',
			'/admin/requirements#capstone',
			'thesis research final project'
		),

		setting(
			'Cross-listed courses',
			'Courses with more than one code',
			'link',
			'/admin/rules#cross-listed',
			'alias codes'
		),
		setting(
			'Interchangeable courses',
			'Any one of a group satisfies the others',
			'link',
			'/admin/rules#interchangeable',
			'substitute equivalent'
		),
		setting(
			'One-way substitutions',
			'One course accepted in place of another',
			'link',
			'/admin/rules#one-way',
			'substitute replace waiver'
		),
		setting(
			'Credit sharing between programmes',
			'How a shared course counts',
			'link',
			'/admin/rules#credit-counting',
			'double count overlap'
		),

		setting('Add a course', 'Create a new catalogue entry', 'book', '/admin/courses', 'new create'),
		setting(
			'Course credits, description and status',
			'Open a course to edit it',
			'book',
			'/admin/courses',
			'retire retired archive title'
		),
		setting('Prerequisites', 'What a course needs first', 'branch', '/admin/courses', 'requirement before corequisite'),
		setting('Audit policy of a course', 'Open a course, then Details', 'book', '/admin/courses', 'audit'),
		setting(
			'Add a term',
			'A new trimester to offer courses in',
			'calendar',
			'/admin/offerings',
			'trimester semester new dates'
		),
		setting(
			'Section capacity and enrolment',
			'Open a term, then a section',
			'calendar',
			'/admin/offerings',
			'seats limit minimum class size'
		),
		setting(
			'Assign faculty to a section',
			'Who teaches what, term by term',
			'calendar',
			'/admin/offerings',
			'teacher instructor lecturer professor'
		),
		setting(
			'Department colour and short label',
			'How a subject appears in the planner',
			'grid',
			'/admin/departments',
			'hue name abbreviation'
		),
		setting(
			'Course-code prefixes',
			'How imports recognise a department',
			'grid',
			'/admin/departments',
			'ECON MATH code'
		),
		setting(
			'Extra columns on offerings',
			'Fields only the office sees',
			'settings',
			'/admin/settings',
			'custom room budget'
		),
		setting(
			'Restore an earlier release',
			'Go back to a past version',
			'history',
			'/admin/history',
			'undo rollback revert version'
		)
	];
}

const ACTIONS: SearchEntry[] = [
	{
		label: 'Save draft',
		detail: 'Keep your edits in the shared draft',
		icon: 'check',
		action: 'save',
		words: 'ctrl s'
	},
	{
		label: 'Open student preview',
		detail: 'See the unsaved draft as a student would',
		icon: 'external',
		action: 'preview',
		words: 'planner view test'
	},
	{
		label: 'Download Excel backup',
		detail: 'The whole draft as a spreadsheet',
		icon: 'upload',
		action: 'backup',
		words: 'export xlsx'
	}
];

/** how well an entry answers the query; 0 means every word didn't match */
function scoreEntry(entry: SearchEntry, words: string[]): number {
	const label = entry.label.toLowerCase();
	const all = `${label} ${entry.detail} ${entry.words ?? ''}`.toLowerCase();
	let score = 0;
	for (const word of words) {
		if (!all.includes(word)) return 0;
		if (label === word) score += 40;
		else if (label.startsWith(word)) score += 24;
		else if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) score += 14;
		else if (label.includes(word)) score += 6;
		else score += 2;
	}
	return score;
}

function records(doc: OfficeDocument, now: Date): SearchGroup[] {
	const c = doc.curriculum;
	const programmes = c.subjects
		.filter((s) => s.id !== 'core' && s.id !== 'open')
		.flatMap((s) =>
			VARIANTS.map((v) => ({
				label: `${s.label} · ${v.label}`,
				detail: 'Degree requirements',
				icon: 'degree',
				href: `/admin/requirements?subject=${encodeURIComponent(s.id)}&variant=${v.id}`,
				words: v.id.replace(/_/g, ' ')
			}))
		);
	return [
		{
			title: 'Batches',
			hits: batchYears(doc, now).map((year) => ({
				label: `${year} batch`,
				detail: batchStage(year, now),
				icon: 'layers',
				href: `/admin/batches/${year}`
			}))
		},
		{
			title: 'Courses',
			hits: c.courses.map((course) => ({
				label: `${course.code} · ${course.title}`,
				detail: course.retired ? 'Retired' : `${course.credits} credits`,
				icon: 'book',
				href: `/admin/courses?course=${encodeURIComponent(course.code)}`,
				words: course.codes.join(' ')
			}))
		},
		{ title: 'Programmes', hits: programmes },
		{
			title: 'Departments',
			hits: c.subjects.map((s) => ({
				label: s.label,
				detail: `Department · ${s.short}`,
				icon: 'grid',
				href: `/admin/departments?id=${encodeURIComponent(s.id)}`
			}))
		},
		{
			title: 'Faculty',
			hits: c.lecturers.map((f) => ({
				label: f.name,
				detail: f.position || f.email || 'Faculty',
				icon: 'people',
				href: `/admin/faculty?id=${encodeURIComponent(f.id)}`,
				words: f.email
			}))
		},
		{
			title: 'Terms',
			hits: doc.terms.map((t) => ({
				label: t.label,
				detail: t.status,
				icon: 'calendar',
				href: `/admin/offerings?term=${encodeURIComponent(t.id)}`
			}))
		}
	];
}

/** what's worth offering before anything is typed */
export function shortcuts(now = new Date()): SearchGroup[] {
	const next = nextBatch(now);
	return [
		{
			title: 'Jump to',
			hits: [
				{ label: `${next} batch`, detail: 'The next intake', icon: 'layers', href: `/admin/batches/${next}` },
				{ label: 'Review & publish', detail: 'Checks and the student site', icon: 'publish', href: '/admin/changes' },
				{ label: 'Courses', detail: 'The whole catalogue', icon: 'book', href: '/admin/courses' },
				{ label: 'Rules', detail: 'Policies, credit limits and equivalences', icon: 'sliders', href: '/admin/rules' }
			]
		}
	];
}

const EACH = 6;

/** everything matching the query, the group with the best answer first */
export function searchOffice(doc: OfficeDocument | null, query: string, now = new Date()): SearchGroup[] {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	const pages = OFFICE_LINKS.map((p) => ({
		label: p.label,
		detail: p.detail,
		icon: p.icon,
		href: officeHref(p.path),
		words: 'page'
	}));
	const groups: SearchGroup[] = [
		{ title: 'Settings', hits: settings(nextBatch(now)) },
		{ title: 'Pages', hits: pages },
		{ title: 'Actions', hits: ACTIONS },
		...(doc ? records(doc, now) : [])
	];
	return groups
		.map(({ title, hits }) => {
			const ranked = hits
				.map((hit) => ({ hit, score: scoreEntry(hit, words) }))
				.filter((r) => r.score > 0)
				.sort((a, b) => b.score - a.score);
			return { title, ranked };
		})
		.filter((g) => g.ranked.length)
		.sort((a, b) => b.ranked[0].score - a.ranked[0].score)
		.map((g) => ({ title: g.title, hits: g.ranked.slice(0, EACH).map((r) => r.hit) }));
}

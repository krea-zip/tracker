// read back the text "copy plan as text" writes, so a plan pasted from an
// email or a chat can go back on the board. The format:
//
//   political science major + economics minor + history concentration · 4-year · batch 2023
//
//   y1 t1 (12 cr): KCCS101 Writing and Oral Communication; KCCS102 Mathematical Reasoning
//   t7 (8 cr): HIST355 Indian Historiography; ...
//
//   144 of 164 credits placed
//
// Only the codes matter on a course line, titles are ignored, and a
// department's own code (HIST301 for SOCL304) is read as the same course.
import { byCode, hasCode, SUBJECTS } from '$lib/curriculum/data';
import { slotKey, type SlotKey, type StructureKind, type TrimNum } from '$lib/types';
import { MAX_YEARS } from './structure';
import type { Picks } from './picks';

export type ParsedPlan = {
	save: {
		fourYear?: boolean;
		yearCount: number;
		batchStartYear?: number;
		structure?: StructureKind;
		picks?: Partial<Picks>;
		placements: Record<SlotKey, string[]>;
		// a pasted plan starts clean: nothing carried over from the board
		breaks: Record<string, never>;
		grades: Record<string, never>;
		audited: never[];
		waived: never[];
		zoomPos: Record<string, never>;
		touched: true;
	};
	courses: number;
	/** what couldn't be read, to show rather than drop silently */
	problems: string[];
};

const ROLE_WORDS = ['second major', 'concentration', 'major', 'minor'] as const;

function readDegree(line: string, problems: string[]) {
	const out: { structure?: StructureKind; picks?: Partial<Picks>; fourYear?: boolean; batch?: number } = {};
	const parts = line.split('·').map((p) => p.trim().toLowerCase());
	for (const part of parts) {
		const years = part.match(/^([34])-year$/);
		if (years) out.fourYear = years[1] === '4';
		const batch = part.match(/^batch (\d{4})$/);
		if (batch) out.batch = Number(batch[1]);
	}
	const programmes = parts[0].split('+').map((p) => p.trim());
	const roles: string[] = [];
	const picks: Partial<Picks> = {};
	for (const p of programmes) {
		const role = ROLE_WORDS.find((r) => p.endsWith(' ' + r));
		const label = role ? p.slice(0, -role.length).trim() : '';
		const subject = SUBJECTS.find((s) => s.label.toLowerCase() === label || s.id === label);
		if (!role || !subject) {
			problems.push(`couldn't read the programme "${p}"`);
			continue;
		}
		const key: keyof Picks =
			role === 'minor' ? 'minor' : role === 'concentration' ? 'conc' : picks.major1 ? 'major2' : 'major1';
		picks[key] = subject.id;
		roles.push(key);
	}
	const shape = roles.sort().join(',');
	const structure = (
		{
			major1: 'single-major',
			'major1,major2': 'double-major',
			'major1,minor': 'major-minor',
			'conc,major1': 'major-conc',
			'conc,major1,minor': 'major-minor-conc'
		} as Record<string, StructureKind>
	)[shape];
	if (structure) {
		out.structure = structure;
		out.picks = picks;
	} else if (roles.length) problems.push('the degree line names a mix of programmes the planner has no structure for');
	return out;
}

/** "y3 t2" or, with trimesters named through the degree, "t8" */
function readSlot(name: string): { year: number; trim: TrimNum } | null {
	const yt = name.match(/^y(\d+)\s*t([123])$/i);
	if (yt) return { year: Number(yt[1]), trim: Number(yt[2]) as TrimNum };
	const t = name.match(/^t(\d+)$/i);
	if (t && Number(t[1]) >= 1) {
		const n = Number(t[1]) - 1;
		return { year: Math.floor(n / 3) + 1, trim: ((n % 3) + 1) as TrimNum };
	}
	return null;
}

export function parsePlanText(text: string): ParsedPlan {
	const problems: string[] = [];
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	const placements: Record<SlotKey, string[]> = {};
	const seen = new Set<string>();
	let degree: ReturnType<typeof readDegree> = {};
	let maxYear = 0;
	let courses = 0;

	for (const [i, line] of lines.entries()) {
		const slotLine = line.match(/^([^:(]+?)\s*(?:\([^)]*\))?\s*:\s*(.*)$/);
		const slot = slotLine && readSlot(slotLine[1].trim());
		if (slotLine && slot) {
			if (slot.year < 1 || slot.year > MAX_YEARS) {
				problems.push(`"${slotLine[1].trim()}" is past the last year a plan can have`);
				continue;
			}
			maxYear = Math.max(maxYear, slot.year);
			for (const entry of slotLine[2].split(';')) {
				const code = entry.trim().split(/\s+/)[0]?.toUpperCase().replace(/\s/g, '');
				if (!code) continue;
				if (!hasCode(code)) {
					problems.push(`${code} isn't in the course list`);
					continue;
				}
				const canonical = byCode(code).code;
				if (seen.has(canonical)) {
					problems.push(`${code} is listed twice, kept the first`);
					continue;
				}
				seen.add(canonical);
				(placements[slotKey(slot.year, slot.trim)] ??= []).push(canonical);
				courses++;
			}
		} else if (i === 0 && line.includes('·')) {
			degree = readDegree(line, problems);
		} else if (!/credits placed$/i.test(line)) {
			problems.push(`skipped "${line.length > 50 ? line.slice(0, 50) + '…' : line}"`);
		}
	}

	const fourYear = degree.fourYear;
	const baseYears = fourYear === false ? 3 : 4;
	return {
		save: {
			fourYear,
			yearCount: Math.min(MAX_YEARS, Math.max(baseYears, maxYear)),
			batchStartYear: degree.batch,
			structure: degree.structure,
			picks: degree.picks,
			placements,
			breaks: {},
			grades: {},
			audited: [],
			waived: [],
			zoomPos: {},
			touched: true
		},
		courses,
		problems
	};
}

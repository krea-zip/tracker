import {
	newCourse,
	newOffering,
	courseByCode,
	applyAdmission,
	type OfficeDocument,
	type OfficeCourse,
	type Offering,
	type Eligibility,
	type AdmissionRule,
	type SourceImport
} from './model.ts';

function parseCsv(input: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [],
		field = '',
		quoted = false;
	const text = input.replace(/^\uFEFF/, '');
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			if (quoted && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (quoted || field === '') quoted = !quoted;
			else field += c;
		} else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
			row.push(field);
			field = '';
			if (c !== ',') {
				rows.push(row);
				row = [];
				if (c === '\r' && text[i + 1] === '\n') i++;
			}
		} else field += c;
	}
	if (quoted) throw Error('A quoted cell is not closed. Save the spreadsheet as CSV again.');
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}
const normalHeader = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
const codesIn = (v: string) => [
	...new Set((v.toUpperCase().match(/\b[A-Z]{2,5}\s*\d{3}[A-Z]?\b/g) ?? []).map((c) => c.replace(/\s/g, '')))
];
const blank = (v: string) => /^(?:|[-–\u2014]+|none\.?|nil|n\/?a|tbd)$/i.test(v.trim());
export function eligibility(v: string): Eligibility {
	if (/repeat/i.test(v)) return 'repeaters';
	if (/permission|discretion/i.test(v)) return 'permission';
	if (/^yes$|^y$/i.test(v.trim())) return 'allowed';
	if (/^no$|^n$/i.test(v.trim())) return 'not-allowed';
	return 'unknown';
}
export const IMPORT_FIELDS = [
	['code', 'Course code / sections'],
	['title', 'Course title'],
	['credits', 'Credits'],
	['faculty', 'Faculty names / email'],
	['email', 'Faculty email'],
	['type', 'Course type'],
	['description', 'Description'],
	['prereqs', 'Prerequisites'],
	['unlocks', 'Future courses'],
	['requiredFor', 'Required for'],
	['office', 'OAA verification / remarks'],
	['remarks', 'Remarks'],
	['audit', 'Audit permission'],
	['capacity', 'Capacity'],
	['delivery', 'Delivery mode'],
	['practical', 'Lab / practical requirements'],
	['term', 'Term']
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number][0];
export type Mapping = Partial<Record<ImportField, number>>;
export function detectMapping(headers: string[]): Mapping {
	const out: Mapping = {};
	headers.forEach((raw, i) => {
		const h = normalHeader(raw);
		let field: ImportField | undefined;
		if (h.includes('course code')) field = 'code';
		else if (h.includes('course title')) field = 'title';
		else if (h.includes('credit')) field = 'credits';
		else if (h.includes('faculty')) field = 'faculty';
		else if (h.includes('email')) field = 'email';
		else if (h.startsWith('course type')) field = 'type';
		else if (h === 'description') field = 'description';
		else if (h.includes('prerequisites to enrol')) field = 'prereqs';
		else if (h.includes('future course')) field = 'unlocks';
		else if (h === 'required for') field = 'requiredFor';
		else if (h.includes('oaa')) field = 'office';
		else if (h === 'remarks') field = 'remarks';
		else if (h === 'audit') field = 'audit';
		else if (h.includes('capped at') || h === 'capacity') field = 'capacity';
		else if (h.includes('delivery')) field = 'delivery';
		else if (h.includes('lab component')) field = 'practical';
		else if (h.startsWith('term') || h.startsWith('trimester')) field = 'term';
		if (field) out[field] = i;
	});
	return out;
}
function parsePrerequisites(text: string, doc: OfficeDocument): { rule: AdmissionRule; uncertain: boolean } {
	const rule: AdmissionRule = {
		groups: [],
		recommended: [],
		permission: /permission|waiv|discretion/i.test(text),
		note: '',
		source: text
	};
	if (blank(text) || /^no$/i.test(text.trim())) return { rule, uncertain: false };
	let uncertain = false;
	for (const clause of text
		.split(/\n|;|,(?![^()]*\))/)
		.map((x) => x.trim())
		.filter(Boolean)) {
		const codes = codesIn(clause).map((code) => courseByCode(doc, code)?.code ?? code);
		if (/recommend|suggest/i.test(clause)) {
			rule.recommended.push(...codes);
			if (!codes.length) uncertain = true;
			continue;
		}
		if (!codes.length) {
			uncertain = true;
			continue;
		}
		if (/\bor\b/i.test(clause))
			rule.groups.push({
				codes: [...new Set(codes)],
				concurrent: /concurrent|together|currently enrolled/i.test(clause)
			});
		else for (const code of new Set(codes)) rule.groups.push({ codes: [code], concurrent: false });
		if (codes.some((code) => !courseByCode(doc, code))) uncertain = true;
		if (/[|]/.test(clause) && new Set(codes).size > 1) uncertain = true;
		if (/waiv|discretion|permission|\band\b/i.test(clause)) uncertain = true;
	}
	// Keep explanatory text for human confirmation; never silently enforce prose.
	if (uncertain) rule.note = text;
	return { rule, uncertain };
}
export type ImportRow = {
	row: number;
	selected: boolean;
	action: 'new' | 'update';
	course: OfficeCourse;
	offering: Offering;
	description: string;
	messages: string[];
	raw: string[];
};
export type ImportPreview = {
	rows: ImportRow[];
	warnings: string[];
	skipped: number;
	mapping: Mapping;
	headers: string[];
	fingerprint: string;
};
export async function fingerprint(rows: string[][]): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
	return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function previewImport(
	rows: string[][],
	name: string,
	term: string,
	doc: OfficeDocument,
	mapping?: Mapping
): Promise<ImportPreview> {
	const headers = rows[0] ?? [];
	const map = mapping ?? detectMapping(headers);
	if (map.code === undefined || map.title === undefined)
		throw Error('Match the Course code and Course title columns before continuing.');
	const hash = await fingerprint(rows),
		warnings: string[] = [];
	let skipped = 0;
	if (doc.imports.some((i) => i.fingerprint === hash))
		warnings.push('This spreadsheet has already been imported. Review its term and changes before importing it again.');
	const filenameTerm = name.match(/(\d{2})_T([123])/i)?.[0]?.toUpperCase();
	if (filenameTerm && filenameTerm !== term)
		warnings.push(`The filename says ${filenameTerm}; you selected ${term}. Confirm which term this file belongs to.`);
	const parsed: ImportRow[] = [];
	const seen = new Set<string>();
	for (let i = 1; i < rows.length; i++) {
		const raw = rows[i];
		const get = (f: ImportField) => (map[f] === undefined ? '' : (raw[map[f]!] ?? '').trim());
		if (!raw.some((x) => x.trim()) || normalHeader(get('code')).includes('course code')) {
			skipped++;
			continue;
		}
		const aliases = codesIn(get('code'));
		const title = get('title');
		const messages: string[] = [];
		if (!aliases.length || !title) {
			warnings.push(
				`Row ${i + 1}: course code or title is missing; this row is kept in the source file but cannot be applied.`
			);
			skipped++;
			continue;
		}
		const existing = aliases.map((code) => courseByCode(doc, code)).find(Boolean);
		const subject = existing?.subject ?? doc.prefixes[aliases[0].match(/^[A-Z]+/)?.[0] ?? ''];
		if (!subject) messages.push('Choose a department for this new code prefix.');
		const course = existing ? structuredClone(existing) : newCourse(aliases[0], title, subject ?? '');
		course.title = title;
		course.codes = [...new Set([...course.codes, ...aliases])];
		for (const alias of aliases) {
			const dept = doc.prefixes[alias.match(/^[A-Z]+/)?.[0] ?? ''];
			if (dept) {
				course.codesBySubject[dept] = alias;
				if (!course.subjects.includes(dept)) course.subjects.push(dept);
			} else messages.push(`Assign department for ${alias}.`);
		}
		if (!blank(get('credits'))) {
			const credits = Number(get('credits'));
			if (Number.isFinite(credits) && credits >= 0 && credits <= 30) {
				course.credits = credits;
				course.pendingCredits = false;
			} else messages.push('Credits are not a valid number.');
		}
		if (!existing && course.pendingCredits) messages.push('Confirm the credits.');
		// A section stays separate even when its base course is cross-listed.
		const section = get('code').match(/\(([^)]+)\)\s*$/)?.[1] ?? '';
		const oldOffering = doc.offerings.find((o) => o.code === course.code && o.term === term && o.section === section);
		const offering = oldOffering ? structuredClone(oldOffering) : newOffering(course.code, term, section);
		offering.approval = 'draft';
		offering.sourceRow = i + 1;
		if (!blank(get('faculty'))) offering.facultyText = get('faculty');
		const emails: string[] =
			(get('email') + ' ' + get('faculty')).toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
		if (emails.length)
			offering.faculty = doc.curriculum.lecturers
				.filter((f) => emails.includes(f.email.toLowerCase()))
				.map((f) => f.id);
		for (let j = 0; j < headers.length; j++) {
			const h = normalHeader(headers[j]);
			const match = h.match(/^(year\s*[1-5]|msc\s*year\s*\d|phd\s*(?:year\s*)?\d*)/);
			if (match) {
				offering.eligibility[match[1].replace(/\s+/g, ' ')] = eligibility(raw[j] ?? '');
				if (offering.eligibility[match[1].replace(/\s+/g, ' ')] === 'unknown' && !blank(raw[j] ?? ''))
					messages.push(`Review eligibility: ${raw[j]}`);
			}
		}
		if (!existing)
			course.eligibleYears = Object.entries(offering.eligibility)
				.filter(([k, v]) => /^year [1-5]$/.test(k) && v === 'allowed')
				.map(([k]) => Number(k.at(-1)));
		offering.audit = map.audit === undefined ? offering.audit : eligibility(get('audit'));
		for (const [field, source] of [
			['delivery', 'delivery'],
			['practical', 'practical'],
			['requirements', 'requiredFor'],
			['officeNote', 'office']
		] as const)
			if (!blank(get(source))) offering[field] = get(source);
		if (!blank(get('remarks'))) offering.officeNote = [offering.officeNote, get('remarks')].filter(Boolean).join('\n');
		if (!blank(get('capacity'))) {
			const n = Number(get('capacity'));
			if (Number.isInteger(n) && n >= 0) offering.capacity = n;
			else messages.push('Review capacity.');
		}
		const capHint = get('remarks').match(/(?:cap(?:ped)?(?:\s+at)?|max(?:imum)?(?:\s+intake)?)[\s:]+(\d+)/i);
		if (capHint) {
			if (offering.capacity !== null && offering.capacity !== Number(capHint[1]))
				messages.push('Capacity conflicts with the remarks.');
			else if (offering.capacity === null) {
				offering.capacity = Number(capHint[1]);
				messages.push('Capacity was read from remarks; confirm it.');
			}
		}
		if (!blank(get('prereqs'))) {
			const result = parsePrerequisites(get('prereqs'), doc);
			applyAdmission(course, result.rule);
			if (result.uncertain) messages.push('Review the prerequisite wording and alternatives.');
		}
		const type = get('type');
		if (!existing && /required|core|kccs/i.test(type)) course.required = true;
		if (type.includes('|') || /required.*elective/i.test(type))
			messages.push('Review required/elective classification for each programme.');
		const termText = get('term').match(/trimester\s*([123])/i)?.[1];
		if (termText && termText !== term.at(-1))
			warnings.push(`Row ${i + 1} says trimester ${termText}, different from the selected term.`);
		// Preserve every source cell, including unknown or unnamed columns.
		headers.forEach((h, j) => (offering.extras[`source:${j}:${h || 'Unnamed column'}`] = raw[j] ?? ''));
		const key = `${course.code}|${section}`;
		if (seen.has(key)) messages.push('Duplicate course and section in this file.');
		seen.add(key);
		parsed.push({
			row: i + 1,
			selected: !!subject && !messages.some((m) => /Duplicate|Credits are/.test(m)),
			action: existing ? 'update' : 'new',
			course,
			offering,
			description: blank(get('description')) ? '' : get('description'),
			messages,
			raw
		});
	}
	return { rows: parsed, warnings: [...new Set(warnings)], skipped, mapping: map, headers, fingerprint: hash };
}
export function applyImport(doc: OfficeDocument, preview: ImportPreview, name: string, term: string, rows: string[][]) {
	const source: SourceImport = {
		id: crypto.randomUUID(),
		name,
		term,
		fingerprint: preview.fingerprint,
		headers: preview.headers,
		rows,
		importedAt: new Date().toISOString(),
		count: preview.rows.filter((r) => r.selected).length
	};
	for (const row of preview.rows.filter((r) => r.selected)) {
		const index = doc.curriculum.courses.findIndex((c) => c.code === row.course.code);
		if (index < 0) doc.curriculum.courses.push(structuredClone(row.course));
		else doc.curriculum.courses[index] = structuredClone(row.course);
		const offering = structuredClone(row.offering);
		offering.sourceImport = source.id;
		const i = doc.offerings.findIndex((o) => o.id === offering.id);
		if (i < 0) doc.offerings.push(offering);
		else doc.offerings[i] = offering;
		if (row.description) doc.descriptions[row.course.code] = row.description;
	}
	doc.imports.push(source);
}
export async function readWorkbook(file: File): Promise<{ name: string; rows: string[][] }[]> {
	if (file.size > 12 * 1024 * 1024) throw Error('Please use a file smaller than 12 MB.');
	if (/\.csv$/i.test(file.name)) return [{ name: file.name, rows: parseCsv(await file.text()) }];
	if (!/\.xlsx$/i.test(file.name)) throw Error('Choose a CSV or Excel (.xlsx) file.');
	const { default: ExcelJS } = await import('exceljs');
	const book = new ExcelJS.Workbook();
	await book.xlsx.load(await file.arrayBuffer(), {
		ignoreNodes: ['dataValidations', 'conditionalFormatting', 'drawing', 'extLst']
	});
	return book.worksheets.map((sheet) => {
		if (sheet.rowCount > 10000 || sheet.columnCount > 200)
			throw Error('A sheet exceeds 10,000 rows or 200 columns. Split it into smaller files.');
		const rows: string[][] = [];
		sheet.eachRow({ includeEmpty: true }, (row) => {
			const cells: string[] = [];
			for (let i = 1; i <= sheet.columnCount; i++) cells.push(row.getCell(i).text);
			rows.push(cells);
		});
		return { name: sheet.name, rows };
	});
}
export function download(name: string, content: BlobPart, type = 'text/csv;charset=utf-8') {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** one workbook, a sheet per table, each with a frozen, filterable header */
export async function exportWorkbook(name: string, sheets: { name: string; rows: unknown[][] }[]) {
	const { default: ExcelJS } = await import('exceljs');
	const book = new ExcelJS.Workbook();
	for (const { name: title, rows } of sheets) {
		const sheet = book.addWorksheet(title);
		rows.forEach((row) => sheet.addRow(row.map((v) => v ?? '')));
		sheet.views = [{ state: 'frozen', ySplit: 1 }];
		sheet.getRow(1).font = { bold: true };
		sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: rows[0]?.length ?? 1 } };
		sheet.columns.forEach((c) => (c.width = 24));
	}
	const data = await book.xlsx.writeBuffer();
	download(name, new Uint8Array(data), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

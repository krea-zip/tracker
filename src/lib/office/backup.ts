// the whole draft as one Excel file the office can open: courses, every
// term's offerings and the faculty list, unsaved edits included.
import type { OfficeDocument } from './model';
import { exportWorkbook } from './spreadsheet';

const YEARS = ['year 1', 'year 2', 'year 3', 'year 4'];

export function downloadBackup(doc: OfficeDocument) {
	const title = (code: string) => doc.curriculum.courses.find((c) => c.code === code)?.title ?? '';
	const term = (id: string) => doc.terms.find((t) => t.id === id)?.label ?? id;
	return exportWorkbook(`tracker-backup-${new Date().toISOString().slice(0, 10)}.xlsx`, [
		{
			name: 'Courses',
			rows: [
				['Code', 'Title', 'Department', 'Credits', 'Runs in', 'Years', 'Prerequisites', 'Faculty', 'Status'],
				...doc.curriculum.courses.map((c) => [
					c.code,
					c.title,
					c.subject,
					c.credits,
					c.offered.map((t) => `T${t}`).join(' '),
					c.eligibleYears.join(' '),
					c.prereqs.join(' '),
					c.faculty,
					c.retired ? 'retired' : ''
				])
			]
		},
		{
			name: 'Offerings',
			rows: [
				[
					'Term',
					'Code',
					'Section',
					'Title',
					'Faculty',
					'Capacity',
					'Minimum',
					'Delivery',
					'Approval',
					...YEARS,
					...doc.fields.map((f) => f.label)
				],
				...doc.offerings.map((o) => [
					term(o.term),
					o.code,
					o.section,
					title(o.code),
					o.facultyText,
					o.capacity,
					o.minimum,
					o.delivery,
					o.approval,
					...YEARS.map((y) => o.eligibility[y] ?? ''),
					...doc.fields.map((f) => o.extras[f.id] ?? '')
				])
			]
		},
		{
			name: 'Faculty',
			rows: [
				['Name', 'Email', 'Position', 'Office hours'],
				...doc.curriculum.lecturers.map((f) => [f.name, f.email, f.position, f.office_hours])
			]
		}
	]);
}

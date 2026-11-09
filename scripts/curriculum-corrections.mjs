import { createHash } from 'node:crypto';

/** Repair the legacy course-sheet merge without overwriting independently
 * maintained course records. Both codes were put in MATH191's code field;
 * they are separate courses that may substitute for each other.
 * @param {import('../src/lib/curriculum/snapshot').CurriculumSnapshot} snapshot
 */
export function separateIntroMathCourses(snapshot) {
	const mergedIndex = snapshot.courses.findIndex(
		(course) => course.code === 'MATH191' && course.codes.includes('COMP191')
	);
	if (mergedIndex < 0) return snapshot;
	const merged = snapshot.courses[mergedIndex];

	const corrected = structuredClone(snapshot);
	const maths = corrected.courses[mergedIndex];
	if (!corrected.courses.some((course) => course.code === 'COMP191')) {
		// Keep the information the source sheet supplied for these codes.
		// Subsequent releases with separate records retain their own metadata.
		corrected.courses.push({
			...structuredClone(merged),
			code: 'COMP191',
			subject: 'computer science',
			subjects: ['computer science'],
			codes: ['COMP191'],
			codesBySubject: { 'computer science': 'COMP191' }
		});
	}
	maths.codes = maths.codes.filter((code) => code !== 'COMP191');
	for (const [subject, code] of Object.entries(maths.codesBySubject)) {
		if (code !== 'COMP191') continue;
		delete maths.codesBySubject[subject];
		maths.subjects = maths.subjects.filter((value) => value !== subject);
	}
	if (!corrected.equivalences.substitutes.some((group) => group.includes('MATH191') && group.includes('COMP191'))) {
		corrected.equivalences.substitutes.push(['MATH191', 'COMP191']);
	}
	const { release: _previousRelease, ...content } = corrected;
	corrected.release = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12);
	return corrected;
}

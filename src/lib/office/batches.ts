// everything the office can say about one batch: which programmes it can take,
// which curriculum it follows, what's different from the batch before, and the
// record of why. these read and edit the draft; the pages only show them.
import {
	subjectOffered,
	type ProgrammeRequirements,
	type RequirementSet,
	type Variant
} from '$lib/curriculum/snapshot.ts';
import type { ProgrammeRole, Subject } from '$lib/types';
import { VARIANTS, type BatchChange, type OfficeBatchProfile, type OfficeDocument } from './model.ts';
import { batchYears, programmeFor, setFor } from './requirements.ts';

export const ROLES: ProgrammeRole[] = ['major', 'minor', 'concentration'];

/** the tracks a role runs on: a major has four, the others two */
export const tracksOf = (role: ProgrammeRole): Variant[] =>
	VARIANTS.map((v) => v.id).filter((id) => id.includes(role === 'major' ? 'major' : role));

const profiles = (doc: OfficeDocument) => doc.curriculum.batchProfiles ?? [];
export const profileOf = (doc: OfficeDocument, batch: number) => profiles(doc).find((p) => p.batch === batch);

function ensureProfile(doc: OfficeDocument, batch: number): OfficeBatchProfile {
	const found = profileOf(doc, batch);
	if (found) return found;
	const list = (doc.curriculum.batchProfiles ??= []);
	list.push({ batch, offers: {}, changes: [], note: '' });
	list.sort((a, b) => a.batch - b.batch);
	// read it back: in the office the draft is reactive, and only the list's
	// own copy of the record is tracked
	return profileOf(doc, batch)!;
}

/** a record that says nothing isn't kept, so resetting leaves the draft clean */
function prune(doc: OfficeDocument, batch: number) {
	const p = profileOf(doc, batch);
	if (!p || Object.keys(p.offers).length || p.changes.length || p.note) return;
	doc.curriculum.batchProfiles = profiles(doc).filter((x) => x !== p);
}

/** a batch the office is planning ahead for, past the years it lists anyway */
export const planBatch = (doc: OfficeDocument, batch: number) => void ensureProfile(doc, batch);

// ── programmes offered ──

export type OfferState = {
	on: boolean;
	/** what this batch itself says, if it says anything */
	own: boolean | undefined;
	/** the earlier batch this one inherits from, null if it's the usual offer */
	from: number | null;
};

export function offerState(doc: OfficeDocument, subject: Subject, role: ProgrammeRole, batch: number): OfferState {
	const stated = (b: OfficeBatchProfile) => b.offers[subject.id]?.[role] !== undefined;
	const earlier = profiles(doc)
		.filter((p) => p.batch < batch && stated(p))
		.sort((a, b) => b.batch - a.batch)[0];
	return {
		on: subjectOffered(subject, role, batch, profiles(doc)),
		own: profileOf(doc, batch)?.offers[subject.id]?.[role],
		from: earlier?.batch ?? null
	};
}

/** say what this batch offers, or undefined to go back to what it inherits */
export function setOffer(
	doc: OfficeDocument,
	subject: string,
	role: ProgrammeRole,
	batch: number,
	value: boolean | undefined
) {
	const p = ensureProfile(doc, batch);
	const offers = (p.offers[subject] ??= {});
	if (value === undefined) delete offers[role];
	else offers[role] = value;
	if (!Object.keys(offers).length) delete p.offers[subject];
	prune(doc, batch);
}

/** the tracks of an offered programme with no requirements to follow */
export const missingTracks = (doc: OfficeDocument, subject: string, role: ProgrammeRole, batch: number): Variant[] =>
	tracksOf(role).filter((variant) => !programmeFor(doc, batch, subject, variant)?.credits.total);

// ── which curriculum it follows ──

/** the set a batch names outright, as opposed to falling back on the default */
const namesBatch = (set: RequirementSet, batch: number) => !!set.batches?.includes(batch);

/** nobody chose this batch's curriculum: it dropped to the default, though the
 *  batch before it follows a named one. usually an oversight, not a decision */
export function fellBack(doc: OfficeDocument, batch: number): boolean {
	const named = (year: number) => doc.curriculum.requirementSets.some((s) => namesBatch(s, year));
	return !named(batch) && named(batch - 1);
}

/** move a batch to another set. the default set names no batches, so moving to
 *  it just means no other set claims this one */
export function assignSet(doc: OfficeDocument, batch: number, setId: string) {
	for (const set of doc.curriculum.requirementSets) {
		if (!set.batches) continue;
		set.batches = set.batches.filter((b) => b !== batch);
		if (set.id === setId) set.batches = [...set.batches, batch].sort((a, b) => a - b);
	}
}

/** give a batch its own copy of its curriculum to edit freely, leaving every
 *  batch that shares the original alone. it goes in batch order: the planner
 *  treats the last named set as the newest */
export function forkSet(doc: OfficeDocument, batch: number): RequirementSet {
	const sets = doc.curriculum.requirementSets;
	const source = setFor(doc, batch);
	if (!source) throw Error('This batch has no curriculum to copy.');
	let id = `batch-${batch}`;
	for (let n = 2; sets.some((s) => s.id === id); n++) id = `batch-${batch}-${n}`;
	const programmes: ProgrammeRequirements[] = JSON.parse(JSON.stringify(source.programmes));
	assignSet(doc, batch, '');
	const after = sets.findIndex((s) => s.batches?.length && Math.min(...s.batches) > batch);
	const fresh: RequirementSet = { id, name: `${batch} batch`, batches: [batch], programmes };
	sets.splice(after < 0 ? sets.length : after, 0, fresh);
	return sets.find((s) => s.id === id) ?? fresh;
}

// ── what's different ──

export type BatchDifference = {
	kind: 'curriculum' | 'programme' | 'requirements' | 'override';
	subject: string;
	title: string;
	detail: string;
};

const trackLabel = (variant: Variant) => VARIANTS.find((v) => v.id === variant)?.label ?? variant;

function listChange(before: string[], after: string[]) {
	const was = new Set(before);
	const now = new Set(after);
	const added = after.filter((c) => !was.has(c));
	const dropped = before.filter((c) => !now.has(c));
	return [added.length ? `adds ${added.join(', ')}` : '', dropped.length ? `drops ${dropped.join(', ')}` : ''].filter(
		Boolean
	);
}

function programmeChange(before: ProgrammeRequirements, after: ProgrammeRequirements): string {
	const parts: string[] = [];
	if (before.credits.total !== after.credits.total)
		parts.push(`total ${before.credits.total} → ${after.credits.total} credits`);
	parts.push(...listChange(before.required, after.required).map((p) => `required ${p}`));
	parts.push(...listChange(before.electives, after.electives).map((p) => `electives ${p}`));
	if (JSON.stringify(before.choices) !== JSON.stringify(after.choices)) parts.push('choice pools change');
	if (JSON.stringify(before.pathway) !== JSON.stringify(after.pathway)) parts.push('suggested path changes');
	return parts.join('; ');
}

/** everything that makes this batch different from another, by default the
 *  one before it. worked out from the draft, so it can't drift from what
 *  students actually get */
export function batchDifferences(doc: OfficeDocument, batch: number, last = batch - 1): BatchDifference[] {
	const out: BatchDifference[] = [];
	const before = setFor(doc, last);
	const after = setFor(doc, batch);

	for (const subject of doc.curriculum.subjects)
		for (const role of ROLES) {
			if (subject.id === 'core' || subject.id === 'open') continue;
			const was = subjectOffered(subject, role, last, profiles(doc));
			const is = subjectOffered(subject, role, batch, profiles(doc));
			if (was !== is)
				out.push({
					kind: 'programme',
					subject: subject.id,
					title: `${subject.label} ${is ? 'opens' : 'closes'} as a ${role}`,
					detail: is ? `Not offered to the ${last} batch.` : `Offered to the ${last} batch.`
				});
		}

	// the first batch on record has nothing real before it to differ from
	if (before && after && before.id !== after.id && last >= batchYears(doc)[0]) {
		out.push({
			kind: 'curriculum',
			subject: '',
			title: `Follows “${after.name}”`,
			detail: `The ${last} batch followed “${before.name}”.`
		});
		const key = (p: ProgrammeRequirements) => `${p.subject}|${p.variant}`;
		const old = new Map(before.programmes.map((p) => [key(p), p]));
		for (const p of after.programmes) {
			const prior = old.get(key(p));
			const change = prior ? programmeChange(prior, p) : 'new programme';
			if (change)
				out.push({
					kind: 'requirements',
					subject: p.subject,
					title: `${p.subject} · ${trackLabel(p.variant)}`,
					detail: change
				});
			old.delete(key(p));
		}
		for (const p of old.values())
			out.push({
				kind: 'requirements',
				subject: p.subject,
				title: `${p.subject} · ${trackLabel(p.variant)}`,
				detail: 'no longer has requirements'
			});
	}

	for (const rule of doc.curriculum.batchRules.filter((r) => r.batch === batch)) {
		const courses = Object.entries(rule.courses).map(([code, type]) => `${code} is ${type}`);
		if (rule.requiredCredits !== undefined) courses.push(`${rule.requiredCredits} required credits`);
		out.push({
			kind: 'override',
			subject: rule.subject,
			title: `${rule.subject} · ${trackLabel(rule.variant)}`,
			detail: courses.join('; ')
		});
	}
	return out;
}

// ── reusing a batch ──

/** bring another batch's offers and course rules over, without touching
 *  anything this batch has already decided; says how much came across */
export function copyBatch(doc: OfficeDocument, from: number, to: number): number {
	let copied = 0;
	for (const [subject, offers] of Object.entries(profileOf(doc, from)?.offers ?? {}))
		for (const [role, value] of Object.entries(offers)) {
			if (profileOf(doc, to)?.offers[subject]?.[role as ProgrammeRole] !== undefined) continue;
			setOffer(doc, subject, role as ProgrammeRole, to, value);
			copied++;
		}
	const rules = doc.curriculum.batchRules;
	for (const rule of rules.filter((r) => r.batch === from)) {
		if (rules.some((r) => r.batch === to && r.subject === rule.subject && r.variant === rule.variant)) continue;
		rules.push({ ...JSON.parse(JSON.stringify(rule)), batch: to });
		copied++;
	}
	return copied;
}

// ── the record of changes ──

export function logChange(doc: OfficeDocument, batch: number, change: Omit<BatchChange, 'id'>) {
	ensureProfile(doc, batch).changes.unshift({ ...change, id: crypto.randomUUID() });
}

export function removeChange(doc: OfficeDocument, batch: number, id: string) {
	const p = profileOf(doc, batch);
	if (!p) return;
	p.changes = p.changes.filter((c) => c.id !== id);
	prune(doc, batch);
}

export function setBatchNote(doc: OfficeDocument, batch: number, note: string) {
	ensureProfile(doc, batch).note = note;
	prune(doc, batch);
}

/** every recorded change, newest first, each knowing its batch */
export const allChanges = (doc: OfficeDocument) =>
	profiles(doc)
		.flatMap((p) => p.changes.map((change) => ({ ...change, batch: p.batch })))
		.sort((a, b) => b.on.localeCompare(a.on) || b.batch - a.batch);

// ── where a batch stands ──

/** the intake still to come: batches start in august */
export const nextBatch = (now = new Date()) => now.getFullYear() + (now.getMonth() >= 7 ? 1 : 0);

export function batchStage(batch: number, now = new Date()): string {
	const year = nextBatch(now) - batch;
	if (year < 0) return 'planned';
	if (year === 0) return 'next intake';
	return year > 4 ? 'graduated' : `year ${year}`;
}

export type BatchSummary = {
	batch: number;
	stage: string;
	curriculum: string;
	own: boolean;
	differences: number;
	logged: number;
};

export function batchSummary(doc: OfficeDocument, batch: number, now = new Date()): BatchSummary {
	const set = setFor(doc, batch);
	return {
		batch,
		stage: batchStage(batch, now),
		curriculum: set?.name ?? 'No curriculum',
		own: !!set?.batches && set.batches.length === 1 && namesBatch(set, batch),
		differences: batchDifferences(doc, batch).length,
		logged: profileOf(doc, batch)?.changes.length ?? 0
	};
}

// ── checks before publishing ──

export function batchProblems(doc: OfficeDocument) {
	const out: { batch: string; message: string; severity: 'error' | 'warning' }[] = [];
	const subjects = new Map(doc.curriculum.subjects.map((s) => [s.id, s]));
	for (const p of profiles(doc)) {
		const batch = String(p.batch);
		if (!Number.isInteger(p.batch) || p.batch < 2018 || p.batch > 2100)
			out.push({ batch, message: 'Enter a valid batch year.', severity: 'error' });
		for (const [id, offers] of Object.entries(p.offers)) {
			const subject = subjects.get(id);
			if (!subject) {
				out.push({ batch, message: `The department “${id}” does not exist.`, severity: 'error' });
				continue;
			}
			for (const role of ROLES) {
				if (!offers[role]) continue;
				const gaps = missingTracks(doc, id, role, p.batch);
				if (gaps.length)
					out.push({
						batch,
						message: `${subject.label} is offered as a ${role}, but ${gaps.length} of its ${tracksOf(role).length} tracks have no requirements yet.`,
						severity: 'warning'
					});
			}
		}
		if (fellBack(doc, p.batch))
			out.push({
				batch,
				message: `The ${p.batch} batch has no curriculum assigned, so it falls back to the default.`,
				severity: 'warning'
			});
		for (const change of p.changes)
			if (!change.title?.trim()) out.push({ batch, message: 'A recorded change has no title.', severity: 'error' });
	}
	return out;
}

// a programme's colour is its subject's hue, the same on every plan. sixteen
// subjects share one arc, so each sits 15° from its neighbours, too close to
// tell apart on one plan. the palette's order (the subjects' hues in the
// curriculum) puts subjects students rarely combine side by side, and when a
// plan does have two close ones, the later programme moves here to the
// nearest hue that stands clear of the others. a plan without a clash keeps
// every subject's own colour.
import type { Programme } from '$lib/types';

/** degrees two programmes' hues must be apart to read as different */
const MIN_GAP = 40;
// the palette's own arc (115° to 340°): past it lie the yellows that read
// as khaki at tracker's chip lightness, and the KCCS blush
const ARC = [112, 345];

const gap = (a: number, b: number) => {
	const d = Math.abs(a - b) % 360;
	return Math.min(d, 360 - d);
};
const wrap = (h: number) => ((h % 360) + 360) % 360;

/** each subject's hue on this plan, in the order its programmes are listed */
export function distinctHues(subjects: string[], hueOf: (subject: string) => number | undefined): Map<string, number> {
	const out = new Map<string, number>();
	for (const subject of subjects) {
		const base = hueOf(subject);
		if (base === undefined || out.has(subject)) continue;
		const taken = [...out.values()];
		const spread = (h: number) => Math.min(360, ...taken.map((t) => gap(h, t)));
		let best = base;
		// nearest first, alternating either side of the subject's own hue
		for (let step = 0; step <= 180 && spread(best) < MIN_GAP; step += 5)
			for (const h of [wrap(base + step), wrap(base - step)]) {
				if (step && (h < ARC[0] || h > ARC[1])) continue;
				if (spread(h) > spread(best)) best = h;
				if (spread(best) >= MIN_GAP) break;
			}
		out.set(subject, best);
	}
	return out;
}

/** the hues the "now" ring wears: the major's, or both of a double major's,
 *  one at each end of the ring. null before there's a major */
export function nowHues(
	programmes: Programme[],
	hueOf: (subject: string) => number | undefined
): [number, number] | null {
	const majors = programmes.filter((p) => p.role === 'major').map((p) => hueOf(p.subject));
	const [a, b = a] = majors.filter((h) => h !== undefined);
	return a === undefined ? null : [a, b];
}

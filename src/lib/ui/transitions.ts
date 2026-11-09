// ─────────────────────────────────────────────
// Shared motion, one place for the app's transitions so the grid, the
// catalogue and the zoom view animate as a single surface.
// ─────────────────────────────────────────────

import { COMPACT_LAYOUT_QUERY } from './layout';
import { crossfade, fade, scale, type TransitionConfig } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { tick } from 'svelte';

// A send/receive pair keyed by course code. When a course leaves one surface
// (`out:sendCourse`) and arrives on another (`in:receiveCourse`) in the same
// frame, it flies between the two positions: catalogue → grid on placement,
// grid → catalogue on return. With no matching partner (e.g. toggling the
// zoom view) it falls back to a soft scale, so it never just pops.
const [sendCourse, receiveCourse] = crossfade({
	duration: (distance) => Math.min(280, Math.max(160, Math.sqrt(distance) * 14)),
	easing: cubicOut,
	fallback: (node) => scale(node, { start: 0.97, opacity: 0, duration: 160, easing: cubicOut })
});

// ── redraws ──
// ONE course flying from the catalogue to the grid is worth watching. A
// REDRAW, changing a major, filling in every suggestion, resetting,
// replaces every chip at once, and twenty cards flying across the screen
// together reads as noise, not motion. A redraw opens a short quiet window
// (long enough to cover the render it triggered): chips that appear, vanish
// or shift inside it just fade where they stand.
const QUIET_MS = 150;
let quietUntil = 0;
const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
/**
 * A CSS-style cubic-bezier(x1, y1, x2, y2) as a Svelte easing function, for
 * transitions (which take a function, not a CSS string).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const x = (s: number) => ((ax * s + bx) * s + cx) * s;
	const y = (s: number) => ((ay * s + by) * s + cy) * s;
	const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
	return (t) => {
		if (t <= 0 || t >= 1) return t;
		// solve x(s) = t: Newton's method, falling back to bisection
		let s = t;
		for (let i = 0; i < 8; i++) {
			const err = x(s) - t;
			if (Math.abs(err) < 1e-5) return y(s);
			const slope = dx(s);
			if (Math.abs(slope) < 1e-6) break;
			s -= err / slope;
		}
		let lo = 0;
		let hi = 1;
		s = t;
		while (lo < hi) {
			const v = x(s);
			if (Math.abs(v - t) < 1e-5) break;
			if (t > v) lo = s;
			else hi = s;
			s = (lo + hi) / 2;
			if (hi - lo < 1e-7) break;
		}
		return y(s);
	};
}

export const reducedMotion = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Soften a desktop-wide settings change without replaying every individual card animation. */
export function softUpdate(update: () => void) {
	if (
		typeof document === 'undefined' ||
		!document.startViewTransition ||
		reducedMotion() ||
		matchMedia(COMPACT_LAYOUT_QUERY).matches
	) {
		update();
		return;
	}
	document.startViewTransition(async () => {
		update();
		await tick();
	});
}

// Animate changed readouts and newly introduced sections without disturbing
// inputs, focus, dragging, or the course cards' own transitions.
export function softChanges(node: HTMLElement) {
	const targets = [
		'p',
		'h1',
		'h2',
		'h3',
		'h4',
		'dt',
		'dd',
		'output',
		'[role="status"]',
		'.d-head',
		'.d-meta',
		'.d-desc',
		'.p-num',
		'.total b',
		'.rule-text',
		'.result-count',
		'.reveal-note',
		'.empty-results',
		'.view-strip',
		'.example-note',
		'.office-alert',
		'.office-save-state'
	].join(', ');
	const entryTargets = `${targets}, .office-card, .office-empty`;
	const pending = new Set<HTMLElement>();
	let frame = 0;
	const collect = (element: Element) => {
		const target = element.closest<HTMLElement>(targets);
		if (target && node.contains(target)) pending.add(target);
	};
	const observer = new MutationObserver((records) => {
		if (reducedMotion() || matchMedia(COMPACT_LAYOUT_QUERY).matches) return;
		for (const record of records) {
			if (record.type === 'characterData') {
				if (record.target.parentElement) collect(record.target.parentElement);
				continue;
			}
			if (record.target instanceof Element) collect(record.target);
			for (const added of record.addedNodes) {
				if (!(added instanceof HTMLElement)) continue;
				collect(added);
				if (added.matches(entryTargets)) pending.add(added);
				added.querySelectorAll<HTMLElement>(entryTargets).forEach((el) => pending.add(el));
			}
		}
		if (!pending.size || frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (reducedMotion()) {
				pending.clear();
				return;
			}
			const elements = [...pending];
			for (const element of elements) {
				if (elements.some((parent) => parent !== element && parent.contains(element))) continue;
				if (element.isConnected && element.getClientRects().length)
					element.animate([{ opacity: 0.72 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
			}
			pending.clear();
		});
	});
	observer.observe(node, { childList: true, characterData: true, subtree: true });
	return {
		destroy: () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		}
	};
}
// A hidden phone tab has no useful crossfade position. Fade locally instead.
const quiet = () =>
	now() < quietUntil ||
	reducedMotion() ||
	(typeof matchMedia !== 'undefined' && matchMedia(COMPACT_LAYOUT_QUERY).matches);
/** called by the plan whenever it replaces the whole board at once */
export const quietRedraw = () => (quietUntil = now() + QUIET_MS);

type CourseParams = { key: string };
type Motion = TransitionConfig | (() => TransitionConfig);

/** a course arriving on a surface, flies from wherever it left, or fades in on a redraw */
export const courseIn = (node: Element, params: CourseParams): Motion =>
	quiet() ? fade(node, { duration: reducedMotion() ? 0 : 120, easing: cubicOut }) : receiveCourse(node, params);

/** a course leaving a surface, flies to wherever it lands, or fades out on a redraw */
export const courseOut = (node: Element, params: CourseParams): Motion =>
	quiet() ? fade(node, { duration: reducedMotion() ? 0 : 90, easing: cubicOut }) : sendCourse(node, params);

/** `animate:flip` duration, a redraw reshuffles every slot, so it snaps instead */
export const courseShift = { duration: () => (quiet() ? 0 : 220) };

/** a number rolling over to its next value, the old one slides out one way
 *  while the new one slides in after it, slightly blurred in motion, like a
 *  mechanical counter (or iOS's numeric text). Stack old and new in one grid
 *  cell so they cross. dir 1 = enters from below, -1 = leaves upward. */
export const roll = (_node: Element, { dir = 1 }: { dir?: 1 | -1 } = {}): TransitionConfig => ({
	duration: reducedMotion() ? 0 : 340,
	easing: cubicOut,
	css: (t, u) => `transform: translateY(${u * 70 * dir}%); opacity: ${t}; filter: blur(${u * 1.5}px)`
});

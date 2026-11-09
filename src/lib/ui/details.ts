// Every <details> on the site slides open and shut by default: one listener
// on the document instead of a transition on each. The height is animated by
// hand because Firefox can't transition to `auto` in CSS (no interpolate-size).
import { reducedMotion } from './transitions';

const DURATION = 220;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'; // --ease-out

const running = new WeakMap<HTMLDetailsElement, Animation>();

function slide(details: HTMLDetailsElement) {
	// a click mid-close reopens it, from wherever it has got to
	const closing = details.open && !details.hasAttribute('data-closing');
	const height = () => details.getBoundingClientRect().height;
	const from = height();
	running.get(details)?.cancel();

	details.open = false;
	const shut = height();
	details.open = true;
	const full = height();

	// a menu hanging off its <summary> doesn't change the page's height
	if (full - shut < 1) {
		details.open = !closing;
		details.removeAttribute('data-closing');
		return;
	}

	details.toggleAttribute('data-closing', closing);
	details.style.overflow = 'clip';
	const animation = details.animate(
		{ height: [`${from}px`, `${closing ? shut : full}px`] },
		{ duration: DURATION, easing: EASING }
	);
	running.set(details, animation);
	animation.onfinish = () => {
		running.delete(details);
		details.style.overflow = '';
		details.removeAttribute('data-closing');
		details.open = !closing;
	};
}

/** start animating every <details>; returns the function that stops it */
export function animateDetails() {
	const onclick = (event: MouseEvent) => {
		if (event.defaultPrevented || reducedMotion()) return;
		const target = event.target as Element;
		const summary = target.closest('summary');
		const details = summary?.parentElement;
		if (!(details instanceof HTMLDetailsElement) || details.querySelector(':scope > summary') !== summary) return;
		// a link or button inside the summary does its own thing
		const control = target.closest('a, button, input, select, textarea, label');
		if (control && summary?.contains(control)) return;
		event.preventDefault();
		slide(details);
	};
	document.addEventListener('click', onclick);
	return () => document.removeEventListener('click', onclick);
}

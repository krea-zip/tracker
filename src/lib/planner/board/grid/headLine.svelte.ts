// whether the small line under each board heading shows: the months under
// t1 t2 t3, the academic year under y1 y2. one click on any of them hides or
// shows them all. a per-viewer preference, so it lives in this browser only,
// not in the plan.
import { isPlayground } from '$lib/curriculum/runtime';

const KEY = 'tracker.headLine';

class HeadLine {
	// hidden by default (a faint ··· to bring them back). the server can't see
	// the saved choice, so every page starts hidden and restore() swaps the
	// saved one in once the page has hydrated
	shown = $state(false);
	#restored = false;

	restore() {
		if (this.#restored || isPlayground()) return;
		this.#restored = true;
		try {
			this.shown = localStorage.getItem(KEY) === 'shown';
		} catch {
			// storage blocked → hidden
		}
	}

	toggle() {
		this.shown = !this.shown;
		if (isPlayground()) return;
		try {
			localStorage.setItem(KEY, this.shown ? 'shown' : 'hidden');
		} catch {
			// not remembered, still switched
		}
	}
}

export const headLine = new HeadLine();

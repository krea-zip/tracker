<script lang="ts">
	// every part of the app labelled at once, each with a drawn arrow: one look,
	// nothing to step through, gone at a click. people skip tours and learn by
	// poking around, so this only says what's what, and the ? key brings it back.
	import { onMount, tick } from 'svelte';
	import { usePlan } from '$lib/planner/context';
	import ArrowMark from './ArrowMark.svelte';
	import { GUIDE_NOTES, type GuideNote, type Side } from './notes';

	type Box = { x: number; y: number; w: number; h: number };
	type Spot = { rect: DOMRect; tip: { x: number; y: number }; box: Box; turn: number };

	const plan = usePlan();

	const PAD = 5; // the ring's clearance around a control, px
	const GAP = 6; // between two notes, px
	const EDGE = 10; // notes stay this far inside the window, px
	// the way the arrow runs as drawn, tail to tip
	const DRAWN = Math.atan2(56, -32);

	let notes = $state<GuideNote[]>([]);
	let spots = $state<Spot[]>([]);
	let noteEls = $state<HTMLElement[]>([]);
	let closing = $state<HTMLElement>();
	let gotIt = $state<HTMLButtonElement>();

	const close = () => (plan.guiding = false);
	const targetOf = (note: GuideNote) => document.querySelector(note.target);

	function onScreen(note: GuideNote) {
		const rect = targetOf(note)?.getBoundingClientRect();
		const floor = closing?.getBoundingClientRect().top ?? window.innerHeight;
		return !!rect && rect.width > 0 && rect.bottom > 0 && rect.bottom < floor;
	}

	const touching = (a: Box, b: Box) =>
		a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

	function tipOf(rect: DOMRect, side: Side) {
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		if (side === 'above') return { x, y: rect.top - PAD };
		if (side === 'below') return { x, y: rect.bottom + PAD };
		if (side === 'left') return { x: rect.left - PAD, y };
		return { x: rect.right + PAD, y };
	}

	/** a note's corner, an arrow's length off the tip on its side */
	function cornerOf(tip: Spot['tip'], side: Side, w: number, h: number, reach: number) {
		if (side === 'above') return { x: tip.x - w / 2, y: tip.y - reach - h };
		if (side === 'below') return { x: tip.x - w / 2, y: tip.y + reach };
		if (side === 'left') return { x: tip.x - reach - w, y: tip.y - h / 2 };
		return { x: tip.x + reach, y: tip.y - h / 2 };
	}

	async function layout() {
		notes = GUIDE_NOTES.filter(onScreen);
		await tick();
		const reach = 4.6 * parseFloat(getComputedStyle(document.documentElement).fontSize);
		const asBox = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height });
		const rects = notes.map((note) => targetOf(note)!.getBoundingClientRect());
		const placed: Box[] = closing ? [asBox(closing.getBoundingClientRect())] : [];
		const yearHeads = [...document.querySelectorAll('.overview .year-head')].map((el) =>
			asBox(el.getBoundingClientRect())
		);

		spots = notes.map((note, i) => {
			const rect = rects[i];
			const tip = tipOf(rect, note.side);
			const { offsetWidth: w, offsetHeight: h } = noteEls[i];
			const corner = cornerOf(tip, note.side, w, h, reach);
			let box = {
				x: Math.max(EDGE, Math.min(corner.x, window.innerWidth - w - EDGE)),
				y: Math.max(EDGE, Math.min(corner.y, window.innerHeight - h - EDGE)),
				w,
				h
			};
			// Search nearby positions inside the viewport, avoiding other labels,
			// their targets, and the year headings. Hide a note if there is no room.
			const clear = [...placed, ...rects.map(asBox), ...yearHeads];
			const xs = [box.x, EDGE, window.innerWidth - w - EDGE, ...clear.flatMap((b) => [b.x - w - GAP, b.x + b.w + GAP])];
			const ys = [
				box.y,
				EDGE,
				window.innerHeight - h - EDGE,
				...clear.flatMap((b) => [b.y - h - GAP, b.y + b.h + GAP])
			];
			const candidates = xs
				.flatMap((x) => ys.map((y) => ({ x, y, w, h })))
				.filter(
					(b) =>
						b.x >= EDGE &&
						b.y >= EDGE &&
						b.x + w <= window.innerWidth - EDGE &&
						b.y + h <= window.innerHeight - EDGE &&
						!clear.some((c) => touching(b, c))
				)
				.sort((a, b) => Math.hypot(a.x - corner.x, a.y - corner.y) - Math.hypot(b.x - corner.x, b.y - corner.y));
			box = candidates[0] ?? { x: -9999, y: -9999, w, h };
			placed.push(box);
			const angle = Math.atan2(tip.y - (box.y + h / 2), tip.x - (box.x + w / 2));
			return { rect, tip, box, turn: angle - DRAWN };
		});
	}

	onMount(() => {
		plan.selected = null;
		plan.zoom = null;
		plan.view = 'plan';
		void tick()
			.then(layout)
			.then(() => gotIt?.focus());
		// again once the colour key has finished popping open
		const settled = setTimeout(layout, 300);
		return () => clearTimeout(settled);
	});
</script>

<svelte:window
	onresize={layout}
	onkeydown={(e) => {
		if (e.key === 'Escape') close();
	}}
/>

<!-- a click anywhere puts it away; the notes let clicks fall through to here -->
<div class="veil" role="presentation" onclick={close}></div>

{#each spots as spot, i (i)}
	{#if spot.box.x >= 0}
		<div
			class="ring"
			style:left="{spot.rect.left - PAD}px"
			style:top="{spot.rect.top - PAD}px"
			style:width="{spot.rect.width + PAD * 2}px"
			style:height="{spot.rect.height + PAD * 2}px"
		></div>
		<div
			class="arrow"
			style:transform="translate({spot.tip.x}px, {spot.tip.y}px) translate(-30%, -91%) rotate({spot.turn}rad)"
		>
			<ArrowMark size="4.2rem" />
		</div>
	{/if}
{/each}

{#each notes as note, i (note.target)}
	{@const box = spots[i]?.box}
	<p
		class="note"
		bind:this={noteEls[i]}
		style:visibility={box ? 'visible' : 'hidden'}
		style:transform="translate({box?.x ?? 0}px, {box?.y ?? 0}px)"
	>
		{note.text}
	</p>
{/each}

<div class="closing" bind:this={closing}>
	<p>
		tracker lays out your degree and checks the rules as you go. it doesn't register you: that's still the drop form on
		the ERP, and it's a guide, not the university's word. press <b>?</b> to see these labels again.
	</p>
	<button bind:this={gotIt} onclick={close}>got it</button>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.veil {
		position: fixed;
		inset: 0;
		z-index: 55;
		background: color-mix(in srgb, var(--color-backdrop) 70%, transparent);
	}

	.ring,
	.arrow,
	.note {
		position: fixed;
		z-index: 56;
		pointer-events: none;
	}

	.ring {
		border: 1.5px solid var(--color-accent);
		border-radius: 6px;
	}

	.arrow {
		top: 0;
		left: 0;
		transform-origin: 30% 91%;
	}

	.note {
		top: 0;
		left: 0;
		width: max-content;
		max-width: 19rem;
		padding: 0.6rem 0.9rem;
		font-size: 1.25rem;
		line-height: 1.35;
		color: var(--color-text);
		background: var(--color-bg-card-start);
		border: 1px solid var(--color-border-card);
		border-radius: 6px;
		box-shadow: 0 3px 10px rgba(20, 30, 50, 0.2);
	}

	.closing {
		position: fixed;
		left: 50%;
		bottom: 1.6rem;
		z-index: 56;
		display: flex;
		align-items: center;
		gap: 1.4rem;
		width: min(66rem, calc(100vw - 3.2rem));
		padding: 1rem 1.4rem;
		background: var(--color-bg-card-start);
		border: 1px solid var(--color-border-card);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(20, 30, 50, 0.28);
		transform: translateX(-50%);

		p {
			font-size: 1.25rem;
			line-height: 1.4;
			color: var(--color-text-muted);
		}

		button {
			flex: none;
			padding: 0.6rem 1.8rem;
			font: inherit;
			font-size: 1.35rem;
			font-weight: 700;
			color: var(--color-on-accent);
			background-color: var(--color-accent);
			border: 1px solid var(--color-control-deep);
			border-radius: 6px;
			cursor: pointer;
			@include glossy-accent;

			&:hover {
				filter: brightness(1.07);
			}
		}
	}
</style>

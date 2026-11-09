<script lang="ts">
	// points at the task at hand in the miniature: a soft ring round what to
	// use, or for a drag, the course flying along the way it should go. only
	// ever drawn over something that can be seen, and gone mid-drag, when the
	// grid's own mint cells take over the explaining.
	import { usePlan } from '$lib/planner/context';
	import type { Task } from './lessons';

	let { task }: { task: Task | null } = $props();
	const plan = usePlan();

	type Box = { x: number; y: number; w: number; h: number; round: number };

	let layer = $state<HTMLElement>();
	let ring = $state<Box | null>(null);
	let from = $state<Box | null>(null);
	let to = $state<Box | null>(null);

	/** where something is, in this layer's terms, if it's on screen and not under a panel or scrolled away */
	function seen(selectors: string | string[] | undefined): Box | null {
		for (const selector of typeof selectors === 'string' ? [selectors] : (selectors ?? [])) {
			const el = document.querySelector<HTMLElement>(selector);
			if (!el || !layer) continue;
			const r = el.getBoundingClientRect();
			if (!r.width || !r.height) continue;
			const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
			if (!stack.some((hit) => el.contains(hit) || hit.contains(el))) continue;
			const base = layer.getBoundingClientRect();
			return {
				x: r.left - base.left,
				y: r.top - base.top,
				w: r.width,
				h: r.height,
				round: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
			};
		}
		return null;
	}

	const same = (a: Box | null, b: Box | null) =>
		a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);

	// things move under it (a list scrolling, a panel sliding in), so it keeps
	// looking for as long as it has something to point at
	$effect(() => {
		const now = plan.dragging ? null : task;
		let frame = requestAnimationFrame(function look() {
			const nextRing = seen(now?.point);
			const nextFrom = seen(now?.drag?.from);
			const nextTo = seen(now?.drag?.to);
			if (!same(ring, nextRing)) ring = nextRing;
			if (!same(from, nextFrom)) from = nextFrom;
			if (!same(to, nextTo)) to = nextTo;
			if (now) frame = requestAnimationFrame(look);
		});
		return () => cancelAnimationFrame(frame);
	});

	const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

	// a shallow arc, which reads as a throw rather than a rule across the grid
	let route = $derived.by(() => {
		if (!from || !to) return null;
		const a = centre(from);
		const b = centre(to);
		const lift = Math.hypot(b.x - a.x, b.y - a.y) * 0.16;
		return `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - lift} ${b.x} ${b.y}`;
	});
</script>

{#snippet outline(box: Box, kind: string)}
	<div
		class="ring {kind}"
		style:left="{box.x - 4}px"
		style:top="{box.y - 4}px"
		style:width="{box.w + 8}px"
		style:height="{box.h + 8}px"
		style:border-radius="{box.round + 4}px"
	></div>
{/snippet}

<div class="coach" aria-hidden="true" bind:this={layer}>
	{#if ring}{@render outline(ring, 'at')}{/if}
	{#if route && from && to}
		{@render outline(from, 'at')}
		{@render outline(to, 'landing')}
		<svg class="route"><path d={route} /></svg>
		<div class="ghost" style:offset-path={`path("${route}")`}>{task?.drag?.label}</div>
	{/if}
</div>

<style lang="scss">
	// laid over the whole stage; every box is measured against this layer
	.coach {
		position: absolute;
		inset: 0;
		z-index: 25;
		overflow: hidden;
		pointer-events: none;
	}

	.ring {
		position: absolute;

		&.at {
			border: 2px solid var(--color-accent);
			animation: breathe 1.8s ease-in-out infinite;
		}

		// where the course is headed: the same mint the grid uses for a good fit
		&.landing {
			border: 2px dashed var(--color-drop-ok-edge);
			background: color-mix(in srgb, var(--color-drop-ok) 22%, transparent);
		}
	}

	@keyframes breathe {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 32%, transparent);
		}
		50% {
			box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 12%, transparent);
		}
	}

	.route {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;

		path {
			fill: none;
			stroke: var(--color-accent);
			stroke-width: 1.5;
			stroke-dasharray: 2 6;
			stroke-linecap: round;
			opacity: 0.6;
		}
	}

	.ghost {
		position: absolute;
		top: 0;
		left: 0;
		padding: 0.5rem 0.9rem;
		font-size: 1.2rem;
		font-weight: 650;
		color: var(--color-on-accent);
		background: var(--color-accent);
		border-radius: 5px;
		box-shadow: 0 4px 12px rgba(20, 30, 50, 0.22);
		offset-rotate: 0deg;
		animation: fly 2.8s var(--ease-out) infinite;
	}

	@keyframes fly {
		0% {
			offset-distance: 0%;
			opacity: 0;
		}
		12% {
			offset-distance: 0%;
			opacity: 0.92;
		}
		68% {
			offset-distance: 100%;
			opacity: 0.92;
		}
		88%,
		100% {
			offset-distance: 100%;
			opacity: 0;
		}
	}

	// stands still at the end of its route for anyone who'd rather no motion
	@media (prefers-reduced-motion: reduce) {
		.ring.at {
			animation: none;
		}

		.ghost {
			offset-distance: 100%;
			animation: none;
			opacity: 0.92;
		}
	}
</style>

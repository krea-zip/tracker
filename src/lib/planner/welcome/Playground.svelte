<script lang="ts">
	// The planner in miniature, inside the welcome's frame: the real grid and
	// the real panels on a two-year pretend degree. Each step shows the grid
	// and the one part it teaches, where that part sits in the planner; the
	// last shows all of them at once. The frame is always wider than a phone,
	// so everything here lays out exactly as it does in the planner. One plan
	// runs through every step; this side watches it and tells the welcome which
	// quests are done.
	import { onMount, tick, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { SvelteSet } from 'svelte/reactivity';
	import { Plan } from '$lib/planner/plan.svelte';
	import { providePlan } from '$lib/planner/context';
	import { nowHues } from '$lib/planner/hues';
	import { subjectById } from '$lib/curriculum/data';
	import { plannerKeys } from '$lib/planner/shortcuts';
	import OverviewGrid from '$lib/planner/board/OverviewGrid.svelte';
	import TrimesterZoom from '$lib/planner/board/TrimesterZoom.svelte';
	import Catalogue from '$lib/planner/catalogue/Catalogue.svelte';
	import DegreeProgress from '$lib/planner/sidebar/DegreeProgress.svelte';
	import Hints from '$lib/planner/sidebar/Hints.svelte';
	import DetailsPanel from '$lib/planner/details/DetailsPanel.svelte';
	import Flash from '$lib/planner/shell/Flash.svelte';
	import { touchDrag } from '$lib/planner/drag/touchDrag';
	import { dragMotion } from '$lib/planner/drag/dragMotion';
	import { reducedMotion } from '$lib/ui/transitions';
	import Coach from './Coach.svelte';
	import { playgroundPlacements } from './fixture';
	import { LESSONS, lessonById, slotsOf, type Baseline, type Lesson, type Task } from './lessons';

	const plan = providePlan(new Plan({ miniature: true }));
	const keys = plannerKeys(plan);

	let lesson = $state<Lesson>('grid');
	let active = $state(false); // the welcome is on a playground step
	let pointedAt = $state<string | null>(null); // a quest the student's pointing at beside the frame
	const done = new SvelteSet<string>();
	let baselines = $state.raw<Partial<Record<Lesson, Baseline>>>({});

	let info = $derived(lessonById(lesson)!);
	let now = $derived(nowHues(plan.programmes, (s) => plan.hueFor(s) ?? subjectById(s).hue));

	// the sidebar's parts, the catalogue and the course card, each where the
	// planner keeps it: the sidebar far left, the catalogue next, the card on
	// the right. the steps that work in the card keep the whole grid beside
	// it; elsewhere the card slides over the grid, as it does in the planner
	let rail = $derived<readonly string[]>(info.layout.rail ?? []);
	let showCatalogue = $derived(!!info.layout.catalogue);
	let whole = $derived(rail.length > 1 && showCatalogue);
	// a laptop-sized frame has no room for the card beside the grid as well as
	// the sidebar: there it slides over the grid, as it does in the planner
	let stageWidth = $state(0);
	let docked = $derived(!!info.layout.dock && stageWidth >= 1100);

	// the first quest still to do, or whichever one is being pointed at
	let task = $derived.by(() => {
		if (!active) return null;
		if (pointedAt) return info.tasks.find((t) => t.id === pointedAt) ?? null;
		return info.tasks.find((t) => !done.has(t.id)) ?? null;
	});

	const arrive = () => ({ duration: reducedMotion() ? 0 : 180 });

	function setUp() {
		plan.structure = 'major-minor';
		plan.fourYear = true;
		plan.picks = { major1: 'film', major2: 'span', minor: 'anth', conc: 'span' };
		plan.placements = playgroundPlacements();
		plan.now = { year: 2, trim: 1 };
		plan.yearCount = 2;
		plan.touched = true;
		plan.welcoming = true;
		plan.showCodes = true;
		plan.showTitles = false;
		plan.trimNaming = 'year';
		plan.view = 'plan';
		plan.search = '';
		plan.clearNarrowing();
		plan.zoom = null;
		plan.highlight = [];
		plan.highlightSlots = [];
		plan.waived = [];
		plan.audited = [];
		plan.grades = {};
		plan.selected = null;
	}
	untrack(setUp);

	/** arrive on a step: nothing of the last one left open */
	function open(next: Lesson) {
		lesson = next;
		plan.selected = null;
		plan.highlight = [];
		plan.highlightSlots = [];
		plan.zoom = null;
		plan.view = 'plan';
		plan.search = '';
		plan.clearNarrowing();
		if (!baselines[next]) {
			lessonById(next)?.enter?.(plan);
			baselines = { ...baselines, [next]: { at: slotsOf(plan) } };
		}
	}

	async function startOver() {
		setUp();
		done.clear();
		baselines = {};
		open(lesson);
		await tick();
		plan.startHistory();
	}

	// a quest done ticks any before it still open: whoever fixed the problem
	// first and read about it after can't be left stuck on "read it" with
	// nothing left to read. a result the plan can stop meeting ticks only itself
	function complete(task: Task) {
		done.add(task.id);
		if (task.live) return;
		for (const t of info.tasks) {
			if (t === task) break;
			if (!t.live) done.add(t.id);
		}
	}

	// a result can stop being true; an action, once tried, stays tried
	$effect(() => {
		const from = baselines[lesson];
		if (!from) return;
		for (const t of info.tasks) {
			if (!t.done) continue;
			if (t.done(plan, from)) complete(t);
			else if (t.live) done.delete(t.id);
		}
	});

	function noteClick(e: MouseEvent) {
		const target = e.target as Element | null;
		for (const t of info.tasks) {
			if (t.clicked && target?.closest(t.clicked)) complete(t);
		}
	}

	// the last step finished: a wave of mint across the grid, the colour a
	// course turns a cell when it fits
	let finished = $derived(lesson === 'graduate' && info.tasks.every((t) => done.has(t.id)));
	let cheered = false;
	$effect(() => {
		if (!finished) {
			cheered = false;
			return;
		}
		if (cheered || !active) return;
		cheered = true;
		untrack(cheer);
	});

	function cheer() {
		if (reducedMotion()) return;
		const root = getComputedStyle(document.documentElement);
		const mint = root.getPropertyValue('--color-drop-ok').trim();
		const edge = root.getPropertyValue('--color-drop-ok-edge').trim();
		const cells = document.querySelectorAll<HTMLElement>('.overview .cell');
		cells.forEach((cell, i) => {
			const rest = getComputedStyle(cell).backgroundColor;
			cell.animate(
				[
					{ backgroundColor: rest, boxShadow: `inset 0 0 0 0 ${edge}` },
					{ backgroundColor: mint, boxShadow: `inset 0 0 0 2px ${edge}`, offset: 0.35 },
					{ backgroundColor: rest, boxShadow: `inset 0 0 0 0 ${edge}` }
				],
				{ duration: 1100, delay: 200 + (i % 3) * 110 + Math.floor(i / 3) * 160, easing: 'ease-out' }
			);
		});
	}

	// the course card lets go of its course at a click anywhere else, unless
	// that click picked another course: the same as the planner's own layout
	let detailsEl = $state<HTMLElement>();
	let pressedOutside = false;
	let pickedAtPress: typeof plan.selected = null;
	function notePress(e: PointerEvent) {
		pressedOutside = !!plan.selected && !detailsEl?.contains(e.target as Node);
		pickedAtPress = plan.selected;
	}
	function closeIfNothingPicked(e: MouseEvent) {
		const courseClick = (e.target as Element | null)?.closest('.placed-open, button.card, .chip .open');
		if (pressedOutside && !docked && plan.selected === pickedAtPress && !courseClick) plan.selected = null;
		pressedOutside = false;
	}
	function onkeydown(e: KeyboardEvent) {
		keys(e);
		if (e.key === 'Escape' && !e.defaultPrevented && plan.selected) plan.selected = null;
	}

	function receive(event: MessageEvent) {
		if (event.source !== parent || event.origin !== location.origin) return;
		if (event.data?.type !== 'tracker-playground-lesson') return;
		const { lesson: next, theme, rem, active: on, point, history, reset } = event.data;
		if (reset) return void startOver();
		if (history === 'undo') plan.undo();
		if (history === 'redo') plan.redo();
		if (history) return;
		document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
		// the frame's own width mustn't decide the text size: it matches the page around it
		if (rem) document.documentElement.style.fontSize = rem;
		active = !!on;
		pointedAt = typeof point === 'string' ? point : null;
		if (LESSONS.some((l) => l.id === next) && (next !== lesson || !baselines[next as Lesson])) open(next);
	}

	$effect(() => {
		parent.postMessage({ type: 'tracker-playground-progress', done: [...done] }, location.origin);
	});

	onMount(() => {
		plan.startHistory();
		parent.postMessage({ type: 'tracker-playground-ready' }, location.origin);
	});
</script>

<svelte:window
	onmessage={receive}
	{onkeydown}
	onclickcapture={noteClick}
	onpointerdowncapture={notePress}
	onclick={closeIfNothingPicked}
/>

<div class="playground" class:whole use:touchDrag use:dragMotion style:--now-a={now?.[0]} style:--now-b={now?.[1]}>
	<div class="stage" class:details-open={!!plan.selected} class:docked bind:clientWidth={stageWidth}>
		{#if rail.length}
			{#key rail.join()}
				<aside class="panel rail" aria-label="your degree" in:fade={arrive()}>
					{#if rail.includes('progress')}<DegreeProgress />{/if}
					{#if rail.includes('hints')}<Hints />{/if}
				</aside>
			{/key}
		{/if}
		{#if showCatalogue}
			<div class="panel catalogue-panel" in:fade={arrive()}><Catalogue /></div>
		{/if}

		<main class="board">
			<div class="board-main">
				{#if plan.zoom}
					<TrimesterZoom />
				{:else}
					<OverviewGrid />
				{/if}
			</div>
		</main>

		<aside class="details" aria-label="course details" bind:this={detailsEl} inert={!plan.selected}>
			<DetailsPanel />
		</aside>

		<Coach {task} />
	</div>

	<!-- the planner's own one-liner: undone, a refused drop, a rule just applied -->
	<Flash />
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	:global(html),
	:global(body) {
		height: 100%;
		overflow: hidden;
		background: var(--color-bg);
	}

	.playground {
		// the "now" ring's colours, worked out where the hues are set, as in the planner
		--color-now: oklch(var(--now-l) var(--now-c) var(--now-a, var(--accent-hue)));
		--color-now-end: oklch(var(--now-l) var(--now-c) var(--now-b, var(--now-a, var(--accent-hue))));
		// the frame's own width (vw in here) shares itself out, so the grid
		// keeps room for its courses' codes on a laptop as on a wide screen
		--details-w: clamp(28rem, 30vw, 34rem);
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--color-bg);
	}

	.stage {
		position: relative;
		flex: 1;
		display: flex;
		min-height: 0;
		// not hidden: the course card waits just off the edge, and a hidden
		// overflow could still be scrolled sideways to bring it into view
		overflow: clip;
	}

	.panel {
		flex: none;
		width: clamp(22rem, 24vw, 30rem);
		min-height: 0;
		border-right: 1px solid var(--color-border-warm);
	}

	.rail {
		--rail-radius: 4px;
		--panel-gutter: var(--card-gap);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		background: var(--color-bg);

		> :global(*) {
			contain: inline-size;
		}
	}

	.catalogue-panel {
		overflow: hidden;
	}

	// the whole layout: two panels and the grid, as in the planner
	.whole .panel {
		width: clamp(22rem, 21vw, 28rem);
	}

	// past this width the trimesters only get emptier, so the bar and the grid
	// stop growing and centre, as they do in the planner
	.board {
		--board-max: 92rem;
		--board-gutter: max(2.4rem, (100cqi - var(--board-max)) / 2);
		container: plan / inline-size;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow-y: auto;
		background: var(--color-bg-board-page);
		transition: margin-right 0.3s var(--ease-out);
	}

	.board-main {
		flex: 1 0 auto;
		display: flex;
		flex-direction: column;
	}

	// the grid at the planner's own size, centred in the height there is
	.board-main > :global(.overview) {
		margin-block: auto;
		padding-bottom: 2.4rem;
	}

	.details {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		width: var(--details-w);
		overflow-y: auto;
		background: linear-gradient(to bottom, var(--color-bg-sidebar), var(--color-bg-sidebar-end));
		border-left: 1px solid var(--color-border-warm);
		box-shadow: -10px 0 30px rgba(20, 30, 50, 0.18);
		visibility: hidden;
		transform: translateX(100%);
		transition:
			transform 0.3s var(--ease-out),
			visibility 0s 0.3s;
	}

	.details-open {
		.details {
			visibility: visible;
			transform: none;
			transition: transform 0.34s var(--ease-out);
		}

		&.docked .details {
			box-shadow: none;
		}

		&.docked .board {
			margin-right: var(--details-w);
		}
	}
</style>

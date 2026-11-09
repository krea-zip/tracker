<script lang="ts">
	// The planner in miniature, inside the welcome's frame: the real grid and
	// the real panels on a two-year pretend degree, one panel per slide and all
	// of them on the last. The frame is always wider than a phone, so everything
	// here lays out exactly as it does in the planner. One plan runs through
	// every slide; this side watches it and tells the welcome which tasks are done.
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
	import ColourKey from '$lib/planner/board/bar/ColourKey.svelte';
	import Catalogue from '$lib/planner/catalogue/Catalogue.svelte';
	import DegreeProgress from '$lib/planner/sidebar/DegreeProgress.svelte';
	import ChoicePools from '$lib/planner/sidebar/ChoicePools.svelte';
	import Hints from '$lib/planner/sidebar/Hints.svelte';
	import DetailsPanel from '$lib/planner/details/DetailsPanel.svelte';
	import { touchDrag } from '$lib/planner/drag/touchDrag';
	import { dragMotion } from '$lib/planner/drag/dragMotion';
	import { reducedMotion } from '$lib/ui/transitions';
	import Coach from './Coach.svelte';
	import ReadingKey from './ReadingKey.svelte';
	import { playgroundPlacements } from './fixture';
	import { LESSONS, lessonById, slotsOf, type Baseline, type Lesson } from './lessons';

	const plan = providePlan(new Plan({ miniature: true }));
	const keys = plannerKeys(plan);

	let lesson = $state<Lesson>('terms');
	let active = $state(false); // the welcome is on a playground slide
	let pointedAt = $state<string | null>(null); // a task the student's pointing at beside the frame
	const done = new SvelteSet<string>();
	let baselines = $state.raw<Partial<Record<Lesson, Baseline>>>({});

	let info = $derived(lessonById(lesson)!);
	let now = $derived(nowHues(plan.programmes, (s) => plan.hueFor(s) ?? subjectById(s).hue));

	let showRail = $derived(lesson === 'progress' || lesson === 'hints' || lesson === 'together');
	let showCatalogue = $derived(lesson === 'catalogue' || lesson === 'together');
	// the details slide keeps the whole grid beside its card; elsewhere the card
	// slides over the grid, as it does in the planner
	let docked = $derived(lesson === 'details');

	// the first task still to do, or whichever one is being pointed at
	let task = $derived.by(() => {
		if (!active) return null;
		if (pointedAt) return info.tasks.find((t) => t.id === pointedAt) ?? null;
		return info.tasks.find((t) => !done.has(t.id)) ?? null;
	});

	const arrive = () => ({ duration: reducedMotion() ? 0 : 160 });

	let say = $derived(
		plan.flash ??
			(plan.dragging
				? 'mint cells: it runs then and its prerequisites come first. a faded cell still takes it, and the hints flag it.'
				: 'the same controls as your planner · pretend courses · nothing here is saved')
	);

	function setUp() {
		plan.structure = 'major-minor';
		plan.fourYear = true;
		plan.picks = { major1: 'dreams', major2: 'clouds', minor: 'cats', conc: 'clouds' };
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

	/** arrive on a slide: nothing of the last one left open */
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
		if (next === 'details') plan.select('NAP201');
		if (next === 'hints') {
			void tick().then(() =>
				document
					.querySelector('[data-tour="hints"]')
					?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
			);
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

	// a result can stop being true; an action, once tried, stays tried
	$effect(() => {
		const from = baselines[lesson];
		if (!from) return;
		for (const t of info.tasks) {
			if (!t.done) continue;
			const met = t.done(plan, from);
			if (met) done.add(t.id);
			else if (t.live) done.delete(t.id);
		}
	});

	function noteClick(e: MouseEvent) {
		const target = e.target as Element | null;
		for (const t of info.tasks) {
			if (t.clicked && target?.closest(t.clicked)) done.add(t.id);
		}
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
		const { lesson: next, theme, rem, active: on, point, history } = event.data;
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

<div
	class="playground"
	data-lesson={lesson}
	use:touchDrag
	use:dragMotion
	style:--now-a={now?.[0]}
	style:--now-b={now?.[1]}
>
	<div class="stage" class:details-open={!!plan.selected} class:docked>
		{#if lesson === 'terms'}
			<aside class="panel rail" aria-label="how to read the grid" in:fade={arrive()}><ReadingKey /></aside>
		{:else if lesson === 'display'}
			<aside class="panel rail" aria-label="display options" in:fade={arrive()}>
				<div class="display">
					<h3>display</h3>
					<ColourKey inline />
				</div>
			</aside>
		{/if}
		{#if showRail}
			<aside class="panel rail" aria-label="your degree" in:fade={arrive()}>
				<DegreeProgress />
				<ChoicePools />
				<Hints />
			</aside>
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

	<footer class="status">
		<span role="status">{say}</span>
		<button onclick={startOver}>start over ↺</button>
	</footer>
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
		--details-w: 34rem;
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
		width: 32rem;
		min-height: 0;
		border-right: 1px solid var(--color-border-warm);
	}

	.rail {
		--rail-radius: 4px;
		overflow-y: auto;
		background: var(--color-bg);

		> :global(*) {
			contain: inline-size;
		}
	}

	.catalogue-panel {
		overflow: hidden;
	}

	// the whole layout on the last slide: two panels and the grid, as in the planner
	[data-lesson='together'] .panel {
		width: 28rem;
	}

	// the display menu, opened out as one more rail section
	.display {
		@include rail-section;
		border-bottom: 0;

		> :global(.colour-key) {
			padding: 0.4rem 1rem 1.2rem;
		}
	}

	.board {
		--board-gutter: 2rem;
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

	// the two rows share the height there is, up to a point: past it they only
	// get emptier, so a tall window centres the grid instead
	.board-main > :global(.overview) {
		flex: 1 1 auto;
		max-height: 66rem;
		margin-block: auto;
		grid-template-rows: auto repeat(2, minmax(13rem, 1fr));
		padding-top: 1.6rem;
		padding-bottom: 1.6rem;
	}

	// that slide has the menu opened out in the panel beside the grid
	[data-lesson='display'] .board :global(.colour-key),
	[data-lesson='display'] .board :global(.board-bar > span:nth-of-type(2)),
	[data-lesson='display'] .board :global(.board-bar > span:nth-of-type(3)),
	[data-lesson='display'] .board :global(.board-bar [aria-label='course labels']) {
		display: none;
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

	.status {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.6rem;
		min-height: 3.6rem;
		padding: 0.4rem 1.6rem;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		background: var(--color-bg-light);
		border-top: 1px solid var(--color-border-divider);

		span {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		button {
			flex: none;
			padding: 0.3rem 0.6rem;
			font: inherit;
			color: var(--color-text);
			background: none;
			border: 0;
			border-radius: 4px;
			cursor: pointer;
			text-decoration: underline;
			text-underline-offset: 0.2em;

			&:hover {
				color: var(--color-accent);
			}
		}
	}
</style>

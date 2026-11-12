<script lang="ts">
	// The planner's shell: one plan, shared through context, and one CSS grid
	// of sidebar | catalogue | board.
	// The grid stays readable on wide screens; the side columns can be resized.
	//
	// The course details slide in over the board when a course is picked. An
	// iPad held upright slides the sidebar in too; phones show one panel at a
	// time behind tabs.
	import type { Snippet } from 'svelte';
	import { useSiteActions } from '$lib/site/navigation';
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Plan } from '$lib/planner/plan.svelte';
	import { providePlan } from '$lib/planner/context';
	import { viewport } from '$lib/planner/viewport.svelte';
	import { plannerKeys } from '$lib/planner/shortcuts';
	import { takeIncoming, type Incoming } from '$lib/planner/incoming';
	import { focusScope } from '$lib/ui/focusScope';
	import { softChanges, softUpdate } from '$lib/ui/transitions';
	import { dragMotion } from '$lib/planner/drag/dragMotion';
	import { touchDrag } from '$lib/planner/drag/touchDrag';
	import { hasCode, PREVIEWING, subjectById } from '$lib/curriculum/data';
	import { nowHues } from '$lib/planner/hues';
	import { loadDescriptions } from '$lib/curriculum/descriptions.svelte';
	import PanelResizers, { type Panel, type PanelWidths } from '$lib/planner/shell/PanelResizers.svelte';
	import MobileNavigation from '$lib/planner/shell/MobileNavigation.svelte';
	import Onboarding from '$lib/planner/shell/Onboarding.svelte';
	import Flash from '$lib/planner/shell/Flash.svelte';
	import PixelIcon from '$lib/ui/PixelIcon.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import FeedbackForm from '$lib/planner/shell/FeedbackForm.svelte';
	import Settings from '$lib/planner/shell/Settings.svelte';
	import { account } from '$lib/plans/account.svelte';
	import SharedPlanPrompt from '$lib/plans/SharedPlanPrompt.svelte';
	import Sidebar from '$lib/planner/sidebar/Sidebar.svelte';
	import DegreeProgress from '$lib/planner/sidebar/DegreeProgress.svelte';
	import ChoicePools from '$lib/planner/sidebar/ChoicePools.svelte';
	import Hints from '$lib/planner/sidebar/Hints.svelte';
	import Catalogue from '$lib/planner/catalogue/Catalogue.svelte';
	import DetailsPanel from '$lib/planner/details/DetailsPanel.svelte';

	let { children }: { children: Snippet } = $props();

	const plan = providePlan(new Plan());
	const siteActions = useSiteActions();
	onMount(() => {
		siteActions.settings = () => (showSettings = true);
		siteActions.help = () => {
			if (viewport.desktop) plan.guiding = true;
			else location.href = '/?welcome';
		};
		return () => {
			siteActions.settings = undefined;
			siteActions.help = undefined;
		};
	});
	const onKeys = plannerKeys(plan);

	let ready = $state(false);
	let showSettings = $state(false);
	let incoming = $state<Incoming | null>(null);
	let mobileView = $state<'catalogue' | 'board' | 'rail'>('catalogue');
	let widths = $state<PanelWidths>({});
	let resizing = $state<Panel | null>(null);
	let detailsEl = $state<HTMLElement>();
	let detailsPinned = $state(false);
	let detailsDocked = $derived(viewport.desktop && detailsPinned);

	function toggleDetailsPin() {
		softUpdate(() => {
			detailsPinned = !detailsPinned;
			try {
				localStorage.setItem('tracker-details-pinned', String(detailsPinned));
			} catch {
				// the preference still works for this visit
			}
		});
	}
	// the "now" ring's colours, a subject on the plan in its colour there
	let now = $derived(nowHues(plan.programmes, (s) => plan.hueFor(s) ?? subjectById(s).hue));

	// a phone only plans: grades, what-if and the other views are laptop-only
	$effect(() => {
		if (!viewport.desktop && plan.view !== 'plan') plan.view = 'plan';
	});

	// a panel slid in over the others holds the focus until it's closed
	let overlayDetails = $derived(!!plan.selected && !detailsDocked);
	let overlayRail = $derived(viewport.railSlide && plan.railOpen);

	// opening a course's details puts the sidebar away, and starts them at the top
	$effect(() => {
		if (!plan.selected) return;
		plan.railOpen = false;
		detailsEl?.scrollTo({ top: 0 });
	});
	// the sidebar only slides in where it's folded to its strip
	$effect(() => {
		if (!viewport.railSlide) plan.railOpen = false;
	});

	onMount(() => {
		try {
			detailsPinned = localStorage.getItem('tracker-details-pinned') === 'true';
		} catch {
			// storage is optional
		}
		incoming = takeIncoming();
		showSettings = !!incoming.account && !incoming.shareId && !incoming.sharedPlan;
		if (incoming.account === 'error')
			account.error = 'Google sign-in was cancelled or could not finish. Your draft is unchanged. Please try again.';
		if (incoming.course && hasCode(incoming.course)) plan.revealCourse(incoming.course);
		ready = true;
		void tick().then(() => plan.startHistory());

		// the catalogue prose is its own chunk so it can't hold up first paint,
		// pull it in once the planner is up and the browser has a spare moment
		if ('requestIdleCallback' in window) {
			const id = requestIdleCallback(() => loadDescriptions());
			return () => cancelIdleCallback(id);
		}
		const id = setTimeout(loadDescriptions, 400);
		return () => clearTimeout(id);
	});

	function closeOverlays() {
		plan.selected = null;
		plan.railOpen = false;
	}

	// on a laptop the course panel (slid in, or pinned) lets go of its course at a click anywhere else,
	// unless that click picked another course: then it just switches to it.
	// a drag never clicks, so dragging a course leaves the panel be
	let pressedOutside = false;
	let pickedAtPress: typeof plan.selected = null;
	function notePress(e: PointerEvent) {
		pressedOutside = viewport.desktop && !!plan.selected && !detailsEl?.contains(e.target as Node);
		pickedAtPress = plan.selected;
	}
	function closeIfNothingPicked(e: MouseEvent) {
		const courseClick = (e.target as Element | null)?.closest('.placed-open, button.card, .chip .open');
		if (pressedOutside && plan.selected === pickedAtPress && !courseClick) plan.selected = null;
		pressedOutside = false;
	}
	// and Esc slides it away, unless a menu or dialog took the key first
	function onWindowKeys(e: KeyboardEvent) {
		onKeys(e);
		if (e.key === 'Escape' && !e.defaultPrevented && plan.selected) plan.selected = null;
	}

	// what each column may be interacted with: everything on a laptop (the
	// course panel doesn't cover the board, a click beside it swaps or closes
	// it), only beside the slid-in sidebar, and on a phone the tab in view
	const covered = (tab: typeof mobileView) =>
		viewport.desktop ? tab !== 'rail' && overlayRail : mobileView !== tab || overlayDetails;
</script>

<svelte:head>
	<title>tracker</title>
</svelte:head>

<svelte:window onkeydown={onWindowKeys} onpointerdowncapture={notePress} onclick={closeIfNothingPicked} />

{#if ready}
	<SharedPlanPrompt encoded={incoming?.sharedPlan ?? null} shareId={incoming?.shareId ?? null} />
	{#if showSettings}<Settings onclose={() => (showSettings = false)} />{/if}
	<!-- a shared plan or a linked course opens straight over the planner instead -->
	<Onboarding
		skip={!!(incoming?.course || incoming?.sharedPlan || incoming?.shareId || incoming?.account)}
		replay={incoming?.welcome}
	/>
{/if}

<div
	class="app"
	data-ready={ready}
	data-layout={viewport.desktop ? 'desktop' : 'phone'}
	data-mobile-view={mobileView}
	inert={!ready}
	class:resizing
	class:details-open={!!plan.selected}
	class:details-docked={detailsDocked}
	class:rail-open={plan.railOpen}
	use:dragMotion
	use:touchDrag
	use:softChanges
	style:--rail-user-w={widths.rail && `${widths.rail}rem`}
	style:--catalogue-user-w={widths.catalogue && `${widths.catalogue}rem`}
	style:--now-a={now?.[0]}
	style:--now-b={now?.[1]}
>
	<MobileNavigation bind:view={mobileView} />
	<PanelResizers bind:widths bind:resizing />

	<!-- where the sidebar doesn't fit (an iPad held upright) it folds to this
	     strip at the left edge, and slides back in over the catalogue -->
	<div class="rail-strip">
		<button aria-expanded={plan.railOpen} aria-controls="rail" onclick={() => (plan.railOpen = !plan.railOpen)}>
			<PixelIcon name="gear" />
			<span>your degree</span>
		</button>
	</div>

	<!-- a tap beside the slid-in sidebar puts it away (the course panel
	     closes on its own, see closeIfNothingPicked) -->
	{#if viewport.desktop && overlayRail}
		<button class="scrim" tabindex="-1" aria-label="close" onclick={closeOverlays} transition:fade={{ duration: 160 }}
		></button>
	{/if}

	<aside
		id="rail"
		class="rail"
		data-panel="rail"
		use:focusScope={overlayRail}
		inert={viewport.desktop ? viewport.railSlide && !plan.railOpen : covered('rail')}
	>
		<Sidebar />
		<DegreeProgress />
		<ChoicePools />
		<Hints />
	</aside>

	<div class="catalogue" data-panel="catalogue" inert={covered('catalogue')}>
		<Catalogue mobile={!viewport.desktop} />
	</div>

	<main class="board" inert={covered('board')}>
		{@render children()}
	</main>

	<!-- slides in over the board for a picked course, and away at a click outside -->
	<aside
		class="details"
		data-panel="details"
		data-tour="details"
		aria-label="course details"
		bind:this={detailsEl}
		use:focusScope={overlayDetails}
		inert={!plan.selected && !detailsDocked}
	>
		<DetailsPanel canPin={viewport.desktop} pinned={detailsPinned} onTogglePin={toggleDetailsPin} />
	</aside>
</div>

<Flash />

<!-- staff opened this tab from the office: the catalogue here is their
     unsaved draft, so say so where it can't be missed -->
{#if PREVIEWING}
	<p class="previewing" role="status">Office preview · this tab shows the unsaved draft, not what students see</p>
{/if}

{#if plan.feedbackDraft !== null}
	<Modal title="feedback" onclose={() => (plan.feedbackDraft = null)}>
		<FeedbackForm prefill={plan.feedbackDraft} onsent={() => (plan.feedbackDraft = null)} />
	</Modal>
{/if}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	:global(html),
	:global(body) {
		height: 100%;
	}

	$top-strip-h: var(--site-bar-height);

	// The app is locked to the viewport and each column scrolls on its own, so
	// nothing ever runs past the page. Side panels follow the text size;
	// a dragged edge overrides their default widths.
	.app {
		--rail-w: var(--rail-user-w, minmax(max-content, 28rem));
		--catalogue-w: var(--catalogue-user-w, 30rem);
		--details-w: 36rem;
		--board-w: minmax(0, 1fr);
		--rail-strip-w: 5.2rem;
		// the "now" trimester's ring, tag and number (see TrimesterCell),
		// in the student's own colour. worked out here, where the hues are
		// set, so every cell gets this plan's and not the page default's
		--color-now: oklch(var(--now-l) var(--now-c) var(--now-a, var(--accent-hue)));
		--color-now-end: oklch(var(--now-l) var(--now-c) var(--now-b, var(--now-a, var(--accent-hue))));
		position: relative;
		display: grid;
		grid-template-areas: 'rail catalogue board';
		grid-template-columns: var(--rail-w) var(--catalogue-w) var(--board-w);
		height: calc(100dvh - #{$top-strip-h});
		background: var(--color-bg);

		// mid-drag, the cursor holds wherever it wanders and no text gets
		// selected on the way
		&.resizing {
			cursor: col-resize;
			user-select: none;
		}
	}

	.rail,
	.catalogue,
	.board,
	.details {
		min-width: 0;
		min-height: 0;
	}

	.rail {
		--rail-radius: 4px;
		--panel-gutter: var(--card-gap);
		grid-area: rail;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--color-border-warm);
		overflow-y: auto;
	}

	// the programme pickers alone set the sidebar's width (the longest
	// subject, environmental studies, shows in full); everything else in it
	// wraps to that width instead of asking for more
	.rail > :global(:not(.pickers)) {
		contain: inline-size;
	}

	.catalogue {
		grid-area: catalogue;
		overflow: hidden;
	}

	// the middle column is its own cool zone, a very pale blue-grey field.
	// its bands (the bar, the grid) run edge to edge, but on a very wide
	// screen what's in them stops at --board-max and centres: past that,
	// trimesters only get emptier, not easier to read
	.board {
		--board-max: 116rem;
		--board-gutter: max(2.4rem, (100cqi - var(--board-max)) / 2);
		container: plan / inline-size;
		grid-area: board;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		background: var(--color-bg-board-page);
	}

	.details {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		background: linear-gradient(to bottom, var(--color-bg-sidebar), var(--color-bg-sidebar-end));
		border-left: 1px solid var(--color-border-warm);
	}

	// the folded sidebar's strip, only where the sidebar doesn't fit
	.rail-strip {
		grid-area: strip;
		display: none;
		min-height: 0;
		background: linear-gradient(to bottom, var(--color-bg-sidebar), var(--color-bg-sidebar-end));
		border-right: 1px solid var(--color-border-warm);

		button {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 1rem;
			width: 100%;
			padding: 1.6rem 0;
			font: inherit;
			font-size: 1.3rem;
			font-weight: 600;
			color: var(--color-text-muted);
			background: none;
			border: 0;
			cursor: pointer;

			&:hover,
			&[aria-expanded='true'] {
				color: var(--color-accent);
			}

			span {
				writing-mode: vertical-rl;
				transform: rotate(180deg);
			}
		}
	}

	.previewing {
		position: fixed;
		top: $top-strip-h;
		left: 50%;
		z-index: 50;
		translate: -50% 0;
		padding: 0.4rem 1.4rem;
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--color-on-accent);
		background: var(--color-accent);
		border-radius: 0 0 8px 8px;
		pointer-events: none;
	}

	// behind a slid-in panel: a faint dim to tap on to put it away
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 29;
		padding: 0;
		background: rgba(20, 30, 50, 0.14);
		border: 0;
		cursor: default;
	}

	// a panel that slides in over the board
	@mixin slide-in($from) {
		position: fixed;
		top: $top-strip-h;
		bottom: 0;
		#{$from}: 0;
		z-index: 30;
		visibility: hidden;
		transition:
			transform 0.3s var(--ease-out),
			visibility 0s 0.3s;
	}
	@mixin slid-in {
		transform: none;
		visibility: visible;
		transition: transform 0.34s var(--ease-out);
	}

	// the details slide in from the right over the board when a course is
	// picked, and back out after
	@include details-overlay {
		.details {
			@include slide-in(right);
			width: min(var(--details-w), 90vw);
			padding-right: env(safe-area-inset-right);
			box-shadow: -10px 0 30px rgba(20, 30, 50, 0.18);
			transform: translateX(100%);
		}

		.details-open .details {
			@include slid-in;
		}

		.app.details-docked {
			--rail-w: var(--rail-user-w, minmax(0, 25rem));
			--catalogue-w: var(--catalogue-user-w, 30rem);
			--details-w: 30rem;
			grid-template-areas: 'rail catalogue board details';
			grid-template-columns: var(--rail-w) var(--catalogue-w) var(--board-w) var(--details-w);

			.details {
				grid-area: details;
				position: relative;
				inset: auto;
				z-index: 3;
				width: auto;
				box-shadow: none;
				transform: none;
				visibility: visible;
				transition: none;
			}
		}
	}

	// …and an iPad held upright: the sidebar folds to its strip and slides in
	// from the left the same way
	@include rail-overlay {
		.app {
			grid-template-areas: 'strip catalogue board';
			grid-template-columns: var(--rail-strip-w) var(--catalogue-w) minmax(0, 3fr);
		}

		.app.details-docked {
			grid-template-areas: 'strip catalogue board details';
			grid-template-columns: var(--rail-strip-w) var(--catalogue-w) minmax(0, 1fr) var(--details-w);
		}

		.rail-strip {
			display: block;
		}

		.rail {
			@include slide-in(left);
			width: min(30rem, 90vw);
			padding-left: env(safe-area-inset-left);
			background: var(--color-bg);
			box-shadow: 10px 0 30px rgba(20, 30, 50, 0.18);
			transform: translateX(-100%);
		}

		.rail-open .rail {
			@include slid-in;
		}
	}

	// Phones: one panel at a time under the tabs, the details over everything
	@include mobile {
		.app {
			grid-template-areas: 'main' 'tabs';
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			overflow: hidden;
		}

		.catalogue {
			container: catalogue / inline-size;
		}

		.rail,
		.board,
		.catalogue {
			grid-area: main;
			border: 0;
		}

		.app:not([data-mobile-view='rail']) .rail,
		.app:not([data-mobile-view='board']) .board,
		.app:not([data-mobile-view='catalogue']) .catalogue {
			display: none;
		}

		.details {
			display: none;
			position: fixed;
			inset: 0;
			z-index: 30;
			padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
			overscroll-behavior: contain;
			border: 0;
		}

		.details-open .details {
			display: flex;
		}
	}
</style>

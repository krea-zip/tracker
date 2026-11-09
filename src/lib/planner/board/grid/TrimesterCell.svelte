<script lang="ts">
	// one neutral trimester on the grid, ringed by its state (now, a warning,
	// a drag's fit); its course cards carry the subject colours. It opens
	// when clicked anywhere that isn't a course.
	import { slotOrder, termMonths } from '$lib/planner/calendar';
	import { usePlan } from '$lib/planner/context';
	import type { TrimNum } from '$lib/types';
	import { useBoard } from '$lib/planner/board/boardState.svelte';
	import CourseChips from './CourseChips.svelte';
	import Ghosts from './Ghosts.svelte';
	import CellFoot from './CellFoot.svelte';

	let { year, trim, touchLayout = false }: { year: number; trim: TrimNum; touchLayout?: boolean } = $props();
	const plan = usePlan();
	const board = useBoard();

	let key = $derived(`${year}-${trim}`);
	let codes = $derived(plan.slotCourses(year, trim));
	let off = $derived(plan.breakAt(year, trim));
	let coreSlot = $derived(plan.coreOnly(year, trim));
	let order = $derived(slotOrder(year, trim));
	let whatIf = $derived(plan.view === 'whatif');
	// what-if marks "you are here" itself and greys the past, so the plain
	// "now" ring would say it twice
	let now = $derived(!whatIf && order === board.hereAt);
	let dragging = $derived(plan.dragging);
	let landing = $derived(board.drag.landingIn(key));

	const open = () => (plan.zoom = { year, trim });

	// a press that starts on a course, a ghost or the clear button is about
	// that thing: if the pointer slips off before release (the chip shrinks
	// under the press), the click lands on the cell and mustn't zoom
	let pressOnItem = false;
</script>

<div
	class="cell"
	class:now
	class:here={whatIf && order === board.hereAt}
	class:past={whatIf && order < board.hereAt}
	class:fresh={year === board.freshYear}
	class:problem={plan.slotHasProblem(year, trim)}
	class:dim={!!board.spotSlots && !board.spotSlots.has(key)}
	class:drop-target={dragging !== null && board.drag.target === key}
	class:can-drop={dragging !== null && plan.canDrop(dragging, year, trim)}
	class:no-fit={dragging !== null && !plan.canDrop(dragging, year, trim)}
	style:--t={trim}
	data-year={year}
	data-trim={trim}
	data-core-only={coreSlot || undefined}
	role="button"
	tabindex="0"
	aria-label="open {plan.trimSpelled(year, trim)}"
	onpointerdown={(e) => (pressOnItem = !!(e.target as Element).closest('.chip, .ghost, .cell-credits'))}
	onclick={() => !pressOnItem && open()}
	onkeydown={(e) => {
		if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			open();
		}
	}}
>
	<!-- phones have no column headings, so each trimester names itself -->
	<button
		class="phone-term"
		aria-label="view {plan.trimSpelled(year, trim)}"
		onclick={(e) => {
			e.stopPropagation();
			open();
		}}>{plan.trimName(year, trim)} · {termMonths(trim)}<span>view trimester →</span></button
	>

	<!-- a break, a suspension or a term away, set and lifted in the trimester's own view -->
	{#if off}
		<span class="off-card">
			<b>{off.kind === 'away' ? 'away' : off.kind === 'suspension' ? 'suspended' : 'on a break'}</b>
			{#if off.kind === 'away'}<span>{off.credits ?? 0} cr from elsewhere</span>{/if}
		</span>
	{/if}

	<!-- named while empty; the course cards identify foundation courses -->
	{#if coreSlot && codes.length === 0 && (plan.view !== 'plan' || plan.suggestionsFor(year, trim).length === 0)}
		<span class="core-note">kccs courses</span>
	{/if}

	<CourseChips {year} {trim} {codes} {touchLayout} />

	<!-- the course in hand's footprint, opening where it would land (placed by
	     CSS order, see GridDrag.order) -->
	{#if landing && dragging}
		<span class="landing" class:titled={plan.showTitles} style:order={landing.index * 4} aria-hidden="true">
			<span class="label">{plan.courseLabel(dragging)}</span>
			<span class="plus">+</span>
		</span>
	{/if}

	<Ghosts {year} {trim} />

	<CellFoot {year} {trim} {now} />
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.cell {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 0.8rem;
		min-height: 13rem;
		padding: 1rem 1rem 2.6rem;
		background: var(--color-grid-cell);
		border-radius: 8px;
		cursor: zoom-in;
		// One quiet boundary; stronger outlines are reserved for state.
		outline: 1px solid color-mix(in srgb, var(--color-board-text) 15%, transparent);
		outline-offset: -1px;
		transition:
			background 0.25s ease,
			box-shadow 0.25s ease,
			opacity 0.25s ease,
			outline-color 0.25s ease;

		// states are in cascade order, later ones win when two apply: a drag
		// beats a warning beats "now"
		&.drop-target {
			outline: 2px solid var(--color-accent);
			outline-offset: -3px;
			box-shadow: inset 0 0 0 5px color-mix(in srgb, var(--color-accent) 10%, transparent);
		}

		// A small lift in contrast keeps empty drop targets discoverable.
		&:hover {
			box-shadow: inset 0 0 0 100vmax color-mix(in srgb, var(--color-board-text) 4%, transparent);
		}

		// The current term uses the student's own colour. An outline can't
		// take a gradient, so the ring is drawn by
		// ::after (a double major's two colours run round it); the outline
		// stays, unseen, for a later state to recolour, and then the ring
		// steps aside
		&.now {
			// the brightest cell on the board, faintly in the student's colour
			background: color-mix(in srgb, var(--color-now) 7%, var(--color-grid-cell-now));
			outline: 2px solid transparent;
			outline-offset: -3px;

			&::after {
				content: '';
				position: absolute;
				inset: 1px;
				padding: 2px;
				border-radius: 7px;
				background: linear-gradient(135deg, var(--color-now), var(--color-now-end));
				mask:
					linear-gradient(#000 0 0) content-box exclude,
					linear-gradient(#000 0 0);
				opacity: 0.8; // it marks where you are; a warning's red dashes still take over from it
				pointer-events: none;
				transition: opacity 0.25s ease;
			}

			&:is(.drop-target, .problem, .can-drop)::after {
				opacity: 0;
			}
		}

		// the courses keep their colours; the warning rides on the rule
		&.problem {
			outline-style: dashed;
			outline-offset: -3px;
			outline-color: var(--color-hint-warn-deep);
		}

		// mid-drag: mint where the course fits cleanly, and every trimester it
		// doesn't (not offered then, wrong year, prerequisite after it) fades
		// back. still, not pulsing: the whole grid breathing at once was noise.
		// a faded slot still takes the drop; the hints flag it
		&.can-drop {
			background: var(--color-drop-ok);
			outline: 2px solid var(--color-drop-ok-edge);
		}

		&.no-fit {
			opacity: 0.4;
			filter: saturate(0.4);
		}

		// what-if: the past steps back and "you are here" is ringed
		&.past {
			opacity: 0.55;
		}

		&.here {
			outline: 2px solid color-mix(in srgb, var(--color-accent) 70%, transparent);
			outline-offset: -3px;
		}

		// a pointed-at hint is about other trimesters
		&.dim {
			opacity: 0.4;
		}

		&.fresh {
			@include drop-in;
		}
	}

	.phone-term {
		display: none;
	}

	.core-note {
		@include section-label;
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		text-align: center;
		font-size: 1rem;
		pointer-events: none;
	}

	// a trimester off holds one quiet card instead of courses
	.off-card {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		padding: 1rem 1.2rem;
		font-size: 1.25rem;
		color: var(--color-text-muted);
		border: 1px dashed color-mix(in srgb, var(--color-text-muted) 55%, transparent);
		border-radius: 5px;

		b {
			font-weight: 650;
			color: var(--color-text);
		}

		span {
			font-size: 1.15rem;
		}
	}

	// the chip's own footprint, dashed, popping in on a spring
	.landing {
		position: relative;
		display: flex;
		align-items: center;
		height: fit-content;
		padding: 0.7rem 2.2rem 0.7rem 1rem; // a chip's own box, so the sizes match
		font-size: 1.3rem;
		background: color-mix(in srgb, var(--color-accent) 8%, transparent);
		border: 1px dashed var(--color-accent);
		border-radius: 5px;
		pointer-events: none;
		animation: landing-pop 240ms var(--spring) both;

		.label {
			visibility: hidden;
			white-space: nowrap;
		}

		.plus {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: 700;
			color: var(--color-accent);
		}

		&.titled {
			flex-basis: 100%;

			.label {
				white-space: normal;
			}
		}
	}

	@keyframes landing-pop {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
	}

	@include mobile {
		.cell {
			grid-column: 1;
			min-width: 0;
			min-height: 0;
			padding: 0.8rem 1rem;
			gap: 0.4rem;
		}

		.phone-term {
			order: -1;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			width: 100%;
			min-height: 3.6rem;
			padding: 0;
			font-size: 1.4rem;
			font-weight: 600;
			text-align: left;
			color: var(--color-text);
			background: none;
			border: 0;
			cursor: pointer;

			span {
				font-size: 1.1rem;
				font-weight: 400;
				color: var(--color-text-muted);
			}
		}

		@container plan (min-width: 720px) {
			.cell {
				grid-column: auto;
			}

			.phone-term {
				flex-wrap: wrap;
				gap: 0.5rem;
			}
		}
	}
</style>

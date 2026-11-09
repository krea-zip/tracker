<script lang="ts">
	// a row's heading: the year, and the academic year it falls in from the
	// batch. in grade view the year carries its gpa on a little glossy readout
	// that opens the grades window on just that year.
	import { academicYear } from '$lib/planner/calendar';
	import { GRAD_MIN_CGPA } from '$lib/planner/grades/grades';
	import { usePlan } from '$lib/planner/context';
	import Rolling from '$lib/ui/Rolling.svelte';
	import { useBoard } from '$lib/planner/board/boardState.svelte';
	import HeadLine from './HeadLine.svelte';

	let { year }: { year: number } = $props();
	const plan = usePlan();
	const board = useBoard();

	let gpa = $derived(plan.gradeMode ? plan.yearGpa(year) : null);
	let shown = $derived(gpa === null ? '–' : gpa.toFixed(2));
</script>

<div class="year-head" class:fresh={year === board.freshYear}>
	{#if plan.gradeMode}
		<button
			class="gpa"
			class:empty={gpa === null}
			class:low={gpa !== null && gpa < GRAD_MIN_CGPA}
			title={gpa === null
				? `no grades in year ${year} yet, grade its courses`
				: `year ${year} GPA ${shown}, grade its courses`}
			onclick={() => board.openGrades(year)}
		>
			<Rolling value={shown} />
		</button>
		<span class="tag">y{year}</span>
	{:else}
		<span class="short">y{year}</span><span class="long">year {year}</span>
	{/if}
	<HeadLine text={academicYear(plan.batchStartYear, year)} />
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.year-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		font-size: 2.2rem;
		align-self: center;
		text-align: center;
	}

	.fresh {
		@include drop-in;
	}

	.long {
		display: none;
	}

	// an old desktop app's readout: springs up under the cursor and squeezes
	// when pressed, like tracker's other keys
	.gpa {
		display: inline-grid;
		place-items: center;
		min-width: 5.2rem;
		padding: 0.35rem 0.6rem 0.3rem;
		font: inherit;
		font-size: 1.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
		color: var(--color-text);
		background-color: var(--color-bg-light);
		background-image: var(--gloss-face);
		border: 1px solid var(--color-border-card);
		border-radius: 8px;
		box-shadow: var(--shadow-inset), var(--shadow-card);
		cursor: pointer;
		transition:
			transform 0.4s var(--spring),
			box-shadow 0.2s ease,
			background-color 0.25s ease;

		&:hover {
			transform: translateY(-1px) scale(1.05);
			box-shadow: var(--shadow-inset-hover), var(--shadow-card-hover);
		}

		&:active {
			transform: scale(0.95);
			transition-duration: 0.08s;
		}

		// nothing graded yet: an empty slot set into the board, not a raised key
		&.empty {
			color: var(--color-text-muted);
			background-color: transparent;
			background-image: none;
			border-style: dashed;
			box-shadow: none;
		}

		// under the standing line: the warning red, still legible
		&.low {
			color: var(--color-danger-deep);
			background-color: var(--color-hint-warn);
			border-color: var(--color-hint-warn-deep);
		}
	}

	.tag {
		display: block;
		margin-top: 0.4rem;
		font-size: 1.1rem;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	@include mobile {
		// a row of its own, the academic year beside the year, not under it
		.year-head {
			grid-column: 1 / -1;
			min-width: 0;
			flex-direction: row;
			align-items: baseline;
			gap: 1rem;
			text-align: left;
			padding: 0.8rem 0 0;
			font-size: 1.8rem;
			font-weight: 600;
		}

		// the dates under it are a small toggle, not a 44px button
		.year-head :global(.head-line) {
			min-height: 0;
		}

		.short {
			display: none;
		}

		.long {
			display: inline;
		}
	}
</style>

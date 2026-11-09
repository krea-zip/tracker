<script lang="ts">
	// the board: its bar, the strip for the view laid over it, the grid, and
	// the bulk actions under it. the parts share a BoardState by context.
	import { untrack } from 'svelte';
	import { usePlan } from '$lib/planner/context';
	import { viewport } from '$lib/planner/viewport.svelte';
	import { BoardState, provideBoard } from './boardState.svelte';
	import BoardBar from '$lib/planner/board/bar/BoardBar.svelte';
	import ViewStrip from './ViewStrip.svelte';
	import GradeHint from './GradeHint.svelte';
	import PlanGrid from '$lib/planner/board/grid/PlanGrid.svelte';
	import BoardActions from './BoardActions.svelte';
	import CreditRules from './CreditRules.svelte';
	import GradesPanel from '$lib/planner/grades/GradesPanel.svelte';

	let { touchLayout = false }: { touchLayout?: boolean } = $props();
	const plan = usePlan();
	const board = provideBoard(new BoardState(plan));

	// prerequisites follows the course opened anywhere (catalogue, hints)
	// while it's on the grid
	$effect(() => {
		const code = plan.selected?.code;
		untrack(() => {
			if (plan.view === 'prereqs' && code && plan.placedCodes.has(code)) board.chainRoot = code;
		});
	});
</script>

<!-- the chain stays up until a click lands somewhere that isn't a course,
     the course panel or the view's own strip -->
<svelte:window
	onpointerdown={(e) => {
		if (board.chainRoot && !(e.target as Element | null)?.closest('.overview .chip, .details, .view-strip'))
			board.chainRoot = null;
	}}
/>

<BoardBar />
<ViewStrip chain={board.chain} verdict={board.verdict} />
<GradeHint />

{#if board.creditsOpen}
	<CreditRules onclose={() => (board.creditsOpen = false)} />
{/if}

{#if board.grades.open && plan.gradeMode}
	<GradesPanel year={board.grades.year} onclose={() => (board.grades = { open: false })} />
{/if}

<!-- a phone is for checking credits and the catalogue; say so plainly -->
{#if !viewport.desktop}
	<p class="laptop-note">
		<b>tracker on a phone is for checking your credits and the catalogue.</b> grades, what-if, prerequisites and the other
		views are on a laptop. plan properly there.
	</p>
{/if}

<!-- until the student changes something the grid is the suggested path,
     filled in for them; say so, so it doesn't read as someone else's plan -->
{#if !plan.touched && !plan.welcoming && plan.view === 'plan'}
	<p class="example-note">
		<b>this is the suggested path for your degree, filled in to start you off.</b> change anything and it's yours, until
		then, picking a different degree {viewport.desktop ? 'on the left' : 'in your degree'} lays it out again.
	</p>
{/if}

<PlanGrid {touchLayout} />
<BoardActions />

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// the phone's one plain line: what it's for, and where the rest lives
	.laptop-note {
		margin: 1.2rem 1.6rem 0;
		font-size: 1.3rem;
		line-height: 1.5;
		color: var(--color-text-muted);

		b {
			color: var(--color-text);
		}
	}

	.example-note {
		margin: 1.6rem var(--board-gutter, 3.2rem) 0;
		padding: 0.9rem 1.4rem;
		font-size: 1.3rem;
		line-height: 1.5;
		color: var(--color-text-muted);
		border: 1px dashed color-mix(in srgb, var(--color-board-text) 45%, transparent);
		border-radius: 8px;

		b {
			color: var(--color-text);
		}
	}

	@include mobile {
		.example-note {
			margin: 1.2rem 1.6rem 0;
			font-size: 1.3rem;
		}
	}
</style>

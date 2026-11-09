<script lang="ts">
	import Toolbar from '$lib/ui/Toolbar.svelte';
	// the bar over the board, sticky so it stays in reach while a long plan
	// scrolls: history, what the board shows, how chips are labelled, what
	// their colours mean, and where the plan stands at the far end
	import { usePlan } from '$lib/planner/context';
	import { viewport } from '$lib/planner/viewport.svelte';
	import Keys from './Keys.svelte';
	import ViewPicker from './ViewPicker.svelte';
	import ColourKey from './ColourKey.svelte';
	import LabelKeys from './LabelKeys.svelte';
	import CreditTotal from './CreditTotal.svelte';

	const plan = usePlan();
</script>

<Toolbar class="board-bar" data-tour="board-toggles">
	<Keys label="history" glyphs>
		<button disabled={!plan.canUndo} title="undo (Ctrl+Z)" aria-label="undo" onclick={() => plan.undo()}>↶</button>
		<button disabled={!plan.canRedo} title="redo (Ctrl+Shift+Z)" aria-label="redo" onclick={() => plan.redo()}>↷</button
		>
	</Keys>

	<!-- the other views and the label switches are laptop-only: a phone's
	     board stays on the plan, and its rows show code and title both -->
	{#if viewport.desktop}
		<span class="rule" aria-hidden="true"></span>
		<ViewPicker />
	{/if}

	<span class="rule" aria-hidden="true"></span>
	<ColourKey />

	{#if viewport.desktop}
		<span class="rule" aria-hidden="true"></span>
		<LabelKeys />
	{/if}

	<div class="end"><CreditTotal /></div>
</Toolbar>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	:global(.board-bar) {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 1.6rem;
		flex-wrap: wrap;
		min-height: 5.6rem;
		padding: 0.8rem var(--board-gutter, 3.2rem);

		// everything inside takes the bar's own steel palette (--bar-* in
		// _variables); only the toggles go pink
		--color-text: var(--bar-text);
		--color-text-muted: var(--bar-text-muted);
		--color-accent: var(--bar-key-on);
		--color-on-accent: var(--bar-key-on-text);
		--color-bg-light: var(--bar-top);
		--color-border-card: var(--bar-edge);
		--gloss-face: linear-gradient(
			to bottom,
			var(--bar-hi) 0%,
			transparent 50%,
			rgba(40, 56, 84, 0.05) 51%,
			rgba(40, 56, 84, 0.12) 100%
		);
		--shadow-inset: inset 0 1px 0 var(--bar-hi);
		--shadow-card: 0 0 0 transparent;
	}

	// the dotted rule between the bar's groups
	.rule {
		align-self: stretch;
		margin: 0.6rem 0;
		border-left: 1px dotted color-mix(in srgb, var(--bar-text-muted) 55%, transparent);
	}

	.end {
		margin-left: auto;
	}

	// a laptop-width board: decoration goes first, so the bar stays on one line
	@container plan (max-width: 82rem) {
		:global(.board-bar) {
			gap: 1rem;
		}

		.rule,
		:global(.board-bar) :global(.colour-key .keys .swatches),
		:global(.board-bar) :global([aria-label='course labels'] svg) {
			display: none;
		}
	}

	// phones: one row that scrolls sideways rather than wrapping onto two.
	// the bar isn't positioned here, so the dropdowns hang off the board
	// instead and aren't clipped by the scrolling row (see ColourKey, ViewPicker)
	@include mobile {
		:global(.board-bar) {
			position: static;
			flex-wrap: nowrap;
			gap: 0.6rem;
			min-height: 0;
			padding: 0.6rem 1.6rem;
			overflow-x: auto;
			scrollbar-width: none;

			> :global(*) {
				flex: none;
			}
		}

		.rule {
			display: none;
		}

		.end {
			margin-left: 0;
		}
	}
</style>

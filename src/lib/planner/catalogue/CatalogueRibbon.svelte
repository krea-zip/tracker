<script lang="ts">
	// The count and sort controls sit quietly between the filters and results.
	import { fade } from 'svelte/transition';
	import { usePlan } from '$lib/planner/context';
	import type { CatalogueSort } from './select';
	import { reducedMotion } from '$lib/ui/transitions';
	import PixelIcon from '$lib/ui/PixelIcon.svelte';

	const plan = usePlan();

	// shared with CatalogueFilters, which holds the fold and reports what's ticked
	let { advanced = $bindable(false), ticks = [] }: { advanced?: boolean; ticks?: string[] } = $props();

	const SORTS: CatalogueSort[] = ['relevance', 'code', 'title', 'credits'];
</script>

<div class="ribbon">
	<label class="sort">
		sort by
		<select aria-label="sort courses" bind:value={plan.catalogueSort}>
			{#each SORTS as sort (sort)}
				<option value={sort}>{sort}</option>
			{/each}
		</select>
	</label>
	{#if plan.narrowed}
		<button
			class="clear"
			title="clear every filter"
			transition:fade={{ duration: reducedMotion() ? 0 : 160 }}
			onclick={() => plan.clearNarrowing()}>clear</button
		>
	{/if}
	<button
		class="advanced"
		aria-pressed={advanced}
		class:active={!advanced && ticks.length > 0}
		aria-expanded={advanced}
		aria-label="advanced filters"
		title={!advanced && ticks.length ? `advanced filters: ${ticks.join(', ')}` : 'advanced filters'}
		onclick={() => (advanced = !advanced)}><PixelIcon name="sliders" size="1.6rem" snap /></button
	>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.ribbon {
		position: relative;
		flex-shrink: 0;
		margin-top: 2px;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 3.6rem;
		padding: 0.4rem 1.4rem;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		background: var(--color-sunken);
		border-bottom: 1px solid var(--color-border-light);
		contain: inline-size;
	}

	// the advanced-filters switch: the same dashed pill as every other filter,
	// filled while the panel is open, and a dot says filters are ticked while
	// it's shut
	.advanced {
		@include toggle-pill;
		position: relative;
		display: flex;
		align-items: center;
		margin-left: auto;
		padding: 0.3rem 0.8rem;

		.clear + & {
			margin-left: 0.8rem;
		}

		&.active::after {
			content: '';
			position: absolute;
			top: -0.1rem;
			right: -0.1rem;
			width: 0.7rem;
			height: 0.7rem;
			background: var(--color-accent);
			border-radius: 50%;
		}
	}

	// "clear" takes the spare room, the switch follows it at the edge
	.clear {
		margin-left: auto;
		padding: 0;
		font: inherit;
		color: var(--color-accent);
		background: none;
		border: 0;
		cursor: pointer;
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;

		select {
			padding: 0.25rem 0.5rem;
			font: inherit;
			color: var(--color-text);
			background: var(--color-bg-light);
			border: 1px solid var(--color-border-card);
			border-radius: 4px;
			cursor: pointer;
		}
	}

	// by finger: a switch you can hit
	@include touch {
		.advanced {
			min-width: 3.6rem;
			min-height: 3.6rem;
			align-items: center;
			justify-content: center;
		}
	}
</style>

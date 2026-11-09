<script lang="ts">
	import { usePlan } from '$lib/planner/context';
	import { STUDENT_BATCHES } from '$lib/curriculum/data';
	import { optionLabel, type PickRole } from '$lib/planner/picks';
	import FourYearToggle from './FourYearToggle.svelte';
	import { softUpdate } from '$lib/ui/transitions';

	const plan = usePlan();

	// changing the programme re-lays-out a plan the student has never edited,
	// and leaves an edited one alone, see Plan.programmeChanged. a subject an
	// earlier role holds shows disabled in the later roles' lists; moving an
	// earlier role onto a later one's subject bumps the later pick instead
	const distinct = () => softUpdate(() => plan.programmeChanged());
</script>

{#snippet picker(role: PickRole, label: string, title?: string)}
	<label class="row">
		<span class="row-label" {title}>{label}</span>
		<select class="later" bind:value={plan.picks[role]} onchange={distinct}>
			{#each plan.pickOptions(role) as o (o.subject.id)}
				<option value={o.subject.id} disabled={!!o.heldAs}>{optionLabel(o)}</option>
			{/each}
		</select>
	</label>
{/snippet}

<div class="pickers" data-tour="programme">
	<!-- the 4-year switch rides on the batch line -->
	<div class="row">
		<label class="row-label" for="batch">batch</label>
		<div class="batch-line">
			<select id="batch" bind:value={plan.batchStartYear} onchange={distinct}>
				{#each STUDENT_BATCHES as year (year)}
					<option value={year}>{year}–{String(year + (plan.fourYear ? 4 : 3)).slice(-2)}</option>
				{/each}
			</select>
			<FourYearToggle onchange={() => plan.programmeChanged()} />
		</div>
	</div>

	<label class="row">
		<span class="row-label">degree</span>
		<select bind:value={plan.structure} onchange={distinct}>
			<option value="single-major">single major</option>
			<option value="double-major">double major</option>
			<option value="major-minor">major + minor</option>
			<option value="major-conc">major + conc.</option>
			{#if plan.fourYear}<option value="major-minor-conc">major + minor + conc.</option>{/if}
		</select>
	</label>

	<label class="row">
		<span class="row-label">major</span>
		<select bind:value={plan.picks.major1} onchange={distinct}>
			{#each plan.pickOptions('major1') as o (o.subject.id)}
				<option value={o.subject.id}>{optionLabel(o)}</option>
			{/each}
		</select>
	</label>

	{#if plan.structure === 'double-major'}{@render picker('major2', 'major')}{/if}
	{#if plan.structure.includes('minor')}{@render picker('minor', 'minor')}{/if}
	{#if plan.structure.includes('conc')}{@render picker('conc', 'conc.', 'concentration')}{/if}
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// the planner sizes the sidebar to fit these (see its layout)
	.pickers {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: var(--panel-gutter);
		border-bottom: 1px solid var(--color-border-light);
	}

	.row {
		display: grid;
		grid-template-columns: 5.4rem 1fr;
		align-items: center;
		gap: 1rem;
		font-size: var(--text-body);
		cursor: pointer;
	}

	.row-label {
		color: var(--color-text);
	}

	// the later roles' lists name a taken subject ("… (major)"), which
	// mustn't widen the sidebar: no width of their own, they fill whatever
	// the rest set (a select ignores `contain`, so it's this old trick)
	.later {
		width: 0;
		min-width: 100%;
	}

	select {
		@include flat-select;
	}

	.batch-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	// by finger: the programme pickers a fingertip tall
	@include touch {
		select {
			min-height: 4rem;
		}
	}
</style>

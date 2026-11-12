<script lang="ts">
	// everything that narrows the catalogue under its search box: browse and
	// your subjects (the folded-away rest is CatalogueAdvanced, under the sort row).
	// every switch here is the same pill as the 4yup one.
	import { SUBJECTS, subjectById } from '$lib/curriculum/data';
	import { usePlan } from '$lib/planner/context';

	const plan = usePlan();

	// the open minor has no courses of its own, so it gets no pill
	let subjects = $derived([...new Set([...plan.selectedSubjects.filter((s) => s !== 'open'), 'core'])]);
</script>

{#snippet pill(label: string, on: boolean, toggle: () => void, note?: string, hue?: number, subject?: string)}
	<button class="pill" style:--hue={hue} data-subject={subject} aria-pressed={on} title={note} onclick={toggle}
		>{label}</button
	>
{/snippet}

<label class="browse">
	<span>browse</span>
	<select aria-label="browse department" bind:value={plan.catalogueSubject}>
		<option value="">{plan.filters.length ? 'your programme filters' : 'all departments'}</option>
		{#each SUBJECTS.filter((s) => s.id !== 'open') as subject (subject.id)}
			<option value={subject.id}>{subject.label}</option>
		{/each}
	</select>
</label>

<div class="pills subjects" role="group" aria-label="subjects">
	{#each subjects as id (id)}
		{@render pill(
			subjectById(id).short,
			!plan.catalogueSubject && plan.filters.includes(id),
			() => {
				plan.catalogueSubject = '';
				plan.toggleFilter(id);
			},
			undefined,
			plan.hueFor(id),
			id
		)}
	{/each}
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// a label and its control on one line, like the sidebar's pickers
	.browse {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-top: 1.2rem;
		font-size: var(--text-body);
		color: var(--color-text-muted);
		contain: inline-size;

		select {
			@include flat-select;
			flex: 1;
			width: auto;
		}
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.subjects {
		padding: 1rem 0.2rem 1.1rem;
	}

	// the subject pills share out the row's spare width, so it doesn't sit empty
	.subjects .pill {
		flex: 1 1 auto;
	}

	.pill {
		@include toggle-pill;
		font-size: 1.2rem;
	}

	// the ones you reach for most get a little more room
	.subjects .pill {
		padding: 0.4rem 1.1rem;

		// on, it wears the subject's own hue at the plum's exact depth, so every
		// subject looks equally weighty. kccs has no hue of its own: its blush's
		&[aria-pressed='true'] {
			background-color: oklch(from var(--color-accent) l c var(--hue, 25));
			border-color: oklch(from var(--color-control-deep) l c var(--hue, 25));
		}
	}

	button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	// by finger: pills you can hit
	@include touch {
		.pill {
			min-height: 3.6rem;
			padding-inline: 1.1rem;
		}
	}
</style>

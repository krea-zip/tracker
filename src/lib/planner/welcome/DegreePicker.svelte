<script lang="ts">
	// the degree as slots filled from a row of subject pills: click a pill and
	// it fills the lit slot, click a slot to change it. pills are small and flat
	// on purpose, so they read as a choice and never as a course to drag.
	import { subjectById } from '$lib/curriculum/data';
	import { usePlan } from '$lib/planner/context';
	import { ROLE_LABEL, type PickRole } from '$lib/planner/picks';
	import type { DegreeAnswers } from './answers.svelte';

	let { answers }: { answers: DegreeAnswers } = $props();
	const plan = usePlan();

	let subjects = $derived(plan.pickOptions(answers.active).map((o) => o.subject));
	const departments = [
		{
			label: 'arts & humanities',
			names: ['history', 'literature', 'philosophy', 'arts']
		},
		{
			label: 'social sciences',
			names: ['economics', 'political science', 'psychology', 'sociology']
		},
		{
			label: 'sciences & mathematics',
			names: [
				'biology',
				'chemistry',
				'computer science',
				'data science',
				'environmental studies',
				'mathematics',
				'physics'
			]
		}
	];
	const chosen = (role: PickRole) => (answers.answered[role] ? subjectById(plan.picks[role]).label : 'pick one…');
</script>

<div class="slots">
	{#each answers.roles as role (role)}
		<div class="slot" class:active={answers.active === role} class:filled={answers.answered[role]}>
			<button
				class="fill"
				disabled={!answers.canFocus(role)}
				aria-pressed={answers.active === role}
				onclick={() => answers.focus(role)}
			>
				<small>{ROLE_LABEL[role]}</small>
				<span>{chosen(role)}</span>
			</button>
			{#if role !== 'major1'}
				<button class="drop" aria-label="no {ROLE_LABEL[role]}" onclick={() => answers.remove(role)}>×</button>
			{/if}
		</div>
	{/each}
	{#if answers.answered.major1}
		{#each answers.addable as role (role)}
			<button class="add" onclick={() => answers.add(role)}>+ {ROLE_LABEL[role]}</button>
		{/each}
	{/if}
</div>

<p class="prompt">
	{#if !answers.answered[answers.active]}
		click your {ROLE_LABEL[answers.active]}
	{:else if answers.addable.length}
		add a programme above, change your pick below, or continue.
	{:else}
		change your pick below, or continue.
	{/if}
</p>

{#each departments as department}
	<h4 class="department">{department.label}</h4>
	<div class="pills" role="group" aria-label="choose your {ROLE_LABEL[answers.active]}">
		{#each subjects.filter((subject) => department.names.includes(subject.label.toLowerCase()) || (department.label === 'arts & humanities' && !departments.some( (d) => d.names.includes(subject.label.toLowerCase()) ))) as subject (subject.id)}
			{@const by = answers.heldBy(subject.id)}
			{@const mine = answers.answered[answers.active] && plan.picks[answers.active] === subject.id}
			<button
				class="pill"
				class:on={mine}
				class:held={!!by}
				style:--hue={subject.hue}
				disabled={!!by}
				aria-pressed={mine}
				onclick={() => answers.pick(subject.id)}
			>
				{subject.label}{#if by}<small>· {ROLE_LABEL[by]}</small>{/if}
			</button>
		{/each}
	</div>
{/each}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.department {
		margin: 1.4rem 0 0.4rem;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}
	.slots {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 0.8rem;
	}

	// a slot waits dashed and empty, then holds its subject; the lit one is
	// where the next pill lands
	.slot {
		display: flex;
		align-items: center;
		min-width: 15rem;
		background: var(--color-bg-light);
		border: 1px dashed var(--color-border-card);
		border-radius: 6px;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;

		&.filled {
			border-style: solid;
		}

		&.active {
			border: 1px solid var(--color-accent);
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 22%, transparent);
		}
	}

	.fill {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		padding: 0.5rem 1rem;
		font: inherit;
		text-align: left;
		color: var(--color-text);
		background: none;
		border: 0;
		cursor: pointer;

		small {
			font-size: 1.05rem;
			color: var(--color-text-muted);
		}

		span {
			font-size: 1.35rem;
			font-weight: 600;
		}

		&:disabled {
			cursor: default;
			opacity: 0.55;
		}
	}

	.slot:not(.filled) .fill span {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.drop {
		padding: 0 0.9rem;
		font-size: 1.6rem;
		color: var(--color-text-muted);
		background: none;
		border: 0;
		cursor: pointer;

		&:hover {
			color: var(--color-text);
		}
	}

	.add {
		padding: 0 1.2rem;
		font: inherit;
		font-size: 1.25rem;
		color: var(--color-text-muted);
		background: none;
		border: 1px dotted var(--color-border-card);
		border-radius: 6px;
		cursor: pointer;

		&:hover {
			color: var(--color-text);
			border-color: var(--color-accent);
		}
	}

	.prompt {
		margin-top: 1.4rem;
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.7rem;
	}

	// soft subject colour, flat: darker only once it's the one chosen
	.pill {
		padding: 0.3rem 1rem;
		font: inherit;
		font-size: 1.25rem;
		@include subject-pill;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		&:hover:not(:disabled) {
			border-color: subject-tone(required-deep);
		}

		&.on {
			font-weight: 650;
			background: subject-tone(required);
			border-color: subject-tone(required-deep);
		}

		// taken by another slot, and saying which
		&.held {
			cursor: default;
			opacity: 0.6;
		}

		small {
			margin-left: 0.4rem;
			font-size: 1.1rem;
		}
	}
</style>

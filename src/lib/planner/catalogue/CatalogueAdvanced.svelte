<script lang="ts">
	// the narrowing that's folded away: it opens straight under the sort row,
	// beside the switch that opens it. every control is the same pill as the
	// 4yup one, grouped one row per question.
	import { slide } from 'svelte/transition';
	import { COURSES } from '$lib/curriculum/data';
	import { usePlan } from '$lib/planner/context';
	import { toggled, type CourseKind, type QuickFilter } from './select';
	import { cubicBezier, reducedMotion } from '$lib/ui/transitions';
	import type { TrimNum } from '$lib/types';
	import PixelIcon from '$lib/ui/PixelIcon.svelte';

	const plan = usePlan();

	// open state is the ribbon's switch; what's ticked goes back for its dot
	let { advanced = false, ticks = $bindable([]) }: { advanced?: boolean; ticks?: string[] } = $props();

	const TERMS: TrimNum[] = [1, 2, 3];
	const CREDITS = [...new Set(COURSES.map((c) => c.credits))].filter((c) => c > 0).sort((a, b) => a - b);

	let subjects = $derived([...new Set([...plan.selectedSubjects.filter((s) => s !== 'open'), 'core'])]);
	let next = $derived(plan.laterSlots[0]);

	// a pill that could never match isn't offered
	let quick = $derived<{ id: QuickFilter; label: string; note: string }[]>([
		{ id: 'needed', label: 'needed', note: 'required courses not on your plan, still offered later' },
		{ id: 'ready', label: 'ready', note: 'not on your plan, prerequisites done, fits a trimester to come' },
		...(next
			? [
					{
						id: 'next' as const,
						label: 'next term',
						note: `not on your plan and can go in ${plan.trimName(next.year, next.trim)}`
					}
				]
			: []),
		{ id: 'unplanned', label: 'not planned', note: 'hides everything already on your plan' }
	]);

	// cross-listed only means something once two of your subjects can share a course
	let kinds = $derived<{ id: CourseKind; label: string; note?: string }[]>([
		{ id: 'required', label: 'required' },
		{ id: 'elective', label: 'elective' },
		...(subjects.length > 2
			? [{ id: 'crosslisted' as const, label: 'cross-listed', note: 'listed under two or more of your subjects' }]
			: [])
	]);

	let explaining = $state(false);
	let ticked = $derived([
		...quick.filter((q) => plan.quick.includes(q.id)).map((q) => q.label),
		...kinds.filter((k) => plan.kinds.includes(k.id)).map((k) => k.label),
		...plan.catalogueTerms.map((t) => `t${t}`),
		...plan.catalogueCredits.map((c) => `${c} cr`)
	]);
	$effect(() => {
		ticks = ticked;
	});
	// the app's --ease-out curve: quick off the mark, a long soft landing
	const ease = cubicBezier(0.22, 1, 0.36, 1);
	const motion = () => ({ duration: reducedMotion() ? 0 : 320, easing: ease });
</script>

{#snippet pill(label: string, on: boolean, toggle: () => void, note?: string)}
	<button class="pill" aria-pressed={on} title={note} onclick={toggle}>{label}</button>
{/snippet}

{#if advanced}
	<div class="slot" transition:slide={motion()}>
		<div class="fold">
			<div class="line">
				<span class="label">
					show
					<button
						class="explain"
						class:on={explaining}
						aria-expanded={explaining}
						aria-label="what these filters mean"
						title="what these filters mean"
						onclick={() => (explaining = !explaining)}><PixelIcon name="help" snap /></button
					>
				</span>
				<div class="pills" role="group" aria-label="planning filters">
					{#each quick as q (q.id)}
						{@render pill(q.label, plan.quick.includes(q.id), () => (plan.quick = toggled(plan.quick, q.id)), q.note)}
					{/each}
				</div>
			</div>
			{#if explaining}
				<dl class="notes" transition:slide={motion()}>
					{#each quick as q (q.id)}
						<dt>{q.label}</dt>
						<dd>{q.note}</dd>
					{/each}
				</dl>
			{/if}
			<div class="line">
				<span class="label">type</span>
				<div class="pills" role="group" aria-label="course type">
					{#each kinds as k (k.id)}
						{@render pill(k.label, plan.kinds.includes(k.id), () => (plan.kinds = toggled(plan.kinds, k.id)), k.note)}
					{/each}
				</div>
			</div>
			<div class="line">
				<span class="label">offered</span>
				<div class="pills" role="group" aria-label="offered in">
					{#each TERMS as t (t)}
						{@render pill(
							`t${t}`,
							plan.catalogueTerms.includes(t),
							() => (plan.catalogueTerms = toggled(plan.catalogueTerms, t))
						)}
					{/each}
				</div>
			</div>
			<div class="line">
				<span class="label">credits</span>
				<div class="pills" role="group" aria-label="credits">
					{#each CREDITS as c (c)}
						{@render pill(
							`${c}`,
							plan.catalogueCredits.includes(c),
							() => (plan.catalogueCredits = toggled(plan.catalogueCredits, c))
						)}
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// a tinted tray under the sort row, closed off by the same line as the rest
	// the slide animates this bare wrapper; padding and border sit on the inner
	// tray so they don't jump while the height tweens
	.slot {
		flex-shrink: 0;
		overflow: hidden;
	}

	.fold {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.1rem 1.4rem 1.3rem;
		background: color-mix(in srgb, var(--color-bg-light) 70%, transparent);
		border-bottom: 1px solid var(--color-border-light);
	}

	// one question per row, the labels in a column so the pills line up
	.line {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr);
		align-items: center;
		font-size: var(--text-body);
		color: var(--color-text-muted);
	}

	.label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-width: 0;
	}

	.pill {
		@include toggle-pill;
		font-size: 1.2rem;
	}

	.explain {
		display: flex;
		padding: 0.2rem;
		color: var(--color-text-muted);
		background: none;
		border: 0;
		cursor: pointer;
		transition:
			color 0.15s ease,
			transform 0.18s var(--spring);

		&:hover,
		&.on {
			color: var(--color-accent);
		}

		&:active {
			transform: scale(0.86);
		}
	}

	.notes {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0.4rem 0.8rem;
		padding: 0.2rem 0 0.2rem 6rem;
		font-size: var(--text-body);
		line-height: 1.35;
		color: var(--color-text-muted);

		dt {
			font-weight: 600;
			color: var(--color-text);
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

		.explain {
			min-width: 3.6rem;
			min-height: 3.6rem;
			align-items: center;
			justify-content: center;
		}
	}
</style>

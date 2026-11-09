<script lang="ts">
	// Credit progress first, with the requirements behind a disclosure.
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { CORE_CREDITS, byCode, isCore } from '$lib/curriculum/data';
	import { usePlan } from '$lib/planner/context';
	import { reducedMotion } from '$lib/ui/transitions';
	import Progress from './Progress.svelte';

	const plan = usePlan();
	let coreDone = $derived(
		plan.placed.filter((p) => isCore(p.code)).reduce((sum, p) => sum + byCode(p.code).credits, 0)
	);
	let creditsLeft = $derived(Math.max(0, plan.creditTarget - plan.totalPlacedCredits));
	let overLimit = $derived(Math.max(0, plan.totalPlacedCredits - plan.creditCeiling));
	let additionalCredits = $derived(Math.max(0, plan.creditMinimum - plan.degreeTotal));
	let extraTargetCredits = $derived(Math.max(0, plan.creditTarget - plan.creditMinimum));
	let progress = $derived(
		plan.creditTarget > 0 ? Math.min(100, (plan.totalPlacedCredits / plan.creditTarget) * 100) : 0
	);

	// one programme's breakdown open at a time
	let openProg = $state<string | null>(null);

	const tally = (done: number, needed: number) => `${done >= needed ? '✓ ' : ''}${done}/${needed} cr`;
</script>

<div class="section" data-degree-progress>
	<h3>degree progress</h3>

	<div class="stats">
		<details class="requirements" class:over-limit={overLimit > 0}>
			<summary class="credit-summary">
				<span class="total">
					<span>
						<span class="credit-label"
							>planned credits<span class="requirements-chevron" aria-hidden="true"></span></span
						>
						<span class="credit-count"><b>{plan.totalPlacedCredits}</b><span> / {plan.creditTarget} cr</span></span>
					</span>
					<span class="remaining">
						<b>{overLimit || creditsLeft}</b>
						<span>{overLimit ? 'over limit' : 'left to plan'}</span>
					</span>
				</span>
				<span
					class="credit-track"
					role="progressbar"
					aria-label="Planned degree credits"
					aria-valuemin={0}
					aria-valuemax={plan.creditTarget}
					aria-valuenow={Math.min(plan.totalPlacedCredits, plan.creditTarget)}
					aria-valuetext={`${plan.totalPlacedCredits} of ${plan.creditTarget} credits planned`}
				>
					<span style:width={`${progress}%`}></span>
				</span>
				<span class="credit-caption">
					{#if overLimit}
						Your degree allows up to {plan.creditCeiling} credits.
					{:else if plan.creditsConflict}
						Requirements exceed the credit limit. Review with your mentor.
					{:else if creditsLeft}
						{creditsLeft % 4 ? 'About ' : ''}{Math.ceil(creditsLeft / 4)} more 4-credit {creditsLeft <= 4
							? 'course'
							: 'courses'}
					{:else}
						Credit {plan.creditTargetMode === 'maximum' ? 'target' : 'minimum'} met. Check requirements below.
					{/if}
				</span>
			</summary>
			<div class="requirements-content">
				<dl>
					<div class="row">
						<dt>KCCS</dt>
						<dd>{CORE_CREDITS} cr</dd>
					</div>
					{#each plan.stats as s (s.role + s.subject)}
						<div class="row">
							<dt>{s.label}{s.subject === 'open' ? '' : ` ${s.role}`}</dt>
							<dd>{s.totalCredits} cr</dd>
						</div>
					{/each}
					{#if additionalCredits}
						<div class="row">
							<dt>Additional courses</dt>
							<dd>{additionalCredits} cr</dd>
						</div>
					{/if}
					<div class="row requirement-total">
						<dt>Degree minimum</dt>
						<dd>{plan.creditMinimum} cr</dd>
					</div>
					{#if extraTargetCredits}
						<div class="row">
							<dt>Extra to your target</dt>
							<dd>{extraTargetCredits} cr</dd>
						</div>
					{/if}
					{#if plan.creditCeiling !== plan.creditMinimum}
						<div class="row">
							<dt>Credit limit</dt>
							<dd>{plan.creditCeiling} cr</dd>
						</div>
					{/if}
				</dl>
			</div>
		</details>

		<div class="programmes">
			<div class="row foundation"><span>KCCS planned</span><b>{tally(coreDone, CORE_CREDITS)}</b></div>

			{#each plan.stats as s (s.role + s.subject)}
				{@const key = s.role + s.subject}
				{@const open = openProg === key}
				{@const electives = s.subject === 'open' ? 'free courses' : 'electives'}
				<div class="prog" class:open>
					<button class="toggle" aria-expanded={open} onclick={() => (openProg = open ? null : key)}>
						<span class="name"
							><span>{s.label}</span><span class="muted">{s.role}<span class="chev" aria-hidden="true"></span></span
							></span
						>
						<!-- required and elective credits on one bar, split where one hands over -->
						<Progress
							required={{ done: s.requiredDone, needed: s.requiredNeeded }}
							elective={{ done: s.electiveDone, needed: s.electiveNeeded }}
							electiveLabel={electives}
							hue={plan.hueFor(s.subject)}
						/>
					</button>
					{#if open}
						<div class="detail" transition:slide={{ duration: reducedMotion() ? 0 : 210, easing: cubicOut }}>
							{#if s.requiredNeeded > 0}
								<div class="row"><span>required</span><b>{tally(s.requiredDone, s.requiredNeeded)}</b></div>
							{/if}
							{#if s.electiveNeeded > 0}
								<div class="row"><span>{electives}</span><b>{tally(s.electiveDone, s.electiveNeeded)}</b></div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.section {
		@include rail-section;
	}

	.stats {
		padding: 0.5rem var(--panel-gutter) var(--panel-gutter);
		font-size: var(--text-body);
		line-height: 1.5;
	}

	// two cards: the credit total with its breakdown, and the programme bars
	.requirements,
	.programmes {
		background: var(--color-bg-light);
		border: 1px solid var(--color-border-card);
		border-radius: 8px;
	}

	.requirements:has(> .credit-summary:hover) {
		border-color: var(--color-accent);
	}

	.programmes {
		margin-top: var(--card-gap);
		padding: var(--card-pad);
	}

	.credit-summary {
		display: block;
		container-type: inline-size;
		padding: var(--card-pad);
		border-radius: inherit;
		list-style: none;
		cursor: pointer;

		&::-webkit-details-marker {
			display: none;
		}

		&:focus-visible {
			outline: 2px solid var(--color-accent);
			outline-offset: 1px;
		}
	}

	.total {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		font-variant-numeric: tabular-nums;
	}

	.credit-label,
	.remaining span {
		display: block;
		font-size: 1.2rem;
		color: var(--color-text-muted);
	}

	.credit-label {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.credit-count {
		display: block;
		margin-top: 0.2rem;
		white-space: nowrap;
		line-height: 1.2;

		b {
			font-size: 3rem;
			font-weight: 650;
			letter-spacing: -0.04em;
		}

		span {
			font-size: 1.3rem;
			color: var(--color-text-muted);
		}
	}

	.remaining {
		text-align: right;
		white-space: nowrap;

		b {
			display: block;
			font-size: 1.8rem;
			font-weight: 600;
			line-height: 1.3;
		}
	}

	@container (max-width: 18rem) {
		.total {
			flex-wrap: wrap;
			gap: 0.6rem;
		}

		.remaining {
			display: flex;
			align-items: baseline;
			gap: 0.4rem;
			text-align: left;

			b {
				font-size: 1.3rem;
			}
		}
	}

	.credit-track {
		display: block;
		height: 0.6rem;
		margin-top: 0.8rem;
		overflow: hidden;
		background: var(--color-subtle);
		border-radius: 3px;

		span {
			display: block;
			height: 100%;
			background: var(--color-accent);
			border-radius: inherit;
			transition: width 0.3s var(--ease-out);
		}
	}

	.credit-caption {
		display: block;
		margin-top: 0.5rem;
		font-size: 1.2rem;
		color: var(--color-text-muted);
	}

	.over-limit {
		border-color: var(--color-danger);

		.remaining,
		.remaining span,
		.credit-caption {
			color: var(--color-danger);
		}

		.credit-track span {
			background: var(--color-danger);
		}
	}

	.foundation {
		gap: 0.6rem;
		font-size: 1.25rem;
	}

	.requirements {
		font-size: 1.25rem;

		&[open]:not(:global([data-closing])) .requirements-chevron {
			transform: rotate(45deg);
		}
	}

	.requirements-chevron {
		flex: none;
		width: 0.7rem;
		height: 0.7rem;
		margin-right: 0.3rem;
		border-right: 1.5px solid currentColor;
		border-bottom: 1.5px solid currentColor;
		transform: rotate(-45deg);
		transition: transform 0.2s var(--ease-out);
	}

	.requirements-content {
		margin: 0 var(--card-pad);
		padding: 0.8rem 0 var(--card-pad);
		border-top: 1px solid var(--color-border-divider);

		dl {
			display: grid;
			gap: 0.6rem;
			margin: 0;
		}

		dd {
			flex-shrink: 0;
			margin: 0;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
			color: var(--color-text);
		}
	}

	.requirement-total {
		margin-top: 0.2rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--color-border-card);
		font-weight: 600;
		color: var(--color-text);
	}

	@media (prefers-reduced-motion: reduce) {
		.credit-track span,
		.requirements-chevron {
			transition: none;
		}
	}

	.prog {
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px dotted var(--color-border-light);
	}

	.toggle {
		display: block;
		width: 100%;
		padding: 0;
		font: inherit;
		text-align: left;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}

	// subject on the left, its role pushed to the right edge
	.name {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
		font-weight: 700;

		.muted {
			display: inline-flex;
			align-items: center;
			gap: 0.6rem;
		}

		.toggle:hover & > span:first-child {
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}

	.muted {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.chev {
		@include fold-chevron;
		margin: -0.2rem 0 0;
	}

	// under the bar: one line per part, done of needed. the courses still to
	// place are named in the hints, not twice here
	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.6rem;
		font-size: 1.25rem;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: var(--color-text-muted);

		b {
			font-weight: 600;
			color: var(--color-text);
			font-variant-numeric: tabular-nums;
		}
	}
</style>

<script lang="ts">
	// the courses placed in one trimester. a list component rather than one
	// per chip because animate:flip only works directly inside a keyed each;
	// the chips render straight into the cell, which lays them out.
	import { flip } from 'svelte/animate';
	import { byCode, isAttemptId, isCore } from '$lib/curriculum/data';
	import { runRecord, runText } from '$lib/planner/board/views';
	import { usePlan } from '$lib/planner/context';
	import { courseIn, courseOut, courseShift } from '$lib/ui/transitions';
	import type { TrimNum } from '$lib/types';
	import { useBoard } from '$lib/planner/board/boardState.svelte';

	let {
		year,
		trim,
		codes,
		touchLayout = false
	}: { year: number; trim: TrimNum; codes: string[]; touchLayout?: boolean } = $props();
	const plan = usePlan();
	const board = useBoard();

	let key = $derived(`${year}-${trim}`);

	// what-if: a course that would stop or start counting under the degree tried
	function change(code: string): 'stops' | 'starts' | null {
		if (plan.view !== 'whatif' || isCore(code) || isAttemptId(code)) return null;
		const now = plan.courseType(code) !== 'other';
		const then = plan.whatIfType(code) !== 'other';
		return now === then ? null : now ? 'stops' : 'starts';
	}

	function title(code: string) {
		const kind = isAttemptId(code) ? ' (failed attempt)' : plan.attemptsOf(code).length ? ' (retake)' : '';
		return `${plan.courseLabel(code)}${kind}, ${plan.roleLabel(code)}`;
	}
</script>

{#each codes as code, i (code)}
	<!-- what-if reads every chip as the tried degree would -->
	{@const attempt = isAttemptId(code)}
	{@const type = plan.view === 'whatif' && !attempt ? plan.whatIfType(code) : plan.courseType(code)}
	{@const run = plan.view === 'runs' && !attempt ? runRecord(code, trim) : null}
	{@const shift = change(code)}
	{@const grade = plan.gradeOf(code)}
	<div
		class="chip"
		class:faded={(!!board.chain && !board.chain.nodes.has(code)) || (!!board.spotCodes && !board.spotCodes.has(code))}
		class:chain-root={board.chain?.root === code}
		class:lit={board.spotCodes?.has(code) ||
			!!board.chain?.nodes.has(code) ||
			(plan.selectedId ?? plan.selected?.code) === code}
		class:is-audit={plan.isAudit(code)}
		class:is-attempt={attempt}
		class:retake={!attempt && plan.attemptsOf(code).length > 0}
		class:titled={plan.showTitles}
		class:dragging={plan.dragging === code}
		data-code={code}
		data-type={type}
		style:order={board.drag.order(key, codes, code, i)}
		style:--hue={plan.view === 'whatif' ? plan.whatIfHue(code) : plan.hueOf(code)}
		draggable={!touchLayout && !attempt}
		role="listitem"
		animate:flip={courseShift}
		in:courseIn={{ key: code }}
		out:courseOut={{ key: code }}
		ondragstart={(e) => board.drag.start(e, code)}
		ondragend={() => (plan.dragging = null)}
	>
		<button
			class="open"
			aria-label="view {plan.courseLabel(code)}"
			title={title(code)}
			onclick={(e) => {
				e.stopPropagation();
				plan.select(code);
				if (plan.view === 'prereqs' && !attempt) board.chainRoot = code;
			}}
		>
			<!-- a failed attempt wears its U always, grade view or not -->
			{#if grade && (attempt || (plan.gradeMode && plan.showGradeLabels))}
				<span class="grade" class:fail={grade === 'U'}>{grade}</span>
			{/if}
			<!-- named in a hint: that hint's severity mark leads, the way a
			     required course leads with its dot -->
			{#if plan.flagKinds.has(code)}
				<span
					class="flag"
					data-kind={plan.flagKinds.get(code)}
					role="img"
					aria-label="named in a hint"
					title="named in a hint, see hints"
				></span>
			{/if}
			{#if type === 'required'}<span class="req-dot" role="img" aria-label="required"></span>{/if}
			<span class="label">
				{#if plan.showCodes}<b class="code">{plan.shownCode(code)}</b
					>{/if}{#if byCode(code).codes.length > 1}{@const also = byCode(code).codes.filter(
						(x) => x !== plan.shownCode(code)
					)}<span
						class="xlist"
						role="img"
						aria-label="cross-listed as {also.join(', ')}"
						title="cross-listed as {also.join(', ')}">⇄</span
					>{/if}{#if plan.showCodes && plan.showTitles}{' · '}{/if}{#if plan.showTitles}{byCode(code).title}{:else}<span
						class="phone-title">{byCode(code).title}</span
					>{/if}
			</span>
			<!-- each view's mark: how often it ran, whether it'd still count -->
			{#if run}
				<span
					class="run-mark"
					data-kind={run.kind}
					role="img"
					aria-label={runText(code, trim)}
					title={runText(code, trim)}
				></span>
			{/if}
			{#if shift}
				{@const said = shift === 'stops' ? 'would stop counting' : 'would start counting'}
				<span class="wi-mark" data-change={shift} role="img" aria-label={said} title={said}
					>{shift === 'stops' ? '−' : '+'}</span
				>
			{/if}
		</button>
		<button
			class="x"
			aria-label="remove {plan.courseLabel(code)}"
			onclick={(e) => {
				e.stopPropagation();
				plan.remove(code);
			}}>×</button
		>
	</div>
{/each}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.chip {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		height: fit-content;
		overflow: hidden; // nothing spills past the rounded corners
		// the right padding keeps the × in the same spot on every chip
		padding: 0.7rem 2.2rem 0.7rem 1rem;
		font-size: 1.3rem;
		border-radius: 5px; // a touch rounder, so the shine reads as a curved face
		cursor: grab;
		transition:
			transform 0.15s ease,
			opacity 0.15s ease,
			box-shadow 0.15s ease;
		@include course-type-fill;
		@include card-shine;

		&:hover {
			transform: translateY(-1px);
			@include card-shine-hover;
		}

		&:active {
			cursor: grabbing;
			transform: scale(0.97);
		}

		// titles on: each chip takes its own row so the title can wrap
		&.titled {
			flex-basis: 100%;

			.label {
				white-space: normal;
			}
		}

		// an in-flight drag leaves its outline behind, so you can see where it
		// came from and where it snaps back to if the drop is cancelled
		&.dragging {
			transform: none;
			background: color-mix(in srgb, var(--color-board-text) 6%, transparent);
			border: 1px dashed color-mix(in srgb, var(--color-board-text) 60%, transparent);
			box-shadow: none;

			> * {
				visibility: hidden;
			}
		}

		// what a pointed-at hint or colour names stands out by everything else
		// stepping back; a course's prerequisite chain is only outlined
		&.faded {
			opacity: 0.3;
		}

		// a soft edge: on its own for a prerequisite chain, beside the dimming for a hint
		&.lit {
			outline: 2px solid color-mix(in srgb, var(--color-board-text) 35%, transparent);
			outline-offset: 2px;
		}

		// the chain's start has to stand apart from the rest of the chain
		&.chain-root {
			box-shadow:
				0 0 0 2px var(--color-accent),
				var(--shadow-card);
		}

		// placed again after a failed attempt
		&.retake .code::after {
			content: ' ↻';
			font-weight: 400;
		}
	}

	.open {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		gap: 0.4rem;
		padding: 0;
		font: inherit;
		text-align: left;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;

		// the whole chip opens the course, padding and all; a click there used
		// to fall through to the cell and zoom the trimester instead
		&::before {
			content: '';
			position: absolute;
			inset: 0;
		}
	}

	.flag {
		@include severity-mark;
	}

	.req-dot {
		@include required-dot;
	}

	.label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	// cross-listed under other departments: a small quiet mark after the code
	.xlist {
		margin: 0 0.15rem 0 0.3rem;
		font-size: 0.85em;
		font-weight: 400;
		opacity: 0.55;
	}

	// the code reads first, a touch bolder than the title beside it
	.code {
		font-weight: 650;
	}

	.phone-title {
		display: none;
	}

	// a fixed-size capsule, so every grade (A+, B, U) is the same width and
	// the chip never bulks up when one is entered. lowkey; red for a U
	.grade {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.9rem;
		padding: 0 0.4rem;
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.4;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		background: var(--color-bg-light);
		border: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
		border-radius: 999px;

		&.fail {
			color: var(--color-danger);
			border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
		}
	}

	.run-mark {
		@include run-mark;
	}

	.wi-mark {
		@include whatif-mark;
	}

	.x {
		position: absolute;
		top: 50%;
		right: 0.3rem;
		z-index: 1;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		font-size: 1.4rem;
		line-height: 1;
		color: inherit; // the card's ink, like its text
		background: none;
		border: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: transform 0.2s var(--spring);

		&:hover {
			transform: translateY(-50%) scale(1.1);
		}
	}

	@include touch {
		// visible without a hover, its touch area reaching past the glyph on
		// the desktop columns (a phone's row has room for a full-size one)
		.x {
			opacity: 0.7;
		}

		@media (min-width: 768px) {
			.x::before {
				content: '';
				position: absolute;
				inset: -0.9rem -0.5rem;
			}
		}
	}

	// phones: one slim row per course, code then title, cut short with an
	// ellipsis (the details have it in full), the × as a full-height target
	@include mobile {
		.chip,
		.chip.titled {
			flex-basis: 100%;
			width: 100%;
			max-width: 100%;
			padding: 0 0 0 0.9rem;
		}

		.open {
			min-height: 3.8rem;
			font-size: 1.4rem;
		}

		.label {
			white-space: nowrap;
		}

		.phone-title {
			display: inline;
			margin-left: 0.6rem;
			font-weight: 400;
		}

		.x {
			position: static;
			flex-shrink: 0;
			transform: none;
			min-width: 3.8rem;
			min-height: 3.8rem;
			opacity: 1;

			&:hover {
				transform: none;
			}
		}
	}
</style>

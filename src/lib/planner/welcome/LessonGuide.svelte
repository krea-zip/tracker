<script lang="ts">
	// what sits beside the miniature on a playground step: the part it's about,
	// one line on what that part is, and a few quests, ticked off by the frame
	// as they happen. the quest at hand says how; pointing at any quest rings
	// its target in the miniature. once they're all done, a word of praise.
	import { fly, scale, slide } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { reducedMotion } from '$lib/ui/transitions';
	import { emphasised, type LessonInfo } from './lessons';

	let {
		lesson,
		index,
		total,
		done,
		next,
		onpoint,
		onreset
	}: {
		lesson: LessonInfo;
		index: number;
		total: number;
		done: string[];
		/** the step after this one, named in the praise */
		next: string | null;
		onpoint: (task: string | null) => void;
		onreset: () => void;
	} = $props();

	let finished = $derived(lesson.tasks.filter((t) => done.includes(t.id)).length);
	let current = $derived(lesson.tasks.find((t) => !done.includes(t.id))?.id);
	let complete = $derived(finished === lesson.tasks.length);
	let last = $derived(index === total);

	const motion = (ms: number) => (reducedMotion() ? 0 : ms);
	const arrive = () => ({ y: 8, duration: motion(240), easing: cubicOut });
</script>

{#snippet words(text: string)}
	{#each emphasised(text) as part, i (i)}{#if part.bold}<b>{part.words}</b>{:else}{part.words}{/if}{/each}
{/snippet}

<section class="guide" class:complete aria-label="practice step {index} of {total}: {lesson.title}">
	{#key lesson.id}
		<div class="body" in:fly={arrive()}>
			<header>
				<p class="kicker">practice · {index} of {total}</p>
				<h3>{lesson.title}</h3>
				<p class="intro">{@render words(lesson.intro)}</p>
			</header>

			<div class="quests">
				<div class="heading">
					<h4>{last ? 'finish it' : 'try it'}</h4>
					<span class="tally" role="status" aria-label="{finished} of {lesson.tasks.length} done"
						>{finished}/{lesson.tasks.length}</span
					>
				</div>
				<ol>
					{#each lesson.tasks as task (task.id)}
						{@const ticked = done.includes(task.id)}
						{@const here = task.id === current}
						<!-- pointing only shows where it is; nothing here needs a click -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<li class:ticked class:here onmouseenter={() => onpoint(task.id)} onmouseleave={() => onpoint(null)}>
							<input type="checkbox" checked={ticked} disabled aria-label={ticked ? 'done' : 'not done yet'} />
							<div class="words">
								<span class="title">{@render words(task.title)}</span>
								{#if here}
									<span class="how" transition:slide={{ duration: motion(200), easing: cubicOut }}
										>{@render words(task.how)}</span
									>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			</div>

			{#if complete}
				<div class="praise" in:scale={{ start: 0.92, duration: motion(420), easing: backOut }}>
					<span class="badge" aria-hidden="true">
						{#if !reducedMotion()}
							<span class="burst"
								>{#each { length: 8 } as _, i (i)}<i style:--i={i}></i>{/each}</span
							>
						{/if}
						{last ? '★' : '✓'}
					</span>
					<div>
						<p>{@render words(lesson.praise)}</p>
						<p class="next">{next ? `next up: ${next} →` : 'next up: your own plan →'}</p>
					</div>
				</div>
			{/if}
		</div>
	{/key}

	<footer class="foot">
		<span>pretend courses, nothing saved</span>
		<button onclick={onreset}>↺ start over</button>
	</footer>
</section>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.guide {
		--quest-done: var(--color-hint-good-deep);
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: var(--color-bg-light);
	}

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2.2rem;
		min-height: 0;
		padding: 2.4rem 2.2rem 1.6rem;
		overflow-y: auto;
	}

	.kicker {
		@include section-label;
		font-size: 1.1rem;
		color: var(--color-accent);
	}

	h3 {
		margin-top: 0.4rem;
		font-size: 2.6rem;
		font-weight: 700;
		line-height: 1.15;
		color: var(--color-text);
	}

	.intro {
		margin-top: 0.8rem;
		font-size: 1.35rem;
		line-height: 1.5;
		color: var(--color-text-muted);

		b {
			font-weight: 700;
			color: var(--color-text);
		}
	}

	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.8rem;

		h4 {
			@include section-label;
			font-size: 1.1rem;
		}
	}

	.tally {
		font-size: 1.2rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		transition: color 0.2s ease;

		.complete & {
			color: var(--quest-done);
		}
	}

	ol {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
	}

	li {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 0.9rem 1rem;
		margin-inline: -1rem;
		border: 1px solid transparent;
		border-radius: 8px;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;

		// a thread from each box down to the next, so the quests read as one
		// path; it turns solid green behind a quest that's done
		&:not(:last-child)::after {
			content: '';
			position: absolute;
			left: calc(1.8rem - 0.75px);
			top: 3rem;
			bottom: -1rem;
			border-left: 1.5px dotted var(--color-border-card);
		}

		&.ticked:not(:last-child)::after {
			border-left-style: solid;
			border-color: var(--quest-done);
		}

		// the one to do next, in the accent its target is ringed with
		&.here {
			background: color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-light));
			border-color: color-mix(in srgb, var(--color-accent) 32%, transparent);
		}
	}

	input {
		@include tick(1.6rem);
		margin-top: 0.1rem;
		border-radius: 50%;
		cursor: default;
		pointer-events: none;

		// done is green here: the colour every finished step wears
		&:checked {
			background-color: var(--quest-done);
			border-color: color-mix(in srgb, var(--quest-done) 70%, black);
			animation: pop 0.35s var(--spring);
		}
	}

	@keyframes pop {
		0% {
			transform: scale(0.6);
		}
		100% {
			transform: none;
		}
	}

	.words {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.title {
		font-size: 1.4rem;
		font-weight: 650;
		line-height: 1.3;
		color: var(--color-text-muted);
		transition: color 0.2s ease;

		.here & {
			color: var(--color-text);
		}

		.ticked & {
			color: var(--color-text-muted);
			font-weight: 500;
		}
	}

	.how {
		font-size: 1.3rem;
		line-height: 1.45;
		color: var(--color-text-muted);

		b {
			font-weight: 700;
			color: var(--color-text);
		}
	}

	.praise {
		display: flex;
		align-items: flex-start;
		gap: 1.2rem;
		padding: 1.2rem 1.4rem;
		font-size: 1.3rem;
		line-height: 1.45;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-hint-good) 70%, var(--color-bg-light));
		border: 1px solid var(--color-hint-good-deep);
		border-radius: 8px;
		transform-origin: 50% 0;

		b {
			font-weight: 700;
		}

		.next {
			margin-top: 0.4rem;
			font-weight: 650;
			color: var(--color-text-muted);
		}
	}

	.badge {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-bg-light);
		background: var(--quest-done);
		border-radius: 50%;
	}

	// a small pop of confetti off the badge, once
	.burst {
		position: absolute;
		inset: 0;
	}

	.burst i {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.5rem;
		height: 0.5rem;
		margin: -0.25rem;
		background: var(--quest-done);
		border-radius: 50%;
		opacity: 0;
		animation: burst 0.7s var(--ease-out) 0.08s;

		&:nth-child(even) {
			background: var(--color-accent);
		}
	}

	@keyframes burst {
		0% {
			opacity: 1;
			transform: rotate(calc(var(--i) * 45deg)) translateY(0);
		}
		100% {
			opacity: 0;
			transform: rotate(calc(var(--i) * 45deg)) translateY(-2.4rem);
		}
	}

	.foot {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.2rem 2.2rem;
		font-size: 1.15rem;
		color: var(--color-text-muted);
		border-top: 1px solid var(--color-border-divider);

		button {
			flex: none;
			padding: 0.2rem 0.4rem;
			margin-right: -0.4rem;
			font: inherit;
			color: var(--color-text-muted);
			background: none;
			border: 0;
			border-radius: 4px;
			cursor: pointer;

			&:hover {
				color: var(--color-accent);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		input:checked {
			animation: none;
		}
	}
</style>

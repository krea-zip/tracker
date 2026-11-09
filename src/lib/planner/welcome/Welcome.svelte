<script lang="ts">
	// Set up the real suggested plan, then a tiny practice planner that walks
	// through the planner one part at a time, in the order a student meets it.
	import { onMount } from 'svelte';
	import { STUDENT_BATCHES } from '$lib/curriculum/data';
	import { usePlan } from '$lib/planner/context';
	import Modal from '$lib/ui/Modal.svelte';
	import SuggestedPlan from './SuggestedPlan.svelte';
	import { DegreeAnswers } from './answers.svelte';
	import DegreePicker from './DegreePicker.svelte';
	import Practice from './Practice.svelte';
	import LessonGuide from './LessonGuide.svelte';
	import { LESSONS, lessonById, type Lesson } from './lessons';

	let { ondone }: { ondone: (finished: boolean) => void } = $props();
	const plan = usePlan();
	const answers = new DegreeAnswers(plan);
	const LENGTHS = [
		{ four: false, label: '3 years' },
		{ four: true, label: '4 years' }
	];
	const SETUP = [
		{ id: 'start' as const, title: 'let’s set up your plan', label: 'your batch' },
		{ id: 'degree' as const, title: 'what are you studying?', label: 'your degree' },
		{ id: 'route' as const, title: 'your suggested plan', label: 'suggested plan' }
	];
	let windows = $derived([...SETUP, ...LESSONS]);
	let at = $state(0);
	let furthest = $state(0); // the last step reached, which the steps can jump back to
	let current = $derived(windows[at]);
	let last = $derived(at === windows.length - 1);
	let waiting = $derived(
		(current.id === 'start' && !answers.answered.batch) || (current.id === 'degree' && !answers.ready)
	);
	let lesson = $derived(lessonById(current.id));
	let nextLesson = $derived(lesson ? (LESSONS[LESSONS.indexOf(lesson) + 1] ?? null) : null);

	// the playground's quests, as its frame reports them
	let done = $state<string[]>([]);
	let pointedAt = $state<string | null>(null);
	const lessonFinished = (id: string) => !!lessonById(id)?.tasks.every((t) => done.includes(t.id));
	let practice = $state<ReturnType<typeof Practice>>();

	// the frame loads behind the setup steps, so it's up by the time it's needed
	let frameWanted = $derived(furthest >= 1);
	// the step it shows while it waits, and the one it stays on once it's out of sight
	let shownLesson = $state<Lesson>('grid');
	$effect(() => {
		if (lesson) shownLesson = lesson.id as Lesson;
	});

	function goTo(step: number) {
		at = step;
		furthest = Math.max(furthest, step);
		pointedAt = null;
	}

	const go = (by: 1 | -1) => goTo(at + by);

	// back over ground already covered, and freely around the playground once in it
	const canJump = (step: number) => step !== at && (step <= furthest || (at >= SETUP.length && step >= SETUP.length));

	let goLabel = $derived.by(() => {
		if (last) return 'start planning →';
		if (current.id === 'start') return 'next';
		if (current.id === 'degree') return 'see my suggested plan';
		if (current.id === 'route') return 'try the practice planner →';
		return `next: ${nextLesson?.label} →`;
	});

	// skipped before answering: the board can't stay empty, so it gets the path
	// for the defaults, the same as a visit that never saw the welcome
	function skip() {
		if (!answers.ready) plan.seedRecommended();
		ondone(false);
	}

	onMount(() => {
		plan.placements = {};
		plan.welcoming = true;
		return () => (plan.welcoming = false);
	});
</script>

<Modal
	title="welcome to tracker"
	width={lesson ? '148rem' : current.id === 'route' ? '92rem' : '64rem'}
	height={lesson ? '90rem' : undefined}
	dismiss="skip"
	flush
	onclose={skip}
>
	<div class="window" class:lesson={!!lesson}>
		{#if lesson}
			<LessonGuide
				{lesson}
				index={at - SETUP.length + 1}
				total={LESSONS.length}
				{done}
				next={nextLesson?.label ?? null}
				onpoint={(task) => (pointedAt = task)}
				onreset={() => practice?.reset()}
			/>
		{:else}
			<div class="page">
				<h3>{current.title}</h3>
				{#if current.id === 'start'}
					<p class="lede">two quick questions, then a tiny practice planner to learn the controls.</p>
					<p class="ask">when did you start?</p>
					<div class="keys" role="group" aria-label="batch">
						{#each STUDENT_BATCHES as year (year)}
							{@const on = answers.answered.batch && plan.batchStartYear === year}
							<button class:on aria-pressed={on} onclick={() => answers.setBatch(year)}>{year}</button>
						{/each}
					</div>
					<p class="ask">how long is your degree?</p>
					<div class="keys" role="group" aria-label="degree length">
						{#each LENGTHS as { four, label } (label)}
							{@const on = plan.fourYear === four}
							<button class:on aria-pressed={on} onclick={() => answers.setFourYear(four)}>{label}</button>
						{/each}
					</div>
				{:else if current.id === 'degree'}
					<p class="lede">pick your major, then add any other programmes you’re taking.</p>
					<DegreePicker {answers} />
				{:else if current.id === 'route'}
					<p class="lede">
						your department’s suggested order, already on your grid. it’s a starting point: change anything, any time.
						next, a two-minute practice: fix a pretend plan, and meet every part of tracker on the way.
					</p>
					<SuggestedPlan />
				{/if}
			</div>
		{/if}
		{#if frameWanted}
			<Practice
				bind:this={practice}
				lesson={shownLesson}
				active={!!lesson}
				point={pointedAt}
				onprogress={(list) => (done = list)}
			/>
		{/if}
	</div>

	<div class="nav">
		<div class="side">
			{#if at > 0}<button class="back" onclick={() => go(-1)}>← back</button>{/if}
		</div>

		{#if lesson}
			<!-- the practice planner's parts, in order: ticked once done, any one a click away -->
			<ol class="track" aria-label="practice steps">
				{#each LESSONS as l, i (l.id)}
					{@const step = SETUP.length + i}
					<li>
						<button
							class:here={step === at}
							class:finished={lessonFinished(l.id)}
							disabled={!canJump(step)}
							aria-current={step === at ? 'step' : undefined}
							onclick={() => goTo(step)}
						>
							<span class="pip" aria-hidden="true"></span>{l.label}
						</button>
					</li>
				{/each}
			</ol>
		{:else}
			<ol class="steps" aria-label="welcome steps">
				{#each windows as w, i (w.id)}
					<li class:break={i === SETUP.length}>
						<button
							class:here={i === at}
							class:reached={i <= furthest}
							disabled={!canJump(i)}
							aria-current={i === at ? 'step' : undefined}
							aria-label={w.label}
							title={w.label}
							onclick={() => goTo(i)}
						></button>
					</li>
				{/each}
			</ol>
		{/if}

		<div class="side end">
			<button
				data-next
				class="go"
				class:nudge={!!lesson && lessonFinished(current.id)}
				disabled={waiting}
				onclick={() => (last ? ondone(true) : go(1))}>{goLabel}</button
			>
		</div>
	</div>
</Modal>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// the card's one body: a setup page, or a guide beside the miniature. the
	// frame stays in here on the setup pages too, out of sight, so it's clipped
	.window {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;

		&.lesson {
			display: grid;
			grid-template-columns: 30rem minmax(0, 1fr);
		}

		&.lesson :global(.host) {
			border-left: 1px solid var(--color-border-card);
		}
	}

	.page {
		max-height: 100%;
		overflow-y: auto;
		padding: 2.4rem 2.4rem 2.8rem;
	}

	h3 {
		font-size: 2.4rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--color-text);
	}

	.lede {
		margin: 0.8rem 0 1.6rem;
		font-size: 1.35rem;
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	.ask {
		margin: 2.2rem 0 0.8rem;
		font-size: 1.3rem;
		font-weight: 650;
		color: var(--color-text);
	}

	// plain flat keys, the whole row one question
	.keys {
		display: flex;
		gap: 0.7rem;

		button {
			flex: 1;
			min-height: 4.4rem;
			padding: 0 0.6rem;
			font: inherit;
			font-size: 1.4rem;
			font-variant-numeric: tabular-nums;
			color: var(--color-text);
			background: var(--color-bg-light);
			border: 1px solid var(--color-border-card);
			border-radius: 8px;
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease,
				box-shadow 0.15s ease,
				transform 0.18s var(--spring);

			&:hover {
				border-color: var(--color-accent);
			}

			&:active {
				transform: scale(0.97);
			}

			&.on {
				font-weight: 700;
				background: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-light));
				border-color: var(--color-accent);
				box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 22%, transparent);
			}
		}
	}

	.nav {
		flex: none;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1.6rem;
		min-height: 6rem;
		padding: 1rem 1.8rem;
		border-top: 1px solid var(--color-border-divider);
	}

	.side {
		display: flex;
		align-items: center;

		&.end {
			justify-content: flex-end;
		}
	}

	.back {
		padding: 0.4rem 0;
		font: inherit;
		font-size: 1.3rem;
		color: var(--color-text-muted);
		background: none;
		border: 0;
		cursor: pointer;

		&:hover {
			color: var(--color-text);
		}
	}

	// the setup's steps: one dash each, the playground's apart after them
	.steps {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		list-style: none;

		li.break {
			margin-left: 0.9rem;
		}

		button {
			position: relative;
			display: block;
			width: 2.2rem;
			height: 0.6rem;
			padding: 0;
			background: color-mix(in srgb, var(--color-border-card) 70%, transparent);
			border: 0;
			border-radius: 999px;
			cursor: pointer;
			transition:
				background-color 0.2s ease,
				transform 0.18s var(--spring);

			// a bigger target than the dash that draws it
			&::before {
				content: '';
				position: absolute;
				inset: -0.9rem -0.2rem;
			}

			&:disabled {
				cursor: default;
			}

			&:not(:disabled):hover {
				transform: scaleY(1.5);
			}

			&.reached {
				background: color-mix(in srgb, var(--color-accent) 35%, var(--color-border-card));
			}

			&.here {
				background: var(--color-accent);
			}
		}
	}

	// the practice planner's parts by name, joined by a thread: a hollow pip
	// still to come, the accent for the one you're on, a green tick once done
	.track {
		display: flex;
		align-items: center;
		list-style: none;

		li + li::before {
			content: '';
			display: inline-block;
			width: 1.6rem;
			margin: 0 0.4rem;
			vertical-align: middle;
			border-top: 1.5px dotted var(--color-border-card);
		}

		li {
			display: flex;
			align-items: center;
		}

		button {
			display: flex;
			align-items: center;
			gap: 0.6rem;
			padding: 0.5rem 0.8rem;
			font: inherit;
			font-size: 1.25rem;
			white-space: nowrap;
			color: var(--color-text-muted);
			background: none;
			border: 1px solid transparent;
			border-radius: 999px;
			cursor: pointer;
			transition:
				color 0.15s ease,
				background-color 0.15s ease,
				border-color 0.15s ease;

			&:not(:disabled):hover {
				color: var(--color-text);
				background: var(--color-hover-medium);
			}

			&:disabled {
				cursor: default;
			}

			&.finished {
				color: var(--color-text);
			}

			&.here {
				font-weight: 700;
				color: var(--color-accent);
				background: color-mix(in srgb, var(--color-accent) 8%, transparent);
				border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
			}
		}
	}

	.pip {
		position: relative;
		flex: none;
		width: 1.2rem;
		height: 1.2rem;
		border: 1.5px solid var(--color-border-card);
		border-radius: 50%;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;

		.here & {
			background: var(--color-accent);
			border-color: var(--color-accent);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
		}

		// done: a filled green disc with a small tick cut into it
		.finished & {
			background: var(--color-hint-good-deep);
			border-color: var(--color-hint-good-deep);

			&::after {
				content: '';
				position: absolute;
				left: 0.3rem;
				top: 0.1rem;
				width: 0.3rem;
				height: 0.55rem;
				border: solid var(--color-bg-light);
				border-width: 0 1.5px 1.5px 0;
				transform: rotate(45deg);
			}
		}
	}

	.go {
		padding: 0.8rem 2.2rem;
		font: inherit;
		font-size: 1.4rem;
		font-weight: 700;
		white-space: nowrap;
		color: var(--color-on-accent);
		background-color: var(--color-accent);
		border: 1px solid var(--color-control-deep);
		border-radius: 6px;
		cursor: pointer;
		@include glossy-accent;

		&:hover {
			filter: brightness(1.07);
		}

		// every quest on a step is done: a little spring toward the next one,
		// and a soft glow until it's pressed
		&.nudge {
			animation:
				nudge 0.5s var(--spring),
				glow 1.8s ease-in-out 0.5s infinite;
		}

		// until every question asked has an answer
		&:disabled {
			opacity: 0.45;
			cursor: default;
			filter: none;
		}
	}

	@keyframes nudge {
		40% {
			transform: scale(1.06);
		}
	}

	@keyframes glow {
		0%,
		100% {
			box-shadow:
				var(--shadow-inset),
				0 0 0 0 color-mix(in srgb, var(--color-accent) 30%, transparent);
		}
		50% {
			box-shadow:
				var(--shadow-inset),
				0 0 0 5px color-mix(in srgb, var(--color-accent) 14%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.go.nudge {
			animation: none;
		}
	}
</style>

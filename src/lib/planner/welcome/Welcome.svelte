<script lang="ts">
	// Set up the real suggested plan, then teach one small interaction at a
	// time on disposable practice copies of the student's selected degree.
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
		{
			id: 'start' as const,
			title: 'make room for what’s next',
			label: 'your batch'
		},
		{
			id: 'degree' as const,
			title: 'what are you studying?',
			label: 'your degree'
		},
		{
			id: 'route' as const,
			title: 'your suggested plan',
			label: 'suggested plan'
		}
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
	let wholeLayout = $derived(current.id === 'together');

	// the playground's tasks, as its frame reports them
	let done = $state<string[]>([]);
	let pointedAt = $state<string | null>(null);
	const lessonFinished = (id: string) => !!lessonById(id)?.tasks.every((t) => done.includes(t.id));

	// the frame loads behind the setup steps, so it's up by the time it's needed
	let frameWanted = $derived(furthest >= 1);
	// the slide it shows while it waits, and the one it stays on once it's out of sight
	let shownLesson = $state<Lesson>('terms');
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
	width={lesson ? '148rem' : current.id === 'route' ? '92rem' : '68rem'}
	height={lesson ? '90rem' : undefined}
	dismiss="skip"
	flush
	onclose={skip}
>
	<div class="window" class:lesson={!!lesson} class:whole={wholeLayout}>
		{#if lesson}
			<LessonGuide
				{lesson}
				index={at - SETUP.length + 1}
				total={LESSONS.length}
				{done}
				strip={wholeLayout}
				onpoint={(task) => (pointedAt = task)}
			/>
		{:else}
			<div class="page">
				<h3>{current.title}</h3>
				{#if current.id === 'start'}
					<p class="lede">
						A little planning, a lot of possibilities. First, your starting point — then a tiny playground to learn by
						doing.
					</p>
					<div class="setup-note">
						<span>01 · your starting point</span><span>02 · your programmes</span><span>03 · play & explore</span>
					</div>
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
						Your department’s suggested order. Keep this as a starting point; you can change it later. Next, we’ll
						switch to a tiny pretend planner to try the controls.
					</p>
					<SuggestedPlan />
				{/if}
			</div>
		{/if}
		{#if frameWanted}
			<Practice lesson={shownLesson} active={!!lesson} point={pointedAt} onprogress={(list) => (done = list)} />
		{/if}
	</div>

	<div class="nav">
		{#if at > 0}<button class="back" onclick={() => go(-1)}>back</button>{/if}
		<ol class="steps" aria-label="welcome steps">
			{#each windows as w, i (w.id)}
				<li class:break={i === SETUP.length}>
					<button
						class:here={i === at}
						class:reached={i <= furthest}
						class:finished={lessonFinished(w.id)}
						disabled={!canJump(i) && i !== at}
						aria-current={i === at ? 'step' : undefined}
						aria-label={w.label}
						title={w.label}
						onclick={() => canJump(i) && goTo(i)}
					></button>
				</li>
			{/each}
		</ol>
		<span class="step-name">{current.label}</span>
		<button
			data-next
			class="go"
			class:nudge={!!lesson && lessonFinished(current.id)}
			disabled={waiting}
			onclick={() => (last ? ondone(true) : go(1))}
			>{last
				? 'start planning'
				: current.id === 'degree'
					? 'see my suggested plan'
					: current.id === 'start'
						? 'next'
						: current.id === 'route'
							? 'enter the playground →'
							: `next · ${windows[at + 1].label}`}</button
		>
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
			grid-template-columns: 31rem minmax(0, 1fr);
		}

		&.lesson :global(.host) {
			border-left: 1px solid var(--color-border-card);
		}

		// the last slide hands the miniature the full width of the card
		&.whole {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
		}

		&.whole :global(.host) {
			border-left: 0;
			border-top: 1px solid var(--color-border-card);
		}
	}

	.page {
		max-height: 100%;
		overflow-y: auto;
		padding: 1.8rem;
	}

	h3 {
		margin-bottom: 1rem;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.lede {
		margin-bottom: 1.2rem;
		font-size: 1.35rem;
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	.ask {
		margin: 1.8rem 0 0.7rem;
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.setup-note {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 1.2rem;
		border-block: 1px solid var(--color-border-card);
		color: var(--color-text-muted);
		font-size: 1.1rem;
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
			font-size: 1.35rem;
			color: var(--color-text);
			background: var(--color-bg-light);
			border: 1px solid var(--color-border-card);
			border-radius: 6px;
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease;

			&:hover {
				border-color: var(--color-accent);
			}

			&.on {
				font-weight: 700;
				background: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-light));
				border-color: var(--color-accent);
			}
		}
	}

	.nav {
		flex: none;
		display: flex;
		align-items: center;
		gap: 1.6rem;
		min-height: 6rem;
		padding: 1rem 1.8rem;
		border-top: 1px solid var(--color-border-divider);
	}

	// one dash per step; the setup and the playground sit apart
	.steps {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
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

			&.finished {
				background: var(--color-hint-good-deep);
			}

			&.here {
				background: var(--color-accent);
			}
		}
	}

	.step-name {
		margin-right: auto;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.back {
		padding: 0;
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

	.go {
		padding: 0.7rem 2.2rem;
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

		// a slide's tasks are all done: a little spring toward the next one
		&.nudge {
			animation: nudge 0.5s var(--spring);
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
			transform: scale(1.05);
		}
	}
</style>

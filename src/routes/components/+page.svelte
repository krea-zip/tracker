<script lang="ts">
	// the planner's own components, each on its own, drawn from one example
	// plan, with what each mark means written underneath. data-shot is what a
	// screenshot aims at, so the words never end up in the picture.
	import { onMount, tick } from 'svelte';
	import { providePlan } from '$lib/planner/context';
	import { BoardState, provideBoard } from '$lib/planner/board/boardState.svelte';
	import { nowHues } from '$lib/planner/hues';
	import { subjectById } from '$lib/curriculum/data';
	import PlanGrid from '$lib/planner/board/grid/PlanGrid.svelte';
	import CourseChips from '$lib/planner/board/grid/CourseChips.svelte';
	import Sidebar from '$lib/planner/sidebar/Sidebar.svelte';
	import DegreeProgress from '$lib/planner/sidebar/DegreeProgress.svelte';
	import Hints from '$lib/planner/sidebar/Hints.svelte';
	import DetailsPanel from '$lib/planner/details/DetailsPanel.svelte';
	import Catalogue from '$lib/planner/catalogue/Catalogue.svelte';
	import TrimesterZoom from '$lib/planner/board/TrimesterZoom.svelte';
	import SamplePlan from './SamplePlan.svelte';
	import { samplePlan } from './sample';

	const plan = providePlan(samplePlan());
	provideBoard(new BoardState(plan));

	let now = $derived(nowHues(plan.programmes, (s) => plan.hueFor(s) ?? subjectById(s).hue));

	const CHIPS = [
		{ id: 'core', code: 'KCCS101', says: 'KCCS, the foundation core, has its own colour.' },
		{ id: 'required', code: 'COMP217', says: 'A dot means required. Computer science is blue here.' },
		{ id: 'minor', code: 'MATH231', says: 'Each subject has its own colour. Mathematics is purple here.' },
		{ id: 'elective', code: 'COMP347', says: 'A bar on the left edge means elective.' },
		{ id: 'other', code: 'ECON201', says: 'A pale chip counts toward none of your programmes.' }
	];
	const MARKS = [
		{ id: 'warn', code: 'MATH202', says: 'A triangle is an error: something in the plan to fix.' },
		{ id: 'info', code: 'MATH230', says: 'A star is a hint: worth knowing, nothing to fix.' }
	];

	// the open states of the components, opened the way a student would
	let programme = $state<HTMLElement>();
	let breakdown = $state<HTMLElement>();
	let teacher = $state<HTMLElement>();
	let hints = $state<HTMLElement>();
	let term = $state<HTMLElement>();
	let course = $state<HTMLElement>();

	onMount(async () => {
		await tick();
		programme?.querySelector<HTMLElement>('.toggle')?.click();
		breakdown?.querySelector('details')?.setAttribute('open', '');
		teacher?.querySelector<HTMLElement>('.d-taught-head')?.click();
		hints?.querySelector<HTMLElement>('.notes-toggle')?.click();
		term?.querySelector('details.off-fold')?.setAttribute('open', '');
		term?.querySelector<HTMLElement>('input[value="away"]')?.click();
		[...(course?.querySelectorAll('details.d-disclosure') ?? [])].at(-1)?.setAttribute('open', '');
	});
</script>

<svelte:head>
	<title>components · tracker</title>
</svelte:head>

<div class="gallery" style:--now-a={now?.[0]} style:--now-b={now?.[1]}>
	<section>
		<h2>plan grid</h2>
		<div class="shot board" data-shot="grid"><PlanGrid /></div>
		<p>
			One row per year, one column per trimester. Each subject has its own colour, and a course takes the colour of the
			programme it counts toward. A dot means required and a bar on the left edge means elective. The outlined trimester
			is the current one, and a dashed border means a course there has a problem.
		</p>
	</section>

	<section>
		<h2>while dragging</h2>
		<div class="shot board" data-shot="grid-dragging"><SamplePlan lifted="COMP347"><PlanGrid /></SamplePlan></div>
		<p>
			While COMP347 is being dragged, only the trimesters it can go in turn green: it has to be offered then, open to
			that year, and placed after its prerequisites.
		</p>
	</section>

	<section>
		<h2>one trimester</h2>
		<div class="shot term" data-shot="term" bind:this={term}>
			<SamplePlan zoom={{ year: 2, trim: 2 }}>
				<div class="term-catalogue"><Catalogue /></div>
				<div class="term-board"><TrimesterZoom /></div>
			</SamplePlan>
		</div>
		<p>Clicking a trimester opens it on its own, and the catalogue shows only the courses offered that term.</p>
	</section>

	<section>
		<h2>course colours and marks</h2>
		<div class="keys">
			<div class="key">
				{#each CHIPS as chip (chip.code)}
					<div class="key-row">
						<div class="key-chip" data-shot="chip-{chip.id}"><CourseChips year={1} trim={1} codes={[chip.code]} /></div>
						<p>{chip.says}</p>
					</div>
				{/each}
			</div>
			<div class="key">
				{#each MARKS as mark (mark.id)}
					<div class="key-row">
						<div class="key-chip" data-shot="mark-{mark.id}"><CourseChips year={1} trim={1} codes={[mark.code]} /></div>
						<p>{mark.says}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section>
		<h2>your degree</h2>
		<div class="row">
			<figure>
				<div class="shot rail" data-shot="pickers"><Sidebar /></div>
				<figcaption>
					Batch, degree structure and programmes. Here, computer science with a mathematics minor.
				</figcaption>
			</figure>
			<figure>
				<div class="shot rail" data-shot="progress"><DegreeProgress /></div>
				<figcaption>
					The arrow on each bar marks the required credits: before it is required, after it is electives.
				</figcaption>
			</figure>
			<figure>
				<div class="shot rail" data-shot="progress-programme" bind:this={programme}><DegreeProgress /></div>
				<figcaption>Opening a programme splits its credits into required and electives.</figcaption>
			</figure>
			<figure>
				<div class="shot rail" data-shot="progress-breakdown" bind:this={breakdown}><DegreeProgress /></div>
				<figcaption>Opening planned credits shows how the degree total adds up.</figcaption>
			</figure>
		</div>
	</section>

	<section>
		<h2>course details</h2>
		<SamplePlan select="COMP210">
			<div class="row">
				<figure>
					<div class="shot course" data-shot="course" bind:this={course}><DetailsPanel canPin /></div>
					<figcaption>
						Everything about one course: credits, when it runs, its type, where it sits on the plan, what it needs first
						and what it leads to.
					</figcaption>
				</figure>
				<figure>
					<div class="shot course about" data-shot="course-teacher" bind:this={teacher}><DetailsPanel /></div>
					<figcaption>
						Contact &amp; teaching opens the lecturer's email, office number, office hours and recent courses.
					</figcaption>
				</figure>
			</div>
		</SamplePlan>
	</section>

	<section>
		<h2>hints and catalogue</h2>
		<div class="row">
			<figure>
				<div class="shot rail" data-shot="hints" bind:this={hints}><Hints /></div>
				<figcaption>
					Errors, warnings and hints, worst first. The same triangle, square or star appears on the course in the grid.
				</figcaption>
			</figure>
			<figure>
				<div class="shot catalogue" data-shot="catalogue"><Catalogue /></div>
				<figcaption>Every course, to search, filter and drag onto the grid.</figcaption>
			</figure>
		</div>
	</section>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// nothing but the components here
	:global(.top-strip) {
		display: none !important;
	}

	.gallery {
		// the "now" ring's colours, as in the planner
		--color-now: oklch(var(--now-l) var(--now-c) var(--now-a, var(--accent-hue)));
		--color-now-end: oklch(var(--now-l) var(--now-c) var(--now-b, var(--now-a, var(--accent-hue))));
		--rail-radius: 4px;
		--panel-gutter: var(--card-gap);
		display: flex;
		flex-direction: column;
		gap: 4rem;
		max-width: 136rem;
		margin: 0 auto;
		padding: 3.2rem 2.4rem 6.4rem;
		font-size: var(--text-body);
		line-height: 1.5;
		color: var(--color-text);
	}

	section {
		display: grid;
		gap: 1rem;
	}

	h2 {
		@include section-label;
	}

	// an outline, so a screenshot of the element leaves it out
	.shot {
		outline: 1px solid var(--color-border-card);
	}

	.board {
		--board-max: 116rem;
		--board-gutter: max(2.4rem, (100cqi - var(--board-max)) / 2);
		container: plan / inline-size;
		background: var(--color-bg-board-page);
	}

	.row,
	.keys {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 2.4rem;
	}

	figure {
		display: grid;
		gap: 0.8rem;
		max-width: min-content;
	}

	figcaption {
		color: var(--color-text-muted);
	}

	.rail {
		width: 28rem;
		background: var(--color-bg);

		> :global(*) {
			border-bottom: 0;
		}
	}

	.course {
		display: flex;
		flex-direction: column;
		width: 36rem;
		background: linear-gradient(to bottom, var(--color-bg-sidebar), var(--color-bg-sidebar-end));
	}

	// the second copy shows only the about card, its lecturer opened
	.about :global(.col-header),
	.about :global(.d-card:not([aria-labelledby='d-sec-about'])) {
		display: none;
	}

	.term {
		display: grid;
		grid-template-columns: 32rem minmax(0, 1fr);
		height: 110rem;
		background: var(--color-bg);
	}

	.term-catalogue {
		min-height: 0;
		overflow: hidden;
		border-right: 1px solid var(--color-border-warm);
	}

	.term-board {
		container: plan / inline-size;
		min-height: 0;
		overflow: hidden;
		background: var(--color-bg-board-page);
	}

	.catalogue {
		width: 32rem;
		height: 64rem;
		background: var(--color-bg);
	}

	.key {
		display: grid;
		gap: 0.8rem;
		padding: 1.6rem;
		background: #fff;
		outline: 1px solid var(--color-border-card);
	}

	.key-row {
		display: grid;
		grid-template-columns: 42rem 36rem;
		align-items: center;
		gap: 1.6rem;
	}

	.key-chip {
		display: flex;
		flex-direction: column;
	}
</style>

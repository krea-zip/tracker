<script lang="ts">
	import { usePlan } from '$lib/planner/context';
	import { BREAK_KINDS, type BreakKind } from '$lib/planner/structure';
	import { TRIM_HARD_MAX, TRIM_MIN, byCode, isAttemptId } from '$lib/curriculum/data';
	import { flip } from 'svelte/animate';
	import { courseIn, courseOut, courseShift } from '$lib/ui/transitions';
	import { carried, carry } from '$lib/planner/drag/courseDrag';
	import { academicYear, termMonths } from '$lib/planner/calendar';

	let { touchLayout = false }: { touchLayout?: boolean } = $props();
	const plan = usePlan();

	// zoom is guaranteed non-null while this component is mounted
	let year = $derived(plan.zoom!.year);
	let trim = $derived(plan.zoom!.trim);

	// Each background cell = 1 credit. Courses are laid out as squares (4 cr =
	// 2×2), and five squares don't tile a 20-cell 4×5 canvas, so the canvas is
	// 4 columns × 6 rows, enough room to actually park five (even six)
	// 4-credit courses without them being squeezed out of the grid.
	const COLS = 4;
	const ROWS = 6;
	// The 12-credit minimum reads as three 2×2 boxes, the exact footprint of
	// the three 4-credit courses it takes to reach it. Then plain cells up to
	// the 20-credit cap, and a final faint strip that is laying-out space past
	// the cap rather than credits you're meant to fill.
	const MIN_BOXES = Array.from({ length: TRIM_MIN / 4 }, (_, i) => i);
	const MIN_WORDS = ['', 'one', 'two', 'three', 'four', 'five'];
	const REST_CELLS = Array.from({ length: TRIM_HARD_MAX - TRIM_MIN }, (_, i) => i);
	const OVER_CELLS = Array.from({ length: COLS * ROWS - TRIM_HARD_MAX }, (_, i) => i);
	const FREE_CELLS = Array.from({ length: COLS * ROWS }, (_, i) => i);

	// year 1's t3 carries no credit minimum or maximum at all
	let exempt = $derived(year === 1);

	// a course covers exactly as many squares as it has credits:
	// 4 → 2×2, 3 → 3×1, 2 → 2×1, 1 → 1×1
	function spans(credits: number): { col: number; row: number } {
		if (credits <= 3) return { col: Math.max(1, credits), row: 1 };
		return { col: 2, row: Math.ceil(credits / 2) };
	}

	// state: the canvas is only there while the trimester isn't a break
	let canvasEl = $state() as HTMLDivElement;

	// a drop pins the course to the canvas cell under the cursor, it can sit
	// anywhere in the 4×5 credit grid, like on paper (clamped so its credit
	// footprint stays inside)
	function drop(e: DragEvent) {
		e.preventDefault();
		plan.dragging = null;
		const code = carried(e);
		if (!code) return;
		plan.place(code, year, trim);
		// a refused drop (a core-only slot) must not leave a canvas position
		// behind for a course that isn't there
		if (!canvasEl || !plan.placedCodes.has(code)) return;
		const r = canvasEl.getBoundingClientRect();
		const span = spans(byCode(code).credits);
		const col = Math.min(COLS - span.col, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * COLS)));
		const row = Math.min(ROWS - span.row, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * ROWS)));
		plan.zoomPos[code] = row * COLS + col;
	}

	function dragstart(e: DragEvent, code: string) {
		carry(e, code);
		plan.dragging = code;
	}

	// ── a trimester off ──
	// A break, a suspension or a term away. Most students never need it, so it
	// waits in a fold at the bottom of the trimester's own view; once set, the
	// trimester shows that instead of its credit canvas.
	let off = $derived(plan.breakAt(year, trim));
	let offKind = $state<BreakKind>('break');
	let awayCredits = $state(16);
	let hasCourses = $derived(plan.slotCourses(year, trim).length > 0);
	// why it couldn't be marked, said here rather than only in the passing flash
	let offError = $state('');
	function markOff(shift: 0 | 1 | 3) {
		const ok = plan.setBreak(
			year,
			trim,
			offKind === 'away' ? { kind: 'away', credits: awayCredits } : { kind: offKind },
			shift
		);
		offError = ok ? '' : (plan.flash ?? "couldn't mark it");
	}

	// what's wrong with THIS trimester, the hints that name its courses, so
	// opening a red cell answers "why is it red?"
	let slotHints = $derived(
		plan.hints.filter(
			(h) =>
				(h.kind === 'warn' || h.kind === 'caution') && h.codes.some((c) => plan.slotCourses(year, trim).includes(c))
		)
	);
</script>

<header>
	<button class="back" onclick={() => (plan.zoom = null)}>← back</button>
	<!-- named the student's way: "year 4 · trimester 1", or "trimester 10"
	     with its place in the year underneath -->
	{#if plan.trimNaming === 'degree'}
		<h1>trimester {plan.trimName(year, trim).slice(1)}</h1>
		<span class="term">year {year} · {termMonths(trim)} · {academicYear(plan.batchStartYear, year)}</span>
	{:else}
		<h1>year {year} · trimester {trim}</h1>
		<span class="term">{termMonths(trim)} · {academicYear(plan.batchStartYear, year)}</span>
	{/if}
	<span class="load">
		{#if off}{off.kind === 'away'
				? `away · ${off.credits ?? 0} credits from elsewhere`
				: off.kind === 'suspension'
					? 'suspended'
					: 'on a break'}{:else}{plan.slotCredits(year, trim)}{exempt ? '' : ` / ${TRIM_HARD_MAX}`} credits{/if}
	</span>
</header>

{#if !off}
	<p class="how">
		each square is one credit{exempt
			? ''
			: `, the shaded blocks are the ${TRIM_MIN}-credit minimum, ${MIN_WORDS[TRIM_MIN / 4] ?? TRIM_MIN / 4} 4-credit courses`}.
		arrange the courses however helps you think; where they sit here doesn't change your plan.
	</p>
{/if}

{#if slotHints.length}
	<ul class="slot-hints">
		{#each slotHints as h (h.id ?? h.text)}
			<li class={h.kind}>{h.text}</li>
		{/each}
	</ul>
{/if}

{#if off}
	<section class="off" aria-label="this trimester is off">
		<b
			>{off.kind === 'away'
				? 'a term away'
				: off.kind === 'suspension'
					? 'suspended this trimester'
					: 'on a break this trimester'}</b
		>
		<p>{BREAK_KINDS[off.kind].note}. No course goes here, and no credit rule applies to it.</p>
		{#if off.kind === 'away'}
			<label class="off-credits">
				credits earned away
				<input
					type="number"
					min="0"
					max="40"
					value={off.credits ?? 0}
					onchange={(e) => plan.setAwayCredits(year, trim, Number(e.currentTarget.value))}
				/>
			</label>
			<p class="off-note">They count toward your degree's total, not toward a programme, and carry no grade.</p>
		{:else if off.kind === 'suspension'}
			<p class="off-note">
				Suspended students write to the Academic Office with their final course list inside the stated window.
			</p>
		{/if}
		<div class="off-acts">
			<button onclick={() => plan.clearBreak(year, trim)}>make it a normal trimester</button>
			<span class="off-note">courses moved for it stay where they are; undo (Ctrl+Z) puts them back</span>
		</div>
	</section>
{:else}
	<div class="canvas" role="list" bind:this={canvasEl} ondragover={(e) => e.preventDefault()} ondrop={drop}>
		<div class="layer zones">
			{#if exempt}
				{#each FREE_CELLS as i (i)}
					<div class="zone-cell"></div>
				{/each}
			{:else}
				{#each MIN_BOXES as i (i)}
					<div class="zone-box"></div>
				{/each}
				{#each REST_CELLS as i (i)}
					<div class="zone-cell"></div>
				{/each}
				{#each OVER_CELLS as i (i)}
					<div class="zone-cell over"></div>
				{/each}
			{/if}
		</div>

		<div class="layer courses">
			{#each plan.slotCourses(year, trim) as code (code)}
				{@const course = byCode(code)}
				{@const span = spans(course.credits)}
				{@const cell = plan.zoomPos[code]}
				{@const type = plan.courseType(code)}
				<div
					class="placed"
					data-type={type}
					class:short={span.row === 1}
					class:flagged={plan.flaggedCodes.has(code)}
					class:is-audit={plan.isAudit(code)}
					class:is-attempt={isAttemptId(code)}
					class:dragging={plan.dragging === code}
					style:--hue={plan.hueOf(code)}
					style={cell !== undefined
						? `grid-column: ${(cell % COLS) + 1} / span ${span.col}; grid-row: ${Math.floor(cell / COLS) + 1} / span ${span.row};`
						: `grid-column: span ${span.col}; grid-row: span ${span.row};`}
					draggable={!touchLayout && !isAttemptId(code)}
					role="listitem"
					animate:flip={courseShift}
					in:courseIn={{ key: code }}
					out:courseOut={{ key: code }}
					ondragstart={(e) => dragstart(e, code)}
					ondragend={() => (plan.dragging = null)}
				>
					<button
						class="x"
						aria-label="remove {plan.courseLabel(code)}"
						onclick={(e) => {
							e.stopPropagation();
							plan.remove(code);
						}}>×</button
					>
					<button
						class="course-open"
						onclick={() => plan.select(code)}
						aria-label="view {plan.courseLabel(code)}{isAttemptId(code) ? ' (failed attempt)' : ''}"
					>
						{#if plan.showCodes}<span class="code"
								>{#if plan.flagKinds.has(code)}<span
										class="flag"
										data-kind={plan.flagKinds.get(code)}
										role="img"
										aria-label="named in a hint"
										title="named in a hint, see hints"
									></span>{/if}{#if type === 'required'}<span class="req-dot" role="img" aria-label="required"
									></span>{/if}{plan.shownCode(code)}</span
							>{/if}
						<span class="title"
							>{#if !plan.showCodes && plan.flagKinds.has(code)}<span
									class="flag"
									data-kind={plan.flagKinds.get(code)}
									role="img"
									aria-label="named in a hint"
									title="named in a hint, see hints"
								></span>{/if}{#if type === 'required' && !plan.showCodes}<span
									class="req-dot"
									role="img"
									aria-label="required"
								></span>{/if}{course.title}</span
						>
						<span class="credits">{course.credits} cr</span>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- what the recommended path puts in THIS trimester and isn't on the grid,
     the same suggestions the overview shows, in the view you'd be arranging
     the trimester from -->
	{#if !plan.gradeMode && plan.suggestionsFor(year, trim).length}
		<div class="suggested">
			<span class="s-lead">suggested here</span>
			{#each plan.suggestionsFor(year, trim) as code (code)}
				{@const c = byCode(code)}
				<button class="s-chip" title="add {plan.courseLabel(code)}" onclick={() => plan.acceptSuggestion(code)}>
					{#if plan.showCodes}<span class="s-code">{plan.shownCode(code)}</span>{/if}
					<span class="s-title">{c.title}</span>
					<span class="s-plus" aria-hidden="true">+</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- for the few who need it: a leave, a suspension, or a term away -->
	<details class="off-fold">
		<summary>not taking courses this trimester?</summary>
		<div class="off-body">
			<div class="off-kinds" role="radiogroup" aria-label="what this trimester is">
				{#each Object.entries(BREAK_KINDS) as [kind, k] (kind)}
					<label>
						<input type="radio" name="off-kind" value={kind} bind:group={offKind} />
						<span><b>{k.label}</b> {k.note}</span>
					</label>
				{/each}
			</div>
			{#if offKind === 'away'}
				<label class="off-credits">
					credits you expect to bring back
					<input type="number" min="0" max="40" bind:value={awayCredits} />
				</label>
			{/if}
			{#if offError}<p class="off-error" role="alert">{offError}</p>{/if}
			{#if hasCourses}
				<p>Its courses, and every course after it, move later with it:</p>
				<div class="off-acts">
					<button onclick={() => markOff(3)}>move them back a year</button>
					<button onclick={() => markOff(1)}>move them back a trimester</button>
				</div>
				<p class="off-note">
					A year keeps every course in a trimester it runs. A trimester is quicker, but some may land where they don't
					run: the <b>will it run?</b> view shows which.
				</p>
			{:else}
				<div class="off-acts">
					<button onclick={() => markOff(0)}>mark it</button>
				</div>
			{/if}
		</div>
	</details>
{/if}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// ── a trimester off ──
	.off,
	.off-fold {
		max-width: 76rem;
		margin: 0 3.2rem 3.2rem;
	}

	.off {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 2rem 2.4rem;
		font-size: 1.35rem;
		line-height: 1.5;
		color: var(--color-text);
		border: 1px dashed var(--color-zone-border);
		border-radius: 10px;

		b {
			font-size: 1.6rem;
			font-weight: 650;
		}

		p {
			margin: 0;
		}
	}

	.off-note {
		font-size: 1.2rem;
		color: var(--color-text-muted);
	}

	.off-error {
		color: var(--color-danger);
	}

	.off-credits {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		font-size: 1.3rem;

		input {
			width: 7rem;
			padding: 0.4rem 0.6rem;
			font: inherit;
			color: var(--color-text);
			background: var(--color-bg-light);
			border: 1px solid var(--color-border-card);
			border-radius: 4px;
		}
	}

	.off-acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem 1.2rem;

		button {
			padding: 0.6rem 1.2rem;
			font-size: 1.3rem;
			@include store-button;
		}
	}

	// quiet until opened: one muted line under the trimester
	.off-fold {
		font-size: 1.3rem;
		color: var(--color-text-muted);

		summary {
			width: fit-content;
			cursor: pointer;

			&:hover {
				color: var(--color-text);
			}
		}

		&[open] summary {
			margin-bottom: 1rem;
			color: var(--color-text);
		}

		p {
			margin: 0;
		}
	}

	.off-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.4rem 1.6rem;
		color: var(--color-text);
		border: 1px solid var(--color-border-card);
		border-radius: 8px;
	}

	.off-kinds {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		label {
			display: flex;
			align-items: baseline;
			gap: 0.8rem;
			cursor: pointer;
		}

		span {
			color: var(--color-text-muted);
		}

		b {
			color: var(--color-text);
		}
	}

	.suggested {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
		max-width: 76rem;
		margin: 0 3.2rem 3.2rem;
	}

	.s-lead {
		font-size: 1.15rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.s-chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		font: inherit;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		background: none;
		border: 1px dashed var(--color-border-card);
		border-radius: 5px;
		cursor: pointer;

		.s-code {
			font-weight: 700;
		}

		.s-plus {
			font-weight: 700;
			opacity: 0.6;
		}

		&:hover {
			color: var(--color-text);
			border-style: solid;
			border-color: var(--color-control);
		}
	}

	.how {
		max-width: 76rem;
		margin: -0.8rem 3.2rem 1.2rem;
		font-size: 1.3rem;
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	.slot-hints {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 76rem;
		margin: 0 3.2rem 1.4rem;
		list-style: none;

		li {
			padding: 0.7rem 1.1rem;
			font-size: 1.3rem;
			line-height: 1.45;
			color: var(--color-text);
			background: color-mix(in srgb, var(--color-hint-warn) 45%, var(--color-bg-light));
			border: 1px solid color-mix(in srgb, var(--color-hint-warn-deep) 45%, transparent);
			border-radius: 6px;

			&.caution {
				background: color-mix(in srgb, var(--color-hint-caution) 45%, var(--color-bg-light));
				border-color: color-mix(in srgb, var(--color-hint-caution-deep) 45%, transparent);
			}
		}
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 2rem;
		padding: 2.4rem 3.2rem 1.6rem;

		h1 {
			font-size: 3rem;
			font-weight: 400;
		}

		.load,
		.term {
			font-size: 1.4rem;
			color: var(--color-text-muted);
		}

		.term {
			font-weight: 700;
			font-variant-numeric: tabular-nums;
		}
	}

	.back {
		padding: 0.6rem 1.2rem;
		font-size: 1.3rem;
		@include store-button;
	}

	.canvas {
		position: relative;
		// one credit-cell stays ~9.2rem tall, so six rows instead of five make
		// the canvas taller rather than squashing the courses on it
		height: 55.2rem;
		max-width: 76rem;
		margin: 0 3.2rem 3.2rem;
		border: 1px dashed var(--color-zone-border); // outer border follows the rounded corner
		border-radius: 10px;
		overflow: hidden;
	}

	// 24 one-credit cells (COLS × ROWS in the script), the 20-credit cap plus
	// a row of slack, so five 2×2 courses have somewhere to sit
	.layer {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: repeat(6, 1fr);
	}

	.zone-cell {
		background: var(--color-zone-rest);
		border: 1px dashed var(--color-zone-border);

		// past the 20-credit cap: still droppable space, just not credits the
		// trimester is meant to hold
		&.over {
			background: none;
			opacity: 0.5;
		}
	}

	// the minimum load, drawn as course-shaped 2×2 boxes
	.zone-box {
		grid-column: span 2;
		grid-row: span 2;
		background: var(--color-zone-min);
		border: 1px dashed var(--color-zone-border);
	}

	.courses {
		pointer-events: none;
		grid-auto-flow: dense;
	}

	.placed {
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden; // nothing spills past the rounded corners
		margin: 0.7rem;
		padding: 1.2rem 1.4rem;
		border-radius: 8px;
		cursor: grab;
		transition:
			transform 0.15s ease,
			opacity 0.15s ease,
			box-shadow 0.2s ease;
		@include course-type-fill;
		@include card-shine;

		&:hover {
			transform: translateY(-2px);
			@include card-shine-hover;
		}

		&:active {
			cursor: grabbing;
			transform: scale(0.98);
		}

		// the source of an in-flight drag leaves its dashed outline behind
		&.dragging {
			transform: none;
			background: color-mix(in srgb, var(--color-board-text) 6%, transparent);
			border: 1px dashed color-mix(in srgb, var(--color-board-text) 60%, transparent);
			box-shadow: none;

			> * {
				visibility: hidden;
			}
		}

		.code {
			font-size: 1.6rem;
			font-weight: 700;
		}

		.req-dot {
			@include required-dot;
			margin-right: 0.6rem;
			vertical-align: 0.12em;
		}

		.title {
			font-size: 1.5rem;
			overflow: hidden;
		}

		.credits {
			margin-top: auto;
			font-size: 1.2rem;
		}

		// a course named in a hint leads with that hint's severity mark
		.flag {
			@include severity-mark;
			margin-right: 0.5rem;
			vertical-align: -0.1em;
		}

		.x {
			display: none;
			position: absolute;
			top: 0.6rem;
			right: 0.8rem;
			background: none;
			border: none;
			font-size: 1.6rem;
			line-height: 1;
			color: inherit; // the card's ink, like its text
			cursor: pointer;
			-webkit-tap-highlight-color: transparent;
			transition: transform 0.2s var(--spring);

			&:hover {
				transform: scale(1.1);
			}
		}

		&:hover .x {
			display: block;
		}
	}

	// a course of 3 credits or fewer is one row tall, too short to stack code,
	// title and credits: the code on top, then the title on one line with the
	// credits at its end (the top-right corner stays free for the ×)
	.placed.short {
		.course-open {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'code code'
				'title credits';
			align-content: start;
			align-items: baseline;
			gap: 0.4rem 1rem;

			&:not(:has(.code)) {
				grid-template-areas: 'title credits';
			}
		}

		.code {
			grid-area: code;
		}

		.title {
			grid-area: title;
			min-width: 0;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		.credits {
			grid-area: credits;
			margin-top: 0;
		}
	}

	.course-open {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		min-width: 0;
		text-align: left;
		width: 100%;
		height: 100%;
		color: inherit;
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
	}
	@include mobile {
		header {
			flex-wrap: wrap;
			gap: 0.8rem 1.2rem;
			padding: 1.6rem;
		}
		header h1 {
			font-size: 2rem;
		}
		.how,
		.slot-hints {
			margin: 0 1.6rem 1.6rem;
		}
		.canvas {
			margin: 0 1.6rem 1.6rem;
		}
		.placed {
			padding: 1rem;
		}
		.placed .x {
			opacity: 1;
			min-width: 4.4rem;
			position: static;
			align-self: flex-end;
		}
		.course-open {
			height: auto;
		}
	}
</style>

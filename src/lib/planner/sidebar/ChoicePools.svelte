<script lang="ts">
	// a programme's "any three of the following" pools. The ones still open
	// come first, each a small card: the rule, how many are chosen of how
	// many, and the courses on offer, one aligned line each. Finished pools
	// shrink to one line that names the course(s) that settled them, and
	// courses that have never been taught fold into a single "+3" line.
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { byCode, type ChoiceGroup } from '$lib/curriculum/data';
	import { usePlan } from '$lib/planner/context';
	import { viewport } from '$lib/planner/viewport.svelte';
	import { reducedMotion } from '$lib/ui/transitions';

	const plan = usePlan();
	// a phone has no codes / titles switches, so it shows both
	let showCode = $derived(plan.showCodes || !viewport.desktop);
	let showTitle = $derived(plan.showTitles || !viewport.desktop);

	// where each placed course sits, "y3 t2"
	let where = $derived(new Map(plan.placed.map((p) => [p.code, plan.trimName(p.year, p.trim)])));
	const placedAt = (code: string) => where.get(code) ?? where.get(byCode(code).code);

	// finished pools are folded, unfolded by hand; so are the never-taught lists
	let unfolded = $state<string[]>([]);
	let laterOpen = $state<string[]>([]);
	const flip = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

	const fold = () => ({ duration: reducedMotion() ? 0 : 200, easing: cubicOut });

	// "Any four of the following courses" → "pick 4", keeping what kind
	// ("Any three methodology courses" → "pick 3 methodology"); other rules
	// stay as written
	const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
	function shortRule(rule: string) {
		const m = rule.match(/^any (\w+) (?:of the following )?(.*?)\s*courses?$/i);
		const n = m && (NUMBERS[m[1].toLowerCase()] ?? Number(m[1]));
		return m && n ? `pick ${n}${m[2] ? ` ${m[2]}` : ''}` : rule;
	}

	type Pool = ChoiceGroup & { counts: string; chosen: number };
	// chosen first, then the rest on offer; the never-taught ones apart
	function split(group: Pool) {
		const offered = group.courses
			.filter((c): c is { code: string; title: string } => !!c.code)
			.sort((a, b) => Number(!placedAt(a.code)) - Number(!placedAt(b.code)));
		return {
			offered,
			picked: offered.filter((c) => placedAt(c.code)),
			later: group.courses.filter((c) => !c.code)
		};
	}
</script>

{#snippet options(group: Pool, key: string)}
	{@const { offered, later } = split(group)}
	{#if group.counts !== 'required'}
		<p class="pool-note">counts toward {group.counts} credits</p>
	{/if}
	{#if offered.length}
		<ul class="opts">
			{#each offered as course (course.code)}
				{@const at = placedAt(course.code)}
				<li>
					<!-- a click finds the course in the catalogue; labelled like the
					     grid (the codes / titles switches) -->
					<button
						class="opt"
						class:picked={!!at}
						title="{plan.shownCode(course.code)} {course.title}{at
							? `, on your plan in ${at}`
							: ', find it in the catalogue'}"
						onclick={() => plan.revealCourse(course.code)}
					>
						<span class="mark" aria-hidden="true"></span>
						{#if showCode}<span class="opt-code">{plan.shownCode(course.code)}</span>{/if}
						{#if showTitle}<span class="opt-title">{course.title}</span>{/if}
						{#if at}<span class="opt-at">{at}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<!-- on the university's list but never taught: nothing to do with them
	     yet, so one quiet line that opens to their names -->
	{#if later.length}
		{@const open = laterOpen.includes(key)}
		<button class="later-toggle" aria-expanded={open} onclick={() => (laterOpen = flip(laterOpen, key))}>
			{open ? '−' : '+'}{later.length} not offered yet
		</button>
		{#if open}
			<ul class="later" transition:slide={fold()}>
				{#each later as course (course.title)}<li>{course.title}</li>{/each}
			</ul>
		{/if}
	{/if}
{/snippet}

{#if plan.choices.length}
	<div class="section">
		<h3>choices</h3>

		<div class="choices">
			{#each plan.choices as prog (prog.role + prog.label)}
				{@const pools = prog.groups.map((group, gi) => ({
					group,
					key: `${prog.role}:${prog.label}:${gi}`,
					done: group.chosen >= group.pick
				}))}
				{@const todo = pools.filter((p) => !p.done)}
				{@const finished = pools.filter((p) => p.done)}
				<section class="prog">
					<header class="prog-head">
						<span class="prog-name">{prog.label} · {prog.role}</span>
						{#if todo.length}
							<span class="prog-left">{todo.length} to choose</span>
						{:else}
							<span class="prog-done">✓ done</span>
						{/if}
					</header>

					<!-- still to choose: a card each -->
					{#each todo as { group, key } (key)}
						<div class="pool">
							<div class="pool-head" title={group.rule}>
								<span class="pool-rule">{shortRule(group.rule)}</span>
								<span class="pool-count" aria-label="{group.chosen} of {group.pick} chosen"
									><b>{group.chosen}</b> of {group.pick}</span
								>
							</div>
							{@render options(group, key)}
						</div>
					{/each}

					<!-- settled: one line each, naming what settled it -->
					{#if finished.length}
						<ul class="finished">
							{#each finished as { group, key } (key)}
								{@const open = unfolded.includes(key)}
								{@const picked = split(group).picked}
								<li class:open>
									<button
										class="done-line"
										aria-expanded={open}
										title={group.rule}
										onclick={() => (unfolded = flip(unfolded, key))}
									>
										<span class="mark" aria-hidden="true"></span>
										<span class="done-rule">{shortRule(group.rule)}</span>
										<span class="done-codes">{picked.map((c) => plan.shownCode(c.code)).join(' · ')}</span>
										<span class="chev" aria-hidden="true"></span>
									</button>
									{#if open}
										<div class="done-body" transition:slide={fold()}>
											{@render options(group, key)}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	</div>
{/if}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.section {
		@include rail-section;
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
		padding: 1rem var(--panel-gutter) 1.4rem;
	}

	.prog {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.prog + .prog {
		padding-top: 1.4rem;
		border-top: 1px dotted var(--color-border-light);
	}

	// the programme, and how much of it is still open, on one line
	// the name keeps to one line where it fits; when the status won't fit
	// beside it, the status wraps under it, still at the right
	.prog-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.8rem;
		margin-bottom: 0.2rem;
	}

	.prog-name {
		@include section-label;
		min-width: 0;
	}

	.prog-left,
	.prog-done {
		flex: none;
		margin-left: auto;
		font-size: 1.15rem;
		white-space: nowrap;
		color: var(--color-text-muted);
	}

	.prog-done {
		color: var(--color-hint-good-deep);
	}

	// ── a pool still to choose from ──
	.pool {
		padding: 0.9rem 0.6rem 0.7rem;
		background: color-mix(in srgb, var(--color-bg-light) 70%, transparent);
		border: 1px solid var(--color-border-light);
		border-radius: 0.8rem;
	}

	.pool-head {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		padding: 0 0.4rem 0.5rem;
	}

	.pool-rule {
		flex: 1;
		min-width: 0;
		font-size: var(--text-body);
		font-weight: 650;
		line-height: 1.3;
		color: var(--color-text);
	}

	.pool-count {
		flex: none;
		font-size: 1.15rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);

		b {
			font-weight: 700;
			color: var(--color-text);
		}
	}

	.pool-note {
		padding: 0 0.4rem 0.4rem;
		font-size: 1.15rem;
		color: var(--color-text-muted);
	}

	// ── one line per course: mark, code, title, where it sits ──
	// one column that may shrink below its widest title (a bare grid column
	// grows to fit it, pushing titles and the trimester out of the card)
	.opts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.opt {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		min-width: 0;
		padding: 0.35rem 0.4rem;
		font: inherit;
		font-size: var(--text-body);
		line-height: 1.35;
		text-align: left;
		color: var(--color-text-muted);
		background: none;
		border: 0;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.12s ease;

		&:hover,
		&:focus-visible {
			color: var(--color-text);
			background: color-mix(in srgb, var(--color-text) 6%, transparent);
		}

		&.picked {
			color: var(--color-text);
		}
	}

	// the codes line up in a column, so the eye runs straight down them
	.opt-code {
		flex: none;
		min-width: 7.2ch;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	// one line, the whole title on hover
	.opt-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opt-at {
		flex: none;
		margin-left: auto;
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
	}

	// the row's mark: an empty ring to choose, a filled green tick once chosen
	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.3rem;
		height: 1.3rem;
		border: 1.5px solid color-mix(in srgb, var(--color-text-muted) 55%, transparent);
		border-radius: 50%;
	}

	.picked .mark,
	.done-line .mark {
		background: var(--color-hint-good-deep);
		border-color: var(--color-hint-good-deep);

		&::after {
			content: '';
			width: 0.35rem;
			height: 0.6rem;
			margin-top: -0.15rem;
			border-right: 1.5px solid var(--color-bg-light);
			border-bottom: 1.5px solid var(--color-bg-light);
			transform: rotate(45deg);
		}
	}

	// never taught: a quiet toggle, then the names, plain
	.later-toggle {
		margin: 0.3rem 0 0 0.4rem;
		padding: 0.2rem 0;
		font: inherit;
		font-size: 1.15rem;
		color: var(--color-text-muted);
		background: none;
		border: 0;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			color: var(--color-text);
		}
	}

	.later {
		margin: 0.2rem 0 0;
		padding: 0 0.4rem 0 2.4rem;
		font-size: 1.15rem;
		line-height: 1.45;
		color: var(--color-text-muted);
		list-style: none;
	}

	// ── settled pools: one line each ──
	.finished {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin: 0.2rem 0 0;
		padding: 0;
		list-style: none;
	}

	.done-line {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.35rem 0.4rem;
		font: inherit;
		font-size: var(--text-body);
		text-align: left;
		color: var(--color-text-muted);
		background: none;
		border: 0;
		border-radius: 0.5rem;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			color: var(--color-text);
			background: color-mix(in srgb, var(--color-text) 6%, transparent);
		}
	}

	.done-rule {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.done-codes {
		flex: 0 1 auto;
		max-width: 45%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1.15rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.chev {
		@include fold-chevron;
		margin-left: 0.2rem;
	}

	.done-body {
		padding: 0.2rem 0 0.4rem 2rem;
	}

	// phones: rows a fingertip tall, but not the full 44px each
	@include mobile {
		.opt,
		.done-line {
			min-height: 3.6rem;
		}
	}
</style>

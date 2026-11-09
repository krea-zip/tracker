<script lang="ts">
	// a programme's "any three of the following" pools: a short rule, pips
	// for how many are picked, and the courses, the picked ones first with
	// where they sit. a pool that's complete folds to one line
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { byCode } from '$lib/curriculum/data';
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

	// complete pools are folded; these are the ones unfolded by hand
	let unfolded = $state<string[]>([]);
	const toggle = (key: string) =>
		(unfolded = unfolded.includes(key) ? unfolded.filter((k) => k !== key) : [...unfolded, key]);

	// "Any four of the following courses" → "pick 4", keeping what kind
	// ("Any three methodology courses" → "pick 3 methodology"); other rules
	// stay as written
	const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
	function shortRule(rule: string) {
		const m = rule.match(/^any (\w+) (?:of the following )?(.*?)\s*courses?$/i);
		const n = m && (NUMBERS[m[1].toLowerCase()] ?? Number(m[1]));
		return m && n ? `pick ${n}${m[2] ? ` ${m[2]}` : ''}` : rule;
	}

	// picked first, then what's on offer, then what's never been taught
	type Option = { code?: string | null; title: string };
	const rank = (c: Option) => (c.code ? (placedAt(c.code) ? 0 : 1) : 2);
	const ordered = <T extends Option>(courses: T[]) => [...courses].sort((a, b) => rank(a) - rank(b));
</script>

{#if plan.choices.length}
	<div class="section">
		<h3>choices</h3>

		<div class="choices">
			{#each plan.choices as prog (prog.role + prog.label)}
				<div class="prog">
					<div class="prog-name">{prog.label} · {prog.role}</div>
					{#each prog.groups as group, gi (group.rule + gi)}
						{@const key = `${prog.role}:${prog.label}:${gi}`}
						{@const done = group.chosen >= group.pick}
						{@const open = !done || unfolded.includes(key)}
						{@const courses = ordered(group.courses)}
						<div class="choice" class:done class:open>
							{#snippet ruleLine()}
								<span class="rule-text">{shortRule(group.rule)}</span>
								<span class="pips" role="img" aria-label="{Math.min(group.chosen, group.pick)} of {group.pick} picked">
									{#each { length: group.pick } as _, k (k)}<i class:on={k < group.chosen}></i>{/each}
								</span>
								{#if done}<span class="done-mark">✓ done</span><span class="chev" aria-hidden="true"></span>{/if}
							{/snippet}
							<!-- a complete pool's rule is its fold toggle -->
							{#if done}
								<button class="rule" title={group.rule} aria-expanded={open} onclick={() => toggle(key)}
									>{@render ruleLine()}</button
								>
							{:else}
								<div class="rule" title={group.rule}>{@render ruleLine()}</div>
							{/if}

							{#if open}
								<div transition:slide={{ duration: reducedMotion() ? 0 : 210, easing: cubicOut }}>
									{#if group.counts !== 'required'}
										<div class="note">counts toward {group.counts} credits</div>
									{/if}
									{#if courses.length}
										<ul>
											{#each courses as course (course.title)}
												{@const at = course.code ? placedAt(course.code) : undefined}
												<li class:missing={!course.code} class:picked={!!at} title={course.title}>
													<!-- labelled like the grid (the codes / titles switches); a
													     click finds the course in the catalogue -->
													{#if course.code}
														{@const code = course.code}
														<button onclick={() => plan.revealCourse(code)}>
															{#if showCode}<b
																	class="course-code"
																	data-type={plan.courseType(code)}
																	style:--hue={plan.hueOf(code)}>{plan.shownCode(code)}</b
																>{/if}{showCode && showTitle ? ' ' : ''}{#if showTitle}{course.title}{/if}
														</button>
														{#if at}<span class="at">{at}</span>{/if}
													{:else}<span class="name">{course.title} <em>· not offered yet</em></span>{/if}
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
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
		gap: 1rem;
		padding: 1.2rem var(--panel-gutter);
	}

	// each programme on its own dotted rule, like the programmes above
	.prog {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.prog + .prog {
		padding-top: 1.2rem;
		border-top: 1px dotted var(--color-border-light);
	}

	.prog-name {
		@include section-label;
	}

	// the short rule, its pips at the far end; a button once the pool is done
	.rule {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0;
		font: inherit;
		font-size: var(--text-body);
		font-weight: 700;
		text-align: left;
		color: var(--color-text);
		background: none;
		border: 0;
	}

	button.rule {
		cursor: pointer;
	}

	.rule-text {
		flex: 1;
		min-width: 0;
	}

	// one pip per course to pick: faded until picked, then filled
	.pips {
		display: flex;
		flex: none;
		gap: 0.3rem;

		i {
			width: 0.75rem;
			height: 0.75rem;
			background-color: color-mix(in srgb, var(--color-text-muted) 30%, transparent);
			border-radius: 50%;
			transition: background-color 0.2s ease;

			&.on {
				background-color: var(--color-text);
			}
		}

		.done & i.on {
			background-color: var(--color-hint-good-deep);
		}
	}

	.done-mark {
		flex: none;
		font-size: 1.15rem;
		color: var(--color-hint-good-deep);
	}

	.chev {
		@include fold-chevron;
	}

	.note {
		margin-top: 0.4rem;
		font-size: var(--text-body);
		line-height: 1.4;
		color: var(--color-text-muted);
	}

	// one line per course, long titles trimmed (full title on hover) so a pool
	// reads as a tidy list instead of a wall of wrapped text
	ul {
		margin: 0.4rem 0 0;
		padding-left: 0;
		font-size: var(--text-body);
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	li {
		position: relative;
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		padding-left: 1.6rem;
		list-style: none;

		// its own bullet, so a picked course can swap it for a tick and the
		// pool reads "3 chosen, 2 to go" at a glance
		&::before {
			content: '•';
			position: absolute;
			top: 50%;
			translate: 0 -50%;
			left: 0.3rem;
			color: var(--color-text-muted);
		}

		// picked: a tick, full ink, and where it sits on the plan
		&.picked {
			color: var(--color-text);

			&::before {
				content: '✓';
				left: 0.1rem;
				font-size: 1.1rem;
				font-weight: 700;
				color: var(--color-hint-good-deep);
			}
		}

		// listed by the university but never taught yet: "on paper, not on the plan"
		&.missing em {
			font-size: 1.1rem;
		}
	}

	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.at {
		flex: none;
		margin-left: auto;
		font-size: 1.15rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
	}

	li button {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0;
		font: inherit;
		text-align: left;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;

		&:hover {
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}

	.course-code {
		@include course-tag;
		display: inline-block;
		vertical-align: baseline;
	}

	// phones: the touch floor would make every row 44px; a list of codes
	// reads better a little tighter
	@include mobile {
		li button {
			min-height: 3.4rem;
		}

		button.rule {
			min-height: 4rem;
		}
	}
</style>

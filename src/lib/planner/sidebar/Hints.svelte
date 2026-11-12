<script lang="ts">
	// the plan's hints, worst first: rows fold same-kind hints together, a
	// line lights its courses on the grid, and a rule the student has a
	// waiver for can be crossed off
	import { usePlan } from '$lib/planner/context';
	import { tick, untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { reducedMotion } from '$lib/ui/transitions';
	import type { Hint } from '$lib/types';
	import { byCode, hasCode } from '$lib/curriculum/data';

	const plan = usePlan();

	// one hint open at a time, opening another folds the last
	let openKey = $state<string | null>(null);
	let notesOpen = $state(false);
	// the open hint's courses stay lit on the grid; pointing at another hint
	// previews its courses, then the grid goes back to the open one's
	// A heading unfolds and highlights all affected courses and trimesters.
	let pinned = $state<string | null>(null); // the line whose courses stay lit
	let pinnedLit: Pick<Hint, 'codes' | 'slots'> = { codes: [] };
	function toggle(group: Group) {
		openKey = openKey === group.key ? null : group.key;
		unpin();
		if (openKey) {
			pinned = group.key;
			pinnedLit = {
				codes: [...new Set(group.hints.flatMap((hint) => hint.codes))],
				slots: [...new Set(group.hints.flatMap((hint) => hint.slots ?? []))]
			};
			light(pinnedLit);
			focusHint(pinnedLit);
		}
	}
	function unpin() {
		pinned = null;
		pinnedLit = { codes: [] };
		light(pinnedLit);
	}
	function pin(lineKey: string, hint: Hint) {
		if (pinned === lineKey) return unpin();
		pinned = lineKey;
		pinnedLit = hint;
		light(hint);
		focusHint(hint);
	}
	function focusHint(hint: Pick<Hint, 'codes' | 'slots'>) {
		const first = hint.codes.find((code) => hasCode(code) && plan.placedCodes.has(byCode(code).code));
		if (first) return focusOnGrid(first);
		const slot = hint.slots?.[0];
		if (!slot) return;
		const [year, trim] = slot.split('-');
		tick().then(() =>
			document
				.querySelector(`.overview .cell[data-year="${year}"][data-trim="${trim}"]`)
				?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
		);
	}
	// a hint lights its courses on the grid, or, when it's about trimesters
	// rather than courses (too few credits), those trimesters
	function light({ codes, slots = [] }: Pick<Hint, 'codes' | 'slots'>) {
		plan.highlight = codes.filter(hasCode).map((code) => byCode(code).code);
		plan.highlightSlots = slots;
	}
	// the lit courses hold until a click anywhere else: the grid, the
	// background, another hint. The lit line's own button is left alone so a
	// second click on it still switches it off (pin toggles); another line's
	// press clears this one before its click lights the new one.
	function clickAway(e: PointerEvent) {
		if (!pinned) return;
		if ((e.target as Element | null)?.closest('.hint-detail li.lit :is(.jump, .code)')) return;
		unpin();
	}
	// a course named in a hint, clicked: it opens in the details and the
	// catalogue, and the line's courses light on the grid, scrolled to this
	// one when it's on the plan
	function openCourse(code: string, lineKey: string, hint: Hint) {
		plan.revealCourse(code);
		pinned = lineKey;
		pinnedLit = hint;
		light(hint);
		if (plan.placedCodes.has(byCode(code).code)) focusOnGrid(code);
	}
	// a hint's sentence cut into plain text and the course codes in it
	const CODE = /\b[A-Z]{3,5}\d{3}[A-Z]?\b/g;
	function segments(text: string): { text: string; code?: string }[] {
		const out: { text: string; code?: string }[] = [];
		let last = 0;
		for (const m of text.matchAll(CODE)) {
			if (!hasCode(m[0])) continue;
			if (m.index > last) out.push({ text: text.slice(last, m.index) });
			out.push({ text: m[0], code: m[0] });
			last = m.index + m[0].length;
		}
		if (last < text.length) out.push({ text: text.slice(last) });
		return out;
	}
	const preview = (hint: Hint) => light(hint);
	const restoreHighlight = () => light(pinnedLit);
	/** bring a course's chip into view on the grid */
	function focusOnGrid(code: string) {
		tick().then(() =>
			document
				.querySelector(`.overview .chip[data-code="${CSS.escape(byCode(code).code)}"]`)
				?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
		);
	}
	// a few plain words per row; the full sentence is one click away
	function heading(hint: Hint) {
		const text = hint.text.toLowerCase();
		if (/applied version/.test(text)) return 'maths covers the applied one';
		if (/earlier|prerequisite|before|needs .+ first/.test(text)) return 'prerequisites first';
		if (/usually open|not year|only.*year/.test(text)) return 'wrong year';
		if (/required courses?.*place/.test(text)) return 'required courses missing';
		if (/credit.*minimum|under.*credit|credits it needs/.test(text)) return 'too few credits';
		if (/credit.*max|over.*credit|ceiling|exceed/.test(text)) return 'too many credits';
		if (/interchangeable|you can switch/.test(text)) return 'you only need one';
		if (/foundation/.test(text)) return 'foundation courses';
		if (/audit/.test(text)) return 'audits';
		if (/transcript/.test(text)) return "doesn't count";
		if (/offered|trimester|doesn't run in/.test(text)) return 'wrong trimester';
		if (/cgpa/.test(text)) return 'CGPA too low';
		if (/merit list/.test(text)) return "dean's list";
		if (/\(fail\)|incomplete|d\/e/.test(text)) return 'grades to sort out';
		if (hint.text.length <= 32) return hint.text;
		const cut = hint.text.slice(0, 30);
		return cut.slice(0, Math.max(cut.lastIndexOf(' '), 16)) + '…';
	}

	// a hint that names a real course can jump to it in the details panel
	const targetOf = (codes: string[]) => codes.find(hasCode);

	// worst first, a broken prerequisite matters more than "2 audits
	// remaining", and the panel is long enough that the reds were scrolling
	// off the bottom under a stack of yellows
	const RANK = { warn: 0, caution: 1, info: 2, good: 3 };
	let sorted = $derived([...plan.hints].sort((a, b) => RANK[a.kind] - RANK[b.kind]));
	// things to fix, and, quieter, below them, notes that are just facts
	// ("2 audits left"); the badge counts only the first, so it matches
	let issues = $derived(sorted.filter((h) => h.kind === 'warn' || h.kind === 'caution'));
	// the good news ("all foundation courses placed", "2 audits left") rides
	// along at the end, green, inside the folded advisories, so it never
	// crowds the things to fix
	let notes = $derived(sorted.filter((h) => h.kind === 'info' || h.kind === 'good'));
	let problems = $derived(issues.length);

	// hints with the same heading fold into one row, three "prerequisite
	// order" rows read as one problem in three places, not three problems
	type Group = { key: string; kind: Hint['kind']; title: string; hints: Hint[]; courses: string[] };
	function grouped(list: Hint[]): Group[] {
		const groups = new Map<string, Group>();
		for (const hint of list) {
			const title = heading(hint);
			const key = `${hint.kind}:${title}`;
			let g = groups.get(key);
			if (!g) groups.set(key, (g = { key, kind: hint.kind, title, hints: [], courses: [] }));
			g.hints.push(hint);
			// the course each hint is about (its first code), the row's tags
			const target = targetOf(hint.codes);
			if (target && !g.courses.includes(byCode(target).code)) g.courses.push(byCode(target).code);
		}
		return [...groups.values()];
	}
	let issueGroups = $derived(grouped(issues));
	let noteGroups = $derived(grouped(notes));
	const TAGS_SHOWN = 2;
	// does a hint name this course? (a hint can name it by a cross-listed
	// alias, a prerequisite as the catalogue lists it, so match canonically)
	const names = (hint: Hint, code: string | undefined) =>
		!!code && hint.codes.some((c) => hasCode(c) && byCode(c).code === code);
	let warns = $derived(issues.filter((h) => h.kind === 'warn').length);
	let cautions = $derived(problems - warns);

	// the ▲ and ■ badges work like checkboxes: each shows or hides its own
	// kind, so both, either one, or neither can be on (neither: empty list)
	type IssueKind = 'warn' | 'caution';
	let showKind = $state<Record<IssueKind, boolean>>({ warn: true, caution: true });
	let tally = $derived(
		(
			[
				{ kind: 'warn', n: warns, what: 'problem' },
				{ kind: 'caution', n: cautions, what: 'warning' }
			] as const
		).filter((t) => t.n > 0)
	);
	const shown = (group: Group) => (group.kind !== 'warn' && group.kind !== 'caution') || showKind[group.kind];

	// picking a course a hint names (the ▲ on its chip) unfolds its first,
	// worst, group and brings it into view, only on the pick itself, so a
	// group folded by hand stays folded as the plan changes around it
	$effect(() => {
		const code = plan.selected?.code;
		if (!code) return;
		untrack(() => {
			const groups = [...issueGroups, ...noteGroups];
			const hit = groups.findIndex((g) => g.hints.some((h) => names(h, code)));
			if (hit < 0) return;
			openKey = groups[hit].key;
			if (groups[hit].kind === 'info') notesOpen = true;
			else if (groups[hit].kind === 'warn' || groups[hit].kind === 'caution')
				showKind[groups[hit].kind as IssueKind] = true;
			tick().then(() =>
				document.getElementById(`hint-detail-${hit}`)?.parentElement?.scrollIntoView({
					block: 'nearest',
					behavior: reducedMotion() ? 'auto' : 'smooth'
				})
			);
		});
	});
</script>

<svelte:window onpointerdown={clickAway} />

{#snippet hintGroup(group: Group, gi: number)}
	{@const open = openKey === group.key}
	<!-- one hint: its sentence is the card; several: a heading that opens to them -->
	{@const single = group.hints.length === 1}
	{@const extras = !single || group.hints.some((h) => h.toPlace?.length || h.id)}
	<div class="chip" class:open class:single data-kind={group.kind} role="group">
		<button class="hint-heading" aria-expanded={open} aria-controls={`hint-detail-${gi}`} onclick={() => toggle(group)}>
			<span class="hint-main">
				<span class="hint-title">
					<i class="tone-dot" data-kind={group.kind} aria-hidden="true"></i>{single
						? group.hints[0].text
						: group.title}{#if !single}<span class="count">{group.hints.length}</span>{/if}
				</span>
				<!-- the courses it's about, as small chips in their own colours
				     (a single hint's sentence names them already) -->
				{#if !single && group.courses.length}
					<span class="tags">
						{#each group.courses.slice(0, TAGS_SHOWN) as code (code)}
							<span class="tag" data-type={plan.courseType(code)} style:--hue={plan.hueOf(code)}
								>{plan.shownCode(code)}</span
							>
						{/each}
						{#if group.courses.length > TAGS_SHOWN}<span class="tag-more">+{group.courses.length - TAGS_SHOWN}</span
							>{/if}
					</span>
				{/if}
			</span>
			{#if extras}<span class="chev" aria-hidden="true"></span>{/if}
		</button>
		{#if open && extras}
			<ul
				class="hint-detail"
				id={`hint-detail-${gi}`}
				transition:slide={{ duration: reducedMotion() ? 0 : 210, easing: cubicOut }}
			>
				{#each group.hints as hint, i (hint.id ?? hint.text + i)}
					{@const lineKey = hint.id ?? `${group.key}:${i}`}
					<!-- the line about the course open on the right stands out; the
					     line clicked keeps its courses lit on the grid -->
					<li class:here={names(hint, plan.selected?.code)} class:lit={pinned === lineKey}>
						<div class="line">
							{#if single}
								<!-- the sentence is the heading above -->
							{:else if hint.codes.some(hasCode)}
								<!-- each course in the sentence is its own link; pointing at the
								     line previews its courses on the grid -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<p class="chip-text" onmouseenter={() => preview(hint)} onmouseleave={restoreHighlight}>
									{#each segments(hint.text) as part, k (k)}{#if part.code}{@const c = part.code}<button
												class="code"
												title="{byCode(c).title}, open it"
												onclick={() => openCourse(c, lineKey, hint)}
												onfocus={() => preview(hint)}
												onblur={restoreHighlight}>{part.text}</button
											>{:else}{part.text}{/if}{/each}
								</p>
							{:else if hint.slots?.length}
								<button
									class="chip-text jump"
									aria-pressed={pinned === lineKey}
									title="show these trimesters on the grid"
									onclick={() => pin(lineKey, hint)}
									onmouseenter={() => preview(hint)}
									onmouseleave={restoreHighlight}
									onfocus={() => preview(hint)}
									onblur={restoreHighlight}
								>
									{hint.text}
								</button>
							{:else}
								<!-- a click here folds the group back up, rather than starting
							     a text selection on a line that does nothing -->
								<button class="chip-text" onclick={() => toggle(group)}>{hint.text}</button>
							{/if}
							<!-- courses not on the plan yet: each one opens in the catalogue -->
							{#if hint.toPlace?.length}
								<ul class="to-place">
									{#each hint.toPlace as code (code)}
										<li>
											<button
												title="{byCode(code).title}, find it in the catalogue"
												onclick={() => plan.revealCourse(code)}>{plan.shownCode(code)}</button
											>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<!-- a red hint states a rule the registry enforces, not us, and
						     waivers, one-off offerings and year exemptions are ordinary.
						     So it can be crossed off, and stops counting against the plan;
						     the link says so in words, an × read as "remove the course" -->
						{#if hint.id}
							<button
								class="waive"
								title="cross this off if you have a waiver for it"
								aria-label="cross off, I have a waiver: {hint.text}"
								onclick={() => plan.waiveHint(hint.id!)}>waived?</button
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

<div class="section" data-tour="hints">
	<h3>
		hints
		<!-- what's waiting, by severity, the same marks as the rows below -->
		{#if problems}
			<span class="tally">
				{#each tally as t (t.kind)}
					<button
						class="tally-item"
						class:off={!showKind[t.kind]}
						data-kind={t.kind}
						role="checkbox"
						aria-checked={showKind[t.kind]}
						aria-label="show {t.n} {t.what}{t.n === 1 ? '' : 's'}"
						title="{showKind[t.kind] ? 'hide' : 'show'} {t.what}s"
						onclick={() => (showKind[t.kind] = !showKind[t.kind])}
						><i class="tally-mark" data-kind={t.kind}></i>{t.n}</button
					>
				{/each}
			</span>
		{/if}
	</h3>

	{#if issueGroups.length}
		<div class="chips">
			{#each issueGroups as group, gi (group.key)}
				{#if shown(group)}{@render hintGroup(group, gi)}{/if}
			{/each}
		</div>
	{:else}
		<p class="all-clear"><i class="tone-dot" data-kind="good" aria-hidden="true"></i>nothing to fix right now</p>
	{/if}

	{#if noteGroups.length}
		<div class="notes">
			<button
				class="notes-toggle"
				aria-expanded={notesOpen}
				aria-controls="hint-advisories"
				onclick={() => {
					notesOpen = !notesOpen;
					if (!notesOpen && noteGroups.some((g) => g.key === openKey)) {
						openKey = null;
						unpin();
					}
				}}
			>
				<span>advisories <span class="note-count">{notes.length}</span></span>
				<span aria-hidden="true">{notesOpen ? '−' : '+'}</span>
			</button>
			{#if notesOpen}
				<div class="chips" id="hint-advisories" transition:slide={{ duration: reducedMotion() ? 0 : 210 }}>
					{#each noteGroups as group, gi (group.key)}
						{@render hintGroup(group, issueGroups.length + gi)}
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- crossed-off rules: one quiet line of struck codes; a click brings
	     the hint back -->
	{#if plan.waivedHints.length}
		<div class="waived">
			<span class="waived-head">crossed off</span>
			{#each plan.waivedHints as hint (hint.id)}
				{@const target = targetOf(hint.codes)}
				<button class="wv" title="{hint.text}, click to bring it back" onclick={() => plan.unwaiveHint(hint.id!)}>
					<s>{target ? plan.shownCode(target) : heading(hint)}</s>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.section {
		@include rail-section;

		// how many of the hints below need fixing, one badge per severity
		.tally {
			display: inline-flex;
			gap: 0.4rem;
		}

		.tally-item {
			display: inline-flex;
			align-items: center;
			gap: 0.4rem;
			height: 1.9rem;
			padding: 0 0.6rem;
			font-size: 1.15rem;
			font-weight: 700;
			letter-spacing: 0;
			font-family: inherit;
			border-radius: var(--rail-radius, 4px);
			box-shadow: var(--shadow-inset);
			cursor: pointer;
			transition:
				opacity 0.15s ease,
				filter 0.15s ease;

			&:hover {
				filter: brightness(0.97);
			}

			&[data-kind='warn'] {
				color: var(--color-danger-deep);
				background-color: var(--color-hint-warn);
				border: 1px solid color-mix(in srgb, var(--color-hint-warn-deep) 60%, transparent);
			}

			&[data-kind='caution'] {
				color: color-mix(in srgb, var(--color-hint-caution-deep) 55%, var(--color-text));
				background-color: var(--color-hint-caution);
				border: 1px solid color-mix(in srgb, var(--color-hint-caution-deep) 60%, transparent);
			}

			// filtered out of the list: the badge goes pale and flat
			&.off {
				opacity: 0.45;
				box-shadow: none;
			}
		}

		.tally-mark {
			@include severity-mark;
			width: 0.85rem;
			height: 0.85rem;
		}
	}

	.hint-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding: 0.8rem 1rem;
		font: inherit;
		font-weight: 500;
		text-align: left;
		color: inherit;
		background: transparent;
		border: 0;
		border-radius: 0;
		cursor: pointer;
	}

	.chip[data-kind='warn'] .hint-heading {
		font-weight: 650;
	}

	.hint-main {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}

	// a wrapped heading hangs off its mark: the second line lines up with
	// the first word, not under the mark
	.hint-title {
		padding-left: 1.6rem;
		text-indent: -1.6rem;
	}

	// the courses a row is about, as tiny chips in their own colours,
	// the same fill they wear on the grid
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding-left: 1.6rem;
	}

	.tag {
		@include course-tag;
	}

	.count {
		margin-left: 0.5rem;
		font-size: 1.15rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
	}

	// a single hint's sentence is its heading: ordinary weight, so a stack of
	// them reads as sentences, not shouting
	.chip.single .hint-heading {
		font-weight: 450;
	}

	.chip.single[data-kind='warn'] .hint-heading {
		font-weight: 500;
	}

	.tag-more {
		font-size: 1.1rem;
		color: var(--color-text-muted);
	}

	.chev {
		@include fold-chevron;
		margin: 0.6rem 0.4rem 0 0;
	}

	// an open group's hints read as subtext under its heading, no box,
	// muted, indented to start where the heading's words do
	// a hint's sentence, with its course list under it
	.line {
		flex: 1;
		min-width: 0;
	}

	// the courses still to place, one per line on a small bullet
	.to-place {
		margin: 0.4rem 0 0;
		padding: 0;
		list-style: none;

		li {
			position: relative;
			padding-left: 1.2rem;

			&::before {
				content: '•';
				position: absolute;
				left: 0.2rem;
				top: 50%;
				translate: 0 -50%;
				color: var(--color-text-muted);
			}
		}

		button {
			padding: 0;
			font: inherit;
			font-size: 1.2rem;
			font-weight: 650;
			line-height: 1.7;
			color: var(--color-text);
			background: none;
			border: 0;
			cursor: pointer;

			&:hover,
			&:focus-visible {
				text-decoration: underline;
				text-underline-offset: 0.2em;
			}

			// a phone's 44px touch floor would space a short list of codes far apart
			@include mobile {
				min-height: 3.4rem;
			}
		}
	}

	.hint-detail {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		margin: 0;
		padding: 0 0.8rem 0.8rem;
		list-style: none;

		// each hint in a group its own small block, so two sentences about
		// different courses don't run together: a lighter face, the site's lit
		// top edge (--shadow-inset), and a soft shadow underneath
		> li {
			display: flex;
			align-items: flex-start;
			gap: 0.6rem;
			padding: 0.7rem 0.9rem;
			background: color-mix(in srgb, var(--color-bg-light) 55%, transparent);
			border-radius: 0.6rem;
			box-shadow:
				var(--shadow-inset),
				0 1px 2px color-mix(in srgb, var(--tone-deep) 45%, transparent);
			transition: background-color 0.15s ease;
		}

		// the hint about the course open on the right
		li.here .chip-text {
			color: var(--color-text);
		}

		// the line whose courses are lit on the grid
		li.lit {
			background: var(--color-bg-light);
		}

		li.lit .chip-text {
			color: var(--color-text);
			font-weight: 600;
		}
	}

	// a single hint's sentence is its heading; what's left under it (a
	// waiver link, courses to place) sits plain, not in a block of its own
	.chip.single .hint-detail {
		padding-left: calc(1rem + 1.6rem);

		> li {
			padding: 0;
			background: none;
			box-shadow: none;
		}
	}

	// severity rides on a small mark, its shape says how bad, not a whole
	// tinted box per hint
	.tone-dot {
		@include severity-mark;
		margin-right: 0.68rem; // mark + gap = the 1.6rem the wrapped line hangs by
		vertical-align: -0.05em;
	}

	// a stack of cards, a little apart, inside the panel's gutter
	.chips {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.6rem var(--panel-gutter) 1.2rem;
	}

	// one card per kind of hint, a soft fill in its severity's colour with a
	// thin border to match; the mark in front still says how bad, by shape
	.chip {
		--tone: var(--color-hint-info);
		--tone-deep: var(--color-hint-info-deep);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		overflow: hidden;
		font-size: var(--text-body);
		line-height: 1.5;
		text-align: left;
		color: var(--color-text);
		background: color-mix(in srgb, var(--tone) 75%, transparent);
		border: 1px solid color-mix(in srgb, var(--tone-deep) 55%, transparent);
		border-radius: 0.7rem;
		user-select: none; // quick clicks were selecting the text instead
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		&[data-kind='warn'] {
			--tone: var(--color-hint-warn);
			--tone-deep: var(--color-hint-warn-deep);
		}

		&[data-kind='caution'] {
			--tone: var(--color-hint-caution);
			--tone-deep: var(--color-hint-caution-deep);
		}

		&[data-kind='good'] {
			--tone: var(--color-hint-good);
			--tone-deep: var(--color-hint-good-deep);
		}

		// pointed at or open: the fill comes up to full strength
		&:hover,
		&.open {
			background: var(--tone);
			border-color: var(--tone-deep);
		}

		// the text fills the row beside the cross-off ×
		// (a button can't nest inside a button)
		.chip-text {
			flex: 1;
			min-width: 0;
			padding: 0;
			font: inherit;
			line-height: inherit;
			text-align: left;
			color: color-mix(in srgb, var(--color-text) 80%, transparent);
			background: none;
			border: 0;
			cursor: pointer;
		}

		// the ones naming a course jump to it
		.chip-text.jump:hover {
			color: var(--color-text);
			text-decoration: underline;
		}

		// a course in a hint's sentence: a step darker than the words around
		// it, underlined when pointed at, like the choices list
		.code {
			padding: 0;
			font: inherit;
			font-weight: 650;
			color: var(--color-text);
			background: none;
			border: 0;
			cursor: pointer;

			&:hover,
			&:focus-visible {
				text-decoration: underline;
				text-underline-offset: 0.2em;
			}
		}

		// only ever on a warn chip, the rules a student can hold a waiver for.
		// faint until the line is pointed at, then a quiet link; fades, never pops
		.waive {
			flex: none;
			padding: 0;
			font: inherit;
			font-size: 1.1rem;
			white-space: nowrap;
			color: var(--color-text-muted);
			background: none;
			border: 0;
			cursor: pointer;
			opacity: 0;
			transition:
				opacity 0.18s ease,
				color 0.15s ease;

			&:hover,
			&:focus-visible {
				color: var(--color-text);
				text-decoration: underline;
				text-underline-offset: 0.2em;
			}
		}

		.hint-detail > li:hover .waive,
		.hint-detail > li:focus-within .waive {
			opacity: 0.85;
		}

		// no hover on a phone: always there, quietly
		@include touch {
			.waive {
				opacity: 0.6;
			}
		}

		// a phone's 44px touch floor is for standalone buttons, not words in a sentence
		@include mobile {
			.code,
			.waive {
				min-width: 0;
				min-height: 0;
			}
		}
	}

	// the notes under the issues: facts, not problems, quieter, so they
	// never read as a second wall of warnings
	// the notes under the issues, set off by a dotted rule that runs edge to edge
	.notes {
		padding-top: 0;
		border-top: 1px solid var(--color-border-divider);

		.chips {
			padding-top: 0;
		}
	}

	.notes-toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 1.2rem var(--panel-gutter);
		font: inherit;
		font-size: 1.2rem;
		color: var(--color-text-muted);
		text-align: left;
		background: none;
		border: 0;
		cursor: pointer;
		&:hover {
			color: var(--color-text);
		}
	}

	.note-count {
		margin-left: 0.4rem;
		font-variant-numeric: tabular-nums;
	}

	.all-clear {
		padding: 1.2rem var(--panel-gutter) 1.4rem;
		font-size: var(--text-body);
		color: var(--color-text-muted);
	}

	// crossed-off rules live below the live hints, quiet and struck through,
	// still visible, so a waiver is a decision the student can see and undo,
	// not a hint that silently vanished
	.waived {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.8rem;
		padding: 0 var(--panel-gutter) 1.4rem;
		font-size: 1.2rem;
		color: var(--color-text-muted);
	}

	.wv {
		padding: 0;
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;

		&:hover {
			color: var(--color-text);
		}
	}

	// by finger: each hint row a fingertip tall
	@include touch {
		.hint-heading {
			padding-top: 1.1rem;
			padding-bottom: 1.1rem;
		}
	}
</style>

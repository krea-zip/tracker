<script lang="ts">
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import PixelIcon from '$lib/ui/PixelIcon.svelte';
	import { usePlan } from '$lib/planner/context';
	import CourseFaculty from './CourseFaculty.svelte';
	import { prereqStatus, spelled } from './prereqStatus';
	import { runGrid } from './runGrid';
	import {
		DATA_UPDATED,
		baseCode,
		byCode,
		canAudit,
		capstoneAbout,
		facultyOf,
		hasCode,
		isAttemptId,
		isCore,
		subjectById,
		termsOffered
	} from '$lib/curriculum/data';
	import { runText } from '$lib/planner/board/views';
	import { reducedMotion } from '$lib/ui/transitions';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { termMonthsShort } from '$lib/planner/calendar';
	import { descriptionOf, loadDescriptions } from '$lib/curriculum/descriptions.svelte';
	import { viewport } from '$lib/planner/viewport.svelte';
	import { GRADE_SCALE, OTHER_MARKS, type GradeMark } from '$lib/planner/grades/grades';

	const plan = usePlan();
	// the panel keeps showing the last course picked, so it can slide out
	// without emptying and a pinned panel stays put when you click away
	let shown = $state.raw(plan.selected);
	$effect(() => {
		if (plan.selected) shown = plan.selected;
	});
	let {
		canPin = false,
		pinned = false,
		onTogglePin
	}: { canPin?: boolean; pinned?: boolean; onTogglePin?: () => void } = $props();
	// only jump to codes that exist in the catalogue; others stay plain text
	function jump(code: string) {
		plan.revealCourse(code);
	}

	// descriptions ship in their own chunk. The page asks for it on idle; if a
	// course is selected before that, ask right now, whichever lands first,
	// every course fills in from then on
	$effect(() => {
		if (shown) loadDescriptions();
	});

	const DESC_FOLD = 260;
	const clip = (text: string, max: number) => `${text.slice(0, text.lastIndexOf(' ', max)).replace(/[\s,;:]+$/, '')}…`;
	let descOpenFor = $state<string | null>(null);
	let descOpen = $derived(descOpenFor !== null && descOpenFor === shown?.code);

	// the board entry the panel is about: the course itself, or one of its
	// failed attempts (COMP201~1) when that is what was clicked
	let sid = $derived(
		plan.selectedId && baseCode(plan.selectedId) === shown?.code ? plan.selectedId : (shown?.code ?? '')
	);
	let isAttempt = $derived(isAttemptId(sid));
	let attemptsHere = $derived(shown ? plan.attemptsOf(shown.code) : []);
	let failed = $derived(plan.gradeOf(sid) === 'U');
	// a cross-listed course two or more of your programmes could take: you
	// pick where its credits go, at least one, as many as all of them
	let creditOpts = $derived(shown && !isAttempt && plan.onBoard(shown.code) ? plan.creditOptions(shown.code) : []);
	let countedIn = $derived(shown ? (plan.claims.get(shown.code) ?? []) : []);
	let chosenByYou = $derived(!!shown && !!plan.countsToward[shown.code]);
	function toggleCount(code: string, i: number) {
		const next = countedIn.includes(i) ? countedIn.filter((x) => x !== i) : [...countedIn, i];
		if (!next.length) return; // it has to count somewhere
		plan.setCountsToward(
			code,
			creditOpts.filter((x) => next.includes(x)).map((x) => plan.programmes[x].subject)
		);
	}
	let roles = $derived(shown ? plan.rolesIn(shown.code) : []);

	// separate courses that stand in for this one or it for them; never the
	// same course under another code, which is cross-listing
	let swaps = $derived.by(() => {
		const c = shown;
		if (!c) return [];
		const others = c.substitutes?.length === 1 ? 'the other' : 'the others';
		return [
			{
				label: 'either one counts',
				codes: c.substitutes ?? [],
				why: `separate courses, not one cross-listed course: take any one and you won't need ${others}`
			},
			{
				label: 'counts for',
				codes: c.covers ?? [],
				why: "taking this clears these too, so you won't need them as well"
			},
			{ label: 'or instead', codes: c.coveredBy ?? [], why: 'any of these clears this one' }
		]
			.map((s) => ({ ...s, codes: s.codes.filter(hasCode) }))
			.filter((s) => s.codes.length);
	});
	// worth spelling out only when the departments disagree
	// who teaches it, shown under "about the course" (never for the KCCS core)
	let hasTeachers = $derived(!!shown && !isCore(shown.code) && (facultyOf(shown.code).length > 0 || !!shown.faculty));
	let rolesDiffer = $derived(new Set(roles.map((r) => r.role)).size > 1);

	// ── placing it without dragging ──
	// where the course sits now, and the trimester the picker offers: its own
	// slot if it's placed, otherwise the first one it fits cleanly into
	let placedAt = $derived(plan.placed.find((p) => p.code === shown?.code) ?? null);
	let target = $derived.by(() => {
		const code = shown?.code;
		if (!code) return '';
		if (placedAt) return `${placedAt.year}-${placedAt.trim}`;
		for (const y of plan.years) for (const t of plan.trims) if (plan.canDrop(code, y, t)) return `${y}-${t}`;
		return '2-1';
	});
	let moving = $derived(!!placedAt && target !== `${placedAt.year}-${placedAt.trim}`);
	function placeIt() {
		const code = shown?.code;
		if (!code || !target) return;
		const [y, t] = target.split('-').map(Number);
		plan.place(code, y, t as 1 | 2 | 3);
	}

	// ── when it ran: the offered tile opens the course's history, term by
	//    term, against the timetables on record (it stays open between courses) ──
	let ranOpen = $state(false);
	// the academic year the course sits in on your plan, "26" for 26 to 27
	let placedYY = $derived(placedAt ? String(plan.batchStartYear + placedAt.year - 1).slice(-2) : null);

	function termLabel(year: number, trim: number) {
		return `Year ${year} · Trimester ${trim}`;
	}

	const statusOf = (pre: string) => prereqStatus(plan, pre, placedAt);

	// shut on Esc, unless a dialog is open, which Esc closes first
	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape' && !e.defaultPrevented && plan.selected && !document.querySelector('.backdrop'))
			plan.selected = null;
	}
</script>

<svelte:window onkeydown={onkey} />

<PanelHeader title="course" class="col-header">
	{#if canPin || shown}
		<div class="header-actions">
			{#if canPin}
				<button
					class="pin"
					aria-label={pinned ? 'unpin course details' : 'pin course details'}
					aria-pressed={pinned}
					title={pinned ? 'unpin course details' : 'keep course details open'}
					onclick={onTogglePin}><PixelIcon name="pin" size="1.6rem" snap /></button
				>
			{/if}
			{#if !canPin}
				<button
					class="close"
					aria-label="close course details"
					title="close (Esc)"
					onclick={() => (plan.selected = null)}>×</button
				>
			{/if}
		</div>
	{/if}
</PanelHeader>
{#if shown}
	{@const c = shown}
	{@const ran = termsOffered(c.code)}
	{@const desc = descriptionOf(c.code) ?? capstoneAbout(c.code)}
	<div class="details">
		<div class="d-card">
			<div class="d-head">
				{#if plan.showCodes}<span class="d-code">{c.code}</span>{/if}
				<span class="d-title">{c.title}</span>
				{#if plan.showCodes && c.codes.length > 1}
					<span class="d-xlist">cross-listed as {c.codes.filter((x) => x !== c.code).join(' · ')}</span>
				{/if}
			</div>

			{#if c.pendingCredits && c.credits === 0}<p class="d-no-audit d-pending">
					Offered in T2. Credits and prerequisites were not supplied; confirm these in admin before planning this
					course.
				</p>{/if}
			<div class="d-meta">
				<div class="d-stat">
					<span class="d-stat-label">credits</span>
					<span class="d-stat-value">{c.pendingCredits && c.credits === 0 ? 'TBC' : c.credits}</span>
				</div>
				<!-- opens when it ran, term by term -->
				<button
					class="d-stat d-stat-btn"
					class:open={ranOpen}
					aria-expanded={ranOpen}
					aria-controls="d-runs"
					title={ranOpen ? 'hide when it ran' : 'when it ran, term by term'}
					onclick={() => (ranOpen = !ranOpen)}
				>
					<span class="d-stat-label">offered</span>
					<span class="d-stat-value">{c.offered.map((t) => `t${t}`).join(' ') || '–'}</span>
					<span class="d-stat-sub"
						>{ran.length ? `last ${ran[0]}` : 'no record'} <i class="d-caret" aria-hidden="true">▾</i></span
					>
				</button>
				<div class="d-stat">
					<span class="d-stat-label">type</span>
					<span class="d-stat-value">{plan.courseType(c.code)}</span>
					{#if rolesDiffer}
						{@const elsewhere = roles.filter((r) => r.role !== plan.courseType(c.code))}
						{#if elsewhere.length}<span
								class="d-stat-sub wraps"
								title="each department decides what a cross-listed course is to it"
								>{elsewhere[0].role} in {elsewhere[0].scope}</span
							>{/if}
					{/if}
				</div>
			</div>

			{#if ranOpen}
				<div class="d-runs" id="d-runs" transition:slide={{ duration: reducedMotion() ? 0 : 210, easing: cubicOut }}>
					<table>
						<caption>when it ran</caption>
						<colgroup><col class="years" /><col /><col /><col /></colgroup>
						<thead>
							<tr>
								<th></th>
								{#each plan.trims as t (t)}
									<th scope="col" class:mine={placedAt?.trim === t}
										>{plan.trimNaming === 'year' ? `t${t}` : termMonthsShort(t)}{#if placedAt?.trim === t}<span
												class="d-runs-tag">your plan</span
											>{/if}</th
									>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each runGrid(c.code) as row (row.yy)}
								<tr>
									<th scope="row">{row.yy} to {Number(row.yy) + 1}</th>
									{#each row.cells as cell (cell.trim)}
										<td
											class:mine={placedAt?.trim === cell.trim}
											class:at={placedYY === row.yy && placedAt?.trim === cell.trim}
											><i class="d-run" data-state={cell.state} role="img" aria-label={cell.label} title={cell.label}
											></i></td
										>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
					{#if placedAt}
						<p class="d-runs-say">in t{placedAt.trim}: {runText(c.code, placedAt.trim)}</p>
					{/if}
					<p class="d-runs-key">
						<i class="d-run" data-state="ran"></i> ran <i class="d-run" data-state="not"></i> didn't run
						<i class="d-run" data-state="none"></i> no timetable
					</p>
					<button class="d-runs-go" onclick={() => (plan.view = 'runs')}
						>check every course on your plan: will it run? →</button
					>
				</div>
			{/if}
		</div>

		<!-- what you do with the course on YOUR plan, and how it fits your degree -->
		<div class="d-card">
			<section class="d-section" aria-labelledby="d-sec-plan">
				<h3 class="d-section-title" id="d-sec-plan">your plan</h3>

				<!-- where it is on the plan, and a way to put it there without
			     dragging, keyboard, touch, or just quicker. the picker shows the
			     current trimester, so the button only turns up with something to do -->
				<div class="d-place-row">
					<label class="d-where">
						<span>{placedAt ? 'in' : 'put in'}</span>
						<select id="course-trimester" bind:value={target} aria-label="trimester to put {c.code} in">
							{#each plan.years as y (y)}
								{#each plan.trims as t (t)}
									<option value="{y}-{t}" disabled={plan.coreOnly(y, t) && !isCore(c.code)}>
										{plan.trimName(y, t)}{c.offered.length && !c.offered.includes(t) ? ' · not offered' : ''}
									</option>
								{/each}
							{/each}
						</select>
					</label>
					{#if !placedAt || moving}
						<button class="d-place-go" onclick={placeIt}
							>{placedAt ? 'move' : attemptsHere.length ? 'add another attempt' : 'add to plan'}</button
						>
					{/if}
					{#if placedAt}
						<button class="d-place-remove" onclick={() => plan.remove(c.code)}>remove</button>
					{/if}
				</div>

				{#if plan.onBoard(sid)}
					{#key sid}
						<details class="d-disclosure" open={plan.gradeMode || plan.isAudit(sid) || failed}>
							<summary
								><span>{plan.gradeMode ? 'grade, audit & result' : 'audit & result'}</span><span
									class="chev"
									aria-hidden="true"
								></span></summary
							>
							<div class="d-disclosure-body">
								{#if plan.gradeMode}
									<!-- grade dropdown: letters count toward CGPA, Withdrawn / Incomplete
					     don't. Hidden while auditing, since an audit carries no grade. -->
									{#if !plan.isAudit(sid)}
										<label class="d-grade">
											<span>grade</span>
											<select
												value={plan.gradeOf(sid) ?? ''}
												onchange={(e) => plan.setGrade(sid, (e.currentTarget.value || null) as GradeMark | null)}
											>
												<option value="">not graded</option>
												{#each OTHER_MARKS as m (m.mark)}
													<option value={m.mark}>{m.label}</option>
												{/each}
												<optgroup label="grade">
													{#each GRADE_SCALE as g (g.letter)}
														<option value={g.letter}>{g.letter} · {g.points}</option>
													{/each}
												</optgroup>
											</select>
										</label>
									{/if}
									<!-- audit sits under the grade, taking a course off the CGPA -->
									{#if canAudit(c.code) && !isAttempt}
										<label class="d-audit">
											<input
												type="checkbox"
												checked={plan.isAudit(c.code)}
												onchange={() => {
													plan.toggleAudit(c.code);
													if (plan.isAudit(c.code)) plan.setGrade(c.code, null);
												}}
											/>
											<span>audit this course (no credits or grade)</span>
										</label>
									{/if}
								{:else if canAudit(c.code) && !isAttempt}
									<label class="d-audit">
										<input type="checkbox" checked={plan.isAudit(c.code)} onchange={() => plan.toggleAudit(c.code)} />
										<span>audit this course (no credits or grade)</span>
									</label>
								{/if}

								<!-- failing, grade view or not: this attempt stays on the grid, faded,
				     as a record (a U), and the course is free to place again, the copy -->
								<label class="d-audit" class:off={plan.isAudit(sid)}>
									<input
										type="checkbox"
										checked={failed}
										disabled={plan.isAudit(sid)}
										onchange={(e) => plan.setGrade(sid, e.currentTarget.checked ? 'U' : null)}
									/>
									<span>mark as failed</span>
								</label>
								{#if isAttempt}
									<p class="d-fail-note">
										This attempt stays on the grid, faded, as a U. {plan.onBoard(c.code)
											? 'The copy is on your plan.'
											: 'Place a copy: pick a trimester above, or drag the course from the catalogue.'}
									</p>
								{/if}

								{#if !plan.gradeMode && !canAudit(c.code) && !isAttempt}
									<!-- drop-form rule: audits are 2/4-credit courses, never KCCS/391/490/491 -->
									<p class="d-no-audit">this course can't be taken as an audit</p>
								{/if}
								{#if !viewport.desktop}
									<p class="d-no-audit">grades and your CGPA are on a laptop.</p>
								{/if}
							</div>
						</details>
					{/key}
				{/if}

				{#if creditOpts.length > 1}
					<!-- a cross-listed course: which of your programmes its credits go to.
					     folded, it says where they go now -->
					<details class="d-disclosure" open={chosenByYou}>
						<summary
							><span>counts toward</span><span class="d-summary-value"
								>{countedIn.map((i) => subjectById(plan.programmes[i].subject).label).join(' + ')}</span
							><span class="chev" aria-hidden="true"></span></summary
						>
						<div class="d-disclosure-body">
							{#each creditOpts as i (i)}
								{@const prog = plan.programmes[i]}
								{@const on = countedIn.includes(i)}
								{@const last = on && countedIn.length === 1}
								<!-- the last one ticked stays ticked: it has to count somewhere -->
								<label class="d-audit" title={last ? 'it has to count toward at least one' : undefined}>
									<input
										type="checkbox"
										checked={on}
										aria-disabled={last}
										onclick={(e) => last && e.preventDefault()}
										onchange={() => toggleCount(c.code, i)}
									/>
									<span
										>{subjectById(prog.subject).label}
										{prog.role}<span class="d-counts-code">{c.codesBySubject[prog.subject] ?? c.code}</span></span
									>
								</label>
							{/each}
							<p class="d-no-audit">
								at least one, up to all.
								{#if chosenByYou}<button class="d-counts-auto" onclick={() => plan.setCountsToward(c.code, null)}
										>back to automatic</button
									>{:else}picked automatically for now.{/if}
							</p>
						</div>
					</details>
				{/if}

				<!-- earlier attempts at this course, each opens its own record -->
				{#if attemptsHere.length}
					<div class="label">earlier attempts</div>
					<div class="d-chips">
						{#each attemptsHere as a (a.id)}
							<button class="d-chip" onclick={() => plan.select(a.id)}>
								{termLabel(a.year, a.trim)}<span class="d-chip-status">failed</span>
							</button>
						{/each}
					</div>
				{/if}
			</section>

			<!-- how it counts is the type tile's job (a cross-listed course's other
			     role sits under it); this is what stands in for it, and what comes
			     before and after -->
			{#if c.prereqs.length || c.unlocks.some(hasCode) || swaps.length}
				<section class="d-section" aria-labelledby="d-sec-degree">
					<h3 class="d-section-title" id="d-sec-degree">in your degree</h3>

					<!-- not the same course under another code (that's cross-listing,
					     under the title): different courses that clear each other's
					     requirement, e.g. Proofs and Ideas for Discrete Mathematics -->
					{#each swaps as swap (swap.label)}
						<div class="label">{swap.label}</div>
						<p class="d-swap-why">{swap.why}</p>
						<div class="d-chips d-related">
							{#each swap.codes as code (code)}
								<button
									class="d-chip"
									data-type={plan.courseType(code)}
									style:--hue={plan.hueOf(code)}
									onclick={() => jump(code)}
								>
									<span>{plan.courseLabel(code)}</span>
									{#if plan.onBoard(code)}<span class="d-chip-status">on your plan</span>{/if}
								</button>
							{/each}
						</div>
					{/each}

					<!-- Keep prerequisites visible; related courses can be explored on demand. -->
					{#if c.prereqs.length}
						<div class="label">needs first</div>
						<div class="d-chips d-related">
							{#each c.prereqs as p (p)}
								{#if hasCode(p)}
									{@const status = statusOf(p)}
									<span class="d-prereq">
										<button
											class="d-chip"
											data-type={plan.courseType(p)}
											style:--hue={plan.hueOf(p)}
											data-status={status.kind}
											title={status.title}
											onclick={() => jump(p)}
										>
											<span>{plan.courseLabel(p)}</span>
											<span class="d-chip-status">{status.text}</span>
										</button>
										<!-- missing: where it would fit, one click to put it there -->
										{#if status.fits}
											{@const fits = status.fits}
											<button
												class="d-add"
												title="add {plan.courseLabel(p)} to {spelled(plan, fits.year, fits.trim)}"
												onclick={() => plan.place(byCode(p).code, fits.year, fits.trim)}
												>+ {plan.trimName(fits.year, fits.trim)}</button
											>
										{/if}
									</span>
								{:else}
									<span class="d-chip" data-status="missing"
										>{p}<span class="d-chip-status">not in the catalogue</span></span
									>
								{/if}
							{/each}
						</div>
					{/if}

					{#if c.unlocks.some(hasCode)}
						{#key c.code}
							<details class="d-disclosure">
								<summary title="Courses that require this one; other prerequisites may also apply"
									><span>leads to</span><span class="d-count">{c.unlocks.filter(hasCode).length}</span><span
										class="chev"
										aria-hidden="true"
									></span></summary
								>
								<div class="d-disclosure-body">
									<div class="d-chips d-related">
										{#each c.unlocks.filter(hasCode) as u (u)}
											<button
												class="d-chip"
												data-type={plan.courseType(u)}
												style:--hue={plan.hueOf(u)}
												onclick={() => jump(u)}>{plan.courseLabel(u)}</button
											>
										{/each}
									</div>
								</div>
							</details>
						{/key}
					{/if}
				</section>
			{/if}
		</div>

		{#if desc || hasTeachers}
			<section class="d-card" aria-labelledby="d-sec-about">
				<div class="d-section">
					<h3 class="d-section-title" id="d-sec-about">about the course</h3>
					{#if desc}
						{@const long = desc.length > DESC_FOLD + 60}
						<p class="d-desc">
							{long && !descOpen ? clip(desc, DESC_FOLD) : desc}
							{#if long}
								<button class="d-more" aria-expanded={descOpen} onclick={() => (descOpenFor = descOpen ? null : c.code)}
									>{descOpen ? 'less' : 'more'}</button
								>
							{/if}
						</p>
					{/if}
				</div>

				{#if hasTeachers}
					<div class="d-section"><CourseFaculty course={c} /></div>
				{/if}
			</section>

			{#if DATA_UPDATED}<p class="catalogue-updated">
					Catalogue updated {DATA_UPDATED.toLocaleDateString('en-GB', {
						day: 'numeric',
						month: 'short',
						year: 'numeric',
						timeZone: 'UTC'
					})}
				</p>{/if}
		{/if}
	</div>
{:else}
	<p class="d-empty">Pick a course to see its details here.</p>
{/if}

<style lang="scss">
	@use '$lib/styles/mixins' as *;
	.catalogue-updated {
		font-size: 1.1rem;
		color: var(--color-text-muted);
		line-height: 1.5;
		margin: 0;
	}

	.d-empty {
		padding: var(--panel-gutter);
		font-size: var(--text-body);
		color: var(--color-text-muted);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.pin,
	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.8rem;
		height: 2.8rem;
		font-size: 2.2rem;
		line-height: 1;
		color: var(--color-text-muted);
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;

		&:hover {
			color: var(--color-text);
			background: var(--color-hover-medium);
		}
	}

	.pin[aria-pressed='true'] {
		color: var(--color-text);
		background: var(--color-hover-medium);
	}

	.d-disclosure {
		border-top: 1px solid var(--color-border-divider);

		summary {
			display: flex;
			align-items: center;
			gap: 0.6rem;
			padding: 0.7rem 0;
			font-size: 1.2rem;
			font-weight: 600;
			color: var(--color-text-muted);
			list-style: none;
			cursor: pointer;

			&::-webkit-details-marker {
				display: none;
			}
			&:hover {
				color: var(--color-text);
			}
		}

		.chev {
			flex: none;
			width: 0.7rem;
			height: 0.7rem;
			border-right: 1.5px solid var(--color-text-muted);
			border-bottom: 1.5px solid var(--color-text-muted);
			transform: rotate(-45deg);
			transition: transform 0.3s var(--spring);
			margin-left: auto;
			margin-right: 0.4rem;
		}

		&[open]:not(:global([data-closing])) .chev {
			transform: rotate(45deg);
		}
	}

	.d-count {
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--color-border-card);
		border-radius: 10px;
		font-size: 1rem;
		line-height: 1.2;
	}

	.d-disclosure-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.2rem 0 1rem;
	}

	.d-swap-why {
		margin: -0.2rem 0 0.6rem;
		font-size: 1.2rem;
		line-height: 1.4;
		color: var(--color-text-muted);
	}

	.d-related .d-chip {
		max-width: 100%;
		line-height: 1.35;
	}

	// "in [y3 t3 ▾]", a button when there's something to do, remove at the end
	.d-place-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 0.8rem;
		padding-bottom: 0.6rem;
	}

	.d-where {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: var(--text-body);
		color: var(--color-text-muted);

		select {
			@include flat-select;
			flex: none;
			width: auto;
			font: inherit;
			color: var(--color-text);
		}
	}

	.d-place-go {
		padding: 0.4rem 1.2rem;
		font: inherit;
		font-size: var(--text-body);
		font-weight: 600;
		color: var(--color-on-accent);
		background-color: var(--color-accent);
		border: 1px solid var(--color-control-deep);
		border-radius: 4px;
		cursor: pointer;
		@include glossy-accent;
	}

	// taking a course off the plan is a quiet word, not a second button
	.d-place-remove {
		margin-left: auto;
		padding: 0 0.4rem;
		font: inherit;
		font-size: var(--text-body);
		color: var(--color-text-muted);
		background: none;
		border: none;
		cursor: pointer;

		&:hover {
			color: var(--color-danger);
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: var(--card-gap);
		padding: var(--card-gap);

		.label {
			@include section-label;
			margin-top: 0.6rem;
		}
	}

	// one card per job: what the course is, what you do with it, what it's
	// about. the same surface as the sidebar's credit card
	.d-card {
		background: var(--color-bg-light);
		border: 1px solid var(--color-border-card);
		border-radius: 8px;
	}

	.d-section {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: var(--card-pad);

		& + & {
			border-top: 1px solid var(--color-border-divider);
		}
	}

	// a fold at the end of a section already has its own air
	.d-section:has(> .d-disclosure:last-child) {
		padding-bottom: 0.3rem;
	}

	.d-section-title {
		@include section-label;
		margin: 0;
	}

	.d-head {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: var(--card-pad);

		.d-code {
			font-size: 1.8rem;
			font-weight: 700;
		}

		.d-title {
			font-size: 1.4rem;
			line-height: 1.35;
		}

		.d-xlist {
			margin-top: 0.4rem;
			font-size: 1.2rem;
			font-weight: 600;
			color: var(--color-text-muted);
		}
	}

	.d-meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-top: 1px solid var(--color-border-divider);
	}

	.d-pending {
		padding: 0 var(--card-pad) var(--card-pad);
	}

	.d-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		min-height: 5rem;
		min-width: 0;
		padding: 0.6rem 0.4rem;
		background: transparent;
		border: 0;
		text-align: center;

		& + .d-stat {
			border-left: 1px solid var(--color-border-divider);
		}

		.d-stat-label {
			font-size: 1.1rem;
			color: var(--color-text-muted);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		.d-stat-value {
			font-size: 1.5rem;
			font-weight: 700;
			overflow-wrap: anywhere;
		}

		// when it last ran, under the trimesters it runs in
		.d-stat-sub {
			font-size: 1.1rem;
			color: var(--color-text-muted);
			white-space: nowrap;

			// "elective in computer science major" is longer than the tile
			&.wraps {
				white-space: normal;
				text-align: center;
				line-height: 1.3;
			}
		}
	}

	// the offered tile is a button: it opens when the course ran
	.d-stat-btn {
		font: inherit;
		color: inherit;
		background: var(--gloss-face);
		cursor: pointer;
		transition: background-color 0.15s ease;

		&:hover {
			background-color: var(--color-hover-medium);
		}

		.d-caret {
			display: inline-block;
			font-style: normal;
			transition: transform 0.26s var(--spring);
		}

		&.open {
			background-color: var(--color-active);

			.d-caret {
				transform: rotate(180deg);
			}
		}
	}

	// when it ran: trimesters down, academic years across
	.d-runs {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0.8rem var(--card-pad) var(--card-pad);
		border-top: 1px solid var(--color-border-divider);

		table {
			width: 100%;
			border-collapse: collapse;
			table-layout: fixed; // t1 t2 t3 get equal columns, tag or no tag
			font-size: 1.2rem;
		}

		col.years {
			width: 7.2rem;
		}

		caption {
			@include section-label;
			margin-bottom: 0.6rem;
			text-align: left;
		}

		th {
			font-weight: 600;
			color: var(--color-text-muted);
		}

		thead th {
			padding-bottom: 0.4rem;
			vertical-align: bottom;
			white-space: nowrap;
		}

		tbody th {
			padding: 0.4rem 0;
			font-size: 1.1rem;
			font-weight: 500;
			text-align: left;
			white-space: nowrap;
		}

		td {
			padding: 0.3rem 0;
			text-align: center;
		}

		// the trimester the course sits in on your plan, down its column
		thead th.mine {
			color: var(--color-accent);
		}

		td.mine {
			background: color-mix(in srgb, var(--color-accent) 6%, transparent);
		}

		// and the very term, when it's one on record
		td.at .d-run {
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 45%, transparent);
		}
	}

	.d-runs-tag {
		display: block;
		width: fit-content;
		margin: 0.2rem auto 0;
		padding: 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 650;
		color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		border-radius: 999px;
	}

	// one term: filled when it ran, an empty ring when it didn't, dotted when
	// there's no timetable for that term
	.d-run {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		vertical-align: middle;
		border-radius: 50%;
		border: 1.5px solid var(--color-text-muted);

		&[data-state='ran'] {
			background: var(--color-text);
			border-color: var(--color-text);
		}

		&[data-state='none'] {
			border-style: dotted;
			opacity: 0.6;
		}
	}

	.d-runs-say {
		margin: 0;
		font-size: 1.2rem;
		color: var(--color-text);
	}

	.d-runs-key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.6rem;
		margin: 0;
		font-size: 1.1rem;
		color: var(--color-text-muted);
	}

	.d-runs-go {
		align-self: flex-start;
		padding: 0;
		font: inherit;
		font-size: 1.2rem;
		color: var(--color-accent);
		background: none;
		border: 0;
		cursor: pointer;

		&:hover {
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}

	// SMS-bar: two flush segments in one tray, with a little retro depth, a
	// beveled tray, a lit groove between, and a recessed field
	.d-grade {
		display: flex;
		align-items: stretch;
		overflow: hidden;
		min-height: 3.6rem;
		background: linear-gradient(to bottom, var(--color-bg-card-start) 0%, var(--color-bg-card-end) 100%);
		border: 1px solid var(--color-border-card);
		border-radius: 9px;
		box-shadow: var(--shadow-inset);

		// the label segment, flush to the left edge
		span {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			padding: 0 1.1rem;
			font-size: 1.05rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--color-text-muted);
			// beveled groove: a shade then a lit edge
			border-right: 1px solid var(--color-border-card);
			box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.55);
		}

		// the recessed field, filling the rest
		select {
			flex: 1;
			min-width: 0;
			padding: 0 0.9rem;
			font-size: 1.35rem;
			font-weight: 600;
			color: var(--color-text);
			background: var(--color-bg-light);
			border: none;
			box-shadow: var(--shadow-well);
			cursor: pointer;
		}
	}

	// a folded disclosure says its current value after its name, quietly
	.d-summary-value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 400;
	}

	.d-counts-auto {
		padding: 0;
		font: inherit;
		color: var(--color-accent);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.d-counts-code {
		margin-left: 0.5rem;
		font-size: 1.1rem;
		color: var(--color-text-muted);
	}

	.d-audit {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: var(--text-body);
		color: var(--color-text);
		cursor: pointer;

		input {
			@include tick(1.5rem);
		}

		&.off {
			opacity: 0.5;
			cursor: default;

			input {
				cursor: default;
			}
		}
	}

	.d-no-audit,
	.d-fail-note {
		margin: 0;
		font-size: 1.2rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.d-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.d-chip {
		display: inline-flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.5rem 1rem;
		font-size: var(--text-body);
		font-weight: 600;
		color: var(--color-text);
		background-color: var(--color-bg-light);
		border: 1px solid var(--color-border-card);
		border-radius: 5px;
		text-align: left;
		cursor: pointer;
		@include glossy;
		@include course-type-fill(false);
		&[data-type] {
			background-image: var(--gloss-face);
		}
		// keep the lit face, drop only the outer shadow
		box-shadow: var(--shadow-inset);
		&:hover {
			box-shadow: var(--shadow-inset-hover);
		}

		// where the prerequisite stands, in words, with colour as a second cue
		.d-chip-status {
			font-size: 1.1rem;
			font-weight: 500;
			color: var(--color-text-muted);
		}

		// taken: a tick in green, darkened toward the text so the small green
		// reads at full strength; planned stays in the plain muted ink
		&[data-status='done'] .d-chip-status {
			font-weight: 600;
			color: color-mix(in srgb, var(--color-hint-good-deep) 75%, var(--color-text));
		}

		&[data-status='late'] {
			border-color: var(--color-danger);

			.d-chip-status {
				color: var(--color-danger);
				font-weight: 600;
			}
		}

		// the chip's own dark ink, so it reads on the glossy lower half of any
		// subject's colour; the square is the Hints panel's caution mark
		&[data-status='missing'] .d-chip-status {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			font-weight: 600;
			color: var(--course-ink);

			&::before {
				content: '';
				flex: none;
				width: 0.7rem;
				height: 0.7rem;
				background: var(--color-hint-caution-deep);
				border-radius: 1px;
			}
		}
	}

	// a prerequisite chip, and beside a missing one, where it would fit
	.d-prereq {
		display: flex;
		align-items: stretch;
		gap: 0.4rem;
		width: 100%;

		.d-chip {
			flex: 1;
			min-width: 0;
		}
	}

	// dashed like the board's suggested courses: something you could add
	.d-add {
		flex: none;
		min-width: 6.8rem;
		padding: 0 0.9rem;
		font: inherit;
		font-size: 1.2rem;
		font-weight: 700;
		white-space: nowrap;
		color: var(--color-accent);
		background: none;
		border: 1px dashed color-mix(in srgb, var(--color-accent) 60%, transparent);
		border-radius: 5px;
		cursor: pointer;
		font-variant-numeric: tabular-nums;

		&:hover {
			border-style: solid;
			background: color-mix(in srgb, var(--color-accent) 8%, transparent);
		}
	}

	.d-desc {
		margin: 0;
		font-size: var(--text-body);
		line-height: 1.5;
	}
	.d-more {
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--color-accent);
		background: none;
		border: 0;
		cursor: pointer;

		&:hover {
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}
	// by finger (a tablet's slid-in details too): the close and placing
	// controls a fingertip tall
	@include touch {
		.close {
			width: 4.4rem;
			height: 4.4rem;
			font-size: 2.6rem;
		}
		.d-disclosure summary,
		.d-place-go,
		.d-place-remove,
		.d-where select {
			min-height: 4.4rem;
		}
		.d-more {
			display: block;
			min-height: 3.2rem;
			text-align: left;
		}
	}
	@include mobile {
		:global(.col-header) {
			position: sticky;
			top: 0;
			z-index: 2;
			flex-shrink: 0;
			background: var(--color-bg-sidebar);
			padding: 0.8rem 1.8rem;
		}
		.close {
			width: 4.4rem;
			height: 4.4rem;
			font-size: 2.6rem;
		}
		.d-head .d-title {
			font-size: 2.4rem;
			line-height: 1.3;
		}
		.d-desc,
		.d-audit {
			font-size: 1.5rem;
		}
	}
</style>

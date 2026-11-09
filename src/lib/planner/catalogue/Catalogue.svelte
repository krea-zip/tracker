<script lang="ts">
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import { usePlan } from '$lib/planner/context';
	import PixelIcon from '$lib/ui/PixelIcon.svelte';
	import { tick } from 'svelte';
	import { COURSES } from '$lib/curriculum/data';
	import { offeredIn } from '$lib/planner/calendar';
	import { carried } from '$lib/planner/drag/courseDrag';
	import CatalogueCard from './CatalogueCard.svelte';
	import CatalogueAdvanced from './CatalogueAdvanced.svelte';
	import CatalogueFilters from './CatalogueFilters.svelte';
	import CatalogueRibbon from './CatalogueRibbon.svelte';

	let { mobile = false }: { mobile?: boolean } = $props();
	const plan = usePlan();

	let catalogueEl: HTMLDivElement;
	let advanced = $state(false);
	let ticks = $state<string[]>([]);
	$effect(() => {
		const request = plan.catalogueReveal;
		if (!request || mobile) return;
		let cancelled = false;
		void tick().then(() => {
			if (cancelled) return;
			const cell = Array.from(catalogueEl.querySelectorAll<HTMLElement>('[data-course]')).find(
				(el) => el.dataset.course === request.code
			);
			const card = cell?.querySelector<HTMLElement>('[data-course-card]');
			card?.focus({ preventScroll: true });
			cell?.scrollIntoView({
				block: 'center',
				behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
			});
		});
		return () => {
			cancelled = true;
		};
	});

	// which subject's code a cross-listed course should be shown under: the
	// active filter if it pins one down, else the single programme subject it
	// belongs to, otherwise leave it on its canonical code
	function contextFor(subjects: string[]): string | undefined {
		if (plan.catalogueSubject && subjects.includes(plan.catalogueSubject)) return plan.catalogueSubject;
		const checked = plan.filters.filter((f) => plan.selectedSubjects.includes(f) && subjects.includes(f));
		if (checked.length === 1) return checked[0];
		const inProgramme = plan.selectedSubjects.filter((s) => subjects.includes(s));
		return inProgramme.length === 1 ? inProgramme[0] : undefined;
	}

	// The highlight (outline + "showing" bar) holds until a click anywhere
	// else: the background, the grid, another course. A click on the card
	// itself or on the bar keeps it. A sidebar tag's press clears the old one
	// before its click reveals the new one.
	function clickAway(e: PointerEvent) {
		if (!plan.catalogueReveal) return;
		const target = e.target as Element | null;
		if (target?.closest('.cell.revealed, .reveal-note')) return;
		plan.catalogueReveal = null;
	}

	// dropping a course back on the catalogue removes it from the plan
	function drop(e: DragEvent) {
		e.preventDefault();
		const code = carried(e);
		if (code) plan.remove(code);
	}
</script>

<svelte:window onpointerdown={clickAway} />

<div
	class="catalogue"
	bind:this={catalogueEl}
	data-tour="catalogue"
	role="list"
	ondragover={(e) => e.preventDefault()}
	ondrop={drop}
>
	<PanelHeader title="catalogue" subtitle={mobile ? 'find your next course' : undefined} class="catalogue-header">
		<!-- how many the search and filters leave, out of the whole catalogue
		     (kccs foundation courses included) -->
		<span class="result-count" role="status" aria-label="{plan.catalogue.length} of {COURSES.length} courses"
			>{plan.catalogue.length}/{COURSES.length}</span
		>
	</PanelHeader>

	<!-- search + filters stay put while the cards scroll underneath -->
	<div class="controls">
		<div class="search-box">
			<span class="search-icon"><PixelIcon name="search" /></span>
			<input
				class="search"
				type="search"
				aria-label="search courses or lecturers"
				placeholder="search course or prof"
				bind:value={plan.search}
			/>
			{#if plan.search}
				<button class="clear-search" aria-label="clear search" onclick={() => (plan.search = '')}> × </button>
			{/if}
		</div>

		<CatalogueFilters />
	</div>
	<CatalogueRibbon bind:advanced {ticks} />
	<CatalogueAdvanced {advanced} bind:ticks />

	{#if plan.zoom}
		<div class="reveal-note">
			<span>offered in {offeredIn([plan.zoom.trim], plan.trimNaming)}</span><button onclick={() => (plan.zoom = null)}
				>show all terms ×</button
			>
		</div>
	{/if}
	{#if plan.catalogueReveal}
		<div class="reveal-note" role="status">
			<span>showing {plan.catalogueReveal.code}</span>
			<button onclick={() => (plan.catalogueReveal = null)} aria-label="return to catalogue filters">done ×</button>
		</div>
	{/if}
	<div class="scroll">
		<div class="cards">
			{#each plan.catalogue as course (course.code)}
				<div class="cell" class:revealed={plan.catalogueReveal?.code === course.code} data-course={course.code}>
					<CatalogueCard
						{mobile}
						{course}
						type={plan.courseType(course.code)}
						placed={plan.placedCodes.has(course.code)}
						contextSubject={contextFor(course.subjects)}
					/>
				</div>
			{:else}
				<div class="empty-results">
					<PixelIcon name="search" size="2.4rem" />
					<h3>no courses found</h3>
					<p>Try another course name, code or lecturer, or clear your filters.</p>
					<button
						onclick={() => {
							plan.search = '';
							plan.clearNarrowing();
							plan.zoom = null;
						}}>clear search & filters</button
					>
				</div>
			{/each}
		</div>
	</div>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// Search, filters and cards fit the column, including a custom dragged width.
	.catalogue {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;

		> :not(.controls),
		.search-box {
			contain: inline-size;
		}
		background: linear-gradient(to bottom, var(--color-bg-warm-start), var(--color-bg-warm-end));
		border-right: 1px solid var(--color-border-warm);
	}

	// search and filters, closed off from the cards below by a hairline that
	// runs edge to edge, like the sidebar's section rules
	.controls {
		flex-shrink: 0;
		padding: 1.6rem 1.4rem 0;
		// every fold open on a short laptop still leaves room for the cards
		max-height: 60%;
		overflow-y: auto;
	}

	.scroll {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 1rem 1.4rem 2.4rem;
	}

	.search-box {
		position: relative;
		display: flex;
	}

	// a text field is something you type INTO, recessed, not raised like the
	// buttons around it
	.search-icon {
		position: absolute;
		left: 1rem;
		top: 50%;
		transform: translateY(-50%);
		width: 1.5rem;
		height: 1.5rem;
		color: #969196;
		pointer-events: none;
	}
	// the iOS 6 search capsule: set into the panel, shaded along its top
	// inside edge, with a lit lip under it
	.search {
		width: 100%;
		padding: 0.75rem 3rem 0.75rem 3.2rem; // right padding reserves the × corner
		font-size: var(--text-body);
		color: var(--color-text);
		background: var(--color-bg-card-start);
		border: 1px solid color-mix(in srgb, var(--color-border) 45%, var(--color-border-card));
		border-radius: 999px;
		box-shadow:
			inset 0 1px 3px rgba(98, 58, 82, 0.25),
			0 1px 0 rgba(255, 255, 255, 0.8);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;

		&:focus {
			border-color: var(--color-accent);
		}

		&::placeholder {
			color: var(--color-text-muted);
		}

		// the button covers clearing, hide any native duplicate ×
		&::-webkit-search-cancel-button {
			display: none;
		}
	}

	// the round grey clear button iOS puts in its search field, springs in
	// when there's something to clear
	.clear-search {
		position: absolute;
		top: 50%;
		right: 0.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0 0 0.1rem;
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1;
		color: var(--color-bg-light);
		background: color-mix(in srgb, var(--color-text-muted) 75%, transparent);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		translate: 0 -50%;
		animation: clear-in 0.3s var(--spring) both;
		transition:
			background-color 0.15s ease,
			scale 0.12s ease;

		&:hover {
			background: var(--color-text-muted);
		}

		&:active {
			scale: 0.88;
		}
	}

	@keyframes clear-in {
		from {
			scale: 0.3;
			opacity: 0;
		}
	}

	.cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.95rem;
	}

	.reveal-note {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1.6rem;
		font-size: var(--text-body);
		color: var(--color-text-muted);
		button {
			border: 0;
			background: none;
			color: var(--color-accent);
			cursor: pointer;
			padding: 0.4rem;
		}
	}
	.revealed {
		border-radius: 6px;
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}
	.cell {
		display: grid; // so the card stretches
		min-width: 0; // long titles ellipsize instead of widening the column
	}
	// a small capsule, so the count reads as a tally rather than loose text
	.result-count {
		padding: 0.2rem 0.9rem;
		font-size: 1.2rem;
		font-variant-numeric: tabular-nums; // the digits don't jitter as filters change
		color: var(--color-text-muted);
		white-space: nowrap;
		background: color-mix(in srgb, var(--color-bg-light) 60%, transparent);
		border: 1px solid var(--color-border-card);
		border-radius: 999px;
	}
	.empty-results {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 1.2rem;
		padding: 3.2rem 1.2rem;
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--text-body);
		line-height: 1.6;
	}
	.empty-results h3 {
		color: var(--color-text);
	}
	.empty-results button {
		font: inherit;
		color: var(--color-accent);
		padding: 0.8rem 1.2rem;
		border: 1px solid var(--color-border-card);
		border-radius: 6px;
		background: var(--color-bg-light);
		cursor: pointer;
	}
	// by finger: a taller search field and filters, and ticks you can hit
	@include touch {
		.search {
			min-height: 4.4rem;
		}
		.clear-search {
			width: 4rem;
		}
	}
	@include mobile {
		.catalogue {
			border: 0;
		}
		.controls {
			padding: 1.4rem 1.8rem 0;
		}
		.search {
			padding-right: 4.8rem;
			min-height: 4.8rem;
		}
		.clear-search {
			width: 4.4rem;
			right: 0.3rem;
			background: transparent;
			color: var(--color-text-muted);
			font-size: 2.4rem;
		}
		.scroll {
			flex: 1;
			padding: 1rem 1.8rem 2rem;
			overscroll-behavior: contain;
		}
		.cards {
			grid-template-columns: minmax(0, 1fr);
			gap: 1.2rem;
		}
		.cell {
			grid-column: 1 / -1 !important;
		}
	}
	@include mobile {
		@container catalogue (min-width: 600px) {
			.cards {
				grid-template-columns: repeat(2, minmax(0, 1fr));
				align-items: start;
			}
			.cell {
				grid-column: auto !important;
			}
		}
		@container catalogue (min-width: 1000px) {
			.cards {
				grid-template-columns: repeat(3, minmax(0, 1fr));
			}
		}
	}
</style>

<script lang="ts">
	import Panel from '$lib/ui/Panel.svelte';
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import '$lib/site/directory.scss';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let query = $state('');
	let role = $state('all');
	const roles = ['all', 'major', 'minor', 'concentration'];
	const filtered = $derived(
		data.subjects.filter(
			(s) =>
				s.label.toLowerCase().includes(query.trim().toLowerCase()) &&
				(role === 'all' || s.offers.some((o) => o === role))
		)
	);
	function reset() {
		query = '';
		role = 'all';
	}
</script>

<svelte:head>
	<title>Programmes · tracker</title>
	<meta
		name="description"
		content="Explore majors, minors and concentrations at Krea. Compare credit requirements and find your programme's courses and student representatives."
	/>
</svelte:head>

<Panel class="directory">
	<PanelHeader
		title="programmes"
		level={1}
		subtitle="Majors, minors and concentrations · credits, courses and programme requirements."
		><span class="directory-count">{data.subjects.length} disciplines · {data.batches}</span></PanelHeader
	>
	<Toolbar tone="warm" class="directory-controls">
		<label class="search"
			>search<input type="search" bind:value={query} placeholder="Try economics, arts, computer science…" /></label
		>
		<div class="filters" role="group" aria-label="Programme type">
			{#each roles as r}<Button variant="pill" aria-pressed={role === r} onclick={() => (role = r)}
					>{r === 'all' ? 'all' : r}</Button
				>{/each}
		</div>
	</Toolbar>
	<Toolbar class="result-line">
		<p role="status">{filtered.length} of {data.subjects.length} disciplines</p>
		<span>Credit previews · 4-year pathway</span>
	</Toolbar>
	<ul class="cards">
		{#each filtered as s (s.slug)}
			<li style:--hue={s.hue ?? 300}>
				<a class="programme" href="/programmes/{s.slug}">
					<div class="card-top"><span class="course-count">{s.courses} courses</span></div>
					<h2>{s.label}</h2>

					<dl>
						{#each s.offers as offer}<div>
								<dt>{offer}</dt>
								<dd>{s.credits[offer]} <span>cr</span></dd>
							</div>{/each}
					</dl>
					<p class="card-foot">Explore requirements <span aria-hidden="true">↗</span></p>
				</a>
			</li>
		{/each}
	</ul>
	{#if !filtered.length}<div class="empty">
			<h2>No programmes found</h2>
			<p>Try another subject or programme type.</p>
			<Button variant="quiet" class="reset" onclick={reset}>clear filters</Button>
		</div>{/if}
	<p class="footnote">
		Credits shown are for a single major, minor or concentration on the 4-year pathway. Open a programme for 3-year and
		double-major requirements, course choices and student reps. Applies to the {data.batches}.
	</p>
</Panel>

<style lang="scss">
	@use '$lib/styles/mixins' as *;
	.programme {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1rem 1.2rem;
		color: var(--color-text);
		text-decoration: none;
		background: color-mix(in srgb, oklch(0.8 0.06 var(--hue)) 30%, var(--color-bg-light));
		border: 1px solid var(--color-border);
		border-radius: 4px;
		border-left: 4px solid oklch(0.65 0.09 var(--hue));
	}
	.programme:hover {
		background: color-mix(in srgb, oklch(0.8 0.06 var(--hue)) 42%, var(--color-bg-light));
	}
	.card-top {
		order: 2;
		margin-top: 0.5rem;
	}
	.course-count {
		font-size: 1.15rem;
		color: var(--color-text-muted);
	}
	h2 {
		font-size: 1.4rem;
		font-weight: 600;
	}
	dl {
		order: 3;
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1rem;
		margin: 0.8rem 0;
	}
	dl > div {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	dt {
		font-size: 1.1rem;
		color: var(--color-text-muted);
	}
	dd {
		font-size: 1.4rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	dd span {
		font-size: 1.05rem;
		font-weight: 400;
		color: var(--color-text-muted);
	}
	.card-foot {
		order: 4;
		display: flex;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.8rem;
		font-size: 1.1rem;
		border-top: 1px dotted var(--color-border-card);
	}
</style>

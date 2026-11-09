<script lang="ts">
	import Panel from '$lib/ui/Panel.svelte';
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Disclosure from '$lib/ui/Disclosure.svelte';
	import { page } from '$app/state';
	import CourseList from '$lib/site/CourseList.svelte';
	import { REPS_YEAR } from '$lib/curriculum/reps';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let selected = $state('');
	const current = $derived(
		data.programmes.find((p) => p.key === (selected || page.url.hash.slice(1))) ?? data.programmes[0]
	);
</script>

<svelte:head>
	<title>{data.subject.label} programmes · tracker</title>
	<meta
		name="description"
		content="The {data.subject.label} major, minor and concentration at Krea: credits, required courses and choices."
	/>
</svelte:head>

<Panel style={`--hue: ${data.subject.hue ?? 300}`}
	><div class="programme-page">
		<aside class="programme-sidebar">
			<Toolbar tone="warm"><a class="up" href="/programmes">← programmes</a></Toolbar>
			<PanelHeader title={data.subject.label} subtitle={data.batches} level={1} />
			<nav aria-label="Choose a programme pathway">
				<h2>pathway</h2>
				{#each data.programmes as p (p.key)}
					<button
						class:active={current?.key === p.key}
						aria-pressed={current?.key === p.key}
						onclick={() => (selected = p.key)}
					>
						<span>{p.label}</span><span class="nav-credits">{p.credits.total} cr</span>
					</button>
				{/each}
			</nav>
			{#if data.reps.length}
				<section class="reps">
					<h2>student reps <span>{REPS_YEAR}</span></h2>
					{#each data.reps as rep}<p>{rep}</p>{/each}
				</section>
			{/if}
			<p class="sidebar-note">Choose a pathway to see its required courses and electives.</p>
		</aside>

		<div class="requirements">
			{#if current}
				{#key current.key}
					<PanelHeader title={current.label} subtitle="programme requirements" id={current.key}>
						<div class="total"><strong>{current.credits.total}</strong><span>credits</span></div>
					</PanelHeader>
					<Toolbar class="credit-strip">
						{#if current.credits.required !== null}<span
								><i class="required-dot"></i><b>{current.credits.required}</b> required</span
							>{/if}
						{#if current.credits.elective !== null}<span
								><i class="elective-dot"></i><b>{current.credits.elective}</b> elective</span
							>{/if}
						<span class="scope">{data.batches}</span>
					</Toolbar>
					<Disclosure title="required courses" meta={`${current.required.length} listed`} open>
						<CourseList courses={current.required} empty="No fixed courses. See the choices below." />
					</Disclosure>
					{#each current.choices as choice, i (i)}
						<Disclosure title={choice.rule} meta={`choose ${choice.pick}`} open
							><CourseList courses={choice.options} /></Disclosure
						>
					{/each}
					{#if current.electives.length}
						<Disclosure title="electives that count" meta={`${current.electives.length} courses`}
							><CourseList courses={current.electives} /></Disclosure
						>
					{/if}
				{/key}
			{:else}<p class="sidebar-note">No requirements are listed for this programme yet.</p>{/if}
		</div>
	</div></Panel
>

<style lang="scss">
	@use '$lib/styles/mixins' as *;
	.programme-page {
		display: grid;
		grid-template-columns: 25rem minmax(0, 1fr);
	}
	.programme-sidebar {
		background: linear-gradient(var(--color-bg-sidebar), var(--color-bg-sidebar-end));
		border-right: 1px solid var(--color-border);
	}
	.up {
		color: var(--color-text-muted);
		font-size: var(--text-small);
	}
	nav {
		padding: 1rem;
	}
	nav h2,
	.reps h2 {
		@include section-label;
		margin: 0 0.6rem 0.8rem;
	}
	nav button {
		@include store-button;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.7rem 0.8rem;
		font: inherit;
		font-size: var(--text-small);
		text-align: left;
	}
	nav button.active {
		color: var(--color-on-accent);
		background-color: var(--color-accent);
		border-color: var(--color-control-deep);
		@include glossy-accent;
	}
	nav button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.nav-credits {
		white-space: nowrap;
		font-size: 1.1rem;
	}
	.reps {
		margin: 0 var(--panel-gutter);
		padding: 1.2rem 0;
		border-top: 1px dotted var(--color-border-card);
	}
	.reps h2 {
		margin-left: 0;
	}
	.reps h2 span {
		font-weight: 400;
		text-transform: none;
	}
	.reps p {
		margin-top: 0.4rem;
		font-size: var(--text-small);
	}
	.sidebar-note {
		padding: 1.2rem var(--panel-gutter);
		font-size: var(--text-small);
		line-height: 1.5;
		color: var(--color-text-muted);
	}
	.requirements {
		min-width: 0;
	}
	.total {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.total strong {
		font-size: 2.4rem;
		font-weight: 500;
	}
	.total span {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}
	:global(.credit-strip > span) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	:global(.credit-strip) i {
		width: 0.8rem;
		height: 0.8rem;
		border: 1px solid var(--color-border-card);
		border-radius: 2px;
	}
	.required-dot {
		background: var(--color-course-required-deep);
	}
	.elective-dot {
		background: var(--color-course-elective);
	}
	.scope {
		margin-left: auto;
		color: var(--bar-text-muted);
	}
	@media (max-width: 767px) {
		.programme-page {
			grid-template-columns: 1fr;
		}
		.programme-sidebar {
			border-right: 0;
			border-bottom: 1px solid var(--color-border);
		}
		nav {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.5rem;
		}
		nav h2 {
			grid-column: 1 / -1;
		}
		nav button {
			margin: 0;
		}
		.sidebar-note {
			display: none;
		}
	}
</style>

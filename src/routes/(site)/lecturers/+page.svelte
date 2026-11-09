<script lang="ts">
	import Panel from '$lib/ui/Panel.svelte';
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import '$lib/site/directory.scss';
	import Portrait from '$lib/lecturers/Portrait.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let query = $state('');
	let subject = $state('all');
	let teachingOnly = $state(false);
	const subjects = $derived(
		[...new Map(data.lecturers.flatMap((p) => p.subjects).map((s) => [s.id, s])).values()].sort((a, b) =>
			a.label.localeCompare(b.label)
		)
	);
	const filtered = $derived(
		data.lecturers.filter((p) => {
			const words = query.trim().toLowerCase().split(/\s+/);
			const text =
				`${p.name} ${p.title} ${p.email ?? ''} ${p.subjects.map((s) => s.label).join(' ')} ${p.searchCourses}`.toLowerCase();
			return (
				words.every((w) => text.includes(w)) &&
				(subject === 'all' || p.subjects.some((s) => s.id === subject)) &&
				(!teachingOnly || p.courses > 0)
			);
		})
	);
	function reset() {
		query = '';
		subject = 'all';
		teachingOnly = false;
	}
</script>

<svelte:head>
	<title>Lecturers · tracker</title>
	<meta
		name="description"
		content="Find Krea faculty by name, subject or course. Browse teaching history, office hours and contact details."
	/>
</svelte:head>

<Panel class="directory">
	<PanelHeader title="lecturers" level={1} subtitle="Find faculty, their courses, contact details and office hours."
		><span class="directory-count">{data.lecturers.length} people · Krea SIAS</span></PanelHeader
	>
	<Toolbar tone="warm" class="directory-controls">
		<label class="search"
			>search<input type="search" bind:value={query} placeholder="Search a name, subject or course…" /></label
		>
		<label
			>subject<select bind:value={subject}
				><option value="all">All subjects</option>{#each subjects as s}<option value={s.id}>{s.label}</option
					>{/each}</select
			></label
		>
		<div class="filters" role="group" aria-label="Directory scope">
			<Button variant="pill" aria-pressed={!teachingOnly} onclick={() => (teachingOnly = false)}>everyone</Button
			><Button variant="pill" aria-pressed={teachingOnly} onclick={() => (teachingOnly = true)}
				>with course history</Button
			>
		</div>
	</Toolbar>
	<Toolbar class="result-line">
		<p role="status">{filtered.length} of {data.lecturers.length} people</p>
		{#if query || subject !== 'all' || teachingOnly}<Button variant="quiet" class="reset" onclick={reset}
				>clear filters</Button
			>{:else}<span>Alphabetical · A–Z</span>{/if}
	</Toolbar>
	<ul class="cards">
		{#each filtered as p (p.id)}
			<li class="person">
				<a class="profile" href="/lecturers/{p.id}">
					<Portrait name={p.name} src={p.imageUrl} size="3.4rem" />
					<div>
						<h2>{p.name}</h2>
						<p class="position">{p.title || 'Faculty member'}</p>
					</div>
				</a>
				<div class="subjects">
					{#each p.subjects.slice(0, 3) as s}<span class="chip">{s.label}</span>{/each}{#if p.subjects.length > 3}<span
							class="chip">+{p.subjects.length - 3} more</span
						>{/if}
				</div>
				<p class="hours">
					<span class:available={!!p.officeHours} aria-hidden="true"></span>{p.officeHours
						? 'Office hours on profile'
						: 'Office hours not listed'}
				</p>
				<div class="card-foot">
					<a href="/lecturers/{p.id}"
						>{p.courses ? `${p.courses} course${p.courses === 1 ? '' : 's'} taught` : 'view profile'}
						<span aria-hidden="true">↗</span></a
					>{#if p.email}<a class="email" href="mailto:{p.email}" aria-label="Email {p.name}">email ↗</a>{/if}
				</div>
			</li>
		{/each}
	</ul>
	{#if !filtered.length}<div class="empty">
			<h2>No lecturers found</h2>
			<p>Try a different name, course or subject.</p>
			<Button variant="quiet" class="reset" onclick={reset}>clear filters</Button>
		</div>{/if}
	<p class="footnote">
		Subjects are based on recorded course history, rather than department membership. Course history does not confirm
		who is teaching this trimester.
	</p>
</Panel>

<style lang="scss">
	.person {
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 1rem 1rem 0;
		background: var(--color-bg-light);
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}
	.person:hover {
		background: var(--color-bg-sidebar);
	}
	.profile {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--color-text);
		text-decoration: none;
	}
	.profile > div {
		min-width: 0;
	}
	h2 {
		font-size: 1.3rem;
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.position {
		margin-top: 0.3rem;
		font-size: 1.15rem;
		color: var(--color-text-muted);
		line-height: 1.4;
	}
	.subjects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.6rem 0;
	}
	.hours {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: auto;
		padding-bottom: 0.6rem;
		color: var(--color-text-muted);
		font-size: 1.1rem;
	}
	.hours span {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--color-border-card);
	}
	.hours span.available {
		background: var(--color-hint-good-deep);
	}
	.card-foot {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-top: 1px dotted var(--color-border-card);
		padding: 0.6rem 0;
		font-size: 1.1rem;
	}
	.card-foot a {
		text-decoration: none;
	}
	.card-foot a:hover {
		text-decoration: underline;
	}
	.email {
		color: var(--color-text-muted);
	}
</style>

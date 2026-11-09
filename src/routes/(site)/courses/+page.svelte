<script lang="ts">
	import Panel from '$lib/ui/Panel.svelte';
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import '$lib/site/directory.scss';
	import Disclosure from '$lib/ui/Disclosure.svelte';
	import CourseList from '$lib/site/CourseList.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let query = $state('');
	let subject = $state('all');
	let credit = $state('all');
	const total = $derived(new Set(data.subjects.flatMap((s) => s.courses.map((c) => c.code))).size);
	const creditOptions = $derived(
		[...new Set(data.subjects.flatMap((s) => s.courses.map((c) => c.credits)))].sort((a, b) => a - b)
	);
	const filtered = $derived(
		data.subjects
			.filter((s) => subject === 'all' || subject === s.slug)
			.map((s) => ({
				...s,
				courses: s.courses.filter(
					(c) =>
						query
							.trim()
							.toLowerCase()
							.split(/\s+/)
							.every((q) => `${c.code} ${c.shownAs} ${c.title} ${s.label}`.toLowerCase().includes(q)) &&
						(credit === 'all' || c.credits === Number(credit))
				)
			}))
			.filter((s) => s.courses.length)
	);
	const count = $derived(new Set(filtered.flatMap((s) => s.courses.map((c) => c.code))).size);
	function reset() {
		query = '';
		subject = 'all';
		credit = 'all';
	}
</script>

<svelte:head
	><title>Courses · tracker</title><meta
		name="description"
		content="Search Krea undergraduate courses by title, code, subject and credits. Find prerequisites, teaching history and programme requirements."
	/></svelte:head
>
<Panel class="directory">
	<PanelHeader
		title="courses"
		level={1}
		subtitle="Course codes, credits and prerequisites · browse the undergraduate catalogue."
		><span class="directory-count">{total} courses · Krea SIAS</span></PanelHeader
	>
	<Toolbar tone="warm" class="directory-controls">
		<label class="search">search<input type="search" placeholder="course title or code…" bind:value={query} /></label>
		<label
			>subject<select bind:value={subject}
				><option value="all">all subjects</option>{#each data.subjects as s}<option value={s.slug}>{s.label}</option
					>{/each}</select
			></label
		>
		<label
			>credits<select bind:value={credit}
				><option value="all">any</option>{#each creditOptions as n}<option value={String(n)}>{n} cr</option
					>{/each}</select
			></label
		>
	</Toolbar>
	<Toolbar class="result-line">
		<p role="status">{count} of {total} courses · {filtered.length} subjects</p>
		{#if query || subject !== 'all' || credit !== 'all'}<Button variant="quiet" class="reset" onclick={reset}
				>clear filters</Button
			>{:else}<span>Cross-listed courses appear under each subject</span>{/if}
	</Toolbar>
	<div class="course-groups">
		{#each filtered as s (s.slug)}<Disclosure title={s.label} meta={String(s.courses.length)} open id={s.slug}
				><CourseList courses={s.courses} />
			</Disclosure>{/each}
	</div>
	{#if !filtered.length}<div class="empty">
			<h2>No courses found</h2>
			<p>Try another title, code or filter.</p>
			<Button variant="quiet" class="reset" onclick={reset}>clear filters</Button>
		</div>{/if}
</Panel>

<style>
	.course-groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: start;
	}
	@media (max-width: 850px) {
		.course-groups {
			grid-template-columns: 1fr;
		}
	}
</style>

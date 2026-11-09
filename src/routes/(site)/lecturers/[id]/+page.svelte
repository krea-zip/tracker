<script lang="ts">
	import { page } from '$app/state';
	import Panel from '$lib/ui/Panel.svelte';
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Disclosure from '$lib/ui/Disclosure.svelte';
	import CourseList from '$lib/site/CourseList.svelte';
	import Portrait from '$lib/lecturers/Portrait.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.name} · tracker</title>
	<meta
		name="description"
		content="{data.name}{data.title ? `, ${data.title}` : ''} at Krea: office hours and courses taught."
	/>
	<link rel="canonical" href="{page.url.origin}/lecturers/{data.id}" />
</svelte:head>
<div class="lecturer-page">
	<Panel>
		<Toolbar tone="warm"><a href="/lecturers">← lecturers</a></Toolbar>
		<PanelHeader title={data.name} subtitle={data.title || 'Faculty member'} level={1}>
			{#snippet leading()}<Portrait name={data.name} src={data.imageUrl} size="4.4rem" />{/snippet}
		</PanelHeader>
		<Disclosure title="contact & office hours" open>
			{#if data.email}<a class="email" href="mailto:{data.email}">{data.email}</a>{/if}
			{#if data.officeHours}<p class="label">office hours</p>
				<p class="hours">{data.officeHours}</p>{:else}<p class="note">Office hours are not listed.</p>{/if}
			{#if data.profileUrl}<div class="profile-link">
					<Button href={data.profileUrl}>university profile ↗</Button>
				</div>{/if}
		</Disclosure>
	</Panel>
	<Panel>
		<PanelHeader title="teaching history" subtitle="Past course records; instructors may change." />
		{#each data.recent as t (t.term)}<Disclosure title={t.term} meta={`${t.courses.length} courses`} open
				><CourseList courses={t.courses} /></Disclosure
			>{/each}
		<Disclosure title="all courses" meta={String(data.courses.length)} open={!data.recent.length}
			><CourseList courses={data.courses} empty="No course history is linked yet." /></Disclosure
		>
	</Panel>
</div>

<style lang="scss">
	.lecturer-page {
		display: grid;
		grid-template-columns: minmax(25rem, 1fr) minmax(0, 2fr);
		gap: var(--section-space);
		align-items: start;
	}
	a {
		color: var(--color-accent);
		font-size: var(--text-small);
		text-underline-offset: 0.2em;
	}
	.email {
		overflow-wrap: anywhere;
	}
	.label {
		margin: 1.2rem 0 0.5rem;
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-text-muted);
	}
	.hours {
		white-space: pre-line;
		line-height: 1.6;
	}
	.note {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin-top: 0.8rem;
	}
	.profile-link {
		margin-top: 1.2rem;
	}
	@media (max-width: 767px) {
		.lecturer-page {
			grid-template-columns: 1fr;
		}
	}
</style>

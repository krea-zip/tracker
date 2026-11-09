<script lang="ts">
	import { page } from '$app/state';
	import Panel from '$lib/ui/Panel.svelte';
	import PanelHeader from '$lib/ui/PanelHeader.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Disclosure from '$lib/ui/Disclosure.svelte';
	import CourseList from '$lib/site/CourseList.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const trimesters = (ts: number[]) => (ts.length ? ts.map((t) => `T${t}`).join(', ') : 'not recorded');
	const years = (ys: number[]) => (ys.length ? `year ${ys.join(', ')}` : 'any year');
</script>

<svelte:head>
	<title>{data.code} {data.title} · tracker</title>
	<meta
		name="description"
		content="{data.code} {data.title}: credits, prerequisites, course description and teaching history at Krea."
	/>
	<link rel="canonical" href="{page.url.origin}/courses/{data.code}" />
</svelte:head>

<div class="detail-page">
	<Panel>
		<Toolbar tone="warm"
			><a class="back" href="/courses">← courses</a>
			<div class="codes">
				{#each data.listings as l (l.code)}<a href={l.href} title={l.subject}>{l.code}</a>{/each}
			</div></Toolbar
		>
		<PanelHeader title={data.title} subtitle={data.subject} level={1}>
			<Button variant="primary" href="/?course={data.code}">plan this course →</Button>
		</PanelHeader>
		<Toolbar>
			<dl class="facts">
				<div>
					<dt>credits</dt>
					<dd>{data.creditsPending ? 'to be confirmed' : data.credits}</dd>
				</div>
				<div>
					<dt>recorded trimesters</dt>
					<dd>{trimesters(data.offered)}</dd>
				</div>
				<div>
					<dt>open to</dt>
					<dd>{years(data.eligibleYears)}</dd>
				</div>
				{#if data.terms.length}<div>
						<dt>last offered</dt>
						<dd>{data.terms[0]}</dd>
					</div>{/if}
			</dl>
		</Toolbar>
	</Panel>
	<div class="detail-columns">
		<Panel>
			<PanelHeader title="about this course" />
			{#if data.description}<div class="prose">{data.description}</div>{:else}<p class="note inset">
					No course description is available yet.
				</p>{/if}
			{#if data.programmes.length}
				<Disclosure title="in these programmes" meta={data.batches} open>
					<ul class="programme-list">
						{#each data.programmes as p (p.slug)}
							<li>
								<a href="/programmes/{p.slug}">{p.subject}</a>
								<div>
									{#if p.required.length}<p><b>required</b> · {p.required.join(', ')}</p>{/if}
									{#if p.choice.length}<p><b>one of a choice</b> · {p.choice.join(', ')}</p>{/if}
									{#if p.elective.length}<p><b>elective</b> · {p.elective.join(', ')}</p>{/if}
								</div>
							</li>
						{/each}
					</ul>
				</Disclosure>
			{/if}
		</Panel>
		<Panel>
			<PanelHeader title="planning & teaching" />
			<Disclosure title="before this" meta={String(data.prerequisites.length)} open>
				<CourseList courses={data.prerequisites} empty="No prerequisites." />
				{#if data.equivalents.length}<p class="note">Interchangeable courses (take one, not both):</p>
					<CourseList courses={data.equivalents} />{/if}
			</Disclosure>
			{#if data.unlocks.length}<Disclosure title="leads on to" meta={String(data.unlocks.length)} open
					><CourseList courses={data.unlocks} /></Disclosure
				>{/if}
			<Disclosure title="recently taught by" meta={String(data.lecturers.length)} open>
				{#if data.lecturers.length}<ul class="people">
						{#each data.lecturers as l (l.id)}<li>
								<a href="/lecturers/{l.id}">{l.name}</a>{#if l.title}<span>{l.title}</span>{/if}
							</li>{/each}
					</ul>{:else}<p class="note">No teaching records linked yet.</p>{/if}
				{#if data.terms.length}<p class="note">Recorded in {data.terms.join(', ')}. Instructors may change.</p>{/if}
			</Disclosure>
		</Panel>
	</div>
</div>

<style lang="scss">
	.detail-page {
		display: grid;
		gap: var(--section-space);
	}
	.detail-columns {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--section-space);
		align-items: start;
	}
	.back {
		color: var(--color-text-muted);
		font-size: var(--text-small);
	}
	.codes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-left: auto;
	}
	.codes a {
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--color-course-required-deep);
		border-radius: 3px;
		background: var(--color-course-required);
		font-weight: 600;
		text-decoration: none;
	}
	a {
		color: var(--color-accent);
		text-underline-offset: 0.2em;
	}
	.facts {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem 2.4rem;
		padding-block: 0.2rem;
	}
	.facts div {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
	}
	dt {
		color: var(--bar-text-muted);
		font-size: var(--text-small);
	}
	dd {
		font-weight: 600;
	}
	.prose {
		padding: var(--panel-gutter);
		font-size: var(--text-body);
		line-height: 1.65;
		white-space: pre-line;
		border-bottom: 1px dotted var(--color-border-card);
	}
	.note {
		margin-top: 0.8rem;
		color: var(--color-text-muted);
		font-size: var(--text-small);
		line-height: 1.5;
	}
	.inset {
		padding: var(--panel-gutter);
		margin: 0;
	}
	.programme-list,
	.people {
		list-style: none;
	}
	.programme-list li {
		display: grid;
		grid-template-columns: 10rem minmax(0, 1fr);
		gap: 1rem;
		padding: 0.7rem 0;
		border-bottom: 1px dotted var(--color-border-card);
	}
	.programme-list li:last-child {
		border-bottom: 0;
	}
	.programme-list p {
		color: var(--color-text-muted);
		font-size: var(--text-small);
		line-height: 1.5;
	}
	.programme-list b {
		color: var(--color-text);
		font-weight: 500;
	}
	.people li {
		display: grid;
		gap: 0.25rem;
		padding-block: 0.4rem;
	}
	.people span {
		color: var(--color-text-muted);
		font-size: var(--text-small);
	}
	@media (max-width: 850px) {
		.detail-columns {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 480px) {
		.programme-list li {
			grid-template-columns: 1fr;
			gap: 0.3rem;
		}
	}
</style>

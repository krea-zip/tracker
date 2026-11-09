<script lang="ts">
	// A list of courses as links to their pages: code, title, credits. A course
	// the catalogue doesn't have yet is named, unlinked.
	type Item = { code: string | null; title: string; credits?: number; shownAs?: string };
	let { courses, empty = 'None.' }: { courses: Item[]; empty?: string } = $props();
</script>

{#if courses.length}
	<ul class="courses">
		{#each courses as c, i (c.code ?? `${c.title}-${i}`)}
			<li>
				{#if c.code}
					<a href="/courses/{c.code}">
						<span class="code">{c.shownAs ?? c.code}</span>
						<span class="title">{c.title}</span>
						{#if c.credits !== undefined}<span class="credits">{c.credits} cr</span>{/if}
					</a>
				{:else}
					<span class="missing">
						<span class="code">–</span>
						<span class="title">{c.title}</span>
						<span class="credits">not in the catalogue yet</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">{empty}</p>
{/if}

<style lang="scss">
	.courses {
		list-style: none;
		display: grid;
		gap: 0.2rem;
	}

	a,
	.missing {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: baseline;
		padding: 0.6rem 0.8rem;
		border-bottom: 1px dotted var(--color-border-card);
		color: var(--color-text);
		text-decoration: none;
		font-size: 1.3rem;
	}

	a:hover {
		background: var(--color-hover);

		.title {
			text-decoration: underline;
			text-underline-offset: 0.2em;
		}
	}

	.code {
		width: fit-content;
		padding: 0.1rem 0.5rem;
		background: var(--color-bg-light);
		border: 1px solid var(--color-border-card);
		border-radius: 3px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
	}

	.credits {
		font-size: 1.2rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.missing {
		color: var(--color-text-muted);
	}

	.empty {
		font-size: 1.4rem;
		color: var(--color-text-muted);
	}
	.title {
		overflow-wrap: anywhere;
	}
	@media (max-width: 400px) {
		a,
		.missing {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.code {
			grid-column: 1 / -1;
			font-size: 1.1rem;
		}
		.missing .credits {
			white-space: normal;
		}
	}
</style>

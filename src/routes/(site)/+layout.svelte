<script lang="ts">
	import { DATA_UPDATED } from '$lib/curriculum/data';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const updated = DATA_UPDATED?.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
</script>

<div class="site">
	<main>
		{@render children()}
	</main>

	<footer>
		<p>
			Course data from Krea's term sheets{updated ? ` (${updated})` : ''}; programme rules from the departments' FYUP
			documents. Check anything that matters with your department.
		</p>
	</footer>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.site {
		display: grid;
		grid-template-rows: 1fr auto;
		min-height: calc(100dvh - var(--site-bar-height));
		background: var(--color-bg-board-page);
	}

	main {
		width: 100%;
		max-width: 124rem;
		margin: 0 auto;
		padding: 1.6rem 2rem 3.2rem;
	}

	footer {
		padding: 2rem 2.4rem 3.2rem;
		border-top: 1px dotted var(--color-border-light);
		font-size: 1.25rem;
		color: var(--color-text-muted);
		text-align: center;
	}

	@include mobile {
		main {
			padding: 0 0 2rem;
		}
	}
</style>

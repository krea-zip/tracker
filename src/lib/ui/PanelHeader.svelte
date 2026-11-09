<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	let {
		title,
		subtitle,
		level = 2,
		leading,
		children,
		class: className = '',
		...rest
	}: HTMLAttributes<HTMLElement> & {
		title: string;
		subtitle?: string;
		level?: 1 | 2;
		leading?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<header class="panel-header {className}" {...rest}>
	{#if leading}<div class="leading">{@render leading()}</div>{/if}
	<div class="heading">
		{#if level === 1}<h1>{title}</h1>{:else}<h2>{title}</h2>{/if}
		{#if subtitle}<p>{subtitle}</p>{/if}
	</div>
	{#if children}<div class="actions">{@render children()}</div>{/if}
</header>

<style lang="scss">
	@use '$lib/styles/mixins' as *;
	.panel-header {
		@include card-header;
		height: auto;
		min-height: var(--panel-header-height);
		padding: 1rem var(--panel-gutter);
		gap: 1rem;
		border-radius: var(--panel-radius) var(--panel-radius) 0 0;
	}
	.heading {
		flex: 1;
		min-width: 0;
	}
	h1,
	h2 {
		margin: 0;
		font-size: var(--text-heading);
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	p {
		margin-top: 0.35rem;
		font-size: var(--text-small);
		color: var(--color-text-muted);
		line-height: 1.45;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.6rem;
	}
	.leading {
		flex: none;
	}
	@media (max-width: 480px) {
		.panel-header {
			flex-wrap: wrap;
		}
		.actions {
			max-width: 100%;
		}
	}
</style>

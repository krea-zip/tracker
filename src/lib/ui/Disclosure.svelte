<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	let {
		title,
		meta,
		open = $bindable(false),
		children,
		class: className = '',
		...rest
	}: Omit<HTMLAttributes<HTMLDetailsElement>, 'title'> & {
		title: string;
		meta?: string;
		open?: boolean;
		children: Snippet;
	} = $props();
</script>

<details class="disclosure {className}" bind:open {...rest}>
	<summary
		><span class="indicator" aria-hidden="true">{open ? '−' : '+'}</span><span class="title">{title}</span
		>{#if meta}<span class="meta">{meta}</span>{/if}</summary
	>
	<div class="content">{@render children()}</div>
</details>

<style>
	.disclosure {
		min-width: 0;
		border-bottom: 1px dotted var(--color-border-card);
		scroll-margin-top: 1rem;
		font-size: var(--text-body);
	}
	.disclosure:last-child {
		border-bottom: 0;
	}
	summary {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.9rem var(--panel-gutter);
		cursor: pointer;
		list-style: none;
		color: var(--color-text);
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: var(--color-hover);
	}
	summary:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
	.indicator {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid var(--color-border-card);
		border-radius: 2px;
		background: var(--color-bg-light);
		color: var(--color-text-muted);
		font: 1.2rem/1 monospace;
	}
	.title {
		font-size: var(--text-body);
		font-weight: 600;
	}
	.meta {
		margin-left: auto;
		text-align: right;
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}
	.content {
		padding: 0.2rem var(--panel-gutter) 1.2rem;
		min-width: 0;
	}
	@media (pointer: coarse) {
		summary {
			min-height: 44px;
		}
	}
</style>

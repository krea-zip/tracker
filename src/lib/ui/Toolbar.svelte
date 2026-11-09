<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	let {
		children,
		tone = 'steel',
		class: className = '',
		...rest
	}: HTMLAttributes<HTMLDivElement> & { children: Snippet; tone?: 'steel' | 'warm' } = $props();
</script>

<div class="toolbar {className}" class:warm={tone === 'warm'} {...rest}>{@render children()}</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.8rem 1.2rem;
		padding: 0.7rem var(--panel-gutter);
		color: var(--bar-text);
		background: linear-gradient(var(--bar-top), var(--bar-bottom));
		border-bottom: 1px solid var(--bar-edge);
		box-shadow: inset 0 1px 0 var(--bar-hi);
		font-size: var(--text-small);
	}
	.warm {
		color: var(--color-text);
		background: var(--color-bg-sidebar);
		border-bottom-color: var(--color-border);
		box-shadow: none;
		padding-block: 1rem;
	}
</style>

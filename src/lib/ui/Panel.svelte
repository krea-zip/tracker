<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	let { children, class: className = '', ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props();
</script>

<div class="panel {className}" {...rest}>{@render children()}</div>

<style>
	.panel {
		min-width: 0;
		color: var(--color-text);
		background: var(--color-bg-light);
		border: 1px solid var(--color-border);
		border-radius: var(--panel-radius);
		font-size: var(--text-body);
	}
</style>

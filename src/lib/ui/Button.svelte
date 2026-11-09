<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes, HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';
	let {
		children,
		href,
		variant = 'secondary',
		class: className = '',
		type = 'button',
		disabled = false,
		...rest
	}: HTMLAttributes<HTMLElement> &
		Pick<HTMLButtonAttributes, 'type' | 'disabled' | 'form' | 'name' | 'value'> &
		Pick<HTMLAnchorAttributes, 'target' | 'rel' | 'download'> & {
			children: Snippet;
			href?: string;
			variant?: 'secondary' | 'primary' | 'danger' | 'quiet' | 'pill';
		} = $props();
</script>

{#if href}
	<a
		class="button {variant} {className}"
		href={disabled ? undefined : href}
		aria-disabled={disabled || undefined}
		{...rest}>{@render children()}</a
	>
{:else}
	<button class="button {variant} {className}" {type} {disabled} {...rest}>{@render children()}</button>
{/if}

<style lang="scss">
	@use '$lib/styles/mixins' as *;
	.button {
		@include store-button;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		min-height: 2.8rem;
		font: inherit;
		font-size: var(--text-small);
		line-height: 1.3;
		text-decoration: none;
	}
	.primary,
	.danger {
		color: var(--color-on-accent);
		background-color: var(--color-accent);
		border-color: var(--color-control-deep);
		font-weight: 600;
		@include glossy-accent;
	}
	.danger {
		background-color: var(--color-danger);
		border-color: var(--color-danger-deep);
	}
	.quiet {
		color: var(--color-accent);
		background: none;
		border-color: transparent;
		box-shadow: none;
		text-shadow: none;
	}
	.quiet:hover {
		background: var(--color-hover);
	}
	.pill {
		@include toggle-pill;
		font-size: var(--text-small);
	}
	.button:disabled,
	.button[aria-disabled='true'] {
		opacity: 0.5;
		cursor: default;
		pointer-events: none;
	}
	.button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	@media (pointer: coarse) {
		.button {
			min-height: 44px;
		}
	}
</style>

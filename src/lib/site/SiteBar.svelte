<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { reducedMotion } from '$lib/ui/transitions';
	import PixelIcon from '$lib/ui/PixelIcon.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import Appearance from '$lib/ui/Appearance.svelte';
	import { useSiteActions } from './navigation';
	const actions = useSiteActions();
	let settingsOpen = $state(false);
	let helpOpen = $state(false);
	let acadOpen = $state(false);
	let acadMenu = $state<HTMLDivElement>();
	let acadButton = $state<HTMLButtonElement>();
	const acad = [
		{ href: '/courses', label: 'courses' },
		{ href: '/programmes', label: 'programmes' },
		{ href: '/lecturers', label: 'lecturers' }
	];
	const current = (href: string) =>
		page.url.pathname === href || (href !== '/' && page.url.pathname.startsWith(`${href}/`));
	let inAcad = $derived(acad.some((link) => current(link.href)));
	afterNavigate(() => {
		settingsOpen = false;
		helpOpen = false;
	});
</script>

<svelte:window
	onpointerdown={(e) => {
		if (acadOpen && !acadMenu?.contains(e.target as Node)) acadOpen = false;
	}}
	onkeydown={(e) => {
		if (e.key !== 'Escape' || !acadOpen) return;
		e.preventDefault();
		acadOpen = false;
		acadButton?.focus();
	}}
/>

<header class="top-strip">
	<nav aria-label="site">
		<span class="unavailable" aria-disabled="true" title="Papers archive is not available yet">papers</span>
		<a href="/" aria-current={current('/') ? 'page' : undefined}>tracker</a>
		<div class="menu" bind:this={acadMenu}>
			<button
				bind:this={acadButton}
				class="menu-trigger"
				class:current={inAcad}
				aria-expanded={acadOpen}
				aria-controls="acad-menu"
				onclick={() => (acadOpen = !acadOpen)}
			>
				acad <span class="caret" aria-hidden="true">▾</span>
			</button>
			{#if acadOpen}
				<div
					class="menu-list"
					id="acad-menu"
					in:scale={{ start: 0.94, duration: reducedMotion() ? 0 : 260, easing: backOut }}
					out:fade={{ duration: reducedMotion() ? 0 : 100 }}
				>
					{#each acad as link (link.href)}
						<a
							href={link.href}
							aria-current={current(link.href) ? 'page' : undefined}
							onclick={() => (acadOpen = false)}>{link.label}</a
						>
					{/each}
				</div>
			{/if}
		</div>
	</nav>
	<div class="tools">
		<button
			data-tour="settings"
			aria-label="settings"
			title="settings"
			onclick={() => (actions.settings ? actions.settings() : (settingsOpen = true))}
		>
			<PixelIcon name="gear" size="1.6rem" snap />
		</button>
		{#if actions.help}
			<button aria-label="what's what" title="what's what" onclick={actions.help}
				><PixelIcon name="help" size="1.6rem" snap /></button
			>
		{:else}
			<button aria-label="what's what" title="what's what" onclick={() => (helpOpen = true)}
				><PixelIcon name="help" size="1.6rem" snap /></button
			>
		{/if}
	</div>
</header>

{#if settingsOpen}
	<Modal title="settings" onclose={() => (settingsOpen = false)}>
		<Appearance />
		<p class="note">Your theme and text size apply across the site.</p>
		<a class="planner-settings" href="/">open planner →</a>
	</Modal>
{/if}

{#if helpOpen}
	<Modal title="what's what" onclose={() => (helpOpen = false)}>
		<p class="note">
			Browse courses, programme requirements and lecturers under acad above. Open tracker to plan your degree.
		</p>
	</Modal>
{/if}

<style lang="scss">
	.top-strip {
		display: flex;
		height: var(--site-bar-height);
		padding: env(safe-area-inset-top) max(1.2rem, env(safe-area-inset-right)) 0 max(1.2rem, env(safe-area-inset-left));
		background: var(--color-bg-sidebar);
		border-bottom: 1px solid var(--color-border-warm);
		font-size: 1.25rem;
	}
	nav {
		display: flex;
		flex: 1;
		gap: 1.4rem;
	}
	.unavailable {
		display: flex;
		align-items: center;
		color: var(--color-text-muted);
		opacity: 0.65;
		cursor: default;
	}
	a {
		display: flex;
		align-items: center;
		white-space: nowrap;
		color: var(--color-text-muted);
		text-decoration: none;
	}
	a:hover,
	button:hover {
		color: var(--color-text);
	}
	a[aria-current='page'] {
		font-weight: 600;
		color: var(--color-text);
	}
	.tools {
		display: flex;
		padding-left: 1rem;
		flex-shrink: 0;
	}
	button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font: inherit;
		color: var(--color-text-muted);
		background: none;
		border: none;
		cursor: pointer;
	}
	.tools button {
		width: 2.6rem;
	}
	.menu {
		position: relative;
		display: flex;
	}
	.menu-trigger {
		gap: 0.4rem;
		white-space: nowrap;

		&.current {
			font-weight: 600;
			color: var(--color-text);
		}

		&[aria-expanded='true'] .caret {
			transform: rotate(180deg);
		}
	}
	.caret {
		font-size: 1rem;
		transition: transform 260ms var(--spring);
	}
	.menu-list {
		position: absolute;
		top: 100%;
		left: -0.8rem;
		z-index: 60;
		display: flex;
		flex-direction: column;
		min-width: 13rem;
		padding: 0.4rem;
		transform-origin: top left;
		background: var(--color-bg-light);
		border: 1px solid var(--color-border-card);
		border-radius: 0 0 6px 6px;
		box-shadow: 0 6px 16px rgba(20, 30, 50, 0.16);

		a {
			padding: 0.5rem 0.8rem;
			border-radius: 4px;

			&:hover {
				background: var(--color-hover-medium);
			}
		}
	}
	:where(a, button):focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
	.note,
	.planner-settings {
		margin-top: 1.6rem;
		font-size: 1.35rem;
		color: var(--color-text-muted);
	}
	@media (max-width: 767px) {
		.tools button {
			min-width: 44px;
		}
		.menu-list a {
			min-height: 44px;
		}
	}
</style>

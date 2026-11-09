<script lang="ts">
	// the academic office's frame: the top bar and the page, or the sign-in. the draft arrives with the page (see +layout.server.ts); a
	// fresh copy from the server, after a reload or a sign-in, replaces
	// what's on screen.
	import '../../app.scss';
	import '$lib/office/styles/office.scss';
	import type { LayoutProps } from './$types';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { Workspace, provideOffice } from '$lib/office/workspace.svelte';
	import OfficeToolbar from '$lib/office/components/OfficeToolbar.svelte';
	import OfficeSignIn from '$lib/office/components/OfficeSignIn.svelte';
	import OldEditsNotice from '$lib/office/components/OldEditsNotice.svelte';
	import { softChanges } from '$lib/ui/transitions';

	let { data, children }: LayoutProps = $props();
	const office = provideOffice(new Workspace());

	$effect.pre(() => {
		if (data.workspace && data.name) office.load(data.workspace, data.name);
	});

	let large = $state(false);
	let signedIn = $derived(!!data.name);
	// the course list uses the whole width; everything else reads better narrower
	let wide = $derived(page.url.pathname.startsWith('/admin/courses'));

	// the page scrolls in its own box, where the router's reset can't reach: a
	// new page starts at its top, a link to a setting scrolls itself
	let scroller = $state<HTMLDivElement>();
	afterNavigate(({ from, to }) => {
		if (scroller && from?.url.pathname !== to?.url.pathname && !to?.url.hash) scroller.scrollTop = 0;
	});

	// unsaved edits live only on this screen, so leaving asks first
	beforeNavigate(({ to, cancel, type }) => {
		if (!office.dirty) return;
		if (type === 'leave') return cancel();
		if (to && !to.url.pathname.startsWith('/admin') && !confirm('You have unsaved changes. Leave without saving them?'))
			cancel();
	});
</script>

<svelte:head>
	<title>Academic office · tracker</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 's' && signedIn) {
			e.preventDefault();
			if (office.dirty && !office.conflict) void office.save();
		}
	}}
/>
<a class="office-skip" href="#office-content">skip to content</a>
<div class="office-shell" class:large-text={large} class:signed-out={!signedIn} use:softChanges>
	{#if signedIn}<OfficeToolbar bind:large /><OldEditsNotice />{/if}
	<div class="office-body" bind:this={scroller}>
		<main class="office-main" class:wide id="office-content" tabindex="-1">
			{#if !signedIn}
				<OfficeSignIn />
			{:else}
				{@render children()}
			{/if}
		</main>
	</div>
</div>

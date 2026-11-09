<script lang="ts">
	import '../app.scss';
	import { page } from '$app/state';
	import SiteBar from '$lib/site/SiteBar.svelte';
	import DesktopOnly from '$lib/ui/DesktopOnly.svelte';
	import { provideSiteActions, type SiteActions } from '$lib/site/navigation';
	const siteActions = $state<SiteActions>({});
	provideSiteActions(siteActions);
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { isPlayground } from '$lib/curriculum/runtime';
	import { account } from '$lib/plans/account.svelte';
	import { getSupabase } from '$lib/supabase/browser';
	import { animateDetails } from '$lib/ui/details';

	let { children }: { children: Snippet } = $props();
	onMount(animateDetails);
	onMount(() => {
		if (isPlayground()) return;
		let stop = () => {};
		let disposed = false;
		void account.refresh().then(async () => {
			if (!account.configured || disposed) return;
			try {
				const client = await getSupabase();
				if (disposed) return;
				const { data } = client.auth.onAuthStateChange(() => {
					void account.refresh();
				});
				stop = () => data.subscription.unsubscribe();
			} catch {
				/* Guest planning remains available. */
			}
		});
		const refresh = () => {
			if (document.visibilityState === 'visible') void account.refresh();
		};
		document.addEventListener('visibilitychange', refresh);
		return () => {
			disposed = true;
			stop();
			document.removeEventListener('visibilitychange', refresh);
		};
	});
</script>

<!-- the welcome's playground is a page inside a frame, not a page of the site:
     it's always drawn at laptop width, and a bar of its own would push the
     miniature down and out of line with the welcome around it -->
{#if page.route.id !== '/welcome-playground'}
	<DesktopOnly />
	<SiteBar />
{/if}
{@render children()}

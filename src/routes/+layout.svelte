<script lang="ts">
	import '../app.scss';
	import SiteBar from '$lib/site/SiteBar.svelte';
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

<SiteBar />
{@render children()}

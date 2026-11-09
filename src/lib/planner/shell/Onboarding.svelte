<script lang="ts">
	// a first visit opens the welcome. once it's closed it never comes back in
	// this browser, and finishing it opens the real board with its parts labelled.
	// ?welcome replays it any time, as a rehearsal that leaves the plan alone
	import { onMount } from 'svelte';
	import { usePlan } from '$lib/planner/context';
	import { viewport } from '$lib/planner/viewport.svelte';
	import Guide from '$lib/planner/guide/Guide.svelte';
	import Welcome from '$lib/planner/welcome/Welcome.svelte';

	let { skip = false, replay = false }: { skip?: boolean; replay?: boolean } = $props();
	const plan = usePlan();

	// the old key, so anyone who already saw the welcome-and-tour isn't asked again
	const SEEN_KEY = 'tracker-intro-seen';

	let welcome = $state(false);

	onMount(() => {
		if (replay) {
			plan.rehearsing = true;
			welcome = true;
			return;
		}
		if (skip) return;
		try {
			welcome = !localStorage.getItem(SEEN_KEY);
		} catch {
			welcome = true;
		}
	});

	function done(finished: boolean) {
		welcome = false;
		// once the welcome has faded and the board has its full controls back
		if (finished && viewport.desktop) setTimeout(() => (plan.guiding = true), 300);
		if (plan.rehearsing) return; // a replay changes nothing a real first visit relies on
		try {
			localStorage.setItem(SEEN_KEY, '1');
		} catch {
			// closing still works when browser storage is unavailable
		}
	}
</script>

{#if welcome}
	<Welcome ondone={done} />
{/if}

{#if plan.guiding}
	<Guide />
{/if}

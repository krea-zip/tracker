<script lang="ts">
	// hands its contents their own copy of the example, so one view's state
	// (a course picked, one held mid-drag, a trimester opened) stays out of
	// the other views on the page
	import { untrack, type Snippet } from 'svelte';
	import { providePlan } from '$lib/planner/context';
	import { BoardState, provideBoard } from '$lib/planner/board/boardState.svelte';
	import { samplePlan, type SampleState } from './sample';

	let { children, ...state }: SampleState & { children: Snippet } = $props();

	const plan = providePlan(untrack(() => samplePlan(state)));
	provideBoard(new BoardState(plan));
</script>

{@render children()}

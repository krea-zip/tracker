<script lang="ts">
	// what a course shows on the board: its code, its title, or both. the board
	// bar's key, and the same key in the welcome's demo, so it's already familiar.
	import PixelIcon from '$lib/ui/PixelIcon.svelte';
	import { usePlan } from '$lib/planner/context';
	import Keys from './Keys.svelte';

	const plan = usePlan();
</script>

<Keys label="course labels">
	<button class:active={plan.showCodes} aria-pressed={plan.showCodes} onclick={() => plan.toggleLabel('code')}
		><PixelIcon name="code" />codes</button
	>
	<button
		class:active={plan.showTitles}
		aria-pressed={plan.showTitles}
		data-label-key="title"
		onclick={() => plan.toggleLabel('title')}><PixelIcon name="title" />titles</button
	>
	{#if plan.gradeMode}
		<button
			class:active={plan.showGradeLabels}
			aria-pressed={plan.showGradeLabels}
			onclick={() => (plan.showGradeLabels = !plan.showGradeLabels)}><PixelIcon name="grade" />grades</button
		>
	{/if}
</Keys>

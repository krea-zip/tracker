<script lang="ts">
	// a changing label rolls over like a mechanical counter, so the eye sees
	// it change instead of the text just snapping (tracker's motion language).
	// old and new share one grid cell so they cross instead of stacking.
	import { roll } from './transitions';

	let { value }: { value: string | number } = $props();
</script>

<span class="rolling">
	{#key value}
		<span in:roll={{ dir: 1 }} out:roll={{ dir: -1 }}>{value}</span>
	{/key}
</span>

<style>
	.rolling {
		display: inline-grid;
		overflow: hidden;
		vertical-align: bottom;
	}

	.rolling > span {
		grid-area: 1 / 1;
		white-space: nowrap;
	}
</style>

<script lang="ts">
	import { settings, TEXT_SIZES, type ThemeChoice } from './settings.svelte';
	const themes: { id: ThemeChoice; label: string }[] = [
		{ id: 'light', label: 'light' },
		{ id: 'dark', label: 'dark' },
		{ id: 'system', label: 'auto' }
	];
</script>

<div class="row">
	<span>theme</span>
	<div class="seg" role="group" aria-label="theme">
		{#each themes as t (t.id)}<button
				class:active={settings.theme === t.id}
				aria-pressed={settings.theme === t.id}
				onclick={() => settings.setTheme(t.id)}>{t.label}</button
			>{/each}
	</div>
</div>
<div class="row">
	<span>text size</span>
	<div class="seg" role="group" aria-label="text size">
		{#each TEXT_SIZES as s (s.id)}<button
				class:active={settings.textSize === s.id}
				aria-pressed={settings.textSize === s.id}
				onclick={() => settings.setTextSize(s.id)}>{s.label}</button
			>{/each}
	</div>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		font-size: 1.35rem;
	}
	.row + .row {
		margin-top: 1rem;
	}
	.row > span {
		width: 7rem;
	}
	.seg {
		@include segmented;
		flex-wrap: wrap;
	}
</style>

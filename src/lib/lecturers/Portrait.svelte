<script lang="ts">
	let { name, src, size = '6.4rem' }: { name: string; src?: string | null; size?: string } = $props();
	let failed = $state(false);
	$effect(() => {
		src;
		failed = false;
	});
	const initials = $derived(
		name
			.replace(/^(dr\.?|prof\.?)\s+/i, '')
			.split(/\s+/)
			.map((s) => s[0])
			.slice(0, 2)
			.join('')
	);
</script>

<span class="portrait" style:--size={size} aria-hidden="true">
	{#if src && !failed}<img
			{src}
			alt=""
			loading="lazy"
			referrerpolicy="no-referrer"
			onerror={() => (failed = true)}
		/>{:else}{initials}{/if}
</span>

<style>
	.portrait {
		display: grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		flex: none;
		border-radius: 50%;
		border: 1px solid var(--color-border-card);
		background: var(--color-subtle);
		color: var(--color-text-muted);
		font-size: calc(var(--size) * 0.3);
		overflow: hidden;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>

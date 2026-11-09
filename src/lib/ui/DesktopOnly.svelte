<!-- Full-screen notice on phones. Pure CSS (same breakpoint as the `mobile` mixin),
     so there's no flash of the app before it appears. -->
<div class="desktop-only" role="alert">
	<p class="title">please use a laptop or desktop</p>
	<p class="hint">tracker needs a bigger screen than a phone.</p>
</div>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	.desktop-only {
		display: none;
	}

	@include mobile {
		.desktop-only {
			position: fixed;
			inset: 0;
			z-index: 10000;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 1rem;
			padding: 2.4rem;
			text-align: center;
			background: var(--color-bg);
			color: var(--color-text);
		}
		.title {
			margin: 0;
			font-size: 2.2rem;
			font-weight: 700;
		}
		.hint {
			margin: 0;
			font-size: var(--text-body);
			color: var(--color-text-muted);
		}
		// keep the app underneath from scrolling behind the notice
		:global(html:has(.desktop-only)),
		:global(body:has(.desktop-only)) {
			overflow: hidden;
		}
	}
</style>

<script lang="ts">
	// Holds the playground's frame and talks to it: which slide is up, the
	// page's theme and text size, the task being pointed at; and back, which
	// tasks are done. It stays mounted between slides, so the pretend plan keeps
	// what the student did to it, and loads while the setup steps are up.
	import { onMount } from 'svelte';
	import type { Lesson } from './lessons';

	let {
		lesson,
		active,
		point = null,
		onprogress
	}: {
		lesson: Lesson;
		active: boolean;
		point?: string | null;
		onprogress: (done: string[]) => void;
	} = $props();

	// narrower than this and the app's phone layout would take over inside the
	// frame, so a smaller window draws it at this width and scales it down
	const MIN_WIDTH = 900;

	let frame = $state<HTMLIFrameElement>();
	let width = $state(0);
	let height = $state(0);
	let ready = $state(false);
	let scale = $derived(width ? Math.min(1, width / MIN_WIDTH) : 1);

	function sync() {
		frame?.contentWindow?.postMessage(
			{
				type: 'tracker-playground-lesson',
				lesson,
				active,
				point,
				theme: document.documentElement.dataset.theme ?? 'light',
				rem: getComputedStyle(document.documentElement).fontSize
			},
			location.origin
		);
	}

	$effect(() => {
		void [lesson, active, point];
		if (ready) sync();
	});

	onMount(() => {
		const theme = new MutationObserver(sync);
		theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => theme.disconnect();
	});

	// with the focus out here, ctrl+z would reach the real plan behind the
	// welcome. while the playground's up, it's the playground's to undo
	function holdHistory(e: KeyboardEvent) {
		if (!active || !ready || !(e.ctrlKey || e.metaKey) || e.altKey) return;
		const key = e.key.toLowerCase();
		const history = key === 'z' ? (e.shiftKey ? 'redo' : 'undo') : key === 'y' ? 'redo' : null;
		if (!history) return;
		e.preventDefault();
		e.stopPropagation();
		frame?.contentWindow?.postMessage({ type: 'tracker-playground-lesson', history }, location.origin);
	}

	function receive(event: MessageEvent) {
		if (event.source !== frame?.contentWindow || event.origin !== location.origin) return;
		if (event.data?.type === 'tracker-playground-ready') {
			ready = true;
			sync();
		}
		if (event.data?.type === 'tracker-playground-progress' && Array.isArray(event.data.done))
			onprogress(event.data.done);
	}
</script>

<svelte:window onmessage={receive} onresize={sync} onkeydowncapture={holdHistory} />

<div class="host" class:active class:ready bind:clientWidth={width} bind:clientHeight={height} inert={!active}>
	<iframe
		bind:this={frame}
		title="a working miniature of the planner, with pretend courses"
		src="/welcome-playground"
		style:width="{width / scale}px"
		style:height="{height / scale}px"
		style:transform="scale({scale})"
		data-playground-frame
	></iframe>
	{#if !ready}
		<p class="loading">setting up the tiny planner…</p>
	{/if}
</div>

<style lang="scss">
	.host {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--color-bg);

		// waiting out the setup steps: laid out at full size so it's ready,
		// but out of the way and out of reach
		&:not(.active) {
			position: absolute;
			top: 0;
			left: 0;
			width: 100rem;
			height: 60rem;
			visibility: hidden;
			pointer-events: none;
		}
	}

	iframe {
		display: block;
		border: 0;
		transform-origin: 0 0;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.ready iframe {
		opacity: 1;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 1.3rem;
		color: var(--color-text-muted);
	}
</style>

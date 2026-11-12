<script lang="ts">
	import { settings } from './settings.svelte';

	let {
		name,
		size = '1.5rem',
		snap = false
	}: {
		name:
			| 'search'
			| 'gear'
			| 'code'
			| 'title'
			| 'grade'
			| 'link'
			| 'help'
			| 'sliders'
			| 'pin'
			| 'construction'
			| 'mail'
			| 'clock'
			| 'location';
		size?: string;
		snap?: boolean;
	} = $props();
	const paths = {
		search:
			'M4 2h5v1H4zM2 4h1v5H2zM10 4h1v5h-1zM4 10h5v1H4zM3 3h1v1H3zM9 3h1v1H9zM3 9h1v1H3zM9 9h2v2H9zM11 11h2v2h-2zM13 13h2v2h-2z',
		gear: 'M6 1h4v1H6zM2 2h2v1H2zM6 2h4v1H6zM12 2h2v1H12zM2 3h12v1H2zM3 4h10v1H3zM3 5h3v1H3zM10 5h3v1H10zM1 6h4v1H1zM11 6h4v1H11zM1 7h4v1H1zM11 7h4v1H11zM1 8h4v1H1zM11 8h4v1H11zM1 9h4v1H1zM11 9h4v1H11zM3 10h3v1H3zM10 10h3v1H10zM3 11h10v1H3zM2 12h12v1H2zM2 13h2v1H2zM6 13h4v1H6zM12 13h2v1H12zM6 14h4v1H6z',
		code: 'M4 3h2v2H4zM2 5h2v2H2zM0 7h2v2H0zM2 9h2v2H2zM4 11h2v2H4zM10 3h2v2h-2zM12 5h2v2h-2zM14 7h2v2h-2zM12 9h2v2h-2zM10 11h2v2h-2z',
		title: 'M2 3h12v3h-2V5H9v8h2v1H5v-1h2V5H4v1H2z',
		grade: 'M2 2h12v12H2zM4 4v8h8V4zM5 8h2v3H5zM9 5h2v6H9z',
		link: 'M3 3h7V1l4 4-4 4V7H3zM13 9H6V7l-4 4 4 4v-2h7z',
		help: 'M4 2h7v2h2v4h-2v2H8v1H6V8h3V6h2V4H4v2H2V4h2zM6 13h2v2H6z',
		sliders:
			'M2 3h7v1H2zM12 3h2v1h-2zM9 2h3v3H9zM2 8h2v1H2zM4 7h3v3H4zM7 8h7v1H7zM2 13h8v1H2zM10 12h3v3h-3zM13 13h1v1h-1z',
		pin: 'M5 1h6v1H5zM4 2h8v1H4zM4 3h2v1H4zM7 3h5v1H7zM4 4h2v1H4zM7 4h5v1H7zM4 5h8v1H4zM5 6h6v1H5zM2 7h12v1H2zM2 8h12v1H2zM6 9h4v1H6zM7 10h2v1H7zM7 11h2v1H7zM7 12h2v1H7zM7 13h2v1H7zM7 14h2v1H7z',
		construction: 'M2 4h12v2H2zM1 6h14v5H1zM3 7v2h2V7zM7 7v2h2V7zM11 7v2h2V7zM3 11h2v4H3zM11 11h2v4h-2z',
		mail: 'M1 3h14v1H1zM1 4h2v1H1zM13 4h2v1H13zM1 5h1v1H1zM3 5h1v1H3zM12 5h1v1H12zM14 5h1v1H14zM1 6h1v1H1zM4 6h1v1H4zM11 6h1v1H11zM14 6h1v1H14zM1 7h1v1H1zM5 7h1v1H5zM10 7h1v1H10zM14 7h1v1H14zM1 8h1v1H1zM6 8h1v1H6zM9 8h1v1H9zM14 8h1v1H14zM1 9h1v1H1zM7 9h2v1H7zM14 9h1v1H14zM1 10h1v1H1zM14 10h1v1H14zM1 11h1v1H1zM14 11h1v1H14zM1 12h14v1H1z',
		location:
			'M5 1h6v1H5zM4 2h8v1H4zM3 3h10v1H3zM3 4h10v1H3zM2 5h5v1H2zM9 5h5v1H9zM2 6h5v1H2zM9 6h5v1H9zM2 7h12v1H2zM3 8h10v1H3zM3 9h10v1H3zM4 10h8v1H4zM4 11h8v1H4zM5 12h6v1H5zM6 13h4v1H6zM7 14h2v1H7z',
		clock:
			'M5 1h6v1H5zM4 2h8v1H4zM3 3h3v1H3zM10 3h3v1H10zM2 4h2v1H2zM7 4h2v1H7zM12 4h2v1H12zM1 5h3v1H1zM7 5h2v1H7zM12 5h3v1H12zM1 6h2v1H1zM7 6h2v1H7zM13 6h2v1H13zM1 7h2v1H1zM7 7h2v1H7zM13 7h2v1H13zM1 8h2v1H1zM7 8h4v1H7zM13 8h2v1H13zM1 9h2v1H1zM8 9h3v1H8zM13 9h2v1H13zM1 10h3v1H1zM12 10h3v1H12zM2 11h2v1H2zM12 11h2v1H12zM3 12h3v1H3zM10 12h3v1H10zM4 13h8v1H4zM5 14h6v1H5z'
	};

	// Pixel art only looks even when every art pixel covers the same whole
	// number of screen pixels. The app's rem is fluid (it follows the window
	// width and the text-size setting) and screens can be fractionally scaled,
	// so with `snap` the requested size is only a target: the icon renders at
	// the nearest whole multiple of its 16-unit grid in device pixels.
	const GRID = 16;
	let snapped = $state<string | null>(null);

	$effect(() => {
		if (!snap) return;
		void settings.textSize; // the root font size follows it
		let frame = 0;
		const measure = () => {
			cancelAnimationFrame(frame);
			// a frame later, so a text-size change has reached the root first
			frame = requestAnimationFrame(() => {
				const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
				const css = size.endsWith('rem') ? parseFloat(size) * root : parseFloat(size);
				const dpr = window.devicePixelRatio || 1;
				const n = Math.max(1, Math.round((css * dpr) / GRID));
				snapped = `${(n * GRID) / dpr}px`;
			});
		};
		measure();
		// zooming and moving between screens change the pixel ratio and fire resize
		window.addEventListener('resize', measure);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', measure);
		};
	});
</script>

<svg
	width={snapped ?? size}
	height={snapped ?? size}
	viewBox="0 0 16 16"
	fill="currentColor"
	fill-rule="evenodd"
	shape-rendering="crispEdges"
	aria-hidden="true"><path d={paths[name]} /></svg
>

<style>
	svg {
		flex-shrink: 0;
		vertical-align: middle;
	}
</style>

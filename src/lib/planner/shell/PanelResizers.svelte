<script lang="ts" module>
	export type Panel = 'rail' | 'catalogue';
	export type PanelWidths = Partial<Record<Panel, number>>;
</script>

<script lang="ts">
	// The side columns can be dragged wider or narrower by their inner edges.
	// Until then each is as wide as its content needs (see the planner layout);
	// a dragged width is this viewer's own, in rem so it follows the text size,
	// and always leaves the board room. Double-clicking an edge puts it back.
	import { onMount } from 'svelte';

	const PANEL_KEY = 'tracker-panel-widths';
	const PANELS: { id: Panel; label: string; min: number; max: number }[] = [
		{ id: 'rail', label: 'sidebar', min: 20, max: 40 },
		{ id: 'catalogue', label: 'catalogue', min: 22, max: 52 }
	];
	const BOARD_MIN = 48; // rem

	let { widths = $bindable({}), resizing = $bindable(null) }: { widths?: PanelWidths; resizing?: Panel | null } =
		$props();

	let from = { x: 0, width: 0, rootPx: 10 };

	const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
	const panelEl = (id: Panel) => document.querySelector<HTMLElement>(`[data-panel="${id}"]`);

	/** a panel's width as drawn, in rem; one slid in over the board takes no room */
	function drawn(id: Panel, px: number): number {
		const el = panelEl(id);
		if (!el || getComputedStyle(el).position === 'fixed') return 0;
		return el.getBoundingClientRect().width / px;
	}

	function setWidth(id: Panel, rem: number, px: number) {
		const p = PANELS.find((q) => q.id === id)!;
		const others = PANELS.filter((q) => q.id !== id).reduce((sum, q) => sum + drawn(q.id, px), 0);
		const docked = document.querySelector('.app.details-docked');
		const details = docked?.querySelector<HTMLElement>('[data-panel="details"]');
		const detailsWidth = details ? details.getBoundingClientRect().width / px : 0;
		const room = window.innerWidth / px - BOARD_MIN - others - detailsWidth;
		widths[id] = Math.round(Math.max(p.min, Math.min(p.max, room, rem)) * 10) / 10;
	}

	function save() {
		try {
			localStorage.setItem(PANEL_KEY, JSON.stringify(widths));
		} catch {
			// widths just won't outlast the visit
		}
	}

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}') as Record<string, unknown>;
			for (const p of PANELS) {
				const w = saved[p.id];
				if (typeof w === 'number' && w >= p.min && w <= p.max) widths[p.id] = w;
			}
		} catch {
			// unreadable or blocked storage, the shares stand
		}
	});
</script>

{#each PANELS as p (p.id)}
	<!-- a focusable separator is the ARIA window-splitter pattern, which
	     the a11y lint doesn't know is interactive -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="resizer"
		data-for={p.id}
		class:active={resizing === p.id}
		role="separator"
		aria-orientation="vertical"
		aria-label="resize the {p.label}"
		aria-valuenow={widths[p.id]}
		aria-valuemin={p.min}
		aria-valuemax={p.max}
		tabindex="0"
		title="drag to resize · double-click to reset"
		onpointerdown={(e) => {
			if (e.button !== 0) return;
			e.currentTarget.setPointerCapture(e.pointerId);
			const px = rootPx();
			from = { x: e.clientX, width: drawn(p.id, px), rootPx: px };
			resizing = p.id;
		}}
		onpointermove={(e) => {
			if (resizing !== p.id) return;
			setWidth(p.id, from.width + (e.clientX - from.x) / from.rootPx, from.rootPx);
		}}
		onpointerup={() => {
			if (resizing !== p.id) return;
			resizing = null;
			save();
		}}
		onpointercancel={() => (resizing = null)}
		ondblclick={() => {
			delete widths[p.id];
			save();
		}}
		onkeydown={(e) => {
			if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
			e.preventDefault();
			const px = rootPx();
			setWidth(p.id, drawn(p.id, px) + (e.key === 'ArrowRight' ? 1.6 : -1.6), px);
			save();
		}}
	></div>
{/each}

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	// a strip astride each inner column edge to drag by, laid in its panel's
	// grid area against the inner edge: nothing to see until it's pointed at,
	// then a plum line along the edge
	.resizer {
		position: relative;
		z-index: 5;
		width: 9px;
		cursor: col-resize;
		touch-action: none;

		&[data-for='rail'] {
			grid-area: rail;
			justify-self: end;
			translate: 50% 0;
		}

		&[data-for='catalogue'] {
			grid-area: catalogue;
			justify-self: end;
			translate: 50% 0;
		}

		&::after {
			content: '';
			position: absolute;
			inset: 0 3px;
			background: var(--color-accent);
			opacity: 0;
			transition: opacity 160ms ease;
		}

		&:hover::after,
		&:focus-visible::after {
			opacity: 0.45;
		}

		&.active::after {
			opacity: 0.8;
		}

		&:focus-visible {
			outline: none;
		}
	}

	@include mobile {
		.resizer {
			display: none;
		}
	}

	// a panel that slides in over the board has no edge to drag
	@include rail-overlay {
		.resizer[data-for='rail'] {
			display: none;
		}
	}

	// a fingertip-wide strip on a touch screen
	@include touch {
		.resizer {
			width: 20px;

			&::after {
				inset: 0 8px;
			}
		}
	}
</style>

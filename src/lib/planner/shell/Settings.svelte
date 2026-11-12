<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import { usePlan } from '$lib/planner/context';
	import Appearance from '$lib/ui/Appearance.svelte';
	import { savedPlans } from '$lib/plans/local-plans.svelte';
	// google sign-in is off for now; bring this and the panel below back to turn it on
	// import AccountPanel from '$lib/plans/AccountPanel.svelte';
	import CloudPlans from '$lib/plans/CloudPlans.svelte';
	import { printPlan } from '$lib/plans/print';
	import { byCode, subjectById } from '$lib/curriculum/data';
	import Modal from '$lib/ui/Modal.svelte';
	import FeedbackForm from './FeedbackForm.svelte';
	import { parsePlanText } from '$lib/planner/importText';

	let { onclose }: { onclose: () => void } = $props();
	const plan = usePlan();

	// loading replaces what is on the board, so it asks twice, same guard as
	// "start over", for the same reason
	let confirmLoad = $state<string | null>(null);
	let confirmDelete = $state<string | null>(null);
	let loadTimer: ReturnType<typeof setTimeout>;
	let delTimer: ReturnType<typeof setTimeout>;

	function load(id: string) {
		if (confirmLoad !== id) {
			confirmLoad = id;
			confirmDelete = null;
			clearTimeout(loadTimer);
			loadTimer = setTimeout(() => (confirmLoad = null), 4000);
			return;
		}
		clearTimeout(loadTimer);
		confirmLoad = null;
		const entry = savedPlans.items.find((x) => x.id === id);
		if (entry) plan.restore(entry.data);
		onclose();
	}

	function del(id: string) {
		if (confirmDelete !== id) {
			confirmDelete = id;
			confirmLoad = null;
			clearTimeout(delTimer);
			delTimer = setTimeout(() => (confirmDelete = null), 4000);
			return;
		}
		clearTimeout(delTimer);
		confirmDelete = null;
		savedPlans.remove(id);
	}

	const when = (ms: number) =>
		new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
		' ' +
		new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

	// ── share ──
	// the plan as plain text, trimester by trimester, something to paste to
	// an advisor or a friend, since saved plans never leave this browser
	let shared = $state(false);
	async function copyPlan() {
		const degree = plan.programmes.map((p) => `${subjectById(p.subject).label} ${p.role}`).join(' + ');
		const lines = [`${degree} · ${plan.fourYear ? '4' : '3'}-year · batch ${plan.batchStartYear}`, ''];
		for (const y of plan.years)
			for (const t of plan.trims) {
				const codes = plan.slotCourses(y, t).filter((code) => !code.includes('~'));
				if (codes.length)
					lines.push(
						`${plan.trimName(y, t)} (${plan.slotCredits(y, t)} cr): ${codes.map((c) => `${byCode(c).code} ${byCode(c).title}`).join('; ')}`
					);
			}
		lines.push('', `${plan.totalPlacedCredits} of ${plan.creditMinimum} credits placed`);
		try {
			await navigator.clipboard.writeText(lines.join('\n'));
			shared = true;
			setTimeout(() => (shared = false), 1800);
		} catch {
			exportError = 'Your browser blocked the clipboard. Try exporting a PDF.';
		}
	}

	// ── paste a plan ──
	// the text above, read back. It replaces the board, so it asks twice
	let pasted = $state('');
	let confirmPaste = $state(false);
	let pasteTimer: ReturnType<typeof setTimeout>;
	let parsed = $derived(pasted.trim() ? parsePlanText(pasted) : null);

	function loadPasted() {
		if (!parsed || !parsed.courses) return;
		if (!confirmPaste) {
			confirmPaste = true;
			clearTimeout(pasteTimer);
			pasteTimer = setTimeout(() => (confirmPaste = false), 4000);
			return;
		}
		clearTimeout(pasteTimer);
		confirmPaste = false;
		plan.restore(parsed.save);
		pasted = '';
		onclose();
	}

	let exportError = $state('');
	function exportPdf() {
		exportError = '';
		try {
			printPlan(plan);
		} catch (e) {
			exportError = e instanceof Error ? e.message : 'The PDF preview could not open.';
		}
	}

	// ── start over ──
	// two taps, because this throws away a plan that took real work
	let confirming = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout>;

	function startOver() {
		if (!confirming) {
			confirming = true;
			confirmTimer = setTimeout(() => (confirming = false), 4000);
			return;
		}
		clearTimeout(confirmTimer);
		confirming = false;
		plan.reset();
		onclose();
	}
</script>

<Modal title="settings" {onclose}>
	<!-- <AccountPanel snapshot={() => plan.snapshot()} /> -->
	<CloudPlans />
	<section>
		<h3>appearance</h3>

		<Appearance />
	</section>

	<section>
		<h3>help</h3>
		<p class="note">
			browse every <a href="/courses">course</a>, <a href="/programmes">programme</a> and
			<a href="/lecturers">lecturer</a>.
		</p>
	</section>

	<section>
		<h3>feedback</h3>
		<FeedbackForm />
	</section>

	{#if savedPlans.items.length}
		<section>
			<h3>browser copies & backups</h3>
			<p class="note">
				Your existing local copies remain here. Load one, then use “Save this plan” to keep it in your Krea account.
			</p>
			{#if savedPlans.error}<p class="note warn">{savedPlans.error}</p>{/if}
			<ul class="saves">
				{#each savedPlans.items as p (p.id)}
					<li>
						<span class="s-name">{p.name}</span>
						<span class="s-when">{when(p.savedAt)}</span>
						<button class="s-act" class:confirming={confirmLoad === p.id} onclick={() => load(p.id)}>
							{confirmLoad === p.id ? 'replace board?' : 'load'}
						</button>
						<button class="s-act danger" class:confirming={confirmDelete === p.id} onclick={() => del(p.id)}>
							{confirmDelete === p.id ? 'delete?' : '×'}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<h3>your plan</h3>
		<p class="note">
			Export your current draft without signing in. PDFs and copied text exclude your grades and email.
		</p>
		<div class="actions">
			<Button onclick={exportPdf}>save as PDF</Button>
			<Button onclick={copyPlan}>{shared ? 'copied ✓' : 'copy plan as text'}</Button>
			<Button variant="danger" onclick={startOver}>
				{confirming ? 'really start over?' : 'start over'}
			</Button>
		</div>
		{#if exportError}<p class="note warn" role="alert">{exportError}</p>{/if}
	</section>

	<section>
		<h3>paste a plan</h3>
		<p class="note">Paste text from “copy plan as text” to put that plan back on the board.</p>
		<textarea
			class="paste"
			rows="5"
			bind:value={pasted}
			placeholder="political science major + economics minor · 4-year · batch 2023&#10;&#10;y1 t1 (12 cr): KCCS101 …"
			aria-label="plan text"
		></textarea>
		{#if parsed}
			<p class="note">
				{parsed.courses} course{parsed.courses === 1 ? '' : 's'} found{parsed.save.structure
					? ''
					: ', degree line not read: programmes stay as they are'}
			</p>
			{#if parsed.problems.length}
				<ul class="note warn problems">
					{#each parsed.problems as p, i (i)}<li>{p}</li>{/each}
				</ul>
			{/if}
			<div class="actions">
				<Button variant={confirmPaste ? 'danger' : 'secondary'} disabled={!parsed.courses} onclick={loadPasted}>
					{confirmPaste ? 'replace board?' : 'load this plan'}
				</Button>
			</div>
		{/if}
	</section>
</Modal>

<style lang="scss">
	@use '$lib/styles/mixins' as *;

	section {
		padding-bottom: 1.6rem;

		& + section {
			margin-top: 1.6rem;
			padding-top: 1.6rem;
			border-top: 1px dotted var(--color-border-card);
		}

		&:last-child {
			padding-bottom: 0;
		}
	}

	h3 {
		@include section-label;
		margin-bottom: 1rem;
	}

	.saves {
		margin-top: 1rem;
		list-style: none;

		li {
			display: grid;
			grid-template-columns: 1fr auto auto auto;
			align-items: center;
			gap: 0.8rem;
			padding: 0.6rem 0;
			font-size: 1.3rem;

			& + li {
				border-top: 1px dotted var(--color-border-card);
			}
		}

		.s-name {
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
			color: var(--color-text);
		}

		.s-when {
			font-size: 1.1rem;
			color: var(--color-text-muted);
		}
	}

	.s-act {
		padding: 0.35rem 0.9rem;
		font: inherit;
		font-size: 1.2rem;
		@include store-button($armable: true);

		// a second tap is what actually does it, the button says so, and
		// turns red (store-button's armed state)
	}

	.note.warn {
		color: var(--color-danger);
	}

	.note {
		margin-top: 0.8rem;
		font-size: 1.2rem;
		line-height: 1.45;
		color: var(--color-text-muted);

		a {
			color: var(--color-accent);
			text-underline-offset: 0.2em;

			&:hover {
				color: var(--color-text);
			}
		}
	}

	.paste {
		display: block;
		width: 100%;
		margin-top: 1rem;
		padding: 0.8rem 1rem;
		font: inherit;
		font-size: 1.2rem;
		line-height: 1.4;
		color: var(--color-text);
		background: var(--color-bg-light);
		border: 1px solid var(--color-border-card);
		border-radius: 0.6rem;
		resize: vertical;
	}

	.problems {
		padding-left: 1.6rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin-top: 1rem;
	}
</style>

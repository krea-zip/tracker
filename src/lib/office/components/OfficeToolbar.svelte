<script lang="ts">
	// the top of every office page: search and the draft's standing in the
	// header, the main parts on keys under it. one button at a time wears the
	// blue, whichever comes next: save, then publish. a save conflict offers a
	// download first, so nobody loses an afternoon's work.
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { OFFICE_KEYS, officeHref, officePage } from '$lib/office/navigation';
	import type { SearchAction } from '$lib/office/search';
	import { useOffice } from '$lib/office/workspace.svelte';
	import Keys from '$lib/planner/board/bar/Keys.svelte';
	import OfficeMore from './OfficeMore.svelte';
	import OfficeSearch from './OfficeSearch.svelte';

	let { large = $bindable(false) }: { large?: boolean } = $props();
	const office = useOffice();
	const current = $derived(officePage(page.url.pathname));
	const standing = $derived(
		office.busy ? 'saving…' : office.dirty ? 'unsaved' : office.status === 'published' ? 'published' : 'draft saved'
	);
	const canSave = $derived(!office.busy && !office.conflict && (office.dirty || office.revision === 0));

	let account: HTMLDetailsElement;
	let confirmReload = $state(false);

	async function signOut() {
		if (office.dirty && !confirm('Sign out and leave unsaved changes?')) return;
		try {
			const response = await fetch('/api/admin/session', { method: 'DELETE' });
			if (!response.ok) throw new Error();
			await invalidate('office:workspace');
		} catch {
			office.error = 'Could not sign out. Please try again.';
		}
	}

	// the draft as an Excel file, loaded only when asked for (exceljs is big)
	async function backup() {
		if (!office.document) return;
		try {
			const { downloadBackup } = await import('$lib/office/backup');
			await downloadBackup(office.document);
		} catch {
			office.error = 'The backup could not be downloaded. Please try again.';
		}
	}

	function run(action: SearchAction) {
		if (action === 'save') void office.save();
		else if (action === 'preview') office.preview();
		else void backup();
	}

	async function downloadDraft() {
		const { download } = await import('$lib/office/spreadsheet');
		download('unsaved-office-draft.json', JSON.stringify(office.document), 'application/json');
	}
</script>

<svelte:window
	onpointerdown={(e) => {
		if (account?.open && !account.contains(e.target as Node)) account.open = false;
	}}
/>

<header class="office-head">
	<a class="office-brand" href="/admin">tracker<span>office</span></a>
	<OfficeSearch onaction={run} />
	<div class="office-save-state" role="status" title={office.message}>
		<span class="office-status-dot" class:unsaved={office.dirty}></span>{standing}
	</div>
	{#if office.document}
		<button onclick={() => office.preview()}>preview</button>
		<button class:primary={canSave} disabled={!canSave} onclick={() => office.save()}>save</button>
		<a class="button" class:primary={!canSave} href="/admin/changes">
			publish{office.errors.length ? ` (${office.errors.length})` : ''}
		</a>
	{/if}
	<details class="office-account-menu" bind:this={account}>
		<summary aria-label="Account and tools"
			><span class="office-avatar">{office.name.charAt(0).toUpperCase()}</span></summary
		>
		<div>
			<p>{office.name}</p>
			<button aria-pressed={large} onclick={() => (large = !large)}>{large ? 'standard text' : 'larger text'}</button>
			<a href="/" target="_blank" rel="noopener">open the student planner</a>
			<button onclick={backup}>download excel backup</button>
			<button onclick={downloadDraft}>download draft json</button>
			<button onclick={signOut}>sign out</button>
		</div>
	</details>
</header>

<nav class="office-bar" aria-label="Academic office">
	<Keys label="main parts">
		{#each OFFICE_KEYS as key (key.path)}
			<a
				href={officeHref(key.path)}
				class:active={current.path === key.path}
				aria-current={current.path === key.path ? 'page' : undefined}>{key.label}</a
			>
		{/each}
	</Keys>
	<span class="office-bar-rule" aria-hidden="true"></span>
	<OfficeMore />
	<p class="office-bar-note">{current.detail}</p>
</nav>

{#if office.error}
	<div class="office-alert" role="alert">
		{office.error}
		{#if office.conflict}
			<p>Your unsaved work is still here. Download a backup before reloading the shared draft.</p>
			<div class="office-actions">
				<button onclick={downloadDraft}>download my draft</button>
				<button onclick={() => (confirmReload = true)}>reload shared draft</button>
			</div>
		{/if}
	</div>
{/if}

{#if confirmReload}
	<div class="office-confirm" role="alertdialog" aria-label="Reload shared draft">
		<p>Reloading replaces the unsaved draft on this screen. Have you downloaded anything you need to keep?</p>
		<button
			onclick={() => {
				confirmReload = false;
				void office.reload();
			}}>reload draft</button
		>
		<button onclick={() => (confirmReload = false)}>keep editing</button>
	</div>
{/if}

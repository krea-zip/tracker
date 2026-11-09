<script lang="ts">
	// the office's own columns on an offering (a room, a timetable slot, a
	// budget code), beyond what tracker knows about. they're office records:
	// never published to students. a required one blocks publishing until
	// every offering has it.
	import { useOffice } from '$lib/office/workspace.svelte';
	import type { CustomField } from '$lib/office/model';

	const office = useOffice();
	const fields = $derived(office.document?.fields ?? []);
	let label = $state('');

	function add() {
		if (!office.document || !label.trim()) return;
		const base =
			label
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'field';
		let id = base;
		for (let n = 2; fields.some((f) => f.id === id); n++) id = `${base}-${n}`;
		const field: CustomField = { id, label: label.trim(), type: 'text', options: [], required: false };
		office.document.fields.push(field);
		label = '';
	}

	function remove(id: string) {
		if (!office.document || !confirm('Remove this field? Values already entered on offerings are kept but hidden.'))
			return;
		office.document.fields = fields.filter((f) => f.id !== id);
	}
</script>

<h1>office fields</h1>
<p class="office-lead">
	Extra columns the office tracks on each offering, such as a room or a budget code. They stay in the office and are
	never shown to students.
</p>

<div class="office-row">
	<label>new field<input bind:value={label} placeholder="e.g. Room" /></label>
	<button class="primary" onclick={add}>add field</button>
</div>

{#each fields as field (field.id)}
	<section class="office-card">
		<fieldset class="office-form">
			<label>label<input bind:value={field.label} /></label>
			<label
				>Type
				<select bind:value={field.type}>
					<option value="text">Text</option>
					<option value="number">Number</option>
					<option value="date">Date</option>
					<option value="select">Choice from a list</option>
				</select>
			</label>
			{#if field.type === 'select'}
				<label class="wide"
					>Choices <span class="office-help">one per line</span>
					<textarea
						rows="3"
						value={field.options.join('\n')}
						onchange={(e) =>
							(field.options = e.currentTarget.value
								.split('\n')
								.map((o) => o.trim())
								.filter(Boolean))}
					></textarea>
				</label>
			{/if}
			<label class="office-check"
				><input type="checkbox" bind:checked={field.required} />Required on every offering</label
			>
		</fieldset>
		<button class="danger" onclick={() => remove(field.id)}>remove</button>
	</section>
{:else}
	<p class="office-empty">No extra fields yet.</p>
{/each}

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
</style>

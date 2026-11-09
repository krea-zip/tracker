<script lang="ts">
	import { useOffice } from '$lib/office/workspace.svelte';
	import CoursePicker from './CoursePicker.svelte';
	const office = useOffice();
	let from = $state(''),
		to = $state('');
</script>

<h2 id="equivalences">course equivalences</h2>
<p class="office-lead">Different codes for one course, and separate courses that can satisfy the same requirement.</p>
{#if office.document}
	<section class="office-card" id="cross-listed">
		<h2>cross-listed courses</h2>
		<p>manage department codes within each course record.</p>
		<div class="office-table-scroll">
			<table>
				<thead><tr><th>Course</th><th>Codes</th><th></th></tr></thead><tbody
					>{#each office.document.curriculum.courses.filter((c) => c.codes.length > 1) as c}<tr
							><td>{c.title}</td><td>{c.codes.join(' · ')}</td><td
								><a href="/admin/courses?course={c.code}">edit course</a></td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
	</section>
	<section class="office-card" id="interchangeable">
		<h2>interchangeable courses</h2>
		<p>
			Any course in a group can satisfy a prerequisite or required-course reference to another member of that group.
		</p>
		{#each office.document.curriculum.equivalences.substitutes, i}<div class="office-card">
				<CoursePicker
					courses={office.document.curriculum.courses}
					bind:values={office.document.curriculum.equivalences.substitutes[i]}
					label="Group {i + 1}"
					id="substitute-{i}"
				/><button class="danger" onclick={() => office.document!.curriculum.equivalences.substitutes.splice(i, 1)}
					>remove group</button
				>
			</div>{/each}<button onclick={() => office.document!.curriculum.equivalences.substitutes.push([])}
			>add interchangeable group</button
		>
	</section>
	<section class="office-card" id="one-way">
		<h2>one-way substitutions</h2>
		<p>The accepted course satisfies the original course’s requirement. The reverse is not automatically allowed.</p>
		<div class="office-table-scroll">
			<table>
				<thead><tr><th>Accepted course</th><th>In place of</th><th></th></tr></thead><tbody
					>{#each office.document.curriculum.equivalences.covers as pair, i}<tr
							><td>{pair.maths}</td><td>{pair.applied}</td><td
								><button onclick={() => office.document!.curriculum.equivalences.covers.splice(i, 1)}>remove</button
								></td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
		<div class="office-row">
			<label
				>Accepted course<select bind:value={from}
					><option value="">Select course</option>{#each office.document.curriculum.courses as c}<option value={c.code}
							>{c.code} · {c.title}</option
						>{/each}</select
				></label
			><label
				>Replaces<select bind:value={to}
					><option value="">Select course</option>{#each office.document.curriculum.courses as c}<option value={c.code}
							>{c.code} · {c.title}</option
						>{/each}</select
				></label
			><button
				disabled={!from || !to || from === to}
				onclick={() => {
					if (!office.document!.curriculum.equivalences.covers.some((p) => p.maths === from && p.applied === to))
						office.document!.curriculum.equivalences.covers.push({ maths: from, applied: to });
					from = to = '';
				}}>add substitution</button
			>
		</div>
	</section>
	<section class="office-card" id="credit-counting">
		<h2>credit counting</h2>
		<label
			>Default for courses shared by programmes<select bind:value={office.document.curriculum.creditSharing}
				><option value="one">Count toward one programme</option><option value="all"
					>Count toward all matching programmes</option
				></select
			></label
		><CoursePicker
			courses={office.document.curriculum.courses}
			bind:values={office.document.curriculum.equivalences.transcriptOnly}
			label="Transcript-only courses (do not count toward programme requirements)"
			id="transcript-only"
		/>
	</section>
{/if}

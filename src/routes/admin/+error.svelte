<script lang="ts">
	// a server load or action the office refused, said in the office's own
	// frame: the messages from $lib/server/office are written for staff
	import { page } from '$app/state';
</script>

<svelte:head><title>Academic office · tracker</title></svelte:head>

<section class="office-card">
	<h1>
		{page.status === 503 ? 'The office is not connected' : page.status === 403 ? 'No access' : 'Something went wrong'}
	</h1>
	<p>{page.error?.message}</p>
	<p><a href="/admin">back to the academic office</a></p>
</section>

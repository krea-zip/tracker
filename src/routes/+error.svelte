<script lang="ts">
	// any page that couldn't load, with the reason the server gave and a way back
	import { page } from '$app/state';

	const office = $derived(page.url.pathname.startsWith('/admin'));
</script>

<svelte:head><title>{page.status} · tracker</title></svelte:head>

<main>
	<p class="status">{page.status}</p>
	<h1>{page.status === 404 ? 'Nothing here' : 'Something went wrong'}</h1>
	<p>{page.error?.message}</p>
	<a href={office ? '/admin' : '/'}>{office ? 'Back to the academic office' : 'Back to the planner'}</a>
</main>

<style>
	main {
		display: grid;
		place-content: center;
		gap: 1.2rem;
		min-height: 100dvh;
		padding: 2.4rem;
		max-width: 60rem;
		margin: 0 auto;
		font-size: 1.6rem;
		color: var(--color-text);
		background: var(--color-bg);
	}

	.status {
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
	}

	h1 {
		font-size: 2.8rem;
	}

	a {
		color: var(--color-accent);
	}
</style>

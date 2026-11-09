<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	// the office's one shared password, plus a name for the history. the
	// server checks the password and remembers the sign-in for a week
	import { invalidate } from '$app/navigation';

	let name = $state('');
	let password = $state('');
	let busy = $state(false);
	let problem = $state('');

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		problem = '';
		try {
			const response = await fetch('/api/admin/session', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, password })
			});
			if (!response.ok) {
				problem = (await response.json().catch(() => null))?.message ?? 'Sign-in failed. Try again.';
				return;
			}
			password = '';
			await invalidate('office:workspace');
		} catch {
			problem = 'Could not connect. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="office-login">
	<a class="office-login-brand" href="/">tracker<span>academic office</span></a>
	<div class="office-eyebrow">A little order. A clearer path.</div>
	<h1>welcome to the office.</h1>
	<p class="office-lead">One place to look after your courses, academic rules and the student experience.</p>
	<div class="office-card">
		<h2>sign in to your workspace</h2>
		<p class="office-help">Use the office password. Your name identifies your changes in the release history.</p>
		<form class="office-form" onsubmit={signIn}>
			<label>your name<input bind:value={name} required maxlength="60" autocomplete="name" /></label>
			<label>password<input type="password" bind:value={password} required autocomplete="current-password" /></label>
			<div class="office-actions wide">
				<Button variant="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
			</div>
		</form>
		{#if problem}<p class="office-note error" role="alert">{problem}</p>{/if}
	</div>
	<a class="office-login-back" href="/">← Back to the student planner</a>
</section>

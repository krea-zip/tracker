import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

// a local page for screenshots, so it never exists on the live site
export const ssr = false;

export const load = () => {
	if (!dev) error(404);
};

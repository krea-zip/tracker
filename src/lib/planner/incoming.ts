// What the address bar brought with it: a course to show (?course=X, from a
// course page's "plan this course"), a shared plan (#plan=…), or a replay of
// the welcome (?welcome). Each is read once and taken off the URL so a reload
// doesn't bring it back.
import { sharedPlanIn } from '$lib/plans/share';

export type Incoming = {
	course: string | null;
	sharedPlan: string | null;
	shareId: string | null;
	account: string | null;
	welcome: boolean;
};

export function takeIncoming(): Incoming {
	let url = new URL(location.href);
	if (url.searchParams.has('account')) {
		try {
			const saved = sessionStorage.getItem('tracker-auth-return');
			sessionStorage.removeItem('tracker-auth-return');
			if (saved) {
				const next = new URL(saved, location.origin);
				if (next.origin === location.origin && next.pathname === '/') {
					next.searchParams.set('account', url.searchParams.get('account')!);
					url = next;
					history.replaceState(history.state, '', url);
				}
			}
		} catch {
			/* The saved board still restores independently. */
		}
	}
	const course = url.searchParams.get('course');
	const shareId = url.searchParams.get('share');
	const account = url.searchParams.get('account');
	url.searchParams.delete('account');
	const welcome = url.searchParams.has('welcome');
	if (course || welcome || account) {
		url.searchParams.delete('course');
		url.searchParams.delete('welcome');
		history.replaceState(history.state, '', url);
	}

	const sharedPlan = sharedPlanIn(location.hash);

	return { course, sharedPlan, shareId, account, welcome };
}

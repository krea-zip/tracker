import { browser } from '$app/environment';
import { previewSnapshot } from './preview';
import { playgroundSnapshot } from '$lib/planner/welcome/fixture';

// The welcome playground has its own document/module graph: its curriculum
// cannot replace the real planner's indexes, even while both are mounted.
export const isPlayground = () => browser && location.pathname.replace(/\/$/, '') === '/welcome-playground';
export const runtimeSnapshot = () => (isPlayground() ? playgroundSnapshot : previewSnapshot());

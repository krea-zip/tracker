import { getContext, setContext } from 'svelte';

export type SiteActions = { settings?: () => void; help?: () => void };
const key = Symbol('site-actions');
export const provideSiteActions = (actions: SiteActions) => setContext(key, actions);
export const useSiteActions = () => getContext<SiteActions>(key);

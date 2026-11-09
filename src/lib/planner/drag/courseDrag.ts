// what a dragged course carries. its own type, not text/plain: plain text
// let go anywhere that doesn't take it (the sidebar, the browser's tab strip
// or address bar) is opened as an address, which sent browsers to
// http://chem208/. a type only tracker reads gives nothing else anything to open.
const TYPE = 'application/x-tracker-course';

/** start carrying a course (a dragstart) */
export function carry(e: DragEvent, code: string) {
	if (!e.dataTransfer) return;
	e.dataTransfer.setData(TYPE, code);
	e.dataTransfer.effectAllowed = 'move';
}

/** the course a drop brought, '' if it isn't one of ours. browsers only
 *  let a drop (and the dragstart) read it, not the drags in between */
export const carried = (e: DragEvent): string => e.dataTransfer?.getData(TYPE) ?? '';

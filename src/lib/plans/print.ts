import { byCode, hasCode, subjectById } from '$lib/curriculum/data';
import type { Plan } from '$lib/planner/plan.svelte';

const escape = (value: unknown) =>
	String(value).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);

/** A separate print document keeps grades, account details and app controls out. */
export function printPlan(plan: Plan) {
	const popup = window.open('', '_blank');
	if (!popup) throw new Error('Allow pop-ups for tracker to open the PDF preview.');
	popup.opener = null;
	const degree = plan.programmes.map((p) => `${subjectById(p.subject).label} ${p.role}`).join(' + ');
	const terms = plan.years
		.flatMap((y) =>
			plan.trims.map((t) => {
				const courses = plan
					.slotCourses(y, t)
					.filter((code) => !code.includes('~') && hasCode(code))
					.map(byCode);
				return `<section><h2>${escape(plan.trimName(y, t))}</h2>${courses.length ? `<ul>${courses.map((c) => `<li><b>${escape(c.code)}</b> ${escape(c.title)} <span>${c.credits} cr</span></li>`).join('')}</ul>` : '<p>No courses planned</p>'}</section>`;
			})
		)
		.join('');
	popup.document.write(
		`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>tracker — study plan</title><style>body{font:14px system-ui;max-width:900px;margin:40px auto;padding:0 24px;color:#252025}h1{font-size:26px}h2{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:8px}section{break-inside:avoid;margin:24px 0}ul{padding:0;list-style:none}li{padding:6px 0}li span{float:right}p,footer{color:#666}button{padding:10px 16px;cursor:pointer}@media print{button{display:none}body{margin:0;max-width:none}@page{margin:18mm}}</style></head><body><button id="print">Print / save as PDF</button><h1>Study plan</h1><p>${escape(degree)} · ${plan.fourYear ? 4 : 3}-year · batch ${plan.batchStartYear}</p>${terms}<footer>Created with tracker · Planning guide, not an official registration record.</footer></body></html>`
	);
	popup.document.close();
	popup.document.getElementById('print')?.addEventListener('click', () => popup.print());
	popup.focus();
}

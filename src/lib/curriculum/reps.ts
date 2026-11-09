// each discipline's student representatives for the year, from the Ministry
// of Learning's discipline representative list. names only: tracker is a public
// site, so the reps' phone numbers stay on the registration sheet
export const REPS_YEAR = '2026-27';

const REPS: Record<string, string[]> = {
	'business studies': ['Vedant Khaduja'],
	economics: ['Rohan Jacob', 'Moksha Munoth'],
	philosophy: ['Aarthi Venkatesh'],
	history: ['Ananya Kaushik'],
	'political science': ['Aditya Trigunayat (Dilli)', 'Aalia Chondamma'],
	sociology: ['Prisha Prabhuram', 'Yugendhar Senthilkumar'],
	biology: ['Nidhi Rahul', 'Srestha Majumdar'],
	chemistry: ['Tanishka Agarwal', 'Muskaan Gupta'],
	'computer science': ['Apurva Varne', 'Shambo Mukherjee'],
	'data science': ['Catherine Jaison', 'Ishaan Kurian'],
	'environmental studies': ['Achinthya Sriman', 'Kavya Chitranshi'],
	mathematics: ['Hurudaya Narasimhan (Jeff)', 'Raghav Kathane'],
	physics: ['Manu Kartik', 'Ayushman Vardhan'],
	psychology: ['Raagini Rajan', 'Purvikalyani Prasannah'],
	literature: ['Amandeep Singh', 'Vyahruti Prakya'],
	arts: ['Kaartik Reddy']
};

/** a subject's reps, or none (the core, the open minor) */
export const repsFor = (subject: string): string[] => REPS[subject] ?? [];

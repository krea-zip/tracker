# tracker

Plan your whole degree at Krea University, one trimester at a time. Pick your batch and programmes, drag courses onto the grid, and tracker tracks your credits and checks the plan as you build it.

**[Open tracker ↗](https://kcal-delta.vercel.app)**

## To do

### High priority

- [ ] Feedback form sends nowhere: it still posts to Netlify, but the site is on Vercel (`POST /` returns 405)
- [ ] Don't load Supabase or call `/api/account` for guests while Google sign-in is off
- [ ] Use `$env/static/public` so hydration doesn't wait on `/_app/env.js`
- [ ] Run server functions in `sin1`, next to the database (they run in `iad1`)
- [ ] Self-host Ubuntu Sans instead of the render-blocking Google Fonts `@import`
- [ ] Don't show the sample plan before a student's own plan has loaded
- [ ] Cut Vercel routes: 1,870 of the 2,048 limit, since every prerendered page costs two
- [ ] Add a favicon, a page description for the planner and a social preview

### Medium priority

- [ ] Load rarely used parts on demand: welcome, settings, grades, what-if, credit rules
- [ ] Fetch course descriptions when a course is first opened, not for everyone
- [ ] Keep shrinking `plan.svelte.ts` (1,581 lines): what-if and breaks are next
- [ ] Break up `DetailsPanel.svelte` (1,246 lines) into its three sections
- [ ] Prune `office_history`: every save keeps a full copy of the draft
- [ ] Tell open tabs when a new catalogue is published (`version.pollInterval`, `updated`)
- [ ] Back button closes course details on a phone (shallow routing)
- [ ] Add security headers
- [ ] Migrate to SvelteKit 3 (Vite 8, TypeScript 6, `$lib` becomes `#lib`)
- [ ] Drop the retired tables (`course_reviews`, `office_staff`, `office_submissions`)
- [ ] Finish the work-in-progress views: will it run?, prerequisites, what-if
- [ ] Turn Google sign-in back on
- [ ] Test phone sizes: 320, 360, 375, 390, 412 and 430px

## Notes

### Run it

```bash
npm install
npm run dev
```

### Find a deleted file in git history

```bash
git log --all --full-history -- "**/welcome/Demo.svelte"
```

### Add an icon

1. Draw it on a 16×16 grid as an SVG path made of whole-pixel rectangles
2. Add the path to `paths` in `src/lib/ui/PixelIcon.svelte`, and its name to the `name` prop's type
3. Use it: `<PixelIcon name="gear" size="1.6rem" snap />`

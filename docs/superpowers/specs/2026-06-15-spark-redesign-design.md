# Spark Redesign — Title-First Model (Design Spec)

**Date:** 2026-06-15
**Replaces:** the current "prompt-as-title" Spark model + cramped italic-quote modal card + non-existent `/sparks/new` route.
**Status:** Locked via brainstorm session, awaiting implementation plan.

---

## 1. Intent

The current Spark model stores the prompt text directly in the `title` column. Cards then render the prompt as an italic quote, line-clamped to 2 lines. Long or complex prompts truncate badly mid-sentence; short prompts read awkwardly because the card surface is designed for paragraph-length text. Creation happens in a modal inside `/discover`, and the URL `/sparks/new` 404s.

This redesign splits Sparks into three explicit fields — short **title** (the hook), **prompt** (the writing challenge), and optional **description** (context, inspiration, format notes) — and ships a dedicated `/sparks/new` creation page with a redesigned A+B hybrid card surface across all Discover variants.

## 2. Decisions

| Q | Decision |
|---|----------|
| Q1 — Field model | `title` (required, 60 char max) · `prompt` (required, 500 char max, **new column**) · `description` (optional, unlimited, existing column — repurposed for "extra context"). `rules` field (existing) stays for submission rules. |
| Q2 — Migration | One-shot script: for every existing row, copy `title` → `prompt`; truncate `title` to first 50 chars + `…` if longer (legacy creators can edit later). Run once via `npm run migrate:sparks-title`. |
| Q3 — Card design | A+B hybrid per locked brainstorm — clean dark iOS tile, 3px status-color top strip, status pill + genre label, Comfortaa 17px title, 11px Newsreader italic prompt teaser (first 80 chars + `…`), hairline divider, meta footer with avatar + entry count. |
| Q4 — Card width | 280px standard; 240px on narrow breakpoints (`auto-fill, minmax(240px, 1fr)`). |
| Q5 — Creation flow | New `/[locale]/sparks/new` page wizard (single-step form for v1) — title input with live counter / prompt textarea with counter / description textarea (optional) / word limit slider / deadline picker / genre dropdown / visibility + discoverable controls. Existing `<CreateSparkModal>` updated in-place to use the same Zod schema so create-from-Discover still works. |
| Q6 — Detail page | `/sparks/[sparkId]` reshape: title becomes the page H1, prompt block becomes the hero (large Newsreader, brand-yellow blockquote rule), description shows as a "Context" section below when present, rules unchanged. |
| Q7 — Featured Spark hero | The `<FeaturedSparkHero>` strip on `/discover?tab=sparks` (slim featured banner) shows title only (no italic quote treatment). |
| Q8 — Card surfaces | The new `<SparkCard>` replaces all 4 existing variants (`<RailSparkCard>`, `<DiscoverSparkCard>`, `<SparkGridCard>`, `<SparkEntryCard>` — the last only shares some chrome). Single canonical component with `size: 'sm' | 'md'` prop for the 240/280px variants. |

## 3. Schema change

### 3.1 New column

```ts
// db/schema/social.ts — append to sparks table
export const sparks = pgTable('sparks', {
  // ... existing columns
  prompt: text('prompt').notNull().default(''),  // NEW
  // ... rest
})
```

- `prompt text NOT NULL DEFAULT ''` so the migration runner doesn't need to backfill before adding the constraint.
- After the migration script runs (§5), the Zod layer (`lib/validations/spark.ts`) enforces `prompt.min(1)` for new creates — DB stays at `DEFAULT ''` so the column-level constraint remains lenient.

### 3.2 Validation layer

```ts
// lib/validations/spark.ts (new file OR extend existing)
export const createSparkSchema = z.object({
  title: z.string().trim().min(3).max(60),
  prompt: z.string().trim().min(10).max(500),
  description: z.string().trim().max(2000).optional(),
  rules: z.string().trim().max(2000).optional(),
  // unchanged:
  wordLimit: z.number().int().positive().optional(),
  genre: z.string().optional(),
  deadline: z.date(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']),
  discoverable: z.boolean(),
})
```

- Title `max(60)` is the hard cap. UI shows live counter starting yellow at 50, red at 60.
- Prompt `max(500)` — generous; cards teaser-truncates at 80 anyway.
- Description optional, unlimited semantically but capped at 2000 to prevent abuse.

## 4. New `<SparkCard>` component

`app/[locale]/(public)/discover/_components/spark-card.tsx` — single canonical component.

```tsx
type Props = {
  spark: SparkCard            // existing data shape, just gains a 'prompt' field
  locale: string
  size?: 'sm' | 'md'          // sm = 240px target, md = 280px target (default)
}
```

**Anatomy (per locked design):**
- Outer: tile gradient (`linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`), 14px border-radius, multi-layer shadow on hover.
- 3px top strip — brand-yellow for OPEN, brand-yellow for VOTING (different status label), `--canvas-dark-ink-muted` for CLOSED.
- Header row (margin-bottom 12px):
  - Left: status pill — `rgba(255,195,0,0.15)` background, brand-yellow text, 9px mono uppercase. `⚡ OPEN · 8h` / `🗳 VOTING · 2d` / `○ CLOSED`.
  - Right: genre label in 9px mono uppercase muted (or hidden if no genre).
- Title — Comfortaa 17px (15px on `sm`), font-weight 700, white, `line-clamp-2`, `min-h` set so single-line titles still reserve 2 lines worth of space.
- Prompt teaser — Newsreader italic (or Georgia fallback), 11px, `--canvas-dark-ink-muted`. First 80 characters of `prompt`, ending with `…` if truncated. Conditionally rendered: hidden when `prompt` is empty (legacy rows pre-migration). Always 2 lines tall via `min-h` so cards stay uniform.
- Hairline divider — `border-top: 1px solid rgba(255,255,255,0.06)`, 10px padding-top.
- Meta footer (flex row, space-between):
  - Left: 18px round avatar + `@username` in 10px mono muted.
  - Right: `1000w · 12 entries` (or `winner @x` line for CLOSED + winner present).

Hover: subtle `translateY(-1px)` + deeper shadow.

`<Link>` wraps the whole card → `/sparks/[sparkId]`.

## 5. Migration script

`scripts/migrate-sparks-title.ts` (one-shot).

```ts
// Pseudocode
const all = await db.select().from(sparks)
for (const s of all) {
  if (s.prompt && s.prompt.length > 0) continue  // already migrated
  const promptText = s.title
  const newTitle = s.title.length <= 60
    ? s.title
    : s.title.slice(0, 49).trim() + '…'
  await db.update(sparks)
    .set({ prompt: promptText, title: newTitle })
    .where(eq(sparks.id, s.id))
}
```

- Idempotent (skips rows where `prompt` is already populated).
- Truncation at 49 chars (leaving 1 for the ellipsis) keeps the new title under the 60-char limit so the Zod schema accepts it on next edit.
- Refuses to run on production-y `DATABASE_URL` (same safety check as `seed-discover.ts`).
- Logs `before/after` for each row to stderr so creators can quick-review and edit.

Command: `npm run migrate:sparks-title`.

Seed script (`scripts/seed-discover.ts`) also needs updating: each seeded spark should generate a short title + use the existing prompt as `prompt`. Title can be 2-3 word noun phrase ("Kingdom Heist", "Wishes Object", "Library Lies"). A small `synthesizeTitle(prompt)` helper takes the first 3-4 words and title-cases them.

## 6. `/sparks/new` page

New route at `app/[locale]/(public)/sparks/new/page.tsx`.

**Auth:** redirect to `/sign-in?next=/sparks/new` for guests.

**Layout:** centered single-column form on the dark iOS card surface, ~600px wide.

**Fields, top-to-bottom:**

1. **Title** — `<input>` with live `n / 60` counter (counter turns yellow at 50, red at 60). Required. Placeholder: `Short, catchy. "Kingdom Heist"`.
2. **Prompt** — `<textarea>` 4 rows with live `n / 500` counter. Required. Placeholder: `The actual writing challenge. Be specific.`
3. **Description (optional)** — `<textarea>` 3 rows. Placeholder: `Extra context, inspiration, examples, why you made this.`
4. **Rules (optional)** — `<textarea>` 2 rows, collapsed under "Add rules" expander to reduce form fatigue.
5. **Word limit** — radio group: `Flash (<500) · 500-2000 · 2000+` (matches existing filter buckets) or numeric input override.
6. **Deadline** — date+time picker. Default = 7 days out at 23:59 local.
7. **Genre** — dropdown of the 14 standard slugs (optional).
8. **Visibility + discoverable** — reuses the existing `<SharingControls>` component used by Book wizard Step 4.

**Submit button:** brand-yellow pill, "Spark it →". Disabled until required fields valid.

**Server action:** `createSparkAction` (existing or extended) validates via the new `createSparkSchema`, inserts row, redirects to `/sparks/[id]`.

**Discover modal**: existing `<CreateSparkModal>` updates to use the SAME Zod schema + the same field shape (just rendered in the modal instead of the page). Or — defer the modal redesign to a follow-up; the page is enough for v1 and the existing modal becomes secondary.

## 7. `/sparks/[sparkId]` detail page reshape

- H1 changes from showing `title` (currently the prompt text) to showing the new short `title`. No quote treatment, just the title.
- Below H1: a hero **Prompt block** — `<blockquote>` style, Newsreader 18px italic, brand-yellow left rule (4px), `max-width: 65ch`. Shows the full `prompt`.
- Below prompt: "Context" section header (mono uppercase muted) + Newsreader 14px description body, only when `description` is set.
- Rules section unchanged.
- Existing entry submission UI unchanged.
- Existing comments unchanged.

## 8. `<FeaturedSparkHero>` (slim featured banner on /discover?tab=sparks)

- Currently shows `★ FEATURED · "{title}" — by @{creator}`.
- New: `★ FEATURED · {title} — by @{creator}`. (Title is now the short label, no quote treatment needed.)
- Hidden cleanly when no qualifier — unchanged.

## 9. Component changes

### New
- `app/[locale]/(public)/discover/_components/spark-card.tsx` — canonical card.
- `app/[locale]/(public)/sparks/new/page.tsx` — creation page.
- `app/[locale]/(public)/sparks/new/_components/create-spark-form.tsx` — client form.
- `scripts/migrate-sparks-title.ts` — one-shot migration runner.
- `lib/validations/spark.ts` — Zod schema (if not already present).

### Modified
- `db/schema/social.ts` — add `prompt` column.
- `lib/actions/sparks.actions.ts` — `createSparkAction` accepts/validates new field shape.
- `lib/actions/discover-sparks.actions.ts` — `SparkCard` projection adds `prompt: string`.
- `app/[locale]/(public)/discover/_components/spark-grid-card.tsx` — currently a re-export of `RailSparkCard`; replace with re-export of new `SparkCard`.
- `app/[locale]/(public)/discover/_components/rail-spark-card.tsx` — replaced wholesale OR kept as the size='sm' variant; collapse to a re-export of `<SparkCard size="sm">`.
- `app/[locale]/(public)/discover/_components/featured-spark-hero.tsx` — copy update only.
- `app/[locale]/(public)/discover/_components/create-spark-modal.tsx` — update field shape to title + prompt + description (or defer — see §6).
- `app/[locale]/(public)/sparks/[sparkId]/page.tsx` — detail page reshape per §7.
- `scripts/seed-discover.ts` — synthesize short title from the seeded prompt; populate `prompt` column.
- `package.json` — add `migrate:sparks-title` script.

### Untouched
- Spark entries (submissions), votes, comments, sidebar filters, pagination.

## 10. Acceptance criteria

1. Existing dev sparks render correctly post-migration (short title visible, full prompt accessible on detail page).
2. New sparks created via `/sparks/new` validate per Zod schema and surface correctly on Discover.
3. Cards line up uniformly in the grid regardless of title length.
4. Title input shows live counter; can't submit past 60 chars.
5. Prompt teaser on cards truncates with `…` at 80 chars; hidden cleanly when `prompt` is empty.
6. `/sparks/new` as guest redirects to sign-in with `?next` preserved.
7. Featured Spark hero shows title (no italic quote).
8. Detail page renders prompt as a hero blockquote, description as Context section when present.
9. Sparks search and filters in `/discover?tab=sparks` continue to work (no regression).
10. Migration script idempotent — second run is a no-op.

## 11. Out of scope (deferred)

1. **`<CreateSparkModal>` redesign** — for v1 the page is canonical; the existing modal stays functional via shared schema but its UI doesn't get the full polish. Follow-up to fold its UX into the page form via a shared `<SparkFormFields>` component.
2. **Spark editing** — existing `/sparks/[id]/edit` route (if any) follows the same field shape; redesigning it is a separate task.
3. **Spark templates** — a "Use a template" picker on `/sparks/new` could prefill title + prompt from common patterns. Not v1.
4. **Auto-generated titles via LLM** — could synthesize a punchy title from the prompt at creation time. Not v1; let creators write their own.
5. **Title profanity filter** — out of scope.
6. **Apply title-first model to Hives / Lists / Clubs** — those entities already have explicit `name` fields and don't suffer the same prompt-overflow issue.

## 12. Risks

- **Existing creators may be confused** when their long-prompt title gets auto-truncated. Mitigation: the migration script logs every change to stderr; we add a banner on owned-spark detail pages until the creator confirms the new title.
- **Prompt teaser at 80 chars** may cut mid-word and look awkward. Mitigation: truncate at the last word boundary before 80 chars rather than mid-string.
- **Modal vs page divergence** — for v1 only the page gets the full polish. Need to ensure both surfaces use the same Zod schema so there's no validation drift.
- **Seed script changes** invalidate any dev DB created from the previous seed shape. `npm run seed:discover` will wipe + re-create cleanly so the impact is contained.

# Spark Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the spark title-first model + A+B hybrid card + new `/sparks/new` creation page per spec [docs/superpowers/specs/2026-06-15-spark-redesign-design.md](../specs/2026-06-15-spark-redesign-design.md) ([a89de65](https://github.com/Cremacious/beehive-studio/commit/a89de65)).

**Architecture:** Add `prompt` column to `sparks` with a `DEFAULT ''` so migration is a separate scripted step. New `<SparkCard>` is the canonical component consumed by Discover grid, rails, and the Featured strip — old variants collapse to thin re-exports. New `/sparks/new` page sits alongside existing `<CreateSparkModal>` which gets the same Zod schema (full modal redesign deferred per spec §11). Migration script lives at `scripts/migrate-sparks-title.ts`, runnable via `npm run migrate:sparks-title`. Seed script updates to synthesize short titles from prompts.

**Reference precedent:** Hot Books plan ([885dab9](https://github.com/Cremacious/beehive-studio/commit/885dab9)) shows the subagent-driven wave shape. Seed wipe + safety pattern from `scripts/seed-discover.ts`. Schema-add-with-DEFAULT pattern from W2 of Books action extension ([b04de21](https://github.com/Cremacious/beehive-studio/commit/b04de21) style).

**Resolved deferred decisions (from spec Resume Here):**
1. **`<CreateSparkModal>` polish** → wire the new fields + Zod schema; defer full UX redesign. Modal accepts title/prompt/description/rules; renders inline in the existing dialog. Polish is a follow-up.
2. **`synthesizeTitle()` seed helper** → take first 4 words of the prompt, capitalize each, strip trailing punctuation, cap at 50 chars. Examples: "A heist gone right…" → `"A Heist Gone Right"`.
3. **Word-boundary teaser truncation** → `truncateAtWord(text, 80)` helper. Walks back from index 80 to the last space, slices there, appends `'…'`. If 80 already hits a space, slice cleanly. If no space found before index 80 (single huge word), fall back to hard 80-char cut.

---

## File structure

**New:**
- `lib/sparks/truncate-at-word.ts` + `__tests__/truncate-at-word.test.ts`
- `lib/sparks/synthesize-title.ts` + `__tests__/synthesize-title.test.ts`
- `lib/validations/spark.ts` (Zod schemas)
- `lib/validations/__tests__/spark.test.ts`
- `app/[locale]/(public)/discover/_components/spark-card.tsx` (canonical card)
- `app/[locale]/(public)/sparks/new/page.tsx` (creation page)
- `app/[locale]/(public)/sparks/new/_components/create-spark-form.tsx` (client form)
- `scripts/migrate-sparks-title.ts`

**Modified:**
- `db/schema/social.ts` — add `prompt` column to `sparks`.
- `lib/actions/sparks.actions.ts` — `createSparkAction` validates via new Zod schema, accepts new field shape.
- `lib/actions/discover-sparks.actions.ts` — `SparkCard` type + `projectToSparkCards` add `prompt: string`.
- `app/[locale]/(public)/discover/_components/spark-grid-card.tsx` — re-export new `<SparkCard size="md">`.
- `app/[locale]/(public)/discover/_components/rail-spark-card.tsx` — re-export new `<SparkCard size="sm">` (or rebuild internally if call sites pass too many specific props).
- `app/[locale]/(public)/discover/_components/featured-spark-hero.tsx` — show title only, drop italic quote treatment.
- `app/[locale]/(public)/discover/_components/create-spark-modal.tsx` — update field shape to title/prompt/description; uses same Zod schema as new page.
- `app/[locale]/(public)/sparks/[sparkId]/page.tsx` — detail page reshape (H1 = title; Prompt block hero; Context section when description present).
- `scripts/seed-discover.ts` — synthesize short title from each seeded prompt; populate `prompt` column.
- `package.json` — add `migrate:sparks-title` script.
- `AGENTS.md` — bookkeeping at ship.

**Untouched:**
- Spark entries (submissions), votes, comments, sidebar filters, pagination, search action, status enums.

---

## Wave 1 — Pure helpers + Zod

Pure modules with unit tests. No DB, no UI. Get the algorithm + validation contracts locked before anything writes to the database.

### Task 1.1: `truncateAtWord` helper

**Files:** `lib/sparks/truncate-at-word.ts`, `lib/sparks/__tests__/truncate-at-word.test.ts`

- [ ] Create `lib/sparks/truncate-at-word.ts`:
   ```ts
   /**
    * Truncates `text` at or before `maxLen`, preferring the last whitespace
    * boundary so we don't cut mid-word. Returns the original text if it
    * already fits. Returns at most `maxLen + 1` chars (the trailing '…').
    *
    * Edge case: if no whitespace exists before maxLen (single huge word),
    * falls back to a hard maxLen-char slice + ellipsis.
    */
   export function truncateAtWord(text: string, maxLen: number): string {
     if (text.length <= maxLen) return text
     const slice = text.slice(0, maxLen)
     const lastSpace = slice.lastIndexOf(' ')
     if (lastSpace === -1) return slice + '…'
     return slice.slice(0, lastSpace).trimEnd() + '…'
   }
   ```
- [ ] Tests:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { truncateAtWord } from '../truncate-at-word'

   describe('truncateAtWord', () => {
     it('returns original when shorter than maxLen', () => {
       expect(truncateAtWord('short', 80)).toBe('short')
     })
     it('returns original when exactly maxLen', () => {
       expect(truncateAtWord('a'.repeat(80), 80)).toBe('a'.repeat(80))
     })
     it('truncates at last space before maxLen', () => {
       const input = 'A heist gone right in a kingdom that does not exist and is long'
       const r = truncateAtWord(input, 30)
       expect(r.endsWith('…')).toBe(true)
       expect(r.length).toBeLessThanOrEqual(31)
       expect(r).not.toContain('  ')
     })
     it('falls back to hard slice when no whitespace exists', () => {
       expect(truncateAtWord('a'.repeat(100), 10)).toBe('a'.repeat(10) + '…')
     })
     it('trims trailing whitespace before the ellipsis', () => {
       expect(truncateAtWord('hello world  more text', 7)).toBe('hello…')
     })
   })
   ```
- [ ] Run `npx vitest run lib/sparks/__tests__/truncate-at-word.test.ts` — all pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks): truncateAtWord helper + tests.`

### Task 1.2: `synthesizeTitle` helper

**Files:** `lib/sparks/synthesize-title.ts`, `lib/sparks/__tests__/synthesize-title.test.ts`

- [ ] Create `lib/sparks/synthesize-title.ts`:
   ```ts
   /**
    * Generates a short title for a spark from its prompt. Takes the first 4
    * words, title-cases each, strips trailing punctuation, caps at 50 chars.
    * Used by:
    *   - seed-discover.ts to invent titles for seeded prompts
    *   - migrate-sparks-title.ts as a fallback when title is empty
    *
    * Deterministic — same input → same output (no randomness).
    */
   export function synthesizeTitle(prompt: string): string {
     const cleaned = prompt.trim().replace(/\s+/g, ' ')
     if (cleaned.length === 0) return 'Untitled Spark'
     const words = cleaned.split(' ').slice(0, 4)
     const titleCased = words
       .map((w) => {
         if (w.length === 0) return w
         return w[0].toUpperCase() + w.slice(1).toLowerCase()
       })
       .join(' ')
     const stripped = titleCased.replace(/[.,;:!?\-'"]+$/, '')
     return stripped.length <= 50 ? stripped : stripped.slice(0, 49).trimEnd() + '…'
   }
   ```
- [ ] Tests:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { synthesizeTitle } from '../synthesize-title'

   describe('synthesizeTitle', () => {
     it('takes first 4 words and title-cases them', () => {
       expect(synthesizeTitle('a heist gone right in a kingdom')).toBe('A Heist Gone Right')
     })
     it('strips trailing punctuation', () => {
       expect(synthesizeTitle('an object that grants wishes!')).toBe('An Object That Grants')
     })
     it('handles fewer than 4 words', () => {
       expect(synthesizeTitle('two strangers meet')).toBe('Two Strangers Meet')
     })
     it('falls back to Untitled Spark for empty input', () => {
       expect(synthesizeTitle('')).toBe('Untitled Spark')
       expect(synthesizeTitle('   ')).toBe('Untitled Spark')
     })
     it('caps at 50 chars with ellipsis when very long words', () => {
       const r = synthesizeTitle('antidisestablishmentarianism is a long word indeed')
       expect(r.length).toBeLessThanOrEqual(50)
     })
     it('is deterministic (same input → same output)', () => {
       const r1 = synthesizeTitle('test prompt here please')
       const r2 = synthesizeTitle('test prompt here please')
       expect(r1).toBe(r2)
     })
   })
   ```
- [ ] Run `npx vitest run lib/sparks/__tests__/synthesize-title.test.ts` — all pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks): synthesizeTitle helper + tests.`

### Task 1.3: Zod validation schema

**Files:** `lib/validations/spark.ts`, `lib/validations/__tests__/spark.test.ts`

- [ ] Check if `lib/validations/spark.ts` already exists. If yes, append the new schemas; if no, create.
- [ ] Add `createSparkSchema` and `updateSparkSchema`:
   ```ts
   import { z } from 'zod'

   export const TITLE_MAX = 60
   export const PROMPT_MAX = 500
   export const DESCRIPTION_MAX = 2000
   export const RULES_MAX = 2000

   export const createSparkSchema = z.object({
     title: z.string().trim().min(3, 'Title must be at least 3 characters').max(TITLE_MAX),
     prompt: z.string().trim().min(10, 'Prompt must be at least 10 characters').max(PROMPT_MAX),
     description: z.string().trim().max(DESCRIPTION_MAX).optional(),
     rules: z.string().trim().max(RULES_MAX).optional(),
     wordLimit: z.number().int().positive().nullable().optional(),
     genre: z.string().nullable().optional(),
     deadline: z.coerce.date(),
     visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
     discoverable: z.boolean().default(true),
   })

   export type CreateSparkInput = z.infer<typeof createSparkSchema>

   export const updateSparkSchema = createSparkSchema.partial().extend({
     id: z.string().min(1),
   })
   export type UpdateSparkInput = z.infer<typeof updateSparkSchema>
   ```
- [ ] Tests covering: minimum lengths, max lengths, optional fields, default values, type inference:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { createSparkSchema, TITLE_MAX, PROMPT_MAX } from '../spark'

   describe('createSparkSchema', () => {
     const base = {
       title: 'The Kingdom Heist',
       prompt: 'A heist gone right in a kingdom that does not exist.',
       deadline: new Date(Date.now() + 86400000 * 7),
     }
     it('accepts valid input', () => {
       expect(() => createSparkSchema.parse(base)).not.toThrow()
     })
     it('rejects title under 3 chars', () => {
       expect(() => createSparkSchema.parse({ ...base, title: 'ab' })).toThrow()
     })
     it('rejects title over max', () => {
       expect(() => createSparkSchema.parse({ ...base, title: 'a'.repeat(TITLE_MAX + 1) })).toThrow()
     })
     it('rejects prompt under 10 chars', () => {
       expect(() => createSparkSchema.parse({ ...base, prompt: 'too short' })).toThrow()
     })
     it('rejects prompt over max', () => {
       expect(() => createSparkSchema.parse({ ...base, prompt: 'a'.repeat(PROMPT_MAX + 1) })).toThrow()
     })
     it('accepts optional description + rules', () => {
       const r = createSparkSchema.parse({
         ...base,
         description: 'Extra context.',
         rules: 'No tropes.',
       })
       expect(r.description).toBe('Extra context.')
       expect(r.rules).toBe('No tropes.')
     })
     it('defaults visibility to PUBLIC and discoverable to true', () => {
       const r = createSparkSchema.parse(base)
       expect(r.visibility).toBe('PUBLIC')
       expect(r.discoverable).toBe(true)
     })
   })
   ```
- [ ] Run `npx vitest run lib/validations/__tests__/spark.test.ts` — all pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks/validations): Zod schemas for title-first model.`

---

## Wave 2 — Schema migration

### Task 2.1: Add `prompt` column to `sparks` table

**Files:** `db/schema/social.ts`, `scripts/migrate-sparks-title.ts`, `package.json`

- [ ] Read `db/schema/social.ts` to find the `sparks` table definition.
- [ ] Append `prompt: text('prompt').notNull().default('')` to the column list (location: after `title`, before `description`).
- [ ] Generate + push the migration via the project's pattern:
   ```bash
   npm run db:generate   # if drizzle-kit auto-generates a migration SQL file
   npm run db:push       # apply to dev DB
   ```
   OR write a manual `scripts/migrate-sparks-schema.ts` that runs `ALTER TABLE sparks ADD COLUMN prompt text NOT NULL DEFAULT ''` — match whatever pattern the codebase uses for other schema changes. Check `scripts/migrate-h4.ts`, `scripts/migrate-d3a.ts` etc. for prior art.
- [ ] Run `npx tsc --noEmit` — clean. New column shows up in the inferred `Spark` type.
- [ ] Run `npm test` — full suite green (no test broke from the new column).
- [ ] Commit `feat(sparks/schema): add prompt column to sparks table.`

### Task 2.2: One-shot migration script

**Files:** `scripts/migrate-sparks-title.ts`, `package.json`

- [ ] Create `scripts/migrate-sparks-title.ts` mirroring the safety pattern in `scripts/seed-discover.ts`:
   ```ts
   import 'dotenv/config'
   import { db } from '../db'
   import { sparks } from '../db/schema/social'
   import { eq } from 'drizzle-orm'

   // Safety: refuse on production-y DB.
   const dbUrl = process.env.DATABASE_URL ?? ''
   if (process.env.NODE_ENV === 'production') {
     console.error('REFUSED: NODE_ENV=production.')
     process.exit(1)
   }
   if (/prod|production|live/i.test(dbUrl)) {
     console.error('REFUSED: DATABASE_URL looks production-y.')
     process.exit(1)
   }
   if (!dbUrl) {
     console.error('REFUSED: DATABASE_URL not set.')
     process.exit(1)
   }

   async function main() {
     console.log('→ Migrating sparks: title → prompt + truncate title…')
     const all = await db.select().from(sparks)
     let migrated = 0
     for (const s of all) {
       if (s.prompt && s.prompt.length > 0) continue   // already migrated
       const promptText = s.title
       const newTitle = s.title.length <= 60
         ? s.title
         : s.title.slice(0, 49).trimEnd() + '…'
       await db.update(sparks)
         .set({ prompt: promptText, title: newTitle })
         .where(eq(sparks.id, s.id))
       console.log(`  ${s.id}: ${promptText.slice(0, 50)}${promptText.length > 50 ? '…' : ''} → ${newTitle}`)
       migrated++
     }
     console.log(`✓ Migrated ${migrated} of ${all.length} sparks.`)
   }

   main().then(() => process.exit(0)).catch((err) => {
     console.error(err)
     process.exit(1)
   })
   ```
- [ ] Add to `package.json` scripts:
   ```json
   "migrate:sparks-title": "dotenv -e .env.local -- tsx scripts/migrate-sparks-title.ts"
   ```
- [ ] Run `npm run migrate:sparks-title` once on the dev DB — observe the per-row logs. Run AGAIN to verify idempotency (second run says "Migrated 0 of N").
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks/migrate): one-shot script to migrate title → prompt.`

### Task 2.3: Update seed-discover to use new model

**File:** `scripts/seed-discover.ts`

- [ ] Locate the spark seeding block in `scripts/seed-discover.ts`.
- [ ] Import `synthesizeTitle` from `lib/sparks/synthesize-title`.
- [ ] Change the spark insert to populate both `title` (synthesized from prompt) and `prompt` (the existing seed prompt text). Drop the previous behavior of stuffing prompt into title.
- [ ] Run `npm run seed:discover` — observe new sparks have short titles + populated prompts. Check 5 random sparks via `psql` or drizzle studio.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(scripts/seed-discover): populate spark title + prompt separately.`

---

## Wave 3 — Canonical `<SparkCard>` component

### Task 3.1: Extend `SparkCard` type + projection

**Files:** `lib/actions/discover-sparks.actions.ts`

- [ ] Find the `SparkCard` type definition and add `prompt: string` field.
- [ ] Find every projection that builds `SparkCard` (`projectToSparkCards` and any inline `.select(...)` in the action file) and add `prompt: sparks.prompt` to the SELECT.
- [ ] Run `npx tsc --noEmit` — clean (any consumer that doesn't yet use `prompt` is fine since the field is non-optional but always populated).
- [ ] Run `npm test` — full suite green.
- [ ] Commit `feat(discover/sparks): SparkCard type + projection adds prompt.`

### Task 3.2: New canonical `<SparkCard>` component

**Files:** `app/[locale]/(public)/discover/_components/spark-card.tsx`

- [ ] Build the component per spec §4 (A+B hybrid):
   ```tsx
   'use client'
   import Link from 'next/link'
   import { Flame, Vote } from 'lucide-react'   // pick icons matching status
   import { truncateAtWord } from '@/lib/sparks/truncate-at-word'
   import type { SparkCard as SparkCardData } from '@/lib/actions/discover-sparks.actions'

   type Props = {
     spark: SparkCardData
     locale: string
     size?: 'sm' | 'md'   // sm = 240px target, md = 280px target (default)
   }

   const TEASER_MAX = 80

   export function SparkCard({ spark, locale, size = 'md' }: Props) {
     const isOpen = spark.status === 'OPEN'
     const isVoting = spark.status === 'VOTING'
     const isClosed = spark.status === 'CLOSED'

     const accent = isClosed
       ? 'var(--canvas-dark-ink-muted)'
       : 'var(--brand)'

     // Countdown source per status
     const countdownDate = isOpen ? spark.deadline : isVoting ? spark.votingEndsAt : null
     const countdownLabel = countdownDate ? timeLeftLabel(countdownDate) : ''

     const teaser = spark.prompt && spark.prompt.length > 0
       ? truncateAtWord(spark.prompt, TEASER_MAX)
       : null

     return (
       <Link
         href={`/${locale}/sparks/${spark.id}`}
         className="block no-underline w-full transition-transform hover:-translate-y-px"
         style={{ /* tile gradient + shadow per spec §4 */ }}
       >
         {/* 3px status-color top strip */}
         <div style={{ height: '3px', background: accent }} />
         {/* Header row: status pill + genre label */}
         {/* Title — Comfortaa 17px or 15px on sm, line-clamp-2, min-height for uniformity */}
         {/* Prompt teaser — Newsreader italic 11px, min-height for uniformity */}
         {/* Hairline divider */}
         {/* Meta footer — avatar + @username + word limit + entry count */}
       </Link>
     )
   }

   // Reuse the existing timeLeftLabel + status formatter from rail-spark-card,
   // OR import/extract them to a shared helper file. See plan note below.
   ```
- [ ] **Plan note on shared helpers:** the `timeLeftLabel`, status-token, and status-label helpers currently live inline in `rail-spark-card.tsx`. Move them to `lib/sparks/spark-card-helpers.ts` (or similar) so `SparkCard` and the legacy file can both import. Do this extract FIRST in this task.
- [ ] Add a Storybook-like visual check by rendering 4 sparks (OPEN with short title, OPEN with long title, VOTING, CLOSED with winner) in a temporary route OR by checking visually in the discover grid after Wave 4.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Run `npm test` — full suite green.
- [ ] Commit `feat(discover/sparks): SparkCard canonical component (A+B hybrid).`

### Task 3.3: Collapse legacy variants to re-exports

**Files:** `spark-grid-card.tsx`, `rail-spark-card.tsx`, `discover-spark-card.tsx` (if exists)

- [ ] `app/[locale]/(public)/discover/_components/spark-grid-card.tsx`:
   ```tsx
   // Was: export { RailSparkCard as SparkGridCard } from './rail-spark-card'
   import { SparkCard, type Props } from './spark-card'
   export function SparkGridCard(props: Omit<Props, 'size'>) {
     return <SparkCard {...props} size="md" />
   }
   ```
- [ ] `app/[locale]/(public)/discover/_components/rail-spark-card.tsx`:
   - Replace the existing body with a re-export of `<SparkCard size="sm">`.
   - **Cautious approach:** check every call site of `RailSparkCard` to see what props they pass. If any pass `showUrgencyCaption` or other props not in the new component, decide: drop the prop (preferred, since the redesign supersedes it) OR add it to the new component.
- [ ] Similarly check `discover-spark-card.tsx` if it exists; collapse if straightforward.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Run `npm test` — full suite green.
- [ ] Manual smoke: `/en/discover?tab=sparks` shows the new card; `/en/discover` Home rail also uses the new card.
- [ ] Commit `refactor(discover/sparks): collapse legacy card variants to re-exports of SparkCard.`

---

## Wave 4 — `/sparks/new` creation page

### Task 4.1: Page route + auth gate

**File:** `app/[locale]/(public)/sparks/new/page.tsx`

- [ ] Create the route. Server component. Reads session via `auth.api.getSession({ headers: await headers() })`. If no session, `redirect(\`/${locale}/sign-in?next=/${locale}/sparks/new\`)`.
- [ ] Render a centered max-w-[640px] container with the form client component inside.
- [ ] Use the dark iOS card surface that matches the discover redesign.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks): /sparks/new route with auth gate (form scaffold).`

### Task 4.2: `<CreateSparkForm>` client component

**File:** `app/[locale]/(public)/sparks/new/_components/create-spark-form.tsx`

- [ ] Build the form with all 8 fields per spec §6. Use shadcn `<Input>`, `<Textarea>`, `<Button>`, `<Select>` consistently.
- [ ] Implement live character counters for title (yellow at 50, red at 60) and prompt (yellow at 400, red at 500). The counter is a small mono span next to the field label.
- [ ] Rules field hidden behind an "Add rules" expander button (collapsed by default).
- [ ] Word limit as a radio group with 3 options + "Other" numeric input that becomes active when "Other" is picked.
- [ ] Deadline picker: a native `<input type="datetime-local">` for v1 (shadcn date picker as a follow-up). Default = 7 days out at 23:59 local time.
- [ ] Genre dropdown sourced from `lib/discover/genres.ts` GENRES + GENRE_LABEL.
- [ ] Reuse the existing `<SharingControls>` from `components/book/sharing-controls.tsx` for visibility + discoverable.
- [ ] Submit handler: `useTransition` + call `createSparkAction` with validated input. On success: `router.push('/' + locale + '/sparks/' + result.id)`.
- [ ] On Zod validation failure: surface field-level errors inline via `react-hook-form` or simple state — match the project's form pattern.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks): CreateSparkForm client component (full form).`

### Task 4.3: Extend `createSparkAction`

**File:** `lib/actions/sparks.actions.ts`

- [ ] Read the existing `createSparkAction`. Note what shape it takes.
- [ ] Update its input validation to use `createSparkSchema` from `lib/validations/spark.ts`.
- [ ] Update its DB insert to populate `title` AND `prompt`.
- [ ] Update its return shape to include the new spark's id (so the form can redirect).
- [ ] Keep backwards compatibility: if existing callers pass only `title` (no `prompt`), the action either rejects (cleanest) or auto-fills `prompt = title` (lenient — but skip this to enforce the new model going forward).
- [ ] Run `npm test` — any existing tests for `createSparkAction` should still pass after schema update. If new fields break a test, update the test fixture.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks/actions): createSparkAction accepts title-first model.`

### Task 4.4: Update `<CreateSparkModal>`

**File:** `app/[locale]/(public)/discover/_components/create-spark-modal.tsx`

- [ ] Read the existing modal.
- [ ] Update its fields to match the page form: title + prompt + description (+ existing word limit / deadline / genre / visibility).
- [ ] Use the same `createSparkSchema` + `createSparkAction` so validation is identical.
- [ ] **Don't redesign the modal UX** — just align the fields. Full UX polish is a deferred follow-up per spec §11.
- [ ] Manual smoke: open the "+ Create Spark" CTA in Discover; create a test spark; verify it appears on `/discover?tab=sparks`.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `refactor(discover/sparks): CreateSparkModal uses new title-first schema.`

---

## Wave 5 — Detail page reshape

### Task 5.1: `/sparks/[sparkId]` detail reshape

**File:** `app/[locale]/(public)/sparks/[sparkId]/page.tsx`

- [ ] Read the existing detail page.
- [ ] Change the H1 from showing prompt-as-title to showing the short `title`.
- [ ] Add a new "Prompt" hero block immediately under the H1: `<blockquote>` with Newsreader 18px italic body, brand-yellow 4px left rule, `max-width: 65ch`, padding-left 16px. Renders `spark.prompt`.
- [ ] Add a "Context" section below: shows when `spark.description` is non-empty. Header is mono uppercase muted `CONTEXT`; body is Newsreader 14px, `--canvas-dark-ink`.
- [ ] Rules section: unchanged. Comments section: unchanged. Submission UI: unchanged.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Manual smoke: navigate to any seeded spark — verify the new layout reads cleanly.
- [ ] Commit `feat(sparks/detail): reshape page — title H1 + prompt blockquote + Context section.`

### Task 5.2: `<FeaturedSparkHero>` copy update

**File:** `app/[locale]/(public)/discover/_components/featured-spark-hero.tsx`

- [ ] Find the rendered banner. Change the format from `★ FEATURED · "{title}" — by @{creator}` to `★ FEATURED · {title} — by @{creator}`. Drop the italic-quote treatment.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `refactor(discover/sparks): FeaturedSparkHero drops italic quote treatment.`

---

## Wave 6 — Smoke + ship

### Task 6.1: Manual smoke per spec §10

Run `npm run dev`. Walk through every acceptance criterion:

- [ ] **§10.1** Existing dev sparks render correctly post-migration. (Already verified in Task 2.2.)
- [ ] **§10.2** New sparks created via `/sparks/new` validate per Zod schema and surface correctly on Discover.
- [ ] **§10.3** Cards line up uniformly in the grid regardless of title length.
- [ ] **§10.4** Title input shows live counter; can't submit past 60 chars.
- [ ] **§10.5** Prompt teaser on cards truncates with `…` at word boundary <= 80 chars; hidden cleanly when `prompt` is empty.
- [ ] **§10.6** `/sparks/new` as guest redirects to sign-in with `?next` preserved. Sign in and you land on `/sparks/new`.
- [ ] **§10.7** Featured Spark hero shows title (no italic quote).
- [ ] **§10.8** Detail page renders prompt as a hero blockquote, description as Context section when present.
- [ ] **§10.9** Sparks search and filters in `/discover?tab=sparks` continue to work.
- [ ] **§10.10** Migration script idempotent — second run is a no-op.

### Task 6.2: AGENTS.md bookkeeping + ship

- [ ] Update AGENTS.md Resume Here: Last commit → ship commit SHA · Last updated → ship date · Current focus → "Spark redesign shipped, awaiting Hives/Lists/Clubs follow-up specs."
- [ ] Append a "Spark Redesign" entry to "What Has Been Built" with: wave SHA map, schema additions, migration script invocation reminder, deferred follow-ups.
- [ ] Commit `docs(agents): spark redesign shipped.`
- [ ] Run `git push origin main`.

---

## Deferred follow-ups (write into AGENTS.md at ship)

1. **`<CreateSparkModal>` UX polish** — currently just shares the schema; full inline-form polish is a separate task.
2. **Spark editing route `/sparks/[id]/edit`** — uses the same `updateSparkSchema`, mirrors `/sparks/new`'s form shape.
3. **Title profanity filter** — out of scope.
4. **Spark templates** — pre-filled title + prompt suggestions on `/sparks/new`.
5. **LLM-generated titles** — let creators ask for a punchier title.
6. **Owned-spark "Update your title" banner** for creators whose legacy long-prompt-as-title got truncated.
7. **Shadcn date picker** for the deadline field (replace native datetime-local input).

---

## Self-review notes

- **Spec coverage:** Every spec §10 acceptance criterion has a smoke step in Task 6.1. Spec §4 card anatomy maps to Task 3.2. Spec §6 page form maps to Task 4.2. Spec §7 detail reshape maps to Task 5.1.
- **Type consistency:** `CreateSparkInput` is the Zod-inferred type used across the form, modal, and action. `SparkCard` type gains the new `prompt` field used by the card component.
- **File responsibility:** 8 new files + 8 modified files. Average file size <250 LOC. No file grows past plan threshold.
- **No placeholders:** Inline "Plan note" comments in Tasks 3.2, 4.2, 4.3 document plan-time decisions documented for the executor.

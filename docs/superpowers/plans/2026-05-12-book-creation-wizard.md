# Book Creation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-step book creation wizard modal that collects all publisher + discovery metadata and routes the user directly to the book editor on success.

**Architecture:** A shadcn `<Dialog>` wraps a `CreateBookWizard` client component that manages step state and a single form-state object. Each step is a focused child component. On submit, the extended `createBookAction` writes to both `books` and `book_publishing_metadata` in one transaction.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Drizzle ORM 0.45 / drizzle-kit 0.31, shadcn/ui Dialog, `useCloudinaryUpload` hook, `useRouter` (next/navigation)

---

## File Map

| Action | Path |
|---|---|
| Modify | `db/schema/books.ts` |
| Modify | `lib/validations/book.ts` |
| Modify | `lib/actions/book.actions.ts` |
| Modify | `__tests__/validations/book.test.ts` |
| Modify | `app/[locale]/(app)/studio/page.tsx` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/genre-data.ts` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/tags-data.ts` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-progress.tsx` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/step-one.tsx` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/step-two.tsx` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/step-three.tsx` |
| Create | `app/[locale]/(app)/studio/_components/create-book-wizard/index.tsx` |
| Create | `app/[locale]/(app)/studio/_components/create-book-modal.tsx` |

---

## Task 1: DB Schema — add discovery columns to books table

**Files:**
- Modify: `db/schema/books.ts`

- [ ] **Step 1: Add new columns to the books table definition**

Replace the `books` table definition in `db/schema/books.ts`. Add the eight new columns after `synopsis`:

```ts
import { pgTable, text, boolean, timestamp, integer, jsonb, pgEnum, index, AnyPgColumn } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { users } from './auth'

export const bookVisibilityEnum = pgEnum('book_visibility', ['PRIVATE', 'PUBLIC'])
export const bookStatusEnum = pgEnum('book_status', ['DRAFT', 'PUBLISHED'])
export const chapterStatusEnum = pgEnum('chapter_status', ['IDEA', 'OUTLINE', 'FIRST_DRAFT', 'REVISED', 'FINAL'])
export const binderItemTypeEnum = pgEnum('binder_item_type', [
  'part', 'chapter', 'front_matter', 'back_matter',
  'research_folder', 'research_note', 'character', 'outline',
])

export const books = pgTable('books', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  genre: text('genre'),
  visibility: bookVisibilityEnum('visibility').default('PRIVATE').notNull(),
  status: bookStatusEnum('status').default('DRAFT').notNull(),
  coverUrl: text('cover_url'),
  explorable: boolean('explorable').default(false).notNull(),
  synopsis: text('synopsis'),
  // Discovery fields (added for book creation wizard)
  subgenre: text('subgenre'),
  tags: text('tags').array(),
  targetAudience: text('target_audience'),
  language: text('language'),
  contentWarnings: text('content_warnings').array(),
  compTitles: text('comp_titles').array(),
  seriesName: text('series_name'),
  seriesNumber: integer('series_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('books_user_id_idx').on(t.userId)])
```

Leave all other table definitions (bookPublishingMetadata, binderItems, chapters, chapterSnapshots) and all relations unchanged.

- [ ] **Step 2: Generate the migration**

```bash
npx drizzle-kit generate
```

Expected: a new `.sql` file in `./drizzle/` containing `ALTER TABLE "books" ADD COLUMN` statements for the 8 new columns.

- [ ] **Step 3: Apply the migration**

```bash
npx drizzle-kit migrate
```

Expected: `Migrations applied` (or similar success message). Requires `DATABASE_URL` in environment.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add db/schema/books.ts drizzle/
git commit -m "feat: add discovery columns to books table (subgenre, tags, audience, language, etc)"
```

---

## Task 2: Extend Zod validation schema + update tests

**Files:**
- Modify: `lib/validations/book.ts`
- Modify: `__tests__/validations/book.test.ts`

- [ ] **Step 1: Replace `createBookSchema` with the extended version**

In `lib/validations/book.ts`, replace the existing `createBookSchema` (first 7 lines) with:

```ts
export const createBookSchema = z.object({
  // Step 1
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  subtitle: z.string().max(200).optional(),
  synopsis: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional().nullable(),
  // Step 2
  genre: z.string().max(50).optional(),
  subgenre: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  targetAudience: z.string().max(50).optional(),
  contentWarnings: z.array(z.string().max(100)).optional(),
  compTitles: z.array(z.string().max(200)).max(5).optional(),
  language: z.string().max(50).optional(),
  // Step 3
  templateId: z.string().optional(),
  seriesName: z.string().max(200).optional(),
  seriesNumber: z.number().int().min(1).max(9999).optional(),
  publisherName: z.string().max(200).optional(),
  trimSize: z.string().max(20).optional(),
  edition: z.string().max(100).optional(),
})
```

Leave all other schemas in the file unchanged.

- [ ] **Step 2: Add new test cases to `__tests__/validations/book.test.ts`**

Append to the `describe('createBookSchema', ...)` block (after the existing 4 tests):

```ts
  it('accepts all optional fields', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      genre: 'Fantasy',
      subgenre: 'Epic Fantasy',
      tags: ['Found Family', 'Slow Burn'],
      targetAudience: 'Adult',
      contentWarnings: ['Violence'],
      compTitles: ['A Name of the Wind', 'The Way of Kings'],
      language: 'English',
      templateId: 'some-id',
      seriesName: 'The Stormlight Archive',
      seriesNumber: 1,
      publisherName: 'Tor Books',
      trimSize: '6x9',
      edition: 'First Edition',
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 10 tags', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 5 comp titles', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      compTitles: ['A', 'B', 'C', 'D', 'E', 'F'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects seriesNumber below 1', () => {
    const result = createBookSchema.safeParse({
      title: 'My Novel',
      seriesNumber: 0,
    })
    expect(result.success).toBe(false)
  })
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass (45 + 4 new = 49 passing).

- [ ] **Step 4: Commit**

```bash
git add lib/validations/book.ts __tests__/validations/book.test.ts
git commit -m "feat: extend createBookSchema with discovery + publishing wizard fields"
```

---

## Task 3: Extend createBookAction

**Files:**
- Modify: `lib/actions/book.actions.ts`

- [ ] **Step 1: Update imports to include bookPublishingMetadata**

At the top of `lib/actions/book.actions.ts`, change the schema import line from:

```ts
import {
  books, binderItems, chapters, bookTemplates,
} from '@/db/schema'
```

to:

```ts
import {
  books, binderItems, chapters, bookTemplates, bookPublishingMetadata,
} from '@/db/schema'
```

- [ ] **Step 2: Replace the createBookAction function**

Replace the entire `createBookAction` function (lines 51–160) with the following. The template-seeding logic inside the transaction is preserved exactly; only the function signature, insert values, and the new publishing metadata upsert are changed:

```ts
export async function createBookAction(input: {
  title: string
  subtitle?: string
  synopsis?: string
  coverUrl?: string | null
  genre?: string
  subgenre?: string
  tags?: string[]
  targetAudience?: string
  contentWarnings?: string[]
  compTitles?: string[]
  language?: string
  templateId?: string
  seriesName?: string
  seriesNumber?: number
  publisherName?: string
  trimSize?: string
  edition?: string
}): Promise<ActionResult<{ bookId: string }>> {
  const userId = await requireAuth()

  const parsed = createBookSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    const currentCount = await getActiveBookCount(userId)
    if (currentCount >= FREE_BOOK_LIMIT) {
      return { success: false, error: 'FREE_LIMIT_REACHED' }
    }
  }

  const bookId = createId()
  const d = parsed.data

  await db.transaction(async (tx) => {
    await tx.insert(books).values({
      id: bookId,
      userId,
      title: d.title,
      genre: d.genre ?? null,
      coverUrl: d.coverUrl ?? null,
      synopsis: d.synopsis ?? null,
      subgenre: d.subgenre ?? null,
      tags: d.tags ?? null,
      targetAudience: d.targetAudience ?? null,
      language: d.language ?? null,
      contentWarnings: d.contentWarnings ?? null,
      compTitles: d.compTitles ?? null,
      seriesName: d.seriesName ?? null,
      seriesNumber: d.seriesNumber ?? null,
    })

    // Upsert publishing metadata if any Step 3 publishing fields were provided
    const hasMeta = d.subtitle || d.publisherName || d.trimSize || d.edition
    if (hasMeta) {
      await tx.insert(bookPublishingMetadata).values({
        bookId,
        subtitle: d.subtitle ?? null,
        publisherName: d.publisherName ?? null,
        trimSize: d.trimSize ?? '6x9',
        edition: d.edition ?? 'First Edition',
        isbn: null,
        authorBio: null,
        dedication: null,
      }).onConflictDoUpdate({
        target: bookPublishingMetadata.bookId,
        set: {
          subtitle: d.subtitle ?? null,
          publisherName: d.publisherName ?? null,
          trimSize: d.trimSize ?? '6x9',
          edition: d.edition ?? 'First Edition',
          updatedAt: new Date(),
        },
      })
    }

    if (d.templateId) {
      const [template] = await tx
        .select()
        .from(bookTemplates)
        .where(eq(bookTemplates.id, d.templateId))

      if (template?.structure) {
        const structure = template.structure as {
          parts?: Array<{ title: string; chapterCount: number }>
          researchFolders?: string[]
        }

        let globalOrder = 0

        for (const part of structure.parts ?? []) {
          const partId = createId()
          await tx.insert(binderItems).values({
            id: partId,
            bookId,
            type: 'part',
            title: part.title,
            order: globalOrder++,
          })

          for (let i = 0; i < (part.chapterCount ?? 1); i++) {
            const chapterBinderId = createId()
            const chapterId = createId()

            await tx.insert(binderItems).values({
              id: chapterBinderId,
              bookId,
              parentId: partId,
              type: 'chapter',
              title: `Chapter ${i + 1}`,
              order: i,
            })

            await tx.insert(chapters).values({
              id: chapterId,
              bookId,
              binderItemId: chapterBinderId,
            })
          }
        }

        for (const folderName of structure.researchFolders ?? []) {
          await tx.insert(binderItems).values({
            bookId,
            type: 'research_folder',
            title: folderName,
            order: globalOrder++,
          })
        }
      }
    } else {
      const chapterBinderId = createId()
      const chapterId = createId()

      await tx.insert(binderItems).values({
        id: chapterBinderId,
        bookId,
        type: 'chapter',
        title: 'Chapter 1',
        order: 0,
      })

      await tx.insert(chapters).values({
        id: chapterId,
        bookId,
        binderItemId: chapterBinderId,
      })
    }
  })

  return { success: true, data: { bookId } }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/book.actions.ts
git commit -m "feat: extend createBookAction with discovery + publishing metadata fields"
```

---

## Task 4: Data constants

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/genre-data.ts`
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/tags-data.ts`

- [ ] **Step 1: Create genre-data.ts**

Create `app/[locale]/(app)/studio/_components/create-book-wizard/genre-data.ts`:

```ts
export const GENRES: Record<string, string[]> = {
  'Fantasy': ['Epic Fantasy', 'Urban Fantasy', 'Dark Fantasy', 'High Fantasy', 'LitRPG', 'Portal Fantasy'],
  'Science Fiction': ['Space Opera', 'Hard SF', 'Cyberpunk', 'Solarpunk', 'Military SF', 'Biopunk'],
  'Thriller': ['Psychological', 'Legal', 'Medical', 'Political', 'Techno-Thriller', 'Spy'],
  'Mystery': ['Cozy Mystery', 'Hard-Boiled', 'Police Procedural', 'Amateur Sleuth', 'Noir'],
  'Romance': ['Contemporary', 'Historical', 'Paranormal', 'Romantic Suspense', 'Fantasy Romance'],
  'Horror': ['Psychological', 'Supernatural', 'Gothic', 'Body Horror', 'Cosmic Horror'],
  'Historical Fiction': ['Ancient World', 'Medieval', 'Victorian', 'WWI/WWII', 'American West'],
  'Literary Fiction': ['Contemporary', 'Experimental', 'Satire', 'Southern Gothic'],
  'Non-fiction': ['Business', 'History', 'Science', 'True Crime', 'Essay Collection', 'Travel'],
  'Memoir': ['Personal Essay', 'Celebrity', 'Trauma & Recovery', 'Coming-of-Age'],
  "Children's": ['Picture Book', 'Early Reader', 'Chapter Book'],
  'Graphic Novel / Comics': ['Superhero', 'Slice of Life', 'Fantasy', 'Horror', 'Memoir'],
}

export const GENRE_NAMES = Object.keys(GENRES)

export const CONTENT_WARNINGS = [
  'Violence', 'Sexual Content', 'Strong Language', 'Substance Abuse',
  'Mental Health', 'Death & Grief', 'Abuse', 'War & Conflict', 'Animal Harm',
]

export const TRIM_SIZES = ['5×8', '6×9', '7×10', '8.5×11', 'A4', 'A5']

export const TARGET_AUDIENCES = ['Adult', 'YA', 'MG', "Children's"]
```

- [ ] **Step 2: Create tags-data.ts**

Create `app/[locale]/(app)/studio/_components/create-book-wizard/tags-data.ts`:

```ts
export const PREDEFINED_TAGS: string[] = [
  // Tropes
  'Enemies to Lovers', 'Found Family', 'Chosen One', 'Redemption Arc',
  'Slow Burn', 'Second Chance', 'Fake Dating', 'Forbidden Love',
  // Mood
  'Dark', 'Cozy', 'Action-packed', 'Atmospheric', 'Humorous', 'Heartwarming',
  // Setting
  'Contemporary', 'Historical', 'Dystopian', 'Post-apocalyptic',
  'Small Town', 'Big City', 'Secondary World', 'Space',
  // POV / Structure
  'First Person', 'Multiple POV', 'Dual Timeline', 'Unreliable Narrator',
]
```

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add genre, tags, and content warning data constants for book wizard"
```

---

## Task 5: WizardProgress component

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/wizard-progress.tsx`

- [ ] **Step 1: Create the component**

```tsx
type Props = { step: 1 | 2 | 3 }

const LABELS = ['The Basics', 'Discovery', 'Structure']

export function WizardProgress({ step }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-3">
        {([1, 2, 3] as const).map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-10 h-px ${step > n - 1 ? 'bg-brand/60' : 'bg-border'}`} />}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-comfortaa transition-colors
              ${step === n ? 'bg-brand text-[#0a0a0a]' : step > n ? 'bg-brand/30 border border-brand/50 text-brand' : 'bg-transparent border border-border text-white/30'}`}>
              {step > n ? (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              ) : n}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <span className="text-[11px] text-white/40 font-medium uppercase tracking-wider">
          Step {step} of 3 — {LABELS[step - 1]}
        </span>
      </div>
      <div className="mt-3 h-0.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add WizardProgress step indicator component"
```

---

## Task 6: Step One component

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/step-one.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useRef, useState } from 'react'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'

const field = 'w-full bg-[#1c1c1c] border border-border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all'
const label = 'block text-[12px] font-medium text-white/60 mb-1.5'

type Props = {
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  onUpdate: (fields: Partial<{ title: string; subtitle: string; synopsis: string; coverUrl: string | null }>) => void
  onNext: () => void
  onCancel: () => void
  titleError: string | null
}

const cloudinaryConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

export function StepOne({ title, subtitle, synopsis, coverUrl, onUpdate, onNext, onCancel, titleError }: Props) {
  const { upload, uploading } = useCloudinaryUpload('covers')
  const [preview, setPreview] = useState<string | null>(coverUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    if (cloudinaryConfigured) {
      const result = await upload(file)
      if (result) onUpdate({ coverUrl: result.url })
    }
  }

  return (
    <div>
      <div className="space-y-4">
        <div>
          <label className={label}>Title <span className="text-brand">*</span></label>
          <input
            type="text"
            placeholder="Give your book a title"
            value={title}
            onChange={e => onUpdate({ title: e.target.value })}
            className={`${field} ${titleError ? 'border-red-400/50 focus:border-red-400/50' : ''}`}
            autoFocus
          />
          {titleError && <p className="text-[12px] text-red-400 mt-1">{titleError}</p>}
        </div>

        <div>
          <label className={label}>Subtitle <span className="text-white/30 font-normal">optional</span></label>
          <input
            type="text"
            placeholder="A subtitle or tagline"
            value={subtitle}
            onChange={e => onUpdate({ subtitle: e.target.value })}
            className={field}
          />
        </div>

        <div>
          <label className={label}>Synopsis <span className="text-white/30 font-normal">optional</span></label>
          <textarea
            placeholder="Back-cover blurb or a brief summary…"
            value={synopsis}
            onChange={e => onUpdate({ synopsis: e.target.value })}
            rows={4}
            maxLength={2000}
            className={`${field} resize-none`}
          />
          <p className="text-[11px] text-white/25 mt-1 text-right">{synopsis.length}/2000</p>
        </div>

        <div>
          <label className={label}>Cover image <span className="text-white/30 font-normal">optional</span></label>
          <div
            onClick={() => cloudinaryConfigured && fileRef.current?.click()}
            className={`relative border border-dashed border-border rounded-xl overflow-hidden flex items-center justify-center
              ${cloudinaryConfigured ? 'cursor-pointer hover:border-brand/40 transition-colors' : 'opacity-40 cursor-not-allowed'}
              ${preview ? 'h-40' : 'h-28'}`}
          >
            {preview ? (
              <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <p className="text-[13px] text-white/40">
                  {cloudinaryConfigured ? (uploading ? 'Uploading…' : 'Click to upload cover') : 'Cover upload unavailable in this environment'}
                </p>
                {cloudinaryConfigured && <p className="text-[11px] text-white/25 mt-1">Portrait ratio recommended · PNG or JPG</p>}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {preview && cloudinaryConfigured && (
            <button
              type="button"
              onClick={() => { setPreview(null); onUpdate({ coverUrl: null }) }}
              className="text-[11px] text-white/35 hover:text-white/60 mt-1 transition-colors"
            >
              Remove cover
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button type="button" onClick={onCancel} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">Cancel</button>
        <button
          type="button"
          onClick={() => { if (!title.trim()) return; onNext() }}
          disabled={!title.trim()}
          className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-hover hover:-translate-y-px transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add StepOne component (title, subtitle, synopsis, cover upload)"
```

---

## Task 7: Step Two component

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/step-two.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useRef } from 'react'
import { GENRES, GENRE_NAMES, CONTENT_WARNINGS, TARGET_AUDIENCES } from './genre-data'
import { PREDEFINED_TAGS } from './tags-data'

const field = 'w-full bg-[#1c1c1c] border border-border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all'
const label = 'block text-[12px] font-medium text-white/60 mb-1.5'
const selectClass = `${field} appearance-none cursor-pointer`

type Step2Data = {
  genre: string
  subgenre: string
  tags: string[]
  targetAudience: string
  contentWarnings: string[]
  compTitles: string[]
  language: string
}

type Props = Step2Data & {
  onUpdate: (fields: Partial<Step2Data>) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Japanese', 'Korean', 'Chinese', 'Other']

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[12px] border transition-colors
        ${active
          ? 'bg-brand/15 border-brand/40 text-brand'
          : 'bg-[#1c1c1c] border-border text-white/50 hover:border-white/20 hover:text-white/70'
        }`}
    >
      {label}
    </button>
  )
}

export function StepTwo({ genre, subgenre, tags, targetAudience, contentWarnings, compTitles, language, onUpdate, onNext, onBack, onSkip }: Props) {
  const [tagInput, setTagInput] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  const subgenres = genre ? (GENRES[genre] ?? []) : []

  function addCustomTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= 10) return
    onUpdate({ tags: [...tags, trimmed] })
    setTagInput('')
  }

  function handleCompTitle(index: number, value: string) {
    const next = [...compTitles]
    next[index] = value
    onUpdate({ compTitles: next })
  }

  function addCompTitle() {
    if (compTitles.length < 5) onUpdate({ compTitles: [...compTitles, ''] })
  }

  function removeCompTitle(index: number) {
    onUpdate({ compTitles: compTitles.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-5">
      {/* Genre + Subgenre */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Genre</label>
          <select
            value={genre}
            onChange={e => { onUpdate({ genre: e.target.value, subgenre: '' }) }}
            className={selectClass}
          >
            <option value="">Select genre…</option>
            {GENRE_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Subgenre</label>
          <select
            value={subgenre}
            onChange={e => onUpdate({ subgenre: e.target.value })}
            disabled={!genre || subgenres.length === 0}
            className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <option value="">Select subgenre…</option>
            {subgenres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Target Audience */}
      <div>
        <label className={label}>Target audience</label>
        <div className="flex flex-wrap gap-2">
          {TARGET_AUDIENCES.map(a => (
            <Chip
              key={a}
              label={a}
              active={targetAudience === a}
              onClick={() => onUpdate({ targetAudience: targetAudience === a ? '' : a })}
            />
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className={label}>Tags <span className="text-white/30 font-normal">({tags.length}/10)</span></label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PREDEFINED_TAGS.map(t => (
            <Chip
              key={t}
              label={t}
              active={tags.includes(t)}
              onClick={() => tags.length < 10 || tags.includes(t) ? onUpdate({ tags: toggleItem(tags, t) }) : undefined}
            />
          ))}
        </div>
        {/* Selected custom tags */}
        {tags.filter(t => !PREDEFINED_TAGS.includes(t)).map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] bg-brand/15 border border-brand/40 text-brand mr-1.5 mb-1.5">
            {t}
            <button type="button" onClick={() => onUpdate({ tags: tags.filter(x => x !== t) })} className="text-brand/60 hover:text-brand ml-0.5">×</button>
          </span>
        ))}
        {tags.length < 10 && (
          <div className="flex gap-2 mt-2">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCustomTag(tagInput) } }}
              placeholder="Add custom tag…"
              className="flex-1 bg-[#1c1c1c] border border-border rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/40 transition-all"
            />
            <button type="button" onClick={() => addCustomTag(tagInput)} className="text-[12px] text-brand border border-brand/30 rounded-lg px-3 py-2 hover:bg-brand/10 transition-colors">Add</button>
          </div>
        )}
      </div>

      {/* Content Warnings */}
      <div>
        <label className={label}>Content warnings</label>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_WARNINGS.map(w => (
            <Chip
              key={w}
              label={w}
              active={contentWarnings.includes(w)}
              onClick={() => onUpdate({ contentWarnings: toggleItem(contentWarnings, w) })}
            />
          ))}
        </div>
      </div>

      {/* Comp Titles */}
      <div>
        <label className={label}>Comparable titles <span className="text-white/30 font-normal">optional · up to 5</span></label>
        <div className="space-y-2">
          {compTitles.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder={`Readers who liked…`}
                value={t}
                onChange={e => handleCompTitle(i, e.target.value)}
                className="flex-1 bg-[#1c1c1c] border border-border rounded-xl px-4 py-2.5 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 transition-all"
              />
              {compTitles.length > 1 && (
                <button type="button" onClick={() => removeCompTitle(i)} className="text-white/30 hover:text-white/60 px-2 transition-colors text-[18px] leading-none">×</button>
              )}
            </div>
          ))}
          {compTitles.length < 5 && compTitles[compTitles.length - 1] !== '' && (
            <button type="button" onClick={addCompTitle} className="text-[12px] text-brand/70 hover:text-brand transition-colors">+ Add another title</button>
          )}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className={label}>Language</label>
        <select value={language} onChange={e => onUpdate({ language: e.target.value })} className={selectClass}>
          <option value="">Select language…</option>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSkip} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">Skip</button>
          <button
            type="button"
            onClick={onNext}
            className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] hover:bg-brand-hover hover:-translate-y-px transition-all"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add StepTwo component (genre, tags, audience, warnings, comp titles, language)"
```

---

## Task 8: Step Three component

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/step-three.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { TRIM_SIZES } from './genre-data'

const field = 'w-full bg-[#1c1c1c] border border-border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all'
const label = 'block text-[12px] font-medium text-white/60 mb-1.5'
const selectClass = `${field} appearance-none cursor-pointer`

export type BookTemplate = {
  id: string
  name: string
  genre: string | null
}

type Step3Data = {
  templateId: string
  isSeriesBook: boolean
  seriesName: string
  seriesNumber: string
  publisherName: string
  trimSize: string
  edition: string
}

type Props = Step3Data & {
  templates: BookTemplate[]
  onUpdate: (fields: Partial<Step3Data>) => void
  onBack: () => void
  onSkip: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}

export function StepThree({ templateId, isSeriesBook, seriesName, seriesNumber, publisherName, trimSize, edition, templates, onUpdate, onBack, onSkip, onSubmit, submitting, error }: Props) {
  return (
    <div className="space-y-5">
      {/* Template selector */}
      <div>
        <label className={label}>Template</label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onUpdate({ templateId: templateId === t.id ? '' : t.id })}
              className={`text-left p-3 rounded-xl border transition-colors
                ${templateId === t.id
                  ? 'border-brand/50 bg-brand/10 text-white'
                  : 'border-border bg-[#1c1c1c] text-white/60 hover:border-white/20 hover:text-white/80'
                }`}
            >
              <div className="text-[13px] font-medium">{t.name}</div>
              {t.genre && <div className="text-[11px] text-white/35 mt-0.5">{t.genre}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Series */}
      <div>
        <label className={label}>Series</label>
        <div className="flex gap-2 mb-3">
          {(['Standalone', 'Series'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onUpdate({ isSeriesBook: opt === 'Series' })}
              className={`flex-1 py-2.5 rounded-xl border text-[13px] font-medium transition-colors
                ${(opt === 'Series') === isSeriesBook
                  ? 'border-brand/50 bg-brand/10 text-brand'
                  : 'border-border bg-[#1c1c1c] text-white/50 hover:border-white/20'
                }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {isSeriesBook && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label}>Series name</label>
              <input
                type="text"
                placeholder="e.g. The Stormlight Archive"
                value={seriesName}
                onChange={e => onUpdate({ seriesName: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Book #</label>
              <input
                type="number"
                min={1}
                max={9999}
                placeholder="1"
                value={seriesNumber}
                onChange={e => onUpdate({ seriesNumber: e.target.value })}
                className={field}
              />
            </div>
          </div>
        )}
      </div>

      {/* Publisher info */}
      <div>
        <div className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">Publisher info — optional</div>
        <div className="space-y-3">
          <div>
            <label className={label}>Publisher name</label>
            <input
              type="text"
              placeholder="e.g. Tor Books"
              value={publisherName}
              onChange={e => onUpdate({ publisherName: e.target.value })}
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Trim size</label>
              <select value={trimSize} onChange={e => onUpdate({ trimSize: e.target.value })} className={selectClass}>
                <option value="">Select…</option>
                {TRIM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Edition</label>
              <input
                type="text"
                placeholder="First Edition"
                value={edition}
                onChange={e => onUpdate({ edition: e.target.value })}
                className={field}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error === 'FREE_LIMIT_REACHED'
            ? 'You've reached the free plan limit of 3 books. Upgrade to create more.'
            : error}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSkip} disabled={submitting} className="text-[13px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40">Skip</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-hover hover:-translate-y-px transition-all"
          >
            {submitting ? 'Creating…' : 'Create Book'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add StepThree component (template, series, publisher fields)"
```

---

## Task 9: CreateBookWizard shell

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-wizard/index.tsx`

- [ ] **Step 1: Create the wizard shell**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBookAction } from '@/lib/actions/book.actions'
import { WizardProgress } from './wizard-progress'
import { StepOne } from './step-one'
import { StepTwo } from './step-two'
import { StepThree, type BookTemplate } from './step-three'

type Step = 1 | 2 | 3

type FormData = {
  // Step 1
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  // Step 2
  genre: string
  subgenre: string
  tags: string[]
  targetAudience: string
  contentWarnings: string[]
  compTitles: string[]
  language: string
  // Step 3
  templateId: string
  isSeriesBook: boolean
  seriesName: string
  seriesNumber: string
  publisherName: string
  trimSize: string
  edition: string
}

const initial: FormData = {
  title: '', subtitle: '', synopsis: '', coverUrl: null,
  genre: '', subgenre: '', tags: [], targetAudience: '',
  contentWarnings: [], compTitles: [''], language: 'English',
  templateId: '', isSeriesBook: false, seriesName: '',
  seriesNumber: '', publisherName: '', trimSize: '', edition: '',
}

type Props = {
  locale: string
  templates: BookTemplate[]
  onClose: () => void
}

export function CreateBookWizard({ locale, templates, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>(initial)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(fields: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...fields }))
  }

  function goNext() {
    if (step === 1) {
      if (!form.title.trim()) { setTitleError('Title is required'); return }
      setTitleError(null)
    }
    setStep(s => Math.min(s + 1, 3) as Step)
  }

  function goBack() {
    setStep(s => Math.max(s - 1, 1) as Step)
  }

  async function submit() {
    setSubmitting(true)
    setError(null)

    const result = await createBookAction({
      title: form.title.trim(),
      subtitle: form.subtitle || undefined,
      synopsis: form.synopsis || undefined,
      coverUrl: form.coverUrl,
      genre: form.genre || undefined,
      subgenre: form.subgenre || undefined,
      tags: form.tags.length ? form.tags : undefined,
      targetAudience: form.targetAudience || undefined,
      contentWarnings: form.contentWarnings.length ? form.contentWarnings : undefined,
      compTitles: form.compTitles.filter(Boolean).length ? form.compTitles.filter(Boolean) : undefined,
      language: form.language || undefined,
      templateId: form.templateId || undefined,
      seriesName: form.isSeriesBook && form.seriesName ? form.seriesName : undefined,
      seriesNumber: form.isSeriesBook && form.seriesNumber ? parseInt(form.seriesNumber, 10) : undefined,
      publisherName: form.publisherName || undefined,
      trimSize: form.trimSize || undefined,
      edition: form.edition || undefined,
    })

    if (!result.success) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    router.push(`/${locale}/studio/${result.data.bookId}`)
  }

  return (
    <div className="p-6 sm:p-8">
      <WizardProgress step={step} />

      {step === 1 && (
        <StepOne
          title={form.title}
          subtitle={form.subtitle}
          synopsis={form.synopsis}
          coverUrl={form.coverUrl}
          onUpdate={update}
          onNext={goNext}
          onCancel={onClose}
          titleError={titleError}
        />
      )}

      {step === 2 && (
        <StepTwo
          genre={form.genre}
          subgenre={form.subgenre}
          tags={form.tags}
          targetAudience={form.targetAudience}
          contentWarnings={form.contentWarnings}
          compTitles={form.compTitles}
          language={form.language}
          onUpdate={update}
          onNext={goNext}
          onBack={goBack}
          onSkip={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepThree
          templateId={form.templateId}
          isSeriesBook={form.isSeriesBook}
          seriesName={form.seriesName}
          seriesNumber={form.seriesNumber}
          publisherName={form.publisherName}
          trimSize={form.trimSize}
          edition={form.edition}
          templates={templates}
          onUpdate={update}
          onBack={goBack}
          onSkip={submit}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add CreateBookWizard shell with step state and submit logic"
```

---

## Task 10: CreateBookModal

**Files:**
- Create: `app/[locale]/(app)/studio/_components/create-book-modal.tsx`

- [ ] **Step 1: Check what shadcn Dialog components are available**

```bash
ls app/components/ui/ 2>/dev/null || ls components/ui/ 2>/dev/null || find . -name "dialog.tsx" -not -path "*/node_modules/*"
```

Expected: a `dialog.tsx` file exists (shadcn Dialog). Note the exact import path.

- [ ] **Step 2: Create the modal**

The exact Dialog import path depends on the output from Step 1. Common paths are `@/components/ui/dialog` or `@/app/components/ui/dialog`. Use whichever exists.

```tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CreateBookWizard } from './create-book-wizard'
import type { BookTemplate } from './create-book-wizard/step-three'

type Props = {
  locale: string
  templates: BookTemplate[]
  children: React.ReactNode
}

export function CreateBookModal({ locale, templates, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div onClick={() => setOpen(true)} className="contents">
        {children}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl w-full bg-card border-border p-0 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Create a new book</DialogTitle>
          </DialogHeader>
          <CreateBookWizard
            locale={locale}
            templates={templates}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: add CreateBookModal (Dialog wrapper with trigger)"
```

---

## Task 11: Wire up the studio page

**Files:**
- Modify: `app/[locale]/(app)/studio/page.tsx`

- [ ] **Step 1: Read the current studio page**

Read `app/[locale]/(app)/studio/page.tsx` to understand the existing stub before modifying it.

- [ ] **Step 2: Update the studio page**

Replace the studio page content with a version that fetches templates and wraps the create button in `CreateBookModal`. The visual design (floating SVG illustration, hex pattern backdrop, etc.) is preserved — only the button wiring changes.

Add the following imports at the top:

```ts
import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { CreateBookModal } from './_components/create-book-modal'
```

Fetch templates in the page server component (add before the return):

```ts
const templates = await db
  .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
  .from(bookTemplates)
  .where(eq(bookTemplates.isSystemTemplate, true))
  .orderBy(bookTemplates.name)
```

Also add `eq` to the drizzle import: `import { eq } from 'drizzle-orm'`

Wrap the existing "Create your first book" button JSX with `<CreateBookModal locale={locale} templates={templates}>`:

```tsx
<CreateBookModal locale={locale} templates={templates}>
  <button className="... existing button classes ...">
    Create your first book
  </button>
</CreateBookModal>
```

Pass `locale` from `await params` — it's already available in the existing page.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in the browser**

Start the dev server (`npm run dev`). Navigate to `/en/studio`. Click "Create your first book". Verify:
1. The modal opens with the 3-step wizard
2. Step 1 shows title, subtitle, synopsis, cover fields
3. Next button is disabled when title is empty
4. Filling title and clicking Next advances to Step 2
5. Step 2 shows genre/subgenre dropdowns, chips, etc.
6. Next/Skip advances to Step 3
7. Step 3 shows template cards, series toggle, publisher fields
8. Clicking "Create Book" calls the action and (on success) navigates to `/en/studio/<bookId>`
9. Cancel closes the modal without creating anything

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/studio/page.tsx
git commit -m "feat: wire CreateBookModal into studio page"
```

# Book Creation Wizard — Design Spec
_Date: 2026-05-12_

## Overview

A 3-step modal wizard for creating a new book in Beehive Studio. Collects all metadata a writer or publisher needs at creation time, while keeping each step focused and fast. All steps after Step 1 are skippable.

After successful creation the user lands directly in the book editor.

---

## Database Migration

Add the following columns to the `books` table:

| Column | Type | Notes |
|---|---|---|
| `subgenre` | `text` | Optional |
| `tags` | `text[]` | Multi-value; predefined + freeform |
| `target_audience` | `text` | Enum-like: `Adult`, `YA`, `MG`, `Children` |
| `language` | `text` | Default `'English'` |
| `content_warnings` | `text[]` | Multi-select from predefined list |
| `comp_titles` | `text[]` | Up to 5 comparable titles |
| `series_name` | `text` | Optional |
| `series_number` | `integer` | Optional; only meaningful when `series_name` is set |

No changes to `book_publishing_metadata` — existing columns (`subtitle`, `trimSize`, `publisherName`, `edition`) are collected in Step 3 and written in the same transaction.

Migration generated via `drizzle-kit generate` after updating `db/schema/books.ts`.

---

## Server Action Changes

### `createBookAction` — extended

**Current signature:** `{ title, genre, templateId }`

**New signature:**
```ts
{
  // Step 1
  title: string            // required
  subtitle?: string
  synopsis?: string
  coverUrl?: string

  // Step 2
  genre?: string
  subgenre?: string
  tags?: string[]
  targetAudience?: string
  contentWarnings?: string[]
  compTitles?: string[]
  language?: string

  // Step 3
  templateId?: string
  seriesName?: string
  seriesNumber?: number
  publisherName?: string
  trimSize?: string
  edition?: string
}
```

**Behaviour:**
1. Insert into `books` with all books-table fields.
2. If any publishing metadata fields are non-empty (`subtitle`, `trimSize`, `publisherName`, `edition`), upsert into `book_publishing_metadata` in the same operation.
3. Apply the selected template (create binder items from `bookTemplates.structure`) — this is already done by the current action.
4. Return `{ success: true, data: { bookId } }`.

Free-tier limit check (`FREE_BOOK_LIMIT = 3`) is unchanged.

---

## Component Architecture

```
app/[locale]/(app)/studio/
  page.tsx                              # Studio page — mounts CreateBookModal
  _components/
    create-book-modal.tsx               # <Dialog> wrapper; receives open/setOpen props
    create-book-wizard/
      index.tsx                         # Wizard shell — step state, form state, submit
      step-one.tsx                      # Title, subtitle, synopsis, cover upload
      step-two.tsx                      # Genre, subgenre, tags, audience, warnings, comp titles, language
      step-three.tsx                    # Template selector, series, publisher fields
      wizard-progress.tsx               # Step indicator dots
      genre-data.ts                     # GENRES constant: Record<string, string[]>
      tags-data.ts                      # PREDEFINED_TAGS constant: string[]
```

---

## Step Breakdown

### Step 1 — The Basics

| Field | Component | Required |
|---|---|---|
| Title | Text input | **Yes** |
| Subtitle | Text input | No |
| Synopsis / back-cover blurb | Textarea | No |
| Cover image | Cloudinary upload (portrait drop zone, ~2:3 ratio) | No |

If Cloudinary env vars are absent (local dev), the cover upload field renders in a disabled/greyed state with the note "Cover upload not available in this environment."

### Step 2 — Discovery

| Field | Component | Required |
|---|---|---|
| Genre | Select dropdown (12 top-level genres) | No (step is skippable) |
| Subgenre | Dependent select — populated by genre selection | No |
| Tags | Predefined chip grid + free-entry input (max 10) | No |
| Target audience | 4-option radio chips: Adult · YA · MG · Children's | No |
| Content warnings | Multi-select chips from predefined list | No |
| Comp titles | Up to 5 text inputs ("Readers who liked…") | No |
| Language | Select dropdown (defaults to English) | No |

**Genre taxonomy (top-level):**
Fantasy, Science Fiction, Thriller, Mystery, Romance, Horror, Historical Fiction, Literary Fiction, Non-fiction, Memoir, Children's, Graphic Novel / Comics

Each genre maps to 4–8 subgenres in `genre-data.ts` (e.g. Fantasy → Epic Fantasy, Urban Fantasy, Dark Fantasy, High Fantasy, LitRPG, Portal Fantasy).

**Tags:** predefined pool covers tropes (Enemies to Lovers, Found Family, Chosen One…), mood (Dark, Cozy, Action-packed, Slow burn…), and setting (Contemporary, Historical, Dystopian, Post-apocalyptic…). Writers can also type custom tags.

**Content warnings predefined list:** Violence, Sexual Content, Strong Language, Substance Abuse, Mental Health, Death & Grief, Abuse, War & Conflict, Animal Harm.

### Step 3 — Structure & Publishing

| Field | Component | Required |
|---|---|---|
| Template | Card selector (seeded templates + Blank) | No (defaults to Blank) |
| Series | Toggle: Standalone vs Series. If Series: name + number inputs | No |
| Publisher name | Text input | No |
| Trim size | Select: 5×8 · 6×9 · 8.5×11 · A4 · Custom | No |
| Edition | Text input (default: "First Edition") | No |

**Deferred to Book Settings (not in wizard):** ISBN, Author bio, Dedication.

---

## Wizard UX

### Navigation
- **Back / Next** buttons on each step.
- **Skip** link on Steps 2 and 3 (advances without validating optional fields).
- **Cancel** link closes the modal (no confirmation needed — nothing is saved until final submit).
- **Create Book** button on Step 3 triggers submission.

### Progress indicator (`WizardProgress`)
- Three numbered dots connected by lines.
- Active step: filled brand yellow circle with step number.
- Completed step: filled brand yellow with checkmark icon.
- Upcoming step: muted border circle.
- Progress bar below the dots fills 33% / 66% / 100%.

### Validation
- Step 1: title required. If empty, Next is disabled and an inline error shows on attempt.
- Steps 2–3: no required fields. Next/Skip always available.
- Final submit: disabled while loading.

### Error handling
- Server errors display as a red banner inside the modal above the Create button.
- `FREE_LIMIT_REACHED` shows an upgrade prompt instead of the error banner.

### After creation
`router.push(`/${locale}/studio/${bookId}`)` — navigates directly to the book editor. The modal closes automatically.

---

## Data Constants

### `genre-data.ts`
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
  "Children's": ["Picture Book", "Early Reader", "Chapter Book"],
  'Graphic Novel / Comics': ['Superhero', 'Slice of Life', 'Fantasy', 'Horror', 'Memoir'],
}
```

### `tags-data.ts`
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
  // POV/Structure
  'First Person', 'Multiple POV', 'Dual Timeline', 'Unreliable Narrator',
]
```

---

## Free-Tier Behaviour

No changes. Free users can create up to 3 books. The wizard checks the limit before insertion and returns `FREE_LIMIT_REACHED` if exceeded. The studio page shows an upgrade prompt in that case.

---

## Out of Scope

- ISBN, Author bio, Dedication — live in Book Settings post-creation.
- Cover image cropping/editing — basic upload only.
- Custom user-defined templates — future phase.
- Cloudinary upload in local dev without env vars — degrades gracefully (field disabled).

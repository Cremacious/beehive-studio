<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Beehive Studio — Project Status

**Slogan:** "Get buzzed about writing!"

## 📍 Resume Here

> **Last updated:** 2026-05-22
>
> **Current focus:** SP3 Specialized Editors — Feature D (Research notes UX) — not started
> **Active branch:** `main`
> **Last commit:** feat(studio): route outline binder items to OutlineBoard (closes SP3 Feature C)
>
> **The audit** is a 6-sub-project effort to make the book editor at
> `/[locale]/studio/[bookId]` fully operational.
>
> 1. ~~**SP1 Stability Pass**~~ DONE.
> 2. ~~**SP2 Binder UX**~~ DONE.
> 3. **SP3 Specialized Editors (IN FLIGHT)**:
>    - ~~Feature B: Front/Back Matter~~ DONE (2026-05-22).
>    - ~~Feature C: Outline editor (Kanban)~~ **DONE** (2026-05-22) — user-editable columns, draggable cards w/ title + synopsis, optional chapter linking that navigates to the linked chapter on click. Default 3-column seed (Act 1/2/3). 104/104 tests, tsc clean. Spec + plan: `docs/superpowers/specs/2026-05-22-studio-outline-editor-design.md`, `docs/superpowers/plans/2026-05-22-studio-outline-editor.md`.
>    - **Feature D: Research notes UX (NEXT)** — smallest of the three. Borrows the specialized-binder-editor pattern from B + C. Brainstorm question parked from earlier: B1 simpler-editor / B2 note-app features / B3 plain-text quick-capture.
> 4. **SP4 Toolbar + modes** — spec drafted at `docs/superpowers/specs/2026-05-22-studio-toolbar-modes-design.md`. Also pick up the deferred font-size mark from SP1.
> 5. **SP5 Metadata + persistence** — synopsis/scene-planner/notes/word-goal/status/publishing-details correctness, bottom status-bar consolidation.
> 6. **SP6 New surfaces** — Snapshot UI, mobile/tablet responsive, accessibility audit (aria-labels, contrast, ? keyboard cheatsheet).
>
> After all six: Claude Design redesigns visually, mechanical import. Then Phase 8 (Stripe monetization) resumes.
>
> **Chris's working preferences (confirmed across SP1–SP3 C):**
> - Commits go straight to `main`, no feature branches.
> - Per-task manual verification (don't batch).
> - Subagent-driven execution preserves context window.
>
> **Bug-fix posture:** the global error boundary at `app/[locale]/error.tsx` logs errors with stack + message + digest. Always start with the console error before guessing causes.
>
> **Next concrete step when resuming:** invoke `/brainstorming` for SP3 Feature D (Research notes UX). Pick from B1/B2/B3, then spec → plan → execute.

## ⚙️ Working Agreement (read this every session)

**When you start a session:** read this file top-to-bottom, then `git log -5 --oneline` and `git status` to confirm reality matches the "Resume Here" block above. If they diverge, the file is stale — fix it before doing anything else.

**When you finish meaningful work in a session** (any commit, any phase progress, any decision the user agreed to):
1. Update the "📍 Resume Here" block: bump `Last updated`, refresh `Current focus`, `Last commit`, and `Next concrete step`.
2. If a phase completed, move it from "What's Next" into "What Has Been Built" with the same level of detail as existing phases.
3. If new patterns / file conventions / gotchas emerged, add them under "Key Patterns".
4. Commit the doc update **with** the code change, not as a separate commit.

This file is the handoff contract. If "read AGENTS.md and continue project" doesn't get the next session to the right spot, this file failed.

## What This Is

Beehive Studio is a solo-developer writing platform: rich-text book editor, Hive collaboration groups, and a community discovery feed. Dark-only, bee-themed. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (New York style), Drizzle ORM on Neon Postgres.

## What Has Been Built

### Phase 1 — Foundation ✅ COMPLETE
- Full DB schema: `users`, `userProfiles`, `userBilling`, `books`, `binderItems`, `chapters`, `chapterSnapshots`, `hives`, `hiveMembers`, social tables, `exportPresets`, `bookTemplates`
- Auth: better-auth v1 (email/password + Google OAuth; Apple pre-wired for when creds are ready)
- Middleware: locale routing (next-intl, `localePrefix: 'always'`), auth guard, onboarding gate
- Route groups: `(public)` (landing, legal), `(auth)` (sign-in, sign-up, forgot-password, reset-password, onboarding), `(app)` (studio, discover, community)
- Onboarding actions: `checkUsernameAvailableAction`, `completeOnboardingAction`
- Cloudinary image upload wiring
- Rate limiting: 7 Upstash limiters
- Seed scripts: export presets + book templates

### Phase 2 — Studio Server Layer ✅ COMPLETE
All server actions are done. No UI yet — pages are stubs. Tests: 45/45 passing. TypeScript: clean.

Files created:
- `lib/premium.ts` — `FREE_BOOK_LIMIT=3`, `getUserPremiumStatus()`, `requirePremium()`
- `lib/tiptap-utils.ts` — `extractWordCount()` (pure, unit tested)
- `lib/validations/book.ts` — Zod schemas for all book/binder/chapter/publishing operations
- `lib/actions/_helpers.ts` — shared `assertBookOwner()`
- `lib/actions/book.actions.ts` — `createBookAction`, `getUserBooksAction`, `getBookAction`, `updateBookAction`, `publishBookAction`, `unpublishBookAction`, `deleteBookAction`
- `lib/actions/binder.actions.ts` — `getBinderTreeAction`, `createBinderItemAction`, `updateBinderItemAction`, `deleteBinderItemAction`, `reorderBinderItemsAction`
- `lib/actions/chapter.actions.ts` — `getChapterAction`, `saveChapterAction` (word count + 60s snapshot throttle), `updateChapterStatusAction`, `updateChapterNotesAction`
- `lib/actions/snapshot.actions.ts` — `getChapterSnapshotsAction`, `restoreSnapshotAction` (both premium-gated)
- `lib/actions/publishing.actions.ts` — `getPublishingMetadataAction`, `updatePublishingMetadataAction` (premium), `getExportPresetsAction`

### Phase 6 — Discover Feed ✅ COMPLETE
- `/discover` page: trending/popular/new feed with genre filter, load-more pagination
- Book detail page `/discover/book/[bookId]`: cover, synopsis, chapter list with read progress, like/bookmark/follow, comments
- Chapter reader `/discover/book/[bookId]/read/[chapterId]`: full TipTap prose at reading width, marks chapter as read
- Social actions: `toggleBookLikeAction`, `toggleBookmarkAction`, `toggleFollowAction`, `addCommentAction`, `getCommentsAction`
- Reading progress: `markChapterReadAction`, `getReadingProgressAction`
- DB: `readingProgress` table (last chapter per user+book), `bookLikes`, `bookmarks`, `bookComments`, `follows`

### Phase 7 — Community ✅ COMPLETE
- **Sparks** — writing prompt contests: create, submit entries (one per user), 48h voting window, creator's choice, lazy winner finalization with `SPARK_WIN` notification
- **Discover tab bar** — Books | Sparks | Hives tabs on `/discover`
- **Hives tab** — public Hives grid using existing `getPublicHivesAction`
- **Full entry pages** — `/discover/spark/[sparkId]/entry/[entryId]`: full prose reading + comments
- **Author profiles** — `/u/[username]`: bio, stats (followers/following/words/books/Sparks), published books, open Sparks, activity feed, follow button
- **Notification wiring** — `NEW_FOLLOWER`, `NEW_LIKE`, `NEW_COMMENT`, `SPARK_WIN` fired inline from server actions
- DB: `sparkVotes` (composite PK prevents double-voting), `sparkEntryComments`, `sparks` gains `wordLimit`/`creatorChoiceEntryId`/`winnerEntryId`, `sparkEntries` gains `content`/`wordCount`
- Key files: `lib/actions/sparks.actions.ts`, `lib/actions/user-profile.actions.ts`

## What's Next

- Phase 8: Stripe monetization

## Completed UI Work (pre-Phase 3)

HTML design files in `designs/` were ported to pages. Key patterns for future UI work:
- Server actions use `ActionResult<T>` = `{ success: true; data: T } | { success: false; error: string }`
- All internal links include `/${locale}/` prefix (localePrefix: 'always')
- Client components that use hooks need `'use client'` at top
- `params` and `searchParams` in Next.js 16 are `Promise<{...}>` — must be awaited

## Key Patterns

### Server Actions
```ts
'use server'
// requireAuth() → userId (throws AuthError if not authed or banned)
// validate with Zod → return { success: false, error } if invalid
// check ownership with assertBookOwner() from lib/actions/_helpers.ts
// ActionResult<T> = { success: true; data: T } | { success: false; error: string }
```

### Premium Errors
- `{ success: false, error: 'FREE_LIMIT_REACHED' }` — show upgrade prompt
- `{ success: false, error: 'PREMIUM_REQUIRED:<feature>' }` — show upgrade prompt

### Brand Tokens (defined in `app/globals.css`)
- Background: `#141414` (`--background`)
- Brand yellow: `#FFC300` (`--color-brand`)
- Border: `#2a2a2a` (`--border`)
- Font: Comfortaa (headings/brand), Geist (body)
- Dark-only — `<html className="dark">` is set in root layout

### DB
```ts
import { db } from '@/db'              // Drizzle ORM instance
import { books, chapters, ... } from '@/db/schema'  // all tables
```

### Auth
```ts
import { auth } from '@/lib/auth'      // better-auth instance
import { requireAuth } from '@/lib/require-auth'  // server action guard
```

### Tests
```bash
npm test          # vitest run (pure unit tests only — DB-dependent code uses tsc)
npx tsc --noEmit  # type check everything
```

## Free Tier Limits
- 3 books max (`FREE_BOOK_LIMIT`)
- 3 Hives max (`FREE_HIVE_LIMIT`)
- 5 Hive members max (`FREE_HIVE_MEMBER_LIMIT`)
- No version history (snapshots are premium only)
- No publishing metadata editing (premium only)

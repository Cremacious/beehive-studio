<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Beehive Studio — Project Status

**Slogan:** "Get buzzed about writing!"

## 📍 Resume Here

> **Last updated:** 2026-05-26
>
> **Current focus:** DP2 Studio Shell complete; DP3 Specialized Editor Surfaces next.
> **Active branch:** `main` (pushed to origin/main)
> **Last commit:** feat(studio): brand-yellow audit + error toasts + DP2 close-out (Task 6)
>
> **The audit** is a 6-sub-project effort to make the book editor at
> `/[locale]/studio/[bookId]` fully operational.
>
> 1. ~~**SP1 Stability Pass**~~ DONE.
> 2. ~~**SP2 Binder UX**~~ DONE.
> 3. ~~**SP3 Specialized Editors**~~ DONE — Front/Back Matter, Outline, Research notes.
> 4. ~~**SP4 Toolbar + modes**~~ DONE — ambient sounds removed; lucide icons; three-zone Format/Status/View; semantic tokens; Cmd+F/Cmd+S scoped to editor; editor light-mode toggle; studio columns fill viewport.
> 5. ~~**SP5 Metadata + persistence**~~ DONE — bottom status bar (save indicator + word count + inline-editable word goal); word goal moved to `chapters.wordGoal` DB column with lazy migration helper; Publishing details labeled as book-level; Scene Planner hidden on Front/Back Matter.
> 6. ~~**SP6 New surfaces**~~ **DONE** (2026-05-26) — Snapshot UI (right-side drawer, preview-then-confirm restore, premium-gated with upsell); aria-labels on all icon-only editor buttons; `?` keyboard cheatsheet modal (Ctrl+/ + Help button trigger). Mobile/tablet responsive deferred — Claude Design pass will repaint the studio. 119/119 tests, tsc clean.
>
> All six audit sub-projects complete. **Next: Claude Design visual pass**, then Phase 8 (Stripe monetization) resumes.
>
> **Chris's working preferences (confirmed across SP1–SP4):**
> - Commits go straight to `main`, no feature branches.
> - Per-task manual verification (don't batch).
> - Subagent-driven execution preserves context window.
> - Push to GitHub when asked.
>
> **Bug-fix posture:** the global error boundary at `app/[locale]/error.tsx` logs errors with stack + message + digest. Always start with the console error before guessing causes.
>
> **Specialized-editor pattern (now load-bearing):** FM/BM, Outline, and Notes all use `binderItems.content` jsonb + a render-branch in `chapter-editor.tsx`'s `!isChapterType` block. New specialized editors for other types should follow the same shape.
>
> **SP4 light-mode gotcha:** `[data-editor-theme="light"]` rules in `globals.css` didn't apply to descendants (root cause unclear — other rules in the same file work). The working approach: inline styles on the wrapper in `corkboard-or-editor.tsx` + a React-injected `<style>` tag in the same file. Anything that needs to flip per editor theme should be added inside that `<style>` tag.
>
> **Studio layout note:** the studio page's outer flex now uses `h-[calc(100vh-56px)]` (nav is `h-14`) instead of `h-full`, because the parent `(app)/layout.tsx` uses `min-h-screen` not `h-screen`. Other (app) routes are unaffected.
>
> **SP5 word-goal pattern:** word goal lives on `chapters.wordGoal` (int, default 0 = "no goal"). The bottom status bar (`editor-status-bar.tsx`) owns the UI; `lib/word-goal-migration.ts` is a pure helper that ports pre-SP5 `wcg:<binderItemId>` localStorage keys to DB on first chapter load, then deletes the key. Future per-chapter settings should follow the same shape (DB column + chapter action + status-bar inline edit) rather than localStorage.
>
> **SP6 snapshot-preview pattern:** `previewSnapshotId` in the provider gates `updateChapterContent` so autosave can't clobber the live draft while previewing a snapshot. Exit re-renders live content via a `wasPreviewingRef` so typing isn't reset every keystroke.
>
> **SP6 right-panel slot pattern:** `RightPanelSlot` client component (in `_components/right-panel-slot.tsx`) switches between `MetadataPanel` and `VersionHistoryDrawer` based on `historyOpen`. Future right-side overlays should follow the same shape.
>
> **SP6 cheatsheet trigger gotcha:** Bare `?` doesn't work in writing apps because the editor surface is contenteditable and `?` types into prose. We use Ctrl+/ (modifier) + a Help button (HelpCircle) in the toolbar that dispatches a `beehive:toggle-cheatsheet` custom event the modal listens for.
>
> **SP6 dev premium override:** Set `DEV_FORCE_PREMIUM=true` in `.env.local` to simulate premium status without modifying `userBilling`. Guarded to `NODE_ENV !== 'production'`. See `lib/premium.ts`.
>
> **Community/Discover boundary:** /community lives in (app) — authenticated-only personal feed. /discover lives in (public) — unauthenticated browsing. Same data (books, sparks, hives) shown differently. Don't duplicate features across both surfaces — Community shows YOUR follows' activity; Discover shows everything.
>
> **DP2 design-port pattern:** Studio chrome ported surface-by-surface (status bar → binder → metadata → toolbar → editor body → audit). Brand yellow restrained to 5 sanctioned uses across the touched surfaces. Sprint timer relocated from floating overlay into the bottom status bar's right cluster (resolves a live overlap bug). Newsreader serif wired as the prose face; container max-width 720px; light mode flips body to paper-ink (not paper-ink-strong) for long-prose readability.
>
> **DP1 design-port pattern:** Claude Design's tokens.css ported into `app/globals.css` `:root` as oklch primitives (chrome/paper/canvas scales, status, type colors). Shadcn semantic tokens (`--card`, `--background`, etc.) bridge to the new chrome scale so existing components inherit walnut automatically. The SP4 light-mode workaround in `corkboard-or-editor.tsx` references `--paper-*` tokens directly. Source of truth for future updates: `designs/claude/studio-shell/tokens.css`. The bonus pages (Landing / Sign In / Sign Up) Claude Design produced separately are deferred.
>
> **Next concrete step when resuming:** invoke /brainstorming for DP3 Specialized Editor Surfaces — port FM/BM WYSIWYG previews, Outline (Claude Design proposed alternative layouts), Notes, Character profile.

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

### Phase 7.5 — Community Feed ✅ COMPLETE
Repositioned /community from a redundant public-Hives list into the user's personal feed of activity from writers they follow, plus a right sidebar containing My Hives, Suggested Writers, and Active Sparks.

- New page composition: `SuggestedWritersStrip` (top) + `FeedList` (chronological feed with cursor pagination + Load more) + right sidebar with three panels.
- Three feed item variants: `NewChapterFeedItem`, `NewBookFeedItem`, `NewSparkFeedItem` — 30-day window.
- New server actions in `lib/actions/community.actions.ts`: `getCommunityFeedAction`, `getSuggestedWritersAction`, `getMyActiveSparksAction`.
- New `getMyHivesAction` in `lib/actions/hive.actions.ts` (the existing `getUserHivesAction` had a hardcoded memberCount of 0; the new one queries real counts).
- New types in `lib/types/community.ts`.
- Schema field name discoveries: `follows.followeeId` (not followingId), `userProfiles.avatarUrl` (not image), `books.coverUrl` (not coverImage), `books.status='PUBLISHED'` (not publishedAt), `sparkEntries.userId` (not authorId), `sparks.title` (aliased to sparkPrompt).
- No DB migrations.
- 119/119 tests, tsc clean.

### DP1 — Design Port Foundations ✅ COMPLETE (2026-05-26)
First of four design-port sub-projects (DP1 → DP4). Ported Claude Design's full token system into the live codebase.

- `app/globals.css` `:root` now contains the full oklch primitive set: chrome scale (12 stops), paper scale (5 stops + 3 inks), warm-coffee dark canvas scale, brand + accent, 5 chapter status colors, 6 binder item type colors, validation (success/warning/error), type scale, spacing scale, elevation, radii, component sizing constants.
- Shadcn semantic tokens bridge to the new chrome — every existing component inherits warm walnut automatically without component edits.
- Newsreader font loaded via `next/font/google`, exposed as `--font-newsreader` and aliased into `--font-prose` for prose body use in DP2.
- Existing `@utility` blocks (scrollbar-custom, paper-stack) updated to reference new tokens.
- The SP4 light-mode editor CSS workaround in `corkboard-or-editor.tsx` (React-injected `<style>` tag + inline styles) now references `--paper-*` and `--paper-ink-*` tokens directly. 32 hex substitutions.
- Preserved decorative utilities (`paper-grit`, `auth-glow`, `hero-glow`, etc.) that use brand-yellow rgba literals — they're effect recipes, not chrome surfaces.
- No DB changes. No new dependencies. No component-tree changes.
- 119/119 tests, tsc clean.

**Next:** DP2 Studio Shell (binder, toolbar, editor body, status bar, metadata panel, hive integration) — pixel-perfect target per the brainstorm.

### DP2 — Design Port Studio Shell ✅ COMPLETE (2026-05-26)
Second of four design-port sub-projects. Ported persistent studio chrome to match Claude Design's `studio-shell` mockup. Pixel-perfect: editor body, binder, toolbar. Structural fidelity: status bar, metadata panel, Hive integration, error toasts.

- **Status bar restructured:** new `SprintControls` component composed by `EditorStatusBar`; floating sprint overlay deleted. Resolves a live overlap bug with the word-goal button.
- **Binder:** 6 item-type icons tinted via `--type-*` tokens, active row gets brand-yellow left-edge marker, ⋯ menu Delete row distinct, + Add menu lists types with tinted icons, new `BinderHiveFooter` opens CreateHiveModal.
- **Editor toolbar:** 26 buttons in three zones (FORMAT/spacer/VIEW), 30×30 button shape with mockup-spec spacing, shared `tbtnClass()` helper for ad-hoc buttons, solid brand-yellow active state.
- **Editor body:** Newsreader serif prose (`--font-prose`), 18px body / 1.78 line-height, Comfortaa headings, 720px max-width container, brand-yellow blockquote rule, "· · ·" horizontal rules.
- **Metadata panel:** status pills use `--status-*` palette (5 tints via relative-color syntax), Scene Planner chevrons via lucide, Publishing expander promoted to solid brand-yellow Premium badge.
- **Brand-yellow audit:** restrained to 5 places — active binder row, unsaved indicator, + Add CTA, premium badges, active toolbar button.

Token system extensions: registered `--color-brand-ink` + `--color-brand-soft` in `@theme` (`text-brand-ink` was silently falling back to white before). 119/119 tests, tsc clean.

**Next:** DP3 Specialized Editor Surfaces (FM/BM WYSIWYG previews, Outline + alternative layouts, Notes, Character profile).

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

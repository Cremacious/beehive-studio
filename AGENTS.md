<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Beehive Studio — Project Status

**Slogan:** "Get buzzed about writing!"

## 📍 Resume Here

> **Last updated:** 2026-06-01
>
> **Current focus:** **Hives Redesign — H3 Collaboration Core in flight, T3 of 21 shipped.** H3 plan at [docs/superpowers/plans/2026-05-29-h3-collab-core.md](docs/superpowers/plans/2026-05-29-h3-collab-core.md) against locked spec at [docs/superpowers/specs/2026-05-29-h3-collab-core-design.md](docs/superpowers/specs/2026-05-29-h3-collab-core-design.md). **T1 schema migration shipped (`9eba5a5`):** `scripts/migrate-h3.ts` ran idempotently (7 ✓ steps, re-runnable verified) — renamed hive_comments → hive_annotations with new columns (layer/parent_id/selected_text/resolved_by/resolved_at + booleanized resolved separate from new resolved_at timestamp + content→body rename + updated_at adds + integer cast on selection_start/end), reshaped hive_suggestions (drop old text cols + status, add range + threading + resolution + accepted_at), reshaped hive_submissions (rename submitter_id→user_id NOT NULL, add title/content/word_count/target_chapter_order/draft_status + reviewer fields + draft_status CHECK), added chapters.author_user_id (set null on user delete), added hive_discussion_posts.topic + topic_only_on_top_level CHECK (GENERAL backfill on top-level posts before constraint), dropped hive_chapter_locks. Two new pgEnums (annotation_layer, discussion_topic). Subagent caught several plan gaps and fixed in place — see commit body. **T2 permission predicates shipped (`bb62c83`):** appended 4 predicates to `lib/hive/permissions.ts` (canPostDiscussion → all members; canReviewSuggestion → OWNER/MODERATOR; canResolveAnnotation → book owner OR annotation author; canEditDiscussionPost → post author OR OWNER/MODERATOR), 14 new test cases (67/67 permissions tests green), deleted dead `lib/actions/hive-collab.actions.ts` (zero callers — legacy lockChapter/createHiveComment/etc. superseded by T6-T9's real action files). tsc fully clean. H2 (18/18) shipped 2026-05-29. **T3 TipTap marks shipped (`3e0e5ad`):** `HiveAnnotationMark` (attrs: annotationId + layer; 5-layer enum) + `HiveSuggestionMark` (attr: suggestionId) in `lib/tiptap-extensions/`. Both `inclusive: false`, `excludes: ''`, parseHTML on `span[data-…]`, renderHTML emits `<span class="hive-annotation|hive-suggestion" data-…>`. Custom commands via TS module augmentation on `@tiptap/core`. Per-layer CSS in `app/globals.css` (5 layer colors via `data-layer` selector; `.public-reader` reset so marks ride along on save but stay invisible to logged-out viewers). 2/2 round-trip tests via `@tiptap/html` (added as devDep, exact-pinned at 3.23.1 to match the rest of the tiptap ecosystem — future tiptap bumps must move all packages together). tsc fully clean. Marks NOT yet wired into chapter-editor.tsx — T12 does that. **Next concrete step:** T4 — Mark scanning helpers (`findMarkRanges`, `findOrphanMarks`) in `lib/tiptap-extensions/` (or similar). Pure functions that walk a TipTap doc and surface mark positions / orphans (marks whose ids aren't in the DB rows or vice versa). Used by gutter UI in T11 and orphan detection in `getChapterAnnotationsAction` / `getChapterSuggestionsAction`. Plan task at line 649 of the H3 plan. After T4: T5 server-side doc mutation (`applySuggestionToDoc`), T6-T9 server actions, T10-T19 UI surfaces, T20 activity wiring audit, T21 ship.
> **Active branch:** `main`
> **Last commit:** feat(hive): H3 T3 — HiveAnnotationMark + HiveSuggestionMark TipTap marks
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
> **DP3 specialized-surfaces pattern:** Non-chapter binder items each get their own renderer. FM/BM uses WYSIWYG inline-edit page previews (5 subtypes) with shared `PageWrapper` chrome — book pages always cream paper, surrounding pane theme-aware via `--sheet-canvas`. Outline replaces Kanban with vertical sortable beat-sheet; legacy `{columns, cards}` data flattened at render time via `readBeats()`. Character uses sheet-style with theme-aware ink (paper-ink-strong on cream in light mode for crisper readability). Notes restyled in-place; ruled-paper background lines removed per Chris. Generic textarea fallback removed — every binder type has a specialized renderer.
>
> **DP1 design-port pattern:** Claude Design's tokens.css ported into `app/globals.css` `:root` as oklch primitives (chrome/paper/canvas scales, status, type colors). Shadcn semantic tokens (`--card`, `--background`, etc.) bridge to the new chrome scale so existing components inherit walnut automatically. The SP4 light-mode workaround in `corkboard-or-editor.tsx` references `--paper-*` tokens directly. Source of truth for future updates: `designs/claude/studio-shell/tokens.css`. The bonus pages (Landing / Sign In / Sign Up) Claude Design produced separately are deferred.
>
> **DP4 overlays/modes/modals pattern:** Transient surfaces ported. Two new shared components: ConfirmDialog (built on shadcn Dialog primitive — used for destructive flows like binder delete) and EmptyState (studio-scoped, theme-aware via `onEditorCanvas` prop). Modals (cheatsheet/export/sprint-setup), overlays (find/replace), drawers (history), banners (preview), and panels (writing analysis) each got the new visual treatment with theme-aware ink where they cover the editor canvas. Corkboard pixel-perfect with paper index-cards + alternating ±1° rotation on warm desk-surface bg. Focus mode gained 200ms width/translate/opacity transitions. Sprint finished plays a one-time CSS pulse-glow (`@keyframes sprintFinished` in globals.css).
>
> **Light-mode editor default (2026-05-26):** Editor theme defaults to `light` (cream paper) for all new sessions. Users with `localStorage['editor-theme'] === 'dark'` keep dark mode. The change reflects the on-brand "writer's desk by day" experience the Claude Design pass established. Dark mode remains accessible via the toolbar Moon icon.
>
> **Studio Library pattern:** `/[locale]/studio` is the user's bookshelf — Continue-Writing hero + 3-tile vertical stats stack header (spines/sparkline/ring viz per tile), search + sort + view-switch + filter chips, paper-warm book cards with status stripe + always-visible info band (no hover overlay). Hero/stats data via `getStudioStatsAction`; book projection extended with `summarizeBookStatus()` helper that rolls chapter statuses up to a single book label (Drafting/Revised/Published). Same helper drives card status pills AND filter chip counts so they stay in sync.
>
> **Library v2 design pattern (2026-05-27):** Page bg locked to `#1E1E1E`; lifted surfaces use `--canvas-dark-100/150/200/300` directly via inline `style={{ background: 'var(--canvas-dark-100)' }}` (chrome shadcn-bridge isn't pixel-perfect for this page). Brand yellow restrained to 4 uses: hero Resume CTA + active filter chip + hover title accent + empty-state Start CTA. Status colors variate the page via per-card stripes + per-tile accents. AppNav now owns the only chrome on the page — no page-level top bar. JetBrains Mono added via `next/font/google` → `--font-jetbrains-mono` → wired into `--font-mono`. `--canvas-dark-150` added to globals.css as the search-focus surface tone.
>
> **Next concrete step when resuming:** Chris runs the Linked Series manual smoke (create three books with seriesName "The Stormlight Archive" / "stormlight archive" / "STORMLIGHT ARCHIVE" numbered 1/2/3 — they all link via normalized key; "By series" sort clusters them; reader page on Book 2 shows hero series line + footer prev→Book 1 / next→Book 3; make Book 3 PRIVATE → incognito viewer on Book 2 sees prev but no next; books with null seriesNumber show "Part of <Series>" hero line and no prev/next pair). Plus the chapter-status checklist from prior epic. Then next feature decisions: SP-B Friendships subsystem (separate brainstorm), Hive ↔ Binder integration via locked spec, Phase 9 polish, Stripe dashboard webhook config, `/settings` index page. Lower-priority backlog smokes: drag-into-folder, drag-anywhere, character redesign, beat-delete confirmation, binder-header layout post-corkboard, delete-book flows, SP-A reader-route checklist. Next feature decisions in order: SP-B Friendships subsystem (separate brainstorm), Hive ↔ Binder integration via locked spec, Phase 9 polish, Stripe dashboard webhook config, `/settings` index page. Outstanding manual smokes: drag-anywhere, character redesign, beat-delete confirmation, binder-header layout post-corkboard, delete-book flows (kebab + Danger Zone), SP-A reader-route checklist. After all that, next feature decisions in order: SP-B Friendships subsystem (separate brainstorm), Hive ↔ Binder integration via locked spec, Phase 9 polish, Stripe dashboard webhook config, `/settings` index page. **Outstanding from prior work:** Chris runs the manual verification checklist for SP-A: (1) create a PRIVATE book via wizard, confirm Sharing step appears, confirm `/books/[id]` shows reader for author; (2) incognito → "This book is private"; (3) flip to PUBLIC via Details Sharing section → incognito can read; (4) flip to FRIENDS → incognito sees friends-only screen, author still sees it; (5) toggle discoverable on while PUBLIC → appears on /discover; toggle off → disappears but `/books/[id]` still works; (6) old `/discover/book/[id]` 308s to `/books/[id]`; (7) editor toolbar Eye + binder title click + **library kebab Preview** all open the reader; (8) mark a chapter as read as the author → progress bar reflects it. Then next decisions in order: (a) SP-B Friendships subsystem (separate brainstorm — symmetric request/accept like beehive-books-online had); (b) revisit T13 dual-click race if it bites; (c) Hive ↔ Binder integration via the locked spec at [docs/superpowers/specs/2026-05-27-hive-binder-integration-design.md](docs/superpowers/specs/2026-05-27-hive-binder-integration-design.md); (d) Phase 9 polish; (e) Stripe dashboard webhook config; (f) `/settings` index page. After each task: dispatch implementer → spec reviewer → quality reviewer → checkpoint with Chris before next task (per-task manual verification preference). The spec and plan are locked — do not re-litigate without explicit instruction. Subagent flow is documented in `C:/Users/Chris/.claude/plugins/superpowers/skills/subagent-driven-development/`. After SP-A ships, the next decisions in order are: (a) SP-B Friendships subsystem (separate brainstorm — symmetric request/accept like the old beehive-books-online had); (b) Hive ↔ Binder integration via the locked spec at [docs/superpowers/specs/2026-05-27-hive-binder-integration-design.md](docs/superpowers/specs/2026-05-27-hive-binder-integration-design.md); (c) Phase 9 polish (referral codes, growth analytics, plan-upgrade nudges); (d) Stripe dashboard webhook configuration for live monetization; (e) a `/settings` index page.

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

### DP3 — Design Port Specialized Editor Surfaces ✅ COMPLETE (2026-05-26)
Third of four design-port sub-projects. Ported all non-chapter editor surfaces.

- **Research Notes:** restyled — Newsreader prose, cream paper card, paper-ink tokens. Ruled-paper background lines + red margin rule removed per Chris's feedback. Existing attribute controls (pin / color / favorite) preserved; tag-chip system noted as TODO. Top padding reduced from pt-16 to pt-8.
- **Character profile:** sheet-style rewrite. Avatar (initials placeholder + TODO for upload), name + meta header card, 6 section cards (Appearance / Personality / Backstory / Arc / Relationships / Notes). Theme-aware surface via local `--sheet-*` CSS variables — canvas-dark in dark mode, paper-100 in light with paper-ink-strong body text for crisper readability.
- **FM/BM WYSIWYG previews:** 5 new inline-edit page-preview components (title-page, copyright, dedication, acknowledgments, about-author) replace 5 deleted form components. Shared `PageWrapper` chrome with theme-aware surrounding pane (`--sheet-canvas`); book page itself always cream regardless of editor theme. Contenteditable spans for single-line fields; TipTap mini-editor (StarterKit with bold + italic + paragraph + hardBreak only) for multi-paragraph rich text. New `[contenteditable][data-placeholder]:empty::before` utility added to globals.css for inline-edit placeholders. Empty state ("Pick a subtype above") given theme-aware ink so it's readable on both walnut and cream canvases.
- **Outline:** Kanban → beat-sheet swap. Vertical sortable list with handle-only drag. Render-time `readBeats()` translator flattens legacy `{columns, cards}` into `{beats: [...]}`. Status pill cycles `idea → drafting → done` with `--status-*` tints. Chapter-link-popover gained inline search; data flow preserved.
- **Generic textarea fallback removed** from `chapter-editor.tsx`. Every binder type now has a specialized renderer; unknown types log in dev / return null in prod.

Files deleted: 5 FM/BM form components, `outline/outline-column.tsx`. Data shape changes (all jsonb, no DB migration): Character (legacy `physicalDescription` → `appearance` etc.; `voice` lossy), Outline (Kanban → beats; column grouping lossy — accepted per spec), FM/BM TipTap bodies widened from `string` to `unknown` to hold both legacy strings and TipTap JSON (`toPlainText()` helper added to `lib/export/front-back-matter-templates.ts`).

119/119 tests, tsc clean.

**Next:** DP4 Overlays / Modes / Modals (corkboard, focus, history drawer, find/replace, writing analysis, cheatsheet, export, confirmations, empty states).

### DP4 — Design Port Overlays / Modes / Modals ✅ COMPLETE (2026-05-26)
Fourth and final design-port sub-project. Ports the remaining transient surfaces.

- **New `ConfirmDialog` component** (`components/ui/confirm-dialog.tsx`): unified destructive-action confirmation built on shadcn Dialog. Refactored binder-item delete to use it; standard a11y (focus trap + Esc + click-outside).
- **New `EmptyState` component** (`studio/[bookId]/_components/empty-state.tsx`): studio-scoped shared empty state. Theme-aware via `onEditorCanvas` prop. Used by chapter-editor's empty-book + no-chapter-selected, metadata-panel's empty placeholder, version-history-drawer's no-snapshots, writing-analysis's no-prose.
- **Modals restyled:** keyboard cheatsheet (raised paper-key `<kbd>` caps with 4-layer shadow stack for 3D feel), export modal (format picker with lucide icons + sub-preset picker), sprint setup popover (260px anchored popover with 45°-rotated callout tail + 3-up duration tiles).
- **Overlays + drawers restyled:** find & replace strip with paper-context bridge (paper-50 input bg, paper-ink-strong text in light mode), version history drawer chrome (snapshot rows as paper-card pills with 2px brand-yellow accent on active row; free-tier upsell card with radial brand gradient + Sparkles + Upgrade CTA), snapshot preview banner (gradient band with 4px brand left accent + glow, theme-aware ink for legibility on cream), writing analysis panel (section cards with 44px brand-yellow readability headline, sentence-length histogram, adverb chips, passive-voice quote blocks, cliché list).
- **Corkboard (pixel-perfect):** paper index-card grid on warm desk-surface (radial vignette + dotted coffee-tone layers). Alternating deterministic ±1° rotation. Hover lifts + rotates to 0° with deeper shadow. Active card brand-yellow outline + "Editing" mono-pill ribbon. Empty state via EmptyState.
- **Focus mode polish:** 200ms width + opacity + translate transitions on sidebars. Smooth slide-in / slide-out.
- **Sprint finished celebration:** one-time `@keyframes sprintFinished` pulse-glow on the finished pill. Soft, paper-feeling, not confetti-noisy. Animation replays each time a sprint completes (fresh JSX mount per state transition).
- **Editor theme default:** light is now the default writing surface; dark is opt-in via Moon icon. Reflects the on-brand "writer's desk by day" feel.

Two minor scope notes (not blocking; deferred): status pills per corkboard card (needs provider plumbing for chapter-status batch load), drag-to-reorder in corkboard (was never wired in legacy code).

No DB changes. No new dependencies. 119/119 tests, tsc clean.

**Design Port pass complete.** All four sub-projects (DP1-DP4) shipped. Studio UI fully matches the new design system established by Claude Design.

**Next:** Phase 8 Stripe monetization — pricing page, subscriptions, webhooks, billing portal.

### P8A — Stripe Foundations ✅ COMPLETE (2026-05-27)
First of four Phase 8 sub-projects (P8A → P8D). Lands the Stripe infrastructure.

- **Schema:** `userBilling` extended with `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus` (enum), `currentPeriodEnd`. `premium: boolean` dropped — entitlement now derives from `subscriptionStatus IN ('active', 'trialing')` via `getUserPremiumStatus()`.
- **SDK:** `stripe` npm package installed; `lib/stripe/client.ts` is a singleton with pinned `apiVersion` + runtime key-prefix sanity check (fails loud if test key in prod or live key in dev).
- **Server actions:** `createCheckoutSessionAction({ priceKey, locale })` and `createBillingPortalSessionAction({ locale })` in `lib/actions/billing.actions.ts`. Lazy customer creation on first checkout.
- **Webhook scaffold:** `/api/webhooks/stripe` with signature verification + no-op handlers (P8C wires real entitlement sync). DO NOT configure Stripe dashboard webhook URL until P8C ships.
- **Env vars:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `NEXT_PUBLIC_APP_URL` documented in `.env.example`.
- **`DEV_FORCE_PREMIUM=true` preserved** — short-circuits before DB read in non-production builds.

No UI ships in P8A. P8B will build the pricing page; P8C wires real webhook handlers; P8D wires Settings → Billing portal.

**Next:** P8B Pricing page + checkout flow.

### P8B — Pricing Page + Checkout Flow ✅ COMPLETE (2026-05-27)
Second of four Phase 8 sub-projects. Builds the public `/[locale]/pricing` page wired to P8A's `createCheckoutSessionAction`, routes logged-out users through sign-up first, lands a `/welcome` celebration page Stripe redirects to post-checkout.

- **Public pricing page** at `app/[locale]/(public)/pricing/page.tsx`: server component, `revalidate: 3600` ISR, fetches live Stripe prices via `stripe.prices.retrieve()` for monthly + annual. Single Premium tier with monthly/annual toggle pill (`PlanCard` client component). Dynamically computed annual savings percentage. Premium feature list with brand-y framing (Never lose a draft, Publish your book, Build your library, Grow your circle). Free-tier callout pinned below.
- **CTA flow:** logged-in users → `createCheckoutSessionAction` → Stripe-hosted Checkout. Logged-out users → `Link` to `/${locale}/sign-up?next=/${locale}/pricing` (sanitized via `safeNextPath` — same-origin paths only).
- **Sign-up `?next=` plumbing:** `safeNextPath()` helper in `lib/url-helpers.ts` validates same-origin paths (rejects protocol-prefixed, double-slash, and external URLs). Sign-up form sanitizes `?next=` via `safeNextPath` but Path 2 was taken — onboarding always redirects to `/studio`. The follow-up commit also added a server-side check on `/sign-up` that bounces already-authed users to `?next=` (so logged-in users clicking Upgrade get straight to /pricing).
- **Welcome page** at `app/[locale]/(app)/welcome/page.tsx`: celebration page Stripe redirects to on successful checkout (`success_url` updated to point here). One-time confetti CSS animation + "Continue to Studio" CTA.
- **Studio upsell href audit:** only one studio reference to `/pricing` (`version-history-drawer.tsx` free-tier Premium card) — already correctly locale-prefixed. No bare `/pricing` hrefs in app code.
- **Live Stripe checkout test deferred** — Chris will exercise the end-to-end flow manually with his own Stripe account. Until P8C wires real webhook handlers, paid users are technically not premium until P8C catches up (Stripe retries events for up to 3 days).
- 121/121 tests, tsc clean.

**Next:** P8C Webhook handlers (real entitlement sync).

### P8C — Webhooks + Entitlement ✅ COMPLETE (2026-05-27)
Third of four Phase 8 sub-projects.

- **Subscription event handler** (`lib/stripe/handle-subscription-event.ts`): processes `customer.subscription.{created,updated,deleted}` events. Upserts `userBilling.subscriptionStatus`, `stripeSubscriptionId`, `currentPeriodEnd`. Idempotent by construction (same event re-applied = same final state).
- **Race-recovery branch:** if `userBilling` row is missing for a `stripeCustomerId`, the handler fetches the Stripe customer to read `metadata.userId` (set by P8A's `ensureStripeCustomer`) and upserts. Self-healing.
- **Hard failure modes:** unknown subscription status (Stripe added a value we haven't enumerated) or missing customer metadata → throws → webhook returns 500 → Stripe retries up to 3 days. Logs the customer ID for triage.
- **Webhook route** (`app/api/webhooks/stripe/route.ts`): now dispatches to the handler. Other events still logged + ignored.
- **Schema:** `subscription_status` enum extended with `paused` (Stripe SDK v20 includes it in the type union; missed in P8A's enumeration). Applied via `npm run db:push`.
- **Premium audit:** 9 call sites of `getUserPremiumStatus`/`requirePremium` reviewed across snapshot/publishing/book/hive/chapter actions. All correctly awaited, gated before writes, using right error codes (`PREMIUM_REQUIRED:<feature>` or `FREE_LIMIT_REACHED`). No drift found.
- **Unit tests:** 4 new tests for the handler (happy path, race recovery, missing metadata, unknown status). Total: 125 (was 121).

No new server actions.

**Post-deploy (NOT in code — Chris does in Stripe dashboard):**
1. Configure webhook endpoint at `https://{prod-domain}/api/webhooks/stripe`.
2. Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.
4. Test from dashboard's "Send test webhook" UI.

**Next:** P8D — Settings → Billing portal + downgrade UX (soft-lock when premium loss pushes user >FREE_BOOK_LIMIT or >FREE_HIVE_LIMIT).

### P8D — Billing Portal + Downgrade UX ✅ COMPLETE (2026-05-27)
Fourth and FINAL Phase 8 sub-project. Closes Phase 8.

- **`/settings/billing` page:** server component with 5 state branches (free / active+trialing / past_due / canceled / other). Hero status display + Manage button (opens Stripe Portal via P8A's createBillingPortalSessionAction). past_due shows a warning card; canceled shows "Subscription ended" + Resubscribe CTA. dynamic='force-dynamic' so the page always reflects current state.
- **Soft-lock for overflow books:** `lib/billing/book-overflow.ts::isBookOverflow(userId, bookId)`. Non-premium users with >FREE_BOOK_LIMIT books get the oldest 3 active; 4th+ become read-only. Gated at saveChapterAction + all binder write actions (create/update/delete/reorder binderItem). OverflowBanner mounts in chapter-editor.tsx (brand-yellow band + Upgrade CTA); TipTap editor set to non-editable via setEditable(false) effect. createdAt ASC for stability across edits.
- **Threading:** bookOverflow computed in studio page server component → BookEditorProvider prop → exposed via useBookEditor() context → ChapterEditor consumes.
- **Hive invite gate:** existing `inviteAction` + `joinHiveByLinkAction` already check member count vs FREE_HIVE_MEMBER_LIMIT — confirmed in P8C audit + re-verified in P8D Task 4. Existing members in an over-limit hive keep editing; new invites/joins are blocked.
- **Premium semantics:** `PREMIUM_STATUSES` set in `lib/premium.ts` extended to `{active, trialing, past_due}`. Stripe's grace period (~3 weeks of payment retries) preserves access; once Stripe gives up the retry, the webhook flips status to 'canceled' and the user becomes free-tier.

No DB schema changes. Tests at 126 (+1 past_due test).

**Phase 8 (Stripe monetization) COMPLETE.** End-to-end flow:
- /pricing → Stripe Checkout → /welcome → subscription syncs via webhook → /settings/billing for management → Stripe Portal for plan changes/cancellation → downgrade triggers soft-lock if user is over free-tier limits.

**Post-deploy reminders:**
1. Configure Stripe dashboard webhook at `https://{prod-domain}/api/webhooks/stripe`.
2. Subscribe to: `customer.subscription.{created,updated,deleted}`.
3. Copy signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.
4. Test the live flow with a real test-mode subscription.

**Next:** Phase 9 — TBD. Candidates: referral codes, growth analytics, plan-upgrade nudges, polish.

### Studio Library Redesign ✅ COMPLETE (2026-05-27)
Replaces the bare card grid at `/[locale]/studio` with a richer library surface.

- **Header section:** ContinueWritingHero (most-recently-edited book — cover + title + word count + Resume writing CTA) + StudioStats (4 tiles: Total words / Books in progress / Words this week / Chapters published).
- **Controls row:** search input (filters by title/genre) + sort dropdown (Recent / A→Z / Word count) + filter chips with counts (All / Drafting / Revised / Published).
- **Cards:** minimal at rest (cover + title + word count); hover overlay reveals status pill (--status-* tinted), genre pill, last-edited relative time, chapter count. CSS-only via `group-hover` — no JS state.
- **Paper-warm covers** (paper-100 + paper-ink-strong) on cool gray chrome. Only "warm" element on the page.
- **Empty state:** rounded-card BookOpen icon + "Your stories start here" + dual CTAs (Start writing / Explore books). Replaces the floating illustration.
- **Data shape additions:** `BookSummary` projection extended with `genre`, `lastEditedAt`, `chapterCount`, `status` (computed via new `summarizeBookStatus()` helper). New `getStudioStatsAction` aggregates 4 stats.

No DB schema changes. No new dependencies. 126/126 tests, tsc clean.

### SP-A — Reader Route + Privacy/Discoverable ✅ COMPLETE (2026-05-28)

Public-facing book reader route accessible from the studio editor. First of two sub-projects (SP-A reader + SP-B friendships); SP-B deferred.

- **Schema** (commit `7e180bb`): `book_visibility` enum extended with `FRIENDS`; existing-but-unused `books.explorable` column renamed to `discoverable` (saved a column add); new composite index `books_discoverable_visibility_idx` on `(discoverable, visibility)`; backfill `UPDATE books SET discoverable=true WHERE visibility='PUBLIC' AND status='PUBLISHED'` ran (0 rows in dev). Migration applied via one-shot tsx script (drizzle-kit push requires TTY; same trade-off as Phase 7 — drizzle snapshot history is out of sync with live DB).
- **`canReadBook()` helper** (`7e180bb`/`acf7948`): single source of truth at [lib/books/can-read.ts](lib/books/can-read.ts). Resolution order: NOT_FOUND → author wins → PUBLIC → FRIENDS=FRIENDS_ONLY (placeholder for SP-B) → PRIVATE. 6 unit tests.
- **Discover refactor** (`a8567ce`): `getDiscoverFeedAction` + `getDiscoverWritersAction` now filter on `discoverable=true AND visibility='PUBLIC'`; `getPublicBookAction` stripped to bare PK lookup (privacy now caller-owned via `canReadBook`). Six `status='PUBLISHED'` refs audited and intentionally left — they're author-label / feed-event queries, not access gates.
- **Reader components hoisted** (`fba2c1a`): `ChapterList`, `CommentsPanel`, `SocialActions` git-moved (100% similarity) from `discover/_components/` to `(public)/_components/` for sharing.
- **New reader at `/[locale]/books/[bookId]`** (`4c43ab3`, `ab01e81`): server component pair — book overview page + chapter reader at `read/[chapterId]`. canReadBook gate at top: NOT_FOUND → `notFound()`; PRIVATE/FRIENDS_ONLY → `<AccessDenied>` (Lock icon for private, Users for friends-only, brand-yellow "Discover other books" CTA). Author back-link goes to studio; everyone else gets discover. ChapterList refactored to take `readerBasePath` prop.
- **Redirects** (`72bfa76`): old `/discover/book/[bookId]` + `read/[chapterId]` pages are now 8-line `permanentRedirect` shims (HTTP 308); 4 production `<Link>` hrefs migrated to `/books/` directly so internal nav skips the 308 hop. Code dupe between discover and books readers fully collapsed.
- **Reader-write action gating** (`950aec1`): `markChapterReadAction`, `getReadingProgressAction`, `addCommentAction` gated after `requireAuth()` via `canReadBook`; `getBookCommentsAction` (which lives in `discover.actions.ts` and supports anon viewers) gated via `getOptionalUserId`. All return `{ success: false, error: 'FORBIDDEN' }` on denial. Closed a silent bug — `getBookCommentsAction` had no visibility filter before.
- **Validation schemas** (`2eb43e2`): `createBookSchema` + `updateBookDetailsSchema` accept `visibility` (incl. FRIENDS) + `discoverable` with `.transform()` coercing discoverable→false when visibility≠PUBLIC; `updateBookSchema` widened to FRIENDS + optional discoverable (no transform; partial-update semantics). 4 new coercion tests + 1 repurposed sibling test now rejects `'EVERYONE'` and accepts FRIENDS.
- **Wizard Sharing step** (`ea888a3`): new `SharingControls` presentational component (three-card privacy radio Private/Friends/Public with Lock/Users/Globe lucide icons + discoverable checkbox, brand-yellow active state). Wizard now has 4 steps (Step 4 = Sharing, owns Create Book submit); Step 3 "Create Book" became "Next →". 3-layer discoverable defense (checkbox disabled + client force-clear on visibility change + server coercion).
- **Details page Sharing section** (`e7751bd`): `SharingControls` shared between wizard and Details form (`components/book/sharing-controls.tsx`); Details form gained a fifth Section after Publishing; `Visibility` type exported from the shared module, imported by both consumers.
- **Editor entry points** (`70daf4e`, `c1b1817`): toolbar Preview button (Eye icon in VIEW zone) + binder header book title wrapped in `<Link>` to the reader (double-click still triggers rename via `e.preventDefault()` — known minor UX race on the dblclick, deferred).

**Tests:** 132 → 137 (+5 net: +6 canReadBook + 4 schema coercion + 1 sibling repurposed - lost). tsc clean across the run.

**Mental model:** three independent axes on a book — `privacy` (who can open the reader, via `visibility` column extended with FRIENDS) / `discoverable` (whether it appears in /discover listings) / `status` (DRAFT/PUBLISHED — author's done-label only, no longer gates access).

**Deferred to SP-B (Friendships subsystem):** symmetric friend request/accept table + actions + UI + notifications. Until SP-B ships, `FRIENDS` visibility is settable but `canReadBook` returns `FRIENDS_ONLY` (author-only access).

### Linked Series ✅ COMPLETE (2026-05-28)

The "Series" choice in book creation now does something. Before: `seriesName` + `seriesNumber` were written to the DB and never displayed. Now: series metadata surfaces across the reader, library, discover, and profile; the library has a "By series" sort that clusters; the book reader page shows previous/next navigation between books in the same series; the wizard + Details page explain what the choice controls.

- **Matching helper** (`lib/books/series-key.ts`): `normalizeSeriesKey(name)` — lowercase, drops leading "The ", collapses whitespace, returns null for empty. 7 unit tests. Display name in UI is always the raw `seriesName`; this helper is matching-only.
- **Server-side neighbor query** (`lib/books/get-series-neighbors.ts`): `getSeriesNeighbors({ currentBook, viewerUserId })` returns `{ previous, next, total }`. Author-scoped (same `userId`), normalized-key match, gaps allowed (next jumps over missing numbers), every candidate filtered through `canReadBook` so PRIVATE/FRIENDS-locked books in the same series silently omit. 6 unit tests with mocked DB + canReadBook.
- **Projection extensions:** `BookSummary` (library), `DiscoverBook` (discover), `ProfileBook` (profile), `PublicBook` (reader page) all extended with `seriesName: string | null` + `seriesNumber: number | null`. SELECTs updated correspondingly.
- **Shared `SeriesLine` component** (`components/book/series-line.tsx`): renders "Book N · *Series*" (mono 11px, 0.05em letter-spacing) when both fields set, "Part of *Series*" when only seriesName is set, null when no series. Used by 3 surfaces: library card, discover card, profile tile.
- **Book reader hero:** "Book N of *Series*" line between the author meta row and the tags row, only when seriesName is set.
- **Library "By series" sort** (`book-grid.tsx`): new option in the existing SORT_LABELS. When active, the `clusterBooks` builder groups by normalized key with the first-encountered raw `seriesName` as the cluster displayName. Within-cluster sort is `seriesNumber` ascending with nulls last. Standalone books cluster under a "Standalone (N)" subheader at the end. Operates on the already-filtered `visible` list so filter chips remain accurate. Cluster order = insertion order (not alphabetical) — flag if you want it alphabetical later.
- **Reader page footer** (`(public)/_components/series-footer.tsx`): `<SeriesFooter>` renders prev/next links (ChevronLeft / ChevronRight + "Book N: Title"). Returns null when both neighbors are null. Author always sees full neighbors; non-author viewers don't see locked next-books because of the canReadBook filter inside `getSeriesNeighbors`.
- **Wizard Step 3 (`step-three.tsx`) + Details Structure section**: identical explanatory paragraph above the Standalone/Series toggle: "Is this book part of a series? If so, the series name and number will appear on your book's reader page, library card, and any discoverable surface — and readers will be able to jump between books in the series."

**Pattern note:** When adding a new card surface that displays a book, mount `<SeriesLine seriesName={book.seriesName} seriesNumber={book.seriesNumber} />` from `@/components/book/series-line`. Single component, consistent visual across all surfaces.

**Path correction:** AGENTS.md previously stated the legacy `create-book-wizard/` directory was unused (no callers). That's incorrect — the active wizard at `studio/new/_components/book-creation-form.tsx` imports `StepThree` from `studio/_components/create-book-wizard/step-three.tsx`. The `step-three.tsx` file IS the live wizard surface for Step 3; only `index.tsx` in that legacy directory is fully unused.

No DB / schema changes. 175/175 tests (162 baseline + 7 series-key + 6 get-series-neighbors), tsc clean.

### Chapter Status — Publish-Readiness Gate ✅ COMPLETE (2026-05-28)

Chapter status now controls reader visibility on the public book reader. Readers see full prose only for chapters at `status IN ('REVISED', 'FINAL')`; everything below renders as a "Draft — coming soon" locked teaser. Author always sees full content (gate is bypassed when `viewerUserId === book.userId`). Solves the "what does chapter status DO?" problem by giving the feature load-bearing user-visible consequences.

- **Pure helper** (`lib/books/is-chapter-reader-visible.ts`): `isChapterReaderVisible(status)` — true for REVISED/FINAL, false otherwise. Exports `ChapterStatus` union matching the `chapter_status` pgEnum. 5 unit tests. Single source of truth so the threshold is changed in one place if it ever moves.
- **Reader chapter list** (`(public)/_components/chapter-list.tsx`): widened `ChapterItem` with `status` + `updatedAt`; new `isAuthor` prop. Non-author + non-visible chapters render as a non-clickable `<div>` with "Draft — coming soon" badge + `aria-disabled="true"`. Visible chapters render the link with an "Updated MMM DD, YYYY" label sourced from `chapters.updatedAt`. `formatUpdatedLabel(Date | string)` normalizes Next.js server→client serialization.
- **Reader page** (`books/[bookId]/page.tsx`): chapter projection includes `status` + `updatedAt`. `isAuthor` computed once and threaded down. Hero "Start/Continue Reading" CTA + `lastReadChapter` both gated through `readerVisibleChapters` for non-authors — no broken links to locked chapters from the hero or the progress-bar Continue button.
- **Chapter reader page** (`books/[bookId]/read/[chapterId]/page.tsx`): direct-URL access guard. After `canReadBook` + chapter fetch, if viewer is not author AND `!isChapterReaderVisible(chapter.status)`, render `LockedChapterPlaceholder` (Clock icon + "This chapter is still being drafted" + back-link to `/books/[bookId]`). Gate placed BEFORE `markChapterReadAction` so locked direct-URL hits don't get logged as reads. Chapter query extended with `status: chapters.status`; book query extended with `userId: books.userId`.
- **No auto-demote on edit.** Status only changes by explicit author action; editing a REVISED/FINAL chapter just bumps `updatedAt` (which the freshness label reflects).
- **Binder color dots** (`binder/binder-item.tsx`): 6px dot using `--status-*` tokens renders between chapter icon + title for `type === 'chapter'` rows. `BinderItemRow` widened with `chapterStatus: ChapterStatus | null`; `getBinderTreeAction` projection includes `chapters.status`. Provider's `updateChapterStatus` optimistically syncs `chapterStatus` onto `binderItems` + rolls back on failure (live UI update). 3 literal `BinderItemRow` construction sites updated (chapter-editor, binder-item-menu, binder-add-menu) — new chapters default to `chapterStatus='FIRST_DRAFT'` matching schema default.
- **Metadata panel** (`metadata/metadata-panel.tsx`): explanatory paragraph above the Status pill bar ("Readers can only see chapters marked Revised or Final…"); per-pill subtitle ("Visible to readers" / "Not visible to readers") in 9px mono uppercase. Pills switched `rounded-full` → `rounded-md` to accommodate the two-line label+subtitle layout. Active-state subtitle inherits the status color; inactive sits at muted foreground.

No DB / schema changes. 162/162 tests (157 baseline + 5 new helper tests), tsc clean. The threshold logic centralized in `isChapterReaderVisible` so moving it to FINAL-only or extending it to FIRST_DRAFT is a one-file edit if priorities change.

**Pattern note:** when adding new reader-side gates, place them AFTER `canReadBook` (book-level access) and AFTER data fetches (you need the row), but BEFORE any side effects like `markChapterReadAction` — otherwise the side effect fires on locked surfaces.

### Drag-into-Folder ✅ COMPLETE (2026-05-28)

Extends the binder's existing dnd-kit setup with nesting. Dropping a document onto a folder row nests it; existing sibling-reorder behavior preserved.

**Accept rules** (`lib/binder/drop-rules.ts`):
- `part` (collection) accepts only `chapter`
- `research_folder` accepts every non-chapter document type: `research_note`, `research_folder` (sub-folders), `character`, `outline`, `front_matter`, `back_matter`
- Non-folder types are top-level only
- Cycle guard walks `parentId` upward from the target — rejects if active.id appears in the chain (with a `seen` Set defense against corrupt data)
- Pure helpers (`getAcceptedChildTypes`, `canNest`, `classifyDropZone`) unit-tested in isolation in `lib/binder/__tests__/drop-rules.test.ts`

**Mechanism** (lessons learned from a hairy debugging session — see `ff3e711` commit message):
- **NO `verticalListSortingStrategy`** on SortableContext. The strategy makes rows shift out of the way during drag to preview the new position — which made folder rows vacate when the user tried to hover them as nest targets. Sortable still tracks reorder logically; items just snap to the new position on release rather than animating during drag.
- **Custom collision detection** (`pointerWithin` → `rectIntersection` composition) using real pointer Y from a global `pointermove` listener. `closestCenter` doesn't work here because the dragged ghost's center is offset from the user's pointer by their grab offset, so it consistently resolved `over` to a neighbor instead of the folder under the pointer.
- **Separate `:nest` droppable overlay** on folder rows (NOT in SortableContext, so it doesn't participate in sortable reorder). Overlay element is absolutely positioned at `top:3, bottom:3, inset-x-0, pointer-events-none` — covers ~87% of the row. When the pointer is over the overlay, custom collision detection prefers the `:nest` id (suffixed `${node.id}:nest`) over the sortable's id. `handleDragOver` / `handleDragEnd` strip the suffix to recover the logical folder id.
- **`setNodeRef` on the row only**, not on a wrapper containing the row + children. Otherwise an expanded folder's droppable rect spans its entire subtree and `closestCenter` (or any rect-based collision) picks children instead of the folder itself.

**Three drop zones per row** (`classifyDropZone`): folders get top 3px = reorder before, middle = nest into (via `:nest` overlay), bottom 3px = reorder after. Non-folder rows split at vertical midpoint (before/after only). The 3px edges make the nest band ~87% of the row, so users don't need precise alignment.

**Visual indicators** (`binder-item.tsx`):
- Reorder before/after: thin brand-yellow horizontal line above/below the row (`h-0.5 bg-brand rounded-full mx-2`)
- Nest target: row gets `ring-2 ring-brand bg-brand/20` + a 4px brand-yellow halo via `shadow-[0_0_0_4px_oklch(from_var(--brand)_l_c_h_/_0.25)]`. The halo makes the locked-on folder visually pop forward.
- All rendered via a `dropZone: { overId, zone } | null` field on the existing `BinderTreeContext`.

**Auto-expand** (`binder-tree.tsx`): middle-body hover on a collapsed folder for 500ms expands it. Implemented with two `useRef`s (timer + target id) so re-hovering the same folder doesn't reset the countdown. Timer canceled on drag end, on invalid hover, and on any guard-return path inside `handleDragOver`.

**Drop behavior** (`handleDragEnd`): branches on the captured `dropZone`. `middle` → `parentId = folderId, order = maxOrderInFolder + 1` (no sibling reshuffle). `before`/`after` → adopts `overItem.parentId`, splices at the correct insertion index, recomputes orders. All updates flow through the existing `reorderBinderItemsAction` — no server-action changes.

**Pattern notes for future dnd-kit work in this binder:**
- Don't use `verticalListSortingStrategy` when you also need "drop ON" semantics. The strategy and "drop ON" are fundamentally incompatible.
- Use `pointerWithin` + a tracked `pointermove` ref when the dragged ghost's center may be offset from the user's pointer (which is almost always).
- For "drop ON" targets that overlap with sortable items, use a SEPARATE `useDroppable` NOT in SortableContext, with an overlay element covering the target band. Prefer the overlay id in collision detection. The non-sortable nature of the overlay is what stops the underlying sortable from reordering.
- `setNodeRef` MUST go on the visual click target itself, never on a wrapper that also contains descendants — otherwise the droppable rect doesn't match the visual target.

No DB / schema changes. 157/157 tests (137 baseline + 17 helpers + 3 net updates), tsc clean. Two non-blocking concerns noted: timer cleanup on unmount (low risk; would require `useEffect` cleanup hook), and `.find()` perf on very large binders (Map lookup would be cheaper). Both deferred.

### Character Profile Redesign ✅ COMPLETE (2026-05-28)

Single-file presentational rewrite of `character-profile.tsx`. The body region's 2-column section grid (which caused an Appearance↔Personality row-stretch bug) collapsed into a single continuous "specimen sheet" — sections separated by thin `var(--sheet-rule)` horizontal lines instead of individual paper cards. Per-section background / shadow / border-radius removed; the dossier feel now comes from the sheet's own paper tone + the mono index labels (`01 · Description`, etc.) + the display headings.

- **Layout:** outer container `grid + gridTemplateColumns: '1fr 1fr'` → `flex flex-col`. `SectionCard.full` prop removed (every section is full-width now). `<section>` semantic tag replaces `<div>` in both SectionCard and the Relationships outer wrapper.
- **Dividers:** `pt-8 first:pt-2 border-t border-[var(--sheet-rule)] first:border-t-0` provides the divider rule + top-padding pattern. Tailwind's `first:` variant handles the first-section exception cleanly. `--sheet-rule` already theme-aware via the in-file `<style>` block (`canvas-dark-300` dark / `paper-300` light).
- **Typography refinements:** section heading 17→16px, body line-height 1.65→1.7.
- **Relationships section:** outer card chrome (background/shadow/radius) dropped, joins the divider flow. Inline row pills (avatar + name + arrow + relation chip + remove `×`) preserved verbatim — they provide their own structure.
- **Preserved verbatim:** identity header card (avatar + name + meta), breadcrumb head, theme-token `<style>` block, MetaPill, MetaText, save-status badge, all logic (CharacterContent type, readContent legacy migration, scheduleSave debounce, setField helper, removeRelationship, commitTitle).

+11 / -39 lines. No DB / schema / test changes. 137/137 tests, tsc clean.

### Hives Redesign — H2 Mirror Model ✅ COMPLETE (2026-05-29)

Second of 5 sub-projects in the Hives redesign. Makes the hive's wiki / outline / notes BE the same `binderItems` rows as the book editor's binder — single-source-of-truth, no sync layer. Lands 14 wiki categories (1 new `wiki_entry` binder type with category enum + 13 templates ported from beehive-books-online's hive-wiki) + `wiki_folder` for organization. Outline beats gain optional `act` field for grouping. Standalone hives back themselves with invisible `STANDALONE_HIVE_SHADOW` `books` rows so the single-source model holds without exceptions; tightens H1's partial UNIQUE on `hives.bookId` to a plain UNIQUE. Permissions: BETA_READER read-only on wiki/outline/notes, CONTRIBUTOR+ writable; chapters/parts/front-back-matter still author-only (chapter changes go through H3's submission flow). 18 tasks across schema → helpers → permissions → actions → editor UI → hive UI → ship.

- **Schema migration** (`scripts/migrate-h2.ts`, `db/schema/books.ts`, `db/schema/hive.ts`): `binder_item_type` enum gains `wiki_entry` + `wiki_folder`; `book_status` enum gains `STANDALONE_HIVE_SHADOW`; `binder_items` gains `author_id` + `last_edited_by` text FKs (`ON DELETE SET NULL`) + composite `binder_items_book_type_idx` on `(book_id, type)`; `hives.bookId` tightened to NOT NULL with plain UNIQUE (H1's partial UNIQUE dropped); legacy `hive_outlines` + `hive_wiki_pages` tables + their relations deleted; dev DB ported 3 legacy hive_wiki_pages → wiki_entry binder items under a "Imported from old wiki" wiki_folder + 3 hive_outlines → outline binder items (appended "Imported" beat to existing outlines or created fresh ones). Migration runner is idempotent via `IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` / `DO $$ EXCEPTION WHEN duplicate_object`. Live DB verified: shadow_books=0, wiki_entries=3, wiki_folders=1, outlines=9, hives_with_null_book=0.
- **`scopedBooksForUser` helper + codemod** (`lib/books/scoped.ts`): new module exports `scopedBooksForUser(userId)` (relational builder filtering `userId = X AND status != 'STANDALONE_HIVE_SHADOW'`) + `scopedBooksForUserSql` (raw SQL fragment for CTE-compose cases). 8 codemod sites across 7 files: `_helpers.ts` (assertBookOwner), `book.actions.ts` (5 sites: getActiveBookCount, library list, studio stats subquery, inProgress filter, getBookAction return narrowing, deleteBookAction), `book-overflow.ts`, `get-series-neighbors.ts`, `app/api/export/[bookId]/[format]/route.ts`. Intentional non-codemod sites confirmed and documented: `createHiveAction` (defensive `ne(status, STANDALONE_HIVE_SHADOW)` added — semantics differ since this is a user-supplied book lookup not a library query), `user-profile.actions.ts` (already PUBLISHED-scoped, comments added), community/discover `eq(books.userId, ...)` hits are innerJoin ON conditions not WHERE filters. Closes the book_status union-narrowing tsc error T1 opened.
- **Category templates module** (`lib/wiki/category-templates.ts`, `app/globals.css`): 14 categories (CHARACTER + LOCATION + LORE + PLOT + ARTIFACT + FACTION + CULTURE + LANGUAGE + BIOLOGY + THEME + ECONOMY + TERMINOLOGY + TIMELINE + OTHER), each with lucide icon (User/MapPin/ScrollText/Drama/Sword/Flag/Globe/Languages/Leaf/Sparkles/Coins/BookA/Clock/FileQuestion), label, blurb, accent color CSS var, defaultBody TipTap doc (h2 headings + hint paragraphs). 14 new `--wiki-*` oklch accent color tokens added to `:root` in `globals.css`. Module exports `CATEGORY_TEMPLATES` array + `CATEGORY_TEMPLATE_MAP` (record by category) + `WikiCategory` union + `CategoryTemplate` type. 4 unit tests (count = 14, every union covered, valid TipTap docs, all accents start with `--wiki-`).
- **Permission helper** (`lib/hive/permissions.ts`): appended `requireBinderWritePermission(bookId, binderItemId, userId): Promise<void>` (author bypass → resolve; else hive lookup → member lookup → item-by-id-and-book lookup → switch on type: chapter family → NOT_AUTHORIZED, outline → canEditOutline(role), wiki/folder/character/notes/research_folder → canEditWiki(role)) + `requireBinderCreatePermission(bookId, type, userId)` (same shape but skips the item lookup since the row doesn't exist yet). 42 new tests (40-case truth table: 4 roles × 10 item types + 2 author-bypass tests). Existing H1 T2 predicates (`canEditWiki`, `canEditOutline`) reused unchanged.
- **Tag normalization** (`lib/wiki/tags.ts`): `normalizeTags(input)` (trim + lowercase + drop-empty + dedupe + cap at MAX_TAGS=10) + `acceptTag(existing, candidate)` (single-add validator returning normalized string or null on empty/dupe/at-cap). 9 unit tests.
- **Outline act grouping helpers** (`lib/outline/group-by-act.ts`): `groupBeatsByAct(beats)` (preserves first-appearance order between groups + insertion order within; null/empty acts collect into a single null-keyed group at top, omitted when no null beats) + `distinctActs(beats)` (unique acts for autocomplete). Imports the existing `Beat` type from `outline-board.tsx`. 8 unit tests.
- **Wire permission helper + projection extension** (`lib/actions/binder.actions.ts`): four binder write actions (`create`/`update`/`delete`/`reorder`) swapped from `assertBookOwner` / `assertBinderOwner` to the new permission helpers; module-private `getBinderItemBook(id)` lookup helper added; `createBinderItemAction` insert writes `authorId: userId, lastEditedBy: userId`; `updateBinderItemAction` seeds `lastEditedBy: userId` on every update; reorder does NOT bump `lastEditedBy` (not an edit); `getBinderTreeAction` projection extended with `authorId` + `lastEditedBy` fields; `BinderItemRow` union widened to include `wiki_entry | wiki_folder` + nullable `authorId` / `lastEditedBy` fields. Closes the binder.actions.ts:82 T-future deferral. **Follow-up commit** (UI fallout): T7's BinderItemRow widening cascaded to 6 UI consumers — `lib/binder/drop-rules.ts` widened `BinderItemType` union + `wiki_folder` ACCEPT_TABLE entry (accepts wiki_entry/wiki_folder/character); `binder-item.tsx` ICONS + ICON_TINTS records gained wiki_entry (BookOpen, `--wiki-other`) + wiki_folder (Folder, `--wiki-other`); 3 optimistic-add literal BinderItemRow constructions (binder-add-menu, binder-item-menu, chapter-editor) include `authorId: null, lastEditedBy: null`.
- **`createHiveAction` standalone-shadow reshape** (`lib/actions/hive.actions.ts`): linked-book path keeps existing error semantics (BOOK_NOT_FOUND with defensive `ne(STANDALONE_HIVE_SHADOW)` filter / BOOK_ALREADY_HAS_HIVE / FREE_LIMIT_REACHED); standalone path now generates a `createId()` book id + inserts a shadow `books` row (status=STANDALONE_HIVE_SHADOW, visibility=PRIVATE, discoverable=false, title=hive.name, userId=owner) OUTSIDE the transaction before the hive tx. Hive insert always has non-null bookId. Trade-off: shadow book is orphaned if hive insert fails, but orphan-shadow-with-no-hive is invisible (`scopedBooksForUser` excludes from library, no UI surface queries it). New test file `lib/actions/__tests__/create-hive-action.test.ts` with 3 behavior tests via `vi.mock('@/db', ...)`. Closes the hive.actions.ts:86 T-future deferral.
- **Hive content view actions** (`lib/actions/hive-content.actions.ts`, `lib/tiptap-utils.ts`): four new server actions append to the file (alongside the legacy CRUD T10 deletes). `getHiveWikiView(hiveId)` → `HiveWikiViewData { bookId, entries (wiki_entry + character UNIONed with character → CHARACTER), folders (wiki_folder + research_folder w/ entryCount), viewerRole, authorUserId }` — single binderItems find + single userProfiles author-joins; excerpts via new `tipTapToPlain(value, maxLen)` helper added to `lib/tiptap-utils.ts` near `extractWordCount`. `getHiveOutlineView(hiveId)` → `{ bookId, outline: BinderItemRow|null, chapters (id/title/order for picker — empty for shadow books), viewerRole, lastEditedByUsername, lastEditedAt }` (last two added in T17 for the "Last edited by" hive header). `getHiveNotesView(hiveId)` → `{ bookId, notes: (BinderItemRow & { authorUsername })[], viewerRole }`. `getBinderTreeForHiveAction(bookId, hiveId)` (the sibling per Chris's pre-flight Q4) → `BinderItemRow[]` — asserts hive membership via T4 + verifies `hive.bookId === bookId` cross-hive escape guard + reuses `getBinderTreeAction`'s projection logic. Module-private `toBinderItemRow` helper. `requireHiveMember(hiveId, userId): Promise<HiveRole>` from H1 T2 returns the role directly, so `viewerRole` falls out of the call without a second lookup.
- **Legacy CRUD sweep** (`lib/actions/hive-content.actions.ts`): −70 LOC. Dropped `hiveOutlines, hiveWikiPages` schema imports; deleted 7 legacy actions (`getHiveOutlineAction`, `saveHiveOutlineAction`, `getWikiPagesAction`, `createWikiPageAction`, `getWikiPageAction`, `saveWikiPageAction`, `deleteWikiPageAction`) + 2 dead types (`WikiPageSummary`, `WikiPageFull`). Discussion + Tasks halves untouched. **🎯 tsc fully clean** after this task — first time since T1 widened the schema 10 commits prior.
- **Binder Add menu + 13-card category picker** (`binder-add-menu.tsx`, `wiki-category-picker.tsx`): three-section grouped layout (MANUSCRIPT: Chapter/Part/Front Matter/Back Matter; WORLDBUILDING: Character/Wiki Entry ▸/Wiki Folder; PLANNING: Outline/Research Note/Research Folder) using existing `SectionLabel`. Wiki Entry row tagged `special: 'wiki-picker'`; `handleAdd` early-returns to `setPickerOpen(true)`. `WikiCategoryPicker` is a shadcn Dialog with `sm:max-w-3xl`, 4-col `gap-3` grid, filters out CHARACTER → 13 visible cards (Character is its own first-class menu entry). Each card: icon chip with `oklch(from var(--wiki-X) l c h / 0.12)` tinted background, label, blurb, brand-yellow hover ring. Click → `handlePickCategory(category)`: closes picker, computes order from root items, calls `createBinderItemAction({ type: 'wiki_entry', title: \`New ${template.label}\`, content: { category, body: template.defaultBody, tags: [] } })`, then optimistic-adds + `setActiveItemId` + `setPendingRenameId` so user lands in rename mode.
- **WikiEntryEditor + shared TagChipStrip** (`wiki-entry-editor.tsx`, `tag-chip-strip.tsx`): `TagChipStrip` is shared between wiki + character (T15 consumer). Pills colored via `oklch(from var(--accent) l c h / 0.14)` bg + `var(--accent)` text; "+ tag" toggles to inline input (Enter commits via `acceptTag`, Escape cancels, blur commits); X button removes (hidden when readOnly); hides + tag at MAX_TAGS or readOnly; ARIA labels. `WikiEntryEditor` mirrors Character/Notes sheet-style chrome (theme-aware via `[data-slot="wiki-entry-pane"]` + `[data-editor-theme="light"]` overrides, cool-gray canvas dark mode, paper-300 canvas light mode; paper-card children). Header (Wiki ▸ {category} breadcrumb + SaveStatusBadge), category pill (template icon + accent color + label), contenteditable title (font-comfortaa font-bold text-2xl with `wiki-title` class wired to ink-strong), TagChipStrip, TipTap body (StarterKit configured with heading levels [2], `immediatelyRender: false`), scheduleSave 800ms debounce → `updateBinderItemAction(id, { content })` + optimistic `updateBinderItem` via `useBookEditor`. `readContent` migration helper handles missing/malformed content (defaults to `{ category: 'OTHER', body: doc, tags: [] }`). `commitTitle` separate path via `updateBinderItemAction(id, { title })`. Read-only mode for BETA_READER (TipTap non-editable, no save badge, footer "Read-only — your role is Beta Reader"). chapter-editor.tsx render-branch dispatches to it. Scoped `.ProseMirror` overrides inside `[data-slot="wiki-entry-pane"]` for body/headings/strong/blockquote/lists (mirrors NoteEditor pattern — globals.css's `.ProseMirror { color: var(--canvas-dark-ink) }` is designed for the chapter editor's cream-paper canvas; on the wiki dark walnut card it'd land dark-on-dark without scoped overrides).
- **WikiFolderRenderer** (`wiki-folder-renderer.tsx`): mirrors ContainerView's sheet chrome pattern (theme-aware via `[data-slot="wiki-folder-pane"]`, paper-card child grid on lifted canvas). Header: FolderTree icon chip in `--wiki-other` accent + child count metadata + read-only title (renames via binder convention) + SaveStatusBadge. Editable description textarea with `font-prose` + debounced save (800ms → `updateBinderItemAction(id, { content: { description } })` + optimistic `updateBinderItem`). Children pulled from `useBookEditor.binderItems.filter(i => i.parentId === item.id).sort(by order)`, rendered as clickable paper-card buttons (matches ContainerView's hover lift + brand-yellow border). TYPE_META extended with wiki_entry (NotebookPen, `--wiki-other`) + wiki_folder (FolderTree, `--wiki-other`). Empty state via `EmptyState`. chapter-editor.tsx render-branch dispatches.
- **Outline editor act grouping** (`outline-board.tsx`): `Beat` type extended with optional `act?: string | null`. Render wraps beats through T6's `groupBeatsByAct`. Per-group header: act-name input (uncontrolled `defaultValue + onBlur`, Enter commits via blur, Escape reverts via DOM mutation; "No Act" group is non-editable `<span>`) + beat count subtitle + per-group "Add beat" button. dnd-kit: kept single outer `DndContext`, split into **per-act `SortableContext`** (each with `verticalListSortingStrategy`). Cross-act drag: `onDragEnd` captures `targetAct = beats[to].act ?? null` BEFORE `arrayMove`, then post-move adopts that act onto the moved beat if different. "+ New Act" dashed-border button below "Add a beat" toggles to inline input. `commitNewAct` pushes onto `pendingActs: string[]` (dedupes against existing beat acts + already-pending names) — array (not single slot per Chris's mid-task fix: creating Act 1 then Act 2 used to erase Act 1's placeholder). Each pending act renders its own placeholder section with its own "+ Add beat" + discard `×` button. Materializing one removes it from the array. Top-level "Add a beat" always creates an ungrouped beat (doesn't claim from pendingActs — Chris's pre-flight choice for client-state-only acts). Datalist autocomplete: single `<datalist id="outline-act-suggestions">` populated from `distinctActs(beats)`, all act-name inputs wire via `list=`.
- **Character tag strip** (`character-profile.tsx`): `CharacterContent` gained optional `tags?: string[] | null`. `TagChipStrip` from T12 mounts under the role/age/pronouns meta row in the identity header card, wired to `--wiki-character` accent (warm gold per T3 token). `setField('tags', normalizeTags(next))` flows through existing `scheduleSave` debounce. +10 lines, no schema/migration churn.
- **`/hive/[hiveId]/wiki` real implementation** (page.tsx + 6 `_components/` files, +815 LOC): server `page.tsx` parallel-fetches `getHiveWikiView` + `getHiveNotesView`, renders `<HiveWikiShell>` with both + hiveId + locale. **`hive-wiki-shell.tsx`** (client) — header (title + "+ New Entry" gated by `canEditWiki(viewerRole)` + search input + 3-tab view switch By Category / By Folder / Notes); shell-level search filter via `matchesSearch` (case-insensitive substring of title/excerpt/tags) feeds Category + Folder views; selecting an entry swaps the entire content area for `<HiveWikiEntryEditor>` with back button. "+ New Entry" opens shared `WikiCategoryPicker` (T11); on pick, calls `createBinderItemAction` with the chosen category + template, then `setSelectedEntryId(result.data.id)` to land directly in the new entry's editor. **`by-category-view.tsx`** iterates `CATEGORY_TEMPLATES` order, collapsible sections with icon + label + entry count + caret, filtered entries render as cards, "+ Add a {label}" inline action for empty categories (gated). **`by-folder-view.tsx`** builds recursive tree from `wiki.folders` + `wiki.entries` rooted at `parentId === null`; character entries surface wherever the author placed them (T9 UNION). **`notes-view.tsx`** — flat grid sorted pinned-first then `updatedAt` desc; "+ New Note" creates research_note + `router.refresh()`; **cards-only for v1** (clicking a note does nothing — full hive-side note editing deferred). **`entry-card.tsx`** shared by Category + Folder views (title + excerpt + tag chips + author username + relTime). **`hive-wiki-entry-editor.tsx`** — hive-specific variant of WikiEntryEditor (~257 LOC, mirrors TipTap/CSS/tag-strip/title behavior). Fetches the item via `getBinderTreeForHiveAction(bookId, hiveId)`, drops `useBookEditor` optimistic calls (uses local state + `router.refresh()` after save), adds "← Back to wiki" header + "Last edited by @username · Nm ago" line. Clone-not-extract chosen to keep the load-bearing studio editor stable. Read-only mode for BETA_READER (TipTap non-editable, no save badge, footer message).
- **`/hive/[hiveId]/outline` real implementation** (page.tsx + 1 `_components/` file + T9 extension, +606 LOC): server `page.tsx` fetches `getHiveOutlineView(hiveId)`, passes data + hiveId + locale to `<HiveOutlineSurface>`. T9's return type extended additively with `lastEditedByUsername: string | null` + `lastEditedAt: Date | null` via conditional `userProfiles` join on `outline.lastEditedBy`. **`hive-outline-surface.tsx`** (+585 LOC) — Path B (clone, not extract) per T16 precedent. Reuses studio's `Beat`/`BeatStatus`/`OutlineContent` types + `readBeats` + `OutlineBeatRow` card via imports (presentational only, no provider dependency). Clones the orchestration shell + local `HiveChapterLinkPopover` (studio popover hard-imports `useBookEditor`). Local React state for `beats` + `pendingActs` + save status. 2s debounced `updateBinderItemAction(outline.id, { content })`. Server's T7 `requireBinderWritePermission` is the authoritative BETA_READER gate; client `readOnly` is the defensive layer. Read-only mode disables all create / drag / rename / status / link affordances + shows "Read-only — your role is Beta Reader" footer. Empty state when `outline === null` → "No outline yet — the author can create one in the editor" + brand-yellow "Open the book in the studio" link. Standalone hive (no chapters) → chapter-link popover shows "Standalone hive — no chapters available to link." SortableContext drops `verticalListSortingStrategy` (matches T14's runtime).

**Bugs caught + fixed mid-stream:**
- **`createBinderItemSchema` Zod enum missed the widening** in T1 (`lib/validations/book.ts`). Hit at runtime when creating a wiki entry. Fix: append `'wiki_entry', 'wiki_folder'` to the enum. **Lesson for future schema-widening tasks:** the load-bearing site list when adding a binder type is NOT just `BinderItemRow` + DB enum — it's also (a) `lib/validations/book.ts` Zod enums, (b) `lib/binder/drop-rules.ts` ACCEPT_TABLE + `BinderItemType` union, (c) `binder-item.tsx` ICONS + ICON_TINTS + isFolderType + COLLAPSIBLE_TYPES, (d) `binder-tree.tsx` isFolder check, (e) any specialized renderer's scoped ProseMirror styling (don't rely on globals.css's `.ProseMirror` color since it's designed for the chapter editor's cream canvas).
- **wiki_folder didn't accept nest drops.** ACCEPT_TABLE was correct from T7 follow-up but `binder-item.tsx`'s `isFolderType` / `COLLAPSIBLE_TYPES` + `binder-tree.tsx`'s `isFolder` check (passed to `classifyDropZone`) short-circuited before the drop-rules logic ever ran. Added wiki_folder to all three sites. wiki_folder rows now show caret + expandable children + the `:nest` droppable overlay so drops resolve to the brand-yellow halo nest target.
- **WikiEntryEditor body text unreadable on dark canvas.** Root cause: globals.css's `.ProseMirror { color: var(--canvas-dark-ink) }` is designed for the chapter editor's lifted-cream-paper canvas; on the wiki `bg-card` (dark walnut) it landed dark-on-dark. Fix mirrored NoteEditor pattern: switched body cards from `bg-card` to paper-100 surface with theme-aware tokens (`--wiki-canvas` cool-gray dark / paper-300 light; `--wiki-card-bg` paper-100/50), gave title contenteditable + breadcrumb + read-only footer matching `wiki-title` / `wiki-breadcrumb` classes wired to `--wiki-ink-strong` / `--wiki-ink-muted`, scoped explicit `.ProseMirror` color overrides inside `[data-slot="wiki-entry-pane"]`.
- **Multiple empty pending acts.** "+ New Act" used a single `defaultActForNextBeat` slot, so creating Act 1 then Act 2 erased Act 1's placeholder. Reshape: `defaultActForNextBeat: string | null` → `pendingActs: string[]`; each placeholder is independent; top-level "Add a beat" stops claiming from pending acts (always creates ungrouped beat); each pending act gets its own "Add beat" + discard `×` button.

**H2 patterns now load-bearing across the codebase:**
- **Mirror model:** a hive's wiki, outline, and notes are *views over the same `binderItems` rows* as the editor. Editing on either side writes to the same row; the other side picks up changes on next mount/refresh. Last-write-wins (no OT or CRDTs). Snapshot/restore (premium) is the recovery path.
- **`scopedBooksForUser(userId)` rule:** every /studio surface that lists "the user's books" must filter out `STANDALONE_HIVE_SHADOW`. Use the helper. Intentional non-codemod sites (where a specific user-supplied bookId is being validated) should add the explicit `ne(books.status, 'STANDALONE_HIVE_SHADOW')` instead. Future devs need to know.
- **Specialized renderer + chapter-editor render-branch:** new binder types add (a) `BinderItemType` union (drop-rules), (b) Zod enum (validations/book.ts), (c) DB enum + drizzle schema, (d) `BinderItemRow` union (binder.actions.ts), (e) `binder-item.tsx` ICONS/TINTS/isFolderType/COLLAPSIBLE_TYPES, (f) `binder-tree.tsx` isFolder, (g) specialized renderer file, (h) chapter-editor.tsx render-branch, (i) ACCEPT_TABLE if folder. AGENTS.md "What's Next" should include a "new binder type" checklist if this happens again.
- **Hive view actions naming convention:** `getHive<X>View(hiveId)` for member-scoped reads that join binderItems for hive UI consumption. `requireHiveMember` is the gate; viewerRole falls out of the call. Author profile joins via `userProfiles.username` / `avatarUrl` (not `users.name` / `image`).
- **Clone-not-extract for hive-side editor reuse:** when the studio renderer is load-bearing and consumes `useBookEditor()`, cloning the orchestration shell (re-importing presentational primitives like `OutlineBeatRow` and pure helpers like `readBeats` / `groupBeatsByAct`) is cleaner than threading optional callbacks through the studio editor. T16's `HiveWikiEntryEditor` and T17's `HiveOutlineSurface` both follow this pattern.
- **`requireBinderWritePermission` is now the gate** for all binder write actions. Hive members get author-only access to chapters / parts / front-back-matter (H3 will wire submission flow). CONTRIBUTOR+ write wiki / outline / notes / characters; BETA_READER read-only on everything.
- **Scoped `.ProseMirror` overrides** required for any new specialized renderer that doesn't sit on the chapter editor's cream-paper canvas. The globals.css default is canvas-dark-ink (cream-on-dark, designed for the chapter editor). New renderers on dark walnut cards need their own scoped `[data-slot="X-pane"] .ProseMirror { color: ... }` block (mirror NoteEditor or WikiEntryEditor).

tsc clean throughout. Tests 252/252 (186 H1 baseline + 4 category-templates + 9 tags + 42 permissions + 8 group-by-act + 3 create-hive = 252). 18 feature commits + 4 follow-up fixes.

**Next:** H3 — Collaboration Core (submission/suggestion flow for chapter changes; annotations; discussions). Spec at `docs/superpowers/specs/2026-05-29-h3-...` (committed earlier with the H1–H5 spec stack). Or other priorities — see Resume Here.

### Hives Redesign — H1 Foundation ✅ COMPLETE (2026-05-29)

First of 5 sub-projects in the Hives redesign. Lands the relational foundation, helpers, server actions, and primary UI surfaces. After H1, every book has at most one hive (DB-enforced via partial UNIQUE), every hive page has a real 11-entry sidebar shell (Settings/Members/Dashboard real; 8 H2–H4 stubs render "Coming in HX"), /community is a hive-activity feed (replaces the P7.5 follows feed), and /discover Hives is filtered on `discoverable=true AND visibility='PUBLIC'`. 17 tasks across schema, helpers, server actions, /studio, /community, /discover, /hive, editor binder footer.

- **Schema** (`scripts/migrate-h1.ts`, `db/schema/hive.ts`): `hives.discoverable boolean NOT NULL DEFAULT false`; `hives.book_id` FK tightened to ON DELETE CASCADE; partial UNIQUE `hives_book_id_unique ON hives(book_id) WHERE book_id IS NOT NULL` (intentionally partial — H2 tightens to plain UNIQUE once standalone hives have shadow books); `hive_member_role` enum collapsed 5 → 4 via Postgres swap-dance (EDITOR → MODERATOR, PROOFREADER → CONTRIBUTOR); new `hive_activity` table + `hive_activity_type` enum (10 values for H3/H4 forward-compat; only `member_joined` wired in H1). Live DB role enum is OWNER/MODERATOR/CONTRIBUTOR/BETA_READER (not the spec's READER — schema is source of truth).
- **Helpers** (`lib/hive/`): `permissions.ts` (8 predicates × 4 roles + 3 require-* helpers; 8/8 tests), `get-book-hive.ts` (`getBookHive(bookId)` reverse lookup with React `cache()` memoization), `record-activity.ts`.
- **Server actions** (`lib/actions/hive.actions.ts`, `lib/actions/hive-activity.actions.ts`): `createHiveAction` reshape with 3 paths (link existing book / create new+book / standalone), FREE_HIVE_LIMIT check, OWNER membership in same tx; `updateHiveAction` with discoverable→false coercion when visibility≠PUBLIC; `getUserHivesView` composite projection (id/name/desc/book/visibility/discoverable/status/memberCount/lastActiveAt/viewerRole; sorted by COALESCE(max activity, created) DESC) for /studio Hives section; `getHiveActivityFeedAction` member-scoped cursor-paginated feed joining `userProfiles.username`/`avatarUrl`; `recordHiveActivity` writer fired after `acceptHiveInviteAction` commits (Option B durability — activity write outside tx so failure doesn't void membership); rename `getPublicHivesAction` → `getDiscoverableHivesAction` (filter on `visibility='PUBLIC' AND discoverable=true`); deletes `getCommunityFeedAction` (P7.5 follows-feed retires) + `getMyHivesAction` (folded into `getUserHivesView`).
- **/studio Hives section** (`app/[locale]/(app)/studio/_components/hives-section.tsx`, `hive-card.tsx`): server page parallel-fetches `getUserHivesView` alongside books; client section has search/sort (Most active / Recent / A→Z / Member count) + filter chips (All/Owned/Member, Linked/Standalone with hasBoth-guard) + grid + empty states; `HiveCard` shows cover or honeycomb-SVG fallback + role pill via `--status-*` tokens + member count subline + last-active label or "No activity yet"; cards link to `/{locale}/hive/{id}`. Empty state requires BOTH zero books AND zero hives to fire.
- **CreateHiveModal** (`app/[locale]/(app)/studio/_components/create-hive-modal.tsx`): two-step — 3-radio path picker (Link existing book / Create new book + hive / Standalone) → details form (name/desc/visibility/discoverable with auto-clear when visibility≠PUBLIC). Eligible-books dropdown queries `getUserBooksAction` extended with `leftJoin(hives)` + `hiveId` in `BookSummary` projection. The "Create new book + hive" path redirects to `/studio/new?withHive=1` which after book creation bounces to `/studio?createHive=<newBookId>`; `HivesSection` reads the param via `useSearchParams` and auto-opens the modal pre-locked, then strips the param via `router.replace`.
- **Editor binder footer** (`app/[locale]/(app)/studio/[bookId]/_components/binder/binder-hive-footer.tsx`): `BinderHiveFooter` consumes `bookHive` threaded from the studio page server component via `BookEditorProvider` context. `bookHive` set → `<Link>` to `/{locale}/hive/{hiveId}` with Users icon + "Go to Hive"; null → Plus button + `CreateHiveModal` flow with "Create Hive" (uses the real T12 modal with `open`/`onOpenChange`/`prelockBookId` props — replaced the obsolete T11 stub modal import in passing).
- **/community rewrite** (`app/[locale]/(app)/community/page.tsx`, `_components/activity-feed.tsx`, `_components/activity-event-row.tsx`): 4-way parallel `Promise.all` (`getHiveActivityFeedAction({ limit: 30 })`, `getSuggestedWritersAction`, `getMyActiveSparksAction`, `getUserHivesView`) + inline 2-col grid layout (`1fr_280px`). `ActivityFeed` client component uses `useTransition` for Load older + `useParams<{locale}>` for hive links + empty state "You're not in any hives yet" → `/{locale}/studio`. `ActivityEventRow` has a per-type copy map covering all 10 `hive_activity_type` enum values (member_joined / chapter_submitted / chapter_submitted_approved / chapter_submitted_rejected / discussion_posted / annotation_added / suggestion_proposed / suggestion_accepted / suggestion_rejected / buzz_posted), avatar + actor profile link + hive link + inline `relTime` helper (date-fns not installed, matched existing codebase pattern). `MyHivesPanel` retyped against `UserHiveView`; "View all" → `/{locale}/studio`. Deleted 4 P7.5 follows-feed files (`feed-list.tsx`, `feed-item.tsx`, `community-page-shell.tsx`, `suggested-writers-strip.tsx`).
- **/discover Hives tab:** consumer at `app/[locale]/(public)/discover/page.tsx` now calls `getDiscoverableHivesAction` which filters on `visibility='PUBLIC' AND discoverable=true`. Toggling discoverable=false removes from listings but the hive URL still works for members.
- **/hive/[hiveId] shell** (`app/[locale]/(app)/hive/[hiveId]/`): 11-entry sidebar nav (Dashboard / Outline / Wiki / Annotations / Discussions / Submit Chapter / Edit Suggestions / Word Goals / Buzz Board / Members / Settings) with lucide icons + brand-yellow active marker. Landing simplified to "Welcome to {hive}" + member count + last-active relTime. Real Settings page with OWNER guard (non-OWNER inline message, no redirect) + form (name/desc/3-card visibility picker/discoverable with 3-layer defense) + Danger Zone delete via shared `ConfirmDialog` + sonner toasts + post-delete redirect to `/{locale}/studio`. Members page with OWNER-only role dropdown wired to `updateMemberRoleAction` (optimistic-with-rollback) + sonner toasts + remove button rollback. 8 H2–H4 stub routes via shared `_components/coming-soon.tsx`. Deleted ~7 P7.5 scaffolding files: `binder/page.tsx` + `hive-binder.tsx`, `tasks/page.tsx` + `hive-tasks.tsx`, singular `discussion/page.tsx` + `hive-discussion.tsx`, `wiki/[pageId]/page.tsx` + `hive-wiki.tsx`, `hive-outline-editor.tsx`, `hive-overview.tsx`, `hive-chapter-comments.tsx`.

**H2 will tighten** the partial UNIQUE index on `hives.book_id` to a plain UNIQUE once standalone hives have shadow books — intentionally deferred to H2.

**`requireBinderWritePermission` is NOT in H1** — that's H2 work. Hive-side writes are read-only because there's no hive UI for binder content yet.

**Known minor concerns (deferred, not blocking):**
- Live `hive_member_role` enum has BETA_READER not the documented READER (4 values: OWNER/MODERATOR/CONTRIBUTOR/BETA_READER). If the doc should win, a small T1-style migration would rename it.
- `inviteLink` in `hive-members.tsx` hardcodes `/en/...` locale (pre-existing bug, untouched).
- `getHiveAction` projection joins `users.name`/`image` not `userProfiles.username`/`avatarUrl` — inconsistent with the convention used elsewhere in H1.
- Stub `create-hive-modal.tsx` at `studio/[bookId]/_components/` and dead `create-hive-button.tsx` (no callers) still on disk after T13 swap; cleanup deferred.

tsc clean throughout. Full task-by-task breakdown with SHAs lives in this section's git history (`git log --oneline a759f10..d162ddf`).

**Next:** H2 — Mirror Model (binder mirror + permission gate + outline/wiki real).

### Delete Book ✅ COMPLETE (2026-05-28)

Adds a delete-book feature with two entry points and one shared dialog flow.

- **Toast infrastructure** (`aa0f94a`): installed `sonner` via shadcn (also pulled in `next-themes@^0.4.6` as a peer for `useTheme()`) + mounted `<Toaster />` in the outermost root layout (`app/layout.tsx`) so it's available on (public), (auth), and (app) routes. First toast use in the project; future features can rely on it. shadcn-generated `components/ui/sonner.tsx` reads next-themes via `useTheme()` but no `ThemeProvider` is mounted — falls back to "system" theme; cosmetic-only, defer unless toasts look wrong against the dark UI (we can pass `theme="dark"` explicitly to `<Toaster />` later).
- **Server side** (`e2b3cb6`): `deleteBookAction(bookId, locale)` now takes a required `locale` arg and calls `revalidatePath(\`/${locale}/studio\`)` after the DB delete. Zero pre-existing callers (confirmed via grep), so the signature widening was safe. FK cascades on `books` already drop binder items / chapters / chapter snapshots / book comments / book likes / bookmarks / reading progress — no additional delete logic needed, no schema changes.
- **Shared component** (`eb2bb1b`): `components/book/delete-book-button.tsx` is a render-prop client component (46 lines). Owns the destructive `ConfirmDialog` state, action call, success/error sonner toast, and post-delete `router.push(\`/${locale}/studio\`) + router.refresh()`.
- **Library kebab entry** (`31afc26`): added Delete book as the 4th menu item (last) in the book card kebab — red via `text-destructive`, Trash2 icon. `BookCardMenu` gained a required `bookTitle: string` prop, threaded from `book-card.tsx`'s `book.title`. Uses `onSelect={(e) => { e.preventDefault(); onTrigger() }}` to keep the menu open while the dialog mounts (same pattern as `binder-item-menu.tsx`'s delete).
- **Details Danger Zone entry** (`8585715`): non-collapsible `<section>` at the bottom of `/studio/[bookId]/details` with `rounded-lg border border-destructive/30` styling, outlined red Button. The Details component is div-based (no `<form>` element), so "outside the form" is moot, but `type="button"` defensive guard still set. Uses `initial.title` (server-loaded) not live form state — the dialog shows the actual persisted name, not unsaved edits.
- **Confirmation copy:** "Delete \"{Title}\"? This permanently removes the book and all of its chapters, notes, and snapshots. This cannot be undone." Confirm button label: "Delete book".

**Out of scope (deferred):** soft-delete with undo toast (real delete only), type-to-confirm (simple confirm matches existing app vocabulary), bulk delete, hive-shared book handling.

**Pattern for future "shared trigger + dialog" wiring:** the `DeleteBookButton` render-prop shape — `children: (onTrigger: () => void) => React.ReactNode` — is the cleanest way to share a confirm/action/redirect flow across multiple visual triggers (menu item vs button). Plug-in trigger receives an `onTrigger` callback to open the dialog; the wrapper owns all the state and side effects.

## What's Next

- Phase 9 — TBD (candidates: referral codes, growth analytics, plan-upgrade nudges, polish)

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

### P8A Stripe pattern
Premium derives from `userBilling.subscriptionStatus IN ('active', 'trialing')` — no denormalized boolean. Stripe customer creation is lazy (first checkout creates the customer; stored on `userBilling.stripeCustomerId`). `lib/stripe/client.ts` is the singleton with pinned `apiVersion` + runtime key-prefix sanity check (`sk_live_` in prod, `sk_test_` in dev). Webhook endpoint at `/api/webhooks/stripe` is signature-verified but no-op in P8A (P8C wires handlers — do NOT configure Stripe dashboard webhook URL until then or events get lost). `DEV_FORCE_PREMIUM=true` env override still works for local testing without Stripe.

### P8B pricing pattern
Public `/[locale]/pricing` page fetches Stripe prices server-side with `revalidate: 3600` ISR. PlanCard client component handles the monthly/annual toggle + dynamically computed savings percentage. Logged-in users invoke `createCheckoutSessionAction` and redirect to Stripe; logged-out users go to `/sign-up?next=/pricing` (sanitized via `safeNextPath`). The sign-up page server-checks session and bounces already-authed users to `next` (so authed users clicking Upgrade get straight to /pricing without seeing the form). Stripe success_url points at `/[locale]/welcome` (P8B-shipped celebration page). Until P8C wires real webhook handlers, paid users are technically not premium until P8C catches up — Stripe retries events for up to 3 days.

### P8C webhook pattern
`lib/stripe/handle-subscription-event.ts` is the single entry point for `customer.subscription.{created,updated,deleted}` events. Idempotent by construction (upserts `userBilling`). Race-recovery: if the userBilling row is missing for a `stripeCustomerId`, fetch the Stripe customer's `metadata.userId` and upsert. Throws on unknown subscription status (prevents DB corruption when Stripe adds new statuses) or hard failures; webhook route returns 500 → Stripe retries up to 3 days. **DO NOT add side effects** (welcome emails, etc.) without first adding event-ID deduplication — Stripe retries fire side effects multiple times. Stripe API 2026-02-25.clover moved `current_period_end` onto `subscription.items.data[0]` — handler reads it from there.

### P8D billing/downgrade pattern
`/settings/billing` renders one of 5 state branches based on `userBilling.subscriptionStatus`: free / active+trialing / past_due (warning) / canceled / other. ManageButton invokes `createBillingPortalSessionAction` (P8A). Soft-lock on overflow books: `isBookOverflow(userId, bookId)` from `lib/billing/book-overflow.ts` — non-premium users with >`FREE_BOOK_LIMIT` books get oldest 3 active, others read-only via the OverflowBanner + `editor.setEditable(false)`. createdAt ASC chosen for stability (updatedAt would shift overflow set on every keystroke). `bookOverflow` flows server-page → BookEditorProvider prop → context → ChapterEditor. Hive invite/join actions block when current member count exceeds `FREE_HIVE_MEMBER_LIMIT` — existing members keep editing. `past_due` is treated as premium in `PREMIUM_STATUSES` so Stripe's grace period (~3 weeks of retries) preserves access.

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

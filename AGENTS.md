<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Beehive Studio — Project Status

**Slogan:** "Get buzzed about writing!"

## 📍 Resume Here

> **Last updated:** 2026-05-27
>
> **Current focus:** Phase 8 COMPLETE. Stripe monetization fully shipped (P8A foundations → P8B pricing+checkout → P8C webhooks → P8D billing portal+downgrade).
> **Active branch:** `main` (pushed to origin/main)
> **Last commit:** docs: close P8D + Phase 8 complete (Stripe monetization shipped)
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
> **Next concrete step when resuming:** Configure the Stripe dashboard webhook URL (subscribe to customer.subscription.{created,updated,deleted}, copy signing secret to Vercel env STRIPE_WEBHOOK_SECRET). Test the live flow with a real test-mode subscription. Then close out Phase 8 and plan Phase 9.

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

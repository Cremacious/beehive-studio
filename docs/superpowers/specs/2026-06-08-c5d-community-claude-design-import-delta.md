# Community Surfaces — Claude Design Import Delta (2026-06-08)

## Source

- Bundle: `design-import-temp/c5d-community-bundle/` — 22 surface mockups (`01-community-hub.html` through `22-notification-bell-dropdown.html`, plus `10b/c/d/e/f` for the 6 club-detail panels), `community.css` (676 lines, the canonical shared stylesheet), `shared-components.html` (canonical renders for ~14 reusable components), `tokens.md` (proposes 8 new tokens + the bent-rule rationale), plus an `index.html` showcase gallery (ignored — not a real surface).
- Locked C5d handoff prompt the bundle was generated from: [docs/superpowers/specs/2026-06-05-c5d-community-claude-design-prompt.md](./2026-06-05-c5d-community-claude-design-prompt.md).
- Precedent for this kind of work (mirror its shape, tone, and depth): [docs/superpowers/specs/2026-06-04-hive-claude-design-import-delta.md](./2026-06-04-hive-claude-design-import-delta.md) — the Hive Routes Claude Design import delta, which shipped a 15-commit / 4-phase port ending at [63740f9](https://github.com/Cremacious/beehive-studio/commit/63740f9).

## How to use this doc

This is the **delta audit** between Claude Design's exported Community surfaces and the currently shipped codebase chrome. It is the SPEC, not the plan — writing-plans is called separately after Chris approves. Each per-surface row gives one of three verdicts: VISUAL-ONLY (chrome refresh, no structural change), STRUCTURAL (IA / data / component-shape change), or MINOR (small chrome tightening). Phase A foundation work lands FIRST so every surface in Phases B/C/D inherits the new tokens + shell rules without per-surface duplication.

## What Chris was trying to land

Chris pasted the C5d handoff prompt into claude.ai/design (fresh session) and iterated ~10-15 rounds. The starting point reproduced the locked design system + 5 pre-locked IA tweaks; the iteration added a layer of polish + locked the bent-rule decision on a 13th brand-yellow surface. The bundle delivers exactly what §1 of the handoff prompt asked for — 22 surface mockups + shared-component renders + a token rationale doc. The deliverable looks cohesive; the deviations are bounded.

**Locked decisions carried into the port (from the C5d brainstorm and the handoff prompt):**

1. **Q1 — Scope**: all 22 community surfaces + ~14 shared components are in scope. No deferrals.
2. **Q2 — Visual + targeted IA tweaks pre-locked.**
3. **Q3 — Three IA tweaks**:
   - `/clubs/[clubId]` 6-panel order becomes **About / Books / Discussions / Members / Schedule / Settings** (Books promoted from 3rd → 2nd).
   - `/u/[username]` profile section order becomes **Header / bio / friendship UI / stats / Lists / Clubs / Published books / Sparks+Activity merged**.
   - `/friends` consolidates from 4 tabs to 3: **Friends / Pending (Received+Sent sub-segments) / Suggested**.
4. **Q4 — Dark mode only.** Cream paper stays studio-chapter-editor-only.
5. **Q5 — Controlled token additions** (~8 max) with scoped semantic names + rationale.

**Bent-rule LOCKED**: `--club-role-owner: var(--brand)` is the 13th sanctioned brand-yellow surface. Designer's rationale (categorical twin of active-status-pill + premium-badge; max once per members table; reinforces yellow = authority/ownership) carried. The fallback warm gold (`oklch(0.80 0.14 88)`) is NOT used.

**Hard cross-cutting constraint**: **AppNav stays.** The bundle's mockups deliberately omit a top app bar (every mockup is a standalone HTML file). The shipped `app/[locale]/(app)/layout.tsx` mounts `<AppNav>` for every authed route — that mount MUST continue. The port adopts `community.css` chrome under AppNav, not in place of it.

---

## §1 — Foundation: tokens to land in `app/globals.css`

`tokens.md` proposes **8 net-new categorical accent tokens**, plus the bent-rule mapping. All values are quoted verbatim from `community.css:57-68`. None of the existing chrome/ink/brand/status/role/layer/radius/depth tokens are renamed or repurposed — this is purely additive.

`--brand-hover`, `--brand-active`, `--brand-soft`, `--canvas-dark-ink-faint`, the 5 `--layer-*` tokens, and the chrome scale `--canvas-dark-150/-250/-350/-400` all already exist (most landed in the editor-aesthetic refresh + the Hive Routes delta). **No re-add work needed for those.**

### Tokens to add

```css
:root {
  /* ── List/club/spark visibility (cross-cutting — 5+ surfaces) ── */
  --list-visibility-public:  oklch(0.72 0.11 230); /* sky blue — open to all (Globe) */
  --list-visibility-friends: oklch(0.74 0.12 145); /* mint — your circle (Users)    */
  --list-visibility-private: oklch(0.66 0.04 240); /* cool gray — closed (Lock)     */

  /* ── Spark status state machine (heartbeat of /sparks) ── */
  --spark-status-open:   oklch(0.74 0.12 145); /* mint — accepting entries */
  --spark-status-voting: oklch(0.78 0.13 70);  /* warm gold — voting live  */
  --spark-status-closed: oklch(0.66 0.04 240); /* cool gray — finished     */

  /* ── Club role accents (Owner intentionally maps to --brand; see §10d) ── */
  --club-role-mod:    oklch(0.72 0.11 250);   /* slate blue */
  --club-role-member: oklch(0.680 0.003 256); /* muted ink  */
  /* --club-role-owner is NOT a separate token. The .pill.role-owner consumer reads var(--brand) directly. */
}
```

### Rationale notes (preserve in port commit message)

- **Visibility triad** — every visibility pill across books, lists, clubs, and sparks previously borrowed `--status-*` ad hoc, which made a *Voting* spark and a *First-draft* chapter the same gold with no semantic link. The triad gives "Public" a stable sky blue everywhere; mint/gray map intuitively to world→circle→closed.
- **Spark status** — semantically distinct from chapter-status even where hues rhyme. The voting gold pairs with the countdown deadline display (`.deadline` in `community.css:651` uses `--spark-status-voting`).
- **Club role** — `--role-*` tokens are reserved for hives. The club equivalents fix the bug where "Owner" was the same `--status-first-draft` gold as a chapter draft.
- **No `--topic-*`, `--goal-*` adds** — topic pills reuse `--layer-*` via the `.pill.topic-*` mappings in `community.css:274-277`. Word goals don't surface in Community (they live in hive/studio). If a future Community-side goal surface lands, promote then.
- **Bent rule**: `--club-role-owner = var(--brand)` is the 13th sanctioned brand-yellow surface. Brand-yellow usage map now becomes the documented 12 surfaces + Owner pill. Update the AGENTS.md Design System section's "12-place map" wording to "13-place map" with this entry.

---

## §2 — Viewport / layout shell

`community.css` defines a universal page shell (`.cm-main` + `.cm-wrap` with `w-md` / `w-3xl` / `w-5xl` modifiers) and assumes the body itself is the backdrop (`body { background: var(--canvas-dark-100) }`). The shipped layout already provides `bg-[#262728]` on the outer `<div>` and renders `<main className="flex-1 flex flex-col pt-1.5">` under AppNav.

### Conflicts + resolutions

| Concern | Bundle | Shipped | Resolution |
|---|---|---|---|
| Body backdrop | `body { background: var(--canvas-dark-100) }` | `app/[locale]/(app)/layout.tsx` outer `<div className="min-h-screen bg-[#262728]">` | No change — `#262728` IS `--canvas-dark-100`. Keep current layout. |
| Page wrapper widths | `.cm-wrap.w-md` 28rem / `.w-3xl` 48rem / `.w-5xl` 64rem | Per-page ad hoc (`max-w-3xl`, `max-w-5xl`, `max-w-6xl`) | **Standardize** per-page `<main>` wrappers to `max-w-md / max-w-3xl / max-w-5xl` per the bundle's per-surface label. Replace `max-w-6xl` on /community with `max-w-5xl`. |
| Padding | `.cm-wrap { padding: 28px 24px 96px }` | Ad hoc (most pages use `px-4 py-6 sm:px-6`) | **Standardize** — apply `px-6 pt-7 pb-24` (or Tailwind equivalents) on every C5d page wrapper. Bottom-padding generous so AppNav doesn't crowd page foot. |
| Route eyebrow tag | `.route-tag` mono lowercase pill at top of every page | Not present | **OMIT** — `.route-tag` exists in mockups for review-only context labeling. AppNav supplies real navigation; don't add a visual route label. |
| Page-head block | `.page-head` with `.eyebrow` + `h1` + `.sub` + `.head-row` | Per-page ad hoc | **Adopt** as a shared `<PageHead>` presentational component used by 22 surfaces. Title is brand-yellow Comfortaa 30px; subtitle in muted ink with `max-w-56ch`. |
| Viewport-fill min-height | Not enforced (mockups are isolated cards) | `(app)/layout.tsx` uses `min-h-screen flex flex-col` already | OK — current layout handles short-page tile padding. No equivalent to the Hive Routes `<HivePageShell>` `flex-1` panel rule is needed here (Community pages aren't panel-as-page like hive routes are). |

**No `<CommunityPageShell>` wrapper component is required** — unlike hive routes (where `<HivePageShell>` enforces back-link + panel-as-page chrome), Community surfaces are heterogeneous (some are single-panel, some are 2-col grids, some are claim cards). The shared chrome is at the token + class level (`community.css`), not at the wrapper-component level.

---

## §3 — Structural deviations beyond the 3 pre-locked IA tweaks

The bundle stays close to the handoff prompt. Beyond Q3's three locked IA tweaks, every other deviation is either chrome-only or a small additive UX change. Walking each:

| # | Deviation | Surface(s) | Verdict | Rationale |
|---|---|---|---|---|
| D1 | `/community` section rail becomes a single pill-rail (5 tiles + badges, hub-rail chrome) instead of the current 5-tile grid | 01 | **ACCEPT** | Visually denser, semantic-equivalent. Existing `<SectionRail>` rewrites to the pill-rail shape. Brand-yellow active state via `--brand-soft`. |
| D2 | `/community` ditches "Hives section rail tile routes to /studio" — bundle's tile routes to /hives index (which doesn't exist) | 01 | **PARTIAL ACCEPT** | Hives tile keeps `href="/studio"` until a `/hives` index exists (out-of-scope for C5d). Mockup label "6 joined" maps to existing `getUserHivesView().length`. |
| D3 | Activity event row uses `is-friend-event` left-edge brand-yellow stripe (already shipped in C5b) — bundle confirms shape | 01 | OK — no delta | Current `<ActivityEventRow>` already implements this. Verify class name parity post-port. |
| D4 | `/discover` background flips from `bg-[#141414]` to `--canvas-dark-100` (#262728) | 03 | **ACCEPT** | Pre-design-system hex baked into `app/[locale]/(public)/discover/page.tsx:31`. Port to the same `min-h-screen bg-[#262728]` pattern used by every other (app) route. |
| D5 | `/u/[username]` background flips from `bg-[#141414]` to `--canvas-dark-100` + adopts panel chrome (instead of `#888` muted hex + `border-[#2a2a2a]`) | 12 | **ACCEPT** | Same pre-design-system hex baked into `app/[locale]/(public)/u/[username]/page.tsx:119`. Wholesale chrome refresh required for parity. |
| D6 | Profile page sparks + activity merge into a single chronological "Recent activity" section | 12, 19 | **ACCEPT** (already in locked Q3) | Confirms Q3's "Sparks+Activity merged". Requires extending `getProfileActivityAction` projection OR composing on the server with an interleaved sort. |
| D7 | Profile stats become a `.stat-strip` (4-cell horizontal strip with `--canvas-dark-300` dividers) instead of inline comma-separated text | 12 | **ACCEPT** | Pure chrome refresh of the existing 6 stats. Choose 4 priority stats: Followers / Following / Friends / Books. Words written + Sparks created move into mono meta line below or drop. |
| D8 | `/clubs/[clubId]` club header gets a banner band (`cover-grad` with cover-art accent) above the avatar/title/CTA cluster | 10 | **ACCEPT** | Pure chrome addition. `--pt` driven by club's primary tag or random per-club accent. Falls back to neutral gradient when no accent. |
| D9 | Club About panel uses 2-col grid (`about-grid` — description+rules left / currently-reading+info-row right) | 10 | **ACCEPT** | Current `<ClubAboutPanel>` is single column. Restructure into 2-col on `lg:`; stacks on mobile. Server data shape unchanged. |
| D10 | Reading list detail gets a 4-cell `.stat-strip` (Books / Followers / Read / Created) inside the header panel | 08 | **ACCEPT** | Replaces the current inline meta line. Pure chrome refresh; data already on the row. |
| D11 | Reading list `BookRow` gains an explicit drag-handle column (`grid-template-columns: 18px 64px 1fr auto`) and a "Show more" affordance on long commentary | 08 | **ACCEPT** | Drag-handle column makes the existing dnd-kit handle explicit (was inline). Show more is a small client toggle on `<BookRow>` for commentary > N chars (already exists in shipped code per C3 T13). |
| D12 | Notification bell becomes a 380px popover anchored to the bell icon (not a full-page list) with per-row icon chip + unread-row brand-tint background | 22 | **VERIFY** with Chris | Current `<NotificationsBell>` already renders an inline list. Mockup makes it a portaled popover with `.nrow.unread { background: oklch(from var(--brand) l c h / 0.05) }`. Mockup shape is what shipped — but the chrome refresh is meaningful. If Chris wants to keep the current full-page Notifications route as a "View all" target, port the popover for the bell click and keep the route. |
| D13 | Sparks index header introduces a deadline countdown chip (`.deadline`) on each VOTING card | 04 | **ACCEPT** | The deadline display already exists in `<Countdown>` (shipped in C2 T14). Mockup wraps it in the new `.deadline` chrome (recessed inset pill). Pure chrome refresh of the existing component. |
| D14 | Club Discussion thread mockup uses `.disc-card` 2-col grid for the thread list rows (title+meta left / reply count right) | 10c, 11 | **ACCEPT** | Current `<DiscussionCard>` is single-row. New grid is cleaner forum-list shape. |
| D15 | Club Members panel uses the forum-table chrome with `--club-role-*` pills + brand Owner pill | 10d | **ACCEPT** (load-bearing) | Current panel is ad hoc. Forum-table port locks the 13th brand-yellow surface in place — verify Owner pill renders before any of the per-row dropdowns. |
| D16 | Settings panel uses `<VisibilityPicker>` 3-card radio with `--list-visibility-*` accents on selected state | 10f | **ACCEPT** | Generic `<VisibilityPicker>` already lives at `components/visibility-picker.tsx` (post-C5b T10). New token pipe — selected card's `.vi` icon chip uses `oklch(from var(--brand) l c h / 0.2)` background + the new `--list-visibility-*` token for the icon color. |
| D17 | Bell `unread-row` tint is `oklch(from var(--brand) l c h / 0.05)` (very subtle) | 22 | **ACCEPT** | Small chrome detail — current bell has no unread-tint. |
| D18 | Notification preferences page is single-panel multi-section with shadcn-flavored `.switch` rendered via `[aria-checked]` | 13 | **ACCEPT** | Current page uses shadcn Switch primitive. Mockup's `.switch` is the same visual contract. Should NOT require Switch primitive re-skin — verify it inherits the C5b refresh; if not, add the `[aria-checked="true"] { background: var(--brand) }` rule. |

**Total deviations**: 18. **Accepted: 17.** **Verify-with-Chris: 1** (D12 — bell popover vs full-page list).

No structural rejections. The bundle stays inside the handoff prompt's constraints.

### Hidden de-scopes from the bundle worth flagging

- **Empty state covers (16-20)**: each empty state has a recommended CTA pair. Verify the empty-state shells in shipped code already render dual CTAs; if not, the empty-state ports add them.
- **Access-denied profile (21)** matches existing `<ProfileUnavailable>` semantics — same icon + copy shape, just port the `.claim-card` chrome.
- **Friend invite + Club invite claim (14, 15)** use the new `.claim-stage` + `.claim-card` chrome. Current routes (`/friend-invite/[token]/page.tsx`, `/clubs/[clubId]/invite/[token]/page.tsx`) wear ad hoc chrome — port to the shared claim-card shape.
- **`InviteClaimedToast` (shared)** chrome refresh — current `<InviteClaimedToast>` uses sonner default; mockup shows a brand-yellow custom toast with a check chip. Verify whether to customize sonner's `toast.success` style or keep the default.

---

## §4 — Per-surface delta table

Each row: **surface** — **route + file** — **width / chrome** — **bundle proposes** — **delta classification** — **risk** — **do-not-regress callouts**.

| # | Surface | Route / file | Width | Bundle proposes | Delta | Risk | Do-not-regress |
|---|---|---|---|---|---|---|---|
| 01 | Community hub | `(app)/community/page.tsx` + `_components/{section-rail,activity-feed,activity-event-row,requests-card}` | w-5xl | Pill-rail section nav + 2-col grid (1fr / 280px) + tile-card feed events + 3 mini right-rail panels | STRUCTURAL (rail shape) | Low | Feed cursor pagination, friend-first sort, `is-friend-event` left-edge stripe, RequestsCard accept/decline optimistic flow |
| 02 | Friends | `(app)/friends/page.tsx` + `_components/{friends-tab-strip,friends-list-tab,requests-tab,sent-tab,suggested-tab}` | w-3xl | **3 tabs** (Friends / Pending [Received+Sent segment] / Suggested) + forum-table for Friends list + card-stack for Suggested | STRUCTURAL (tab consolidation — Q3) | Med | `requests-tab` accept/reject server actions; `sent-tab` cancel server action; pagination on each tab |
| 03 | Discover | `(public)/discover/page.tsx` + `_components/*` | w-5xl | Same 5-tab strip + `bg-[#262728]` backdrop fix | VISUAL-ONLY (chrome) + bg fix | Low | `getDiscoverFeedAction` projection; per-tab sort+filter URL state |
| 04 | Sparks index | `(public)/sparks/page.tsx` | w-5xl | Active/Voting/Past sections + SparkCard grid + `.deadline` countdown chip | VISUAL-ONLY | Low | `sweepSparkStatuses` lazy-sweep on read; visibility gating via `canViewSpark` |
| 05 | Spark detail | `(public)/sparks/[sparkId]/page.tsx` | w-3xl | Status pill + visibility pill + countdown + entry list sorted by votes when VOTING/CLOSED | VISUAL-ONLY | Low | `<SparkSubmitPanel>` gating; entry sort opt-in via `sort='top'` on VOTING/CLOSED |
| 06 | Spark entry reader | `(public)/sparks/[sparkId]/entry/[entryId]/page.tsx` | w-3xl | Centered prose w/ derived-title h1 + threaded comments | VISUAL-ONLY | Low | `deriveTitle` headline; `<SparkEntryComments>` 2-level threaded with `<ReplyComposer>` |
| 07 | Reading lists | `(app)/reading-lists/page.tsx` | w-5xl | My / Following sections + ListCard grid + Liked-variant 🤍 Auto pill | VISUAL-ONLY | Low | Liked-list lazy-create; 3-section query (`mine` / `following` / discover →) |
| 08 | Reading list detail | `(app)/reading-lists/[listId]/page.tsx` | w-5xl | ListDetailHeader panel + 4-cell stat-strip + BookList w/ drag-handle col + show-more commentary | STRUCTURAL (stat-strip + drag-col) | Med | dnd-kit reorder (owner+CUSTOM only); 5-star inline edit; `LIKED_LIST_IMMUTABLE` server guard; commentary excerpt threshold |
| 09 | Clubs index | `(app)/clubs/page.tsx` | w-5xl | My clubs section + Discover more link + ClubCard grid | VISUAL-ONLY | Low | `getClubsAction({filter:'mine'})` |
| 10 | Club detail — About | `(app)/clubs/[clubId]/page.tsx` + `_components/club-about-panel` | w-5xl | Cover-band header + **6-tab order: About / Books / Discussions / Members / Schedule / Settings** + 2-col About grid | STRUCTURAL (tab reorder Q3 + 2-col grid) | Med | `?tab=` URL contract; mod/owner Settings gate; `viewerMembership` pending-request pill follow-up |
| 10b | Club — Books panel | `clubs/_components/club-books-panel` | w-5xl | 3 sections: Currently reading / Up next (QUEUE w/ dnd reorder) / Past reads (collapsed accordion) | VISUAL-ONLY | Low | `deriveCurrentBookTx` atomic 4-step pattern; partial-unique-index `CURRENT` constraint; reorder via tx |
| 10c | Club — Discussions panel | `clubs/_components/club-discussions-panel` | w-5xl | `.disc-card` 2-col forum rows: title+meta / reply count | VISUAL-ONLY | Low | Pinned-first sort tuple; `viewerLiked` two-query stitch |
| 10d | Club — Members panel | `clubs/_components/club-members-panel` | w-5xl | Forum-table (avatar+identity / role pill OR styled dropdown / actions) + **`.role-owner = --brand`** | STRUCTURAL (forum-table) | Med | OWNER full control + Transfer ownership; MOD limited to Remove MEMBERs; CANNOT_REMOVE_OWNER guard; 13th brand-yellow surface (Owner pill) |
| 10e | Club — Schedule panel | `clubs/_components/club-schedule-panel` | w-5xl | Timeline view sorted targetDate ASC + past/today/future indicators | VISUAL-ONLY | Low | `getClubScheduleAction(clubId, currentBookId)`; canManageSchedule gating |
| 10f | Club — Settings panel | `clubs/_components/club-settings-panel` | w-3xl | Metadata form + 3-card VisibilityPicker + Discoverable toggle + Danger Zone Delete | VISUAL-ONLY | Low | 3-layer discoverable defense; `<InviteByUsernameInput>`, `<InviteLinkDialog>`, `<PendingInvitesPanel>`, `<JoinRequestsPanel>` |
| 11 | Club discussion thread | `clubs/[clubId]/discussions/[discussionId]/page.tsx` | w-3xl | Post + replies (one-level threaded) + ReplyComposer | VISUAL-ONLY | Low | `viewerLiked` per-row; PinToggle MOD+ gate; reply count denorm |
| 12 | Profile | `(public)/u/[username]/page.tsx` + `_components/*` | w-5xl | `--canvas-dark-100` backdrop + panel chrome + **section order: Header / bio / friendship UI / stats / Lists / Clubs / Books / Sparks+Activity** + `.stat-strip` | STRUCTURAL (section reorder Q3 + bg fix D5) + visual | High | Block-aware masquerade (`<ProfileUnavailable>`); FriendButton + FollowButton + FriendStatusSection; `getMutualFriends` + mute lookup; `bookCount` + `wordCount` projection |
| 13 | Notification preferences | `(app)/settings/notifications/page.tsx` + `_components/notification-preferences-form` | w-3xl | Single-panel multi-section (Friends / Mentions / Activity / Group invites) + shadcn Switch styled via `.switch[aria-checked]` | VISUAL-ONLY | Low | Optimistic toggle + sonner rollback; 4-section grouping; `shouldSkipNotification` skip-at-write enforcement |
| 14 | Friend invite claim | `(public)/friend-invite/[token]/page.tsx` | w-md (claim-card) | Centered claim-card w/ icon chip + tone color (error/warning/muted/success) + 2 stacked actions | VISUAL-ONLY | Low | Auth gate → sign-up redirect with `?next=` (safeNextPath); success redirect to `/u/{inviter}?invite_claimed=1` |
| 15 | Club invite claim | `(public)/clubs/[clubId]/invite/[token]/page.tsx` + `_components/invite-result` | w-md (claim-card) | Same claim-card chrome; 6 error states + 2 success | VISUAL-ONLY | Low | BLOCKED masquerades as TOKEN_NOT_FOUND; ALREADY_MEMBER silent-redirects; SELF_INVITE branch |
| 16 | Empty community feed | inside 01 | w-5xl | `.empty` hero w/ glyph + dual CTAs (Find friends / Browse discover) | VISUAL-ONLY | Low | Empty state fires only when feed is truly empty (not friend-filtered) |
| 17 | Empty reading lists | inside 07 | w-5xl | `.empty` hero w/ glyph + dual CTAs (Create your first list / Discover lists) | VISUAL-ONLY | Low | Empty state respects Liked-list lazy create (Liked appears after first like, not before) |
| 18 | Empty clubs | inside 09 | w-5xl | `.empty` hero w/ dual CTAs (Start a club / Discover clubs) | VISUAL-ONLY | Low | None |
| 19 | Empty own fresh profile | inside 12 | w-5xl | Self-view empty state for new accounts (no books/lists/clubs/sparks) | VISUAL-ONLY | Low | Self-view detection via `isSelf` |
| 20 | Empty sparks | inside 04 | w-5xl | `.empty` hero w/ dual CTAs (Start your first / Browse closed) | VISUAL-ONLY | Low | Anon viewer sees different copy than authed |
| 21 | Access denied profile | inside 12 | w-md (claim-card) | Claim-card chrome w/ Lock icon + tone-muted | VISUAL-ONLY | Low | `<ProfileUnavailable>` already shipped — chrome refresh only |
| 22 | Notification bell dropdown | `(app)/_components/notifications-bell.tsx` | 380px popover | Portaled popover anchored to bell + per-row icon chip + unread row brand-tint + spinner for MENTION resolution | VISUAL-ONLY + (verify D12) | Med | C5b T9 async deep-link resolver + `pendingRowId` spinner; `mentionHref` dispatcher; `markNotificationReadAction` on click |

**Classification totals:** 7 STRUCTURAL · 19 VISUAL-ONLY · 1 verify-with-Chris (D12 inside #22). **Highest-risk surfaces:** #12 Profile (full chrome refresh + section reorder + block-aware masquerade preservation) → #10 Club detail (tab reorder + 2-col About grid) → #10d Members panel (forum-table port locks the 13th brand-yellow surface) → #02 Friends (4 tabs → 3 with Pending segment).

---

## §5 — Shared components delta

The bundle's `shared-components.html` renders ~14 canonical components. Per-component delta (live code path / mockup proposes / delta):

| # | Component | Live code path | Bundle proposes | Delta |
|---|---|---|---|---|
| 1 | `<SparkCard>` | `app/[locale]/(public)/discover/_components/spark-card.tsx` (+ sparks consumers) | `.ccard` w/ `cover-grad` band + `.cc-pills` (status + visibility) + title + desc + `.deadline` countdown + entry-count `.cc-stat` | VISUAL-ONLY chrome refresh |
| 2 | `<ListCard>` | `(app)/reading-lists/_components/list-card.tsx` | `.ccard` w/ cover-grad + visibility pill + tags + reading-line (`Reading: <i>`) + owner card + 2 stats. Liked variant: `auto` pill (red heart) + Private pill + `17 books` stat. | VISUAL-ONLY chrome refresh |
| 3 | `<ClubCard>` | `(app)/clubs/_components/club-card.tsx` | `.ccard` w/ visibility + open-join pill + tags + 📖 reading line + owner card + member count | VISUAL-ONLY chrome refresh |
| 4 | `<DiscussionCard>` (club + hive variants) | `clubs/_components/discussion-card.tsx` | `.disc-card` 2-col grid: title (Comfortaa) + brand-yellow lucide icon + meta line / reply count cluster | VISUAL-ONLY chrome refresh |
| 5 | `<BookRow>` (reading list) | `(app)/reading-lists/_components/book-row.tsx` | `.book-row` w/ drag-handle col + cover-paper thumb + title/author/stars + Newsreader commentary + Read toggle + kebab | STRUCTURAL (drag-handle col) |
| 6 | `<ActivityEventRow>` | `(app)/community/_components/activity-event-row.tsx` | `.tile` w/ `.event-demo` 3-col (avatar / text+meta-mono / optional friend pill) + `is-friend-event` left-edge stripe | VISUAL-ONLY chrome refresh |
| 7 | `<RequestsCard>` (right rail) | `(app)/community/_components/requests-card.tsx` | Panel w/ `sec-head` + count + 2-col req-item rows + Accept/Decline btn pair | VISUAL-ONLY chrome refresh |
| 8 | `<MyHivesPanel>` (right rail) | `(app)/community/_components/sidebar/my-hives-panel.tsx` | Panel w/ mini-row list (avatar + name + meta) | VISUAL-ONLY chrome refresh |
| 9 | `<ActiveSparksPanel>` (right rail) | `(app)/community/_components/sidebar/active-sparks-panel.tsx` | Panel w/ status pill + spark title + entries+deadline meta | VISUAL-ONLY chrome refresh |
| 10 | `<FollowListButton>` | `(app)/reading-lists/_components/follow-list-button.tsx` | `.btn-brand` Follow / `.btn-tile` Following (state-driven) | VISUAL-ONLY chrome refresh |
| 11 | `<VisibilityPicker>` (generic) | `components/visibility-picker.tsx` | 3-card radio: `.vis-opt` w/ icon chip + Vt label + Vd desc + brand-border on selected. Selected state's `.vi` background flips to `oklch(from --brand l c h / 0.2)` + icon flips to `var(--brand)` | VISUAL-ONLY chrome refresh + selected-state polish |
| 12 | `<InviteClaimedToast>` | `components/invite-claimed-toast.tsx` | Brand-yellow pill toast w/ `.tc` check chip + bold copy | **VERIFY**: current uses sonner default. Either customize sonner toast style OR ship a `<Toaster>` theme override. Discuss with Chris. |
| 13 | `<NotificationsBell>` (the trigger icon, not the dropdown) | `(app)/_components/notifications-bell.tsx` | 42px square w/ brand bell + brand badge (2px backdrop ring) | VISUAL-ONLY chrome refresh |
| 14 | `<StatStrip>` (new shared) | NEW shared component | 4-cell horizontal strip w/ `--canvas-dark-300` dividers + Comfortaa value + mono uppercase label | NEW — promote to `components/stat-strip.tsx` since both `<ListDetailHeader>` + `<ProfilePage>` consume |

`<MentionLink>`, `<RenderMentionsInText>`, `<MentionableTextarea>`, `<MentionPopover>` (shared mention plumbing from C5a) do NOT appear in the bundle as canonical renders — they're rendered inline within prose surfaces (post bodies, list commentary, club description). Snapshot-username render stays load-bearing post-port; the v1 rename-staleness trade-off is preserved.

---

## §6 — 4-phase implementation roadmap

Mirrors the Hive Routes delta phasing. Phase A foundation work lands FIRST so every surface in Phases B/C/D inherits the new tokens + chrome via `community.css` / class adoption.

### Phase A — Foundation (1-3 commits, no per-page churn)

- **A1**: Add 8 new tokens to `app/globals.css` (3 `--list-visibility-*` + 3 `--spark-status-*` + 2 `--club-role-*`). Update AGENTS.md Design System §"brand-yellow 12-place map" → 13-place map with the Owner-pill entry.
- **A2**: Port `community.css` shared classes into the app. Decision: either (a) inline the contents into `app/globals.css` under a `/* COMMUNITY C5d */` banner, or (b) create `app/community.css` and import from each Community route's `layout.tsx`. **Recommend (a)** — single source of truth, mirrors how Hive Routes shipped `hive.css` rules inside `globals.css`. ~600 LOC additive.
- **A3**: Promote shared presentational components: `<PageHead>` (eyebrow+title+sub) + `<StatStrip>` (4-cell horizontal strip). Both stateless; both land in `components/community/` or similar shared dir.

**Phase A is safe + parallel to all later phases.** It only adds; nothing renames.

### Phase B — Visual polish per surface (parallel-safe; 12-14 commits)

Pure chrome refreshes that don't change data shapes, server actions, IA, or component prop signatures. Each surface is independently shippable.

- 03 `/discover` — bg fix + tab-strip chrome refresh
- 04 `/sparks` index — SparkCard chrome refresh + section panels
- 05 `/sparks/[sparkId]` — header chrome + countdown deadline chip + entry list chrome
- 06 `/sparks/[sparkId]/entry/[entryId]` — reader prose chrome + comments chrome
- 07 `/reading-lists` — chrome refresh + ListCard + Liked variant
- 09 `/clubs` — chrome refresh + ClubCard
- 10b Books panel — 3-section chrome
- 10c Discussions panel — `.disc-card` 2-col forum rows
- 10e Schedule panel — timeline chrome
- 10f Settings panel — VisibilityPicker selected-state polish + Danger Zone
- 11 Club discussion thread — post + replies + ReplyComposer chrome
- 13 Notification prefs — single-panel section grouping + Switch verify
- 14 Friend invite claim — port to claim-card chrome
- 15 Club invite claim — port to claim-card chrome
- 16-20 Empty states — port to `.empty` hero shape inside their parent routes
- 21 Access denied — port `<ProfileUnavailable>` to claim-card chrome
- 22 Bell dropdown — port to popover chrome + per-row icon chip + unread tint

### Phase C — Structural changes (needs verification per item; 5-7 commits)

Each item requires sign-off OR a small data/IA change before chrome polish.

- **C1** — 01 `/community` section rail rewrites as pill-rail (D1 + D2).
- **C2** — 02 `/friends` 4-tab → 3-tab consolidation (Q3 IA tweak): Pending tab carries Received+Sent sub-segments. URL contract changes (`?tab=requests` + `?tab=sent` collapse into `?tab=pending&seg=received|sent`); add a 308 redirect for legacy URLs.
- **C3** — 08 `/reading-lists/[listId]` — port `<BookList>` to explicit drag-handle column + `<StatStrip>` consumer.
- **C4** — 10 `/clubs/[clubId]` — `<ClubTabStrip>` tab order reorder (Q3) + 2-col `<ClubAboutPanel>` grid + cover-band header.
- **C5** — 10d Members panel — forum-table port + `<ClubMemberRow>` w/ `--club-role-*` pills + `.role-owner` = brand-yellow (13th surface lock).
- **C6** — 12 `/u/[username]` — full chrome refresh + section reorder (Q3): Header / bio / friendship / stats / Lists / Clubs / Books / merged Sparks+Activity. Requires merging `getProfileSparksAction` + `getProfileActivityAction` server-side (interleaved by createdAt) OR client-side render-merge.
- **C7** — 01 ActivityFeed integration with new pill-rail header + `<RequestsCard>` / `<MyHivesPanel>` / `<ActiveSparksPanel>` right-rail mini-panels chrome refresh.

### Phase D — Net-new components / IA pass (1-2 commits)

- **D1** — `<StatStrip>` shared component lands as part of Phase A3 but is wired into consumers in Phase B/C surfaces.
- **D2** — `<InviteClaimedToast>` style decision: customize sonner toast vs ship a brand-yellow custom toast. Discuss with Chris before Phase B14/15 ports.

### Suggested commit count estimate

| Phase | Commits | Rough scope |
|---|---|---|
| A | 3 | tokens · community.css port · shared components |
| B | 14 | surface-by-surface chrome refreshes |
| C | 7 | structural + IA changes |
| D | 1-2 | toast decision + final sweep |
| **Total** | **~25** | Port complete; Community phase visually locked |

---

## §7 — Cross-cutting "do not disturb" engineering callouts

Repeat these in every implementer-facing task brief.

1. **AppNav stays.** Mounted at `app/[locale]/(app)/layout.tsx:30` for every authed Community route. Public Community routes (claim flows, public profile, public sparks/discover) have their own implicit chrome — DO NOT add AppNav to public routes via this port. The C5d mockups deliberately omit AppNav because they're standalone HTML; the live app already wears it.
2. **Cream paper stays studio-chapter-editor-only.** No Community surface reaches for `--paper-*` tokens. The bundle confirms this — every prose surface uses `var(--canvas-dark-ink)` with `font-prose` (Newsreader) when the content is body prose (entry bodies, discussion bodies, commentary).
3. **Brand-yellow restraint is now a 13-place map.** Update AGENTS.md Design System note. The new 13th entry is `<ClubMemberRow>` Owner pill (`.pill.role-owner` → `--pt: var(--brand)`). Do NOT introduce brand-yellow on Mod/Member pills, club tags, list tags, or any cover band.
4. **Server actions stay locked.** `getCommunityFeedAction`, `getSparksAction`, `getSparkAction`, `getListsAction`, `getListAction`, `getClubsAction`, `getClubAction`, `listClubMembersAction`, `getClubBooksAction`, `listClubDiscussionsAction`, `getClubScheduleAction`, `listClubPendingInvitesAction`, `listClubJoinRequestsAction`, `getPublicProfileAction`, `getProfileBooksAction`, `getProfileSparksAction`, `getProfileActivityAction`, `getUserPublicListsAction`, `getUserPublicClubsAction`, `getFriendCountAction`, `listFriendsAction`, `listPendingFriendRequestsAction`, `getNotificationPreferencesAction`, `getNotificationsAction` — chrome refresh consumes existing return shapes; do NOT request projection extensions unless explicitly approved per-surface (the only known projection ask is C6 merging Sparks + Activity for the profile section).
5. **`recordSocialActivityTx` + `recordMentionNotificationsTx` patterns intact.** Activity events fire from source actions in-tx; mention notifications use the canonical 5-step pattern (extract → resolve → tx → diff → conditional record). Chrome refresh never touches the tx-wrapped writers.
6. **`isBlocked` + `areFriends` privacy helpers canonical.** Block-aware masquerade on profile page (`<ProfileUnavailable>` when either party has blocked the other) is load-bearing — port the chrome but keep the masquerade BEFORE any data fetch that could leak existence (page.tsx:42).
7. **All optimistic-mutation patterns from C1-C5b stay.** Specific surfaces to preserve:
   - C4 W7 `<PendingInvitesPanel>` Cancel + `<JoinRequestsPanel>` Approve/Reject (optimistic-removal + sonner + router.refresh).
   - C2 spark like flip with rollback.
   - C3 List follow toggle with rollback.
   - C3 BookRow `isRead` toggle.
   - C5b bell async resolver w/ `pendingRowId` spinner.
   - C5b friend-first feed cursor decoder with `typeof decoded.isFriend === 'boolean'` guard.
   - C4 club join request flow `REQUEST_ALREADY_PENDING` toast.
   - C4 BookClub current-book transition via `deriveCurrentBookTx` atomic 4-step pattern.
8. **`<MentionLink>` snapshot username render is load-bearing.** All prose surfaces (sparks entry comments, list commentary, club discussion bodies, hive bodies, book comments, profile bios, club descriptions/rules) wrap rendering in `<RenderMentionsInText>`. Chrome refresh inherits the snapshot-username trade-off (rename breaks link target; v1 accepted).
9. **All locale-prefixed routes preserved.** Every route under `/[locale]/(app)` and `/[locale]/(public)` keeps the locale segment. URL contract reorder for #02 Friends (Q3) is the only routing-shape change — confirm a 308 redirect for old `?tab=requests` + `?tab=sent` → new `?tab=pending&seg=received|sent`.
10. **C4 club W7 + C5b W5 follow-ups stay on the books.** Items still open (non-blocking, named to not get forgotten):
    - `ClubSummary.viewerMembership.pendingJoinRequest` widening (T13 follow-up).
    - C5b `VisibilityPicker` `SparkVisibility` cast — generic-ization shipped in C5b T10, verify post-port that no surfaces still cast to `SparkVisibility`.
    - C5b `?invite_claimed=1` sonner toast handler — already shipped via `<InviteClaimedToast>` mount in C5b W4 T7; verify chrome port doesn't drop the mount.
11. **No new modals.** shadcn Dialog primitive already inherits the cool-gray chrome from the editor refresh. The bundle's `<CreateClubModal>`, `<EditClubMetadataDialog>`, `<AddBookToClubModal>`, `<CreateListModal>`, `<EditListMetadataDialog>`, `<AddBookModal>`, `<DiscussionComposer>`, `<ReplyComposer>` modals all stay as-is — chrome inherited.
12. **`InviteClaimedToast` style decision** (§6 D2) needs Chris sign-off before Phase B14/15 — keep sonner default OR customize per the bundle's brand-yellow pill rendering.
13. **Tests stay green.** Current baseline is 634/634 (C5b ship). Port should not regress.

---

## Open questions for Chris before plan-writing

1. **D12 — bell popover vs. notifications route**: bundle shows a 380px popover anchored to the bell. Current bell renders a full inline list. Keep the popover as bell-trigger + a `/notifications` route as "View all"? Or replace the inline list with the popover and no separate route? (Recommendation: ship the popover for the bell click; defer a `/notifications` index route until needed.)
2. **#12 D2 — InviteClaimedToast**: customize sonner default or ship a brand-yellow custom toast component? (Recommendation: customize sonner — single visual override at the `<Toaster>` mount.)
3. **C7 D7 — Profile stats**: keep 6 stats (Followers / Following / Friends / Words / Books / Sparks) in inline meta line vs. promote 4 to `.stat-strip` (Followers / Following / Friends / Books) with rest in mono meta below. (Recommendation: 4-cell strip + mono meta below.)
4. **D2 — `/community` Hives tile destination**: continue routing to `/studio` (current) vs. plan a future `/hives` index route. (Recommendation: keep `/studio` link until a `/hives` route ships in a future phase.)

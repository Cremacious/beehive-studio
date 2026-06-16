# Community Hub Dashboard Redesign

**Date:** 2026-06-16
**Surface:** `/[locale]/community`
**Scope:** Presentation + highlight-panel server actions. No DB schema changes.

## Problem

The current `/community` page reads as blank and half-finished. It has a 5-tab strip (Friends / Hives / Sparks / Lists / Clubs), a single activity column, and one small "My Hives" + "Your Sparks" sidebar. For a brand-new account it's almost entirely empty whitespace; for an active account it still under-surfaces what's happening across the 5 hubs (each of which is now its own dedicated page).

The 5 hubs (`/hives`, `/reading-lists`, `/clubs`, `/sparks`, `/friends`) are the deep-browse surfaces. `/community` should be the **dashboard** that sits above them — feed-centric, with per-category highlight panels surfacing items that would otherwise slip past notifications and the activity feed.

## Layout

Two columns, full viewport height (`calc(100vh - <header>)`):

```
┌────────────────────────────────────────────┬────────────────┐
│                                            │  ⬡ HIVES    →  │
│                                            │  ...           │
│                                            ├────────────────┤
│             ACTIVITY FEED                  │  ⚡ SPARKS  →  │
│         (flex-1, full height)              │  ...           │
│                                            ├────────────────┤
│                                            │  📖 LISTS   →  │
│                                            │  ...           │
│                                            ├────────────────┤
│                                            │  📚 CLUBS   →  │
│                                            │  ...           │
│                                            ├────────────────┤
│                                            │  👥 FRIENDS →  │
│                                            │  ...           │
└────────────────────────────────────────────┴────────────────┘
```

- **Outer container:** `max-w-[1680px] mx-auto px-4 py-6` (matches /sparks + /hives hubs).
- **Grid:** `grid-cols-[minmax(0,1fr)_300px] gap-4`. Below `xl` (1280px), right rail collapses to a vertical stack BELOW the feed.
- **Feed column** uses panel-gradient chrome (`linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + `--r-card` + `--sh-card` + `--br-card`). Title row "Activity" in brand-yellow Comfortaa bold.
- **Right rail** is a sticky `<aside>` with `position: sticky; top: 80px; height: calc(100vh - 100px); display: flex; flex-direction: column; gap: 12px`. Each panel gets `flex: 1 1 0` so the 5 panels divide the rail height evenly. Inside each panel, the body is `overflow-y: auto; min-height: 0` so long highlight lists scroll within their own slot.
- **Tab strip from current page is DROPPED.** The 5 panels each link to their respective hub via the panel header → arrow.

## Activity feed column

- Header: `Activity` Comfortaa bold brand-yellow, 18px.
- Rows: reuse existing `<ActivityEventRow>` + `getHiveActivityFeedAction` from H1. **No new event sources in v1** (broadening to spark/list/club/friend events tracked as follow-up, see §Deferred).
- Pagination: existing cursor-paginated "Load older" via `useTransition` is preserved.
- **Empty state (zero rows):** feed column stays full height. Centered hero: brand-yellow ✨ icon chip (`h-12 w-12` rounded with `rgba(255,195,0,0.1)` bg), `<strong>Your feed will fill in here</strong>`, secondary line "Join a Hive, follow writers, or try a Spark to see activity from your community.", two CTAs ("Try a Spark →" brand-yellow pill linking `/sparks/new`, "Find friends →" tile linking `/friends?tab=find`).
- Feed column never collapses to natural height. `display: flex; flex-direction: column` with row list in a `flex: 1; min-height: 0` container so rows scroll inside the column when they overflow.

## Right rail — 5 highlight panels

Each panel = small card with `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `--r-row` + `--sh-tile`. Header row: lucide icon + Comfortaa-bold uppercase label brand-yellow + chevron-right link. Below header, 0-3 highlight rows separated by hairline border. Each row has an 8px mono uppercase tag in muted brand-yellow + body line in `--canvas-dark-ink`. When a panel has zero applicable highlights, show one muted "empty" row with a CTA link.

### ⬡ HIVES (header → `/hives`)

1. **Submissions pending review** — owner/mod-only. "N pending in <hive name>" → links to that hive's `/submissions`. Aggregates across all hives where viewer has `OWNER | MODERATOR`.
2. **Active word goal progress** — "<hive name>: N% · Xd left". Shows the most-urgent active goal (lowest progress % among non-expired goals across viewer's hives).
3. **Stale hive nudge** — "<hive name>: no activity for Nd". Surfaces when a hive viewer owns/mods has had `last_activity_at < now() - 7 days` AND `member_count > 1`.

### ⚡ SPARKS (header → `/sparks`)

1. **Voting ending soon** — sparks the viewer ENTERED that are in VOTING status with deadline < 24h. "'<title>' voting ends in Nh".
2. **Sparks entered awaiting result** — count of viewer's entries in CLOSED sparks with no winnerEntryId set. "N entered, awaiting decision".
3. **Open sparks from writers you follow** — count of OPEN sparks (deadline > now) created by followed writers in the last 7 days. "@<username> just posted a new prompt" (most recent).

### 📖 LISTS (header → `/reading-lists`)

1. **Your list trending** — viewer-owned list with `+N followers in last 7 days` where N >= 3. "<list name> +N followers this week".
2. **New list from someone you follow** — list created by a followed writer in the last 7 days. "@<username> published '<list title>'".
3. **Book added to a list you follow** — list the viewer follows that gained >= 1 book in the last 7 days. "<list name> got N new books".

### 📚 CLUBS (header → `/clubs`)

1. **Current book progress** — clubs viewer is in with a current book. "<club name>: <book title>" + optional chapter progress if `clubs.current_chapter_index` exists (graceful skip if not — see §Open).
2. **Unread discussion replies** — sum of new replies since viewer's `last_seen_at` per club discussion they participate in. "N new replies in your club". V1 simplification: replies posted in the last 48h to any discussion in a club viewer is a member of, capped at top 99.
3. **Pending invite/join request** — viewer has a `book_club_invites` row with status `PENDING` directed at them. "@<inviter> invited you to <club name>".

### 👥 FRIENDS (header → `/friends`)

1. **Pending friend requests** — count of `friendships` rows where viewer is recipient and status is PENDING. "N friend requests".
2. **Friend milestones** — friend published a new book OR finished a Spark win in the last 7 days. "@<username> finished their first book" / "@<username> won a Spark".
3. **Suggested writers to follow** — count from existing `getSuggestedWritersAction` capped at 5. "N new suggestions".

## Server actions

One new action file `lib/actions/community-hub.actions.ts` exporting **one aggregator action**:

```ts
getCommunityHubHighlightsAction(): Promise<ActionResult<{
  hives: { pendingReview: ..., wordGoal: ..., stale: ... }
  sparks: { votingEnding: ..., awaitingResult: ..., openFromFollowed: ... }
  lists:  { yourTrending: ..., newFromFollowed: ..., booksAddedToFollowed: ... }
  clubs:  { currentBook: ..., unreadReplies: ..., pendingInvite: ... }
  friends:{ pendingRequests: ..., milestones: ..., suggestions: ... }
}>>
```

- Internally `Promise.all` 15 sub-queries (3 per category × 5 categories). Each sub-query is small + scoped to the viewer. Cap each at the 1-3 rows actually displayed.
- Wrap the result in React `cache()` so the request shares results if other components on the page need pieces of it.
- Existing actions reused: `getHiveActivityFeedAction` (feed rows), `getSuggestedWritersAction` (friends panel suggestions count).
- Authed-only (guests on `/community` already redirect; not in this scope).

## Components

```
app/[locale]/(app)/community/
  page.tsx                  ← rewrite: parallel-fetch feed + highlights
  _components/
    activity-feed.tsx       ← KEEP (preserve full-height empty state)
    activity-event-row.tsx  ← KEEP unchanged
    activity-feed-empty.tsx ← NEW: brand-yellow hero with 2 CTAs
    highlights-rail.tsx     ← NEW: server component, renders 5 panels
    highlight-panel.tsx     ← NEW: shared chrome (header + rows + empty)
    panels/
      hives-panel.tsx       ← NEW
      sparks-panel.tsx      ← NEW
      lists-panel.tsx       ← NEW
      clubs-panel.tsx       ← NEW
      friends-panel.tsx     ← NEW
```

Each `<XxxPanel>` is a pure-presentation server component that receives its slice of the highlights payload as props. `<HighlightsRail>` is the orchestrator — receives the full payload, renders the 5 panels in order.

**Drop:** `MyHivesPanel`, `_components/community-page-shell.tsx` (current shell), the tab strip from current `page.tsx`. The "Your Sparks" stub on the current page → folded into Sparks panel's empty state. The "Tab" component is removed entirely.

## Empty state behavior

Three layers of empty:

1. **Whole-account brand new:** feed shows hero CTA. Each panel shows its empty-row variant (e.g. Hives → "No hives yet · Create one →" linking `/studio`; Sparks → "Today's prompt: ..." showing the daily prompt template; Friends → "Invite a friend →" linking `/friends?tab=find`). Lists + Clubs panels show "Discover" CTAs.
2. **Per-panel empty within active account:** show the single muted "empty" row. Panel still renders so vertical rhythm is preserved.
3. **Feed empty but account has hubs:** unusual but possible (e.g. solo writer with no follows). Same feed hero as case 1.

The feed column and right rail are both `flex: 1` inside their own layout containers, so neither collapses when content is absent.

## Visual treatment

- Inherits the load-bearing design system. No new tokens.
- Brand-yellow used only on: feed "Activity" title, panel headers, panel arrows, CTA pills, accent tags ("Needs review" / "Voting" / "Trending" labels in 8px mono uppercase).
- Avatars in feed rows reuse existing `<Avatar>` component (already wired in `ActivityEventRow`).
- Hairlines between rows: `border-top: 1px solid rgba(255,255,255,0.04)`.

## Accessibility

- Panels are `<section aria-labelledby="panel-{id}-title">`.
- Panel header is the `<a>` containing the icon, title, and arrow — single click target for the whole header.
- Empty state CTAs are real `<Link>`s.
- Feed scroll region has `aria-live="polite"` only on the "Load older" loading indicator (rows themselves aren't announced).

## Acceptance criteria

1. `/[locale]/community` renders 2-col layout at xl+ with feed left + 5-panel rail right.
2. Below xl, panels stack below feed in source order.
3. Feed column always renders at `calc(100vh - 100px)` minimum — empty hero centered, never collapsed.
4. All 5 panels render even when each has zero highlights — empty-row variant shown.
5. Each panel header is a single clickable link to its hub.
6. Highlight rows max 3 per panel; long lines clamp to 2 lines.
7. `getCommunityHubHighlightsAction` parallel-fetches 15 sub-queries and caps each at displayed length.
8. Existing activity feed + Load older preserved unchanged.
9. The current 5-tab strip is removed.
10. The right rail scrolls within itself if total content height exceeds viewport; the feed scrolls within its column.

## Open questions resolved at spec time

- **Tab strip drop:** confirmed — the 5 panels (each linking to its hub) replace the tab strip's navigation role.
- **Single aggregator action vs 5 per-panel actions:** single aggregator. One round-trip, one cache key, simpler page.
- **Drop "Your Sparks" stub:** yes — replaced by Sparks panel.

## Deferred (non-blocking follow-ups)

1. **Cross-hub activity events.** Feed currently sources from `hive_activity` only. Broadening to spark wins / list publishes / club discussions / friend acceptances should happen in a follow-up that adds a unified `social_activity` view or extends `hive_activity` taxonomy. Keep the feed as-is for v1 so the redesign ships without DB work.
2. **`clubs.current_chapter_index` denorm.** "Current book progress" in Clubs panel shows "<club>: <book title>" only if no chapter-progress column exists; if a `current_chapter_index` lands later, append "· ch N of M".
3. **Unread-replies precision.** V1 uses "replies posted in last 48h to discussions you participate in" as a proxy. True unread (per-viewer last-seen timestamp) is a follow-up.
4. **Mobile sidebar drawer.** Below xl, panels stack below feed. A "Highlights ▾" drawer that floats above the feed on mobile is a future polish pass.
5. **Per-panel snooze/dismiss.** Power-user follow-up — for now, highlights re-evaluate every page load.

## Files touched

**New:** 8 component files under `_components/` + `panels/`; 1 action file `lib/actions/community-hub.actions.ts`.
**Modified:** `app/[locale]/(app)/community/page.tsx` (full rewrite ~80 LOC).
**Deleted:** `_components/community-page-shell.tsx`, current tab strip, current `MyHivesPanel` (folded into Hives panel).

**Test count delta:** +0 surface tests for v1 (aggregator query-shape tests deferred until follow-up broadens highlight rules).

# Community Hub Dashboard — Implementation Plan

**Spec:** [docs/superpowers/specs/2026-06-16-community-hub-dashboard-design.md](../specs/2026-06-16-community-hub-dashboard-design.md)
**Date:** 2026-06-16
**Surface:** `/[locale]/community`
**Wave shape:** 5 tasks, ~1 day total. NO DB changes.

## Scope recap

Replace the current `/community` page (5-tab strip + sparse activity column + tiny My Hives/Your Sparks sidebar) with a feed-centric dashboard: full-height activity feed left + 300px sticky right rail of 5 highlight panels (Hives · Sparks · Lists · Clubs · Friends). Each panel caps at 3 rows surfacing items that slip past notifications and the feed.

## Wave map

- **T1** — `getCommunityHubHighlightsAction` aggregator + 15 sub-queries
- **T2** — 5 panel components + shared `<HighlightPanel>` chrome + `<HighlightsRail>` orchestrator
- **T3** — `<ActivityFeedEmpty>` brand-yellow empty hero + `<ActivityFeed>` full-height shell
- **T4** — `page.tsx` rewrite + delete legacy files (`community-page-shell.tsx`, current tab strip, `MyHivesPanel`, Your Sparks stub)
- **T5** — Smoke + AGENTS.md + push

Each task = 1 commit. tsc clean after every commit. No new tests for v1 (spec §Deferred — surface-shape tests roll into the follow-up that broadens highlight rules).

---

## T1 — Aggregator action + 15 sub-queries

**New file:** `lib/actions/community-hub.actions.ts`

### Shape

```ts
'use server'

export type HivePanelData = {
  pendingReviewCount: number
  pendingReviewHiveName: string | null
  pendingReviewHiveId: string | null
  wordGoalHiveName: string | null
  wordGoalHiveId: string | null
  wordGoalPct: number | null  // 0-100
  wordGoalDaysLeft: number | null
  staleHiveName: string | null
  staleHiveId: string | null
  staleDaysSinceActivity: number | null
}

export type SparksPanelData = {
  votingEndingTitle: string | null
  votingEndingId: string | null
  votingEndingHoursLeft: number | null
  awaitingResultCount: number
  openFromFollowedCount: number
  openFromFollowedAuthorUsername: string | null  // most-recent author
}

export type ListsPanelData = {
  yourTrendingListName: string | null
  yourTrendingListId: string | null
  yourTrendingFollowerGain: number | null  // last 7d
  newFromFollowedListTitle: string | null
  newFromFollowedListId: string | null
  newFromFollowedAuthorUsername: string | null
  booksAddedListName: string | null
  booksAddedListId: string | null
  booksAddedCount: number | null
}

export type ClubsPanelData = {
  currentBookClubName: string | null
  currentBookClubId: string | null
  currentBookTitle: string | null
  unreadRepliesCount: number  // 48h proxy
  pendingInviteClubName: string | null
  pendingInviteClubId: string | null
  pendingInviteInviterUsername: string | null
}

export type FriendsPanelData = {
  pendingRequestsCount: number
  milestoneUsername: string | null  // friend's first book / spark win in last 7d
  milestoneType: 'first_book' | 'spark_win' | null
  suggestionsCount: number
}

export type CommunityHighlights = {
  hives: HivePanelData
  sparks: SparksPanelData
  lists: ListsPanelData
  clubs: ClubsPanelData
  friends: FriendsPanelData
}

export const getCommunityHubHighlightsAction =
  async (): Promise<ActionResult<CommunityHighlights>>
```

Wrap the body in React `cache()` for request-scoped dedup.

### Sub-queries (15 total)

All scoped to `await requireAuth()` userId. `Promise.all` the 15 internally.

**Hives (3):**
1. `pendingReview` — `SELECT count(*), hive name FROM hive_submissions s JOIN hives h JOIN hive_members m WHERE m.user_id=$1 AND m.role IN ('OWNER','MODERATOR') AND s.draft_status='PENDING' GROUP BY h.id ORDER BY count DESC LIMIT 1`. Returns aggregate count across all such hives + name of the one with the most pending.
2. `wordGoal` — `SELECT h.name, h.id, g.target_words, g.end_date, COALESCE(SUM(l.words_delta), 0) AS progress FROM hive_word_goals g JOIN hives h JOIN hive_members m LEFT JOIN hive_word_logs l ON l.hive_id=g.hive_id AND l.logged_at BETWEEN g.start_date AND g.end_date WHERE m.user_id=$1 AND g.is_active=true AND g.end_date > now() GROUP BY h.id, g.id ORDER BY (progress::float / NULLIF(g.target_words, 0)) ASC LIMIT 1`. Pick the lowest-% incomplete goal. `pct = round(progress / target * 100)`; `daysLeft = ceil((end_date - now) / 1d)`.
3. `stale` — `SELECT h.name, h.id, EXTRACT(day FROM (now() - h.last_activity_at)) AS days FROM hives h JOIN hive_members m WHERE m.user_id=$1 AND m.role IN ('OWNER','MODERATOR') AND h.last_activity_at < now() - interval '7 days' AND h.member_count > 1 ORDER BY h.last_activity_at ASC LIMIT 1`.

**Sparks (3):**
1. `votingEnding` — `SELECT sp.title, sp.id, EXTRACT(hour FROM (sp.deadline - now())) AS hours_left FROM sparks sp JOIN spark_entries e ON e.spark_id=sp.id WHERE e.user_id=$1 AND sp.status='VOTING' AND sp.deadline < now() + interval '24 hours' ORDER BY sp.deadline ASC LIMIT 1`.
2. `awaitingResult` — `SELECT count(DISTINCT sp.id) FROM sparks sp JOIN spark_entries e ON e.spark_id=sp.id WHERE e.user_id=$1 AND sp.status='CLOSED' AND sp.winner_entry_id IS NULL`.
3. `openFromFollowed` — `SELECT count(*), up.username FROM sparks sp JOIN follows f ON f.followee_id=sp.creator_id JOIN user_profiles up ON up.user_id=sp.creator_id WHERE f.follower_id=$1 AND sp.status='OPEN' AND sp.deadline > now() AND sp.created_at > now() - interval '7 days' GROUP BY up.username ORDER BY max(sp.created_at) DESC LIMIT 1`. Count is total; username is the most recent author.

**Lists (3):**
1. `yourTrending` — `SELECT rl.title, rl.id, count(rlf.id) AS gain FROM reading_lists rl JOIN reading_list_follows rlf ON rlf.list_id=rl.id WHERE rl.user_id=$1 AND rlf.followed_at > now() - interval '7 days' GROUP BY rl.id HAVING count(rlf.id) >= 3 ORDER BY gain DESC LIMIT 1`.
2. `newFromFollowed` — `SELECT rl.title, rl.id, up.username FROM reading_lists rl JOIN follows f ON f.followee_id=rl.user_id JOIN user_profiles up ON up.user_id=rl.user_id WHERE f.follower_id=$1 AND rl.kind!='LIKED' AND rl.first_publicly_discoverable_at > now() - interval '7 days' ORDER BY rl.first_publicly_discoverable_at DESC LIMIT 1`.
3. `booksAdded` — `SELECT rl.title, rl.id, count(rlb.id) AS added FROM reading_lists rl JOIN reading_list_follows rlf ON rlf.list_id=rl.id JOIN reading_list_books rlb ON rlb.list_id=rl.id WHERE rlf.user_id=$1 AND rlb.added_at > now() - interval '7 days' GROUP BY rl.id ORDER BY added DESC LIMIT 1`.

**Clubs (3):**
1. `currentBook` — `SELECT bc.name, bc.id, bcb.title FROM book_clubs bc JOIN book_club_members bcm ON bcm.club_id=bc.id LEFT JOIN book_club_books bcb ON bcb.id=bc.current_book_id WHERE bcm.user_id=$1 AND bc.current_book_id IS NOT NULL ORDER BY bc.last_activity_at DESC LIMIT 1`.
2. `unreadReplies` — V1 proxy: `SELECT count(*) FROM book_club_discussion_replies r JOIN book_club_discussions d ON d.id=r.discussion_id JOIN book_club_members m ON m.club_id=d.club_id WHERE m.user_id=$1 AND r.author_user_id != $1 AND r.created_at > now() - interval '48 hours'`. Capped at 99 (display `99+`).
3. `pendingInvite` — `SELECT bc.name, bc.id, up.username FROM book_club_invites i JOIN book_clubs bc ON bc.id=i.club_id JOIN user_profiles up ON up.user_id=i.invited_by_user_id WHERE i.recipient_user_id=$1 AND i.status='PENDING' ORDER BY i.created_at DESC LIMIT 1`.

**Friends (3):**
1. `pendingRequests` — `SELECT count(*) FROM friendships WHERE recipient_id=$1 AND status='PENDING'`.
2. `milestones` — `SELECT up.username, 'first_book' AS type FROM books b JOIN friendships f ON ((f.requester_id=$1 AND f.recipient_id=b.user_id) OR (f.recipient_id=$1 AND f.requester_id=b.user_id)) JOIN user_profiles up ON up.user_id=b.user_id WHERE f.status='ACCEPTED' AND b.status='PUBLISHED' AND b.created_at > now() - interval '7 days' UNION ALL SELECT up.username, 'spark_win' AS type FROM sparks sp JOIN spark_entries e ON e.id=sp.winner_entry_id JOIN friendships f ON ((f.requester_id=$1 AND f.recipient_id=e.user_id) OR (f.recipient_id=$1 AND f.requester_id=e.user_id)) JOIN user_profiles up ON up.user_id=e.user_id WHERE f.status='ACCEPTED' AND sp.updated_at > now() - interval '7 days' ORDER BY 1 LIMIT 1`.
3. `suggestions` — call existing `getSuggestedWritersAction({ limit: 5 })` → return `.length`.

### Defensive shape

- Every sub-query may legitimately return zero rows. All result fields are nullable; counts default to 0.
- DB field reality check during implementation: verify column names against `db/schema/*.ts` (the AGENTS.md notes several gotchas: `creator_id` not `user_id` on sparks, `recipient_id`/`requester_id` on friendships, `first_publicly_discoverable_at` on lists, `last_activity_at` on hives, etc.). Adjust SQL inline if drift is found.
- Wrap each sub-query in `try { ... } catch { return null }` so one slow/failing query doesn't take down the whole rail.

### Commit message

`feat(community-hub): getCommunityHubHighlightsAction aggregator with 15 parallel sub-queries.`

---

## T2 — Panel components + rail orchestrator

**New files** (all under `app/[locale]/(app)/community/_components/`):

- `highlight-panel.tsx` — shared chrome: panel-gradient card + header (lucide icon + Comfortaa-bold brand-yellow label + chevron-right link wrapping the whole header) + body slot + empty-row variant. Props: `{ icon, label, href, children, emptyMessage?, emptyHref? }`.
- `panels/hives-panel.tsx` — pure presentation. Props: `HivePanelData & { href: string }`. Renders 0-3 rows from the data.
- `panels/sparks-panel.tsx` — same shape with `SparksPanelData`.
- `panels/lists-panel.tsx` — `ListsPanelData`.
- `panels/clubs-panel.tsx` — `ClubsPanelData`.
- `panels/friends-panel.tsx` — `FriendsPanelData`.
- `highlights-rail.tsx` — server component that renders 5 panels in vertical flex. Props: `{ highlights: CommunityHighlights, locale: string }`. Threads `/${locale}/hives` etc. as `href` props.

### Row chrome

Each highlight row inside a panel:

```tsx
<div className="border-t border-white/[0.04] first:border-t-0 py-2">
  <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--brand)]/80">
    {tag}
  </div>
  <div className="text-xs text-[var(--canvas-dark-ink)] line-clamp-2">
    {body}
  </div>
</div>
```

Empty-row variant for panels with zero highlights:

```tsx
<div className="py-2 text-xs text-[var(--canvas-dark-ink-muted)] italic">
  {emptyMessage} {emptyHref && <Link className="text-[var(--brand)] not-italic">→</Link>}
</div>
```

### Panel-specific row choices (per spec)

Each panel picks the first non-null highlight per slot and renders it. If ALL 3 slots are null, render the empty variant.

- **Hives:** rows in order pendingReview → wordGoal → stale. Display: `"N pending in <name>"` / `"<name>: N% · Nd left"` / `"<name>: no activity for Nd"`.
- **Sparks:** votingEnding → awaitingResult → openFromFollowed. `"'<title>' voting ends in Nh"` / `"N entered, awaiting decision"` / `"@<user> just posted a new prompt"`.
- **Lists:** yourTrending → newFromFollowed → booksAdded. `"<list> +N followers this week"` / `"@<user> published '<title>'"` / `"<list> got N new books"`.
- **Clubs:** currentBook → unreadReplies → pendingInvite. `"<club>: <book title>"` / `"N new replies in your club"` / `"@<inviter> invited you to <club>"`.
- **Friends:** pendingRequests → milestones → suggestions. `"N friend requests"` / `"@<user> finished their first book"` or `"@<user> won a Spark"` / `"N new suggestions"`.

Brand-new account fallback per panel (when all 3 slots null): each panel shows a different CTA. Hives → "No hives yet · Create one →" `/studio`. Sparks → "Today's prompt is waiting →" `/sparks`. Lists → "Build your first list →" `/reading-lists`. Clubs → "Discover open clubs →" `/discover?tab=clubs`. Friends → "Invite a friend →" `/friends?tab=find`.

### Commit message

`feat(community-hub): 5 highlight panels + shared chrome + rail orchestrator.`

---

## T3 — Activity feed full-height + empty hero

**Modify:** `_components/activity-feed.tsx` — wrap rows in `flex: 1; min-height: 0` scrollable inner container; outer is `flex flex-col h-full`. Header "Activity" Comfortaa bold brand-yellow.

**New file:** `_components/activity-feed-empty.tsx` — centered hero:

```tsx
<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
  <div className="h-12 w-12 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)]">
    <Sparkles className="h-6 w-6" />
  </div>
  <div className="font-bold text-[var(--canvas-dark-ink-strong)]">
    Your feed will fill in here
  </div>
  <p className="text-sm text-[var(--canvas-dark-ink-muted)] max-w-xs">
    Join a Hive, follow writers, or try a Spark to see activity from your community.
  </p>
  <div className="flex gap-2 mt-2">
    <Link href={`/${locale}/sparks/new`} className="brand-pill">Try a Spark →</Link>
    <Link href={`/${locale}/friends?tab=find`} className="tile-pill">Find friends →</Link>
  </div>
</div>
```

`<ActivityFeed>` mounts `<ActivityFeedEmpty>` when `initialEvents.length === 0 && nextCursor === null`.

### Commit message

`feat(community-hub): activity feed full-height shell + brand-yellow empty hero.`

---

## T4 — Page rewrite + legacy delete

**Rewrite:** `app/[locale]/(app)/community/page.tsx`

```tsx
export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await requireAuth()  // existing pattern; redirect handled upstream

  const [feedResult, highlightsResult] = await Promise.all([
    getHiveActivityFeedAction({ limit: 30 }),
    getCommunityHubHighlightsAction(),
  ])

  const events = feedResult.success ? feedResult.data.events : []
  const nextCursor = feedResult.success ? feedResult.data.nextCursor : null
  const highlights = highlightsResult.success ? highlightsResult.data : EMPTY_HIGHLIGHTS

  return (
    <div className="max-w-[1680px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <main className="min-h-[calc(100vh-100px)] flex">
          <ActivityFeed
            initialEvents={events}
            initialNextCursor={nextCursor}
            locale={locale}
          />
        </main>
        <aside className="xl:sticky xl:top-20 xl:h-[calc(100vh-100px)]">
          <HighlightsRail highlights={highlights} locale={locale} />
        </aside>
      </div>
    </div>
  )
}
```

`EMPTY_HIGHLIGHTS` constant defined inline at top of file with all-null/zero defaults so panels still render their CTAs if the action throws.

**Delete:**
- `app/[locale]/(app)/community/_components/community-page-shell.tsx`
- The 5-tab strip component (look in `_components/` — likely `community-tab-strip.tsx` or similar; grep first)
- `_components/my-hives-panel.tsx` (folded into HivesPanel)
- Any "Your Sparks" stub component (grep `Your Sparks` to find it)

**Verify** no orphan imports remain after delete via `npx tsc --noEmit`.

### Commit message

`feat(community-hub): page rewrite + drop legacy shell/tabs/sidebar (T4).`

---

## T5 — Smoke + AGENTS.md + push

Chris-run smoke on `npm run dev` at `/en/community`:

1. **Layout (authed account with activity):** 2-col layout at xl+; feed left, 5 panels right; right rail sticky at `top: 80px`; rail height = `calc(100vh - 100px)`; below xl rail stacks below feed.
2. **Feed rows:** existing activity rows render unchanged; Load older works.
3. **Feed empty state (forced):** temporarily disable `getHiveActivityFeedAction` return → confirm centered brand-yellow ✨ hero with 2 CTAs renders + feed column STILL fills viewport height (no collapse).
4. **Panels populated:** each panel shows 0-3 rows; rows clamp to 2 lines; tags render in 8px mono uppercase brand-yellow.
5. **Panels empty:** confirm per-panel CTA empty variants render (Hives "Create one →" / Sparks "Today's prompt" / Lists "Build your first list" / Clubs "Discover" / Friends "Invite").
6. **Panel header links:** each panel header click routes to `/${locale}/hives` etc. (5 surfaces).
7. **Old tabs gone:** confirm the Friends/Hives/Sparks/Lists/Clubs tab strip from the current page is absent.
8. **883/883 tests still pass; tsc clean.**

After smoke passes:
- Update AGENTS.md Resume Here (Last updated → 2026-06-16; Last commit → T5 SHA; Next concrete step → "Community Hub dashboard ✅ CODE-COMPLETE. Pick next pivot.").
- `git push origin main`.

### Commit message

`docs(agents): community hub dashboard T1-T5 ✅ code-complete.`

---

## Risks / open follow-ups

1. **DB column drift.** Field names in the SQL above are best-effort against AGENTS.md memory; verify against `db/schema/*.ts` at implementation time and adjust inline. Likely candidates: `creator_id` vs `user_id` on sparks; `recipient_user_id` vs `recipient_id` on club invites + friendships; `is_active` vs `status` on word goals.
2. **`book_club_discussion_replies` table** existence — if the actual table is named differently (e.g. `book_club_discussion_posts` with a `parent_id` self-FK), rewrite the unreadReplies sub-query accordingly.
3. **Suggested writers count** — `getSuggestedWritersAction` may not exist by that exact name; AGENTS.md mentions it under /friends. If the signature differs, adapt.
4. **Per-panel sub-query failures** caught + nulled silently. Logging captured failures to console for dev visibility but not surfaced to the user.
5. **15 parallel sub-queries** add up. Each is small + indexed, but at scale could benefit from a single combined CTE. Watch dev devtools network tab during smoke — if the action takes >300ms locally, denormalize.
6. **The 48h proxy for unreadReplies** can show "0 new replies" even when there are weeks of unread replies older than 48h. Acceptable per spec §Deferred.

## File touch summary

- **New (9):** `community-hub.actions.ts`, `highlight-panel.tsx`, `highlights-rail.tsx`, `activity-feed-empty.tsx`, 5× panels.
- **Modified (2):** `community/page.tsx`, `activity-feed.tsx`.
- **Deleted (3+):** `community-page-shell.tsx`, tab strip, `my-hives-panel.tsx` (+ any Your Sparks stub).
- **Net LOC:** roughly +600 / -250.

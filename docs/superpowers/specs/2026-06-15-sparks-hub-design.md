# Sparks Hub Redesign — Community Page (Design Spec)

**Date:** 2026-06-15
**Replaces:** the current `/[locale]/sparks` page (three-section walnut-chrome list of all public discoverable sparks).
**Status:** Locked via brainstorm session, awaiting implementation plan.
**Related:** Spark redesign spec [2026-06-15-spark-redesign-design.md](./2026-06-15-spark-redesign-design.md) for the title-first model + canonical `<SparkCard>` component. This spec uses the same card.

---

## 1. Intent

Today, `/[locale]/sparks` and `/[locale]/discover?tab=sparks` show effectively the same thing — a list of public, discoverable Sparks visible to the viewer. The two routes are semantically identical, and `/sparks` looks under-finished (large empty gutters, mismatched chrome predating the dark iOS refresh).

This redesign repurposes `/sparks` as the **community Sparks hub** — a personal, signed-in surface that shows Sparks the viewer has skin in: ones they created, ones from people they follow, ones from friends, and ones they've entered. Public discovery (browsing strangers' prompts) stays at `/discover?tab=sparks`. The two routes now serve distinct needs.

## 2. Decisions

| Q | Decision |
|---|----------|
| Q1 — Content buckets | Four: **Yours · Following · Friends · Entered.** Sparks fitting multiple buckets get a single source tag per precedence (yours > friend > following > entered). |
| Q2 — Layout | iOS tab strip + mixed sortable grid (matches the new `/discover` bookstore-aisle chrome). Single canonical surface, tab narrows the population. |
| Q3 — Default tab | **All** (mixed view across all four buckets). |
| Q4 — Default sort | **Recent** (`createdAt` DESC). Other options: Ending soon · Most entries · Status. |
| Q5 — Source tag style | Mini badge in card header, sitting where the genre label currently does. Tinted background + 9px mono uppercase label. Per source: brand-yellow (Yours), soft blue (Following), soft purple (Friend), soft green (Entered). Genre still shows on Yours-tagged cards (no source-of-self conflict). |
| Q6 — Auth | Guests redirect to `/sign-in?next=/sparks` — the hub is by definition a personal surface. |
| Q7 — Schema | NO schema changes. All four buckets derive from existing tables (`sparks`, `follows`, `friendships`, `spark_entries`). |
| Q8 — Card | Reuses the canonical `<SparkCard>` (commit `cf4a72e`) with a new optional `sourceTag` prop that replaces the genre label when present. |

## 3. Page IA

`/[locale]/sparks` renders, top-to-bottom:

1. **PageHead** — title `Sparks`, subtitle `Sparks from you, your circle, and prompts you've entered.`, right-side `+ New Spark` brand-pill `<Link>` to `/sparks/new`. Back link to `/community`.
2. **Tab strip** — iOS segmented control matching the `<DiscoveryModeToggle>` shape:
   - `All · N` (default)
   - `Yours · N`
   - `Following · N`
   - `Friends · N`
   - `Entered · N`
   - Active tab is brand-yellow pill; inactive tabs are mono uppercase labels with subtle hover.
   - Counts pulled from a single bucketed aggregate query so each tab is honest about its scope.
3. **Sort header** — `{count} sparks · Sort: {selected} ▾`. Sort dropdown options:
   - `Recent` (default — `createdAt` DESC)
   - `Ending soon` (OPEN: `deadline` ASC; VOTING: `votingEndsAt` ASC; CLOSED at bottom)
   - `Most entries` (`entryCount` DESC)
   - `Status` (custom order: OPEN → VOTING → CLOSED, then `createdAt` DESC within each group)
4. **Active filter chips row** — dismissible chips for whatever filters are set beyond defaults (sort isn't a chip; tab isn't a chip; this row appears when other future filters arrive).
5. **Grid** — 3-column responsive grid (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, `justify-items: start`). Each cell is `<SparkCard>` with `sourceTag` set from the bucket precedence.
6. **NumberedPagination** — same shared component as `/discover`. PAGE_SIZE = 12.

## 4. Source tag styling

Per spec §2 Q5. Visual specs:

| Source | Background | Label color | Label text |
|---|---|---|---|
| Yours | `oklch(from var(--brand) l c h / 0.15)` | `var(--brand)` | `YOURS` |
| Following | `oklch(0.6 0.15 240 / 0.15)` (soft blue) | `oklch(0.7 0.15 240)` | `FOLLOWING` |
| Friend | `oklch(0.55 0.18 310 / 0.15)` (soft purple) | `oklch(0.7 0.18 310)` | `FRIEND` |
| Entered | `oklch(0.6 0.15 150 / 0.15)` (soft green) | `oklch(0.7 0.15 150)` | `ENTERED` |

Genre label is hidden whenever `sourceTag` is present, including on Yours cards — visual uniformity wins over the small information loss (the detail page shows everything one click away). On `/discover?tab=sparks` the card has no source tag, so the genre label stays in its current position.

The card header on the Hub reads: `[status pill · countdown] ............ [source tag]`.

## 5. Empty states

Per spec §3 tab branches. Tab is empty when the bucket query returns zero rows.

- **All empty** — friendly empty card. Copy: `No sparks yet. Start one of your own, or follow some writers on Discover.` Two CTAs: `+ New Spark` brand-pill and `Browse Discover →` outline button.
- **Yours empty** — copy: `You haven't written a Spark yet. Got a prompt nagging at you?` CTA: `+ New Spark` brand-pill.
- **Following empty** — copy: `No active sparks from the writers you follow yet. Try Discover to find more authors.` CTA: `Browse Discover →`.
- **Friends empty** — copy: `No active sparks from friends.` CTA: `Find friends →` (link to `/friends`).
- **Entered empty** — copy: `You haven't entered any Sparks yet. Browse Discover for one that catches you.` CTA: `Browse Discover →`.

Empty-state container: centered max-w-md card with mono uppercase eyebrow `{TAB} · 0 SPARKS`, Comfortaa h3 message, paragraph copy, CTA row. Matches the empty-state pattern from `/studio` library.

## 6. URL state

- `?tab=all|yours|following|friends|entered` — default `all` omits the param.
- `?sort=recent|ending|entries|status` — default `recent` omits the param.
- `?page=N` — default 1 omits the param.

Tab switches reset `?page=1` (page param dropped). Sort changes reset `?page=1`. Page changes preserve tab + sort.

URL is the source of truth. Server-renders first paint. Bookmark-survive on refresh.

## 7. Data layer

### 7.1 New action — `getCommunitySparksAction`

```ts
export type CommunitySparkSource = 'yours' | 'following' | 'friend' | 'entered'

export type CommunitySparkRow = SparkCard & {
  source: CommunitySparkSource
}

export async function getCommunitySparksAction(args: {
  viewerId: string
  tab?: 'all' | 'yours' | 'following' | 'friends' | 'entered'
  sort?: 'recent' | 'ending' | 'entries' | 'status'
  page?: number
}): Promise<
  ActionResult<{
    sparks: CommunitySparkRow[]
    totalCount: number
    bucketCounts: {
      yours: number
      following: number
      friends: number
      entered: number
      all: number
    }
  }>
>
```

Lives in a new file `lib/actions/sparks-hub.actions.ts` to keep the already-large `sparks.actions.ts` from growing.

### 7.2 Bucket SQL fragments

For viewer `V`:
- **Yours** — `sparks.creator_id = V`.
- **Following** — `sparks.creator_id IN (SELECT followee_id FROM follows WHERE follower_id = V) AND sparks.creator_id != V`.
- **Friends** — `sparks.creator_id IN (SELECT counter_party_id FROM friendships WHERE one_side = V AND status = 'ACCEPTED') AND sparks.creator_id != V`. Friendship counter-party resolution: if `requester_id = V` then counter is `addressee_id`; else if `addressee_id = V` then counter is `requester_id`. Wrap in a subquery that unions both sides.
- **Entered** — `sparks.id IN (SELECT spark_id FROM spark_entries WHERE user_id = V)`. Does NOT exclude `creator_id = V` — if you entered a spark you own (in dev seed only — production gate at `canEnterSpark` prevents this), it stays in Entered.

### 7.3 Tab resolution

- `tab = 'yours'` → only Yours WHERE.
- `tab = 'following'` → only Following WHERE (excludes Yours).
- `tab = 'friends'` → only Friends WHERE (excludes Yours).
- `tab = 'entered'` → only Entered WHERE.
- `tab = 'all'` → UNION of all four. Each row gets a `source` discriminator per precedence:
  - If `creator_id = V` → `'yours'`.
  - Else if creator is in Friends → `'friend'`.
  - Else if creator is in Following → `'following'`.
  - Else if entered → `'entered'`.

Precedence resolution happens in SQL via a CASE expression, OR in JS post-fetch via the bucket lookup sets.

### 7.4 Visibility gate

The viewer is always authed (guests redirect). Existing `canViewSpark` predicate handles block-aware filtering AND visibility (PUBLIC / FRIENDS / PRIVATE) checks. Apply per-row post-fetch.

Note: PRIVATE sparks belong only in `Yours` (you can see your own private spark). FRIENDS sparks appear in Friends/Following/Yours depending on relationship — `canViewSpark` enforces.

### 7.5 Bucket counts

A single sibling action `getCommunitySparkBucketCountsAction(viewerId)` returns the count per bucket so the tab strip can render counts. Or fold into `getCommunitySparksAction` return shape. Spec uses the latter (single round trip).

## 8. Component changes

### New
- `lib/actions/sparks-hub.actions.ts` — houses `getCommunitySparksAction`.
- `app/[locale]/(public)/sparks/_components/sparks-hub-shell.tsx` — server component shell (tab strip + sort header + chips + grid + pagination).
- `app/[locale]/(public)/sparks/_components/sparks-tab-strip.tsx` — client component segmented control. Mirrors `<DiscoveryModeToggle>` shape but with 5 tabs.
- `app/[locale]/(public)/sparks/_components/sparks-sort-dropdown.tsx` — small client component, lives in the sort header.
- `app/[locale]/(public)/sparks/_components/sparks-empty-state.tsx` — pure presentational; takes `{ tab, locale }` and renders the right empty card.

### Modified
- `app/[locale]/(public)/sparks/page.tsx` — full rewrite. Auth gate via `auth.api.getSession` + redirect. Parses sp, calls `getCommunitySparksAction`, renders the shell.
- `app/[locale]/(public)/discover/_components/spark-card.tsx` — gains optional `sourceTag?: CommunitySparkSource | null` prop. When set, replaces the genre label with the source badge per §4.
- `lib/discover/url-state.ts` — adds `parseSparksTab` / `parseSparksSort` helpers OR uses existing `parseRadio`. Prefer reusing `parseRadio` for consistency.

### Untouched
- `<SparkCard>`'s status pill, countdown, title, prompt teaser, meta footer — all unchanged.
- The legacy `getSparksAction` in `sparks.actions.ts` — keep for now in case `/sparks/[id]` detail page or any other consumer reads it; deletion is a follow-up cleanup.
- Spark detail page, submission flow, voting flow — unchanged.
- `/discover?tab=sparks` — unchanged.

## 9. URL examples

```
/en/sparks                                  → All tab default, recent sort, page 1
/en/sparks?tab=yours                        → Yours tab
/en/sparks?tab=following&sort=ending        → Following, sorted by ending soon
/en/sparks?tab=entered&page=2               → Entered, page 2
```

## 10. Design tokens reused

- `--brand` / `--brand-ink` for active tab pill and `+ New Spark` CTA.
- `--canvas-dark-ink` / `--canvas-dark-ink-muted` for body/meta text.
- `rgba(255, 255, 255, 0.04)` for the tab strip container (matches sidebar tile in `/discover`).
- Card tile gradient, hairline, sub-tile shadow tokens — all unchanged.
- New per-source `oklch` tints for the source badges (inline; not promoted to `:root` until a second consumer needs them).

## 11. Acceptance criteria

1. Guest visiting `/en/sparks` redirects to `/en/sign-in?next=/en/sparks`. Signing in lands them back on the hub.
2. Authed viewer sees the 5-tab strip with accurate counts per bucket.
3. Default tab `All` renders sparks from all four buckets interleaved, each card showing the right source tag.
4. Switching to `Yours` shows only sparks where `creatorId === viewerId`; tag is `YOURS`.
5. Switching to `Following` shows only sparks from followed authors (excluding own); tag is `FOLLOWING`.
6. Switching to `Friends` shows only sparks from accepted-friendship counterparts (excluding own); tag is `FRIEND`.
7. Switching to `Entered` shows only sparks where the viewer has submitted an entry; tag is `ENTERED`.
8. Sort changes reorder the grid; page resets to 1.
9. Pagination preserves tab + sort.
10. Empty state copy + CTA match spec §5 per tab.
11. `<SparkCard>` rendering identical to `/discover?tab=sparks` minus the source-tag swap on the right of the header.
12. URL bookmarks survive refresh.
13. The redesigned page renders cleanly without the legacy `cm-wrap w-5xl` walnut chrome (replaced with the new dark iOS surface matching `/discover`).

## 12. Out of scope (deferred)

1. **Activity-feed mode (D from brainstorm)** — could come back as a future Inbox tab once the four-bucket pattern beds in.
2. **Notifications integration** — when a spark you follow goes to voting, when your entry gets voted on, etc. — handled by the existing notifications system; not a Sparks Hub concern.
3. **Spark editing flow** (`/sparks/[id]/edit`) — separate task per spark redesign spec §11.
4. **Source badge on Discover sparks** — Discover by definition surfaces strangers; no source tag.
5. **Cleanup of legacy `getSparksAction`** — leave in place for now; delete when no consumers remain.
6. **Per-bucket filter chips** (e.g. status=OPEN, genre=fantasy) — possible v2 if the surface grows.
7. **Bucket count caching** — every render runs the per-bucket count query; could memoize with `unstable_cache` keyed on viewerId if hot.

## 13. Risks

- **`Friend` resolution complexity** — `friendships` table has bidirectional rows (requester + addressee). Both sides of the UNION need to be considered. Plan will sanity-check the subquery shape against existing friend-listing queries (e.g. `/friends` page).
- **`All` tab can show duplicate cards** if a spark fits multiple buckets — the precedence resolution dedupes by spark id, then assigns the highest-priority source tag. Plan must verify dedup is in JS (after UNION) since SQL UNION DISTINCT loses the source discriminator.
- **PRIVATE sparks** appearing in `Yours` is correct, but `canViewSpark` enforcement still runs to keep blocked-creator masquerade correct. The viewer never blocks themselves, so `Yours` rows always pass.
- **Bucket counts vs. visible counts** — if `canViewSpark` filters out some rows, the tab strip's count may overstate by the filtered amount. Plan accepts this minor inconsistency for v1; tabs say "approximately N" via the round-trip if Chris wants honest counts later.
